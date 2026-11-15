import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_FILE = "./test_babycare.db"
if os.path.exists(TEST_DB_FILE):
    os.remove(TEST_DB_FILE)

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"
os.environ["AUTH_MODE"] = "hybrid"
os.environ["AI_PROVIDER"] = "mock"

from app.core.database import Base, get_db
from app.main import app
from app.models.entities import User
from app.services.auth_adapter import LocalJwtAuthAdapter
from app.services.knowledge_service import seed_knowledge_base
from app.services.calendar_service import seed_health_rules

engine = create_engine(
    f"sqlite:///{TEST_DB_FILE}",
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_knowledge_base(db)
    seed_health_rules(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def owner_user(db_session):
    existing = db_session.query(User).filter(User.email == "parent1@hd2lab.org").first()
    if existing:
        return existing
    user = User(
        email="parent1@hd2lab.org",
        name="테스트 부모 1",
        role="user",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def owner_token(owner_user):
    return LocalJwtAuthAdapter.create_access_token({
        "sub": owner_user.id,
        "email": owner_user.email,
        "role": owner_user.role
    })

@pytest.fixture
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}

@pytest.fixture
def stranger_user(db_session):
    existing = db_session.query(User).filter(User.email == "stranger@hd2lab.org").first()
    if existing:
        return existing
    user = User(
        email="stranger@hd2lab.org",
        name="다른 사용자",
        role="user",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def stranger_headers(stranger_user):
    token = LocalJwtAuthAdapter.create_access_token({
        "sub": stranger_user.id,
        "email": stranger_user.email,
        "role": stranger_user.role
    })
    return {"Authorization": f"Bearer {token}"}
