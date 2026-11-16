from urllib.parse import urlencode
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.config import settings
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
    response.delete_cookie("babycare_access_token", path="/")
    return {"message": "로그아웃되었습니다."}


@router.get("/google/status")
def google_oauth_status():
    configured = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
    return {
        "configured": configured,
        "login_url": f"{settings.API_V1_STR}/auth/google/login",
    }


@router.get("/google/login")
def google_login():
    """Redirects Crew users to Google OAuth 2.0 consent screen."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)가 서버에 아직 설정되지 않았습니다.",
        )

    state = LocalJwtAuthAdapter.create_access_token({"nonce": secrets.token_urlsafe(12), "type": "oauth_state"})
    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}", status_code=302)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: Session = Depends(get_db),
):
    """Handles Google OAuth callback, creates/updates Crew user, and sets session cookie."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth가 설정되지 않았습니다.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Google 인증 토큰 교환에 실패했습니다.")
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Google access_token이 누락되었습니다.")

        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Google 사용자 프로필 조회에 실패했습니다.")
        profile = user_resp.json()

    email = profile.get("email")
    name = profile.get("name") or (email.split("@")[0] if email else "가족 사용자")
    sub = profile.get("sub")
    if not email:
        raise HTTPException(status_code=400, detail="Google 계정의 이메일 정보를 확인할 수 없습니다.")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            name=name,
            external_id=sub,
            role="user",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if sub and not user.external_id:
            user.external_id = sub
        if name and user.name != name:
            user.name = name
        db.commit()
        db.refresh(user)

    jwt_token = LocalJwtAuthAdapter.create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role,
    })

    redirect = RedirectResponse(url=f"{settings.FRONTEND_BASE_URL}?auth=google", status_code=302)
    redirect.set_cookie(
        key="babycare_access_token",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7,
    )
    return redirect
