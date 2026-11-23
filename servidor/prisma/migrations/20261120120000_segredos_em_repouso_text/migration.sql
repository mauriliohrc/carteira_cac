-- Segredos cifrados em repouso (AES-256-GCM) ocupam mais caracteres que o texto
-- puro; alarga as colunas VARCHAR(191) que guardam segredos de comprimento
-- variável para TEXT, evitando overflow em valores longos.
ALTER TABLE `entidades_tiro` MODIFY `shSenha` TEXT NULL;
ALTER TABLE `configuracao_asaas` MODIFY `webhookToken` TEXT NULL;
