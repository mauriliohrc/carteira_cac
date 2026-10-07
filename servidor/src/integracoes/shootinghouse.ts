// Cliente da API de parceiros da Shooting House.
// Doc: https://app.swaggerhub.com/apis-docs/shootinghouse/Parceiros/1.0.1
// Auth: HTTP Basic (login/senha do parceiro). Endpoint de habitualidades por CPF.

const BASE_PADRAO = 'https://apibeta.shootinghouse.com.br/v1/partners';

export interface CredenciaisSH {
  baseUrl?: string | null;
  login: string;
  senha: string;
}

/** Uma arma usada numa sessão (o grupo é o que conta para a habitualidade). */
export interface ArmaSessao {
  grupo: string; // CLR_* | CC_* | CLL_*
  armaNome: string;
  /** Nº de série — casa com a arma cadastrada no app para marcá-la na sessão. */
  serie: string | null;
}

/**
 * Sessão já normalizada para o formato do app.
 *
 * REGRA DE CONTAGEM: na Shooting House lança-se uma habitualidade por ARMA,
 * mas no MESMO DIA e MESMO LOCAL todas contam como UMA única habitualidade —
 * creditando cada *grupo de armas* uma vez. Por isso agrupamos aqui por
 * (atirador, data, local) e trazemos as armas daquele dia em `armas`; o app
 * credita cada grupo uma só vez por sessão.
 */
export interface SessaoImportada {
  /** Id estável derivado de (atirador, data, local) — base da deduplicação. */
  externoId: string;
  data: string; // YYYY-MM-DD
  tipo: 'TREINO' | 'COMPETICAO';
  localNome: string | null;
  /** Armas distintas usadas no dia/local (uma habitualidade por grupo). */
  armas: ArmaSessao[];
}

export type StatusSH = 'OK' | 'NAO_AUTORIZADO' | 'ERRO';

export interface ResultadoSH {
  status: StatusSH;
  sessoes: SessaoImportada[];
  mensagem?: string;
}

// ---------------------------------------------------------------- helpers

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function paraDataISO(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Formato da SH: "DD/MM/AAAA" (às vezes com hora: "DD/MM/AAAA HH:MM").
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const GRUPOS_VALIDOS = new Set([
  'CLR_PERMITIDA',
  'CLR_RESTRITA',
  'CC_PERMITIDA',
  'CC_RESTRITA',
  'CLL_PERMITIDA',
  'CLL_RESTRITA',
]);

/**
 * Mapeia o grupo da SH para o grupo do app. A SH traz o grupo explícito:
 *   - `grupo_arma_completo`: "Arma Longa Raiada Restrita", "Arma Curta …" etc.
 *   - `grupo_arma` (código): ALRR, ALRP, ALLR, ALLP, ACR/ACP (curta)…
 * Usamos o texto completo (mais claro) e caímos no código como reforço.
 */
function grupoDoSH(completo?: string, codigo?: string): string {
  const s = `${completo ?? ''} ${codigo ?? ''}`.toUpperCase();
  const cod = (codigo ?? '').toUpperCase();
  const restrita = /RESTRIT/.test(s) || /^A..R$/.test(cod) || /R$/.test(cod);
  const uso = restrita ? 'RESTRITA' : 'PERMITIDA';
  // Curta: "Arma Curta", "Cano Curto", pistola/revólver, ou código iniciando em AC.
  if (/CURT|PISTOL|REV[OÓ]LVER|GARRUCHA/.test(s) || /^AC/.test(cod)) return `CC_${uso}`;
  // Longa lisa: "Lisa", espingarda, ou código ALL*.
  if (/LISA|ESPINGARD/.test(s) || /^ALL/.test(cod)) return `CLL_${uso}`;
  // Longa raiada (default): rifle, carabina, fuzil, ALR*.
  return `CLR_${uso}`;
}

function ehCompeticaoSH(modalidade?: string): boolean {
  if (!modalidade) return false;
  return /COMPETI|PROVA|CAMPEONAT|TORNEIO/i.test(modalidade);
}

function primeiro(a: unknown, i: number): string | undefined {
  if (Array.isArray(a)) return a[i] != null ? String(a[i]) : a[0] != null ? String(a[0]) : undefined;
  return a != null ? String(a) : undefined;
}

/** Bloco cru de uma arma na SH — arrays paralelos por participação. */
interface BlocoArmaSH {
  data_participacao?: unknown[];
  grupo_arma?: unknown[];
  grupo_arma_completo?: unknown[];
  arma_formatada?: unknown[];
  calibre?: unknown[];
  serie?: unknown[];
  modalidades?: unknown[];
  modalidades_simples?: unknown[];
  prova?: unknown[];
  prova_cidade?: unknown[];
  cidade_uf?: unknown;
  [k: string]: unknown;
}
interface AtiradorSH {
  idatirador?: number;
  cpf?: string;
  habitualidades?: Record<string, Record<string, BlocoArmaSH>>;
}

/**
 * Achata a resposta crua da SH e agrupa por (atirador, data, local): uma
 * habitualidade por dia/local, com as armas daquele dia. Assim, três pistolas
 * no mesmo treino viram UMA habitualidade (um crédito por grupo), não três.
 */
export function normalizar(payload: AtiradorSH[]): SessaoImportada[] {
  // 1) achata em participações individuais (uma por arma/dia).
  interface Participacao {
    idAtirador: string | number;
    data: string;
    local: string | null;
    grupo: string;
    armaNome: string;
    serie: string | null;
    competicao: boolean;
  }
  const participacoes: Participacao[] = [];
  for (const atirador of payload ?? []) {
    const idAtirador = atirador.idatirador ?? atirador.cpf ?? '?';
    const grupos = atirador.habitualidades ?? {};
    for (const [groupKey, armas] of Object.entries(grupos)) {
      for (const [, bloco] of Object.entries(armas)) {
        const n = Array.isArray(bloco.data_participacao) ? bloco.data_participacao.length : 0;
        for (let i = 0; i < n; i++) {
          const data = paraDataISO(bloco.data_participacao?.[i]);
          if (!data) continue;
          const grupo = grupoDoSH(
            primeiro(bloco.grupo_arma_completo, i),
            primeiro(bloco.grupo_arma, i) ?? groupKey
          );
          const serie = primeiro(bloco.serie, i) ?? '';
          const calibre = primeiro(bloco.calibre, i) ?? '';
          const armaNome =
            (primeiro(bloco.arma_formatada, i) ?? '').trim() ||
            [calibre, serie ? `nº ${serie}` : '']
              .filter(Boolean)
              .join(' ')
              .trim() ||
            (GRUPOS_VALIDOS.has(grupo) ? grupo : 'Arma');
          const local =
            (bloco.cidade_uf != null ? String(bloco.cidade_uf) : undefined) ??
            primeiro(bloco.prova_cidade, i) ??
            null;
          const modalidade = primeiro(bloco.modalidades_simples, i) ?? primeiro(bloco.modalidades, i);
          const prova = primeiro(bloco.prova, i);
          participacoes.push({
            idAtirador,
            data,
            local,
            grupo,
            armaNome,
            serie: serie ? String(serie).trim() : null,
            competicao: ehCompeticaoSH(modalidade) || Boolean(prova && prova.trim()),
          });
        }
      }
    }
  }

  // 2) agrupa por (atirador, data, local). Dentro da sessão, armas distintas.
  interface Acc extends SessaoImportada {
    _vistas: Set<string>;
    _competicao: boolean;
  }
  const porSessao = new Map<string, Acc>();
  for (const p of participacoes) {
    const chave = `${p.idAtirador}|${p.data}|${p.local ?? ''}`;
    let sess = porSessao.get(chave);
    if (!sess) {
      sess = {
        externoId: 'sh_' + hash(chave),
        data: p.data,
        tipo: 'TREINO',
        localNome: p.local,
        armas: [],
        _vistas: new Set<string>(),
        _competicao: false,
      };
      porSessao.set(chave, sess);
    }
    const chaveArma = `${p.grupo}|${p.serie ?? p.armaNome}`;
    if (!sess._vistas.has(chaveArma)) {
      sess._vistas.add(chaveArma);
      sess.armas.push({ grupo: p.grupo, armaNome: p.armaNome, serie: p.serie });
    }
    if (p.competicao) sess._competicao = true;
  }

  // 3) materializa (uma competição "contamina" a sessão inteira como COMPETICAO).
  return [...porSessao.values()].map((s) => ({
    externoId: s.externoId,
    data: s.data,
    tipo: s._competicao ? 'COMPETICAO' : 'TREINO',
    localNome: s.localNome,
    armas: s.armas,
  }));
}

export interface ArmaImportada {
  modelo: string;
  marca: string | null;
  calibre: string;
  especie: string | null;
  numeroSerie: string;
  /** Registro SIGMA, quando a SH informa. */
  registroNumero: string | null;
  acervo: string;
  grupo: string;
}

interface WeaponSH {
  model?: string;
  caliber?: string;
  serie?: string;
  brand?: string;
  type?: string;
  sigma?: string;
}

/**
 * Calibre curto PERMITIDO = até .38 (ex.: .22, .25, .32, .380, .38 SPL).
 * Acima disso (9mm, .40, .45, .357, .44…) é RESTRITO.
 */
function calibreCurtoPermitido(caliber?: string): boolean {
  const s = (caliber ?? '').toUpperCase();
  // Restritos acima de .38 (checa primeiro para não confundir .38 com .357).
  if (/\b9\s?MM|\b9X19|\.?40\b|\.?45\b|\.?357|\.?44\b|10\s?MM|5[.,]7|454|500/.test(s)) return false;
  // Permitidos até .38.
  if (/\.?22|\.?25|\.?32|\.?380|\.?38\b/.test(s)) return true;
  return false; // desconhecido: trata como acima de .38 (restrito)
}

/**
 * Deriva o grupo do app a partir da espécie/calibre da SH.
 * - Curtas: permitida/restrita pelo calibre (regra até .38).
 * - Longas (raiada/lisa): a SH não informa o funcionamento (repetição x
 *   semiauto), do qual depende permitida/restrita — assume PERMITIDA e o app
 *   pede revisão.
 */
function derivarGrupoArma(type?: string, caliber?: string): string {
  const t = (type ?? '').toUpperCase();
  if (/PISTOL|REV[OÓ]LVER|GARRUCHA|CURT/.test(t)) {
    return calibreCurtoPermitido(caliber) ? 'CC_PERMITIDA' : 'CC_RESTRITA';
  }
  if (/ESPINGARD|LIS/.test(t)) return 'CLL_PERMITIDA';
  return 'CLR_PERMITIDA'; // rifle, carabina, fuzil, mosquetão…
}

/** Busca o CR (Certificado de Registro) do sócio, quando a SH informa. */
export async function buscarCR(
  creds: CredenciaisSH,
  cpf: string
): Promise<{ numero: string; validade: string } | null> {
  const base = (creds.baseUrl || BASE_PADRAO).replace(/\/$/, '');
  const url = `${base}/registers/shooters/${cpf}?searchBy=cpf`;
  const auth = Buffer.from(`${creds.login}:${creds.senha}`).toString('base64');
  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  try {
    const s = (await resp.json()) as ShooterSH;
    const cr = s.documents?.cr;
    if (cr?.number && cr.expirationDate) {
      return { numero: cr.number, validade: cr.expirationDate.slice(0, 10) };
    }
  } catch {
    /* ignora */
  }
  return null;
}

/** Busca as armas do acervo de um CPF num parceiro, normalizadas para o app. */
export async function buscarArmas(
  creds: CredenciaisSH,
  cpf: string
): Promise<{ status: StatusSH; armas: ArmaImportada[] }> {
  const base = (creds.baseUrl || BASE_PADRAO).replace(/\/$/, '');
  const url = `${base}/registers/shooters/weapon/${cpf}?searchBy=cpf`;
  const auth = Buffer.from(`${creds.login}:${creds.senha}`).toString('base64');

  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
  } catch {
    return { status: 'ERRO', armas: [] };
  }
  if (resp.status === 404) return { status: 'OK', armas: [] };
  if (resp.status === 401 || resp.status === 403) return { status: 'NAO_AUTORIZADO', armas: [] };
  if (!resp.ok) return { status: 'ERRO', armas: [] };

  let dados: WeaponSH[];
  try {
    dados = (await resp.json()) as WeaponSH[];
  } catch {
    return { status: 'ERRO', armas: [] };
  }

  const armas = (dados ?? [])
    .filter((w) => w.serie) // sem série não dá para deduplicar
    .map<ArmaImportada>((w) => ({
      modelo: w.model?.trim() || 'Arma',
      marca: w.brand?.trim() || null,
      calibre: w.caliber?.trim() || '',
      especie: w.type?.trim() || null,
      numeroSerie: w.serie!.trim(),
      registroNumero: w.sigma?.trim() || null,
      acervo: 'ATIRADOR',
      grupo: derivarGrupoArma(w.type, w.caliber),
    }));

  return { status: 'OK', armas };
}

export interface VerificacaoParceiro {
  status: StatusSH | 'NAO_MEMBRO';
  membro: boolean;
  ativo: boolean;
  adimplente: boolean;
  nome?: string;
  /** E-mail cadastrado do sócio na Shooting House (para conferir identidade). */
  email?: string;
  matricula?: string;
  expiracao?: string;
}

interface ShooterSH {
  cpf?: string;
  status?: string;
  name?: string;
  email?: string;
  registratitionCode?: string;
  monthly?: { status?: boolean; expirationDate?: string };
  financial?: { status?: boolean };
  documents?: { cr?: { status?: boolean; number?: string; expirationDate?: string } };
}

/**
 * Verifica se um CPF é sócio ATIVO e ADIMPLENTE de um parceiro na Shooting House.
 * Usa GET /registers/shooters/{cpf}?searchBy=cpf: `status: 'A'` = ativo;
 * `financial.status` / `monthly.status` = em dia.
 */
export async function verificarParceiro(creds: CredenciaisSH, cpf: string): Promise<VerificacaoParceiro> {
  const base = (creds.baseUrl || BASE_PADRAO).replace(/\/$/, '');
  const url = `${base}/registers/shooters/${cpf}?searchBy=cpf`;
  const auth = Buffer.from(`${creds.login}:${creds.senha}`).toString('base64');

  const vazio: VerificacaoParceiro = { status: 'NAO_MEMBRO', membro: false, ativo: false, adimplente: false };

  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
  } catch {
    return { ...vazio, status: 'ERRO' };
  }

  if (resp.status === 404) return vazio; // não é sócio deste parceiro
  if (resp.status === 401 || resp.status === 403) return { ...vazio, status: 'NAO_AUTORIZADO' };
  if (!resp.ok) return { ...vazio, status: 'ERRO' };

  let s: ShooterSH | null;
  try {
    s = (await resp.json()) as ShooterSH;
  } catch {
    return { ...vazio, status: 'ERRO' };
  }
  // Resposta vazia (alguns ambientes devolvem {} ou null para não-sócio).
  if (!s || !s.cpf && !s.name && !s.status) return vazio;

  const ativo = (s.status ?? '').toUpperCase() === 'A';
  const adimplente = s.financial?.status === true || s.monthly?.status === true;
  return {
    status: 'OK',
    membro: true,
    ativo,
    adimplente,
    nome: s.name,
    email: s.email?.trim().toLowerCase() || undefined,
    matricula: s.registratitionCode,
    expiracao: s.monthly?.expirationDate,
  };
}

/**
 * Confere se o e-mail do app bate com o cadastrado na Shooting House para o CPF.
 * Protege a importação de dados sensíveis: só liberamos os documentos/armas/
 * habitualidades de quem comprova ser o dono do CPF — e-mail verificado no app
 * E igual ao que a entidade tem no cadastro da Shooting House. Assim ninguém
 * importa os documentos de terceiros cadastrando o CPF alheio com outro e-mail.
 */
export async function emailConfereNoSH(
  creds: CredenciaisSH,
  cpf: string,
  emailApp: string
): Promise<{ confere: boolean; membro: boolean; status: VerificacaoParceiro['status'] }> {
  const v = await verificarParceiro(creds, cpf);
  const confere = Boolean(v.email) && v.email === emailApp.trim().toLowerCase();
  return { confere, membro: v.membro, status: v.status };
}

/** Início da janela de 1 ano (contando o dia de hoje) em YYYY-MM-DD. */
function inicioUmAno(): string {
  const hoje = new Date();
  const ini = new Date(hoje);
  ini.setFullYear(ini.getFullYear() - 1);
  return ini.toISOString().slice(0, 10);
}

/**
 * Busca e normaliza as habitualidades de um CPF num parceiro, sempre da janela
 * de 1 ano contando o dia de hoje. A SH devolve um OBJETO (um atirador), não um
 * array — por isso embrulhamos. Pedimos também o intervalo por querystring.
 */
export async function buscarHabitualidades(creds: CredenciaisSH, cpf: string): Promise<ResultadoSH> {
  const base = (creds.baseUrl || BASE_PADRAO).replace(/\/$/, '');
  const inicio = inicioUmAno();
  const fim = new Date().toISOString().slice(0, 10);
  const url = `${base}/registers/habitualities/${cpf}?startDate=${inicio}&endDate=${fim}`;
  const auth = Buffer.from(`${creds.login}:${creds.senha}`).toString('base64');

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
  } catch (e) {
    return { status: 'ERRO', sessoes: [], mensagem: e instanceof Error ? e.message : 'rede' };
  }

  if (resp.status === 401 || resp.status === 403) {
    return {
      status: 'NAO_AUTORIZADO',
      sessoes: [],
      mensagem: `Shooting House recusou o acesso (HTTP ${resp.status}).`,
    };
  }
  if (resp.status === 404) return { status: 'OK', sessoes: [] }; // sem habitualidades
  if (!resp.ok) {
    return { status: 'ERRO', sessoes: [], mensagem: `HTTP ${resp.status}` };
  }

  try {
    const dados = await resp.json();
    const lista: AtiradorSH[] = Array.isArray(dados) ? dados : dados ? [dados] : [];
    // Garante a janela de 1 ano mesmo que a SH ignore o intervalo na querystring.
    const sessoes = normalizar(lista).filter((s) => s.data >= inicio);
    return { status: 'OK', sessoes };
  } catch {
    return { status: 'ERRO', sessoes: [], mensagem: 'Resposta inválida da Shooting House' };
  }
}
