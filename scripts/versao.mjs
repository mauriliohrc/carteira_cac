#!/usr/bin/env node
/**
 * Versionamento do app — fonte única em app.json, sincronizando os arquivos
 * nativos. iOS (buildNumber/CFBundleVersion/CURRENT_PROJECT_VERSION) e Android
 * (versionCode) são INDEPENDENTES: dá para incrementar um sem mexer no outro.
 *
 * Uso:
 *   node scripts/versao.mjs                      # mostra o estado atual
 *   node scripts/versao.mjs bump ios             # +1 no build do iOS
 *   node scripts/versao.mjs bump android         # +1 no versionCode Android
 *   node scripts/versao.mjs bump both            # +1 nos dois
 *   node scripts/versao.mjs set-build ios 12     # fixa o build do iOS em 12
 *   node scripts/versao.mjs set-build android 12 # fixa o versionCode em 12
 *   node scripts/versao.mjs set-nome 1.5.0       # muda a versão de marketing
 *
 * Atalhos npm: `npm run versao`, `npm run versao:bump:ios`, etc.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  appJson: join(RAIZ, 'app.json'),
  gradle: join(RAIZ, 'android/app/build.gradle'),
  plist: join(RAIZ, 'ios/CarteiraCAC/Info.plist'),
  pbxproj: join(RAIZ, 'ios/CarteiraCAC.xcodeproj/project.pbxproj'),
};

const ler = (p) => readFileSync(p, 'utf8');
const salvar = (p, s) => writeFileSync(p, s);

function lerEstado() {
  const app = JSON.parse(ler(P.appJson));
  return {
    app,
    versao: app.expo.version,
    ios: Number(app.expo.ios.buildNumber),
    android: Number(app.expo.android.versionCode),
  };
}

/** Reescreve app.json + nativos a partir do estado desejado. */
function aplicar({ versao, ios, android }) {
  // app.json
  const app = JSON.parse(ler(P.appJson));
  app.expo.version = versao;
  app.expo.ios.buildNumber = String(ios);
  app.expo.android.versionCode = android;
  salvar(P.appJson, JSON.stringify(app, null, 2) + '\n');

  // android/app/build.gradle
  let g = ler(P.gradle);
  g = g.replace(/versionCode\s+\d+/, `versionCode ${android}`);
  g = g.replace(/versionName\s+"[^"]*"/, `versionName "${versao}"`);
  salvar(P.gradle, g);

  // ios Info.plist — CFBundleShortVersionString (versão) e CFBundleVersion (build)
  let pl = ler(P.plist);
  pl = pl.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${versao}$2`
  );
  pl = pl.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${ios}$2`
  );
  salvar(P.plist, pl);

  // ios pbxproj — MARKETING_VERSION (versão) e CURRENT_PROJECT_VERSION (build)
  let pb = ler(P.pbxproj);
  pb = pb.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versao};`);
  pb = pb.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${ios};`);
  salvar(P.pbxproj, pb);
}

function mostrar(e) {
  console.log(`versão (marketing): ${e.versao}`);
  console.log(`iOS build (CFBundleVersion):   ${e.ios}`);
  console.log(`Android versionCode:           ${e.android}`);
}

// -------------------------------------------------------------- CLI
const [acao, alvo, valor] = process.argv.slice(2);
const e = lerEstado();

if (!acao) {
  mostrar(e);
  process.exit(0);
}

if (acao === 'bump') {
  if (!['ios', 'android', 'both'].includes(alvo)) {
    console.error('Use: bump ios|android|both');
    process.exit(1);
  }
  const ios = alvo === 'ios' || alvo === 'both' ? e.ios + 1 : e.ios;
  const android = alvo === 'android' || alvo === 'both' ? e.android + 1 : e.android;
  aplicar({ versao: e.versao, ios, android });
  console.log(`✓ bump ${alvo}`);
  mostrar(lerEstado());
} else if (acao === 'set-build') {
  const n = Number(valor);
  if (!['ios', 'android'].includes(alvo) || !Number.isInteger(n) || n < 1) {
    console.error('Use: set-build ios|android <n>');
    process.exit(1);
  }
  aplicar({
    versao: e.versao,
    ios: alvo === 'ios' ? n : e.ios,
    android: alvo === 'android' ? n : e.android,
  });
  console.log(`✓ set-build ${alvo} ${n}`);
  mostrar(lerEstado());
} else if (acao === 'set-nome') {
  if (!valor || !/^\d+\.\d+(\.\d+)?$/.test(valor)) {
    console.error('Use: set-nome <x.y.z>');
    process.exit(1);
  }
  aplicar({ versao: valor, ios: e.ios, android: e.android });
  console.log(`✓ set-nome ${valor}`);
  mostrar(lerEstado());
} else {
  console.error(`Ação desconhecida: ${acao}`);
  process.exit(1);
}
