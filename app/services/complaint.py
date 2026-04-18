

from sqlalchemy.orm import Session
from app.models.complaint import Complaint
from app.schemas.complaint import ComplaintCreate



def get_all_complaints(db: Session) -> list[Complaint]:
    """Fetch every complaint from the database."""
    return db.query(Complaint).all()


def create_complaint(db: Session, data: ComplaintCreate) -> Complaint:
    """Insert a new complaint and return it."""
    complaint = Complaint(
        title=data.title,
        description=data.description,
        category=data.category,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)  # reload to get generated id & timestamps
    return complaint
