-- CreateTable
CREATE TABLE `contatos` (
  `id` VARCHAR(191) NOT NULL,
  `nome` VARCHAR(191) NOT NULL,
  `telefone` VARCHAR(191) NOT NULL,
  `assunto` VARCHAR(191) NOT NULL,
  `mensagem` TEXT NOT NULL,
  `tratado` BOOLEAN NOT NULL DEFAULT false,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `contatos_tratado_criadoEm_idx`(`tratado`, `criadoEm`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
