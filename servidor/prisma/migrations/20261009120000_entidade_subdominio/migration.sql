-- AlterTable
ALTER TABLE `entidades_tiro` ADD COLUMN `subdominio` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `entidades_tiro_subdominio_key` ON `entidades_tiro`(`subdominio`);
