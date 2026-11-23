/**
 * Backfill: cifra em repouso os segredos sensíveis já gravados em texto puro.
 *
 * - Senha gov.br (valorTexto) + CPF (valorCpf) dos campos SENHA_GOV do despachante
 * - Chave e webhook token do Asaas (ConfiguracaoAsaas)
 * - Senha de parceiro Shooting House (EntidadeTiro.shSenha)
 *
 * Idempotente: `cifrar` pula o que já está cifrado. RODE NO SERVIDOR com o MESMO
 * APP_CRYPTO_KEY de produção definido (senão os dados ficam ilegíveis depois):
 *   node --import tsx scripts/cifrar-segredos.ts
 */
import { prisma } from '../src/db/cliente.js';
import { cifrar, estaCifrado } from '../src/dominio/cripto.js';

async function main() {
  // 1) Campos SENHA_GOV (senha + CPF).
  const senhas = await prisma.valorCampoProcessoDespachante.findMany({
    where: { tipo: 'SENHA_GOV' },
    select: { id: true, valorTexto: true, valorCpf: true },
  });
  let nSenha = 0;
  for (const v of senhas) {
    const data: { valorTexto?: string | null; valorCpf?: string | null } = {};
    if (v.valorTexto && !estaCifrado(v.valorTexto)) data.valorTexto = cifrar(v.valorTexto);
    if (v.valorCpf && !estaCifrado(v.valorCpf)) data.valorCpf = cifrar(v.valorCpf);
    if (Object.keys(data).length) {
      await prisma.valorCampoProcessoDespachante.update({ where: { id: v.id }, data });
      nSenha++;
    }
  }
  console.log(`SENHA_GOV: ${nSenha}/${senhas.length} cifrado(s).`);

  // 2) Config do Asaas.
  const asaas = await prisma.configuracaoAsaas.findUnique({ where: { id: 'unico' } });
  if (asaas) {
    const data: { apiKey?: string | null; webhookToken?: string | null } = {};
    if (asaas.apiKey && !estaCifrado(asaas.apiKey)) data.apiKey = cifrar(asaas.apiKey);
    if (asaas.webhookToken && !estaCifrado(asaas.webhookToken)) data.webhookToken = cifrar(asaas.webhookToken);
    if (Object.keys(data).length) {
      await prisma.configuracaoAsaas.update({ where: { id: 'unico' }, data });
      console.log('Asaas: chave/token cifrado(s).');
    } else {
      console.log('Asaas: nada a cifrar.');
    }
  }

  // 3) Senha de parceiro Shooting House.
  const entidades = await prisma.entidadeTiro.findMany({
    where: { shSenha: { not: null } },
    select: { id: true, shSenha: true },
  });
  let nSh = 0;
  for (const e of entidades) {
    if (e.shSenha && !estaCifrado(e.shSenha)) {
      await prisma.entidadeTiro.update({ where: { id: e.id }, data: { shSenha: cifrar(e.shSenha) } });
      nSh++;
    }
  }
  console.log(`Shooting House: ${nSh}/${entidades.length} senha(s) cifrada(s).`);

  console.log('Concluído.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
