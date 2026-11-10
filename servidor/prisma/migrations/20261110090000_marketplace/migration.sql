-- AlterTable
ALTER TABLE `usuarios_app` ADD COLUMN `aceitouEulaMarketplaceEm` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `lojas_marketplace` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `logoUploadId` VARCHAR(191) NULL,
    `site` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `uf` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `verificada` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `lojas_marketplace_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anuncios_marketplace` (
    `id` VARCHAR(191) NOT NULL,
    `vendedorId` VARCHAR(191) NOT NULL,
    `lojaId` VARCHAR(191) NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `subcategoria` VARCHAR(191) NULL,
    `estadoUso` VARCHAR(191) NOT NULL,
    `precoCentavos` INTEGER NULL,
    `uf` VARCHAR(191) NOT NULL,
    `cidade` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
    `motivoRejeicao` VARCHAR(191) NULL,
    `destaqueAte` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `anuncios_marketplace_status_idx`(`status`),
    INDEX `anuncios_marketplace_categoria_idx`(`categoria`),
    INDEX `anuncios_marketplace_uf_idx`(`uf`),
    INDEX `anuncios_marketplace_destaqueAte_idx`(`destaqueAte`),
    INDEX `anuncios_marketplace_vendedorId_idx`(`vendedorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anuncio_fotos` (
    `id` VARCHAR(191) NOT NULL,
    `anuncioId` VARCHAR(191) NOT NULL,
    `uploadId` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,

    INDEX `anuncio_fotos_anuncioId_idx`(`anuncioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversas_marketplace` (
    `id` VARCHAR(191) NOT NULL,
    `anuncioId` VARCHAR(191) NOT NULL,
    `compradorId` VARCHAR(191) NOT NULL,
    `vendedorId` VARCHAR(191) NOT NULL,
    `contatoLiberado` BOOLEAN NOT NULL DEFAULT false,
    `contatoLiberadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `conversas_marketplace_compradorId_idx`(`compradorId`),
    INDEX `conversas_marketplace_vendedorId_idx`(`vendedorId`),
    UNIQUE INDEX `conversas_marketplace_anuncioId_compradorId_key`(`anuncioId`, `compradorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens_marketplace` (
    `id` VARCHAR(191) NOT NULL,
    `conversaId` VARCHAR(191) NOT NULL,
    `autorId` VARCHAR(191) NOT NULL,
    `texto` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lidaEm` DATETIME(3) NULL,

    INDEX `mensagens_marketplace_conversaId_idx`(`conversaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `denuncias_marketplace` (
    `id` VARCHAR(191) NOT NULL,
    `anuncioId` VARCHAR(191) NULL,
    `conversaId` VARCHAR(191) NULL,
    `denuncianteId` VARCHAR(191) NULL,
    `motivo` TEXT NOT NULL,
    `tratada` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `denuncias_marketplace_tratada_idx`(`tratada`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bloqueios_usuario` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `bloqueadoId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bloqueios_usuario_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `bloqueios_usuario_usuarioId_bloqueadoId_key`(`usuarioId`, `bloqueadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destaques_compra` (
    `id` VARCHAR(191) NOT NULL,
    `anuncioId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `plataforma` VARCHAR(191) NOT NULL,
    `transacaoId` VARCHAR(191) NOT NULL,
    `dias` INTEGER NOT NULL,
    `validadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `destaques_compra_transacaoId_key`(`transacaoId`),
    INDEX `destaques_compra_anuncioId_idx`(`anuncioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lojas_marketplace` ADD CONSTRAINT `lojas_marketplace_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `anuncios_marketplace` ADD CONSTRAINT `anuncios_marketplace_vendedorId_fkey` FOREIGN KEY (`vendedorId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `anuncios_marketplace` ADD CONSTRAINT `anuncios_marketplace_lojaId_fkey` FOREIGN KEY (`lojaId`) REFERENCES `lojas_marketplace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `anuncio_fotos` ADD CONSTRAINT `anuncio_fotos_anuncioId_fkey` FOREIGN KEY (`anuncioId`) REFERENCES `anuncios_marketplace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `conversas_marketplace` ADD CONSTRAINT `conversas_marketplace_anuncioId_fkey` FOREIGN KEY (`anuncioId`) REFERENCES `anuncios_marketplace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `conversas_marketplace` ADD CONSTRAINT `conversas_marketplace_compradorId_fkey` FOREIGN KEY (`compradorId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `conversas_marketplace` ADD CONSTRAINT `conversas_marketplace_vendedorId_fkey` FOREIGN KEY (`vendedorId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `mensagens_marketplace` ADD CONSTRAINT `mensagens_marketplace_conversaId_fkey` FOREIGN KEY (`conversaId`) REFERENCES `conversas_marketplace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `mensagens_marketplace` ADD CONSTRAINT `mensagens_marketplace_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `denuncias_marketplace` ADD CONSTRAINT `denuncias_marketplace_denuncianteId_fkey` FOREIGN KEY (`denuncianteId`) REFERENCES `usuarios_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `bloqueios_usuario` ADD CONSTRAINT `bloqueios_usuario_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `bloqueios_usuario` ADD CONSTRAINT `bloqueios_usuario_bloqueadoId_fkey` FOREIGN KEY (`bloqueadoId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `destaques_compra` ADD CONSTRAINT `destaques_compra_anuncioId_fkey` FOREIGN KEY (`anuncioId`) REFERENCES `anuncios_marketplace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `destaques_compra` ADD CONSTRAINT `destaques_compra_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
