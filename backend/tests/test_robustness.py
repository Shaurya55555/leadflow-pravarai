"""Hostile and awkward input: nothing here may produce a 500 or corrupt data."""
import pytest

from conftest import TEST_EMAIL, TEST_PASSWORD

NASTY_TEXT = [
    "Zoë Ångström",
    "李小龍",
    "مرحبا بالعالم",
    "Rocket 🚀 Co",
    "Robert'); DROP TABLE leads;--",
    "<script>alert(1)</script>",
    "' OR '1'='1",
    "a​b",  # zero-width space inside
    "tab\tinside",
    "100% sure_thing",
]


def _lead(client, **fields):
    res = client.post("/leads", json={"name": "Probe", **fields})
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.parametrize("text", NASTY_TEXT)
def test_awkward_text_round_trips_unchanged(client, text):
    lead = _lead(client, name=text, company=text)
    assert lead["name"] == text.strip()
    client.post(f"/leads/{lead['id']}/discussions", json={"note": text})
    fetched = client.get(f"/leads/{lead['id']}").json()
    assert fetched["name"] == text.strip()
    assert fetched["last_note"] == text.strip()


def test_sql_injection_strings_do_not_damage_anything(client):
    _lead(client, name="Keep Me")
    _lead(client, name="Robert'); DROP TABLE leads;--")
    for q in ["'; DROP TABLE leads;--", "' OR '1'='1", "%", "_", "\\"]:
        assert client.get("/leads", params={"q": q}).status_code == 200
    names = [lead["name"] for lead in client.get("/leads").json()]
    assert "Keep Me" in names and len(names) == 2


@pytest.mark.parametrize("body", [{"name": "   "}, {"name": ""}, {"name": "\n\t"}, {}])
def test_blank_or_missing_name_is_422(client, body):
    assert client.post("/leads", json=body).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"name": 123},
        {"name": ["a"]},
        {"name": "ok", "status": "won"},
        {"name": "ok", "status": "Archived"},
        {"name": "ok", "company": {"x": 1}},
    ],
)
def test_wrong_types_and_values_are_422(client, body):
    assert client.post("/leads", json=body).status_code == 422


@pytest.mark.parametrize("value", ["tomorrow", "2026-13-45T00:00:00Z", ""])
def test_unparseable_follow_up_is_422(client, value):
    lead = _lead(client)
    res = client.post(f"/leads/{lead['id']}/discussions", json={"note": "x", "follow_up_at": value})
    assert res.status_code == 422


def test_malformed_json_body_is_422_not_500(client):
    res = client.post("/leads", content="{not json", headers={"Content-Type": "application/json"})
    assert res.status_code == 422


def test_non_json_content_type_is_422(client):
    res = client.post("/leads", content="name=x", headers={"Content-Type": "text/plain"})
    assert res.status_code == 422


@pytest.mark.parametrize("path", ["/leads/abc", "/leads/1.5", "/leads/-1", "/leads/0"])
def test_bad_ids_are_422_or_404(client, path):
    assert client.get(path).status_code in (404, 422)


def test_absurdly_large_id_is_handled(client):
    huge = "9" * 30
    assert client.get(f"/leads/{huge}").status_code in (404, 422)
    assert client.get(f"/leads/{huge}/discussions").status_code in (404, 422)
    assert client.patch(f"/leads/{huge}", json={"status": "Won"}).status_code in (404, 422)
    assert client.delete(f"/leads/{huge}").status_code in (404, 422)


def test_unknown_lead_for_every_write(client):
    assert client.patch("/leads/999", json={"status": "Won"}).status_code == 404
    assert client.delete("/leads/999").status_code == 404
    assert client.post("/leads/999/discussions", json={"note": "x"}).status_code == 404


def test_deleted_lead_is_gone_everywhere(client):
    lead = _lead(client)
    client.post(f"/leads/{lead['id']}/discussions", json={"note": "hello"})
    assert client.delete(f"/leads/{lead['id']}").status_code == 204
    assert client.get(f"/leads/{lead['id']}").status_code == 404
    assert client.get(f"/leads/{lead['id']}/discussions").status_code == 404
    assert client.delete(f"/leads/{lead['id']}").status_code == 404
    assert client.get("/leads").json() == []


def test_unsupported_method_is_405(client):
    assert client.put("/leads/1", json={}).status_code == 405


def test_invalid_status_filter_is_422(client):
    assert client.get("/leads", params={"status": "bogus"}).status_code == 422


def test_blank_and_very_long_search_are_safe(client):
    _lead(client, name="Alpha")
    assert len(client.get("/leads", params={"q": "   "}).json()) == 1
    assert client.get("/leads", params={"q": "x" * 10_000}).json() == []


def test_duplicate_names_are_allowed_and_independent(client):
    a = _lead(client, name="Sam Lee")
    b = _lead(client, name="Sam Lee")
    assert a["id"] != b["id"]
    client.patch(f"/leads/{a['id']}", json={"status": "Won"})
    assert client.get(f"/leads/{b['id']}").json()["status"] == "New"


def test_follow_up_with_offset_is_stored_as_the_same_instant(client):
    lead = _lead(client)
    res = client.post(
        f"/leads/{lead['id']}/discussions",
        json={"note": "call", "follow_up_at": "2026-10-20T10:00:00+05:30"},
    )
    assert res.status_code == 201
    assert res.json()["lead"]["follow_up_at"] == "2026-10-20T04:30:00Z"


@pytest.mark.parametrize("stamp", ["1970-01-01T00:00:00Z", "2099-12-31T23:59:59Z"])
def test_extreme_follow_up_dates_are_accepted(client, stamp):
    lead = _lead(client)
    res = client.post(
        f"/leads/{lead['id']}/discussions", json={"note": "far", "follow_up_at": stamp}
    )
    assert res.status_code == 201
    assert res.json()["lead"]["follow_up_at"] == stamp


def test_many_notes_keep_a_stable_newest_first_order(client):
    lead = _lead(client)
    for i in range(60):
        assert client.post(f"/leads/{lead['id']}/discussions", json={"note": f"n{i}"}).status_code == 201
    notes = [d["note"] for d in client.get(f"/leads/{lead['id']}/discussions").json()]
    assert notes == [f"n{i}" for i in reversed(range(60))]
    assert client.get(f"/leads/{lead['id']}").json()["last_note"] == "n59"


def test_status_can_move_through_every_stage_and_back(client):
    lead = _lead(client)
    for status in ["Contacted", "Qualified", "Proposal Sent", "Won", "Lost", "New"]:
        res = client.patch(f"/leads/{lead['id']}", json={"status": status})
        assert res.status_code == 200 and res.json()["status"] == status


# --- authentication edge cases -------------------------------------------------


@pytest.mark.parametrize(
    "header",
    ["", "Bearer", "Bearer ", "Basic dXNlcjpwYXNz", "bearer", "Token abc", "Bearer a b c"],
)
def test_malformed_authorization_headers_are_401(anon_client, header):
    assert anon_client.get("/leads", headers={"Authorization": header}).status_code == 401


@pytest.mark.parametrize(
    "body",
    [{}, {"email": TEST_EMAIL}, {"password": TEST_PASSWORD}, {"email": None, "password": None}],
)
def test_login_with_missing_fields_is_422(anon_client, body):
    assert anon_client.post("/auth/login", json=body).status_code == 422


def test_login_with_non_json_body_is_422(anon_client):
    res = anon_client.post("/auth/login", content="email=a&password=b")
    assert res.status_code == 422


def test_login_survives_huge_and_unicode_passwords(anon_client):
    for password in ["x" * 100_000, "пароль🔑", "\x00null"]:
        res = anon_client.post("/auth/login", json={"email": TEST_EMAIL, "password": password})
        assert res.status_code == 401


def test_login_does_not_reveal_whether_the_email_exists(anon_client):
    wrong_pw = anon_client.post("/auth/login", json={"email": TEST_EMAIL, "password": "nope"})
    no_user = anon_client.post("/auth/login", json={"email": "ghost@x.io", "password": "nope"})
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


def test_login_sql_injection_attempt_fails_cleanly(anon_client):
    res = anon_client.post(
        "/auth/login", json={"email": "' OR 1=1 --", "password": "' OR '1'='1"}
    )
    assert res.status_code == 401
