import { WifiConnect } from '@falconeta/capacitor-wifi-connect';
import { FilePicker }  from '@capawesome/capacitor-file-picker';

const MOWER_SSID     = 'Yozhik';
const MOWER_PASSWORD = 'yozhik-robot';
const MOWER_IP       = '192.168.4.1';

// ── WiFi: автоподключение при запуске ────────────────────────
export async function connectToMower() {
  try {
    const result = await WifiConnect.connect({
      ssid: MOWER_SSID,
      password: MOWER_PASSWORD,
      saveNetwork: false,
    });
    console.log('WiFi подключён:', result);
    return true;
  } catch (err) {
    console.error('Ошибка WiFi:', err);
    return false;
  }
}

// ── OTA: выбор .bin и прошивка через HTTP POST /update ──────
export async function flashFirmware(onProgress) {
  // 1. Выбираем файл
  const { files } = await FilePicker.pickFiles({
    types: ['application/octet-stream'],
    readData: true,   // возвращает base64 содержимое
  });

  if (!files.length) return { ok: false, reason: 'Файл не выбран' };

  const file = files[0];

  // 2. base64 → ArrayBuffer → Blob
  const binary = atob(file.data);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });

  // 3. Собираем FormData
  const form = new FormData();
  form.append('firmware', blob, file.name);

  // 4. POST с отслеживанием прогресса через XHR
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `http://${MOWER_IP}/update`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 && xhr.responseText.includes('OK')) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, reason: xhr.responseText });
      }
    };

    xhr.onerror = () => resolve({ ok: false, reason: 'Сетевая ошибка' });
    xhr.send(form);
  });
}

// ── Инициализация при старте приложения ─────────────────────
(async () => {
  // Пробуем подключиться к AP робота
  const connected = await connectToMower();

  if (!connected) {
    // Если не удалось — показываем сообщение в fallback-странице
    document.querySelector('p').textContent =
      'Не удалось подключиться к роботу. Убедитесь, что он включён.';
    return;
  }

  // Если Capacitor настроен с server.url = http://192.168.4.1 —
  // WebView сам перейдёт на UI робота. Этот JS больше не выполняется.
})();
