-- CreateTable
CREATE TABLE `logs_notificacao` (
  `id` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NULL,
  `canal` VARCHAR(191) NOT NULL,
  `tipo` VARCHAR(191) NOT NULL,
  `referenciaId` VARCHAR(191) NULL,
  `titulo` TEXT NULL,
  `destino` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL,
  `erro` TEXT NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `logs_notificacao_usuarioId_criadoEm_idx`(`usuarioId`, `criadoEm`),
  INDEX `logs_notificacao_tipo_criadoEm_idx`(`tipo`, `criadoEm`),
  INDEX `logs_notificacao_canal_criadoEm_idx`(`canal`, `criadoEm`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `logs_notificacao` ADD CONSTRAINT `logs_notificacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
