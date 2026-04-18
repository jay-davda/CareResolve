from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    """Simple health check to verify the API is running."""
    return {"status": "healthy", "message": "CareResolve AI is up and running"}
