// web/bluetooth/bluetooth.js

// ===== Relógio =====
function updateClock(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.getElementById("clock").textContent = `${hh}:${mm}`;
}
setInterval(updateClock, 1000);
updateClock();

// ===== Web Bluetooth (NUS padrão) =====
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_UUID      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
const TX_UUID      = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

let device, server, service, rxChar, txChar;
let autoScroll = true;

const logEl = document.getElementById('log');
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');
const btnSend = document.getElementById('btnSend');
const btnClear = document.getElementById('btnClear');
const btnAutoScroll = document.getElementById('btnAutoScroll');
const input = document.getElementById('txt');

const dotConn = document.getElementById('dotConn');
const txtConn = document.getElementById('txtConn');
const txtDevice = document.getElementById('txtDevice');

function addLog(line){
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  logEl.textContent += `\n[${t}] ${line}`;
  if (autoScroll) logEl.scrollTop = logEl.scrollHeight;
}

function setConnectedUI(connected){
  btnDisconnect.disabled = !connected;
  btnSend.disabled = !connected;

  if (connected){
    dotConn.className = "dot ok";
    txtConn.textContent = "Conectado";
  } else {
    dotConn.className = "dot bad";
    txtConn.textContent = "Desconectado";
  }
}

function safeDeviceName(d){
  return (d && d.name) ? d.name : "Dispositivo sem nome";
}

async function connectBLE(){
  if (!navigator.bluetooth) {
    addLog("Erro: Web Bluetooth não disponível neste navegador.");
    return;
  }

  addLog("Abrindo lista de dispositivos...");
  device = await navigator.bluetooth.requestDevice({
    // se quiser filtrar por nome:
    // filters: [{ namePrefix: "MIHU" }],
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID]
  });

  txtDevice.textContent = safeDeviceName(device);

  device.addEventListener('gattserverdisconnected', () => {
    addLog("⚠️ Desconectou!");
    setConnectedUI(false);
  });

  addLog("Conectando no GATT...");
  server = await device.gatt.connect();

  addLog("Pegando serviço BLE...");
  service = await server.getPrimaryService(SERVICE_UUID);

  addLog("Pegando RX/TX...");
  rxChar = await service.getCharacteristic(RX_UUID);
  txChar = await service.getCharacteristic(TX_UUID);

  addLog("Ativando notificações (TX)...");
  await txChar.startNotifications();

  txChar.addEventListener('characteristicvaluechanged', (e) => {
    const msg = new TextDecoder().decode(e.target.value);
    addLog(`ESP32 > ${msg}`);
  });

  setConnectedUI(true);
  addLog(`✅ Conectado em: ${safeDeviceName(device)}`);
}

async function disconnectBLE(){
  try{
    if (device?.gatt?.connected) device.gatt.disconnect();
  }catch(e){}
  setConnectedUI(false);
  addLog("Desconectado.");
}

async function sendText(text){
  if (!rxChar){
    addLog("Erro: você ainda não conectou.");
    return;
  }
  const data = new TextEncoder().encode(text);
  await rxChar.writeValue(data);
  addLog(`Você > ${text}`);
}

// ===== Eventos =====
btnConnect.addEventListener('click', async () => {
  try { await connectBLE(); }
  catch (e) { addLog("Erro: " + (e?.message || e)); setConnectedUI(false); }
});

btnDisconnect.addEventListener('click', async () => {
  await disconnectBLE();
});

btnSend.addEventListener('click', async () => {
  const t = input.value.trim();
  if (!t) return;
  try { await sendText(t); input.value = ""; input.focus(); }
  catch (e) { addLog("Erro ao enviar: " + (e?.message || e)); }
});

input.addEventListener('keydown', async (ev) => {
  if (ev.key === "Enter" && !btnSend.disabled){
    btnSend.click();
  }
});

btnClear.addEventListener('click', () => {
  logEl.textContent = "Console limpo. Bora testar de novo!";
  if (autoScroll) logEl.scrollTop = logEl.scrollHeight;
});

// Estado inicial
setConnectedUI(false);
