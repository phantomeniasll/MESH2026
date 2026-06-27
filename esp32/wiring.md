# Wurzelwerk — ESP32 Wiring Reference

## Build Targets

| Command | Node Type | Radio | Power |
|---------|-----------|-------|-------|
| `platformio run -e mesh_node` | Low-power sensor | ESP-NOW → gateway | Battery (deep sleep) |
| `platformio run -e full_node` | Gateway bridge | ESP-NOW + WiFi HTTP | Mains / always-on |

## Sensor Config per Node Type

Mesh nodes (`NODE_TYPE_MESH`) have fewer sensors by default to save power and BOM cost:

| Sensor | Mesh Node | Full Node |
|--------|-----------|-----------|
| Moisture (GPIO 34) | ✅ | ✅ |
| Vibration / footfall (GPIO 27) | ✅ | ✅ |
| DHT11 temp+humidity (GPIO 14) | ❌ | ✅ |
| Microphone (GPIO 32) | ❌ | ✅ |

Edit the `SENSOR_CFG` block in `src/main.cpp` to change which sensors each node has.
The backend accepts partial JSON — missing sensor fields are simply null.

## Pin Assignments

| Peripheral | ESP32 Pin | Notes |
|-----------|-----------|-------|
| **DHT11 DATA** | GPIO 14 | One-wire, integrated pull-up on module (full node only) |
| DHT11 VCC | 3.3V | |
| DHT11 GND | GND | |
| **Moisture Sensor** | GPIO 34 | ADC1, analog |
| Moisture VCC | 3.3V | |
| Moisture GND | GND | |
| **Vibration Sensor DO** | GPIO 27 | Digital output, LOW when triggered |
| Vibration VCC | 3.3V | |
| Vibration GND | GND | |
| **Microphone OUT** | GPIO 32 | Analog electret (MAX4466/MAX9814), full node only |
| Mic VCC | 3.3V | |
| Mic GND | GND | |

## Quick Check

```
ESP32           DHT11           Moisture        Vibration       Microphone
─────           ─────           ────────        ─────────       ──────────
3.3V ────────── VCC ──────────── VCC ──────────── VCC ──────────── VCC
GND  ────────── GND ──────────── GND ──────────── GND ──────────── GND
D14  ────────── DATA
D34  ────────────────────────── SIG
D27  ──────────────────────────────────────────── DO
D32  ──────────────────────────────────────────────────────────── OUT
```

## Vibration Sensor Notes

- **Type:** Digital knock/vibration sensor (likely SW-420 or similar)
- **Output:** Normally HIGH, pulls LOW on vibration
- **Footstep logic:** Falling-edge interrupt + counter. Counter resets after each send.

## ESP-NOW Setup (first flash)

1. Flash the full node: `platformio run -e full_node -t upload`
2. Read the full node's MAC from serial output (e.g. `AA:BB:CC:DD:EE:FF`)
3. Set that MAC in `src/main.cpp` → `GATEWAY_MAC` array
4. Flash the mesh node: `platformio run -e mesh_node -t upload`
5. Mesh node wakes every 15s, reads sensors, fires ESP-NOW packet at gateway, deep-sleeps

## NFC Tag

- Type: NTAG215 (passive — no wiring)
- Write a URL record: `https://wurzelwerk.app/t/{tree-name}`
- Stick on the sensor box enclosure
- Phone tap → browser opens → citizen presses "I watered this"
