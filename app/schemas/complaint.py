from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ComplaintCreate(BaseModel):
    """Schema for creating a new complaint."""

    title: str
    description: Optional[str] = None
    category: str  # should be one of ComplaintCategory.ALL


class ComplaintResponse(BaseModel):
    """Schema for returning a complaint to the client."""

    id: int
    title: str
    description: Optional[str] = None
    category: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # allows reading data from ORM models
