#!/usr/bin/env node
/**
 * Gera TODOS os criativos da App Store para as Custom Product Pages, a partir
 * dos screenshots crus do app. Renderiza via Chrome headless (tamanho exato).
 *
 * Por página produz:
 *   - 6.9/   screenshots 1320×2868 (iPhone 6.9")
 *   - 6.3/   screenshots 1206×2622 (iPhone com Dynamic Island, "medium display")
 *   - header.png   3840×1646  (21:9, asset de Header da product page)
 *   - search.png   3840×2560  (3:2, asset de Search Results)
 * Todos opacos (sem alfa), como a Apple exige para header/search.
 *
 * Uso:  node store/cpp/gerar.mjs            # tudo
 *       node store/cpp/gerar.mjs atirador   # uma página
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FONTE = join(RAIZ, 'store', 'screenshots', '6.9');
const SAIDA = join(RAIZ, 'store', 'cpp');
const ICONE = join(RAIZ, 'store', 'icon', 'icone-1024.png');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const COR = { fundoTopo: '#0B2E16', fundoBaixo: '#16522A', texto: '#FFFFFF', acento: '#E8B64C' };
const FUNDO = `linear-gradient(165deg, ${COR.fundoTopo} 0%, ${COR.fundoBaixo} 100%)`;
const FONT = `-apple-system, 'Helvetica Neue', Arial, sans-serif`;

// Tamanhos de screenshot exigidos (retrato).
const TAMANHOS = [
  { dir: '6.9', w: 1320, h: 2868 },
  { dir: '6.3', w: 1206, h: 2622 },
];

const PAGINAS = {
  atirador: {
    titulo: 'Atirador desportivo / habitualidade',
    hero: 'Habitualidade e prazos\nsob controle',
    heroSub: 'CRAF, guias, laudos e avisos antes de cada vencimento.',
    telas: [
      { src: '1-painel.png', cap: 'Sua vida de CAC\norganizada num painel' },
      { src: '5-avisos.png', cap: 'Avisos diários antes\nde cada vencimento' },
      { src: '3-arma.png', cap: 'CRAF, guias e laudos\nde cada arma' },
      { src: '4-documento.png', cap: 'Seus documentos à mão,\naté sem internet' },
      { src: '2-acervo.png', cap: 'Todo o acervo\nsempre em ordem' },
      { src: '6-seguranca.png', cap: 'Protegido por\nPIN e Face ID' },
    ],
  },
  colecionador: {
    titulo: 'Colecionador / acervo grande',
    hero: 'Todo o seu acervo\nem ordem',
    heroSub: 'Documentos anexados, avisos de vencimento e backup protegido.',
    telas: [
      { src: '2-acervo.png', cap: 'Todo o seu acervo\nnum só lugar' },
      { src: '3-arma.png', cap: 'Cada arma com\nseus documentos' },
      { src: '4-documento.png', cap: 'CRAF e laudos\nanexados e à mão' },
      { src: '5-avisos.png', cap: 'Nenhum vencimento\npassa despercebido' },
      { src: '1-painel.png', cap: 'Visão geral\ndo seu acervo' },
      { src: '6-seguranca.png', cap: 'Seus dados\nsó no seu aparelho' },
    ],
  },
  'posse-porte': {
    titulo: 'Posse / Porte (defesa pessoal)',
    hero: 'Seu porte\nsempre em dia',
    heroSub: 'Avisos antes do vencimento, laudo e documentos sempre com você.',
    telas: [
      { src: '5-avisos.png', cap: 'Seu porte nunca\nvence sem aviso' },
      { src: '4-documento.png', cap: 'Posse, porte e laudo\nsempre com você' },
      { src: '3-arma.png', cap: 'Os dados da sua arma\nem ordem' },
      { src: '1-painel.png', cap: 'Tudo sob controle\nnum só painel' },
      { src: '6-seguranca.png', cap: 'PIN e Face ID\nprotegem tudo' },
      { src: '2-acervo.png', cap: 'Simples, no\nseu bolso' },
    ],
  },
  vencimentos: {
    titulo: 'Vencimentos (universal, alta intenção)',
    hero: 'Nunca mais um\nvencimento perdido',
    heroSub: 'O app acompanha cada validade e te avisa no último mês.',
    telas: [
      { src: '5-avisos.png', cap: 'Nunca mais um\ndocumento vencido' },
      { src: '1-painel.png', cap: 'Veja o que\nvence primeiro' },
      { src: '4-documento.png', cap: 'Anexe e abra\nquando precisar' },
      { src: '3-arma.png', cap: 'Organizado\npor arma' },
      { src: '2-acervo.png', cap: 'Seu acervo\nsempre em dia' },
      { src: '6-seguranca.png', cap: 'Seguro\ne privado' },
    ],
  },
};

const uri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const esc = (s) => s.replace(/</g, '&lt;');

function render(htmlStr, out, w, h) {
  const tmp = join(SAIDA, `_tmp-${Math.abs(hash(out))}.html`);
  writeFileSync(tmp, htmlStr);
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${out}`, `file://${tmp}`], { stdio: 'ignore' });
  rmSync(tmp);
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// ---- Screenshot (retrato, legenda em cima) ----
function htmlScreenshot(cap, imgUri, w, h) {
  const k = w / 1320; // escala a tipografia conforme o tamanho
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden}
  .page{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;background:${FUNDO};font-family:${FONT}}
  .cap{color:${COR.texto};text-align:center;font-weight:800;font-size:${Math.round(92 * k)}px;line-height:1.08;letter-spacing:-1px;padding:${Math.round(150 * k)}px ${Math.round(110 * k)}px 0;white-space:pre-line;text-shadow:0 2px 18px rgba(0,0,0,.25)}
  .shot{flex:1;display:flex;align-items:center;justify-content:center;width:100%;padding:${Math.round(70 * k)}px 0 ${Math.round(120 * k)}px}
  .shot img{max-height:100%;max-width:84%;border-radius:${Math.round(52 * k)}px;box-shadow:0 40px 90px rgba(0,0,0,.45);outline:2px solid rgba(255,255,255,.08)}
  </style><div class="page"><div class="cap">${esc(cap)}</div><div class="shot"><img src="${imgUri}"></div></div>`;
}

// ---- Header (21:9, 3840×1646): texto à esquerda, telefone espiando à direita ----
function htmlHeader(pag, shotUri, iconUri) {
  const W = 3840, H = 1646;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}
  .page{width:${W}px;height:${H}px;display:flex;align-items:center;background:${FUNDO};font-family:${FONT};position:relative}
  .txt{width:62%;padding:0 0 0 220px;color:#fff}
  .marca{display:flex;align-items:center;gap:28px;margin-bottom:44px}
  .marca img{width:132px;height:132px;border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  .marca span{font-weight:800;font-size:58px;letter-spacing:3px}
  .h{font-weight:800;font-size:180px;line-height:1.02;letter-spacing:-3px;white-space:pre-line;text-shadow:0 3px 24px rgba(0,0,0,.3)}
  .sub{font-size:66px;color:#d9eadf;margin-top:40px;max-width:1700px;opacity:.9}
  .fone{position:absolute;right:120px;top:50%;transform:translateY(-50%) rotate(-8deg);height:2050px;border-radius:70px;box-shadow:0 60px 120px rgba(0,0,0,.5);outline:3px solid rgba(255,255,255,.08)}
  </style><div class="page">
    <div class="txt">
      <div class="marca"><img src="${iconUri}"><span>CARTEIRA CAC</span></div>
      <div class="h">${esc(pag.hero)}</div>
      <div class="sub">${esc(pag.heroSub)}</div>
    </div>
    <img class="fone" src="${shotUri}">
  </div>`;
}

// ---- Search Results (3:2, 3840×2560): título em cima, 2 telefones angulados ----
function htmlSearch(pag, shot1, shot2, iconUri) {
  const W = 3840, H = 2560;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}
  .page{width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;background:${FUNDO};font-family:${FONT}}
  .marca{display:flex;align-items:center;gap:26px;margin-top:150px}
  .marca img{width:120px;height:120px;border-radius:28px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  .marca span{color:#fff;font-weight:800;font-size:52px;letter-spacing:3px}
  .h{color:#fff;font-weight:800;font-size:150px;line-height:1.04;letter-spacing:-2px;text-align:center;white-space:pre-line;margin-top:40px;padding:0 160px;text-shadow:0 3px 24px rgba(0,0,0,.3)}
  .fones{flex:1;display:flex;align-items:center;justify-content:center;gap:120px;width:100%;padding:40px 0 140px}
  .fones img{height:1420px;border-radius:60px;box-shadow:0 50px 110px rgba(0,0,0,.5);outline:3px solid rgba(255,255,255,.08)}
  .fones img.a{transform:rotate(-6deg)} .fones img.b{transform:rotate(6deg)}
  </style><div class="page">
    <div class="marca"><img src="${iconUri}"><span>CARTEIRA CAC</span></div>
    <div class="h">${esc(pag.hero)}</div>
    <div class="fones"><img class="a" src="${shot1}"><img class="b" src="${shot2}"></div>
  </div>`;
}

function gerarPagina(chave) {
  const pag = PAGINAS[chave];
  const iconUri = uri(ICONE);

  // Screenshots nos dois tamanhos.
  for (const t of TAMANHOS) {
    const dir = join(SAIDA, chave, t.dir);
    mkdirSync(dir, { recursive: true });
    pag.telas.forEach((tela, i) => {
      const out = join(dir, `${i + 1}-${tela.src}`);
      render(htmlScreenshot(tela.cap, uri(join(FONTE, tela.src)), t.w, t.h), out, t.w, t.h);
    });
    console.log(`  ✓ ${chave}/${t.dir}/ (6 telas)`);
  }

  // Header + Search Results (usam os screenshots crus das 2 primeiras telas).
  const dir = join(SAIDA, chave);
  const s1 = uri(join(FONTE, pag.telas[0].src));
  const s2 = uri(join(FONTE, pag.telas[1].src));
  render(htmlHeader(pag, s1, iconUri), join(dir, 'header.png'), 3840, 1646);
  console.log(`  ✓ ${chave}/header.png (3840×1646)`);
  render(htmlSearch(pag, s1, s2, iconUri), join(dir, 'search.png'), 3840, 2560);
  console.log(`  ✓ ${chave}/search.png (3840×2560)`);
}

const alvo = process.argv[2];
const chaves = alvo ? [alvo] : Object.keys(PAGINAS);
for (const c of chaves) {
  if (!PAGINAS[c]) { console.error(`página desconhecida: ${c}`); process.exit(1); }
  console.log(`\n# ${c} — ${PAGINAS[c].titulo}`);
  gerarPagina(c);
}
console.log('\nPronto.');
