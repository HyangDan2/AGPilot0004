from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.models.entities import User
from app.schemas.auth import UserRead, Token
from app.services.auth_adapter import get_current_user, LocalJwtAuthAdapter

router = APIRouter(prefix="/auth", tags=["Authentication"])

class DevLoginRequest(BaseModel):
    email: EmailStr
    name: str = "행복한 부모"
    role: str = "user"

@router.post("/dev-login", response_model=Token)
def dev_login(req: DevLoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Local / Dev login endpoint for rapid testing across multi-user environments.
    Creates or retrieves user and returns JWT token.
    """
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        user = User(
            email=req.email,
            name=req.name,
            role=req.role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = LocalJwtAuthAdapter.create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role
    })

    # Set cookie for browser sessions
    response.set_cookie(
        key="babycare_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7
    )

    return Token(access_token=token, token_type="bearer", user=UserRead.model_validate(user))

@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    return UserRead.model_validate(current_user)

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("babycare_access_token")
    return {"message": "로그아웃되었습니다."}
