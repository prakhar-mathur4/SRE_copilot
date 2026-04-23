# User Story: Pod Inventory & Fleet Management (US07)

As an **SRE**, I want a real-time registry of all pods in my cluster so that I can quickly assess the health of the fleet and take manual corrective actions without using `kubectl`.

### Acceptance Criteria:
1. **Real-time Registry**: A tabular view showing all pods across all namespaces.
2. **Key Metadata**: Each pod entry must show its Name, Namespace, Owner Type (Kind), Node IP, and Age.
3. **Health Signals**: Status (Phase), Restart counts, and resource usage (CPU/Memory) must be visible.
4. **Namespace Filtering**: Users can filter the list by a specific namespace.
5. **YAML Inspection**: Users can view the live manifest (YAML) of any pod.
6. **Active Management**: Users can delete/restart a pod directly from the UI with a confirmation step.
7. **Cluster Transparency**: If multiple clusters are supported, the cluster name should be visible (default: minikube).

### Business Value:
Reduces MTTR by providing an "SRE Control Plane" that aggregates fragmented Kubernetes information into a single, actionable cockpit.
