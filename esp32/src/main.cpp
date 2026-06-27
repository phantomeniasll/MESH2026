// =============================================================================
// Wurzelwerk — ESP32 Tree Sensor Firmware (PlatformIO)
// =============================================================================
// HackXplore 2026 — Team Be Tree
//
// BOARD:   ESP32 WROOM (esp32dev)
// PROTOCOL: WiFi + MQTT (switch to ESP-NOW later)
//
// SENSORS:
//   DHT22     — Temperature + Humidity, one-wire on GPIO 33
//   Moisture  — Capacitive soil moisture, analog on GPIO 34 (ADC1)
//   Vibration — Digital knock/vibration sensor on GPIO 27 (pulse counter)
//
// PINOUT (see wiring.md):
//   GPIO 33 → DHT22 DATA (4.7kΩ pull-up to 3.3V)
//   GPIO 34 → Moisture SIG (ADC)
//   GPIO 27 → Vibration DO (digital output, LOW = triggered)
//

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ── PIN ASSIGNMENTS ────────────────────────────────────────────
#define MOISTURE_PIN  34   // ADC1 — capacitive soil moisture
#define DHT_PIN       33   // DHT22 one-wire
#define DHT_TYPE      DHT22
#define VIBE_PIN      27   // Digital vibration sensor (LOW when triggered)

// ── NETWORK (change on-site) ────────────────────────────────────
#define WIFI_SSID     "HackXplore"
#define WIFI_PASS     "password"

// MQTT: point at your laptop running the FastAPI backend
#define MQTT_SERVER   "192.168.1.100"
#define MQTT_PORT     1883
#define DEVICE_EUI    "tree-01"           // unique per sensor box
#define MQTT_TOPIC    "vega/sensors/ingest"

// ── VIBRATION / FOOTSTEP DETECTION ──────────────────────────────
// Digital vibration sensor: normally HIGH, pulses LOW on vibration.
// We count rising edges with a cooldown to avoid double-counting
// a single impact. Tune THRESHOLD and COOLDOWN on-site.
#define FS_THRESHOLD_MS   50     // pulse must be this long to count
#define FS_COOLDOWN_MS    400    // minimum gap between footsteps

// ── TELEMETRY ───────────────────────────────────────────────────
#define SEND_INTERVAL_MS 15000  // 15 seconds

// ── GLOBALS ─────────────────────────────────────────────────────
WiFiClient   wifi;
PubSubClient mqtt(wifi);
DHT dht(DHT_PIN, DHT_TYPE);

// Vibration state
volatile bool vibe_triggered = false;  // set by ISR
int           fs_count       = 0;      // accumulated footsteps
unsigned long fs_last_edge   = 0;      // rising-edge timestamp
unsigned long fs_pulse_start = 0;      // LOW→HIGH timing

unsigned long last_send = 0;

// ── INTERRUPT HANDLER ─────────────────────────────────────────
// Fires on BOTH edges. We measure pulse width manually.
void IRAM_ATTR vibe_isr() {
    vibe_triggered = true;  // non-blocking — main loop handles logic
}

// ── SETUP ─────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // --- WiFi ---
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println(" WiFi OK");

    // --- MQTT ---
    mqtt.setServer(MQTT_SERVER, MQTT_PORT);

    // --- Moisture sensor ---
    pinMode(MOISTURE_PIN, INPUT);
    analogSetAttenuation(ADC_11db);  // full 0-3.3V range

    // --- DHT22 ---
    dht.begin();

    // --- Vibration sensor ---
    pinMode(VIBE_PIN, INPUT_PULLUP);  // sensor pulls LOW on knock
    attachInterrupt(digitalPinToInterrupt(VIBE_PIN), vibe_isr, CHANGE);

    Serial.println("Wurzelwerk sensor online (vibe edition).");
}

// ── LOOP ──────────────────────────────────────────────────────
void loop() {
    mqtt.loop();

    // Process vibration events outside ISR
    if (vibe_triggered) {
        vibe_triggered = false;
        process_vibration();
    }

    // Send telemetry every SEND_INTERVAL_MS
    if (millis() - last_send >= SEND_INTERVAL_MS) {
        send_telemetry();
        last_send = millis();
    }
}

// ── VIBRATION PROCESSING ──────────────────────────────────────
// Called from loop() when the ISR has fired.
// Measures pulse width: a valid footstep is a LOW pulse longer
// than FS_THRESHOLD_MS, with FS_COOLDOWN_MS spacing.
void process_vibration() {
    int state = digitalRead(VIBE_PIN);
    unsigned long now = millis();

    if (state == LOW) {
        // Sensor triggered — start timing the pulse
        fs_pulse_start = now;
    } else {
        // Rising edge — pulse ended. Check if long enough.
        if (fs_pulse_start > 0) {
            unsigned long pulse_width = now - fs_pulse_start;
            fs_pulse_start = 0;

            if (pulse_width >= FS_THRESHOLD_MS
                && (now - fs_last_edge) >= FS_COOLDOWN_MS) {
                fs_count++;
                fs_last_edge = now;
            }
        }
    }
}

// ── TELEMETRY SEND ────────────────────────────────────────────
void send_telemetry() {
    if (!mqtt.connected()) {
        mqtt_connect();
    }

    // --- DHT22 ---
    float temp   = dht.readTemperature();     // C
    float humid  = dht.readHumidity();        // %RH
    if (isnan(temp))  temp  = -99.0f;
    if (isnan(humid)) humid = -1.0f;

    // --- Moisture ---
    int raw_moisture  = analogRead(MOISTURE_PIN);
    int moisture_pct  = map(raw_moisture, 4095, 0, 0, 100);

    // --- Battery ---
    // Placeholder. Replace with real voltage divider reading.
    float battery_v = 3.7f;

    // --- RSSI ---
    int rssi = WiFi.RSSI();  // returns int, keep as int for schema

    // --- Build JSON (matches SensorReadingCreate schema) ---
    String payload = "{";
    payload += "\"device_eui\":\"" + String(DEVICE_EUI) + "\",";
    payload += "\"moisture\":" + String(moisture_pct) + ",";
    payload += "\"temperature\":" + String(temp, 1) + ",";
    payload += "\"humidity\":" + String(humid, 1) + ",";
    payload += "\"battery_voltage\":" + String(battery_v, 2) + ",";
    payload += "\"footfall_count\":" + String(fs_count) + ",";
    payload += "\"tilt_angle\":0.0,";   // no accelerometer on vibe sensor
    payload += "\"rssi\":" + String(rssi) + ",";
    payload += "\"snr\":0.0";
    payload += "}";

    mqtt.publish(MQTT_TOPIC, payload.c_str());

    Serial.println("Sent: " + payload);

    // Reset accumulator
    fs_count = 0;
}

// ── MQTT CONNECT ──────────────────────────────────────────────
void mqtt_connect() {
    while (!mqtt.connected()) {
        Serial.print("MQTT...");
        if (mqtt.connect(DEVICE_EUI)) {
            Serial.println(" connected");
        } else {
            Serial.print(" failed (rc=");
            Serial.print(mqtt.state());
            Serial.println(") retry in 2s");
            delay(2000);
        }
    }
}
