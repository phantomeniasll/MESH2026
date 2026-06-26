# Sensor Expansion & LoRaWAN Analysis

**Research date:** June 26, 2026

---

## Sensor Stack (ESP32-Compatible)

| Sensor | Cost | Data | Pitch Value |
|--------|------|------|-------------|
| **Capacitive soil moisture** | Provided | Moisture % | Core product — "does this tree need water?" |
| **DHT22** temp/humidity | ~€2 | Microclimate | "5-8°C hotter on paved streets than airport station" |
| **Rain gauge** (tipping bucket) | ~€8 | Actual rainfall at tree | "Did that rain reach the soil or just wet the canopy?" |
| **BH1750** light sensor | ~€3 | Sun exposure (lux) | "South-facing trees dry 40% faster" |
| **MPU6050** IMU/accelerometer | ~€4 | Foot traffic count + tree tilt | "847 people walked past today. 12 stopped. 3 watered." Urban footfall data. Also: storm damage detection — tilt triggers inspection. |
| **Solar + Li backup** | Production | Self-powered, zero maintenance | Roadmap slide: "Deploy and forget. No grid connection, no battery swaps." Not build-this-weekend. |
| **ESP32-CAM** | ~€8 | Time-lapse photos | "Watch your adopted tree grow" (citizen engagement) |
| **MLX90640** thermal cam | ~€40 | Leaf surface temp | "Water stress visible before wilting" (premium data) |
| **PMS5003** air quality | ~€15 | PM2.5, PM10 | "This tree filtered X grams of particulates this month" |

## LoRaWAN Architecture

```
[ESP32 + RFM95W LoRa] ──LoRa──> [TTN Gateway] ──IP──> [TTN Backend] ──MQTT──> [Our Server]
       €10 add-on                  Free community         Free                Our Python backend
```

**Key facts:**
- **The Things Network (TTN):** Free, community-run, almost certainly present in Karlsruhe (university city, tech hub)
- **Range:** 2-5km urban, 10-15km rural — one gateway per district
- **Battery:** LoRa + deep sleep = months on AA batteries
- **No WiFi per tree:** Sensors talk directly to existing TTN infrastructure

## Why This Matters

Other teams will build WiFi sensors that only work in the venue (100m range to the router). You build a **city-scale architecture** that a real municipality deploys tomorrow.

This is what the R&D jury wants to see — not a prototype that stops working when you leave SteamWork.

## Expanded Use Cases

- **Foot traffic analytics** → "Kaiserstr. plane tree: 847 pedestrians/day. 12 stopped. 3 watered. Peak: 8am commuters." Urban planning data for where benches, lighting, and new trees should go.
- **Frost alert** → city protects young trees before cold snap
- **Storm damage** → tilt sensor triggers inspection after wind event
- **Watering route optimizer** → "15 trees need water. Here's your 22-min walking circuit."
- **CO2 tracking** → "This 80-year-old plane tree absorbed 4.2 tons of CO2"
- **Urban heat island mapping** → per-street temp data for city planning
- **School programs** → biology classes adopt a tree, track data, learn data science
- **Citizen science** → open API, researchers access anonymized canopy data
- **Solar self-power** → (roadmap) deploy anywhere. Zero infrastructure. Zero maintenance. The tree is the power source — panel in the canopy, battery at the root.
