import { PrismaClient } from '@prisma/client';

// Instância única do Prisma Client reaproveitada em todo o servidor.
// O Prisma Client é agnóstico ao banco: nada aqui muda ao trocar SQLite por MySQL.
export const prisma = new PrismaClient();
