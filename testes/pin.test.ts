import { randomBytes } from 'node:crypto';

import { conferirRegistro, criarRegistro, registroValido } from '@/seguranca/pin';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`${condicao ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

const salt = new Uint8Array(randomBytes(16));

console.log('\n1. Hash e verificação do PIN');
{
  const reg = criarRegistro('123456', salt);
  conferir('não guarda o PIN em claro', !JSON.stringify(reg).includes('123456'));
  conferir('aceita o PIN certo', conferirRegistro('123456', reg));
  conferir('recusa o PIN errado', !conferirRegistro('654321', reg));
  conferir('recusa PIN vazio', !conferirRegistro('', reg));
}

console.log('\n2. Salt diferente a cada PIN');
{
  const a = criarRegistro('000000', new Uint8Array(randomBytes(16)));
  const b = criarRegistro('000000', new Uint8Array(randomBytes(16)));
  conferir('mesmo PIN, hashes diferentes', a.hash !== b.hash);
}

console.log('\n3. registroValido filtra lixo do cofre');
{
  const reg = criarRegistro('111111', salt);
  conferir('aceita registro real', registroValido(reg));
  conferir('rejeita string vazia', !registroValido(''));
  conferir('rejeita null', !registroValido(null));
  conferir('rejeita objeto sem hash', !registroValido({ salt: 'x' }));
  conferir('rejeita hash vazio', !registroValido({ salt: 'x', hash: '' }));
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam\n` : '\nTodas as verificações passaram\n');
process.exit(falhas ? 1 : 0);
