/* ── Конфигурация ──────────────────────────────────────────── */
const ESP_SSID = 'Yozhik';
const ESP_HOST = '192.168.4.1';
const WS_URL   = 'ws://' + ESP_HOST + ':81/';
const OTA_URL  = 'http://' + ESP_HOST + '/update';

const TAGLINES = [
  'Пытается быть полезным',
  'Шуршит в траве',
  'Распугал котов',
  'Кусается',
];

/* ── Оверлей ───────────────────────────────────────────────── */
const overlay    = document.getElementById('connect-overlay');
const connectSub = document.getElementById('connect-sub');
const retryBtn   = document.getElementById('connect-retry');
const wsDot      = document.getElementById('ws-dot');

document.getElementById('overlay-tagline').textContent =
  TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

function showOverlay(msg) {
  connectSub.textContent = msg;
  overlay.classList.remove('hidden');
  retryBtn.style.display = 'none';
}
function showRetry(msg) {
  connectSub.textContent = msg;
  overlay.classList.remove('hidden');
  retryBtn.style.display = '';
}
function hideOverlay() {
  overlay.classList.add('hidden');
}

/* ── Логи ──────────────────────────────────────────────────── */
const logList   = document.getElementById('log-list');
const pageStart = Date.now();

function logTimestamp() {
  const t = Math.floor((Date.now() - pageStart) / 1000);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function addLog(text) {
  let cls = '';
  const lo = text.toLowerCase();
  if (lo.includes('error') || lo.includes('ошибка') || lo.includes('emergency')) cls = 'error';
  else if (lo.includes('warn') || lo.includes('ota') || lo.includes('task')) cls = 'warn';

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML =
    '<span class="log-time">' + logTimestamp() + '</span>' +
    '<span class="log-text ' + cls + '">' + escapeHtml(text) + '</span>';
  logList.appendChild(entry);
  while (logList.children.length > 200) logList.removeChild(logList.firstChild);
  const atBottom = logList.scrollHeight - logList.scrollTop - logList.clientHeight < 40;
  if (atBottom) logList.scrollTop = logList.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('log-clear').addEventListener('click', () => { logList.innerHTML = ''; });

/* ── Гистограмма IMU ───────────────────────────────────────── */
const BAR_LABELS = ['aX', 'aY', 'aZ', 'gX', 'gY', 'gZ'];
const barsEl     = document.getElementById('bars');
const barFills   = [], barPeaks = [];

BAR_LABELS.forEach(lbl => {
  const col   = document.createElement('div'); col.className   = 'bar-col';
  const label = document.createElement('div'); label.className = 'bar-label'; label.textContent = lbl;
  const wrap  = document.createElement('div'); wrap.className  = 'bar-wrap';
  const fill  = document.createElement('div'); fill.className  = 'bar-fill'; fill.style.width = '0%';
  const peak  = document.createElement('div'); peak.className  = 'bar-peak'; peak.style.left  = '0%';
  wrap.appendChild(fill); wrap.appendChild(peak);
  col.appendChild(label); col.appendChild(wrap);
  barsEl.appendChild(col);
  barFills.push(fill); barPeaks.push(peak);
});

/* ── Гистограмма углов ─────────────────────────────────────── */
const ANGLE_LABELS  = ['Pitch', 'Roll', 'Pitch F', 'Roll F'];
const angleBarsEl   = document.getElementById('angle-bars');
const angleBarFills = [], angleBarPeaks = [];
const anglePeaks    = [0, 0, 0, 0];

ANGLE_LABELS.forEach(lbl => {
  const col   = document.createElement('div'); col.className   = 'bar-col';
  const label = document.createElement('div'); label.className = 'bar-label';
  label.style.width = '46px'; label.textContent = lbl;
  const wrap  = document.createElement('div'); wrap.className  = 'bar-wrap';
  const fill  = document.createElement('div'); fill.className  = 'bar-fill'; fill.style.width = '0%';
  const peak  = document.createElement('div'); peak.className  = 'bar-peak'; peak.style.left  = '0%';
  wrap.appendChild(fill); wrap.appendChild(peak);
  col.appendChild(label); col.appendChild(wrap);
  angleBarsEl.appendChild(col);
  angleBarFills.push(fill); angleBarPeaks.push(peak);
});

const angleValEls = [
  document.getElementById('angle-pitch-val'),
  document.getElementById('angle-roll-val'),
  document.getElementById('angle-fpitch-val'),
  document.getElementById('angle-froll-val'),
];

function angleColor(absVal) {
  if (absVal >= 40) return 'var(--danger)';
  if (absVal >= 30) return 'var(--warn)';
  return 'var(--text)';
}

function updateAngles(pitch, roll, fpitch, froll) {
  [pitch, roll, fpitch, froll].forEach((v, i) => {
    const absV = Math.abs(v);
    const pct  = Math.min(absV / 90, 1);
    if (pct >= anglePeaks[i]) { anglePeaks[i] = pct; }
    else { anglePeaks[i] *= 0.95; if (anglePeaks[i] < pct) anglePeaks[i] = pct; }
    const color = angleColor(absV);
    angleBarFills[i].style.width      = (pct * 100).toFixed(1) + '%';
    angleBarFills[i].style.background = color;
    angleBarPeaks[i].style.left       = (anglePeaks[i] * 100).toFixed(1) + '%';
    angleValEls[i].textContent        = (v >= 0 ? '+' : '') + v.toFixed(1) + '°';
    angleValEls[i].style.color        = color;
  });
}

function updateBars(vals, peaks) {
  for (let i = 0; i < 6; i++) {
    barFills[i].style.width      = (Math.abs(vals[i]) * 100).toFixed(1) + '%';
    barPeaks[i].style.left       = (peaks[i] * 100).toFixed(1) + '%';
    const v = Math.abs(vals[i]);
    barFills[i].style.background = v < 0.7 ? 'var(--accent)' : v < 0.9 ? 'var(--warn)' : 'var(--danger)';
  }
}

/* ── Периметр ──────────────────────────────────────────────── */
const corrLEl = document.getElementById('corr-l');
const corrREl = document.getElementById('corr-r');

function updateCorr(l, r) {
  [corrLEl, corrREl].forEach((el, i) => {
    const v = i === 0 ? l : r;
    el.textContent = (v > 0 ? '+' : '') + v;
    el.className   = 'peri-value' + (v > 0 ? ' pos' : v < 0 ? ' neg' : '');
  });
}

/* ── Строка состояния ──────────────────────────────────────── */
const statDischargeEl = document.getElementById('stat-discharge');
const statChargeEl    = document.getElementById('stat-charge');
const statVoltsEl     = document.getElementById('stat-volts');
const statPctEl       = document.getElementById('stat-pct');

const scytheCurrentEl = document.getElementById('scythe-current');

/* ── История значений (график) ────────────────────────────── */
const HISTORY_LEN = 2000;

const historyCanvas = document.getElementById('history-canvas');
const historyCtx    = historyCanvas.getContext('2d');
const historyLegend = document.getElementById('history-legend');

const historySeries = [
  { key: 'volts',     label: 'Напряж., В',   unit: 'В',  color: '#3fb950', data: [] },
  { key: 'unloaded',  label: 'Без нагр., В', unit: 'В',  color: '#79c0ff', data: [] },
  { key: 'discharge', label: 'Разряд, мА',   unit: 'мА', color: '#e3b341', data: [] },
];

function buildHistoryLegend() {
  historyLegend.innerHTML = '';
  historySeries.forEach(s => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML =
      '<span class="legend-swatch" style="background:' + s.color + '"></span>' +
      '<span id="legend-val-' + s.key + '">' + s.label + ': —</span>';
    historyLegend.appendChild(item);
  });
}
buildHistoryLegend();

function resizeHistoryCanvas() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = historyCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  historyCanvas.width  = rect.width * dpr;
  historyCanvas.height = rect.height * dpr;
  historyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => { resizeHistoryCanvas(); drawHistory(); });

function drawHistory() {
  const rect = historyCanvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  if (!w || !h) return;
  historyCtx.clearRect(0, 0, w, h);

  historyCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  historyCtx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = Math.round((h / 4) * i) + 0.5;
    historyCtx.beginPath();
    historyCtx.moveTo(0, y);
    historyCtx.lineTo(w, y);
    historyCtx.stroke();
  }

  const stepX = w / (HISTORY_LEN - 1);

  historySeries.forEach(s => {
    if (s.data.length < 2) return;
    const min   = Math.min(...s.data);
    const max   = Math.max(...s.data);
    const range = (max - min) || 1;
    const offset = HISTORY_LEN - s.data.length;

    historyCtx.beginPath();
    historyCtx.strokeStyle = s.color;
    historyCtx.lineWidth = 1.5;
    s.data.forEach((v, i) => {
      const x = (offset + i) * stepX;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      if (i === 0) historyCtx.moveTo(x, y);
      else historyCtx.lineTo(x, y);
    });
    historyCtx.stroke();
  });
}

function updateHistoryLegend() {
  historySeries.forEach(s => {
    const el = document.getElementById('legend-val-' + s.key);
    if (!el) return;
    const last = s.data[s.data.length - 1];
    el.textContent = s.label + ': ' + (last === undefined ? '—' : last.toFixed(2));
  });
}

function pushHistory(volts, unloaded, dischargeMa) {
  const vals = [volts, unloaded, dischargeMa];
  historySeries.forEach((s, i) => {
    s.data.push(vals[i]);
    if (s.data.length > HISTORY_LEN) s.data.shift();
  });
  updateHistoryLegend();
  drawHistory();
}

resizeHistoryCanvas();

function fmtCurrent(ma) {
  return Math.abs(ma) >= 1000
    ? (ma / 1000).toFixed(2) + 'А'
    : ma + 'мА';
}

function updateStatus(pct, voltage, currentMa, chargeCurrentMa, unloadedVoltage) {
  statVoltsEl.textContent     = (voltage / 1000).toFixed(2) + 'В';
  statPctEl.textContent       = pct + '%';
  statPctEl.style.color       = pct <= 20 ? 'var(--danger)' : pct <= 50 ? 'var(--warn)' : 'var(--accent)';
  statDischargeEl.textContent = fmtCurrent(currentMa);
  statDischargeEl.style.color = currentMa < 0 ? 'var(--accent)' : 'var(--text)';
  statChargeEl.textContent    = fmtCurrent(chargeCurrentMa);
  statChargeEl.style.color    = chargeCurrentMa < 0 ? 'var(--accent)' : 'var(--text)';

  const scytheA = ((unloadedVoltage - voltage)) / 330 - currentMa / 1000.0;
  if(Math.abs(unloadedVoltage - voltage) > 1) {
    scytheCurrentEl.style.display = '';
    scytheCurrentEl.textContent = scytheA.toFixed(2) + 'A';
  } else {
    scytheCurrentEl.style.display = 'none';
  }

  pushHistory(voltage / 1000, unloadedVoltage / 1000, currentMa);
}

/* ── WebSocket ─────────────────────────────────────────────── */
let ws, wsReady = false;
let reconnectTimer   = null;
let reconnectAttempts = 0;

function wsConnect() {
  clearTimeout(reconnectTimer);
  showOverlay('Подключитесь к точке доступа WiFi ' + ESP_SSID);

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReady = true;
    reconnectAttempts = 0;
    hideOverlay();
    wsDot.classList.add('connected');
    addLog('WS подключён');
  };

  ws.onclose = () => {
    wsReady = false;
    wsDot.classList.remove('connected');
    reconnectAttempts++;
    addLog('WS отключён');
    if (reconnectAttempts >= 5) {
      showRetry(
        'Не удаётся подключиться к роботу. ' +
        'Проверьте подключение к точке доступа WiFi ' + ESP_SSID +
        ' и нажмите «Повторить»'
      );
    } else {
      showOverlay('Переподключение… (попытка ' + reconnectAttempts + ')');
      reconnectTimer = setTimeout(wsConnect, 1500);
    }
  };

  ws.onerror = () => { ws.close(); };

  ws.onmessage = (e) => {
    const msg = e.data;
    if (msg.startsWith('L:')) { addLog(msg.substring(2)); return; }
    if (msg.startsWith('OTA:')) {
      const pct = parseInt(msg.substring(4));
      document.getElementById('ota-bar').style.width  = pct + '%';
      document.getElementById('ota-pct').textContent  = pct + '%';
      return;
    }
    if (msg.startsWith('S:')) {
      const parts = msg.substring(2).split(':');
      if (parts.length < 12) return;
      updateBars(parts[0].split(',').map(Number), parts[1].split(',').map(Number));
      updateAngles(parseInt(parts[2]), parseInt(parts[3]), parseInt(parts[4]), parseInt(parts[5]));
      updateCorr(parseInt(parts[6]), parseInt(parts[7]));
      updateStatus(parseInt(parts[8]), parseInt(parts[9]), parseInt(parts[10]), parseInt(parts[11]), parseInt(parts[12]));
    }
  };
}

function wsSend(msg) { if (ws && wsReady) ws.send(msg); }
wsConnect();

/* ── Кнопки направления ────────────────────────────────────── */
const pressed = { fwd: false, bwd: false, left: false, right: false };
let sendTimer = null;

function calcAndSend() {
  const fwd   = pressed.fwd  && !pressed.bwd;
  const bwd   = pressed.bwd  && !pressed.fwd;
  const left  = pressed.left && !pressed.right;
  const right = pressed.right && !pressed.left;
  const y = fwd ? 1 : bwd ? -1 : 0;
  const x = right ? 1 : left ? -1 : 0;
  if (x === 0 && y === 0) { wsSend('stop'); return; }
  let lSpeed, rSpeed;
  if      (y === 0)  { lSpeed =  x; rSpeed = -x; }
  else if (x > 0)    { lSpeed =  y; rSpeed =  0; }
  else if (x < 0)    { lSpeed =  0; rSpeed =  y; }
  else               { lSpeed =  y; rSpeed =  y; }
  wsSend('l:' + lSpeed.toFixed(1) + ':r:' + rSpeed.toFixed(1));
}

function startTimer() {
  if (sendTimer) return;
  calcAndSend();
  sendTimer = setInterval(calcAndSend, 100);
}
function stopTimer() {
  if (Object.values(pressed).some(Boolean)) return;
  clearInterval(sendTimer); sendTimer = null;
  wsSend('stop');
}

const btnMap = { 'btn-fwd': 'fwd', 'btn-bwd': 'bwd', 'btn-left': 'left', 'btn-right': 'right' };
Object.entries(btnMap).forEach(([id, key]) => {
  const el = document.getElementById(id);
  const onPress   = e => { e.preventDefault(); pressed[key] = true;  el.classList.add('pressed');    startTimer(); };
  const onRelease = e => { e.preventDefault(); pressed[key] = false; el.classList.remove('pressed'); stopTimer();  };
  el.addEventListener('mousedown',   onPress);
  el.addEventListener('touchstart',  onPress,   { passive: false });
  el.addEventListener('mouseup',     onRelease);
  el.addEventListener('mouseleave',  onRelease);
  el.addEventListener('touchend',    onRelease, { passive: false });
  el.addEventListener('touchcancel', onRelease, { passive: false });
});

/* ── Коса ──────────────────────────────────────────────────── */
const scytheBtn = document.getElementById('btn-scythe');
['mousedown', 'touchstart'].forEach(ev =>
  scytheBtn.addEventListener(ev, () => { scytheBtn.classList.add('active');    wsSend('scythe_on');  })
);
['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev =>
  scytheBtn.addEventListener(ev, () => { scytheBtn.classList.remove('active'); wsSend('scythe_off'); })
);

/* ── Скорость ──────────────────────────────────────────────── */
document.getElementById('speed-range').addEventListener('input', function () {
  document.getElementById('speed-label').textContent = this.value;
  wsSend('speed:' + this.value);
});

/* ── Задачи ────────────────────────────────────────────────── */
['task-none', 'task-perimeter_run', 'task-mowing', 'task-go_home'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    document.querySelectorAll('.task-btn').forEach(b => b.classList.remove('active'));
    if (id !== 'task-none') document.getElementById(id).classList.add('active');
    wsSend('task:' + id.substring(5));
  });
});

/* ── OTA ───────────────────────────────────────────────────── */
const otaOverlay   = document.getElementById('ota-overlay');
const otaFileInput = document.getElementById('ota-file-input');

document.getElementById('ota-btn').addEventListener('click', () => otaFileInput.click());

otaFileInput.addEventListener('change', async () => {
  const file = otaFileInput.files[0];
  if (!file) return;
  otaFileInput.value = '';

  otaOverlay.classList.add('visible');
  document.getElementById('ota-bar').style.width = '0%';
  document.getElementById('ota-pct').textContent = '0%';
  addLog('OTA: начало загрузки ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' КБ)');

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', OTA_URL);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 50);
          document.getElementById('ota-bar').style.width = pct + '%';
          document.getElementById('ota-pct').textContent = pct + '%';
        }
      };
      xhr.onload  = () => xhr.status === 200 ? resolve() : reject(new Error('HTTP ' + xhr.status));
      xhr.onerror = () => reject(new Error('Сетевая ошибка'));
      const fd = new FormData();
      fd.append('firmware', file, file.name);
      xhr.send(fd);
    });
    addLog('OTA: файл передан, ESP32 перезагружается…');
    setTimeout(() => {
      otaOverlay.classList.remove('visible');
      reconnectAttempts = 0;
      wsConnect();
    }, 5000);
  } catch (err) {
    otaOverlay.classList.remove('visible');
    addLog('OTA ERROR: ' + err.message);
  }
});
