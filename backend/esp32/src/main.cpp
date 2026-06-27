// =============================================================================
// Wurzelwerk — ESP32 Firmware (dual-node architecture)
// =============================================================================
// HackXplore 2026 — Team Be Tree
//
// BUILD:  platformio run -e mesh_node   (low-power, ESP-NOW sender)
//         platformio run -e full_node   (always-on, WiFi↔ESP-NOW bridge)
//
// BOARD:  ESP32 WROOM (esp32dev)
// RADIO:  Both node types share the same ESP-NOW protocol.
//         Mesh nodes send sensor JSON over ESP-NOW to the full node.
//         The full node forwards everything via HTTP to the FastAPI backend.
//
// SENSORS: See sensors.h — each node declares which sensors it has via
//          SensorConfig. Missing sensors are omitted from the JSON payload.
//          The backend schema accepts nulls for all fields.
//
// PINOUT (see wiring.md):
//   GPIO 14 → DHT11 DATA  Lila
//   GPIO 34 → Moisture SIG (ADC)  Yellow
//   GPIO 27 → Vibration DO  Green
//   GPIO 32 → Microphone OUT (ADC) Blue

#include <Arduino.h>
#include <WiFi.h>

#if defined(NODE_TYPE_FULL)
  #include <HTTPClient.h>
#endif

#if defined(NODE_TYPE_MESH) || defined(NODE_TYPE_FULL)
  #include <esp_now.h>
  #include <esp_wifi.h>
#endif

#include "sensors.h"

// ── NETWORK CONFIG ──────────────────────────────────────────────
#define WIFI_SSID     "phantom"
#define WIFI_PASS     "12345678"

// FastAPI backend
#define API_HOST      "api.betree.me"
#define API_PATH      "/api/sensors/ingest"
#define API_KEY       "jierpjijdklghweiorjnv25234mnqwkehijgsd"

// ── NODE IDENTITY ───────────────────────────────────────────────
// Provision DEVICE_EUI and TREE_ID per physical box (flash once).
#ifdef NODE_TYPE_MESH
  #define DEVICE_EUI   "tree-mesh-02"      // change per sensor box
  #define TREE_ID      "KA-00002"          // tree this sensor monitors
#else
  #define DEVICE_EUI   "tree-gateway-01"   // the full node / bridge
  #define TREE_ID      "KA-00001"          // tree the gateway monitors
#endif

// ── ESP-NOW PEER (mesh → gateway MAC) ───────────────────────────
// Both nodes use a fixed locally-administered MAC so the mesh node
// always knows the gateway address — no need to flash one first.
// Prefix 0x02 = locally-administered (won't collide with real hw).
#ifdef NODE_TYPE_FULL
  static const uint8_t GATEWAY_MAC[] = {0x02, 0x00, 0x00, 0x00, 0x00, 0x01};
#endif
#ifdef NODE_TYPE_MESH
  static const uint8_t GATEWAY_MAC[] = {0x02, 0x00, 0x00, 0x00, 0x00, 0x01};
#endif

// ── SENSOR CONFIG (per node type) ───────────────────────────────
// Mesh nodes may have fewer sensors to save power / BOM cost.
// Set flags false for sensors NOT physically connected.

#ifdef NODE_TYPE_MESH
  // Low-power mesh node: moisture + vibration + fake battery
  // (no DHT, no mic — saves power and BOM cost)
  // Battery voltage is hardcoded for demo; production uses ADC divider.
  static const SensorConfig SENSOR_CFG = {
      .has_dht       = false,
      .has_moisture  = true,
      .has_vibration = true,
      .has_mic       = false,
      .has_battery   = true,
  };
#else
  // Full node: all sensors (mains powered, no power constraint)
  static const SensorConfig SENSOR_CFG = {
      .has_dht       = true,
      .has_moisture  = true,
      .has_vibration = true,
      .has_mic       = true,
      .has_battery   = false,
  };
#endif

// ── TELEMETRY INTERVAL ──────────────────────────────────────────
#ifdef NODE_TYPE_MESH
  // Deep-sleep wake interval in seconds.
  // Shorter for demo; production: 60–900 seconds.
  #define SEND_INTERVAL_SEC 1   // TODO: bump back to 15–900 for production
#else
  // Full node: send every N milliseconds (always awake).
  #define SEND_INTERVAL_MS  1000
#endif

// ── RGB LED pins (shared by both node types) ────────────────────
#define LED_R        5
#define LED_G        13

// ═══════════════════════════════════════════════════════════════
//  FULL NODE — Gateway (ESP-NOW receiver + WiFi HTTP forwarder)
// ═══════════════════════════════════════════════════════════════
#ifdef NODE_TYPE_FULL

WiFiClient tcp_client;

// ── ESP-NOW receive buffer ──────────────────────────────────────
// HTTP POST must NOT be called from the ESP-NOW callback (it runs
// in the WiFi task). Instead, we buffer received packets and post
// them from loop().
static volatile bool   rx_pending = false;
static          uint8_t rx_data[256];
static          int     rx_len    = 0;
static          uint8_t rx_sender[6];

// Forward declarations
void forward_packet(const uint8_t* data, int len);

// ── ESP-NOW receive callback ────────────────────────────────────
static void on_espnow_recv(const uint8_t *mac, const uint8_t *data, int len) {
    // Don't do HTTP here — just copy to buffer, flag, and return.
    if (len > (int)sizeof(rx_data)) len = sizeof(rx_data);
    memcpy((void*)rx_data, data, len);
    memcpy((void*)rx_sender, mac, 6);
    rx_len = len;
    rx_pending = true;

    Serial.print("[esp-now] RX ");
    Serial.print(len);
    Serial.print(" bytes from ");
    for (int i = 0; i < 6; i++) {
        Serial.printf("%02X", mac[i]);
        if (i < 5) Serial.print(":");
    }
    Serial.print("  data: ");
    Serial.write(data, len);
    Serial.println();
}

// ── HTTP POST helper ────────────────────────────────────────────
bool http_post_json(const String& json) {
    HTTPClient http;
    String url = "http://" + String(API_HOST) + String(API_PATH);
    http.begin(tcp_client, url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);

    int status = http.POST(json);

    Serial.print("[http] POST → ");
    Serial.print(status);
    if (status == 201) {
        Serial.println(" OK");
    } else {
        Serial.print(" FAIL  body: ");
        Serial.println(http.getString());
    }

    http.end();
    return (status == 201);
}

// ── Forward a received ESP-NOW packet to the backend ────────────
void forward_packet(const uint8_t* data, int len) {
    // Data is already JSON from the mesh node — forward as-is.
    // Null-terminate for HTTPClient.
    char json[256];
    int copy_len = (len < (int)sizeof(json) - 1) ? len : (int)sizeof(json) - 1;
    memcpy(json, data, copy_len);
    json[copy_len] = '\0';

    http_post_json(String(json));
}

// ── Read own sensors and send ──────────────────────────────────
void send_own_telemetry(int rssi) {
    SensorReadings r;
    read_sensors(SENSOR_CFG, r);

    // ── RGB LED: moisture indicator ────────────────────────────
    analogWrite(LED_R, 0);
    analogWrite(LED_G, 0);
    if (r.moisture_pct < 30) {
        analogWrite(LED_R, 255);
        Serial.print("[led] moisture=");
        Serial.print(r.moisture_pct);
        Serial.println("% → RED");
    } else if (r.moisture_pct < 60) {
        analogWrite(LED_R, 255);
        analogWrite(LED_G, 10);    // red LED is dimmer — keep green barely on
        Serial.print("[led] moisture=");
        Serial.print(r.moisture_pct);
        Serial.println("% → YELLOW");
    } else {
        analogWrite(LED_G, 255);
        Serial.print("[led] moisture=");
        Serial.print(r.moisture_pct);
        Serial.println("% → GREEN");
    }

    char json[256];
    int n = build_json(SENSOR_CFG, r, DEVICE_EUI, TREE_ID,
                       rssi, 0.0f,   // full node has no ESP-NOW SNR
                       json, sizeof(json));
    if (n < 0) {
        Serial.println("[full] JSON overflow!");
        return;
    }

    Serial.println("───── FULL NODE TELEMETRY ─────");
    Serial.println(json);
    Serial.println("────────────────────────────────");

    http_post_json(String(json));
    reset_footfall();
}

// ── Setup ──────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // --- Radio (STA mode required for both WiFi and ESP-NOW) ---
    WiFi.mode(WIFI_STA);

    // Override STA MAC so mesh nodes have a fixed address to target.
    // Must be called after WiFi.mode() but before WiFi.begin().
    esp_wifi_set_mac(WIFI_IF_STA, GATEWAY_MAC);

    // --- WiFi connect ---
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.print("\nWiFi OK  IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC: ");
    Serial.println(WiFi.macAddress());
    Serial.print("Channel: ");
    Serial.println(WiFi.channel());

    // --- Internet check ---
    {
        HTTPClient ping;
        ping.begin(tcp_client, "http://www.google.com");
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

    // --- ESP-NOW init (receiver mode) ---
    if (esp_now_init() != ESP_OK) {
        Serial.println("[esp-now] Init FAILED — rebooting...");
        delay(1000);
        ESP.restart();
    }
    esp_now_register_recv_cb(on_espnow_recv);
    Serial.println("[esp-now] Receiver ready.");

    // --- Sensors ---
    sensors_init(SENSOR_CFG);

    // --- RGB LED ---
    pinMode(LED_R, OUTPUT);
    pinMode(LED_G, OUTPUT);
    analogWrite(LED_R, 255); analogWrite(LED_G, 255);
    delay(150);
    analogWrite(LED_R, 0);   analogWrite(LED_G, 0);

    Serial.println("Wurzelwerk FULL NODE online.");
    Serial.print("Target: http://");
    Serial.print(API_HOST);
    Serial.println(API_PATH);
}

// ── Loop ───────────────────────────────────────────────────────
unsigned long last_own_send = 0;
unsigned long last_heartbeat = 0;

void loop() {
    // --- Forward received ESP-NOW packets ---
    if (rx_pending) {
        noInterrupts();
        bool pending = rx_pending;
        interrupts();

        if (pending) {
            forward_packet(rx_data, rx_len);
            rx_pending = false;
        }
    }

    // --- Send own sensor data on interval ---
    if (millis() - last_own_send >= SEND_INTERVAL_MS) {
        int rssi = WiFi.RSSI();
        send_own_telemetry(rssi);
        last_own_send = millis();
    }

    // --- Periodic heartbeat ---
    if (millis() - last_heartbeat >= 30000) {
        Serial.print("[full] Heartbeat — channel=");
        Serial.print(WiFi.channel());
        Serial.print("  RSSI=");
        Serial.print(WiFi.RSSI());
        Serial.print("  free_heap=");
        Serial.println(ESP.getFreeHeap());
        last_heartbeat = millis();
    }
}

#endif // NODE_TYPE_FULL

// ═══════════════════════════════════════════════════════════════
//  MESH NODE — Low-power ESP-NOW sender + deep sleep
// ═══════════════════════════════════════════════════════════════
#ifdef NODE_TYPE_MESH

// ── ESP-NOW send status callback ────────────────────────────────
static void on_espnow_sent(const uint8_t *mac, esp_now_send_status_t status) {
    // ESP_NOW has no guaranteed delivery. Status is best-effort.
    // A packet can arrive even when the TX callback reports failure
    // (known ESP32 IDF quirk with locally-administered MACs).
    Serial.print("[esp-now] TX done (status=");
    Serial.print(status);
    Serial.print(") → ");
    Serial.println(status == ESP_NOW_SEND_SUCCESS
        ? "ACK received"
        : "no ACK (packet may still have arrived)");
}

// ── Setup ──────────────────────────────────────────────────────
void setup() {
    // ── Bare-metal LED blink test (before ANY other init) ─────
    pinMode(LED_R, OUTPUT);
    pinMode(LED_G, OUTPUT);
    for (int i = 0; i < 3; i++) {
        analogWrite(LED_R, 255); delay(200);
        analogWrite(LED_R, 0);
        analogWrite(LED_G, 255); delay(200);
        analogWrite(LED_G, 0);
    }

    Serial.begin(115200);
    Serial.println("[led] Blink test done — if no light, check wiring.");

    // ── Radio init: scan for AP channel without connecting ──────
    // We don't need WiFi connectivity — just need the radio on the
    // same channel as the gateway so ESP-NOW packets align.
    WiFi.mode(WIFI_STA);

    int ap_channel = -1;
    WiFi.disconnect();             // ensure clean scan state
    delay(50);

    int net_count = WiFi.scanNetworks(false, false);  // passive scan, no hidden SSIDs
    for (int i = 0; i < net_count; i++) {
        if (WiFi.SSID(i) == String(WIFI_SSID)) {
            ap_channel = WiFi.channel(i);
            break;
        }
    }
    WiFi.scanDelete();

    if (ap_channel <= 0) {
        ap_channel = 1;  // last resort
        Serial.println("[mesh] AP not found in scan — using channel 1.");
    }

    esp_wifi_set_channel(ap_channel, WIFI_SECOND_CHAN_NONE);
    delay(50);  // let the radio settle on the new channel

    // Disable WiFi power saving — critical for ESP-NOW TX reliability.
    esp_wifi_set_ps(WIFI_PS_NONE);

    Serial.print("[mesh] Radio set to channel ");
    Serial.println(ap_channel);

    // --- ESP-NOW init ---
    if (esp_now_init() != ESP_OK) {
        Serial.println("[esp-now] Init FAILED — rebooting...");
        delay(1000);
        ESP.restart();
    }
    esp_now_register_send_cb(on_espnow_sent);
    Serial.println("[esp-now] Init OK, send callback registered.");

    // --- Register the gateway peer ---
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, GATEWAY_MAC, 6);
    peer.channel = (uint8_t)ap_channel;
    peer.encrypt = false;
    Serial.print("[esp-now] Registering peer on channel ");
    Serial.println(ap_channel);

    esp_err_t peer_err = esp_now_add_peer(&peer);
    Serial.print("[esp-now] add_peer result: ");
    Serial.println(esp_err_to_name(peer_err));
    if (peer_err == ESP_ERR_ESPNOW_EXIST) {
        Serial.println("[esp-now] Peer already exists (this is OK).");
    }

    Serial.print("[esp-now] Gateway peer: ");
    for (int i = 0; i < 6; i++) {
        Serial.printf("%02X", GATEWAY_MAC[i]);
        if (i < 5) Serial.print(":");
    }
    Serial.println();

    // --- Sensor init (only the ones we have) ---
    sensors_init(SENSOR_CFG);

    Serial.println("[mesh] Wurzelwerk MESH NODE online.");

    // --- Read sensors, build JSON, send, sleep ---
    SensorReadings r;
    r.battery_v = 3.7f;   // fake for demo; production uses ADC voltage divider
    read_sensors(SENSOR_CFG, r);

    Serial.print("[sensor] moisture_raw=");
    Serial.print(r.moisture_raw);
    Serial.print(" → moisture_pct=");
    Serial.println(r.moisture_pct);

    // ── RGB LED: moisture indicator ────────────────────────────
    analogWrite(LED_R, 0);
    analogWrite(LED_G, 0);
    if (r.moisture_pct < 30) {
        analogWrite(LED_R, 255);   // Red — critical, too dry
    } else if (r.moisture_pct < 60) {
        analogWrite(LED_R, 255);   // Yellow
        analogWrite(LED_G, 10);    // red LED is dimmer — keep green barely on
    } else {
        analogWrite(LED_G, 255);   // Green — healthy moisture
    }
    Serial.print("[led] moisture=");
    Serial.print(r.moisture_pct);
    Serial.print("% → ");
    Serial.println(r.moisture_pct < 30 ? "RED" : r.moisture_pct < 60 ? "YELLOW" : "GREEN");

    char json[256];
    int n = build_json(SENSOR_CFG, r, DEVICE_EUI, TREE_ID,
                       0, 0.0f,   // mesh node: RSSI/SNR not meaningful
                       json, sizeof(json));
    if (n < 0) {
        Serial.println("[mesh] JSON overflow — payload too large!");
        // Still go to sleep — nothing we can do.
    } else {
        Serial.println("───── MESH NODE TELEMETRY ─────");
        Serial.println(json);
        Serial.println("────────────────────────────────");

        // Check radio state before sending
        Serial.print("[esp-now] Pre-send check — WiFi.status=");
        Serial.print(WiFi.status());
        Serial.print("  channel=");
        Serial.print(WiFi.channel());
        Serial.print("  payload_len=");
        Serial.println(n);

        // Send over ESP-NOW
        esp_err_t result = esp_now_send(GATEWAY_MAC, (uint8_t*)json, n);
        Serial.print("[esp-now] esp_now_send returned: ");
        Serial.print(esp_err_to_name(result));
        Serial.print(" (");
        Serial.print(result);
        Serial.println(")");
        if (result == ESP_OK) {
            Serial.println("[esp-now] Packet queued — waiting for TX callback...");
        } else {
            Serial.println("[esp-now] Send FAILED at queue stage!");
        }

        // Give the radio time to transmit before deep sleep kills it.
        // esp_now_send is async — the TX callback fires asynchronously.
        Serial.println("[esp-now] Waiting 200ms for TX to complete...");
        delay(200);
    }

    reset_footfall();

    // --- Deep sleep ---
    Serial.print("[mesh] Sleeping for ");
    Serial.print(SEND_INTERVAL_SEC);
    Serial.println(" seconds...\n");
    Serial.flush();

    esp_sleep_enable_timer_wakeup(SEND_INTERVAL_SEC * 1000000ULL);
    esp_deep_sleep_start();

    // Execution never reaches here — the chip resets on wake.
}

// ── Loop (unused — deep sleep resets the chip each cycle) ──────
void loop() {
    // Never reached. All work happens in setup() before deep sleep.
}

#endif // NODE_TYPE_MESH

// ═══════════════════════════════════════════════════════════════
//  FALLBACK — neither flag set (legacy single-file build)
// ═══════════════════════════════════════════════════════════════
#if !defined(NODE_TYPE_MESH) && !defined(NODE_TYPE_FULL)
  #error "Define NODE_TYPE_MESH or NODE_TYPE_FULL via build_flags in platformio.ini"
#endif
