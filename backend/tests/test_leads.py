def make_lead(client, **kw):
    r = client.post("/leads", json={"name": "Ada", **kw})
    assert r.status_code == 201, r.text
    return r.json()


def test_create_defaults_to_new_and_trims(client):
    lead = make_lead(client, name="  Ada Lovelace ", company="  ", phone=None)
    assert lead["name"] == "Ada Lovelace"
    assert lead["status"] == "New"
    assert lead["company"] is None


def test_create_requires_name(client):
    assert client.post("/leads", json={"name": "   "}).status_code == 422
    assert client.post("/leads", json={}).status_code == 422


def test_invalid_status_rejected(client):
    assert client.post("/leads", json={"name": "x", "status": "Bogus"}).status_code == 422
    lead = make_lead(client)
    assert client.patch(f"/leads/{lead['id']}", json={"status": "Bogus"}).status_code == 422


def test_status_update_persists(client):
    lead = make_lead(client)
    r = client.patch(f"/leads/{lead['id']}", json={"status": "Proposal Sent"})
    assert r.status_code == 200
    assert client.get(f"/leads/{lead['id']}").json()["status"] == "Proposal Sent"


def test_discussion_updates_lead_followup_and_last_note(client):
    lead = make_lead(client)
    r = client.post(
        f"/leads/{lead['id']}/discussions",
        json={"note": "Called, positive", "follow_up_at": "2030-01-02T10:00:00+05:30"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["lead"]["follow_up_at"] == "2030-01-02T04:30:00Z"
    assert body["lead"]["last_note"] == "Called, positive"

    leads = client.get("/leads").json()
    assert leads[0]["last_note"] == "Called, positive"
    assert leads[0]["follow_up_at"] == "2030-01-02T04:30:00Z"


def test_discussion_without_followup_keeps_existing_followup(client):
    lead = make_lead(client)
    client.post(f"/leads/{lead['id']}/discussions",
                json={"note": "one", "follow_up_at": "2030-01-02T10:00:00Z"})
    r = client.post(f"/leads/{lead['id']}/discussions", json={"note": "two"})
    assert r.json()["lead"]["follow_up_at"] == "2030-01-02T10:00:00Z"


def test_followup_can_be_cleared(client):
    lead = make_lead(client)
    client.post(f"/leads/{lead['id']}/discussions",
                json={"note": "one", "follow_up_at": "2030-01-02T10:00:00Z"})
    r = client.patch(f"/leads/{lead['id']}", json={"follow_up_at": None})
    assert r.json()["follow_up_at"] is None


def test_discussions_reverse_chronological(client):
    lead = make_lead(client)
    for n in ("first", "second", "third"):
        client.post(f"/leads/{lead['id']}/discussions", json={"note": n})
    notes = [d["note"] for d in client.get(f"/leads/{lead['id']}/discussions").json()]
    assert notes == ["third", "second", "first"]


def test_empty_note_rejected(client):
    lead = make_lead(client)
    assert client.post(f"/leads/{lead['id']}/discussions", json={"note": " "}).status_code == 422


def test_filter_and_search(client):
    a = make_lead(client, name="Alice Smith")
    make_lead(client, name="Bob Jones")
    client.patch(f"/leads/{a['id']}", json={"status": "Won"})
    assert [l["name"] for l in client.get("/leads?status=Won").json()] == ["Alice Smith"]
    assert [l["name"] for l in client.get("/leads?q=bob").json()] == ["Bob Jones"]
    assert client.get("/leads?status=Nope").status_code == 422


def test_not_found(client):
    assert client.get("/leads/999").status_code == 404
    assert client.patch("/leads/999", json={"status": "Won"}).status_code == 404
    assert client.get("/leads/999/discussions").status_code == 404
    assert client.post("/leads/999/discussions", json={"note": "x"}).status_code == 404


def test_delete_cascades(client):
    lead = make_lead(client)
    client.post(f"/leads/{lead['id']}/discussions", json={"note": "x"})
    assert client.delete(f"/leads/{lead['id']}").status_code == 204
    assert client.get(f"/leads/{lead['id']}").status_code == 404
