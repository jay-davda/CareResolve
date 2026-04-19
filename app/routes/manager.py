from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.services.auth_service import requires_role
from app.models.user import User
from app.models.complaint import Complaint

router = APIRouter(prefix="/manager", tags=["Operations Manager"])

# SLA thresholds in hours for each priority level
SLA_TARGETS = {"High": 4, "Medium": 24, "Low": 72}


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(requires_role("manager"))
):
    """
    Returns real-time metrics computed directly from the complaints table.
    No static values — everything is derived from actual database records.
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Total complaints in the system
    total_all = db.query(func.count(Complaint.id)).scalar() or 0

    # Today's volume
    total_today = db.query(func.count(Complaint.id)).filter(
        Complaint.created_at >= today_start
    ).scalar() or 0

    # Resolved today
    resolved_today = db.query(func.count(Complaint.id)).filter(
        Complaint.status == "Resolved",
        Complaint.resolved_at >= today_start
    ).scalar() or 0

    # Awaiting review (Pending + In Progress)
    pending_review = db.query(func.count(Complaint.id)).filter(
        Complaint.status.in_(["Pending", "In Progress", "Reviewed"])
    ).scalar() or 0

    # Average resolution time in hours (only for resolved complaints)
    resolved = db.query(Complaint).filter(
        Complaint.status == "Resolved",
        Complaint.resolved_at.isnot(None),
        Complaint.created_at.isnot(None)
    ).all()

    if resolved:
        total_hours = sum(
            (c.resolved_at - c.created_at).total_seconds() / 3600
            for c in resolved
        )
        avg_resolution = round(total_hours / len(resolved), 1)
    else:
        avg_resolution = 0

    # Category distribution (all time)
    cat_query = db.query(
        Complaint.category, func.count(Complaint.id)
    ).group_by(Complaint.category).all()
    distribution = {cat: count for cat, count in cat_query}

    # Priority breakdown
    pri_query = db.query(
        Complaint.priority, func.count(Complaint.id)
    ).group_by(Complaint.priority).all()
    priority_breakdown = {pri or "Unassigned": count for pri, count in pri_query}

    return {
        "total_all": total_all,
        "total_complaints_today": total_today,
        "resolved_today": resolved_today,
        "pending_review": pending_review,
        "avg_resolution_time_hours": avg_resolution,
        "distribution": distribution,
        "priority_breakdown": priority_breakdown,
    }


@router.get("/sla")
def get_sla_compliance(
    db: Session = Depends(get_db),
    current_user: User = Depends(requires_role("manager"))
):
    """
    Calculates SLA compliance by comparing actual resolution time
    against the target hours for each priority level.
    """
    resolved = db.query(Complaint).filter(
        Complaint.status == "Resolved",
        Complaint.resolved_at.isnot(None),
        Complaint.created_at.isnot(None),
        Complaint.priority.isnot(None)
    ).all()

    total = len(resolved)
    within_sla = 0
    breaches = 0

    for c in resolved:
        hours = (c.resolved_at - c.created_at).total_seconds() / 3600
        target = SLA_TARGETS.get(c.priority, 72)  # default to Low target
        if hours <= target:
            within_sla += 1
        else:
            breaches += 1

    compliance_rate = round((within_sla / total) * 100, 1) if total > 0 else 0

    # Critical: unresolved complaints older than their SLA target
    now = datetime.now(timezone.utc)
    unresolved = db.query(Complaint).filter(
        Complaint.status.in_(["Pending", "In Progress"]),
        Complaint.priority.isnot(None),
        Complaint.created_at.isnot(None)
    ).all()

    critical_unresolved = 0
    for c in unresolved:
        age_hours = (now - c.created_at).total_seconds() / 3600
        target = SLA_TARGETS.get(c.priority, 72)
        if age_hours > target:
            critical_unresolved += 1

    return {
        "sla_compliance_rate": f"{compliance_rate}%",
        "total_resolved": total,
        "within_sla": within_sla,
        "breached_slas": breaches,
        "critical_unresolved": critical_unresolved,
        "sla_targets": SLA_TARGETS,
    }
