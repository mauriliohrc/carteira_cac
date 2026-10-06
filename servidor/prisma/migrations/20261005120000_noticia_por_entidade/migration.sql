-- AlterTable
ALTER TABLE `noticias` ADD COLUMN `entidadeId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `noticias_entidadeId_status_publicadaEm_idx` ON `noticias`(`entidadeId`, `status`, `publicadaEm`);

-- AddForeignKey
ALTER TABLE `noticias` ADD CONSTRAINT `noticias_entidadeId_fkey` FOREIGN KEY (`entidadeId`) REFERENCES `entidades_tiro`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
