"""MQTT service — connects to The Things Network for LoRaWAN uplinks.

This is a stub. In production, this would:
1. Connect to TTN MQTT broker with TLS
2. Subscribe to device uplink topics
3. Parse CayenneLPP or custom binary payloads
4. Forward readings to the sensor ingestion endpoint
"""

import asyncio
import json
import logging

logger = logging.getLogger(__name__)


class MQTTService:
    """MQTT client for LoRaWAN data ingestion."""

    def __init__(
        self,
        broker: str = "eu1.cloud.thethings.network",
        port: int = 1883,
        username: str = "",
        password: str = "",
    ):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self._running = False

    async def start(self) -> None:
        """Start the MQTT client loop."""
        self._running = True
        logger.info(f"MQTT service connecting to {self.broker}:{self.port}…")
        # In production: use asyncio-mqtt or paho-mqtt with asyncio wrapper
        while self._running:
            await asyncio.sleep(60)

    async def stop(self) -> None:
        """Shut down the MQTT client."""
        self._running = False
        logger.info("MQTT service stopped.")

    def parse_uplink(self, payload: bytes) -> dict:
        """Parse a LoRaWAN uplink payload into sensor readings.

        Expected format: custom binary or CayenneLPP.
        """
        try:
            data = json.loads(payload)
            return {
                "device_eui": data.get("end_device_ids", {}).get("dev_eui", ""),
                "moisture": data.get("uplink_message", {}).get("decoded_payload", {}).get("moisture"),
                "temperature": data.get("uplink_message", {}).get("decoded_payload", {}).get("temperature"),
                "rssi": data.get("uplink_message", {}).get("rx_metadata", [{}])[0].get("rssi"),
                "snr": data.get("uplink_message", {}).get("rx_metadata", [{}])[0].get("snr"),
                "raw_payload": str(payload),
            }
        except (json.JSONDecodeError, KeyError):
            logger.warning("Could not parse uplink payload")
            return {}
