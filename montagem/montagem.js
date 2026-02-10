const ASSET_PREFIX = "../";

// helpers
function safeUrl(path){ return encodeURI(path); }
function asset(path){ return safeUrl(ASSET_PREFIX + path); }

// RELÓGIO
function updateClock(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.getElementById("clock").textContent = `${hh}:${mm}`;
}
setInterval(updateClock, 1000);
updateClock();

// PDF MODAL / OVERLAY
const pdfModal = document.getElementById("pdfModal");
const pdfFrame = document.getElementById("pdfFrame");
const pdfTitle = document.getElementById("pdfTitle");
const pdfClose = document.getElementById("pdfClose");

function openPdfModal(path, titleText="Passo a passo"){
  pdfTitle.textContent = titleText;
  pdfFrame.src = asset(path);
  pdfModal.classList.add("open");
  pdfModal.setAttribute("aria-hidden", "false");
}

function closePdfModal(){
  pdfModal.classList.remove("open");
  pdfModal.setAttribute("aria-hidden", "true");
  setTimeout(()=>{ pdfFrame.src = ""; }, 50);
}

pdfClose.addEventListener("click", closePdfModal);
pdfModal.addEventListener("click", (e)=>{
  if (e.target === pdfModal) closePdfModal();
});
window.addEventListener("keydown", (e)=>{
  if (e.key === "Escape" && pdfModal.classList.contains("open")) closePdfModal();
});

// MONTAGENS (vitrine + tabs)
const tabsEl    = document.getElementById("tabs");
const vitrineEl = document.getElementById("vitrine");
const dotsEl    = document.getElementById("dots");
const prevBtn   = document.getElementById("prev");
const nextBtn   = document.getElementById("next");

const livros = [
  { id: "basico",        nome: "Livro Básico",        capa: "imagens/livro_basico.png" },
  { id: "intermediario", nome: "Livro Intermediário", capa: "imagens/livro_intermediario.png" },
  { id: "avancado",      nome: "Livro Avançado",      capa: "imagens/livro_avancado.png" }
];

const montagensPorLivro = {
  basico: [
    { id: 1, nome: "Mão Robótica",     img: "imagens/mao robotica.png",          pdf: "pdfs/mao robotica.pdf" },
    { id: 2, nome: "Robô Tátil",       img: "imagens/robo tatil.png",            pdf: "pdfs/robo tatil.pdf" },
    { id: 3, nome: "Robô Espião",      img: "imagens/robo espiao.png",           pdf: "pdfs/robo espiao.pdf" },
    { id: 4, nome: "Caminhão Reboque", img: "imagens/robo caminhao reboque.png", pdf: "pdfs/robo caminhao reboque.pdf" },
    { id: 5, nome: "Robô Guindaste",   img: "imagens/robo guindaste.png",        pdf: "pdfs/robo guindaste.pdf" },
    { id: 6, nome: "Robô Trator",      img: "imagens/robo trator.png",           pdf: "pdfs/robo trator.pdf" },
    { id: 7, nome: "Rolo Compressor",  img: "imagens/robo rolo compressor.png",  pdf: "pdfs/robo rolo compressor.pdf" }
  ],
  intermediario: [
    { id: 1, nome: "Robô Guitarra", img: "imagens/robo guitarra.png", pdf: "pdfs/robo guitarra.pdf" },
    { id: 2, nome: "Robô Coletor",  img: "imagens/robo coletor.png",  pdf: "pdfs/robo colertor.pdf" },
    { id: 3, nome: "Robô Relógio",  img: "imagens/robo relogio.png",  pdf: "pdfs/robo relogio.pdf" }
  ],
  avancado: [
    { id: 1, nome: "Robô Quadrupede", img: "imagens/robo quadrupede.png",  pdf: "pdfs/mao quadrupede.pdf" },
    { id: 2, nome: "Robô Articulado", img: "imagens/robo articulado.png",  pdf: "pdfs/robo articulado.pdf" },
    { id: 3, nome: "Robô Bondinho",   img: "imagens/robo bondinho.png",    pdf: "pdfs/robo bondinho.pdf" }
  ]
};

let livroAtual = "basico";
let idx = 0;

function currentList(){
  return montagensPorLivro[livroAtual] || [];
}

function clampIdx(){
  const list = currentList();
  if (list.length === 0) { idx = 0; return; }
  if (idx < 0) idx = list.length - 1;
  if (idx >= list.length) idx = 0;
}

function renderTabs(){
  tabsEl.innerHTML = livros.map(l => {
    const count = (montagensPorLivro[l.id] || []).length;
    const active = l.id === livroAtual ? "active" : "";
    const disabled = count === 0 ? "disabled" : "";

    return `
      <div class="tab ${active} ${disabled}" data-id="${l.id}">
        <img src="${asset(l.capa)}" alt="${l.nome}">
        <div>
          <div class="tname">${l.nome}</div>
          <div class="tmeta">${count > 0 ? (count + " montagens") : "Em breve"}</div>
        </div>
      </div>
    `;
  }).join("");

  tabsEl.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      livroAtual = tab.dataset.id;
      idx = 0;
      renderAll();
    });
  });
}

function renderVitrine(){
  const list = currentList();

  if (list.length === 0){
    vitrineEl.innerHTML = `
      <div class="vcard big" style="grid-column:1/-1; min-height:320px; cursor:default">
        <div class="thumb" style="height:240px; display:flex; align-items:center; justify-content:center">
          <div style="text-align:center; font-weight:900; color:rgba(11,60,93,.78); padding:10px">
            Conteúdo em breve para este livro
          </div>
        </div>
        <div class="label">Selecione o Livro Básico para testar</div>
      </div>
    `;
    dotsEl.innerHTML = "";
    prevBtn.classList.add("disabled");
    nextBtn.classList.add("disabled");
    return;
  }

  clampIdx();

  const prevIndex = (idx - 1 + list.length) % list.length;
  const nextIndex = (idx + 1) % list.length;

  const prev = list[prevIndex];
  const cur  = list[idx];
  const next = list[nextIndex];

  vitrineEl.innerHTML = `
    <div class="vcard small" data-idx="${prevIndex}">
      <div class="thumb"><img src="${asset(prev.img)}" alt="${prev.nome}"></div>
      <div class="label">${prev.id} · ${prev.nome}</div>
    </div>

    <div class="vcard big" data-idx="${idx}">
      <div class="thumb">
        <span class="vbadge">PDF</span>
        <img src="${asset(cur.img)}" alt="${cur.nome}">
      </div>
      <div class="label">${cur.id} · ${cur.nome}</div>
    </div>

    <div class="vcard small" data-idx="${nextIndex}">
      <div class="thumb"><img src="${asset(next.img)}" alt="${next.nome}"></div>
      <div class="label">${next.id} · ${next.nome}</div>
    </div>
  `;

  dotsEl.innerHTML = list.map((_, i) => `<div class="dot ${i===idx?'active':''}"></div>`).join("");

  vitrineEl.querySelectorAll(".vcard").forEach(card => {
    card.addEventListener("click", () => {
      const cardIdx = Number(card.dataset.idx);
      if (cardIdx === idx){
        const item = list[idx];
        openPdfModal(item.pdf, `${item.id} · ${item.nome}`);
      } else {
        idx = cardIdx;
        renderAll();
      }
    });
  });

  prevBtn.classList.remove("disabled");
  nextBtn.classList.remove("disabled");
}

function prev(){
  const list = currentList();
  if (!list.length) return;
  idx = (idx - 1 + list.length) % list.length;
  renderAll();
}
function next(){
  const list = currentList();
  if (!list.length) return;
  idx = (idx + 1) % list.length;
  renderAll();
}

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

window.addEventListener("keydown", (e) => {
  if (pdfModal.classList.contains("open")) return; // evita navegar com modal aberto
  if (e.key === "ArrowLeft") prev();
  if (e.key === "ArrowRight") next();
});

function renderAll(){
  renderTabs();
  renderVitrine();
}

renderAll();
