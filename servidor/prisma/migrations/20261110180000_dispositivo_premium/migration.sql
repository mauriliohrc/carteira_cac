-- AlterTable
ALTER TABLE `dispositivos_push` ADD COLUMN `premium` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `premiumTipo` VARCHAR(191) NULL;
