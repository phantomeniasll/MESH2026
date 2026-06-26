# Low-Power Microcontroller Comparison

**Context:** Outdoor tree sensor box. WiFi mesh (now) → LoRaWAN (later). Battery-powered. Multiple sensors.

---

## Chip Comparison

| Chip | WiFi | Active Current | Deep Sleep | Sensors? | Cost | Notes |
|------|------|---------------|------------|----------|------|-------|
| **ESP32** (standard) | ✅ b/g/n | 160–260 mA | ~10 µA | ✅ Plenty GPIO | ~€4 | VEGA provides. Solid default. |
| **ESP32-S3** | ✅ b/g/n | 90–240 mA | ~7 µA | ✅ More GPIO | ~€6 | Better power mgmt, USB OTG, good for on-device ML |
| **ESP32-C3** | ✅ b/g/n | 70–80 mA | ~5 µA | ⚠️ Fewer GPIO | ~€3 | RISC-V. Great sensor endpoint. Limited for hub. |
| **ESP32-C6** | ✅ WiFi 6 | 70–80 mA | ~7 µA | ⚠️ Fewer | ~€4 | Also has Thread/Zigbee. Future-proof. Newer. |
| **ESP8266** | ✅ b/g/n | 70–80 mA | ~20 µA | ⚠️ Only 1 ADC | ~€2 | Outdated. Skip. |
| **nRF52840** | ❌ No WiFi | 6–15 mA (BLE) | ~1 µA | ✅ Plenty | ~€8 | Best battery life. Needs separate WiFi gw. |
| **RP2040 W** | ✅ b/g/n | 50–90 mA | ~1 mA | ✅ Decent | ~€8 | Pico ecosystem. Python (MicroPython). |

---

## The Power Problem

WiFi is the killer. An ESP32 sending data every 15 minutes on battery:

```
Wake → connect WiFi (2-5s @ 200mA) → send (0.1s) → deep sleep
= ~5s active × 200mA = ~0.28 mAh per cycle
× 96 cycles/day = ~27 mAh/day
× 30 days = ~810 mAh/month
```

A single 18650 Li-ion (3000 mAh) = **~3.7 months** at 15min intervals. That's good.

But **WiFi mesh** means each node must stay awake to relay neighbors' packets. That kills battery.

---

## The Real Answer: ESP-NOW

ESP-NOW is Espressif's peer-to-peer protocol. It's NOT WiFi — it uses the same radio but without connecting to a network. **No router. No DHCP. No association handshake.**

```
ESP-NOW:  "I wake up, fire a packet at MAC address AA:BB:CC, go back to sleep."
WiFi:     "I wake up, scan for AP, associate, DHCP, TCP connect, send, sleep."
```

| Metric | WiFi (MQTT) | ESP-NOW |
|--------|------------|---------|
| Wake-to-send time | 2–5 seconds | **~20 ms** |
| Power per transmission | ~1 mAh | **~0.005 mAh** |
| 30 days on 18650 with 15min interval | ~3 months | **~2 years** |
| Range | WiFi AP range | Same radio = same range |
| Mesh possible? | Yes, complex | Simple relay pattern |

### ESP-NOW Mesh Pattern

```
[Tree 1] ──ESP-NOW──> [Tree 2] ──ESP-NOW──> [Tree 3] ──WiFi──> [Hub/Router]
   │                      │                      │
   └── Each node: wake, read sensors, send packet to nearest neighbor, sleep
```

One node is the "gateway" — it has both ESP-NOW and WiFi. It collects all mesh packets and forwards them via WiFi/MQTT to the backend. All other nodes are ESP-NOW only. They sleep 99% of the time.

**This is your mesh.** ESP-NOW for all tree-to-tree communication. One ESP32 near the venue's WiFi acts as gateway. Battery life goes from "maybe the weekend" to "months."

---

## Recommendation

| Role | Chip | Protocol | Power |
|------|------|----------|-------|
| **Sensor node** (each tree) | ESP32 (VEGA) | ESP-NOW → gateway | Years on 18650 |
| **Gateway node** (one) | ESP32 + WiFi | ESP-NOW in, MQTT out | Mains or large battery |
| **Future** | ESP32-C6 + LoRa | LoRaWAN TTN | Decades on AA |

**For the hackathon:** Start with all ESP32s on WiFi for simplicity (hour 0-3). Once the pipeline works, switch to ESP-NOW mesh (hour 8-10) and show the battery math on a roadmap slide. You don't need to build the full battery setup — just demonstrate ESP-NOW latency and explain the power model.
