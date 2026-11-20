-- Serviço vinculado a arma: escolhe a(s) arma(s) e paga por item; senão, valor único.
ALTER TABLE `servicos_despachante` ADD COLUMN `porArma` BOOLEAN NOT NULL DEFAULT false;

-- Serviços legados por item (CRAF por arma / guia por armamento) já nascem vinculados.
UPDATE `servicos_despachante` SET `porArma` = true WHERE `codigo` IN ('RENOVACAO_CRAF', 'EMISSAO_GUIA');
