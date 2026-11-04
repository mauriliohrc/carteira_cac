import type { Processo, StatusProcesso, TipoServicoDespachante } from '@/domain/tipos';
import { abrirBanco } from './index';

/**
 * Leitura dos processos de despachante no banco local. Os processos são
 * server-owned: criados e tocados pelo servidor (cobrança Asaas) e espelhados
 * aqui só pela sincronização (pull). Por isso este módulo NÃO tem criar/remover
 * que façam push — só lê e faz upsert local otimista logo após o pedido, até o
 * próximo pull trazer a versão autoritativa.
 */
interface LinhaProcesso {
  id: string;
  tipo_servico: string;
  status: string;
  arma_id: string | null;
  arma_nome: string | null;
  valor_centavos: number;
  quantidade: number;
  asaas_payment_id: string | null;
  invoice_url: string | null;
  criado_em: string;
  atualizado_em: string;
}

function daLinha(l: LinhaProcesso): Processo {
  return {
    id: l.id,
    tipoServico: l.tipo_servico as TipoServicoDespachante,
    status: l.status as StatusProcesso,
    armaId: l.arma_id,
    armaNome: l.arma_nome,
    valorCentavos: l.valor_centavos,
    quantidade: l.quantidade,
    asaasPaymentId: l.asaas_payment_id,
    invoiceUrl: l.invoice_url,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

export async function listarProcessos(): Promise<Processo[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaProcesso>(
    'SELECT * FROM processos ORDER BY criado_em DESC'
  );
  return linhas.map(daLinha);
}

export async function obterProcesso(id: string): Promise<Processo | null> {
  const db = await abrirBanco();
  const l = await db.getFirstAsync<LinhaProcesso>('SELECT * FROM processos WHERE id = ?', id);
  return l ? daLinha(l) : null;
}

/** Remove o processo localmente (exclusão otimista; o servidor é a fonte). */
export async function removerProcessoLocal(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM processos WHERE id = ?', id);
}

/**
 * Grava/atualiza um processo localmente (insert otimista pós-pedido). Usa as
 * mesmas colunas que o pull espelha, então quando a versão do servidor chegar
 * ela só sobrescreve esta por `id`.
 */
export async function upsertProcessoLocal(p: Processo): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    `INSERT INTO processos (
       id, tipo_servico, status, arma_id, arma_nome, valor_centavos, quantidade,
       asaas_payment_id, invoice_url, criado_em, atualizado_em
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       tipo_servico = excluded.tipo_servico,
       status = excluded.status,
       arma_id = excluded.arma_id,
       arma_nome = excluded.arma_nome,
       valor_centavos = excluded.valor_centavos,
       quantidade = excluded.quantidade,
       asaas_payment_id = excluded.asaas_payment_id,
       invoice_url = excluded.invoice_url,
       atualizado_em = excluded.atualizado_em`,
    p.id,
    p.tipoServico,
    p.status,
    p.armaId,
    p.armaNome,
    p.valorCentavos,
    p.quantidade,
    p.asaasPaymentId,
    p.invoiceUrl,
    p.criadoEm,
    p.atualizadoEm
  );
}
