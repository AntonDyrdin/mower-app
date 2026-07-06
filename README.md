# Mower App — Android UI для робота-газонокосилки

HTML/JS UI вынесен из прошивки ESP32 в это приложение.
ESP32 больше не хранит INDEX_HTML — только WebSocket и HTTP /update для OTA.

## Требования
- Node.js 18+
- Android Studio
- Java 17+

## Быстрый старт

```bash
npm install
npx cap add android
mkdir -p android/app/src/main/res/xml
cp android-config/network_security_config.xml android/app/src/main/res/xml/
npm run sync
npm run open
```

## В Android Studio (один раз)

В android/app/src/main/AndroidManifest.xml добавить в тег <application>:
  android:networkSecurityConfig="@xml/network_security_config"

## Изменения в прошивке ESP32

1. Удалить INDEX_HTML из web_ui.h
2. Удалить server.on("/", handleRoot)
3. Добавить OTA эндпоинт:

```cpp
#include <Update.h>

void handleOTADone() {
  server.send(200, "text/plain", Update.hasError() ? "FAIL" : "OK");
  delay(100);
  ESP.restart();
}

void handleOTAUpload() {
  HTTPUpload& upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    Update.begin(UPDATE_SIZE_UNKNOWN);
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    Update.write(upload.buf, upload.currentSize);
    size_t done = Update.progress();
    size_t total = Update.size();
    if (total > 0) {
      int pct = 50 + (done * 50) / total;
      webSocket.broadcastTXT("OTA:" + String(pct));
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    Update.end(true);
  }
}

// В setup():
server.on("/update", HTTP_POST, handleOTADone, handleOTAUpload);
```

## Архитектура

```
Android App (WebView)
  └── src/index.html
        ├── WebSocket  ws://192.168.4.1:81/     (управление + телеметрия)
        └── HTTP POST  http://192.168.4.1/update (OTA .bin файл)

ESP32 (AP mode: mower_ap)
  ├── WebSocket :81   — S:..., L:..., OTA:nn
  ├── HTTP /update    — принимает .bin
  └── HTTP /ping      — healthcheck
```

## Протокол WebSocket

ESP→App:  L:текст           лог
ESP→App:  S:vals:peaks:...  телеметрия (формат без изменений)
ESP→App:  OTA:42            прогресс флэша (%)
App→ESP:  l:1.0:r:0.5       моторы
App→ESP:  stop / speed:180 / scythe_on / scythe_off / task:mowing

## Разработка без телефона

Открыть src/index.html в браузере. WebSocket будет падать — это нормально.
