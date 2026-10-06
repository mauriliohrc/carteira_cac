// Cliente da API de parceiros da Shooting House.
// Doc: https://app.swaggerhub.com/apis-docs/shootinghouse/Parceiros/1.0.1
// Auth: HTTP Basic (login/senha do parceiro). Endpoint de habitualidades por CPF.

const BASE_PADRAO = 'https://apibeta.shootinghouse.com.br/v1/partners';

export interface CredenciaisSH {
  baseUrl?: string | null;
  login: string;
  senha: string;
}

/** Sessão já normalizada para o formato do app. */
export interface SessaoImportada {
  /** Id estável derivado dos dados — base da deduplicação. */
  externoId: string;
  data: string; // YYYY-MM-DD
  tipo: 'TREINO' | 'COMPETICAO';
  grupo: string; // CLR_* | CC_* | CLL_*
  armaNome: string;
  localNome: string | null;
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

function paraDataISO(v: string | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
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
 * Deriva o grupo do app a partir dos campos da SH. Best-effort: os valores
 * exatos da SH precisam ser confirmados contra uma resposta real.
 */
function derivarGrupo(groupKey: string, tipoArma?: string, tipoAlma?: string, tipoUso?: string): string {
  const ctx = `${groupKey} ${tipoArma ?? ''} ${tipoAlma ?? ''} ${tipoUso ?? ''}`.toUpperCase();
  const uso = /RESTRIT/.test(ctx) ? 'RESTRITA' : 'PERMITIDA';
  const curto = /CURT|CC|PISTOL|REV[OÓ]LVER|CANO CURTO/.test(ctx);
  if (curto) return `CC_${uso}`;
  const lisa = /LIS|ESPINGARD|CLL|ALMA LISA/.test(ctx);
  return lisa ? `CLL_${uso}` : `CLR_${uso}`;
}

function ehCompeticao(v?: string): boolean {
  if (!v) return false;
  return !/^(n[ãa]o|nao|false|0|-|\s*)$/i.test(v.trim());
}

// Estrutura crua documentada (arrays paralelos por arma).
interface BlocoArmaSH {
  evento?: string[];
  local?: string[];
  competicao?: string[];
  tipo_arma?: string[];
  tipo_uso?: string[];
  tipo_alma?: string[];
  calibre?: string[];
  serie?: string[];
  data_participacao?: string[];
  cidade_uf?: string;
}
interface AtiradorSH {
  idatirador?: number;
  cpf?: string;
  habitualidades?: Record<string, Record<string, BlocoArmaSH>>;
}

/** Achata a resposta crua da SH em sessões individuais. */
export function normalizar(payload: AtiradorSH[]): SessaoImportada[] {
  const sessoes: SessaoImportada[] = [];
  for (const atirador of payload ?? []) {
    const idAtirador = atirador.idatirador ?? atirador.cpf ?? '?';
    const grupos = atirador.habitualidades ?? {};
    for (const [groupKey, armas] of Object.entries(grupos)) {
      for (const [weaponId, bloco] of Object.entries(armas)) {
        const n = bloco.data_participacao?.length ?? 0;
        for (let i = 0; i < n; i++) {
          const data = paraDataISO(bloco.data_participacao?.[i]);
          if (!data) continue;
          const grupo = derivarGrupo(
            groupKey,
            bloco.tipo_arma?.[i],
            bloco.tipo_alma?.[i],
            bloco.tipo_uso?.[i]
          );
          const serie = bloco.serie?.[i] ?? '';
          const calibre = bloco.calibre?.[i] ?? '';
          const armaNome = [calibre, serie ? `nº ${serie}` : '']
            .filter(Boolean)
            .join(' ')
            .trim() || (GRUPOS_VALIDOS.has(grupo) ? grupo : 'Arma');
          const localNome = bloco.local?.[i] ?? bloco.cidade_uf ?? null;
          const externoId =
            'sh_' + hash(`${idAtirador}|${weaponId}|${data}|${serie}|${bloco.evento?.[i] ?? ''}|${i}`);

          sessoes.push({
            externoId,
            data,
            tipo: ehCompeticao(bloco.competicao?.[i]) ? 'COMPETICAO' : 'TREINO',
            grupo,
            armaNome,
            localNome,
          });
        }
      }
    }
  }
  return sessoes;
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

/** Busca e normaliza as habitualidades de um CPF num parceiro. */
export async function buscarHabitualidades(creds: CredenciaisSH, cpf: string): Promise<ResultadoSH> {
  const base = (creds.baseUrl || BASE_PADRAO).replace(/\/$/, '');
  const url = `${base}/registers/habitualities/${cpf}`;
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
  if (!resp.ok) {
    return { status: 'ERRO', sessoes: [], mensagem: `HTTP ${resp.status}` };
  }

  try {
    const dados = (await resp.json()) as AtiradorSH[];
    return { status: 'OK', sessoes: normalizar(dados) };
  } catch {
    return { status: 'ERRO', sessoes: [], mensagem: 'Resposta inválida da Shooting House' };
  }
}
