// =====================================
// CONTROLE — MOTORES VIA BLE (NUS)
// =====================================

// ===== NUS =====
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_UUID      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
const TX_UUID      = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify (opcional)

const TRANSPORT = "ble"; // "ble" | "auto"
const API_MOTOR = "/api/motor";

// ✅ MAPEAMENTO PEDIDO:
// Analógico L -> motor id 1 e 2
// Analógico R -> motor id 3 e 4
const gp = {
  L: { motors: [1, 2], value: 0 },
  R: { motors: [3, 4], value: 0 },
};
const ALL_MOTORS = [1, 2, 3, 4];

// ==============================
// AJUSTES (TUNING)
// ==============================
const MOTOR_SEND_MIN_MS = 18;
const MOTOR_SEND_DELTA  = 1;

// ==============================
// UTIL
// ==============================
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function $(id){ return document.getElementById(id); }

function hasWebBluetooth(){
  return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
}

// ==============================
// BLE MANAGER (NUS)
// ==============================
const ble = {
  device: null,
  server: null,
  service: null,
  rxChar: null,
  txChar: null,
  connected: false,
  writeChain: Promise.resolve(),
  lastWarnAt: 0,
};

function updateBleUI(on){
  const pill = $("blePill");
  const btn  = $("bleBtn");

  const dot = $("bleDot");
  const txt = $("bleText");
  const dev = $("bleDevice");
  const btnC = $("btnBleConnect");
  const btnD = $("btnBleDisconnect");

  if (pill){
    pill.textContent = on ? "ON" : "OFF";
    pill.classList.toggle("on", !!on);
  }
  if (btn){
    btn.textContent = on ? "Desconectar" : "Bluetooth";
  }

  if (dot) dot.className = on ? "gp-dot ok" : "gp-dot";
  if (txt) txt.textContent = on ? "BLE: ON" : "BLE: OFF";
  if (dev) dev.textContent = on ? (ble.device?.name || "Sem nome") : "Nenhum";

  if (btnD) btnD.disabled = !on;
  if (btnC) btnC.disabled = on;
}

// JSON compatível com seu parse_and_apply()
// aceita {"id":1,"speed":50}
function formatMotorCmd(id, speed){
  return JSON.stringify({ id, speed }) + "\n";
}

async function bleWrite(text){
  if (!ble.rxChar) throw new Error("BLE não conectado (RX).");

  const data = new TextEncoder().encode(text);

  ble.writeChain = ble.writeChain.then(async () => {
    if (ble.rxChar.writeValueWithoutResponse){
      await ble.rxChar.writeValueWithoutResponse(data);
    } else {
      await ble.rxChar.writeValue(data);
    }
  }).catch(() => {});

  return ble.writeChain;
}

function stopAllUI(){
  gp.L.value = 0;
  gp.R.value = 0;
  setGpUI("L", 0);
  setGpUI("R", 0);

  ALL_MOTORS.forEach(id => {
    motorLast[id] = 0;
    motorPending[id] = null;
    motorInFlight[id] = false;
    motorLastSentAt[id] = 0;
  });
}

async function connectBLE(){
  if (!hasWebBluetooth()){
    alert("Web Bluetooth não está disponível.\nUse Chrome/Edge no Android/PC.");
    return false;
  }

  try{
    ble.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "MIHU", services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });

    ble.device.addEventListener("gattserverdisconnected", () => {
      ble.connected = false;
      ble.server = null;
      ble.service = null;
      ble.rxChar = null;
      ble.txChar = null;
      updateBleUI(false);
      stopAllUI();
    });

    ble.server  = await ble.device.gatt.connect();
    ble.service = await ble.server.getPrimaryService(SERVICE_UUID);

    ble.rxChar = await ble.service.getCharacteristic(RX_UUID);

    // TX opcional
    try{
      ble.txChar = await ble.service.getCharacteristic(TX_UUID);
      await ble.txChar.startNotifications();
    }catch(e){
      ble.txChar = null;
    }

    ble.connected = true;
    updateBleUI(true);
    return true;

  }catch(e){
    console.warn("BLE connect error:", e);
    ble.connected = false;
    updateBleUI(false);
    return false;
  }
}

async function disconnectBLE(){
  try{
    if (ble.connected){
      await Promise.allSettled(ALL_MOTORS.map(id => transportSendMotor(id, 0, true)));
    }
  }catch(e){}

  try{
    if (ble.device?.gatt?.connected) ble.device.gatt.disconnect();
  }catch(e){}

  ble.connected = false;
  ble.server = null;
  ble.service = null;
  ble.rxChar = null;
  ble.txChar = null;

  updateBleUI(false);
  stopAllUI();
}

// ==============================
// HTTP fallback (opcional)
// ==============================
function _payload(id, speed) { return JSON.stringify({ id, speed }); }

async function sendMotorHTTP(id, speed){
  return fetch(API_MOTOR, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    keepalive: true,
    body: _payload(id, speed),
  });
}

async function transportSendMotor(id, speed){
  if ((TRANSPORT === "ble" || TRANSPORT === "auto") && ble.connected && ble.rxChar){
    return bleWrite(formatMotorCmd(id, speed));
  }
  if (TRANSPORT === "auto"){
    return sendMotorHTTP(id, speed);
  }
  const now = Date.now();
  if (now - ble.lastWarnAt > 1200){
    ble.lastWarnAt = now;
    console.warn("BLE não conectado. Clique em Conectar.");
  }
}

// ==============================
// LATEST-ONLY POR MOTOR (1..4)
// ==============================
const motorLast       = { 1:0, 2:0, 3:0, 4:0 };
const motorLastSentAt = { 1:0, 2:0, 3:0, 4:0 };
const motorInFlight   = { 1:false, 2:false, 3:false, 4:false };
const motorPending    = { 1:null, 2:null, 3:null, 4:null };

async function _flushMotor(id) {
  if (motorInFlight[id]) return;
  if (motorPending[id] === null) return;

  const speed = motorPending[id];
  motorPending[id] = null;
  motorInFlight[id] = true;
  motorLastSentAt[id] = Date.now();

  try { await transportSendMotor(id, speed); }
  catch (e) {}
  finally {
    motorInFlight[id] = false;
    if (motorPending[id] !== null) _flushMotor(id);
  }
}

function sendMotor(id, speed, force = false) {
  id = toInt(id, 0);
  if (!ALL_MOTORS.includes(id)) return;

  speed = clamp(toInt(speed, 0), -100, 100);

  const prev = motorLast[id];
  const now = Date.now();
  const isStop = (speed === 0);

  const changedEnough =
    force ||
    Math.abs(speed - prev) >= MOTOR_SEND_DELTA ||
    (isStop && prev !== 0);

  if (!changedEnough) return;

  motorLast[id] = speed;

  if (isStop) {
    motorPending[id] = 0;
    _flushMotor(id);
    return;
  }

  if (!force && (now - motorLastSentAt[id]) < MOTOR_SEND_MIN_MS) {
    motorPending[id] = speed;
    return;
  }

  motorPending[id] = speed;
  _flushMotor(id);
}

function sendMotorGroup(side, speed, forceStop=false){
  const motors = gp?.[side]?.motors || [];
  motors.forEach(id => sendMotor(id, speed, forceStop));
}

// ==============================
// UI / STICKS
// ==============================
function setGpUI(side, speed) {
  const pct = clamp(Math.abs(speed), 0, 100);

  if (side === "L") {
    const v = $("gpValL");
    const b = $("gpBarL");
    if (v) v.textContent = String(speed);
    if (b) b.style.width = `${pct}%`;
  } else {
    const v = $("gpValR");
    const b = $("gpBarR");
    if (v) v.textContent = String(speed);
    if (b) b.style.width = `${pct}%`;
  }
}

function setupStick(el) {
  const side = el.getAttribute("data-stick"); // "L" ou "R"
  const knob = el.querySelector(".gp-stick-knob");
  if (!side || !knob) return;

  const DEADZONE = 0.10;
  let active = false;
  let pid = null;

  function pointerPos(ev) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return { x: ev.clientX - cx, y: ev.clientY - cy, radius: Math.min(r.width, r.height) / 2 };
  }

  function apply(ev) {
    const p = pointerPos(ev);
    const maxR = p.radius * 0.42;

    let dx = p.x;
    let dy = p.y;

    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      const s = maxR / dist;
      dx *= s; dy *= s;
    }

    knob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;

    let norm = (-dy / maxR);
    norm = clamp(norm, -1, 1);

    const prevSpeed = gp[side].value;
    if (Math.abs(norm) < DEADZONE) norm = 0;

    const speed = Math.round(norm * 100);

    gp[side].value = speed;
    setGpUI(side, speed);

    const forceStop = (speed === 0 && prevSpeed !== 0);
    sendMotorGroup(side, speed, forceStop);
  }

  function reset() {
    knob.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;
    gp[side].value = 0;
    setGpUI(side, 0);
    sendMotorGroup(side, 0, true);
  }

  el.addEventListener("pointerdown", (ev) => {
    active = true;
    pid = ev.pointerId;
    el.setPointerCapture(pid);
    apply(ev);
  });

  el.addEventListener("pointermove", (ev) => {
    if (!active) return;
    if (pid !== null && ev.pointerId !== pid) return;
    apply(ev);
  });

  el.addEventListener("pointerup", () => { active = false; pid = null; reset(); });
  el.addEventListener("pointercancel", () => { active = false; pid = null; reset(); });
}

// ==============================
// D-PAD (tank)
// ==============================
function setupDpad(){
  document.querySelectorAll("[data-dpad]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const k = btn.dataset.dpad;

      let l = 0, r = 0;
      if (k === "stop"){ l = 0; r = 0; }
      if (k === "up")  { l = 70; r = 70; }
      if (k === "down"){ l = -70; r = -70; }
      if (k === "left"){ l = -70; r = 70; }
      if (k === "right"){ l = 70; r = -70; }

      gp.L.value = l;
      gp.R.value = r;
      setGpUI("L", l);
      setGpUI("R", r);

      const forceStop = (k === "stop");
      sendMotorGroup("L", l, forceStop); // 1,2
      sendMotorGroup("R", r, forceStop); // 3,4
    });
  });
}

// ==============================
// RGB (só UI)
// ==============================
function setupRgbUI(){
  const color = $("gpColor");
  const sw = $("gpRgbSwatch");
  const tx = $("gpRgbText");

  function setRgb(hex) {
    if (color) color.value = hex;
    if (sw) sw.style.background = hex;
    if (tx) tx.textContent = hex.toUpperCase();
  }

  if (color) {
    color.addEventListener("input", () => setRgb(color.value));
    setRgb(color.value);
  }

  document.querySelectorAll(".gp-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const hex = btn.getAttribute("data-color") || "#00AEEF";
      setRgb(hex);
    });
  });
}

// ==============================
// INIT
// ==============================
function setupBleButtons(){
  const btnC = $("btnBleConnect");
  const btnD = $("btnBleDisconnect");
  const btnT = $("bleBtn");

  if (btnC) btnC.addEventListener("click", async ()=>{ await connectBLE(); });
  if (btnD) btnD.addEventListener("click", async ()=>{ await disconnectBLE(); });
  if (btnT) btnT.addEventListener("click", async ()=>{ ble.connected ? await disconnectBLE() : await connectBLE(); });

  updateBleUI(false);
}

function setupGamepad(){
  document.querySelectorAll(".gp-stick").forEach(setupStick);
  setupDpad();
  setupRgbUI();
}

window.addEventListener("load", () => {
  setupBleButtons();
  setupGamepad();
});

// Se esconder a aba: STOP geral
window.addEventListener("visibilitychange", () => {
  if (document.hidden){
    ALL_MOTORS.forEach(id => sendMotor(id, 0, true));
  }
});
