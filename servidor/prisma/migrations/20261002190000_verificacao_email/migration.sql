-- Verificação de e-mail (código de 6 dígitos) + anti-força-bruta no reset de senha.

-- tokens_senha: passa a guardar código de 6 dígitos (deixa de ser único) e
-- conta tentativas erradas para invalidar após o limite.
DROP INDEX `tokens_senha_tokenHash_key` ON `tokens_senha`;
ALTER TABLE `tokens_senha` ADD COLUMN `tentativas` INTEGER NOT NULL DEFAULT 0;

-- tokens_email: código de confirmação do e-mail do usuário do app.
CREATE TABLE `tokens_email` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `codigoHash` VARCHAR(191) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tokens_email_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tokens_email` ADD CONSTRAINT `tokens_email_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
