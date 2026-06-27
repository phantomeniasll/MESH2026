// =============================================================================
// Wurzelwerk — ESP32 Tree Sensor Firmware (PlatformIO)
// =============================================================================
// HackXplore 2026 — Team Be Tree
//
// BOARD:   ESP32 WROOM (esp32dev)
// PROTOCOL: WiFi → HTTP POST to FastAPI backend
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
#include <HTTPClient.h>
#include <DHT.h>

// ── PIN ASSIGNMENTS ────────────────────────────────────────────
#define MOISTURE_PIN  34   // ADC1 — capacitive soil moisture
#define DHT_PIN       33   // DHT22 one-wire
#define DHT_TYPE      DHT22
#define VIBE_PIN      27   // Digital vibration sensor (LOW when triggered)

// ── NETWORK (change on-site) ────────────────────────────────────
#define WIFI_SSID     "HackXplore"
#define WIFI_PASS     "password"

// FastAPI backend — your laptop IP running: uvicorn vega.main:app
#define API_HOST      "192.168.1.100"
#define API_PORT      8000
#define API_PATH      "/api/sensors/ingest"
#define DEVICE_EUI    "tree-01"           // unique per sensor box

// ── VIBRATION / FOOTSTEP DETECTION ──────────────────────────────
#define FS_THRESHOLD_MS   50     // pulse must be this long to count
#define FS_COOLDOWN_MS    400    // minimum gap between footsteps

// ── TELEMETRY ───────────────────────────────────────────────────
#define SEND_INTERVAL_MS 15000  // 15 seconds

// ── GLOBALS ─────────────────────────────────────────────────────
WiFiClient client;
DHT dht(DHT_PIN, DHT_TYPE);

// Vibration state
volatile bool vibe_triggered = false;
int           fs_count       = 0;
unsigned long fs_last_edge   = 0;
unsigned long fs_pulse_start = 0;

unsigned long last_send = 0;

// ── INTERRUPT HANDLER ─────────────────────────────────────────
void IRAM_ATTR vibe_isr() {
    vibe_triggered = true;
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
    Serial.print("\nWiFi OK  IP: ");
    Serial.println(WiFi.localIP());

    // --- Moisture sensor ---
    pinMode(MOISTURE_PIN, INPUT);
    analogSetAttenuation(ADC_11db);

    // --- DHT22 ---
    dht.begin();

    // --- Vibration sensor ---
    pinMode(VIBE_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(VIBE_PIN), vibe_isr, CHANGE);

    Serial.print("Target: http://");
    Serial.print(API_HOST);
    Serial.print(":");
    Serial.print(API_PORT);
    Serial.println(API_PATH);
    Serial.println("Wurzelwerk sensor online (HTTP edition).");
}

// ── LOOP ──────────────────────────────────────────────────────
void loop() {
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
void process_vibration() {
    int state = digitalRead(VIBE_PIN);
    unsigned long now = millis();

    if (state == LOW) {
        fs_pulse_start = now;
    } else {
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
    // --- DHT22 ---
    float temp  = dht.readTemperature();
    float humid = dht.readHumidity();
    if (isnan(temp))  temp  = -99.0f;
    if (isnan(humid)) humid = -1.0f;

    // --- Moisture ---
    int raw_moisture = analogRead(MOISTURE_PIN);
    int moisture_pct = map(raw_moisture, 4095, 0, 0, 100);

    // --- Battery ---
    float battery_v = 3.7f;

    // --- RSSI ---
    int rssi = WiFi.RSSI();

    // --- Build JSON ---
    String json = "{";
    json += "\"device_eui\":\"" + String(DEVICE_EUI) + "\",";
    json += "\"moisture\":" + String(moisture_pct) + ",";
    json += "\"temperature\":" + String(temp, 1) + ",";
    json += "\"humidity\":" + String(humid, 1) + ",";
    json += "\"battery_voltage\":" + String(battery_v, 2) + ",";
    json += "\"footfall_count\":" + String(fs_count) + ",";
    json += "\"tilt_angle\":0.0,";
    json += "\"rssi\":" + String(rssi) + ",";
    json += "\"snr\":0.0";
    json += "}";

    // --- HTTP POST ---
    HTTPClient http;
    String url = "http://" + String(API_HOST) + ":" + String(API_PORT) + String(API_PATH);
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");

    int status = http.POST(json);

    Serial.print("[");
    Serial.print(millis());
    Serial.print("] POST → ");
    Serial.print(status);
    Serial.print("  ");
    if (status == 201) {
        Serial.println("OK");
    } else {
        Serial.print("FAIL  body: ");
        Serial.println(http.getString());
    }

    http.end();

    fs_count = 0;
}
