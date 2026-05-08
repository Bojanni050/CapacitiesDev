"""Mindstack backend API tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://capacity-match.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

VALID_TYPES = ["note", "person", "task", "idea", "book", "project", "meeting", "daily"]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # cleanup TEST_ prefixed
    try:
        objs = s.get(f"{API}/objects", params={"search": "TEST_"}).json()
        for o in objs:
            s.delete(f"{API}/objects/{o['id']}")
    except Exception:
        pass


# ---------- Meta endpoints ----------
class TestMeta:
    def test_types(self, session):
        r = session.get(f"{API}/types")
        assert r.status_code == 200
        data = r.json()
        assert data["types"] == VALID_TYPES

    def test_stats_shape(self, session):
        r = session.get(f"{API}/stats")
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data and "total" in data
        for t in VALID_TYPES:
            assert t in data["counts"]
        assert data["total"] == sum(data["counts"].values())


# ---------- CRUD ----------
class TestCrud:
    created_ids = []

    def test_create_invalid_type(self, session):
        r = session.post(f"{API}/objects", json={"type": "invalid", "title": "TEST_x"})
        assert r.status_code == 400

    @pytest.mark.parametrize("t", VALID_TYPES)
    def test_create_each_type(self, session, t):
        r = session.post(f"{API}/objects", json={"type": t, "title": f"TEST_{t}_title", "body": f"body for {t}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == t
        assert data["title"] == f"TEST_{t}_title"
        assert "id" in data
        assert "_id" not in data
        TestCrud.created_ids.append(data["id"])

    def test_list_no_id_leak_and_sorted(self, session):
        r = session.get(f"{API}/objects")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert "_id" not in it
        # sort desc by updated_at
        ts = [it["updated_at"] for it in items]
        assert ts == sorted(ts, reverse=True)

    def test_list_filter_by_type(self, session):
        r = session.get(f"{API}/objects", params={"type": "person"})
        assert r.status_code == 200
        for it in r.json():
            assert it["type"] == "person"

    def test_list_search_case_insensitive(self, session):
        r = session.get(f"{API}/objects", params={"search": "test_note"})
        assert r.status_code == 200
        items = r.json()
        assert any("TEST_note" in (it.get("title") or "") for it in items)

    def test_get_unknown(self, session):
        r = session.get(f"{API}/objects/does-not-exist-xyz")
        assert r.status_code == 404

    def test_get_known(self, session):
        oid = TestCrud.created_ids[0]
        r = session.get(f"{API}/objects/{oid}")
        assert r.status_code == 200
        assert r.json()["id"] == oid

    def test_update_persists_and_bumps_updated_at(self, session):
        oid = TestCrud.created_ids[0]
        before = session.get(f"{API}/objects/{oid}").json()
        time.sleep(0.05)
        r = session.put(f"{API}/objects/{oid}", json={"title": "TEST_updated_title", "body": "new body"})
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "TEST_updated_title"
        assert data["body"] == "new body"
        assert data["updated_at"] > before["updated_at"]
        # verify persisted
        g = session.get(f"{API}/objects/{oid}").json()
        assert g["title"] == "TEST_updated_title"

    def test_update_invalid_type(self, session):
        oid = TestCrud.created_ids[0]
        r = session.put(f"{API}/objects/{oid}", json={"type": "bogus"})
        assert r.status_code == 400

    def test_update_unknown(self, session):
        r = session.put(f"{API}/objects/nonexistent-id", json={"title": "x"})
        assert r.status_code == 404

    def test_delete_unknown(self, session):
        r = session.delete(f"{API}/objects/nonexistent-id")
        assert r.status_code == 404

    def test_delete_known_and_404_after(self, session):
        # delete the last created (cleanup as we go)
        oid = TestCrud.created_ids.pop()
        r = session.delete(f"{API}/objects/{oid}")
        assert r.status_code == 200
        r2 = session.get(f"{API}/objects/{oid}")
        assert r2.status_code == 404


# ---------- AI ----------
class TestAI:
    def test_ai_enhance_writes_tags_and_summary(self, session):
        # create rich object
        r = session.post(f"{API}/objects", json={
            "type": "note",
            "title": "TEST_ai_enhance Quantum computing primer",
            "body": "Notes on superposition, entanglement, qubits, and quantum gates. "
                    "Discusses Shor's algorithm and applications in cryptography."
        })
        assert r.status_code == 200
        oid = r.json()["id"]
        try:
            er = session.post(f"{API}/objects/{oid}/ai-enhance", timeout=60)
            assert er.status_code == 200, er.text
            data = er.json()
            assert isinstance(data.get("ai_tags"), list)
            assert len(data["ai_tags"]) >= 1
            assert all(isinstance(t, str) for t in data["ai_tags"])
            assert isinstance(data.get("ai_summary"), str)
            assert len(data["ai_summary"]) > 0
            # verify persisted via GET
            g = session.get(f"{API}/objects/{oid}").json()
            assert g["ai_tags"] == data["ai_tags"]
        finally:
            session.delete(f"{API}/objects/{oid}")

    def test_ai_enhance_unknown(self, session):
        r = session.post(f"{API}/objects/nonexistent/ai-enhance")
        assert r.status_code == 404

    def test_related_returns_real_other_objects(self, session):
        # Create a note + matching person
        n = session.post(f"{API}/objects", json={
            "type": "note",
            "title": "TEST_related Coffee chat with Marie about photography",
            "body": "Discussed darkroom techniques and film exposure with Marie."
        }).json()
        p = session.post(f"{API}/objects", json={
            "type": "person",
            "title": "TEST_related Marie Curie",
            "body": "Photographer friend, expert in film and darkroom."
        }).json()
        # noise
        noise = session.post(f"{API}/objects", json={
            "type": "task",
            "title": "TEST_related Buy groceries",
            "body": "milk eggs bread"
        }).json()
        try:
            r = session.get(f"{API}/objects/{n['id']}/related", timeout=60)
            assert r.status_code == 200
            arr = r.json()
            assert isinstance(arr, list)
            ids_seen = {item["id"] for item in arr}
            # No self
            assert n["id"] not in ids_seen
            # All ids must be real (exist in DB) - no hallucinations
            for item in arr:
                g = session.get(f"{API}/objects/{item['id']}")
                assert g.status_code == 200, f"hallucinated id {item['id']}"
                assert item["type"] in VALID_TYPES
                assert isinstance(item["score"], int)
                assert isinstance(item["reason"], str)
                assert isinstance(item["title"], str)
            # Should match the person (Marie) for our note
            assert p["id"] in ids_seen, f"Expected person to be in related, got {ids_seen}"
        finally:
            for o in (n, p, noise):
                session.delete(f"{API}/objects/{o['id']}")

    def test_related_unknown(self, session):
        r = session.get(f"{API}/objects/nonexistent/related")
        assert r.status_code == 404
