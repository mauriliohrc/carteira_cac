-- AlterTable
ALTER TABLE `usuarios_app` ADD COLUMN `appAccountToken` VARCHAR(191) NULL,
    ADD COLUMN `winbackParceiroEm` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `assinaturas_app` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `plataforma` VARCHAR(191) NOT NULL DEFAULT 'IOS',
    `originalTransactionId` VARCHAR(191) NOT NULL,
    `produtoId` VARCHAR(191) NOT NULL,
    `premiumTipo` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ATIVA',
    `autoRenova` BOOLEAN NOT NULL DEFAULT true,
    `ambiente` VARCHAR(191) NOT NULL DEFAULT 'Production',
    `expiraEm` DATETIME(3) NULL,
    `iniciouEm` DATETIME(3) NULL,
    `canceladaEm` DATETIME(3) NULL,
    `expirouEm` DATETIME(3) NULL,
    `motivo` VARCHAR(191) NULL,
    `winbackStatus` VARCHAR(191) NULL,
    `winbackEm` DATETIME(3) NULL,
    `observacao` TEXT NULL,
    `ultimoEventoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assinaturas_app_originalTransactionId_key`(`originalTransactionId`),
    INDEX `assinaturas_app_usuarioId_idx`(`usuarioId`),
    INDEX `assinaturas_app_status_idx`(`status`),
    INDEX `assinaturas_app_expiraEm_idx`(`expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos_assinatura` (
    `id` VARCHAR(191) NOT NULL,
    `assinaturaId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `subtipo` VARCHAR(191) NULL,
    `notificationUUID` VARCHAR(191) NULL,
    `payload` LONGTEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `eventos_assinatura_notificationUUID_key`(`notificationUUID`),
    INDEX `eventos_assinatura_assinaturaId_idx`(`assinaturaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_app_appAccountToken_key` ON `usuarios_app`(`appAccountToken`);

-- AddForeignKey
ALTER TABLE `assinaturas_app` ADD CONSTRAINT `assinaturas_app_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_assinatura` ADD CONSTRAINT `eventos_assinatura_assinaturaId_fkey` FOREIGN KEY (`assinaturaId`) REFERENCES `assinaturas_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
