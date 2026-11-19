-- CreateTable: eventos de produto/analytics (funil de onboarding), anônimos ou logados.
CREATE TABLE `eventos_app` (
    `id` VARCHAR(191) NOT NULL,
    `anonId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `evento` VARCHAR(191) NOT NULL,
    `passo` VARCHAR(191) NULL,
    `meta` TEXT NULL,
    `plataforma` VARCHAR(191) NULL,
    `appVersao` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `eventos_app_evento_idx`(`evento`),
    INDEX `eventos_app_criadoEm_idx`(`criadoEm`),
    INDEX `eventos_app_anonId_idx`(`anonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
