// =============================================================================
// Wurzelwerk — Shared Sensor Library (implementation)
// =============================================================================

#include "sensors.h"
#include <DHT.h>
#include <soc/sens_reg.h>       // REG_SET_FIELD, SENS_SAR1_SAMPLE_CYCLE
#include <driver/adc.h>         // adc1_config_channel_atten
#include <esp_timer.h>          // esp_timer_get_time() — ISR-safe

// ── Globals ─────────────────────────────────────────────────────
static DHT dht(DHT_PIN, DHT_TYPE);
static volatile int fs_count = 0;       // footstep counter (ISR)
static uint64_t      last_vibe_us = 0;  // debounce timer (ISR-safe)

// ── Interrupt handler ──────────────────────────────────────────
// The vibration sensor is inherently jittery — a single footstep on
// hard ground can produce a burst of falling edges as the vibration
// rings out through the soil.  We ignore any trigger that arrives
// within VIBE_DEBOUNCE_MS of the last counted step.
//
// esp_timer_get_time() is used instead of millis() because it is
// safe to call from an ISR context (it reads the CPU cycle counter,
// not the interrupt-driven systick).
static void IRAM_ATTR vibe_isr() {
    uint64_t now = esp_timer_get_time();
    uint64_t elapsed_ms = (now - last_vibe_us) / 1000ULL;
    if (elapsed_ms >= VIBE_DEBOUNCE_MS) {
        fs_count++;
        last_vibe_us = now;
    }
}

// ── Init ────────────────────────────────────────────────────────
void sensors_init(const SensorConfig& cfg) {
    if (cfg.has_dht) {
        dht.begin();
    }

    if (cfg.has_moisture) {
        pinMode(MOISTURE_PIN, INPUT);
        analogSetAttenuation(ADC_11db);
    }

    if (cfg.has_mic) {
        analogSetPinAttenuation(MIC_PIN, ADC_11db);
        adc1_config_channel_atten(ADC1_CHANNEL_4, ADC_ATTEN_DB_11);
        REG_SET_FIELD(SENS_SAR_READ_CTRL_REG, SENS_SAR1_SAMPLE_CYCLE, 0b111);
    }

    if (cfg.has_vibration) {
        pinMode(VIBE_PIN, INPUT_PULLUP);
        attachInterrupt(digitalPinToInterrupt(VIBE_PIN), vibe_isr, FALLING);
    }

    Serial.println("[sensors] Init done.");
}

// ── Read all enabled sensors ────────────────────────────────────
void read_sensors(const SensorConfig& cfg, SensorReadings& r) {
    // Save caller-set values that memset would destroy
    float caller_battery_v = r.battery_v;

    memset(&r, 0, sizeof(r));

    // Restore caller-set values
    r.battery_v = caller_battery_v;

    if (cfg.has_dht) {
        dht.readTemperature();
        dht.readHumidity();
        delay(250);

        r.temperature = dht.readTemperature();
        r.humidity    = dht.readHumidity();
        if (isnan(r.temperature)) r.temperature = -99.0f;
        if (isnan(r.humidity))    r.humidity    = -1.0f;
    } else {
        r.temperature = -99.0f;
        r.humidity    = -1.0f;
    }

    if (cfg.has_moisture) {
        r.moisture_raw = analogRead(MOISTURE_PIN);
        r.moisture_pct = map(r.moisture_raw, 4095, 0, 0, 100);
    }

    if (cfg.has_mic) {
        int mic_min = 4095, mic_max = 0;
        unsigned long mic_start = millis();
        while (millis() - mic_start < MIC_SAMPLE_MS) {
            int val = analogRead(MIC_PIN);
            if (val < mic_min) mic_min = val;
            if (val > mic_max) mic_max = val;
        }
        r.sound_pp  = mic_max - mic_min;
        r.sound_pct = map(r.sound_pp, 0, 3000, 0, 100);
        if (r.sound_pct > 100) r.sound_pct = 100;
        if (r.sound_pct < 0)   r.sound_pct = 0;
    }

    if (cfg.has_vibration) {
        noInterrupts();
        r.footfall_count = fs_count;
        interrupts();
    }

    // Battery voltage is set by caller if has_battery is true
    // (it's hardware-specific — needs a voltage divider + calibration)
    if (cfg.has_battery) {
        // Caller should have set r.battery_v before calling build_json
        // We leave it as whatever was set — default float zero is fine.
    }
}

void reset_footfall() {
    noInterrupts();
    fs_count = 0;
    interrupts();
}

// ── Build JSON (partial sensor support) ─────────────────────────
int build_json(const SensorConfig& cfg, const SensorReadings& r,
               const char* device_eui, const char* tree_id,
               int rssi, float snr,
               char* buf, int buf_size) {

    // Build JSON manually, only including enabled sensor fields.
    // This keeps the payload compact for ESP-NOW's 250-byte limit
    // and correctly signals "no data" to the backend.

    int pos = 0;
    auto w = [&](const char* s) {
        int n = strlen(s);
        if (pos + n < buf_size) { memcpy(buf + pos, s, n); pos += n; }
        else { pos = buf_size; }  // truncate — caller checks return
    };
    auto comma_if = [&](bool& first) {
        if (!first) w(","); else first = false;
    };

    bool first = true;
    w("{");

    // device_eui (always present)
    comma_if(first);
    w("\"device_eui\":\"");
    w(device_eui);
    w("\"");

    // tree_id (always present — identifies the tree this sensor is mounted on)
    comma_if(first);
    w("\"tree_id\":\"");
    w(tree_id);
    w("\"");

    // moisture
    if (cfg.has_moisture) {
        comma_if(first);
        w("\"moisture\":");
        char num[16];
        snprintf(num, sizeof(num), "%d", r.moisture_pct);
        w(num);
    }

    // temperature
    if (cfg.has_dht) {
        comma_if(first);
        w("\"temperature\":");
        char num[16];
        snprintf(num, sizeof(num), "%.1f", r.temperature);
        w(num);
    }

    // humidity
    if (cfg.has_dht) {
        comma_if(first);
        w("\"humidity\":");
        char num[16];
        snprintf(num, sizeof(num), "%.1f", r.humidity);
        w(num);
    }

    // battery_voltage
    if (cfg.has_battery) {
        comma_if(first);
        w("\"battery_voltage\":");
        char num[16];
        snprintf(num, sizeof(num), "%.2f", r.battery_v);
        w(num);
    }

    // footfall_count
    if (cfg.has_vibration) {
        comma_if(first);
        w("\"footfall_count\":");
        char num[16];
        snprintf(num, sizeof(num), "%d", r.footfall_count);
        w(num);
    }

    // tilt_angle — always present (zero when unused)
    comma_if(first);
    w("\"tilt_angle\":0.0");

    // sound_level
    if (cfg.has_mic) {
        comma_if(first);
        w("\"sound_level\":");
        char num[16];
        snprintf(num, sizeof(num), "%d", r.sound_pct);
        w(num);
    }

    // rssi (radio-dependent, always included)
    comma_if(first);
    w("\"rssi\":");
    char num[16];
    snprintf(num, sizeof(num), "%d", rssi);
    w(num);

    // snr (radio-dependent, always included)
    comma_if(first);
    w("\"snr\":");
    snprintf(num, sizeof(num), "%.1f", snr);
    w(num);

    w("}");
    buf[pos] = '\0';

    if (pos >= buf_size) return -1;
    return pos;
}
