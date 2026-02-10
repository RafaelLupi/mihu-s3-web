// texto/texto.js
function updateClock(){
  const el = document.getElementById("clock");
  if (!el) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  el.textContent = `${hh}:${mm}`;
}

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);
});
