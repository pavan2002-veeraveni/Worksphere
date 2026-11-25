"""WorkSphere memory-efficient streaming processing package."""

from worksphere_processing.metrics_calculator import ProductivityCalculator
from worksphere_processing.models import (
    ActivityRecord,
    OverdueItem,
    ProductivityMetrics,
    TaskRecord,
    TeamMemberMetrics,
)
from worksphere_processing.overdue_detector import OverdueDetector
from worksphere_processing.report_generator import ReportGenerator
from worksphere_processing.stream_processor import StreamProcessor
from worksphere_processing.validators import ValidationError, validate_date_range, validate_task_record

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "ActivityRecord",
    "OverdueDetector",
    "OverdueItem",
    "ProductivityCalculator",
    "ProductivityMetrics",
    "ReportGenerator",
    "StreamProcessor",
    "TaskRecord",
    "TeamMemberMetrics",
    "ValidationError",
    "validate_date_range",
    "validate_task_record",
]
