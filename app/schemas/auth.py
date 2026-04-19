from pydantic import BaseModel, EmailStr
from app.models.user import RoleEnum


class UserCreate(BaseModel):
    """Request body for registering a new user."""
    username: str
    email: str
    password: str
    role: RoleEnum = RoleEnum.support


class UserResponse(BaseModel):
    """Public-safe user object returned from the API."""
    id: int
    username: str
    email: str
    role: RoleEnum
    is_active: bool

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """Request body for logging in."""
    username: str
    password: str


class Token(BaseModel):
    """JWT token response returned after successful login."""
    access_token: str
    token_type: str = "bearer"
    role: str


class TokenData(BaseModel):
    """Parsed payload extracted from a JWT."""
    username: str | None = None
    role: str | None = None
