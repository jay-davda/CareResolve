

from sqlalchemy.orm import Session
from app.models.complaint import Complaint
from app.schemas.complaint import ComplaintCreate, ComplaintStatusUpdate
from fastapi import HTTPException


def get_all_complaints(db: Session) -> list[Complaint]:
    """Fetch every complaint from the database."""
    return db.query(Complaint).all()


def create_complaint(db: Session, data: ComplaintCreate) -> Complaint:
    """Insert a new complaint and return it."""
    complaint = Complaint(
        title=data.title,
        description=data.description,
        category=data.category,
        priority=data.priority,
        confidence=data.confidence,
        is_uncertain=(data.confidence is not None and data.confidence < 0.75),
        ai_recommended_action=data.ai_recommended_action
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)  # reload to get generated id & timestamps
    return complaint


def update_complaint_status(db: Session, complaint_id: int, status_update: ComplaintStatusUpdate) -> Complaint:
    """Update the lifecycle status of a complaint."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.status = status_update.status
    db.commit()
    db.refresh(complaint)
    return complaint

def delete_complaint(db: Session, complaint_id: int):
    """Delete a single complaint by its ID."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    db.delete(complaint)
    db.commit()
    return {"message": "Complaint deleted successfully"}

def delete_all_complaints(db: Session):
    """Delete every complaint from the table."""
    db.query(Complaint).delete()
    db.commit()
    return {"message": "All complaints deleted successfully"}
