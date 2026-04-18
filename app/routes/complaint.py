from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.complaint import ComplaintCreate, ComplaintResponse
from app.services.complaint import create_complaint, get_all_complaints

router = APIRouter(prefix="/complaints", tags=["Complaints"])
from app.services.dataset_service import get_sample_records

@router.get("/test-dataset")
def test_dataset():
    return get_sample_records()

@router.get("/", response_model=list[ComplaintResponse])
def list_complaints(db: Session = Depends(get_db)):
    """Return all complaints."""
    return get_all_complaints(db)


@router.post("/", response_model=ComplaintResponse, status_code=201)
def add_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)):
    """Create a new complaint."""
    return create_complaint(db, payload)
