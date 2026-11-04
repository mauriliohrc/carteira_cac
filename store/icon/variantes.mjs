#!/usr/bin/env node
/**
 * Gera variantes do ícone (1024×1024, opaco) para o teste A/B da App Store (PPO).
 * Variante B ("contraste"): escudo maior, sem o losango, fundo mais escuro —
 *   mais legível no tamanho de miniatura (onde se ganha ou perde o toque).
 * Variante C ("dourado"): escudo dourado — leitura premium, mais distinto.
 * O original (A) continua sendo store/icon/icone-1024.png.
 */
import { writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const DEFS = `
  <linearGradient id="ouro" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F4D06A"/><stop offset="0.5" stop-color="#D8AE3A"/><stop offset="1" stop-color="#B8891F"/>
  </linearGradient>
  <linearGradient id="escudo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FBFAF3"/><stop offset="1" stop-color="#E9E6D6"/>
  </linearGradient>
  <linearGradient id="doc" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EEF3E6"/>
  </linearGradient>
  <filter id="sombra" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#04160A" flood-opacity="0.45"/>
  </filter>`;

// Escudo + documento + fechadura (parametrizável no preenchimento do escudo e doc).
function miolo({ fillEscudo, fillDoc, strokeDoc, linhasEscuras }) {
  return `
  <g filter="url(#sombra)">
    <path d="M512 236 L716 300 C724 302 730 309 730 318 L730 556 C730 690 636 774 512 826 C388 774 294 690 294 556 L294 318 C294 309 300 302 308 300 Z"
          fill="${fillEscudo}" stroke="url(#ouro)" stroke-width="18"/>
    <path d="M420 372 L556 372 L620 436 L620 620 C620 634 609 645 595 645 L420 645 C406 645 395 634 395 620 L395 397 C395 383 406 372 420 372 Z"
          fill="${fillDoc}" stroke="${strokeDoc}" stroke-width="7"/>
    <path d="M556 372 L556 436 L620 436 Z" fill="#E5DFC7" stroke="${strokeDoc}" stroke-width="7" stroke-linejoin="round"/>
    <rect x="430" y="470" width="150" height="15" rx="7.5" fill="${linhasEscuras[0]}"/>
    <rect x="430" y="507" width="150" height="15" rx="7.5" fill="${linhasEscuras[1]}"/>
    <rect x="430" y="544" width="105" height="15" rx="7.5" fill="${linhasEscuras[1]}"/>
    <g transform="translate(512 705)">
      <circle cx="0" cy="0" r="46" fill="#1E6A34"/>
      <circle cx="0" cy="0" r="46" fill="none" stroke="url(#ouro)" stroke-width="9"/>
      <circle cx="0" cy="-8" r="15" fill="url(#ouro)"/>
      <path d="M-9 -2 L9 -2 L15 26 L-15 26 Z" fill="url(#ouro)"/>
    </g>
  </g>`;
}

function svg({ bgTopo, bgBaixo, escala, mioloSvg }) {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTopo}"/><stop offset="1" stop-color="${bgBaixo}"/></linearGradient>
    ${DEFS}</defs>
    <rect width="1024" height="1024" fill="url(#fundo)"/>
    <ellipse cx="512" cy="120" rx="720" ry="360" fill="#ffffff" opacity="0.05"/>
    <g transform="translate(512 512) scale(${escala}) translate(-512 -512)">${mioloSvg}</g>
  </svg>`;
}

const VARIANTES = {
  'icone-var-b-contraste': svg({
    bgTopo: '#17552A', bgBaixo: '#081F0F', escala: 1.1,
    mioloSvg: miolo({ fillEscudo: 'url(#escudo)', fillDoc: 'url(#doc)', strokeDoc: '#B8891F', linhasEscuras: ['#3B5A24', '#7C8A63'] }),
  }),
  'icone-var-c-dourado': svg({
    bgTopo: '#1E6A34', bgBaixo: '#0C3016', escala: 1.04,
    mioloSvg: miolo({ fillEscudo: 'url(#ouro)', fillDoc: '#FFFFFF', strokeDoc: '#8A6414', linhasEscuras: ['#2E6B34', '#9BB08B'] }),
  }),
};

for (const [nome, corpo] of Object.entries(VARIANTES)) {
  const tmp = join(DIR, `_tmp-${nome}.html`);
  writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block}</style></head><body>${corpo}</body></html>`);
  const out = join(DIR, `${nome}.png`);
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1024,1024', `--screenshot=${out}`, `file://${tmp}`], { stdio: 'ignore' });
  rmSync(tmp);
  console.log(`  ✓ ${nome}.png`);
}
console.log('Pronto.');
