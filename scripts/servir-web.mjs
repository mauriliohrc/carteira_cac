#!/usr/bin/env node
/**
 * Servidor estático da prévia web.
 *
 * Existe por um motivo específico: o expo-sqlite roda no navegador via
 * wa-sqlite, que usa SharedArrayBuffer. O navegador só libera SharedArrayBuffer
 * em contexto cross-origin isolado, o que exige os cabeçalhos COOP e COEP no
 * *documento* HTML. O dev server do Expo serve o index.html num middleware que
 * roda antes do hook de configuração do Metro, então não dá para injetar os
 * cabeçalhos lá — daí este servidor.
 *
 *   node scripts/servir-web.mjs [pasta] [porta]
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const RAIZ = resolve(process.argv[2] ?? 'dist');
const PORTA = Number(process.argv[3] ?? 8080);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

if (!existsSync(join(RAIZ, 'index.html'))) {
  console.error(`\nNão achei index.html em ${RAIZ}.`);
  console.error('Gere a prévia primeiro:  npx expo export --platform web --output-dir dist\n');
  process.exit(1);
}

/**
 * Armadilha de erro injetada no HTML da prévia.
 *
 * Com `web.output: 'single'` o Expo gera o index.html sozinho e ignora um
 * `+html.tsx`, então não dá para pôr isso no código do app. E sem isso uma
 * falha antes de o React montar deixa a página **branca e muda** — o pior
 * tipo de defeito, porque não sobra nada para investigar. Aqui a mensagem
 * aparece na própria tela.
 */
const ARMADILHA = `
<style>
  #falha { position: fixed; inset: 0; z-index: 99999; display: none; padding: 24px;
           overflow: auto; background: #1a0f0d; color: #ffd9d2;
           font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
  #falha h1 { font: 600 15px/1.4 system-ui, sans-serif; color: #ff9c8a; margin: 0 0 4px; }
  #falha p  { font: 13px/1.5 system-ui, sans-serif; color: #c9a9a3; margin: 0 0 16px; }
  #falha pre { white-space: pre-wrap; word-break: break-word; margin: 0 0 16px;
               padding: 12px; border-radius: 8px; background: #2a1714; }
</style>
<script>
(function () {
  function mostrar(titulo, detalhe) {
    var caixa = document.getElementById('falha');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.id = 'falha';
      caixa.innerHTML = '<h1>O app nao conseguiu abrir</h1>' +
        '<p>Copie a mensagem abaixo e envie: e o que falta para corrigir.</p>';
      (document.body || document.documentElement).appendChild(caixa);
    }
    var bloco = document.createElement('pre');
    bloco.textContent = titulo + '\\n\\n' + (detalhe || '(sem pilha)');
    caixa.appendChild(bloco);
    caixa.style.display = 'block';
  }
  window.addEventListener('error', function (e) {
    mostrar(String(e.message || 'Erro'), (e.error && e.error.stack) || (e.filename + ':' + e.lineno));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    mostrar('Promessa rejeitada: ' + ((r && r.message) || String(r)), r && r.stack);
  });
  // Se passados 6s nada foi desenhado, o problema e silencioso: avisa mesmo assim.
  setTimeout(function () {
    var raiz = document.getElementById('root');
    if (raiz && raiz.children.length === 0) {
      mostrar('Tela em branco', 'O React nao desenhou nada em 6s e nenhum erro foi lancado. ' +
        'Provavel travamento em carregamento (banco, permissao) ou layout sem altura.');
    }
  }, 6000);
})();
</script>
`;

const servidor = createServer((req, res) => {
  // Sem estes dois o SharedArrayBuffer fica indisponível e o banco não abre.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');

  const caminho = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // normalize + a checagem de prefixo barram travessia de diretório (../).
  const candidato = normalize(join(RAIZ, caminho));
  if (!candidato.startsWith(RAIZ)) {
    res.writeHead(403).end('Proibido');
    return;
  }

  const alvo =
    existsSync(candidato) && statSync(candidato).isFile()
      ? candidato
      : join(RAIZ, 'index.html'); // rotas do expo-router caem no SPA

  // O HTML sai com a armadilha embutida; o resto vai por stream.
  if (extname(alvo) === '.html') {
    const html = readFileSync(alvo, 'utf8').replace('</head>', `${ARMADILHA}</head>`);
    res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
    res.end(html);
    return;
  }

  res.writeHead(200, { 'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream' });

  const fluxo = createReadStream(alvo);
  // Sem este handler, um arquivo que some no meio da requisição (um rebuild
  // apagando dist/, por exemplo) emite 'error' sem ouvinte e derruba o
  // processo inteiro em vez de falhar só aquela resposta.
  fluxo.on('error', () => res.end());
  fluxo.pipe(res);
});

// Rede de segurança: nenhuma falha isolada deve matar a prévia.
servidor.on('clientError', (_erro, socket) => socket.destroy());
process.on('uncaughtException', (erro) => console.error('[prévia] erro ignorado:', erro.message));

servidor.listen(PORTA, () => {
  console.log(`\n  Prévia web do CAC Brasil`);
  console.log(`  servindo ${RAIZ}`);
  console.log(`\n  →  http://localhost:${PORTA}\n`);
  console.log('  Ctrl+C para parar.\n');
});
