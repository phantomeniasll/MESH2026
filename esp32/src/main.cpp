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
//   GPIO 14 → DHT11 DATA
//   GPIO 34 → Moisture SIG (ADC)
//   GPIO 27 → Vibration DO
//   GPIO 32 → Microphone OUT (ADC)

#include <Arduino.h>
#include <WiFi.h>

#if defined(NODE_TYPE_FULL)
  #include <HTTPClient.h>
#endif

#if defined(NODE_TYPE_MESH) || defined(NODE_TYPE_FULL)
  #include <esp_now.h>
#endif

#include "sensors.h"

// ── NETWORK CONFIG ──────────────────────────────────────────────
#define WIFI_SSID     "phantom"
#define WIFI_PASS     "12345678"

// FastAPI backend
#define API_HOST      "mountains-tabs-lyrics-roads.trycloudflare.com"
#define API_PATH      "/api/sensors/ingest"
#define API_KEY       "jierpjijdklghweiorjnv25234mnqwkehijgsd"

// ── NODE IDENTITY ───────────────────────────────────────────────
// Provision DEVICE_EUI and TREE_ID per physical box (flash once).
#ifdef NODE_TYPE_MESH
  #define DEVICE_EUI   "tree-mesh-01"      // change per sensor box
#else
  #define DEVICE_EUI   "tree-gateway-01"   // the full node / bridge
#endif
#define TREE_ID        "KA-00001"          // KA-##### tree this sensor monitors

// ── ESP-NOW PEER (mesh → gateway MAC) ───────────────────────────
// Both nodes use a fixed locally-administered MAC so the mesh node
// always knows the gateway address — no need to flash one first.
// Prefix 0x02 = locally-administered (won't collide with real hw).
#ifdef NODE_TYPE_FULL
  static const uint8_t GATEWAY_MAC[] = {0x02, 0x00, 0x00, 0x00, 0x00, 0x01};
#endif
#ifdef NODE_TYPE_MESH
  static const uint8_t GATEWAY_MAC[] = {0x02, 0x00, 0x00, 0x00, 0x00, 0x01};
  static const uint8_t ESP_NOW_CHANNEL = 1;
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
  #define SEND_INTERVAL_SEC 15
#else
  // Full node: send every N milliseconds (always awake).
  #define SEND_INTERVAL_MS  1000
#endif

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

    // Set base MAC to our known address so the mesh node can find us.
    // Must be called BEFORE WiFi.begin().
    esp_base_mac_addr_set(GATEWAY_MAC);

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

    Serial.println("Wurzelwerk FULL NODE online.");
    Serial.print("Target: http://");
    Serial.print(API_HOST);
    Serial.println(API_PATH);
}

// ── Loop ───────────────────────────────────────────────────────
unsigned long last_own_send = 0;

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
}

#endif // NODE_TYPE_FULL

// ═══════════════════════════════════════════════════════════════
//  MESH NODE — Low-power ESP-NOW sender + deep sleep
// ═══════════════════════════════════════════════════════════════
#ifdef NODE_TYPE_MESH

// ── ESP-NOW send status callback ────────────────────────────────
static void on_espnow_sent(const uint8_t *mac, esp_now_send_status_t status) {
    Serial.print("[esp-now] Send ");
    Serial.println(status == ESP_NOW_SEND_SUCCESS ? "OK" : "FAIL");
}

// ── Setup ──────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // ── Radio init (STA mode, connect to learn channel) ──────────
    WiFi.mode(WIFI_STA);
    
    // Connect to the same AP as the gateway so ESP-NOW channel matches.
    // Phone hotspot = we control the channel. No scan needed — just connect.
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long wifi_start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - wifi_start < 8000) {
        delay(200);
        Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("\n[mesh] WiFi OK, channel ");
        Serial.println(WiFi.channel());
        // Radio is now on the AP's channel. ESP-NOW will use this.
    } else {
        Serial.println("\n[mesh] WiFi FAILED — will try ESP-NOW on default.");
    }
    
    // Disconnect from WiFi to save power — the radio stays on this channel
    // and ESP-NOW can use it without a WiFi connection.
    WiFi.disconnect(true);
    delay(50);

    // --- ESP-NOW init ---
    if (esp_now_init() != ESP_OK) {
        Serial.println("[esp-now] Init FAILED — rebooting...");
        delay(1000);
        ESP.restart();
    }
    esp_now_register_send_cb(on_espnow_sent);

    // --- Register the gateway peer ---
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, GATEWAY_MAC, 6);
    peer.channel = 0;   // 0 = use current WiFi channel (matches hotspot)
    peer.encrypt = false;

    if (esp_now_add_peer(&peer) != ESP_OK) {
        Serial.println("[esp-now] Peer add FAILED — may already exist.");
        // Not fatal: if the peer was added in a previous wake cycle
        // (deep sleep preserved it? No — deep sleep resets RAM.
        // But esp_now_add_peer might fail if it's already registered
        // in the same boot cycle. On first boot after flash, it
        // should succeed.)
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

        // Send over ESP-NOW
        esp_err_t result = esp_now_send(GATEWAY_MAC, (uint8_t*)json, n);
        if (result == ESP_OK) {
            Serial.println("[esp-now] Packet queued.");
        } else {
            Serial.print("[esp-now] Send FAILED: ");
            Serial.println(esp_err_to_name(result));
        }

        // Give the radio time to transmit before deep sleep cuts power.
        delay(100);
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
