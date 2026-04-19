import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum as SAEnum
from app.database import Base


class RoleEnum(str, enum.Enum):
    """
    Defines the three roles in the TS-14 system.
    Using str mixin ensures the value is JSON serializable.
    """
    support = "support"   # Customer Support Executive
    qa = "qa"             # Quality Assurance Team
    manager = "manager"   # Operations Manager


class User(Base):
    """
    Users table — stores credentials and role for each system user.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False, default=RoleEnum.support)
    is_active = Column(Boolean, default=True)
