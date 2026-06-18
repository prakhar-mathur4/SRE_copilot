"""
Alertmanager webhook contract — exercised via TestClient (no live server, no
network). Replaces the previous assertion-free script that POSTed to a running
localhost:8000 and depended on an undeclared `requests` import (AUDIT.md).
"""


def _payload(alertname="TestAlert", status="firing"):
    return {
        "version": "4",
        "groupKey": '{}:{alertname="' + alertname + '"}',
        "status": status,
        "receiver": "webhook",
        "groupLabels": {"alertname": alertname},
        "commonLabels": {"alertname": alertname},
        "commonAnnotations": {},
        "externalURL": "http://alertmanager:9093",
        "alerts": [
            {
                "status": status,
                "labels": {"alertname": alertname, "severity": "warning", "namespace": "test"},
                "annotations": {"description": "unit test alert"},
                "startsAt": "2026-01-01T00:00:00Z",
                "endsAt": "0001-01-01T00:00:00Z",
                "generatorURL": "",
                "fingerprint": "pytest-fp-001",
            }
        ],
    }


def test_webhook_accepts_payload_without_session(client):
    # No providers are initialized in tests, so the alert is accepted and the
    # background pipeline short-circuits (no matching provider, no network).
    r = client.post("/api/v1/alerts/webhook", json=_payload())
    assert r.status_code == 200
    assert "processing" in r.json()["message"].lower()


def test_webhook_rejects_invalid_body(client):
    r = client.post("/api/v1/alerts/webhook", json={"not": "an-alertmanager-payload"})
    assert r.status_code == 422
