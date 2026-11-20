-- Pedido por-arma: N processos (um por arma) compartilham UMA cobrança do Asaas.
-- asaasPaymentId deixa de ser único e vira índice comum (chave de agrupamento).
DROP INDEX `processos_despachante_asaasPaymentId_key` ON `processos_despachante`;
CREATE INDEX `processos_despachante_asaasPaymentId_idx` ON `processos_despachante`(`asaasPaymentId`);
