import type { Filiacao, StatusFiliacao } from '@/domain/tipos';
import { abrirBanco } from './index';

/**
 * Leitura da filiação à liga no banco local. A filiação é server-owned: criada
 * e tocada pelo servidor (assinatura anual Asaas) e espelhada aqui só pela
 * sincronização (pull). Este módulo só LÊ — nunca faz push.
 */
interface LinhaFiliacao {
  id: string;
  numero_filiacao: string | null;
  status: string;
  origem: string | null;
  nome_completo: string | null;
  cpf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  doc_tipo: string | null;
  documentacao_completa: number;
  valor_centavos: number | null;
  vigente_ate: string | null;
  invoice_url: string | null;
  criado_em: string | null;
  atualizado_em: string;
}

function daLinha(l: LinhaFiliacao): Filiacao {
  return {
    id: l.id,
    numeroFiliacao: l.numero_filiacao,
    status: l.status as StatusFiliacao,
    origem: l.origem,
    nomeCompleto: l.nome_completo,
    cpf: l.cpf,
    endereco: {
      cep: l.cep,
      logradouro: l.logradouro,
      numero: l.numero,
      complemento: l.complemento,
      bairro: l.bairro,
      cidade: l.cidade,
      uf: l.uf,
    },
    docTipo: l.doc_tipo,
    documentacaoCompleta: Boolean(l.documentacao_completa),
    valorCentavos: l.valor_centavos,
    vigenteAte: l.vigente_ate,
    invoiceUrl: l.invoice_url,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

/** Uma filiação é vigente se está ativa e dentro da validade. */
export function filiacaoVigente(f: Filiacao): boolean {
  if (f.status !== 'ativa') return false;
  if (!f.vigenteAte) return true;
  return new Date(f.vigenteAte).getTime() > Date.now();
}

/** A filiação mais recente do usuário (ou null), para a carteirinha/tela. */
export async function obterFiliacao(): Promise<Filiacao | null> {
  const db = await abrirBanco();
  const l = await db.getFirstAsync<LinhaFiliacao>(
    'SELECT * FROM filiacoes ORDER BY criado_em DESC LIMIT 1'
  );
  return l ? daLinha(l) : null;
}

/** A filiação ATIVA e vigente (se houver), para derivar o Premium. */
export async function filiacaoAtivaLocal(): Promise<Filiacao | null> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaFiliacao>(
    "SELECT * FROM filiacoes WHERE status = 'ativa' ORDER BY criado_em DESC"
  );
  for (const l of linhas) {
    const f = daLinha(l);
    if (filiacaoVigente(f)) return f;
  }
  return null;
}
