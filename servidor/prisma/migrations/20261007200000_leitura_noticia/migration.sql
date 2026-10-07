-- CreateTable
CREATE TABLE `leituras_noticia` (
    `id` VARCHAR(191) NOT NULL,
    `noticiaId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leituras_noticia_noticiaId_idx`(`noticiaId`),
    UNIQUE INDEX `leituras_noticia_noticiaId_usuarioId_key`(`noticiaId`, `usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leituras_noticia` ADD CONSTRAINT `leituras_noticia_noticiaId_fkey` FOREIGN KEY (`noticiaId`) REFERENCES `noticias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leituras_noticia` ADD CONSTRAINT `leituras_noticia_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios_app`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
