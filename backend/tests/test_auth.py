from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.security import hash_password, verify_password

from conftest import TEST_EMAIL, TEST_PASSWORD


def _login(c, email=TEST_EMAIL, password=TEST_PASSWORD):
    return c.post("/auth/login", json={"email": email, "password": password})


def test_login_returns_token_and_user(anon_client):
    res = _login(anon_client)
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == TEST_EMAIL
    assert "password" not in str(body)


def test_login_email_is_case_and_space_insensitive(anon_client):
    assert _login(anon_client, email=f"  {TEST_EMAIL.upper()} ").status_code == 200


@pytest.mark.parametrize(
    "email,password",
    [(TEST_EMAIL, "wrong"), ("nobody@leadflow.test", TEST_PASSWORD), (TEST_EMAIL, "")],
)
def test_bad_credentials_give_the_same_401(anon_client, email, password):
    res = _login(anon_client, email, password)
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect email or password"


def test_me_requires_a_token(anon_client):
    assert anon_client.get("/auth/me").status_code == 401


def test_me_returns_current_user(client):
    assert client.get("/auth/me").json()["email"] == TEST_EMAIL


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/leads"),
        ("post", "/leads"),
        ("get", "/leads/1"),
        ("patch", "/leads/1"),
        ("delete", "/leads/1"),
        ("get", "/leads/1/discussions"),
        ("post", "/leads/1/discussions"),
    ],
)
def test_lead_routes_reject_anonymous_requests(anon_client, method, path):
    res = getattr(anon_client, method)(path)
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_health_stays_public(anon_client):
    assert anon_client.get("/health").status_code == 200


def test_garbage_token_is_rejected(anon_client):
    res = anon_client.get("/leads", headers={"Authorization": "Bearer not.a.jwt"})
    assert res.status_code == 401


def test_expired_token_is_rejected(anon_client):
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.secret_key,
        algorithm="HS256",
    )
    res = anon_client.get("/leads", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401


def test_token_signed_with_another_key_is_rejected(anon_client):
    forged = jwt.encode({"sub": "1"}, "some-other-secret-key-of-32-bytes!!", algorithm="HS256")
    res = anon_client.get("/leads", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_token_for_deleted_user_is_rejected(anon_client):
    token = jwt.encode({"sub": "9999"}, settings.secret_key, algorithm="HS256")
    res = anon_client.get("/leads", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_password_hash_is_salted_and_verifiable():
    a, b = hash_password("secret"), hash_password("secret")
    assert a != b
    assert verify_password("secret", a)
    assert not verify_password("Secret", a)
    assert not verify_password("secret", "garbage")
