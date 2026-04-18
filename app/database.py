from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Create the SQLAlchemy engine using the DB URL from config
engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)

# Session factory — each request gets its own session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all ORM models
Base = declarative_base()


def get_db():
    """Dependency that provides a DB session and cleans up after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
