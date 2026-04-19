import os
import csv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
from app.schemas.complaint import ComplaintCreate, ComplaintResponse, ComplaintStatusUpdate, ExecutiveActionUpdate, ComplaintFieldUpdate
from app.services.complaint import create_complaint, get_all_complaints, update_complaint_status, delete_complaint, delete_all_complaints
from app.services.auth_service import requires_role
from app.models.user import User
from app.models.complaint import Complaint

router = APIRouter(prefix="/complaints", tags=["Complaints"])

@router.get("/", response_model=list[ComplaintResponse])
def list_complaints(db: Session = Depends(get_db), current_user: User = Depends(requires_role("support", "qa", "manager"))):
    """Return all complaints. Protected: Support, QA, and Manager."""
    return get_all_complaints(db)


@router.post("/", response_model=ComplaintResponse, status_code=201)
def add_complaint(payload: ComplaintCreate, db: Session = Depends(get_db), current_user: User = Depends(requires_role("support"))):
    """Create a new complaint. Protected: Customer Support Executive only."""
    return create_complaint(db, payload)


@router.patch("/{complaint_id}/status", response_model=ComplaintResponse)
def update_status(complaint_id: int, payload: ComplaintStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(requires_role("support"))):
    """Update lifecycle status. Protected: Customer Support Executive only."""
    return update_complaint_status(db, complaint_id, payload)


@router.patch("/{complaint_id}/resolve", response_model=ComplaintResponse)
def resolve_complaint(complaint_id: int, payload: ExecutiveActionUpdate, db: Session = Depends(get_db), current_user: User = Depends(requires_role("support"))):
    """
    Resolve a complaint by recording the executive's actual action taken.
    If the executive resolved it manually, the pattern is stored for future RAG retrieval.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.executive_action = payload.executive_action
    complaint.resolution_source = payload.resolution_source
    complaint.status = "Resolved"
    complaint.resolved_at = datetime.now(timezone.utc)
    
    # --- Continuous Learning ---
    # If the human solved it manually, append this resolution to our solution bank!
    if payload.resolution_source == "Manual":
        try:
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            sb_path = os.path.join(BASE_DIR, "data", "solution_bank.csv")
            
            # Use the original description for best semantic retrieval later
            with open(sb_path, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([complaint.description, payload.executive_action])
            
            print(f"✅ Learned new resolution pattern from Complaint #{complaint_id}")
            
            # Clear RAG cache so next request reloads the new pattern
            from app.services import ml_service
            ml_service._solution_bank = None 
        except Exception as e:
            print(f"Error learning from resolution: {e}")

    db.commit()
    db.refresh(complaint)
    return complaint


@router.patch("/{complaint_id}/update-fields")
def update_fields(
    complaint_id: int,
    payload: ComplaintFieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(requires_role("manager"))
):
    """Update category and/or priority. Protected: Operations Manager only."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if payload.category is not None:
        complaint.category = payload.category
    if payload.priority is not None:
        complaint.priority = payload.priority
    db.commit()
    db.refresh(complaint)
    return complaint


@router.delete("/", dependencies=[Depends(requires_role("support", "manager"))])
def bulk_delete(db: Session = Depends(get_db)):
    """Delete all complaints. Protected: Support and Manager."""
    return delete_all_complaints(db)


@router.delete("/{complaint_id}", dependencies=[Depends(requires_role("support", "manager"))])
def single_delete(complaint_id: int, db: Session = Depends(get_db)):
    """Delete a single complaint by ID. Protected: Support and Manager."""
    return delete_complaint(db, complaint_id)

