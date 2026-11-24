-- Preço do despachante diferenciado por faixa de quantidade (serviços por-arma)
-- e por filiação à liga. Opt-in: serviço SEM faixas mantém o preço legado
-- (gruCentavos + servicoCentavos) para todos — nada muda no que já existe.
CREATE TABLE `faixas_preco_despachante` (
  `id` VARCHAR(191) NOT NULL,
  `servicoId` VARCHAR(191) NOT NULL,
  `qtdMin` INTEGER NOT NULL DEFAULT 1,
  `precoCentavos` INTEGER NOT NULL,
  `precoFiliadoCentavos` INTEGER NOT NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizadoEm` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `faixas_preco_despachante_servicoId_qtdMin_key` (`servicoId`, `qtdMin`),
  INDEX `faixas_preco_despachante_servicoId_idx` (`servicoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `faixas_preco_despachante`
  ADD CONSTRAINT `faixas_preco_despachante_servicoId_fkey`
  FOREIGN KEY (`servicoId`) REFERENCES `servicos_despachante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
