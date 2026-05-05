"""
Background poller for Alertmanager connectors.
Polls all registered Alertmanager providers every 30 seconds,
converts firing alerts into AlertData and injects them into the pipeline.
Detects resolutions when alerts disappear from the active list.
"""
import asyncio
import logging

from bot.models import AlertData

logger = logging.getLogger("sre_copilot")

POLL_INTERVAL = 30  # seconds


def _convert_to_alert_data(raw: dict, provider_id: str) -> AlertData:
    """Convert Alertmanager v2 API alert format to internal AlertData model."""
    labels = {k: str(v) for k, v in raw.get("labels", {}).items()}
    # Tag the alert with its source so the provider routing picks the right one
    labels["alertmanager_source"] = provider_id

    annotations = {k: str(v) for k, v in raw.get("annotations", {}).items()}
    status_state = raw.get("status", {}).get("state", "active")
    status = "firing" if status_state == "active" else "resolved"

    return AlertData(
        status=status,
        labels=labels,
        annotations=annotations,
        startsAt=raw.get("startsAt", ""),
        endsAt=raw.get("endsAt", "0001-01-01T00:00:00Z"),
        generatorURL=raw.get("generatorURL", ""),
        fingerprint=raw.get("fingerprint", ""),
    )


async def poll_alertmanagers_loop():
    """Long-running background task. Polls all Alertmanager providers."""
    # Delay first poll so providers are fully initialised
    await asyncio.sleep(10)

    while True:
        try:
            await _poll_once()
        except Exception as e:
            logger.error(f"Alertmanager poll cycle failed: {e}")
        await asyncio.sleep(POLL_INTERVAL)


async def _poll_once():
    from bot.providers import registry
    from bot.providers.alertmanager_provider import AlertmanagerProvider
    from bot.alert_handler import process_alert_background
    from bot.noise_reduction import noise_reducer

    for provider_id, provider in list(registry._providers.items()):
        if not isinstance(provider, AlertmanagerProvider):
            continue

        raw_alerts = await provider.poll_alerts()
        current_alerts: dict = {}  # Alertmanager fingerprint → full raw alert dict

        for raw in raw_alerts:
            fp = raw.get("fingerprint", "")
            if not fp:
                continue
            current_alerts[fp] = raw

            # Only process alerts we haven't seen in the last cycle
            if fp not in provider._active_alerts:
                alert = _convert_to_alert_data(raw, provider_id)
                logger.info(
                    f"[Poller] New alert from {provider_id}: "
                    f"{alert.labels.get('alertname')} (fp={fp})"
                )
                processed_fp = noise_reducer.process_incoming_alert(alert)
                if processed_fp:
                    asyncio.create_task(process_alert_background(alert))

        # Detect resolutions: alerts present last cycle but gone now
        resolved_fingerprints = set(provider._active_alerts.keys()) - set(current_alerts.keys())
        for fp in resolved_fingerprints:
            original_raw = provider._active_alerts[fp]
            alert_name = original_raw.get("labels", {}).get("alertname", "unknown")
            logger.info(f"[Poller] Alert resolved in {provider_id}: {alert_name} (fp={fp})")

            # Reconstruct with original labels so calculate_fingerprint produces the
            # same SHA-256 hash as the firing alert, ensuring the right incident is resolved
            resolved_alert = _convert_to_alert_data(original_raw, provider_id)
            resolved_alert.status = "resolved"
            resolved_alert.endsAt = original_raw.get("endsAt", "")

            # Route through noise reducer so mark_resolved() clears active_fingerprints
            noise_reducer.process_incoming_alert(resolved_alert)
            asyncio.create_task(process_alert_background(resolved_alert))

        provider._active_alerts = current_alerts
