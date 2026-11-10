// ============================================================================
// Catálogo e regras do marketplace de acessórios (classificados).
//
// Escopo ESTRITO: só acessórios/equipamentos. Armas de fogo, munição e itens
// controlados são barrados por (1) allow-list de categorias — o que não está
// aqui não pode ser criado — e (2) filtro de termos proibidos no título/descrição.
// A moderação no backoffice é a terceira camada (pega o que escapar).
// ============================================================================

export const ESTADOS_USO = ['NOVO', 'SEMINOVO', 'USADO'] as const;
export type EstadoUso = (typeof ESTADOS_USO)[number];

/** Produtos de destaque (IAP consumível) → dias de destaque concedidos. */
export const DESTAQUE_PRODUTOS: Record<string, number> = {
  destaque_7d: 7,
  destaque_15d: 15,
  destaque_30d: 30,
};

export const STATUS_ANUNCIO = [
  'PENDENTE',
  'APROVADO',
  'PAUSADO',
  'VENDIDO',
  'REJEITADO',
] as const;
export type StatusAnuncio = (typeof STATUS_ANUNCIO)[number];

export interface SubcategoriaMarket {
  valor: string;
  rotulo: string;
}
export interface CategoriaMarket {
  valor: string;
  rotulo: string;
  subcategorias: SubcategoriaMarket[];
}

/**
 * Categorias curadas (fechadas) — **somente acessórios permitidos**. Nada de
 * armas, munição, pólvora, espoletas, carregadores > 30 tiros, supressores,
 * dispositivos de tiro automático ou blindagem.
 */
export const CATEGORIAS_MARKET: CategoriaMarket[] = [
  {
    valor: 'OPTICA',
    rotulo: 'Óptica e miras',
    subcategorias: [
      { valor: 'LUNETA', rotulo: 'Luneta / scope' },
      { valor: 'RED_DOT', rotulo: 'Red dot / holográfica' },
      { valor: 'MIRA_FERRO', rotulo: 'Mira de ferro' },
      { valor: 'MONTAGEM', rotulo: 'Montagens e anéis' },
      { valor: 'BINOCULO', rotulo: 'Binóculo / luneta terrestre' },
    ],
  },
  {
    valor: 'TRANSPORTE',
    rotulo: 'Coldres e transporte',
    subcategorias: [
      { valor: 'COLDRE', rotulo: 'Coldre' },
      { valor: 'CASE', rotulo: 'Case / maleta' },
      { valor: 'CAPA', rotulo: 'Capa / bolsa' },
      { valor: 'SLING', rotulo: 'Bandoleira (sling)' },
      { valor: 'CINTO', rotulo: 'Cinto tático' },
    ],
  },
  {
    valor: 'LIMPEZA',
    rotulo: 'Limpeza e manutenção',
    subcategorias: [
      { valor: 'KIT_LIMPEZA', rotulo: 'Kit de limpeza' },
      { valor: 'OLEO', rotulo: 'Óleo / solvente' },
      { valor: 'FERRAMENTA', rotulo: 'Ferramentas de manutenção' },
    ],
  },
  {
    valor: 'ACESSORIOS_ARMA',
    rotulo: 'Acessórios permitidos',
    subcategorias: [
      { valor: 'TRILHO', rotulo: 'Trilhos / rails' },
      { valor: 'BIPE', rotulo: 'Bipé / apoio' },
      { valor: 'EMPUNHADURA', rotulo: 'Empunhaduras / grips' },
      { valor: 'CORONHA', rotulo: 'Coronhas e kits de coronha' },
      { valor: 'LANTERNA', rotulo: 'Lanternas e suportes' },
    ],
  },
  {
    valor: 'RECARGA_EQUIP',
    rotulo: 'Recarga (equipamento)',
    subcategorias: [
      { valor: 'PRENSA', rotulo: 'Prensa de recarga' },
      { valor: 'DIES', rotulo: 'Dies / matrizes' },
      { valor: 'BALANCA', rotulo: 'Balança / medidor' },
      { valor: 'ACESSORIO_RECARGA', rotulo: 'Acessórios de bancada' },
    ],
  },
  {
    valor: 'PROTECAO',
    rotulo: 'Proteção (EPI)',
    subcategorias: [
      { valor: 'ABAFADOR', rotulo: 'Abafador / protetor auricular' },
      { valor: 'OCULOS', rotulo: 'Óculos de proteção' },
      { valor: 'LUVAS', rotulo: 'Luvas' },
    ],
  },
  {
    valor: 'VESTUARIO',
    rotulo: 'Vestuário de tiro',
    subcategorias: [
      { valor: 'COLETE_TIRO', rotulo: 'Colete de tiro (esportivo)' },
      { valor: 'BONE', rotulo: 'Boné / vestuário' },
      { valor: 'CALCADO', rotulo: 'Calçado' },
    ],
  },
  {
    valor: 'COFRES',
    rotulo: 'Cofres e guarda',
    subcategorias: [
      { valor: 'COFRE', rotulo: 'Cofre' },
      { valor: 'RACK', rotulo: 'Rack / suporte de guarda' },
    ],
  },
  {
    valor: 'ALVOS',
    rotulo: 'Alvos e estande',
    subcategorias: [
      { valor: 'ALVO', rotulo: 'Alvos' },
      { valor: 'SUPORTE_ALVO', rotulo: 'Suportes e porta-alvos' },
      { valor: 'ACESSORIO_ESTANDE', rotulo: 'Acessórios de estande' },
    ],
  },
  {
    valor: 'OUTROS',
    rotulo: 'Outros acessórios',
    subcategorias: [],
  },
];

const POR_VALOR = new Map(CATEGORIAS_MARKET.map((c) => [c.valor, c]));

/** A categoria existe na allow-list? E, se informada, a subcategoria pertence a ela? */
export function categoriaValida(categoria: string, subcategoria?: string | null): boolean {
  const cat = POR_VALOR.get(categoria);
  if (!cat) return false;
  if (!subcategoria) return true;
  return cat.subcategorias.some((s) => s.valor === subcategoria);
}

/** Normaliza texto para casar termos: minúsculo, sem acento. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Termos PROIBIDOS que bloqueiam a criação do anúncio (armas/munição/itens
 * controlados inequívocos). Casados sobre o texto normalizado (sem acento) com
 * limites de palavra. Itens ambíguos (ex.: "cano", "calibre", "arma" sozinho)
 * NÃO entram aqui de propósito, para não gerar falso-positivo — ficam para a
 * moderação. A lista é conservadora e defensável para a review das lojas.
 */
const TERMOS_PROIBIDOS: RegExp[] = [
  /\bmunicao(es)?\b/,
  /\bmunicoes\b/,
  /\bpolvora\b/,
  /\bespoleta(s)?\b/,
  /\bprimer(s)?\b/,
  /\bcartucho(s)?\b/,
  /\bprojetil\b/,
  /\bprojeteis\b/,
  /\bchumbinho(s)?\b/,
  /\bespingarda(s)?\b/,
  /\bfuzil\b/,
  /\bfuzis\b/,
  /\bcarabina(s)?\b/,
  /\brifle(s)?\b/,
  /\bpistola(s)?\b/,
  /\brevolver(es)?\b/,
  /\bgarrucha(s)?\b/,
  /\bsupressor(es)?\b/,
  /\bsilenciador(es)?\b/,
  /\bbump\s*stock\b/,
  /\bauto\s*sear\b/,
  /\barma\s+de\s+fogo\b/,
];

/**
 * Retorna o 1º termo proibido encontrado no texto (título+descrição), ou null
 * se estiver limpo. Usado na criação/edição de anúncio (client e server).
 */
export function termoProibido(...textos: (string | null | undefined)[]): string | null {
  const alvo = normalizar(textos.filter(Boolean).join(' \n '));
  for (const re of TERMOS_PROIBIDOS) {
    const m = alvo.match(re);
    if (m) return m[0];
  }
  return null;
}
