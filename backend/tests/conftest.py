import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.security import hash_password

TEST_EMAIL = "tester@leadflow.test"
TEST_PASSWORD = "correct-horse-battery"


@pytest.fixture()
def anon_client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with Session() as db:
        db.add(User(email=TEST_EMAIL, password_hash=hash_password(TEST_PASSWORD)))
        db.commit()

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client(anon_client):
    """Same app, already signed in. Use anon_client to test unauthenticated behaviour."""
    res = anon_client.post("/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert res.status_code == 200
    anon_client.headers["Authorization"] = f"Bearer {res.json()['access_token']}"
    return anon_client
