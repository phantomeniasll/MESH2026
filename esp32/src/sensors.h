// =============================================================================
// Wurzelwerk — Shared Sensor Library
// =============================================================================
// Reads DHT11, soil moisture, vibration, and microphone.
// Used identically by both full nodes (gateway) and mesh nodes (low-power).
//
// Partial sensor support: each node declares which sensors it physically
// has via SensorConfig.  Missing sensors are omitted from the JSON payload.
// The backend schema accepts nulls for all fields — no server changes needed.
//
// Dependencies: DHT sensor library, Arduino framework

#ifndef WURZELWERK_SENSORS_H
#define WURZELWERK_SENSORS_H

#include <Arduino.h>

// ── PIN ASSIGNMENTS (match wiring.md) ──────────────────────────
#define MOISTURE_PIN  34   // ADC1 — capacitive soil moisture
#define DHT_PIN       14   // DHT11 one-wire
#define DHT_TYPE      DHT11
#define VIBE_PIN      27   // Digital vibration sensor (LOW when triggered)
#define MIC_PIN       32   // Analog electret microphone (ADC1_CH4)
#define MIC_SAMPLE_MS 500  // Averaging window for sound level

// ── Footstep debounce ──────────────────────────────────────────
// Vibration sensors are jittery — a single footstep can produce
// multiple falling edges as the ground vibration rings out.
// We ignore triggers within DEBOUNCE_MS of the last accepted one.
#define VIBE_DEBOUNCE_MS 250  // minimum gap between counted steps

// ── Sensor presence flags (set at compile time per node) ────────
struct SensorConfig {
    bool has_dht;         // temperature + humidity
    bool has_moisture;    // capacitive soil moisture
    bool has_vibration;   // footfall detection
    bool has_mic;         // ambient sound level
    bool has_battery;     // voltage divider on ADC (separate hardware)
};

// ── Sensor readings struct ──────────────────────────────────────
struct SensorReadings {
    float temperature;    // °C, -99.0 = error
    float humidity;       // %,  -1.0 = error
    int   moisture_pct;   // 0–100 (100 = bone dry, 0 = submerged)
    int   moisture_raw;   // 0–4095 ADC
    int   sound_pct;      // 0–100 sound level
    int   sound_pp;       // 0–4095 peak-to-peak
    int   footfall_count; // steps since last read
    float battery_v;      // voltage (set by caller if has_battery)
};

// ── Public API ──────────────────────────────────────────────────

// One-time setup. Pass which sensors are physically connected.
// Disabled sensors leave their pins unconfigured.
void sensors_init(const SensorConfig& cfg);

// Read all enabled sensors into the provided struct.
// Disabled sensor fields are left at zero.
// Blocks for MIC_SAMPLE_MS during microphone sampling.
void read_sensors(const SensorConfig& cfg, SensorReadings& r);

// Reset the footfall counter to zero (call after sending).
void reset_footfall();

// Build a JSON payload matching the backend /api/sensors/ingest schema.
// Only includes fields for enabled sensors (others are omitted entirely
// so the backend sees them as null / absent).
// Caller provides rssi and snr separately (radio-dependent).
// Returns the number of bytes written (excluding null terminator),
// or -1 if the buffer was too small (content is truncated).
int build_json(const SensorConfig& cfg, const SensorReadings& r,
               const char* device_eui, const char* tree_id,
               int rssi, float snr,
               char* buf, int buf_size);

#endif // WURZELWERK_SENSORS_H
