from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Complaint(Base):
    """Represents a wellness complaint submitted by a user."""

    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False)  # values from ComplaintCategory
    priority = Column(String(50), nullable=True)     # Added priority column
    confidence = Column(Float, nullable=True)        # AI prediction confidence
    is_uncertain = Column(Boolean, default=False)    # Flagged for QA review if confidence < threshold
    ai_recommended_action = Column(Text, nullable=True)  # AI's recommended solutions at creation
    executive_action = Column(Text, nullable=True)       # Actual action taken by the executive
    resolution_source = Column(String(50), nullable=True) # "AI" or "Manual"
    status = Column(String(50), default="Pending")       # e.g. Pending, In Progress, Resolved
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)  # When status changed to Resolved
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
