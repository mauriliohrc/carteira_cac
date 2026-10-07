#!/usr/bin/env node
/*
 * Gera os cartazes A4 (retrato + paisagem) da Carteira CAC para impressão.
 * QR code vetorial (correção de erro H) apontando para a página de download.
 * Saída: store/impressos/cartaz-a4-retrato.html e cartaz-a4-paisagem.html
 *
 * A lib `qrcode` é carregada do diretório temporário do scratchpad (ver QR_LIB).
 */
const fs = require("fs");
const path = require("path");

const URL = "https://www.carteiracac.com/download";
const SAIDA = path.resolve(__dirname, "..");

// a lib qrcode fica no scratchpad; permite sobrescrever por env QR_LIB
const QR_LIB = process.env.QR_LIB ||
  "/private/tmp/claude-503/-Users-bad-Documents-carteira-cac/33d4d577-1893-4afe-bab1-df9bd4c92feb/scratchpad/qrtool/node_modules/qrcode";
const QR_SVG_CACHE = path.join(__dirname, "qr.svg"); // QR vetorial versionado (fallback sem a lib)

// ---- escudo da marca (SVG inline, sem dependências externas) ----
const ESCUDO = `
<svg class="escudo" viewBox="0 0 120 140" role="img" aria-label="Carteira CAC">
  <path d="M60 5 L110 23 V74 C110 105 88 125 60 135 C32 125 10 105 10 74 V23 Z"
        fill="#FBFAF3" stroke="#D8AE3A" stroke-width="6" stroke-linejoin="round"/>
  <rect x="40" y="38" width="40" height="48" rx="6" fill="#FFFFFF" stroke="#C9A227" stroke-width="3"/>
  <path d="M70 38 h4 l6 6 v2 h-10 Z" fill="#E6DFC4"/>
  <line x1="48" y1="54" x2="72" y2="54" stroke="#2F5E33" stroke-width="4" stroke-linecap="round"/>
  <line x1="48" y1="63" x2="72" y2="63" stroke="#6E8F5E" stroke-width="4" stroke-linecap="round"/>
  <line x1="48" y1="72" x2="64" y2="72" stroke="#8AA87A" stroke-width="4" stroke-linecap="round"/>
  <circle cx="60" cy="98" r="13" fill="#1E6A34" stroke="#D8AE3A" stroke-width="2.5"/>
  <circle cx="60" cy="95" r="3.4" fill="#F4D06A"/>
  <rect x="58.2" y="96" width="3.6" height="8" rx="1.8" fill="#F4D06A"/>
</svg>`;

const APPLE_SVG = `<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM262.1 104.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>`;
const PLAY_SVG = `<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M48 23.6C40.3 27.9 35.3 35.9 35.3 46.8v418.4c0 10.9 5 18.9 12.7 23.2l236.9-232.2L48 23.6zM318.6 222.9l-54.2-53.1L62.9 54.3l255.7 168.6zm0 66.2L62.9 457.7l201.5-115.5 54.2-53.1zm40.2-23.5l64.9-37.9c20.2-11.8 20.2-37.7 0-49.5l-64.9-37.9-59.3 62.6 59.3 62.6z"/></svg>`;

function estilo(orientacao) {
  const paisagem = orientacao === "paisagem";
  const pageSize = paisagem ? "A4 landscape" : "A4";
  const W = paisagem ? "297mm" : "210mm";
  const H = paisagem ? "210mm" : "297mm";
  return `
@page { size: ${pageSize}; margin: 0; }
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --verde:#0F3D1E; --verde2:#0A2712; --verde3:#061A0B; --verde-claro:#1E6A34;
  --ouro:#D8AE3A; --ouro2:#F4D06A; --ouro3:#C9A227; --creme:#FBFAF3; --sage:#C6D9BC;
}
html,body{width:${W};height:${H}}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--creme); position:relative; overflow:hidden;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  background:
    radial-gradient(900px 720px at 82% 8%, rgba(30,106,52,.55), transparent 60%),
    radial-gradient(760px 640px at 4% 100%, rgba(216,174,58,.13), transparent 62%),
    linear-gradient(162deg, var(--verde) 0%, var(--verde2) 56%, var(--verde3) 100%);
}
.rhombus{position:absolute;border:3mm solid var(--ouro);opacity:.09;border-radius:12mm;transform:rotate(45deg);pointer-events:none}
.r1{right:-60mm;top:-50mm;width:150mm;height:150mm}
.r2{left:-70mm;bottom:-60mm;width:130mm;height:130mm;opacity:.06;border-width:2.4mm}

/* marca */
.marca{display:flex;align-items:center;gap:6mm}
.marca .escudo{width:20mm;height:auto;filter:drop-shadow(0 2mm 4mm rgba(0,0,0,.45))}
.marca .nome{font-size:8mm;font-weight:800;letter-spacing:3mm;color:var(--ouro2);line-height:1}
.marca .nome small{display:block;font-size:3.4mm;font-weight:600;letter-spacing:1.4mm;color:var(--sage);opacity:.8;margin-top:2mm}

.etq{display:inline-flex;align-items:center;gap:4mm;font-size:4.4mm;font-weight:800;letter-spacing:2.2mm;color:var(--ouro)}
.etq i{display:block;width:10mm;height:1.4mm;border-radius:1mm;background:var(--ouro)}

h1{font-weight:800;letter-spacing:-.6mm;color:var(--creme);text-shadow:0 1mm 5mm rgba(0,0,0,.3)}
h1 b{color:var(--ouro2)}
.lead{color:var(--sage);font-weight:500}
.lead b{color:var(--creme);font-weight:700}

/* beneficios */
.benef{display:flex;flex-direction:column;gap:3.2mm}
.benef .item{display:flex;align-items:center;gap:4mm;font-size:5mm;font-weight:600;color:var(--creme)}
.benef .item .ic{width:11mm;height:11mm;flex:none;display:flex;align-items:center;justify-content:center;
  background:rgba(251,250,243,.07);border:.4mm solid rgba(216,174,58,.4);border-radius:3mm;font-size:5.6mm}

/* cartao do QR */
.qrbox{background:var(--creme);border-radius:8mm;border:1.6mm solid var(--ouro);
  box-shadow:0 8mm 24mm rgba(0,0,0,.4);text-align:center;color:var(--verde2)}
.qrbox .chamada{font-size:5mm;font-weight:800;letter-spacing:.4mm;color:var(--verde);display:flex;align-items:center;justify-content:center;gap:3mm}
.qrbox .chamada .cam{font-size:6mm}
.qrbox .qr{width:100%;height:auto;display:block}
.qrbox .link{font-size:3.6mm;font-weight:700;letter-spacing:.6mm;color:var(--verde-claro);word-break:break-all}

/* lojas */
.lojas{display:flex;gap:4mm}
.store{display:flex;align-items:center;gap:3.5mm;background:#11140F;border:.4mm solid rgba(255,255,255,.16);
  border-radius:4mm;padding:3.4mm 5mm;color:#fff}
.store svg{width:8mm;height:8mm;flex:none;fill:#fff}
.store .tx{text-align:left;line-height:1.1}
.store .tx small{display:block;font-size:2.7mm;letter-spacing:.6mm;text-transform:uppercase;color:#aeb6a6}
.store .tx b{font-size:5mm;font-weight:700}

/* faixa parceiro */
.parceiro{display:inline-flex;align-items:center;gap:3mm;background:rgba(216,174,58,.12);
  border:.4mm solid rgba(216,174,58,.5);border-radius:999px;padding:3mm 6mm;
  font-size:4.2mm;font-weight:700;color:var(--ouro2)}
.parceiro b{color:var(--creme)}

.rodape{font-size:4mm;letter-spacing:1mm;color:rgba(198,217,188,.7);font-weight:600}
.rodape b{color:var(--ouro2)}
`;
}

function qrSvg(svgRaw) {
  // módulos em verde bem escuro (alto contraste) sobre o cartão creme;
  // fundo transparente — o cartão fornece o branco de leitura.
  return svgRaw
    .replace(/fill="#ffffff"/i, 'fill="none"')
    .replace(/stroke="#000000"/i, 'stroke="#0A2712"')
    .replace("<svg ", '<svg class="qr" preserveAspectRatio="xMidYMid meet" ');
}

function paginaRetrato(qr) {
  return `
<main class="wrap">
  <header class="topo">
    <div class="marca">${ESCUDO}<div class="nome">CARTEIRA CAC<small>ACERVO EM ORDEM</small></div></div>
  </header>

  <section class="hero">
    <div class="etq"><i></i>A CARTEIRA DIGITAL DO CAC</div>
    <h1>Seu acervo sempre<br><b>em ordem</b>.</h1>
    <p class="lead">CRAF, guia, laudo e CR num app só — com <b>aviso antes de cada vencimento</b>.</p>
  </section>

  <section class="qrbox">
    <div class="chamada"><span class="cam">📷</span> APONTE A CÂMERA E BAIXE GRÁTIS</div>
    ${qr}
    <div class="link">www.carteiracac.com/download</div>
  </section>

  <section class="benef">
    <div class="item"><span class="ic">🔔</span><span>Avisa antes<br>de vencer</span></div>
    <div class="item"><span class="ic">🔒</span><span>Seguro e<br>100% offline</span></div>
    <div class="item"><span class="ic">🎯</span><span>Todas as<br>categorias</span></div>
  </section>

  <section class="lojas">
    <div class="store">${APPLE_SVG}<span class="tx"><small>Baixar na</small><b>App Store</b></span></div>
    <div class="store">${PLAY_SVG}<span class="tx"><small>Disponível no</small><b>Google Play</b></span></div>
  </section>

  <footer class="rodape"><span class="parceiro">🏅 Sócio de clube parceiro? <b>Premium anual exclusivo.</b></span></footer>
</main>
<style>
.wrap{position:absolute;inset:0;padding:13mm 16mm 11mm;display:flex;flex-direction:column;align-items:center;text-align:center}
.topo{width:100%;display:flex;justify-content:center;margin-bottom:5mm}
.hero h1{font-size:14mm;line-height:1.04;margin:4mm 0 3.5mm}
.hero .lead{font-size:4.8mm;line-height:1.35;max-width:150mm;margin:0 auto}
.qrbox{margin:6mm 0 6mm;width:112mm;padding:6mm 6mm 4.5mm}
.qrbox .qr{width:84mm;height:84mm;margin:3.5mm auto 3.5mm}
.qrbox .chamada{font-size:5mm;line-height:1.25}
.benef{flex-direction:row;gap:7mm;margin-bottom:6mm}
.benef .item{flex-direction:column;gap:2.4mm;font-size:3.9mm;font-weight:700;text-align:center;line-height:1.2;max-width:34mm}
.benef .item .ic{width:13mm;height:13mm;font-size:6.5mm}
.lojas{margin-bottom:5.5mm}
.rodape{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:4mm}
.rodape .dom{font-size:4mm;letter-spacing:1mm}
</style>`;
}

function paginaPaisagem(qr) {
  return `
<main class="wrap">
  <div class="col-esq">
    <div class="marca">${ESCUDO}<div class="nome">CARTEIRA CAC<small>ACERVO EM ORDEM</small></div></div>
    <div class="etq"><i></i>A CARTEIRA DIGITAL DO CAC</div>
    <h1>Seu acervo<br>sempre <b>em ordem</b>.</h1>
    <p class="lead">CRAF, guia, laudo e CR num app só — com <b>aviso antes de cada vencimento</b>.</p>

    <div class="benef">
      <div class="item"><span class="ic">🔔</span> Avisa antes de cada vencimento</div>
      <div class="item"><span class="ic">🔒</span> Seguro e funciona 100% offline</div>
      <div class="item"><span class="ic">🎯</span> Atirador, caçador ou colecionador</div>
    </div>

    <div class="lojas">
      <div class="store">${APPLE_SVG}<span class="tx"><small>Baixar na</small><b>App Store</b></span></div>
      <div class="store">${PLAY_SVG}<span class="tx"><small>Disponível no</small><b>Google Play</b></span></div>
    </div>

    <span class="parceiro">🏅 Sócio de clube parceiro? <b>Premium anual exclusivo.</b></span>
  </div>

  <div class="col-dir">
    <div class="qrbox">
      <div class="chamada"><span class="cam">📷</span> APONTE E BAIXE GRÁTIS</div>
      ${qr}
      <div class="link">www.carteiracac.com/download</div>
    </div>
    <div class="rodape"><b>www.carteiracac.com</b></div>
  </div>
</main>
<style>
.wrap{position:absolute;inset:0;padding:15mm 16mm;display:flex;align-items:center;gap:14mm}
.col-esq{flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:6mm}
.col-esq .marca{margin-bottom:1mm}
.hero{}
.col-esq h1{font-size:17mm;line-height:1.02}
.col-esq .lead{font-size:5mm;line-height:1.4;max-width:150mm}
.benef{margin-top:1mm}
.col-dir{flex:none;width:118mm;display:flex;flex-direction:column;align-items:center;gap:6mm}
.qrbox{width:118mm;padding:7mm 7mm 5mm}
.qrbox .qr{width:94mm;height:94mm;margin:4mm auto 4mm}
.rodape{letter-spacing:1mm}
</style>`;
}

function doc(orientacao, corpo) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Carteira CAC — Cartaz A4 ${orientacao}</title>
<style>${estilo(orientacao)}</style></head>
<body><div class="rhombus r1"></div><div class="rhombus r2"></div>${corpo}</body></html>`;
}

function construir(svgRaw) {
  const qr = qrSvg(svgRaw);
  fs.writeFileSync(path.join(SAIDA, "cartaz-a4-retrato.html"), doc("retrato", paginaRetrato(qr)));
  fs.writeFileSync(path.join(SAIDA, "cartaz-a4-paisagem.html"), doc("paisagem", paginaPaisagem(qr)));
  console.log("html: cartaz-a4-retrato");
  console.log("html: cartaz-a4-paisagem");
}

// Fonte do QR: tenta gerar com a lib (reflete a URL atual e atualiza o cache);
// se a lib não estiver disponível, usa o qr.svg versionado em fontes/.
let QRCode = null;
try { QRCode = require(QR_LIB); } catch (_) { /* lib ausente: usa cache */ }

if (QRCode) {
  QRCode.toString(URL, { type: "svg", errorCorrectionLevel: "H", margin: 0 }, (err, svgRaw) => {
    if (err) { console.error(err); process.exit(1); }
    fs.writeFileSync(QR_SVG_CACHE, svgRaw);   // mantém o cache em dia
    construir(svgRaw);
  });
} else if (fs.existsSync(QR_SVG_CACHE)) {
  console.log("(lib qrcode ausente — usando fontes/qr.svg)");
  construir(fs.readFileSync(QR_SVG_CACHE, "utf8"));
} else {
  console.error("Erro: lib 'qrcode' não encontrada e fontes/qr.svg inexistente.\n" +
    "Instale com: npm install qrcode  (e ajuste QR_LIB), ou gere fontes/qr.svg.");
  process.exit(1);
}
