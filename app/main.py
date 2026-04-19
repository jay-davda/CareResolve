from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.database import engine, Base
from app.routes import health, complaint
from app.routes.auth import router as auth_router
from app.routes.qa import router as qa_router
from app.routes.manager import router as manager_router
from app.services import ml_service
from app.services.auth_service import requires_role

# Auto-create all tables (including 'users') on startup if they don't exist.
# This replaces manual migration for development.
import app.models.user  # noqa: F401
Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup phase ---
    # Load ML models into memory
    ml_service.train_models()
    print("✅ Models loaded successfully on startup.")
    
    yield
    
    # --- Shutdown phase ---
    pass

# Create the FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    description="Backend API for managing wellness product complaints with RBAC",
    lifespan=lifespan
)

# Add CORS middleware so the React frontend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (e.g., your Vite React app)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health.router)
app.include_router(complaint.router)
app.include_router(auth_router)
app.include_router(qa_router)
app.include_router(manager_router)


# ── Request Models ────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    text: str

class LearnRequest(BaseModel):
    text: str
    category: Optional[str] = None
    priority: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/predict", dependencies=[Depends(requires_role("support"))])
def predict_complaint(payload: PredictRequest):
    """
    Takes a complaint text and uses the ML service to predict category, priority,
    and recommended solutions.
    Protected: Customer Support Executive only.
    """
    return ml_service.predict(payload.text)


@app.post("/learn", dependencies=[Depends(requires_role("support"))])
def learn_complaint(payload: LearnRequest):
    """
    Stores a new complaint for future ML training.
    Protected: Customer Support Executive only.
    """
    return ml_service.learn(payload.text, payload.category, payload.priority)


@app.post("/retrain", dependencies=[Depends(requires_role("manager"))])
def retrain_models():
    """
    Retrains the ML models using the original dataset + new learned data.
    Protected: Operations Manager only.
    """
    return ml_service.retrain_models()


# ── Bulk Processing ───────────────────────────────────────────────────────────

from fastapi import UploadFile, File
import time
from app.database import get_db
from sqlalchemy.orm import Session
from app.services.complaint import create_complaint
from app.schemas.complaint import ComplaintCreate

MAX_LINES = 1000

@app.post("/bulk-predict", dependencies=[Depends(requires_role("support"))])
async def bulk_predict(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accepts a .txt file upload where each line is a complaint.
    Runs AI prediction on every line, saves them to the database, and returns results.
    Protected: Customer Support Executive only.
    """
    # Read and decode the uploaded file
    content = await file.read()
    
    if file.filename.endswith(".eml"):
        import email
        from email import policy
        msg = email.message_from_bytes(content, policy=policy.default)
        body = msg.get_body(preferencelist=('plain'))
        if body:
            text = body.get_content()
        else:
            payload = msg.get_payload(decode=True)
            text = payload.decode('utf-8', errors='replace') if payload else ""
            
        # Treat the entire email body as a single complaint, cleaning up extra whitespace
        clean_text = " ".join(text.split())
        lines = [clean_text] if clean_text else []
    else:
        text = content.decode("utf-8")
        # Split into lines and filter out empty ones
        lines = [line.strip() for line in text.split("\n") if line.strip()]

    # Handle empty file
    if not lines:
        return {
            "message": "The uploaded file is empty or contains no valid lines.",
            "results": [],
            "count": 0
        }

    # Enforce max line limit for safety
    if len(lines) > MAX_LINES:
        lines = lines[:MAX_LINES]

    # Process each complaint through the AI engine
    start_time = time.time()
    results = []
    
    from app.services.ml_service import extract_main_complaint
    
    for line in lines:
        clean_line = extract_main_complaint(line)
        if not clean_line:
            continue
            
        prediction = ml_service.predict(clean_line)
        
        # PERSIST to database so low-confidence ones go to QA
        create_complaint(db, ComplaintCreate(
            title=clean_line[:50] + ("..." if len(clean_line) > 50 else ""),
            description=clean_line,
            category=prediction.get("category", "Unknown"),
            priority=prediction.get("priority", "Unknown"),
            confidence=prediction.get("confidence"),
            ai_recommended_action=" | ".join(prediction.get("recommended_solutions", []))
        ))

        results.append({
            "text": clean_line,
            "category": prediction.get("category", "Unknown"),
            "priority": prediction.get("priority", "Unknown"),
            "recommended_solutions": prediction.get("recommended_solutions", []),
            "confidence": prediction.get("confidence")
        })
    processing_time = round(time.time() - start_time, 3)

    return {
        "message": f"Successfully processed and saved {len(results)} complaints.",
        "count": len(results),
        "processing_time_seconds": processing_time,
        "results": results
    }

