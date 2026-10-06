import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const nome = process.env.SEED_ADMIN_NOME ?? 'Dono do App';
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@cacbrasil.app').toLowerCase();
  const senha = process.env.SEED_ADMIN_SENHA ?? 'mudar123';

  const existente = await prisma.usuarioAdmin.findUnique({ where: { email } });
  if (existente) {
    console.log(`Super admin já existe: ${email}`);
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.usuarioAdmin.create({
    data: { nome, email, senhaHash, papel: 'SUPER_ADMIN' },
  });
  console.log(`Super admin criado: ${email} (senha: ${senha})`);
  console.log('Troque a senha após o primeiro login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
