from datetime import datetime, timedelta
from urllib.parse import urlencode
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User, EmailOtpCode
from app.schemas.auth import UserRead, Token
from app.services.auth_adapter import get_current_user, LocalJwtAuthAdapter
from app.services.mailer_client import HD2MailClient, hash_otp

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


class OtpRequestPayload(BaseModel):
    email: EmailStr


class OtpVerifyPayload(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern="^[0-9]{6}$")
    name: str | None = Field(default=None, max_length=80)


@router.get("/otp/status")
def otp_mail_status():
    st = HD2MailClient().status()
    return {
        "mail_ready": bool(st.get("ready")),
        "state": st.get("state", "UNKNOWN"),
        "provider": st.get("provider", "hd2lab-mail"),
    }


@router.post("/otp/request")
def request_email_otp(payload: OtpRequestPayload, db: Session = Depends(get_db)):
    """Generates a 6-digit email OTP and dispatches it via Server-HQ hd2lab-mail."""
    email = payload.email.strip().lower()
    code = f"{secrets.randbelow(900000) + 100000}"

    # Invalidate previous unconsumed OTPs for this email
    db.query(EmailOtpCode).filter(
        EmailOtpCode.email == email,
        EmailOtpCode.consumed == False,
    ).update({"consumed": True})

    otp_row = EmailOtpCode(
        email=email,
        code_hash=hash_otp(email, code),
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        attempts=0,
        consumed=False,
    )
    db.add(otp_row)
    db.commit()

    subject = "[HD²LAB BabyCare] 로그인 인증 코드 (6자리)"
    body_text = (
        f"HD²LAB BabyCare 로그인 인증 코드입니다.\n\n"
        f"인증 코드: {code}\n"
        f"유효 시간: 10분\n\n"
        "본인이 요청하지 않았다면 이 메일을 무시해 주세요."
    )
    body_html = (
        f"<p>HD²LAB BabyCare 가족 공유 로그인을 위한 인증 코드입니다.</p>"
        f"<p style='font-size:24px;font-weight:bold;letter-spacing:4px;color:#8B6CE8;'>{code}</p>"
        f"<p>10분 이내에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>"
    )

    ok, detail = HD2MailClient().send_message(email, subject, body_text, body_html)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"메일 발송 서버 연결 확인이 필요합니다 ({detail}). /admin/mail/ 에서 발신 계정 연결 상태를 확인해 주세요.",
        )

    return {
        "status": "sent",
        "email": email,
        "message": "6자리 인증 코드를 이메일로 발송했습니다. (10분 유효)",
    }


@router.post("/otp/verify", response_model=Token)
def verify_email_otp(payload: OtpVerifyPayload, response: Response, db: Session = Depends(get_db)):
    """Verifies the 6-digit email OTP and issues an authenticated Crew JWT session."""
    email = payload.email.strip().lower()
    now = datetime.utcnow()

    otp_row = (
        db.query(EmailOtpCode)
        .filter(
            EmailOtpCode.email == email,
            EmailOtpCode.consumed == False,
            EmailOtpCode.expires_at > now,
        )
        .order_by(EmailOtpCode.created_at.desc())
        .first()
    )

    if not otp_row:
        raise HTTPException(status_code=400, detail="유효한 인증 코드가 없거나 만료되었습니다. 다시 요청해 주세요.")

    if otp_row.attempts >= 5:
        otp_row.consumed = True
        db.commit()
        raise HTTPException(status_code=429, detail="인증 시도 횟수를 초과했습니다. 새 인증 코드를 발급받아 주세요.")

    if not secrets.compare_digest(otp_row.code_hash, hash_otp(email, payload.code)):
        otp_row.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")

    otp_row.consumed = True
    db.commit()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            name=(payload.name or email.split("@")[0]).strip(),
            role="user",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    jwt_token = LocalJwtAuthAdapter.create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role,
    })

    response.set_cookie(
        key="babycare_access_token",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7,
    )

    return Token(access_token=jwt_token, token_type="bearer", user=UserRead.model_validate(user))
