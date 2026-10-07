-- CreateTable
CREATE TABLE `competicoes` (
    `id` VARCHAR(191) NOT NULL,
    `entidadeId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `bannerUrl` TEXT NULL,
    `regras` LONGTEXT NULL,
    `dataInicio` DATETIME(3) NOT NULL,
    `dataFim` DATETIME(3) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `competicoes_entidadeId_idx`(`entidadeId`),
    INDEX `competicoes_ativo_dataFim_idx`(`ativo`, `dataFim`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categorias_competicao` (
    `id` VARCHAR(191) NOT NULL,
    `competicaoId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `regras` LONGTEXT NULL,
    `dataInicio` DATETIME(3) NULL,
    `dataFim` DATETIME(3) NULL,
    `ordenamento` VARCHAR(191) NOT NULL DEFAULT 'MAIOR',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `categorias_competicao_competicaoId_idx`(`competicaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resultados_competicao` (
    `id` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `pontuacao` DOUBLE NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `origemNome` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `observacao` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `resultados_competicao_categoriaId_idx`(`categoriaId`),
    INDEX `resultados_competicao_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `resultados_competicao_categoriaId_cpf_key`(`categoriaId`, `cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `competicoes` ADD CONSTRAINT `competicoes_entidadeId_fkey` FOREIGN KEY (`entidadeId`) REFERENCES `entidades_tiro`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categorias_competicao` ADD CONSTRAINT `categorias_competicao_competicaoId_fkey` FOREIGN KEY (`competicaoId`) REFERENCES `competicoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resultados_competicao` ADD CONSTRAINT `resultados_competicao_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `categorias_competicao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resultados_competicao` ADD CONSTRAINT `resultados_competicao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
