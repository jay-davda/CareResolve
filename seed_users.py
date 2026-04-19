from app.database import SessionLocal, engine, Base
from app.models.user import User, RoleEnum
from app.services.auth_service import get_password_hash

def seed_users():
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    demo_users = [
        {"username": "support_user", "email": "support@demo.com", "role": RoleEnum.support},
        {"username": "qa_user", "email": "qa@demo.com", "role": RoleEnum.qa},
        {"username": "manager_user", "email": "manager@demo.com", "role": RoleEnum.manager},
    ]
    
    for u in demo_users:
        existing_user = db.query(User).filter(User.username == u["username"]).first()
        if not existing_user:
            new_user = User(
                username=u["username"],
                email=u["email"],
                hashed_password=get_password_hash("pass123"),
                role=u["role"]
            )
            db.add(new_user)
            print(f"Created user: {u['username']}")
        else:
            print(f"User {u['username']} already exists.")
            
    db.commit()
    db.close()
    print("Database seeding completed.")

if __name__ == "__main__":
    seed_users()
