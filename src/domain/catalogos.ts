import type { Paleta } from '@/tema/paleta';
import type { Acervo, Grupo, Orgao, TipoDocumento, TipoSessao } from './tipos';

/** Chave de cor na paleta — resolvida no render, conforme o tema ativo. */
export type ChaveCor = 'acervoDefesa' | 'acervoAtirador' | 'acervoCaca' | 'acervoColecao';

export function corDe(chave: ChaveCor | undefined, c: Paleta): string {
  return chave ? c[chave] : c.textoMedio;
}

export interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
  curto: string;
  detalhe?: string;
  cor?: ChaveCor;
}

export const ACERVOS: Opcao<Acervo>[] = [
  {
    valor: 'DEFESA_PESSOAL',
    rotulo: 'Defesa Pessoal (SINARM)',
    curto: 'Defesa Pessoal',
    detalhe: 'Registro na Polícia Federal — porte/posse civil',
    cor: 'acervoDefesa',
  },
  {
    valor: 'ATIRADOR',
    rotulo: 'Atirador Desportivo (SIGMA)',
    curto: 'Atirador',
    detalhe: 'Acervo vinculado ao CR de atirador desportivo',
    cor: 'acervoAtirador',
  },
  {
    valor: 'CACA',
    rotulo: 'Caça (SIGMA)',
    curto: 'Caça',
    detalhe: 'Acervo de caçador / controlador de fauna',
    cor: 'acervoCaca',
  },
  {
    valor: 'COLECAO',
    rotulo: 'Coleção (SIGMA)',
    curto: 'Coleção',
    detalhe: 'Acervo de colecionador',
    cor: 'acervoColecao',
  },
];

export const GRUPOS: Opcao<Grupo>[] = [
  {
    valor: 'CLR_PERMITIDA',
    rotulo: 'Cano longo, alma raiada, permitida',
    curto: 'Longo raiada perm.',
    detalhe: 'Ex.: carabinas .22 LR, .38 SPL',
  },
  {
    valor: 'CLR_RESTRITA',
    rotulo: 'Cano longo, alma raiada, restrita',
    curto: 'Longo raiada restr.',
    detalhe: 'Ex.: .223 Rem, .308 Win, 7,62x39',
  },
  {
    valor: 'CC_PERMITIDA',
    rotulo: 'Cano curto, permitida',
    curto: 'Curto permitida',
    detalhe: 'Ex.: .380 ACP, .38 SPL, .32',
  },
  {
    valor: 'CC_RESTRITA',
    rotulo: 'Cano curto, restrita',
    curto: 'Curto restrita',
    detalhe: 'Ex.: 9x19, .40 S&W, .45 ACP',
  },
  {
    valor: 'CLL_PERMITIDA',
    rotulo: 'Cano longo, alma lisa, permitida',
    curto: 'Longo lisa perm.',
    detalhe: 'Espingardas cal. 12, 16, 20, 24, 28, .410',
  },
  {
    valor: 'CLL_RESTRITA',
    rotulo: 'Cano longo, alma lisa, restrita',
    curto: 'Longo lisa restr.',
    detalhe: 'Alma lisa enquadrada como restrita',
  },
];

export const CALIBRES: string[] = [
  '.22 LR',
  '.22 Magnum',
  '.25 ACP',
  '.32 ACP',
  '.32 S&W',
  '.357 Magnum',
  '.38 SPL',
  '.380 ACP',
  '.40 S&W',
  '.44 Magnum',
  '.45 ACP',
  '.45 Colt',
  '9x19mm',
  '.17 HMR',
  '.204 Ruger',
  '.223 Rem / 5,56x45',
  '.243 Win',
  '.270 Win',
  '.300 Blackout',
  '.30-06',
  '.30-30',
  '.308 Win / 7,62x51',
  '7,62x39',
  '6,5 Creedmoor',
  '5,7x28',
  'Cal. 12',
  'Cal. 16',
  'Cal. 20',
  'Cal. 24',
  'Cal. 28',
  'Cal. .410',
];

export const ESPECIES: string[] = [
  'Pistola',
  'Revólver',
  'Carabina',
  'Rifle',
  'Espingarda',
  'Garrucha',
  'Fuzil',
  'Submetralhadora',
  'Mosquetão',
];

export const FUNCIONAMENTOS: string[] = [
  'Semiautomático',
  'Repetição (ferrolho)',
  'Repetição (alavanca)',
  'Repetição (pump)',
  'Tiro simples',
  'Dupla ação',
  'Ação simples',
  'Automático',
];

export interface DefTipoDoc {
  valor: TipoDocumento;
  rotulo: string;
  curto: string;
  icone: string;
  /** Vinculado a uma arma específica ou ao próprio CAC. */
  escopo: 'ARMA' | 'PESSOAL';
  orgaoPadrao: Orgao;
  /** Prazo típico previsto na norma — exibido só como referência. */
  referenciaPrazo?: string;
  campos: {
    numero?: string;
    trajeto?: boolean;
    /** Mostra o campo "Local do manejo" — só a Autorização de Manejo usa. */
    local?: boolean;
  };
}

export const TIPOS_DOCUMENTO: DefTipoDoc[] = [
  {
    valor: 'CRAF',
    rotulo: 'CRAF — Certificado de Registro de Arma de Fogo',
    curto: 'CRAF',
    icone: 'document-text',
    escopo: 'ARMA',
    orgaoPadrao: 'EXERCITO',
    referenciaPrazo: 'Dec. 11.615/2023: 3 anos para acervo de CAC',
    campos: { numero: 'Nº do CRAF' },
  },
  {
    valor: 'GUIA_TRAFEGO',
    rotulo: 'Guia de Tráfego',
    curto: 'Guia de Tráfego',
    icone: 'car',
    escopo: 'ARMA',
    orgaoPadrao: 'EXERCITO',
    referenciaPrazo: 'Port. 150-COLOG: até 36 meses (GT); GTE 1–3 meses',
    campos: { numero: 'Nº da guia', trajeto: true },
  },
  {
    valor: 'AUTORIZACAO_COMPRA',
    rotulo: 'Autorização de Compra / Aquisição',
    curto: 'Aut. de Compra',
    icone: 'cart',
    escopo: 'ARMA',
    orgaoPadrao: 'EXERCITO',
    campos: { numero: 'Nº da autorização' },
  },
  {
    valor: 'CR',
    rotulo: 'CR — Certificado de Registro (CAC)',
    curto: 'CR',
    icone: 'ribbon',
    escopo: 'PESSOAL',
    orgaoPadrao: 'EXERCITO',
    referenciaPrazo: 'Validade de 10 anos',
    campos: { numero: 'Nº do CR' },
  },
  {
    valor: 'LAUDO_PSICOLOGICO',
    rotulo: 'Laudo de Aptidão Psicológica',
    curto: 'Laudo Psicológico',
    icone: 'medkit',
    escopo: 'PESSOAL',
    orgaoPadrao: 'PROFISSIONAL',
    referenciaPrazo: 'Validade usual de 2 anos',
    campos: { numero: 'Nº / CRP do profissional' },
  },
  {
    valor: 'LAUDO_CAPACIDADE_TECNICA',
    rotulo: 'Laudo de Capacidade Técnica',
    curto: 'Capacidade Técnica',
    icone: 'shield-checkmark',
    escopo: 'PESSOAL',
    orgaoPadrao: 'PROFISSIONAL',
    campos: { numero: 'Nº / registro do instrutor' },
  },
  {
    valor: 'FILIACAO_CLUBE',
    rotulo: 'Filiação a Clube / Entidade',
    curto: 'Filiação',
    icone: 'people',
    escopo: 'PESSOAL',
    orgaoPadrao: 'CLUBE',
    campos: { numero: 'Matrícula' },
  },
  {
    valor: 'HABITUALIDADE',
    rotulo: 'Comprovante de Habitualidade',
    curto: 'Habitualidade',
    icone: 'locate',
    escopo: 'PESSOAL',
    orgaoPadrao: 'CLUBE',
    campos: { numero: 'Nº do comprovante' },
  },
  {
    valor: 'AUTORIZACAO_MANEJO',
    rotulo: 'Autorização de Manejo de Fauna',
    curto: 'Aut. de Manejo',
    icone: 'paw',
    escopo: 'PESSOAL',
    orgaoPadrao: 'IBAMA',
    campos: { numero: 'Nº da autorização', local: true },
  },
  {
    valor: 'AUTORIZACAO_IBAMA',
    rotulo: 'Autorização do IBAMA',
    curto: 'Aut. IBAMA',
    icone: 'leaf',
    escopo: 'PESSOAL',
    orgaoPadrao: 'IBAMA',
    campos: { numero: 'Nº da autorização' },
  },
  {
    valor: 'CERTIDAO',
    rotulo: 'Certidão Negativa',
    curto: 'Certidão',
    icone: 'reader',
    escopo: 'PESSOAL',
    orgaoPadrao: 'OUTRO',
    campos: { numero: 'Nº da certidão' },
  },
  {
    valor: 'OUTRO',
    rotulo: 'Outro documento',
    curto: 'Outro',
    icone: 'folder',
    escopo: 'PESSOAL',
    orgaoPadrao: 'OUTRO',
    campos: { numero: 'Número / identificação' },
  },
];

export const TIPOS_SESSAO: Opcao<TipoSessao>[] = [
  {
    valor: 'TREINO',
    rotulo: 'Treino',
    curto: 'Treino',
    detalhe: 'Sessão de treinamento no clube ou estande',
  },
  {
    valor: 'COMPETICAO',
    rotulo: 'Competição',
    curto: 'Competição',
    detalhe: 'Prova oficial — conta como habitualidade do mesmo jeito',
  },
];

export const ORGAOS: Opcao<Orgao>[] = [
  { valor: 'EXERCITO', rotulo: 'Exército Brasileiro (SFPC/DFPC)', curto: 'Exército' },
  { valor: 'PF', rotulo: 'Polícia Federal (SINARM)', curto: 'Polícia Federal' },
  { valor: 'CLUBE', rotulo: 'Clube / Entidade de tiro', curto: 'Clube' },
  { valor: 'PROFISSIONAL', rotulo: 'Profissional credenciado', curto: 'Profissional' },
  { valor: 'IBAMA', rotulo: 'IBAMA / Órgão ambiental', curto: 'IBAMA' },
  { valor: 'OUTRO', rotulo: 'Outro', curto: 'Outro' },
];

const mapa = <T extends string>(lista: Opcao<T>[]) =>
  Object.fromEntries(lista.map((o) => [o.valor, o])) as Record<T, Opcao<T>>;

export const ACERVO_POR_VALOR = mapa(ACERVOS);
export const GRUPO_POR_VALOR = mapa(GRUPOS);
export const ORGAO_POR_VALOR = mapa(ORGAOS);
export const TIPO_SESSAO_POR_VALOR = mapa(TIPOS_SESSAO);
export const TIPO_DOC_POR_VALOR = Object.fromEntries(
  TIPOS_DOCUMENTO.map((t) => [t.valor, t])
) as Record<TipoDocumento, DefTipoDoc>;

export function rotuloTipoDoc(tipo: TipoDocumento): string {
  return TIPO_DOC_POR_VALOR[tipo]?.curto ?? tipo;
}
