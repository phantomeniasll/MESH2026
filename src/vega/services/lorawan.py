"""LoRaWAN payload decoder — TTN webhook integration.

In production this runs as a webhook receiver from TTN.
For HackXplore: we accept pre-decoded JSON from the TTN HTTP integration.
"""

import struct
import logging

logger = logging.getLogger(__name__)

# CayenneLPP channel types
LPP_DIGITAL_INPUT = 0
LPP_DIGITAL_OUTPUT = 1
LPP_ANALOG_INPUT = 2
LPP_ANALOG_OUTPUT = 3
LPP_LUMINOSITY = 101
LPP_PRESENCE = 102
LPP_TEMPERATURE = 103
LPP_HUMIDITY = 104
LPP_ACCELEROMETER = 113
LPP_BAROMETER = 115
LPP_GYROMETER = 134
LPP_GPS = 136


def decode_cayennelpp(data: bytes) -> dict[str, float]:
    """Decode CayenneLPP binary payload into a dict of channel -> value."""
    result = {}
    i = 0
    while i < len(data):
        if i + 2 > len(data):
            break
        channel = data[i]
        lpp_type = data[i + 1]
        i += 2

        if lpp_type == LPP_TEMPERATURE:
            if i + 2 > len(data):
                break
            raw = struct.unpack(">h", data[i:i + 2])[0]
            result[f"temperature_{channel}"] = raw / 10.0
            i += 2
        elif lpp_type == LPP_HUMIDITY:
            if i + 1 > len(data):
                break
            result[f"humidity_{channel}"] = data[i] / 2.0
            i += 1
        elif lpp_type == LPP_ANALOG_INPUT:
            if i + 2 > len(data):
                break
            raw = struct.unpack(">h", data[i:i + 2])[0]
            result[f"analog_{channel}"] = raw / 100.0
            i += 2
        elif lpp_type == LPP_ACCELEROMETER:
            if i + 6 > len(data):
                break
            x, y, z = struct.unpack(">hhh", data[i:i + 6])
            result[f"accel_x_{channel}"] = x / 1000.0
            result[f"accel_y_{channel}"] = y / 1000.0
            result[f"accel_z_{channel}"] = z / 1000.0
            i += 6
        else:
            logger.debug(f"Unknown LPP type {lpp_type} on channel {channel}, skipping")
            break

    return result


def decode_ttn_uplink(uplink_json: dict) -> dict:
    """Extract sensor readings from a complete TTN uplink message."""
    end_device = uplink_json.get("end_device_ids", {})
    uplink_msg = uplink_json.get("uplink_message", {})
    rx_metadata = uplink_msg.get("rx_metadata", [{}])

    decoded = uplink_msg.get("decoded_payload", {})
    f_port = uplink_msg.get("f_port", 1)

    # If payload wasn't decoded by TTN, try CayenneLPP ourselves
    if not decoded and f_port > 0:
        raw_b64 = uplink_msg.get("frm_payload", "")
        if raw_b64:
            import base64
            try:
                raw_bytes = base64.b64decode(raw_b64)
                decoded = decode_cayennelpp(raw_bytes)
            except Exception:
                pass

    return {
        "device_eui": end_device.get("dev_eui", ""),
        "moisture": decoded.get("analog_0") or decoded.get("moisture"),
        "temperature": decoded.get("temperature_1") or decoded.get("temperature"),
        "humidity": decoded.get("humidity_2") or decoded.get("humidity"),
        "battery_voltage": decoded.get("analog_3"),
        "footfall_count": decoded.get("analog_4"),
        "rssi": rx_metadata[0].get("rssi"),
        "snr": rx_metadata[0].get("snr"),
        "raw_payload": uplink_msg.get("frm_payload", ""),
    }
