-- AlterTable
ALTER TABLE `usuarios_app` ADD COLUMN `asaasCustomerId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `processos_despachante` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tipoServico` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'aguardando_pagamento',
    `valorCentavos` INTEGER NOT NULL,
    `quantidade` INTEGER NOT NULL DEFAULT 1,
    `armaId` VARCHAR(191) NULL,
    `armaNome` VARCHAR(191) NULL,
    `asaasPaymentId` VARCHAR(191) NULL,
    `invoiceUrl` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `processos_despachante_asaasPaymentId_key`(`asaasPaymentId`),
    INDEX `processos_despachante_usuarioId_idx`(`usuarioId`),
    INDEX `processos_despachante_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicos_despachante_config` (
    `tipoServico` VARCHAR(191) NOT NULL,
    `gruCentavos` INTEGER NOT NULL,
    `servicoCentavos` INTEGER NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `atualizadoEm` DATETIME(3) NOT NULL,

    PRIMARY KEY (`tipoServico`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracao_asaas` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'unico',
    `ambiente` VARCHAR(191) NOT NULL DEFAULT 'sandbox',
    `apiKey` TEXT NULL,
    `webhookToken` VARCHAR(191) NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `processos_despachante` ADD CONSTRAINT `processos_despachante_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
