# Wurzelwerk — ESP32 Wiring Reference

## Pin Assignments

| Peripheral | ESP32 Pin | Notes |
|-----------|-----------|-------|
| **DHT22 DATA** | GPIO 33 | One-wire, 4.7kΩ pull-up to 3.3V required |
| DHT22 VCC | 3.3V | |
| DHT22 GND | GND | |
| **Moisture Sensor** | GPIO 34 | ADC1, analog |
| Moisture VCC | 3.3V | |
| Moisture GND | GND | |
| **Vibration Sensor DO** | GPIO 27 | Digital output, LOW when triggered |
| Vibration VCC | 3.3V | |
| Vibration GND | GND | |

## Quick Check

```
ESP32           DHT22           Moisture        Vibration
─────           ─────           ────────        ─────────
3.3V ────────── VCC ──────────── VCC ──────────── VCC
GND  ────────── GND ──────────── GND ──────────── GND
D33  ────────── DATA (4.7kΩ)
D34  ────────────────────────── SIG
D27  ──────────────────────────────────────────── DO
```

## Vibration Sensor Notes

- **Type:** Digital knock/vibration sensor (likely SW-420 or similar)
- **Output:** Normally HIGH, pulls LOW on vibration
- **Footstep logic:** Pulse width > 50ms + 400ms cooldown = 1 footstep
- Tune `FS_THRESHOLD_MS` and `FS_COOLDOWN_MS` in `src/main.cpp` on-site
- No I2C needed — the MPU6050 was replaced by this simpler sensor

## NFC Tag

- Type: NTAG215 (passive — no wiring)
- Write a URL record: `https://wurzelwerk.app/t/{tree-name}`
- Stick on the sensor box enclosure
- Phone tap → browser opens → citizen presses "I watered this"
