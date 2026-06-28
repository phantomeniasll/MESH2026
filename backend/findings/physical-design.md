# BeTree — Physical Design Notes

## Sensor Box Form Factor

Small stake pushed into the ground near the tree. Tiny solar plate on top. NFC tag on the side.

```
      ☀️  ← tiny solar panel (2×2 cm, visible above ground)
     ┌──┐
     │░░│ ← electronics sealed inside
     │░░│   ESP32, sensors, battery
     │░░│
     └──┘
     ═══╪═══  ← ground level
       │
       │  ← capacitive moisture sensor probe
       │     (10-20cm deep, in root zone)
       │
       ▼
```

**Why this works:**
- One-piece install: push into soil, done
- Only the solar panel is visible — looks like a plant label or irrigation marker
- NFC tag easily accessible
- No housing to vandalize, nothing to kick
- Electronics sealed in potting compound, waterproof
- Probe depth reaches root zone where moisture matters
