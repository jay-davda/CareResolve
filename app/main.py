from fastapi import FastAPI
from app.config import settings
from app.routes import health, complaint

# Create the FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    description="Backend API for managing wellness product complaints",
)

# Register route modules
app.include_router(health.router)
app.include_router(complaint.router)
