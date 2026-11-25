#!/bin/bash
# ============================================
# WorkSphere - Health Check Script
# ============================================

set -euo pipefail

API_URL=${API_URL:-http://localhost:4000}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
PYTHON_URL=${PYTHON_SERVICE_URL:-http://localhost:8000}

echo "========================================"
echo "WorkSphere Health Check"
echo "========================================"

check_service() {
    local name=$1
    local url=$2
    local response
    local status

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" 2>/dev/null || echo "000")

    if [ "${response}" = "200" ]; then
        echo "  ✅ ${name}: Healthy (${url})"
        return 0
    else
        echo "  ❌ ${name}: Unhealthy (HTTP ${response}) (${url})"
        return 1
    fi
}

FAILURES=0

echo ""
echo "Services:"
check_service "API Server" "${API_URL}/health" || ((FAILURES++))
check_service "API Ready" "${API_URL}/ready" || ((FAILURES++))
check_service "Frontend" "${FRONTEND_URL}" || ((FAILURES++))
check_service "Analytics" "${PYTHON_URL}/health" || ((FAILURES++))
check_service "Analytics Ready" "${PYTHON_URL}/ready" || ((FAILURES++))

echo ""
echo "Infrastructure:"
# Check PostgreSQL
if pg_isready -h ${DATABASE_HOST:-localhost} -p ${DATABASE_PORT:-5432} > /dev/null 2>&1; then
    echo "  ✅ PostgreSQL: Healthy"
else
    echo "  ❌ PostgreSQL: Unhealthy"
    ((FAILURES++))
fi

# Check Redis
if redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} -a ${REDIS_PASSWORD:-""} ping > /dev/null 2>&1; then
    echo "  ✅ Redis: Healthy"
else
    echo "  ❌ Redis: Unhealthy"
    ((FAILURES++))
fi

echo ""
echo "========================================"
if [ ${FAILURES} -eq 0 ]; then
    echo "✅ All services healthy"
    exit 0
else
    echo "❌ ${FAILURES} service(s) unhealthy"
    exit 1
fi
