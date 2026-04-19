from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ComplaintCreate(BaseModel):
    """Schema for creating a new complaint."""

    title: str
    description: Optional[str] = None
    category: str  # should be one of ComplaintCategory.ALL
    priority: Optional[str] = None
    confidence: Optional[float] = None
    ai_recommended_action: Optional[str] = None


class QACorrectionRequest(BaseModel):
    """Schema for QA team submitting a corrected category label."""

    corrected_category: str


class ComplaintStatusUpdate(BaseModel):
    """Schema for updating the lifecycle status of a complaint."""

    status: str


class ExecutiveActionUpdate(BaseModel):
    """Schema for an executive resolving a complaint with their action."""

    executive_action: str
    resolution_source: Optional[str] = "Manual" # "AI" or "Manual"


class ComplaintResponse(BaseModel):
    """Schema for returning a complaint to the client."""

    id: int
    title: str
    description: Optional[str] = None
    category: str
    priority: Optional[str] = None
    confidence: Optional[float] = None
    is_uncertain: bool
    ai_recommended_action: Optional[str] = None
    executive_action: Optional[str] = None
    resolution_source: Optional[str] = None
    explanation: Optional[str] = None
    alternatives: Optional[list] = None
    supporting_keywords: Optional[list] = None
    mismatched_keywords: Optional[list] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # allows reading data from ORM models


class ComplaintFieldUpdate(BaseModel):
    """Schema for manager updating category and/or priority."""

    category: Optional[str] = None
    priority: Optional[str] = None
