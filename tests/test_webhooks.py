import requests
import json
import time

URL = "http://localhost:8000/api/v1/alerts/webhook"

def send_alert(alert_name, labels, annotations=None, status="firing"):
    payload = {
        "version": "4",
        "groupKey": "{}/{}:{alertname=\"" + alert_name + "\"}",
        "status": status,
        "receiver": "webhook",
        "groupLabels": {"alertname": alert_name},
        "commonLabels": {"alertname": alert_name},
        "commonAnnotations": {},
        "externalURL": "http://alertmanager:9093",
        "alerts": [
            {
                "status": status,
                "labels": {"alertname": alert_name, **labels},
                "annotations": annotations or {},
                "startsAt": "2023-10-10T12:00:00Z",
                "endsAt": "0001-01-01T00:00:00Z",
                "generatorURL": "http://prometheus:9090",
                "fingerprint": f"fp_{alert_name}_{int(time.time() * 1000)}"
            }
        ]
    }
    print(f"Sending alert {alert_name} [{status}] to {URL}...")
    try:
        response = requests.post(URL, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}\n")
    except Exception as e:
        print(f"Error: {e}\n")

if __name__ == "__main__":
    # Test 1: Standard K8s Alert
    print("--- Test 1: Kubernetes Alert ---")
    send_alert(
        "HighMemoryUsage", 
        {"severity": "critical", "namespace": "prod", "pod": "payment-api-58dc"},
        {"description": "Pod payment-api-58dc is using too much memory"}
    )
    time.sleep(2)

    # Test 2: Standard VM/Instance Alert
    print("--- Test 2: Virtual Machine Alert ---")
    send_alert(
        "HighCpuLoad", 
        {"severity": "warning", "instance": "db-server-01", "job": "node_exporter"},
        {"description": "Instance db-server-01 has high CPU load"}
    )
    time.sleep(2)
    
    # Test 3: K8s Deployment Alert (no specific pod)
    print("--- Test 3: Kubernetes Deployment Alert ---")
    send_alert(
        "HighErrorRate", 
        {"severity": "page", "namespace": "default", "deployment": "auth-service"},
        {"description": "auth-service is experiencing a high 5xx rate"}
    )
    time.sleep(2)
