-- CreateTable
CREATE TABLE `campanhas_whats` (
  `id` VARCHAR(191) NOT NULL,
  `mensagem` TEXT NOT NULL,
  `usarNome` BOOLEAN NOT NULL DEFAULT true,
  `filtros` TEXT NOT NULL,
  `intervaloMin` INTEGER NOT NULL DEFAULT 10,
  `intervaloMax` INTEGER NOT NULL DEFAULT 40,
  `status` VARCHAR(191) NOT NULL DEFAULT 'EM_ANDAMENTO',
  `totalAlvos` INTEGER NOT NULL,
  `totalEnviados` INTEGER NOT NULL DEFAULT 0,
  `totalFalhas` INTEGER NOT NULL DEFAULT 0,
  `autorId` VARCHAR(191) NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizadoEm` DATETIME(3) NOT NULL,

  INDEX `campanhas_whats_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `envios_whats` (
  `id` VARCHAR(191) NOT NULL,
  `campanhaId` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NULL,
  `celular` VARCHAR(191) NOT NULL,
  `nome` VARCHAR(191) NOT NULL,
  `mensagem` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDENTE',
  `erro` TEXT NULL,
  `enviadoEm` DATETIME(3) NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `envios_whats_campanhaId_status_idx`(`campanhaId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modelos_mensagem` (
  `id` VARCHAR(191) NOT NULL,
  `gatilho` VARCHAR(191) NOT NULL,
  `canal` VARCHAR(191) NOT NULL,
  `titulo` VARCHAR(191) NULL,
  `corpo` TEXT NOT NULL,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `atualizadoEm` DATETIME(3) NOT NULL,

  UNIQUE INDEX `modelos_mensagem_gatilho_canal_key`(`gatilho`, `canal`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disparos_automaticos` (
  `id` VARCHAR(191) NOT NULL,
  `usuarioId` VARCHAR(191) NOT NULL,
  `gatilho` VARCHAR(191) NOT NULL,
  `canal` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'OK',
  `erro` TEXT NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `disparos_automaticos_gatilho_idx`(`gatilho`),
  UNIQUE INDEX `disparos_automaticos_usuarioId_gatilho_canal_key`(`usuarioId`, `gatilho`, `canal`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracoes` (
  `chave` VARCHAR(191) NOT NULL,
  `valor` TEXT NOT NULL,
  `atualizadoEm` DATETIME(3) NOT NULL,

  PRIMARY KEY (`chave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `envios_whats` ADD CONSTRAINT `envios_whats_campanhaId_fkey` FOREIGN KEY (`campanhaId`) REFERENCES `campanhas_whats`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
