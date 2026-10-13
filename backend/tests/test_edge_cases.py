from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import seed
from app.database import Base, get_db
from app.main import app
from app.models import Discussion, Lead, LeadStatus


def make_lead(client, **kw):
    r = client.post("/leads", json={"name": "Ada", **kw})
    assert r.status_code == 201, r.text
    return r.json()


# --- error shape -----------------------------------------------------------------


def test_404_has_a_readable_detail(client):
    r = client.get("/leads/999")
    assert r.status_code == 404
    assert r.json() == {"detail": "Lead 999 not found"}


def test_422_reports_the_offending_field(client):
    r = client.post("/leads", json={"name": ""})
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert isinstance(detail, list)
    assert detail[0]["loc"][-1] == "name"


# --- validation limits -----------------------------------------------------------


def test_name_and_note_length_limits(client):
    assert client.post("/leads", json={"name": "x" * 121}).status_code == 422
    assert client.post("/leads", json={"name": "x" * 120}).status_code == 201
    lead = make_lead(client)
    url = f"/leads/{lead['id']}/discussions"
    assert client.post(url, json={"note": "n" * 5001}).status_code == 422
    assert client.post(url, json={"note": "n" * 5000}).status_code == 201


def test_invalid_followup_value_rejected(client):
    lead = make_lead(client)
    r = client.post(f"/leads/{lead['id']}/discussions", json={"note": "x", "follow_up_at": "tomorrow"})
    assert r.status_code == 422


def test_naive_datetime_is_treated_as_utc(client):
    lead = make_lead(client)
    r = client.post(
        f"/leads/{lead['id']}/discussions",
        json={"note": "x", "follow_up_at": "2030-01-02T10:00:00"},
    )
    assert r.json()["lead"]["follow_up_at"] == "2030-01-02T10:00:00Z"


def test_timestamps_are_always_serialized_as_utc(client):
    lead = make_lead(client)
    assert lead["created_at"].endswith("Z")


# --- PATCH semantics -------------------------------------------------------------


def test_empty_patch_is_a_noop(client):
    lead = make_lead(client, company="Acme")
    r = client.patch(f"/leads/{lead['id']}", json={})
    assert r.status_code == 200
    assert r.json()["company"] == "Acme"
    assert r.json()["status"] == "New"


@pytest.mark.parametrize("body", [{"name": None}, {"status": None}, {"name": "   "}])
def test_patch_cannot_blank_required_fields(client, body):
    lead = make_lead(client)
    assert client.patch(f"/leads/{lead['id']}", json=body).status_code == 422


def test_patch_updates_details(client):
    lead = make_lead(client)
    r = client.patch(
        f"/leads/{lead['id']}", json={"name": "Grace", "company": "Navy", "phone": "555"}
    )
    assert (r.json()["name"], r.json()["company"], r.json()["phone"]) == ("Grace", "Navy", "555")


# --- listing, search and ordering ------------------------------------------------


def test_search_treats_wildcards_literally(client):
    make_lead(client, name="100% Real")
    make_lead(client, name="Other Person")
    assert [l["name"] for l in client.get("/leads", params={"q": "%"}).json()] == ["100% Real"]
    assert client.get("/leads", params={"q": "_"}).json() == []


def test_status_and_search_combine(client):
    a = make_lead(client, name="Alice North")
    b = make_lead(client, name="Alice South")
    make_lead(client, name="Bob North")
    client.patch(f"/leads/{a['id']}", json={"status": "Won"})
    client.patch(f"/leads/{b['id']}", json={"status": "Lost"})
    r = client.get("/leads", params={"status": "Won", "q": "alice"}).json()
    assert [l["name"] for l in r] == ["Alice North"]


def test_most_recently_discussed_lead_comes_first(client):
    old = make_lead(client, name="Old")
    new = make_lead(client, name="New")
    quiet = make_lead(client, name="Quiet")
    client.post(f"/leads/{old['id']}/discussions", json={"note": "first"})
    client.post(f"/leads/{new['id']}/discussions", json={"note": "second"})
    names = [l["name"] for l in client.get("/leads").json()]
    assert names.index("New") < names.index("Old")
    assert "Quiet" in names and quiet["last_note"] is None


def test_last_note_is_the_latest_discussion(client):
    lead = make_lead(client)
    for note in ("one", "two", "three"):
        client.post(f"/leads/{lead['id']}/discussions", json={"note": note})
    assert client.get(f"/leads/{lead['id']}").json()["last_note"] == "three"
    assert client.get("/leads").json()[0]["last_note"] == "three"


def test_discussions_are_isolated_per_lead(client):
    a, b = make_lead(client, name="A"), make_lead(client, name="B")
    client.post(f"/leads/{a['id']}/discussions", json={"note": "only for A"})
    assert client.get(f"/leads/{b['id']}/discussions").json() == []


def test_identical_timestamps_fall_back_to_insertion_order(client):
    lead = make_lead(client)
    same = datetime(2026, 10, 1, 12, 0, 0)
    db = next(app.dependency_overrides[get_db]())
    try:
        for note in ("first", "second", "third"):
            db.add(Discussion(lead_id=lead["id"], note=note, created_at=same))
        db.commit()
    finally:
        db.close()
    notes = [d["note"] for d in client.get(f"/leads/{lead['id']}/discussions").json()]
    assert notes == ["third", "second", "first"]
    assert client.get(f"/leads/{lead['id']}").json()["last_note"] == "third"


# --- platform --------------------------------------------------------------------


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_cors_allows_the_frontend_origin_only(client):
    ok = client.options(
        "/leads",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options(
        "/leads",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers


# --- seed script -----------------------------------------------------------------


def test_seed_is_idempotent_and_covers_every_status(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(seed, "engine", engine)
    monkeypatch.setattr(seed, "SessionLocal", Session)

    seed.run()
    seed.run()  # second run must not duplicate anything

    with Session() as db:
        leads = db.query(Lead).all()
        assert len(leads) == len(seed.SEED) >= 5
        assert {l.status for l in leads} == set(LeadStatus)
        assert sum(1 for l in leads if l.discussions) >= 5
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        followups = [l.follow_up_at for l in leads if l.follow_up_at]
        assert any(f < now for f in followups), "seed should include an overdue follow-up"
        assert any(f > now + timedelta(hours=12) for f in followups), "and an upcoming one"
