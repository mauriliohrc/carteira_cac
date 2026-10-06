import { randomBytes } from 'node:crypto';

import {
  ASSINATURA,
  empacotar,
  desempacotar,
  pareceEnvelope,
  SenhaIncorreta,
  type PlanoBackup,
} from '@/backup/formato';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`${condicao ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

const SENHA = 'senha-bem-secreta';

const plano: PlanoBackup = {
  assinatura: ASSINATURA,
  geradoEm: '2026-09-20T12:00:00.000Z',
  esquema: 4,
  versaoApp: '1.0.0',
  tabelas: {
    armas: [{ id: 'a1', modelo: 'G25', numero_serie: 'ABC123' }],
    documentos: [{ id: 'd1', tipo: 'craf', arma_id: 'a1', data_validade: '2027-01-01' }],
    config: [{ chave: 'app.tema', valor: 'escuro' }],
  },
  arquivos: {
    'acervo/d1/craf.pdf': Buffer.from('conteúdo binário do PDF 📄').toString('base64'),
    'fotos/a1/frente.jpg': Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10]).toString('base64'),
  },
};

const salt = new Uint8Array(randomBytes(16));
const iv = new Uint8Array(randomBytes(16));

console.log('\n1. Ida e volta com a senha certa');
{
  const envelope = empacotar(plano, SENHA, salt, iv);
  conferir('envelope tem o formato esperado', pareceEnvelope(envelope));
  conferir('conteúdo não vaza em claro', !envelope.conteudo.includes('numero_serie'));

  const volta = desempacotar(envelope, SENHA);
  conferir('preserva as tabelas', JSON.stringify(volta.tabelas) === JSON.stringify(plano.tabelas));
  conferir(
    'preserva os arquivos byte a byte',
    volta.arquivos['acervo/d1/craf.pdf'] === plano.arquivos['acervo/d1/craf.pdf'] &&
      volta.arquivos['fotos/a1/frente.jpg'] === plano.arquivos['fotos/a1/frente.jpg']
  );
}

console.log('\n2. Senha errada é rejeitada');
{
  const envelope = empacotar(plano, SENHA, salt, iv);
  let erro: unknown = null;
  try {
    desempacotar(envelope, 'senha-errada');
  } catch (e) {
    erro = e;
  }
  conferir('lança SenhaIncorreta', erro instanceof SenhaIncorreta);
}

console.log('\n3. Arquivo adulterado é rejeitado');
{
  const envelope = empacotar(plano, SENHA, salt, iv);
  const adulterado = { ...envelope, conteudo: `${envelope.conteudo.slice(0, -6)}AAAAAA` };
  let lancou = false;
  try {
    desempacotar(adulterado, SENHA);
  } catch {
    lancou = true;
  }
  conferir('conteúdo alterado não decifra', lancou);
}

console.log('\n4. pareceEnvelope filtra lixo');
{
  conferir('rejeita objeto qualquer', !pareceEnvelope({ foo: 1 }));
  conferir('rejeita null', !pareceEnvelope(null));
  conferir('rejeita outro app', !pareceEnvelope({ app: 'outro', tipo: 'backup', conteudo: 'x' }));
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam\n` : '\nTodas as verificações passaram\n');
process.exit(falhas ? 1 : 0);
