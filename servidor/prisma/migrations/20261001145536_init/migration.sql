-- CreateTable
CREATE TABLE `usuarios_admin` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `papel` VARCHAR(191) NOT NULL DEFAULT 'SUPER_ADMIN',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `noticias` (
    `id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `resumo` TEXT NULL,
    `conteudo` LONGTEXT NOT NULL,
    `imagemUrl` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RASCUNHO',
    `publicadaEm` DATETIME(3) NULL,
    `autorId` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `noticias_status_publicadaEm_idx`(`status`, `publicadaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `midias_noticia` (
    `id` VARCHAR(191) NOT NULL,
    `noticiaId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `legenda` TEXT NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `midias_noticia_noticiaId_idx`(`noticiaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entidades_tiro` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `cr` VARCHAR(191) NULL,
    `cnpj` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `uf` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `shIntegracaoAtiva` BOOLEAN NOT NULL DEFAULT false,
    `shBaseUrl` TEXT NULL,
    `shLogin` VARCHAR(191) NULL,
    `shSenha` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `entidades_tiro_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios_app` (
    `id` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `emailVerificado` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ultimoAcessoEm` DATETIME(3) NULL,
    `vinculosCheckEm` DATETIME(3) NULL,
    `premium` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_app_cpf_key`(`cpf`),
    UNIQUE INDEX `usuarios_app_email_key`(`email`),
    INDEX `usuarios_app_ultimoAcessoEm_idx`(`ultimoAcessoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cupons_promocionais` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `limiteUsos` INTEGER NULL,
    `usos` INTEGER NOT NULL DEFAULT 0,
    `expiraEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cupons_promocionais_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usos_cupom` (
    `id` VARCHAR(191) NOT NULL,
    `cupomId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `usos_cupom_cupomId_idx`(`cupomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vinculos_entidade` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NOT NULL,
    `origem` VARCHAR(191) NOT NULL DEFAULT 'SHOOTING_HOUSE',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vinculos_entidade_entidadeId_idx`(`entidadeId`),
    UNIQUE INDEX `vinculos_entidade_usuarioId_entidadeId_key`(`usuarioId`, `entidadeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registros_sync` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `registroId` VARCHAR(191) NOT NULL,
    `dados` LONGTEXT NOT NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,
    `removido` BOOLEAN NOT NULL DEFAULT false,
    `carimboServidor` DATETIME(3) NOT NULL,

    INDEX `registros_sync_usuarioId_carimboServidor_idx`(`usuarioId`, `carimboServidor`),
    UNIQUE INDEX `registros_sync_usuarioId_tipo_registroId_key`(`usuarioId`, `tipo`, `registroId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `arquivos_sync` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `registroId` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NULL,
    `tamanho` INTEGER NULL,
    `conteudo` LONGBLOB NOT NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `arquivos_sync_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `arquivos_sync_usuarioId_registroId_key`(`usuarioId`, `registroId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispositivos_push` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `token` VARCHAR(191) NOT NULL,
    `plataforma` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dispositivos_push_token_key`(`token`),
    INDEX `dispositivos_push_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `envios_push` (
    `id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `corpo` TEXT NOT NULL,
    `alvoTipo` VARCHAR(191) NOT NULL,
    `alvoRef` VARCHAR(191) NULL,
    `totalUsuarios` INTEGER NOT NULL DEFAULT 0,
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `totalAceitos` INTEGER NOT NULL DEFAULT 0,
    `autorId` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens_senha` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tokens_senha_tokenHash_key`(`tokenHash`),
    INDEX `tokens_senha_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios_entidade` (
    `id` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senhaHash` VARCHAR(191) NOT NULL,
    `papel` VARCHAR(191) NOT NULL DEFAULT 'ADMIN_ENTIDADE',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `usuarios_entidade_entidadeId_idx`(`entidadeId`),
    UNIQUE INDEX `usuarios_entidade_entidadeId_email_key`(`entidadeId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `noticias` ADD CONSTRAINT `noticias_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios_admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `midias_noticia` ADD CONSTRAINT `midias_noticia_noticiaId_fkey` FOREIGN KEY (`noticiaId`) REFERENCES `noticias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usos_cupom` ADD CONSTRAINT `usos_cupom_cupomId_fkey` FOREIGN KEY (`cupomId`) REFERENCES `cupons_promocionais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usos_cupom` ADD CONSTRAINT `usos_cupom_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculos_entidade` ADD CONSTRAINT `vinculos_entidade_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculos_entidade` ADD CONSTRAINT `vinculos_entidade_entidadeId_fkey` FOREIGN KEY (`entidadeId`) REFERENCES `entidades_tiro`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registros_sync` ADD CONSTRAINT `registros_sync_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `arquivos_sync` ADD CONSTRAINT `arquivos_sync_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispositivos_push` ADD CONSTRAINT `dispositivos_push_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens_senha` ADD CONSTRAINT `tokens_senha_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios_entidade` ADD CONSTRAINT `usuarios_entidade_entidadeId_fkey` FOREIGN KEY (`entidadeId`) REFERENCES `entidades_tiro`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
