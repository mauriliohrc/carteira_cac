const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const CHAVE_TOKEN = 'cac.admin.token';
const CHAVE_TIPO = 'cac.sessao.tipo';

export type TipoSessao = 'ADMIN' | 'ENTIDADE';

/** Guarda o token e marca de que público é a sessão (admin do app ou entidade). */
export function salvarToken(token: string, tipo: TipoSessao = 'ADMIN') {
  localStorage.setItem(CHAVE_TOKEN, token);
  localStorage.setItem(CHAVE_TIPO, tipo);
}
export function lerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CHAVE_TOKEN);
}
export function lerTipo(): TipoSessao | null {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(CHAVE_TIPO) as TipoSessao | null) ?? null;
}
export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_TIPO);
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
    public detalhes?: { campo: string; mensagem: string }[]
  ) {
    super(message);
  }
}

interface Opcoes {
  metodo?: string;
  corpo?: unknown;
  autenticar?: boolean;
}

export async function api<T = unknown>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, autenticar = true } = opcoes;
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (autenticar) {
    const t = lerToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }

  const resp = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  if (resp.status === 204) return null as T;

  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ErroApi(resp.status, dados?.erro ?? 'Erro na requisição', dados?.detalhes);
  }
  return dados as T;
}
