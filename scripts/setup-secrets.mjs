#!/usr/bin/env node
/**
 * Setup inicial dos SEGREDOS do projeto.
 *
 *   npm run setup                       # pede a senha e recria os segredos
 *   SETUP_SENHA='...' npm run setup      # senha por variável de ambiente
 *   npm run setup -- --senha=... --force # senha por argumento; sobrescreve
 *
 * Os segredos ficam CIFRADOS em scripts/secrets-bundle.enc (AES-256-GCM, chave
 * derivada da senha por scrypt). Sem a senha, o blob é inútil. Este script
 * decifra e recria cada arquivo no lugar certo (inclusive a keystore de upload
 * e a chave do Firebase, que estão em binário dentro do bundle).
 *
 * ⚠️ A senha NÃO está no repositório — guarde-a no seu gerenciador de senhas.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scryptSync, createDecipheriv } from 'node:crypto';
import { createInterface } from 'node:readline';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const forcar = args.includes('--force');
const argSenha = args.find((a) => a.startsWith('--senha='))?.slice('--senha='.length);

function perguntarSenha() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question('Senha do bundle de segredos: ', (ans) => {
      rl.close();
      process.stdout.write('\n');
      resolve(ans);
    });
    // muta o eco da digitação
    rl._writeToOutput = () => {};
  });
}

function decifrar(blobB64, senha) {
  const buf = Buffer.from(blobB64.trim(), 'base64');
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const dados = buf.subarray(44);
  const chave = scryptSync(senha, salt, 32);
  const d = createDecipheriv('aes-256-gcm', chave, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString('utf8');
}

const senha = argSenha ?? process.env.SETUP_SENHA ?? (await perguntarSenha());
if (!senha) {
  console.error('Senha não informada.');
  process.exit(1);
}

let bundle;
try {
  const blob = readFileSync(join(RAIZ, 'scripts/secrets-bundle.enc'), 'utf8');
  bundle = JSON.parse(decifrar(blob, senha));
} catch {
  console.error('Falha ao decifrar — senha incorreta ou bundle corrompido.');
  process.exit(1);
}

let criados = 0;
let pulados = 0;
for (const { path, encoding, data } of bundle) {
  const destino = join(RAIZ, path);
  if (existsSync(destino) && !forcar) {
    console.log(`• já existe (pulado): ${path}`);
    pulados++;
    continue;
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, encoding === 'base64' ? Buffer.from(data, 'base64') : data);
  console.log(`✓ criado: ${path}`);
  criados++;
}

console.log(`\n${criados} criado(s), ${pulados} já existente(s).`);
if (pulados && !forcar) console.log('Use "npm run setup -- --force" para sobrescrever.');
console.log('\nLembretes:');
console.log(' - servidor/.env aponta o banco para o túnel SSH (127.0.0.1:3307).');
console.log('   Abra o túnel: ssh -f -N -L 3307:127.0.0.1:3306 app@api.carteiracac.com');
console.log(' - .env.local usa a API de produção; troque p/ seu IP da LAN em dev local.');
