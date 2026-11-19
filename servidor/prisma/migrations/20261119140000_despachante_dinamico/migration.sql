-- Despachante dinâmico: catálogo de serviços, status (CRUD), campos de formulário
-- por serviço e valores/anexos por processo. Aditivo — nada remove nem altera o
-- contrato de sync com apps antigos.

-- AlterTable: anotação interna do processo (não vai para o app).
ALTER TABLE `processos_despachante` ADD COLUMN `observacao` TEXT NULL;

-- CreateTable: catálogo dinâmico de serviços.
CREATE TABLE `servicos_despachante` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `subtitulo` VARCHAR(191) NULL,
    `descricao` TEXT NOT NULL,
    `comoFunciona` TEXT NULL,
    `icone` VARCHAR(191) NOT NULL DEFAULT 'briefcase-outline',
    `gruCentavos` INTEGER NOT NULL DEFAULT 0,
    `servicoCentavos` INTEGER NOT NULL DEFAULT 0,
    `unidade` VARCHAR(191) NOT NULL DEFAULT 'por processo',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `mensagemWhatsappInicio` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `servicos_despachante_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: status dinâmico do processo.
CREATE TABLE `status_processo_despachante` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `cor` VARCHAR(191) NOT NULL DEFAULT '#8a8f98',
    `icone` VARCHAR(191) NULL,
    `papel` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `status_processo_despachante_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: campos do formulário por serviço.
CREATE TABLE `campos_servico_despachante` (
    `id` VARCHAR(191) NOT NULL,
    `servicoId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'ARQUIVO',
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `obrigatorio` BOOLEAN NOT NULL DEFAULT true,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `campos_servico_despachante_servicoId_idx`(`servicoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: valores preenchidos / anexos finais por processo.
CREATE TABLE `valores_campo_processo_despachante` (
    `id` VARCHAR(191) NOT NULL,
    `processoId` VARCHAR(191) NOT NULL,
    `campoId` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `mime` VARCHAR(191) NULL,
    `tamanho` INTEGER NULL,
    `conteudo` LONGBLOB NULL,
    `valorTexto` TEXT NULL,
    `valorCpf` VARCHAR(191) NULL,
    `origem` VARCHAR(191) NOT NULL DEFAULT 'USUARIO',
    `final` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ENVIADO',
    `motivo` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `valores_campo_processo_despachante_processoId_idx`(`processoId`),
    UNIQUE INDEX `valores_campo_processo_despachante_processoId_campoId_key`(`processoId`, `campoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `campos_servico_despachante` ADD CONSTRAINT `campos_servico_despachante_servicoId_fkey` FOREIGN KEY (`servicoId`) REFERENCES `servicos_despachante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `valores_campo_processo_despachante` ADD CONSTRAINT `valores_campo_processo_despachante_processoId_fkey` FOREIGN KEY (`processoId`) REFERENCES `processos_despachante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
