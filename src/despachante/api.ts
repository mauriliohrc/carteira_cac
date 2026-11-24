import * as FS from 'expo-file-system/legacy';

import { apiApp } from '@/conta/api';
import { API_APP } from '@/conta/config';
import { lerToken } from '@/conta/armazenamento';
import type { Processo, TipoServicoDespachante } from '@/domain/tipos';

/** Tipo de um campo do formulário de documentos de um serviço. */
export type TipoCampoDespachante = 'ARQUIVO' | 'TEXTO' | 'CHECKBOX' | 'SENHA_GOV';

export interface CampoDespachante {
  id: string;
  tipo: TipoCampoDespachante;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  ordem: number;
}

/** Faixa de preço por quantidade/filiação (ver backend FaixaPrecoDespachante). */
export interface FaixaPrecoDespachante {
  /** Vale a partir desta quantidade de equipamentos (1 = faixa base). */
  qtdMin: number;
  /** Preço por unidade (centavos) para não filiados. */
  precoCentavos: number;
  /** Preço por unidade (centavos) para filiados da liga. */
  precoFiliadoCentavos: number;
}

export interface ServicoDespachante {
  tipo: TipoServicoDespachante | string;
  nome: string;
  descricao: string;
  /** GRU (taxa do órgão) em centavos, por item. */
  gruCentavos: number;
  /** Honorário do despachante em centavos, por item. */
  servicoCentavos: number;
  /** Total cobrado por item (GRU + serviço), em centavos. */
  precoCentavos: number;
  /** Unidade de cobrança, para a UI ("por CRAF", "por guia"). */
  unidade: string;
  /** true = escolhe arma(s) e paga por item; false = valor único, sem arma. */
  porArma?: boolean;
  /** Termo de aceite que o usuário aceita antes de contratar (opcional). */
  termoAceite?: string | null;
  // Aditivos (catálogo dinâmico) — ausentes no fallback offline.
  codigo?: string;
  subtitulo?: string | null;
  comoFunciona?: string | null;
  /** Nome do ícone (Ionicons). */
  icone?: string;
  ordem?: number;
  /** Campos de documento que o usuário preenche depois de pagar. */
  campos?: CampoDespachante[];
  /** Preço por unidade (1 equip.) para filiados da liga. Ausente = sem desconto. */
  precoFiliadoCentavos?: number;
  /** Faixas de preço por quantidade/filiação. Vazio/ausente = preço único. */
  faixas?: FaixaPrecoDespachante[];
}

/** Status dinâmico do processo (label/cor/ícone vêm do servidor). */
export interface StatusDespachante {
  codigo: string;
  label: string;
  cor: string;
  icone: string | null;
  papel: string;
}

export interface CatalogoDespachante {
  servicos: ServicoDespachante[];
  /** Status configurados (app novo pinta a etiqueta dinâmica). */
  status?: StatusDespachante[];
  /** Nota explicando a composição do valor (GRU + serviço). */
  gruNota: string;
  /** Número do Carteira CAC para o botão "Auxílio Jurídico" (só dígitos). */
  whatsappJuridico?: string;
  /** Se o usuário é filiado vigente da liga (define o preço destacado na tela). */
  filiado?: boolean;
}

/**
 * Preço POR UNIDADE (centavos) para uma quantidade e filiação. Espelha o cálculo
 * do servidor (que é a fonte da verdade da cobrança): usa a faixa de maior
 * `qtdMin` que não ultrapassa a quantidade; sem faixas, usa `precoCentavos`
 * (não filiado) / `precoFiliadoCentavos` (filiado, se houver).
 */
export function precoUnitarioDespachante(
  servico: Pick<ServicoDespachante, 'precoCentavos' | 'precoFiliadoCentavos' | 'faixas'>,
  quantidade: number,
  filiado: boolean
): number {
  const faixas = (servico.faixas ?? []).slice().sort((a, b) => a.qtdMin - b.qtdMin);
  if (faixas.length === 0) {
    return filiado ? servico.precoFiliadoCentavos ?? servico.precoCentavos : servico.precoCentavos;
  }
  const q = Math.max(1, Math.floor(quantidade) || 1);
  let escolhida = faixas[0];
  for (const f of faixas) if (f.qtdMin <= q) escolhida = f;
  return filiado ? escolhida.precoFiliadoCentavos : escolhida.precoCentavos;
}

/** Total do pedido (preço por unidade × quantidade), em centavos. */
export function precoTotalDespachante(
  servico: Pick<ServicoDespachante, 'precoCentavos' | 'precoFiliadoCentavos' | 'faixas'>,
  quantidade: number,
  filiado: boolean
): number {
  const q = Math.max(1, Math.floor(quantidade) || 1);
  return precoUnitarioDespachante(servico, q, filiado) * q;
}

/** True se o serviço tem preço de filiado menor que o de não filiado (p/ CTA). */
export function temDescontoFiliado(
  servico: Pick<ServicoDespachante, 'precoCentavos' | 'precoFiliadoCentavos' | 'faixas'>
): boolean {
  const faixas = servico.faixas ?? [];
  if (faixas.length) return faixas.some((f) => f.precoFiliadoCentavos < f.precoCentavos);
  return (servico.precoFiliadoCentavos ?? servico.precoCentavos) < servico.precoCentavos;
}

export interface ProgressoDespachante {
  totalObrigatorios: number;
  preenchidosObrigatorios: number;
  completo: boolean;
  faltantes: { id: string; nome: string; tipo: string }[];
}

export interface ValorCampoProcesso {
  id: string;
  campoId: string | null;
  tipo: string;
  nome: string | null;
  mime: string | null;
  tamanho: number | null;
  temArquivo: boolean;
  valorTexto: string | null;
  valorCpf: string | null;
  preenchido: boolean;
  origem: string;
  final: boolean;
  status: string;
  motivo: string | null;
  criadoEm: string;
}

/** Processo com status rico, progresso, campos e documentos (API, não sync). */
export interface ProcessoDetalhe {
  id: string;
  tipoServico: string;
  servicoNome: string;
  status: string;
  statusLabel: string;
  statusCor: string;
  statusIcone: string | null;
  armaId: string | null;
  armaNome: string | null;
  valorCentavos: number;
  quantidade: number;
  asaasPaymentId: string | null;
  /** Chave de agrupamento: processos do mesmo pedido (por-arma) compartilham. */
  grupoId: string;
  invoiceUrl: string | null;
  criadoEm: string;
  atualizadoEm: string;
  progresso: ProgressoDespachante | null;
  campos: CampoDespachante[];
  valores: ValorCampoProcesso[];
}

/**
 * Fallback usado quando o servidor não responde (ex.: offline, ou a API nova
 * ainda não está no ar). Os valores REAIS vêm do servidor e são editáveis no
 * backoffice; estes são só o padrão de referência (GRU + R$80 de serviço).
 */
const CATALOGO_PADRAO: CatalogoDespachante = {
  servicos: [
    {
      tipo: 'CADASTRO_RENOVACAO_IBAMA',
      nome: 'Cadastro / Renovação IBAMA',
      descricao: 'Fazemos o seu cadastro ou a renovação no IBAMA (CTF), do protocolo ao acompanhamento.',
      gruCentavos: 0,
      servicoCentavos: 15000,
      precoCentavos: 15000,
      unidade: 'por processo',
    },
    {
      tipo: 'AQUISICAO_TRANSFERENCIA',
      nome: 'Aquisição / Transferência de Equipamento (CAC)',
      descricao: 'Cuidamos do processo de aquisição ou transferência de armamento do CAC.',
      gruCentavos: 0,
      servicoCentavos: 20000,
      precoCentavos: 20000,
      unidade: 'por processo',
    },
    {
      tipo: 'POSSE_PF',
      nome: 'Posse - Polícia Federal',
      descricao: 'Conduzimos o seu processo de posse de arma de fogo junto à Polícia Federal.',
      gruCentavos: 0,
      servicoCentavos: 25000,
      precoCentavos: 25000,
      unidade: 'por processo',
    },
    {
      tipo: 'PORTE_PF',
      nome: 'Porte - Polícia Federal',
      descricao: 'Conduzimos o seu processo de porte de arma de fogo junto à Polícia Federal.',
      gruCentavos: 0,
      servicoCentavos: 30000,
      precoCentavos: 30000,
      unidade: 'por processo',
    },
    {
      tipo: 'RENOVACAO_CRAF',
      nome: 'Renovação de CRAF',
      descricao:
        'Cuidamos de toda a renovação do Certificado de Registro de Arma de Fogo (CRAF) ' +
        'de cada arma do seu acervo, do protocolo ao acompanhamento.',
      gruCentavos: 8800,
      servicoCentavos: 8000,
      precoCentavos: 16800,
      unidade: 'por CRAF',
    },
    {
      tipo: 'EMISSAO_GUIA',
      nome: 'Emissão de Guias',
      descricao:
        'Emitimos a Guia de Tráfego do armamento que você precisar transportar, ' +
        'com orientação do início ao fim.',
      gruCentavos: 2000,
      servicoCentavos: 8000,
      precoCentavos: 10000,
      unidade: 'por guia',
    },
  ],
  gruNota:
    'O valor já inclui a GRU (taxa paga ao órgão) e o nosso serviço. As GRUs são ' +
    'definidas pelo órgão e podem mudar; confirmamos o valor exato no andamento.',
};

/**
 * Catálogo de serviços (preços e nota vêm do servidor, editáveis no backoffice).
 * Se o servidor não responder, cai no {@link CATALOGO_PADRAO} para a tela nunca
 * ficar sem valores.
 */
export async function listarServicos(): Promise<CatalogoDespachante> {
  const token = await lerToken();
  try {
    const r = await apiApp<CatalogoDespachante>('/despachante/servicos', { token });
    return r?.servicos?.length ? r : CATALOGO_PADRAO;
  } catch {
    return CATALOGO_PADRAO;
  }
}

/**
 * Cria um pedido (1 processo por item) e abre a cobrança no Asaas. Devolve o
 * processo criado e o `invoiceUrl` do checkout hospedado (PIX/cartão).
 */
export async function criarPedido(dados: {
  tipoServico: TipoServicoDespachante | string;
  armaId?: string | null;
  armaNome?: string | null;
  /** App novo: lista de armas (por-arma) — gera 1 processo por arma + 1 cobrança. */
  armas?: { id: string | null; nome: string | null }[];
}): Promise<{ processos: Processo[]; processo: Processo; invoiceUrl: string }> {
  const token = await lerToken();
  return apiApp<{ processos: Processo[]; processo: Processo; invoiceUrl: string }>('/despachante/pedidos', {
    metodo: 'POST',
    token,
    corpo: dados,
  });
}

/** Exclui um processo ainda não pago (cancela a cobrança no Asaas). */
export async function excluirPedido(id: string): Promise<void> {
  const token = await lerToken();
  await apiApp(`/despachante/pedidos/${id}`, { metodo: 'DELETE', token });
}

/** Processos do usuário com status rico, progresso e documentos (via API). */
export async function listarPedidos(): Promise<ProcessoDetalhe[]> {
  const token = await lerToken();
  const r = await apiApp<{ processos: ProcessoDetalhe[] }>('/despachante/pedidos', { token });
  return r?.processos ?? [];
}

/** Preenche um campo de TEXTO / CHECKBOX / SENHA_GOV. */
export async function enviarCampo(
  processoId: string,
  campoId: string,
  valor: { valorTexto?: string | null; valorCpf?: string | null; checkbox?: boolean }
): Promise<void> {
  const token = await lerToken();
  await apiApp(`/despachante/pedidos/${processoId}/campos/${campoId}`, {
    metodo: 'POST',
    token,
    corpo: valor,
  });
}

/** Faz upload de um documento (campo ARQUIVO) a partir de um arquivo local. */
export async function enviarArquivoCampo(
  processoId: string,
  campoId: string,
  arquivo: { uri: string; nome: string; mime: string | null }
): Promise<void> {
  const token = await lerToken();
  const dadosBase64 = await FS.readAsStringAsync(arquivo.uri, { encoding: FS.EncodingType.Base64 });
  await apiApp(`/despachante/pedidos/${processoId}/campos/${campoId}/arquivo`, {
    metodo: 'POST',
    token,
    corpo: { nome: arquivo.nome, mime: arquivo.mime, dadosBase64 },
  });
}

/**
 * Baixa um arquivo do processo (documento final ou enviado) para um arquivo
 * local, com o token no header. Devolve o uri local para abrir/compartilhar.
 */
export async function baixarArquivoProcesso(
  processoId: string,
  valorId: string,
  nome: string
): Promise<string> {
  const token = await lerToken();
  const destino = `${FS.cacheDirectory ?? ''}${nome.replace(/[^\w.\-]+/g, '_')}`;
  const r = await FS.downloadAsync(`${API_APP}/despachante/pedidos/${processoId}/arquivo/${valorId}`, destino, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return r.uri;
}
