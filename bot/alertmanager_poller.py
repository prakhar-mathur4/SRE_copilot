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


def _convert_vmalert_to_alert_data(raw: dict, provider_id: str) -> AlertData:
    """Convert a vmalert /api/v1/alerts entry to internal AlertData model.

    vmalert's shape differs from Alertmanager: no status object or fingerprint,
    a top-level ``state`` (firing/pending/inactive), and ``activeAt``/``source``
    in place of ``startsAt``/``generatorURL``.
    """
    labels = {k: str(v) for k, v in raw.get("labels", {}).items()}
    # vmalert exposes the rule name via labels.alertname; backfill from `name` if absent
    labels.setdefault("alertname", str(raw.get("name", "")))
    labels["vmalert_source"] = provider_id

    annotations = {k: str(v) for k, v in raw.get("annotations", {}).items()}
    status = "firing" if (raw.get("state") or "").lower() == "firing" else "resolved"

    return AlertData(
        status=status,
        labels=labels,
        annotations=annotations,
        startsAt=raw.get("activeAt", ""),
        endsAt="0001-01-01T00:00:00Z",
        generatorURL=raw.get("source", ""),
        fingerprint="",  # computed downstream via noise_reducer.calculate_fingerprint
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
    from bot.providers.vmalert_provider import VMAlertProvider
    from bot.alert_handler import process_alert_background
    from bot.noise_reduction import noise_reducer

    for provider_id, provider in list(registry._providers.items()):
        if isinstance(provider, VMAlertProvider):
            await _poll_vmalert(provider_id, provider, noise_reducer, process_alert_background)
            continue
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

            # Route through noise reducer; it returns a fingerprint only when
            # every source has cleared — otherwise the incident stays open.
            if noise_reducer.process_incoming_alert(resolved_alert):
                asyncio.create_task(process_alert_background(resolved_alert))

        provider._active_alerts = current_alerts


async def _poll_vmalert(provider_id, provider, noise_reducer, process_alert_background):
    """Poll a vmalert provider: only firing alerts become incidents.

    vmalert has no stable per-alert fingerprint, so we key active alerts by the
    label-based fingerprint (the same hash used for resolution matching).
    Pending alerts are ignored until they fire.
    """
    raw_firing = await provider.poll_firing_alerts()
    current_alerts: dict = {}  # label-fingerprint → full raw alert dict

    for raw in raw_firing:
        alert = _convert_vmalert_to_alert_data(raw, provider_id)
        fp = noise_reducer.calculate_fingerprint(alert)
        current_alerts[fp] = raw

        # Only process alerts we haven't seen firing in the last cycle
        if fp not in provider._active_alerts:
            logger.info(
                f"[Poller] New alert from {provider_id}: "
                f"{alert.labels.get('alertname')} (fp={fp})"
            )
            processed_fp = noise_reducer.process_incoming_alert(alert)
            if processed_fp:
                asyncio.create_task(process_alert_background(alert))

    # Detect resolutions: firing alerts present last cycle but gone now
    resolved_fingerprints = set(provider._active_alerts.keys()) - set(current_alerts.keys())
    for fp in resolved_fingerprints:
        original_raw = provider._active_alerts[fp]
        resolved_alert = _convert_vmalert_to_alert_data(original_raw, provider_id)
        resolved_alert.status = "resolved"
        logger.info(
            f"[Poller] Alert resolved in {provider_id}: "
            f"{resolved_alert.labels.get('alertname', 'unknown')} (fp={fp})"
        )
        # Resolution propagates only when every source has cleared the alert.
        if noise_reducer.process_incoming_alert(resolved_alert):
            asyncio.create_task(process_alert_background(resolved_alert))

    provider._active_alerts = current_alerts
