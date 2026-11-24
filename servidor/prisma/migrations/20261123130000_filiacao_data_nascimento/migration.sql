-- Data de nascimento do filiado (para a carteira de filiado no app). Opcional,
-- aditivo: filiações existentes ficam NULL e nada quebra.
ALTER TABLE `filiacoes_liga` ADD COLUMN `dataNascimento` VARCHAR(191) NULL;
