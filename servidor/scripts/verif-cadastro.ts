/**
 * Verificação da regra "CPF só trava com e-mail validado" (rota /app/auth/cadastro).
 *
 * Replica a lógica da rota e a exercita de ponta a ponta DENTRO de uma transação
 * que é SEMPRE revertida no final — nada é gravado no banco de produção.
 *
 *   npx tsx scripts/verif-cadastro.ts      # requer o túnel do banco (3307)
 */
import { prisma } from '../src/db/cliente.js';

const CPF = '00000000000'; // CPF inválido, não é de ninguém
const EMAIL_ERRADO = 'verif-errado@example.invalid';
const EMAIL_CERTO = 'verif-certo@example.invalid';
const EMAIL_OUTRO = 'verif-outro@example.invalid';
const CPF_B = '99999999999';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Mesma lógica da rota de cadastro (appAuth.ts), para exercê-la fielmente.
async function cadastrar(tx: Tx, cpf: string, email: string) {
  const conflitantes = await tx.usuarioApp.findMany({
    where: { OR: [{ cpf }, { email }] },
    select: { id: true, cpf: true, email: true, emailVerificado: true },
  });
  if (conflitantes.some((u) => u.emailVerificado && u.cpf === cpf)) throw new Error('CONFLITO_CPF');
  if (conflitantes.some((u) => u.emailVerificado && u.email === email)) throw new Error('CONFLITO_EMAIL');
  if (conflitantes.length) {
    await tx.usuarioApp.deleteMany({ where: { id: { in: conflitantes.map((u) => u.id) } } });
  }
  return tx.usuarioApp.create({ data: { nome: 'Verif', cpf, email, senhaHash: 'x' } });
}

async function main() {
  // Segurança: aborta se os dados de teste já existirem (não poluir / não confundir).
  const existe = await prisma.usuarioApp.findMany({
    where: { OR: [{ cpf: CPF }, { cpf: CPF_B }, { email: { in: [EMAIL_ERRADO, EMAIL_CERTO, EMAIL_OUTRO] } }] },
    select: { id: true },
  });
  if (existe.length) {
    console.error('ABORTA: dados de teste já existem em produção — troque os valores.');
    process.exit(1);
  }

  const log: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      // 1) cadastro com e-mail errado -> conta pendente A
      const a = await cadastrar(tx, CPF, EMAIL_ERRADO);
      log.push(`1) criou pendente A (email=${a.email}, verificado=${a.emailVerificado})`);

      // 2) re-cadastro mesmo CPF com e-mail certo -> A some, B criada
      const b = await cadastrar(tx, CPF, EMAIL_CERTO);
      const aAinda = await tx.usuarioApp.findUnique({ where: { id: a.id } });
      const total = await tx.usuarioApp.count({ where: { cpf: CPF } });
      log.push(`2) re-cadastro e-mail certo -> A ainda existe? ${!!aAinda} | contas c/ CPF=${total} | B.email=${b.email}`);
      if (aAinda) throw new Error('FALHA: a conta pendente antiga NÃO foi removida');
      if (total !== 1) throw new Error(`FALHA: deveria haver exatamente 1 conta com o CPF (achou ${total})`);

      // 3) valida o e-mail da B
      await tx.usuarioApp.update({ where: { id: b.id }, data: { emailVerificado: true } });
      log.push('3) validou o e-mail da B');

      // 4) novo cadastro mesmo CPF (outro e-mail) -> deve BLOQUEAR por CPF
      let bloqueouCpf = false;
      try { await cadastrar(tx, CPF, EMAIL_OUTRO); }
      catch (e) { bloqueouCpf = (e as Error).message === 'CONFLITO_CPF'; }
      log.push(`4) novo cadastro mesmo CPF após validar -> bloqueou por CPF? ${bloqueouCpf}`);
      if (!bloqueouCpf) throw new Error('FALHA: CPF validado deveria bloquear novo cadastro');

      // 5) novo cadastro (CPF diferente) reusando o e-mail já validado -> BLOQUEAR por e-mail
      let bloqueouEmail = false;
      try { await cadastrar(tx, CPF_B, EMAIL_CERTO); }
      catch (e) { bloqueouEmail = (e as Error).message === 'CONFLITO_EMAIL'; }
      log.push(`5) reusar e-mail validado (CPF diferente) -> bloqueou por e-mail? ${bloqueouEmail}`);
      if (!bloqueouEmail) throw new Error('FALHA: e-mail validado deveria bloquear novo cadastro');

      // Tudo passou -> força rollback (nada é gravado em produção).
      throw new Error('__ROLLBACK_OK__');
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.log(log.join('\n'));
    if (msg === '__ROLLBACK_OK__') {
      console.log('\n✅ TODOS OS CASOS PASSARAM (transação revertida — nada gravado em prod).');
    } else {
      console.error('\n❌ ' + msg);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
