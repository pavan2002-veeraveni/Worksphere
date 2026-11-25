"""Comprehensive tests for WorkSphere FastAPI analytics endpoints."""

from datetime import date, timedelta

from tests.conftest import ORG_A, ORG_B, PROJECT_A1, USER_1, USER_2, FakeExecuteResult


def test_analytics_requires_api_key(make_client):
    client = make_client(lambda q, p=None: FakeExecuteResult([]))
    res = client.get(f"/api/v1/analytics/summary?org_id={ORG_A}")
    assert res.status_code == 401
    assert "Missing API key" in res.json()["detail"]


def test_analytics_rejects_invalid_api_key(make_client):
    client = make_client(lambda q, p=None: FakeExecuteResult([]))
    res = client.get(
        f"/api/v1/analytics/summary?org_id={ORG_A}",
        headers={"X-API-Key": "wrong-key"},
    )
    assert res.status_code == 401
    assert "Invalid API key" in res.json()["detail"]


def test_project_health_success(make_client, api_headers):
    def handler(query, params=None):
        sql = str(query)
        if "FROM projects WHERE id" in sql:
            return FakeExecuteResult([{"id": PROJECT_A1}])
        if "AS total_tasks" in sql:
            return FakeExecuteResult([{"total_tasks": 10, "completed_tasks": 8, "overdue_tasks": 1}])
        if "AS avg_cycle" in sql:
            return FakeExecuteResult([{"avg_cycle": 24.5}])
        return FakeExecuteResult([])

    client = make_client(handler)
    res = client.get(
        f"/api/v1/analytics/projects/{PROJECT_A1}/health?org_id={ORG_A}",
        headers=api_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["project_id"] == str(PROJECT_A1)
    assert body["total_tasks"] == 10
    assert body["completed_tasks"] == 8
    assert body["overdue_tasks"] == 1
    assert body["completion_rate"] == 0.8
    assert body["avg_cycle_time_hours"] == 24.5
    assert 0.0 <= body["health_score"] <= 100.0


def test_project_health_tenant_isolation_returns_404(make_client, api_headers):
    def handler(query, params=None):
        sql = str(query)
        if "FROM projects WHERE id" in sql:
            # Verify org_id filter is passed and simulates cross-tenant lookup returning empty
            assert params["org_id"] == str(ORG_B)
            assert params["project_id"] == str(PROJECT_A1)
            return FakeExecuteResult([])
        return FakeExecuteResult([])

    client = make_client(handler)
    res = client.get(
        f"/api/v1/analytics/projects/{PROJECT_A1}/health?org_id={ORG_B}",
        headers=api_headers,
    )
    assert res.status_code == 404


def test_project_health_invalid_uuid(make_client, api_headers):
    client = make_client(lambda q, p=None: FakeExecuteResult([]))
    res = client.get(
        f"/api/v1/analytics/projects/not-a-uuid/health?org_id={ORG_A}",
        headers=api_headers,
    )
    assert res.status_code == 422


def test_workload_success(make_client, api_headers):
    def handler(query, params=None):
        assert params["org_id"] == str(ORG_A)
        return FakeExecuteResult([
            {
                "user_id": USER_1,
                "name": "Alice Johnson",
                "assigned_tasks": 5,
                "completed_tasks": 4,
                "in_progress_tasks": 1,
            },
            {
                "user_id": USER_2,
                "name": "Bob Williams",
                "assigned_tasks": 4,
                "completed_tasks": 2,
                "in_progress_tasks": 1,
            },
        ])

    client = make_client(handler)
    res = client.get(f"/api/v1/analytics/workload?org_id={ORG_A}", headers=api_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["org_id"] == str(ORG_A)
    assert len(body["members"]) == 2
    assert body["members"][0]["utilization_rate"] == 0.8


def test_cycle_time_success(make_client, api_headers):
    def handler(query, params=None):
        sql = str(query)
        if "FROM projects WHERE id" in sql:
            return FakeExecuteResult([{"id": PROJECT_A1}])
        return FakeExecuteResult([
            {"status_name": "todo", "avg_hours": 12.5},
            {"status_name": "in_progress", "avg_hours": 36.0},
        ])

    client = make_client(handler)
    res = client.get(
        f"/api/v1/analytics/projects/{PROJECT_A1}/cycle-time?org_id={ORG_A}",
        headers=api_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["by_status"]["todo"] == 12.5
    assert body["by_status"]["in_progress"] == 36.0
    assert body["avg_total_hours"] == 24.25


def test_delivery_metrics_and_invalid_date_range(make_client, api_headers):
    today = date.today()
    start = today - timedelta(days=3)

    def handler(query, params=None):
        sql = str(query)
        if "FROM projects WHERE id" in sql:
            return FakeExecuteResult([{"id": PROJECT_A1}])
        if "AS completed" in sql:
            return FakeExecuteResult(scalar_val=4)
        if "AS remaining" in sql:
            return FakeExecuteResult(scalar_val=6)
        return FakeExecuteResult([{"completion_date": today.isoformat(), "completed_count": 2}])

    client = make_client(handler)
    res = client.get(
        f"/api/v1/analytics/projects/{PROJECT_A1}/delivery?org_id={ORG_A}&start_date={start}&end_date={today}",
        headers=api_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["completed_this_period"] == 4
    assert body["remaining"] == 6
    assert body["velocity"] == 1.0
    assert len(body["burndown"]) == 4

    # Invalid date range failure path
    bad = client.get(
        f"/api/v1/analytics/projects/{PROJECT_A1}/delivery?org_id={ORG_A}&start_date={today}&end_date={start}",
        headers=api_headers,
    )
    assert bad.status_code == 422


def test_summary_empty_org(make_client, api_headers):
    def handler(query, params=None):
        sql = str(query)
        if "AS total_projects" in sql:
            return FakeExecuteResult([{"total_projects": 0, "active_projects": 0}])
        if "AS total_tasks" in sql:
            return FakeExecuteResult([{"total_tasks": 0, "completed_tasks": 0, "overdue_tasks": 0}])
        return FakeExecuteResult([])

    client = make_client(handler)
    res = client.get(f"/api/v1/analytics/summary?org_id={ORG_B}", headers=api_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total_projects"] == 0
    assert body["avg_completion_rate"] == 0.0
    assert body["top_projects"] == []


def test_report_generation_and_tenant_isolated_download(make_client, api_headers):
    def handler(query, params=None):
        return FakeExecuteResult([
            {"project_id": PROJECT_A1, "project_name": "Platform Redesign", "total_tasks": 5, "completed_tasks": 3, "overdue_tasks": 0}
        ])

    client = make_client(handler)
    create_res = client.post(
        "/api/v1/analytics/reports/generate",
        json={"org_id": str(ORG_A), "report_type": "project_health", "format": "csv"},
        headers=api_headers,
    )
    assert create_res.status_code == 201
    report_id = create_res.json()["report_id"]

    # Same tenant can download
    dl_ok = client.get(f"/api/v1/analytics/reports/{report_id}?org_id={ORG_A}", headers=api_headers)
    assert dl_ok.status_code == 200
    assert "Platform Redesign" in dl_ok.text

    # Different tenant gets 404
    dl_cross = client.get(f"/api/v1/analytics/reports/{report_id}?org_id={ORG_B}", headers=api_headers)
    assert dl_cross.status_code == 404

    # Invalid report type returns 422
    bad = client.post(
        "/api/v1/analytics/reports/generate",
        json={"org_id": str(ORG_A), "report_type": "invalid_type", "format": "csv"},
        headers=api_headers,
    )
    assert bad.status_code == 422
