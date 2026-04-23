# User Stories: Chaos Engineering Engine

As an **SRE**, I want to simulate a node failure so that I can verify my dashboard correctly turns red and alerts my team.

### Stories:
1. **US1: Trigger Mock Node Outage**
   * **As an** SRE
   * **I want** to toggle a "Node Failure" simulation via an API call or UI button
   * **So that** I can see the "Global Cluster Health" indicator switch from Green to Red without actually stopping my cluster.

2. **US2: Extensible Chaos Scenarios**
   * **As a** Developer
   * **I want** the Chaos Engine to be built as a registry of scenarios
   * **So that** I can easily add new types of chaos (e.g., Latency, CPU Spike, Memory Leak) in the future.

3. **US3: Visual Simulation Indicator**
   * **As an** Operator
   * **I want** a clear warning on the dashboard when Chaos Mode is active
   * **So that** I don't mistake a simulation for a real production incident.

4. **US4: Rapid Restoration**
   * **As an** SRE
   * **I want** to "Stop All Chaos" with a single action
   * **So that** I can quickly return to monitoring the real cluster state.
