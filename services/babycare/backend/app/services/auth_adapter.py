from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime, timedelta
import jwt
from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User

class BaseAuthAdapter(ABC):
    @abstractmethod
    def authenticate_request(self, request: Request, db: Session) -> Optional[User]:
        pass

class HD2LabProxyAuthAdapter(BaseAuthAdapter):
    """
    Integrates with HD2Lab reverse proxy headers when deployed behind Nginx / DuckDNS portal.
    Headers:
      - X-User-Id
      - X-User-Email
      - X-User-Name (optional)
      - X-User-Role (optional)
    """
    def authenticate_request(self, request: Request, db: Session) -> Optional[User]:
        user_id = request.headers.get(settings.HD2LAB_HEADER_USER_ID)
        user_email = request.headers.get(settings.HD2LAB_HEADER_USER_EMAIL)
        
        if not user_email:
            return None
            
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            user = User(
                id=user_id or None,
                email=user_email,
                name=request.headers.get("X-User-Name", user_email.split("@")[0]),
                role="admin" if "admin" in user_email else "user",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

class LocalJwtAuthAdapter(BaseAuthAdapter):
    """
    Standard JWT-based authentication for local development, API testing, and standalone mode.
    """
    ALGORITHM = "HS256"

    @classmethod
    def create_access_token(cls, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=cls.ALGORITHM)
        return encoded_jwt

    def authenticate_request(self, request: Request, db: Session) -> Optional[User]:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            # Check cookie if any
            token = request.cookies.get("babycare_access_token")
            if not token:
                return None
        else:
            token = auth_header.split(" ")[1]

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[self.ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                return None
        except jwt.PyJWTError:
            return None

        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        return user

class HybridAuthAdapter(BaseAuthAdapter):
    """
    Tries HD2Lab Proxy headers first; if not present, falls back to JWT token.
    If in local dev and no credentials, can authenticate or mock default test user if explicitly configured.
    """
    def __init__(self):
        self.proxy_adapter = HD2LabProxyAuthAdapter()
        self.jwt_adapter = LocalJwtAuthAdapter()

    def authenticate_request(self, request: Request, db: Session) -> Optional[User]:
        # 1. Try proxy header
        user = self.proxy_adapter.authenticate_request(request, db)
        if user:
            return user
            
        # 2. Try JWT Bearer token
        user = self.jwt_adapter.authenticate_request(request, db)
        if user:
            return user
            
        return None

# Singleton adapter instance
auth_adapter = HybridAuthAdapter()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = auth_adapter.authenticate_request(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    return auth_adapter.authenticate_request(request, db)

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    return current_user
