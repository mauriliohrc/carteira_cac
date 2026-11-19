-- CreateTable
CREATE TABLE `filiacoes_liga` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `numeroFiliacao` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pendente_pagamento',
    `origem` VARCHAR(191) NOT NULL DEFAULT 'ASAAS',
    `nomeCompleto` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `cep` VARCHAR(191) NULL,
    `logradouro` VARCHAR(191) NULL,
    `numero` VARCHAR(191) NULL,
    `complemento` VARCHAR(191) NULL,
    `bairro` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `uf` VARCHAR(191) NULL,
    `docTipo` VARCHAR(191) NULL,
    `docArquivoId` VARCHAR(191) NULL,
    `documentacaoCompleta` BOOLEAN NOT NULL DEFAULT false,
    `asaasSubscriptionId` VARCHAR(191) NULL,
    `invoiceUrl` VARCHAR(191) NULL,
    `valorCentavos` INTEGER NOT NULL,
    `vigenteAte` DATETIME(3) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `filiacoes_liga_numeroFiliacao_key`(`numeroFiliacao`),
    UNIQUE INDEX `filiacoes_liga_asaasSubscriptionId_key`(`asaasSubscriptionId`),
    INDEX `filiacoes_liga_usuarioId_idx`(`usuarioId`),
    INDEX `filiacoes_liga_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `filiacao_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'unico',
    `valorCentavos` INTEGER NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `nomeLiga` VARCHAR(191) NULL,
    `logoUrl` TEXT NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `filiacoes_liga` ADD CONSTRAINT `filiacoes_liga_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
