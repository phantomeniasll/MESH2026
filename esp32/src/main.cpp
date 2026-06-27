// =============================================================================
// Wurzelwerk — ESP32 Tree Sensor Firmware (PlatformIO)
// =============================================================================
// HackXplore 2026 — Team Be Tree
//
// BOARD:   ESP32 WROOM (esp32dev)
// PROTOCOL: WiFi → HTTP POST to FastAPI backend
//
// SENSORS:
//   DHT11     — Temperature + Humidity, one-wire on GPIO 14
//   Moisture  — Capacitive soil moisture, analog on GPIO 34 (ADC1)
//   Vibration — Digital sensor on GPIO 27 (counts every falling edge)
//   Microphone — Analog electret mic (MAX4466/MAX9814) on GPIO 32, ADC1
//
// PINOUT (see wiring.md):
//   GPIO 14 → DHT11 DATA (integrated pull-up on module)
//   GPIO 34 → Moisture SIG (ADC)
//   GPIO 27 → Vibration DO (digital output, LOW = triggered)
//   GPIO 32 → Microphone OUT (analog, ADC1_CH4)
//

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <soc/sens_reg.h>       // REG_SET_FIELD, SENS_SAR1_SAMPLE_CYCLE
#include <driver/rtc_io.h>      // rtc_gpio_pulldown_en (RTC-domain, survives ADC init)

// ── PIN ASSIGNMENTS ────────────────────────────────────────────
#define MOISTURE_PIN  34   // ADC1 — capacitive soil moisture
#define DHT_PIN       14   // DHT11 one-wire
#define DHT_TYPE      DHT11
#define VIBE_PIN      27   // Digital vibration sensor (LOW when triggered)
#define MIC_PIN       32   // Analog electret microphone (ADC1_CH4)
#define MIC_SAMPLE_MS 500  // Averaging window for sound level

// ── NETWORK (change on-site) ────────────────────────────────────
#define WIFI_SSID     "phantom"
#define WIFI_PASS     "12345678"

// FastAPI backend — your laptop IP running: uvicorn vega.main:app
#define API_HOST      "mountains-tabs-lyrics-roads.trycloudflare.com"
#define API_PATH      "/api/sensors/ingest"
#define API_KEY       "jierpjijdklghweiorjnv25234mnqwkehijgsd"  // must match VEGA_API_KEY on server
#define DEVICE_EUI    "tree-01"           // unique per sensor box

// ── TELEMETRY ───────────────────────────────────────────────────
#define SEND_INTERVAL_MS 1000  // 15 seconds

// ── GLOBALS ─────────────────────────────────────────────────────
WiFiClient client;
DHT dht(DHT_PIN, DHT_TYPE);

// Vibration state (volatile — incremented from ISR)
volatile int fs_count = 0;

unsigned long last_send = 0;

// ── INTERRUPT HANDLER ─────────────────────────────────────────
void IRAM_ATTR vibe_isr() {
    fs_count++;
}

// ── FORWARD DECLARATIONS ──────────────────────────────────────
void send_telemetry();

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

    // --- Internet connectivity check (ping Google) ---
    {
        HTTPClient ping;
        ping.begin(client, "http://www.google.com");
        ping.setTimeout(5000);
        int pingStatus = ping.GET();
        Serial.print("Ping google.com → ");
        Serial.print(pingStatus);
        if (pingStatus > 0) {
            Serial.println("  Internet OK");
        } else {
            Serial.print("  FAIL: ");
            Serial.println(ping.errorToString(pingStatus));
        }
        ping.end();
    }

    // --- Moisture sensor ---
    pinMode(MOISTURE_PIN, INPUT);
    analogSetAttenuation(ADC_11db);

    // --- DHT11 ---
    dht.begin();

    // --- Microphone (analog) ---
    // GPIO 32 = ADC1_CH4.
    //
    // KY-038 / LM393 module AO output is often AC-coupled with no DC bias path.
    // The ESP32 ADC then sees a floating pin that drifts to VCC via leakage.
    //
    // Step 1: configure ADC attenuation + max sampling time.
    analogSetPinAttenuation(MIC_PIN, ADC_11db);     // 0–3.9 V range
    // Max sampling time before calling analogRead():
    //   SAR1_SAMPLE_CYCLE = 0b111 = 4096 ADC clock cycles ≈ 512 μs at 8 MHz ADC clock
    REG_SET_FIELD(SENS_SAR_READ_CTRL_REG, SENS_SAR1_SAMPLE_CYCLE, 0b111);

    // Step 2: do one dummy read so the Arduino framework calls adc_gpio_init().
    //         (adc_gpio_init sets the pin to ADC mode + clears pull resistors.)
    analogRead(MIC_PIN);

    // Step 3: re-enable the internal weak pulldown (~45 kΩ) at the RTC IO level.
    //         RTC pull controls live in a separate register from the IO MUX function
    //         select, so they persist even when the pin is in ADC mode.
    rtc_gpio_pulldown_en(GPIO_NUM_32);
    rtc_gpio_pullup_dis(GPIO_NUM_32);
    delay(10);                                      // let the coupling cap settle

    // --- Vibration sensor (counts every falling edge) ---
    pinMode(VIBE_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(VIBE_PIN), vibe_isr, FALLING);

    Serial.print("Target: http://");
    Serial.print(API_HOST);
    Serial.print(":");
    Serial.println(API_PATH);
    Serial.println("Wurzelwerk sensor online (HTTP edition).");
}

// ── LOOP ──────────────────────────────────────────────────────
void loop() {
    // Send telemetry every SEND_INTERVAL_MS
    if (millis() - last_send >= SEND_INTERVAL_MS) {
        send_telemetry();
        last_send = millis();
    }
}

// ── TELEMETRY SEND ────────────────────────────────────────────
void send_telemetry() {
    // --- DHT11 ---
    dht.readTemperature();   // wake-up read (discard)
    dht.readHumidity();
    delay(250);
    float temperature = dht.readTemperature();
    float humidity    = dht.readHumidity();
    if (isnan(temperature)) temperature = -99.0f;
    if (isnan(humidity))    humidity    = -1.0f;

    // --- Moisture ---
    int raw_moisture = analogRead(MOISTURE_PIN);
    int moisture_pct = map(raw_moisture, 4095, 0, 0, 100);

    // --- Sound level (peak-to-peak over 500 ms) ---
    int   mic_min  = 4095;
    int   mic_max  = 0;
    long  mic_sum  = 0;
    int   mic_count = 0;
    unsigned long mic_start = millis();
    while (millis() - mic_start < MIC_SAMPLE_MS) {
        int val = analogRead(MIC_PIN);
        mic_sum += val;
        mic_count++;
        if (val < mic_min) mic_min = val;
        if (val > mic_max) mic_max = val;
    }
    int   mic_avg  = (mic_count > 0) ? (mic_sum / mic_count) : 0;
    int   mic_pp   = mic_max - mic_min;          // peak-to-peak (0–4095)
    int   sound_pct = map(mic_pp, 0, 1500, 0, 100); // calibrated to observed peak-peak
    if (sound_pct > 100) sound_pct = 100;
    if (sound_pct < 0)   sound_pct = 0;

    // --- Battery ---
    float battery_v = 3.7f;

    // --- RSSI ---
    int rssi = WiFi.RSSI();

    // --- Debug: print all readings ---
    Serial.println("───── TELEMETRY ─────");
    Serial.print("  DHT temp  : "); Serial.print(temperature, 1);
    Serial.print(" °C  (raw NaN? "); Serial.print(isnan(temperature) ? "YES" : "no");
    Serial.println(")");
    Serial.print("  DHT humid : "); Serial.print(humidity, 1);
    Serial.print(" %   (raw NaN? "); Serial.print(isnan(humidity) ? "YES" : "no");
    Serial.println(")");
    Serial.print("  Moisture  : raw="); Serial.print(raw_moisture);
    Serial.print("  pct="); Serial.println(moisture_pct);
    Serial.print("  Sound lvl : "); Serial.print(sound_pct);
    Serial.print(" %  (avg="); Serial.print(mic_avg);
    Serial.print(" min="); Serial.print(mic_min);
    Serial.print(" max="); Serial.print(mic_max);
    Serial.print(" count="); Serial.print(mic_count);
    Serial.println(")");
    Serial.print("  Battery   : "); Serial.print(battery_v, 2); Serial.println(" V");
    Serial.print("  Footsteps : "); Serial.println(fs_count);
    Serial.print("  RSSI      : "); Serial.print(rssi); Serial.println(" dBm");
    Serial.println("───────────────────────");

    // --- Build JSON ---
    String json = "{";
    json += "\"device_eui\":\"" + String(DEVICE_EUI) + "\",";
    json += "\"moisture\":" + String(moisture_pct) + ",";
    json += "\"temperature\":" + String(temperature, 1) + ",";
    json += "\"humidity\":" + String(humidity, 1) + ",";
    json += "\"battery_voltage\":" + String(battery_v, 2) + ",";
    json += "\"footfall_count\":" + String(fs_count) + ",";
    json += "\"tilt_angle\":0.0,";
    json += "\"sound_level\":" + String(sound_pct) + ",";
    json += "\"rssi\":" + String(rssi) + ",";
    json += "\"snr\":0.0";
    json += "}";

    // --- HTTP POST ---
    HTTPClient http;
    String url = "http://" + String(API_HOST) + String(API_PATH);
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);

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
