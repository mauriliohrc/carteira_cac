#!/usr/bin/env node
/**
 * Gera as artes de divulgação da versão 1.7 (favoritos, níveis de atirador,
 * compartilhar notícias e onboarding de acervo):
 *   - stories/  5 stories / status 1080×1920
 *   - feed/     1 post de feed 1080×1080
 * Mesma identidade das artes de store/social (verde+ouro, escudo da marca).
 * Render via Chrome headless (tamanho exato), como os demais geradores do repo.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(DIR, '..', '..', '..');
const LOGO = join(RAIZ, 'assets', 'logo.png');
const TELAS = join(RAIZ, 'store', 'screenshots', '6.9');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function render(html, out, w, h) {
  const tmp = join(DIR, `_tmp-${Math.abs(hash(out))}.html`);
  writeFileSync(tmp, html);
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    `--screenshot=${out}`, `file://${tmp}`], { stdio: 'ignore' });
  rmSync(tmp);
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

const BASE = /*css*/`
*{margin:0;padding:0;box-sizing:border-box}
:root{--verde:#0F3D1E;--verde2:#0A2712;--verde3:#061A0B;
  --ouro:#D8AE3A;--ouro2:#F4D06A;--ouro3:#B8891F;--creme:#FBFAF3;--sage:#C6D9BC}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif;
  color:var(--creme);position:relative;overflow:hidden;
  background:
    radial-gradient(900px 700px at 78% 16%, rgba(30,106,52,.55), transparent 62%),
    radial-gradient(760px 620px at 10% 92%, rgba(216,174,58,.13), transparent 64%),
    linear-gradient(165deg, var(--verde) 0%, var(--verde2) 55%, var(--verde3) 100%)}
.losango{position:absolute;right:-300px;top:260px;width:820px;height:820px;transform:rotate(45deg);
  border:24px solid var(--ouro);opacity:.09;border-radius:64px}
.losango.b{right:auto;left:-420px;bottom:-180px;top:auto;width:640px;height:640px;opacity:.06;border-width:20px}
.marca{position:absolute;top:92px;left:78px;display:flex;align-items:center;gap:22px;z-index:5}
.marca img{width:72px;height:72px;display:block;filter:drop-shadow(0 8px 20px rgba(0,0,0,.45))}
.marca .nome{font-size:25px;font-weight:800;letter-spacing:9px;color:var(--ouro2)}
.marca .nome small{display:block;font-size:16px;font-weight:600;letter-spacing:3.5px;color:var(--sage);opacity:.75;margin-top:7px}
.fio{position:absolute;top:196px;left:78px;width:924px;height:2px;
  background:linear-gradient(90deg,rgba(216,174,58,.75),rgba(216,174,58,0))}
.etq{display:inline-flex;align-items:center;gap:16px;font-size:22px;font-weight:800;letter-spacing:6px;color:var(--ouro)}
.etq i{display:block;width:46px;height:5px;border-radius:3px;background:var(--ouro);font-style:normal}
h1{font-weight:800;letter-spacing:-2.4px;line-height:1.04;color:var(--creme);text-shadow:0 6px 28px rgba(0,0,0,.35)}
.sub{color:var(--sage);font-weight:500}
.sub b{color:var(--ouro2);font-weight:700}
.bloco{display:flex;align-items:center;gap:28px;background:rgba(251,250,243,.055);
  border:1.5px solid rgba(216,174,58,.4);border-radius:28px;padding:36px 40px}
.bloco .ic{font-size:52px;line-height:1}
.bloco .tx{font-size:37px;font-weight:700;color:var(--creme)}
.bloco .tx small{display:block;font-size:26px;font-weight:500;color:var(--sage);margin-top:10px;line-height:1.3}
.pilula{display:inline-flex;align-items:center;gap:16px;background:linear-gradient(180deg,var(--ouro2),var(--ouro));
  color:#17120A;font-weight:800;border-radius:22px;box-shadow:0 18px 44px rgba(0,0,0,.45)}
.fone{border-radius:64px;overflow:hidden;border:9px solid rgba(216,174,58,.55);background:#0b1a0f;
  box-shadow:0 48px 110px rgba(0,0,0,.62),0 0 0 2px rgba(0,0,0,.35)}
.fone img{display:block;width:100%}
`;

const marca = `<div class="marca"><img src="file://${LOGO}"><div class="nome">CARTEIRA CAC<small>VERSÃO 1.7</small></div></div><div class="fio"></div>`;

function page(w, h, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    html,body{width:${w}px;height:${h}px}${BASE}</style></head><body>
    <div class="losango"></div><div class="losango b"></div>${marca}${body}</body></html>`;
}

/* ============================ STORIES 1080×1920 ============================ */
const SW = 1080, SH = 1920;

const stories = [
  // 1 — capa
  page(SW, SH, `
    <div style="position:absolute;top:300px;left:78px"><div class="etq"><i></i>NOVA VERSÃO NO AR</div></div>
    <h1 style="position:absolute;top:380px;left:78px;width:940px;font-size:104px">A maior<br>atualização<br>do ano.</h1>
    <div class="sub" style="position:absolute;top:800px;left:78px;width:880px;font-size:38px;line-height:1.45">
      4 novidades pra deixar a vida do CAC<br>muito mais fácil. <b>Arrasta pro lado 👉</b></div>
    <div style="position:absolute;left:78px;right:78px;top:1040px;display:flex;flex-direction:column;gap:24px">
      <div class="bloco"><div class="ic">⚡</div><div class="tx">Acervo em segundos</div></div>
      <div class="bloco"><div class="ic">🥇</div><div class="tx">Níveis de atirador</div></div>
      <div class="bloco"><div class="ic">⭐</div><div class="tx">Favoritos</div></div>
      <div class="bloco"><div class="ic">📰</div><div class="tx">Compartilhar notícias</div></div>
    </div>`),

  // 2 — onboarding de acervo
  page(SW, SH, `
    <div style="position:absolute;top:286px;left:78px"><div class="etq"><i></i>NOVIDADE 1 DE 4</div></div>
    <h1 style="position:absolute;top:360px;left:78px;width:940px;font-size:86px">Monte seu acervo<br>em segundos.</h1>
    <div class="sub" style="position:absolute;top:620px;left:78px;width:900px;font-size:35px;line-height:1.45">
      Mande a foto do seu <b>CR, Posse, Porte ou CRAF</b> — o app lê o documento
      e preenche o cadastro pra você. <b>Sem digitar nada.</b></div>
    <div class="fone" style="position:absolute;left:50%;transform:translateX(-50%);top:880px;width:640px;height:1030px">
      <img src="file://${join(TELAS, '2-acervo.png')}"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:420px;
      background:linear-gradient(180deg,rgba(6,26,11,0),rgba(6,26,11,.9) 70%,rgba(6,26,11,1))"></div>`),

  // 3 — níveis de atirador
  page(SW, SH, `
    <div style="position:absolute;top:286px;left:78px"><div class="etq"><i></i>NOVIDADE 2 DE 4</div></div>
    <h1 style="position:absolute;top:360px;left:78px;width:940px;font-size:86px">Você sabe o<br>seu nível?</h1>
    <div class="sub" style="position:absolute;top:620px;left:78px;width:900px;font-size:35px;line-height:1.45">
      A Carteira CAC agora mostra seu nível e <b>quantas sessões faltam</b>
      pra bater a habitualidade — conforme a <b>IN 311/2025</b>.</div>
    <div style="position:absolute;left:78px;right:78px;top:920px;display:flex;flex-direction:column;gap:28px">
      <div class="bloco"><div class="ic">🥉</div><div class="tx">Nível 1<small>8 sessões no ano</small></div></div>
      <div class="bloco"><div class="ic">🥈</div><div class="tx">Nível 2<small>12 sessões · 4 competições</small></div></div>
      <div class="bloco"><div class="ic">🥇</div><div class="tx">Nível 3<small>20 sessões · 6 competições</small></div></div>
    </div>
    <div class="sub" style="position:absolute;left:78px;bottom:150px;font-size:26px;opacity:.75">Chega de fazer conta no papel. 📊</div>`),

  // 4 — favoritos + compartilhar notícias
  page(SW, SH, `
    <div style="position:absolute;top:286px;left:78px"><div class="etq"><i></i>NOVIDADES 3 E 4</div></div>
    <h1 style="position:absolute;top:360px;left:78px;width:940px;font-size:86px">Mais prático<br>ainda.</h1>
    <div style="position:absolute;left:78px;right:78px;top:720px;display:flex;flex-direction:column;gap:40px">
      <div class="bloco" style="flex-direction:column;align-items:flex-start;gap:20px;padding:46px 46px">
        <div style="display:flex;align-items:center;gap:22px"><div class="ic">⭐</div>
          <div class="tx" style="font-size:44px">Favoritos</div></div>
        <div class="tx"><small style="font-size:30px;margin:0">Marque as armas e documentos que você
          mais usa e acesse tudo num toque, lá no topo.</small></div>
      </div>
      <div class="bloco" style="flex-direction:column;align-items:flex-start;gap:20px;padding:46px 46px">
        <div style="display:flex;align-items:center;gap:22px"><div class="ic">📰</div>
          <div class="tx" style="font-size:44px">Compartilhar notícias</div></div>
        <div class="tx"><small style="font-size:30px;margin:0">Gostou de um comunicado? Agora é só
          compartilhar direto do app com a galera do clube.</small></div>
      </div>
    </div>`),

  // 5 — CTA
  page(SW, SH, `
    <div style="position:absolute;top:360px;left:78px"><div class="etq"><i></i>JÁ DISPONÍVEL</div></div>
    <h1 style="position:absolute;top:440px;left:78px;width:940px;font-size:100px">Atualize<br>agora.</h1>
    <div class="sub" style="position:absolute;top:780px;left:78px;width:880px;font-size:38px;line-height:1.45">
      Baixe ou atualize a <b>Carteira CAC</b> e aproveite<br>tudo que a versão 1.7 traz.</div>
    <div style="position:absolute;left:0;right:0;top:1060px;text-align:center;display:flex;flex-direction:column;gap:30px;align-items:center">
      <div class="pilula" style="font-size:36px;padding:30px 56px">🍎  App Store</div>
      <div class="pilula" style="font-size:36px;padding:30px 56px">▶  Google Play</div>
    </div>
    <div class="sub" style="position:absolute;left:0;right:0;bottom:220px;text-align:center;font-size:26px;letter-spacing:2.5px;font-weight:600;opacity:.9">
      BUSQUE POR “CARTEIRA CAC”</div>
    <div style="position:absolute;left:50%;transform:translateX(-50%);bottom:150px;font-size:40px">👆</div>`),
];

/* ============================= FEED 1080×1080 ============================= */
const FW = 1080, FH = 1080;
const feed = page(FW, FH, `
  <div style="position:absolute;top:258px;left:70px"><div class="etq" style="font-size:20px;letter-spacing:5px"><i></i>CARTEIRA CAC 1.7</div></div>
  <h1 style="position:absolute;top:312px;left:70px;width:620px;font-size:62px;letter-spacing:-1.8px">A maior<br>atualização<br>do ano.</h1>
  <div style="position:absolute;left:600px;right:60px;top:300px;display:flex;flex-direction:column;gap:22px">
    <div class="bloco" style="padding:24px 26px;gap:20px"><div class="ic" style="font-size:38px">⚡</div><div class="tx" style="font-size:27px">Acervo em segundos</div></div>
    <div class="bloco" style="padding:24px 26px;gap:20px"><div class="ic" style="font-size:38px">🥇</div><div class="tx" style="font-size:27px">Níveis de atirador</div></div>
    <div class="bloco" style="padding:24px 26px;gap:20px"><div class="ic" style="font-size:38px">⭐</div><div class="tx" style="font-size:27px">Favoritos</div></div>
    <div class="bloco" style="padding:24px 26px;gap:20px"><div class="ic" style="font-size:38px">📰</div><div class="tx" style="font-size:27px">Compartilhar notícias</div></div>
  </div>
  <div class="sub" style="position:absolute;left:70px;bottom:230px;width:480px;font-size:28px;line-height:1.4">
    4 novidades pra deixar a vida do CAC muito mais fácil.</div>
  <div class="pilula" style="position:absolute;left:70px;bottom:120px;font-size:30px;padding:24px 44px">⬇  Atualize na App Store e Google Play</div>`);

/* ================================ RENDER ================================ */
mkdirSync(join(DIR, 'stories'), { recursive: true });
mkdirSync(join(DIR, 'feed'), { recursive: true });
const nomes = ['01-capa', '02-acervo', '03-niveis', '04-favoritos-noticias', '05-baixe'];
stories.forEach((html, i) => {
  render(html, join(DIR, 'stories', `${nomes[i]}.png`), SW, SH);
  console.log('story', nomes[i]);
});
render(feed, join(DIR, 'feed', '01-novidades.png'), FW, FH);
console.log('feed 01-novidades');
console.log('OK');
