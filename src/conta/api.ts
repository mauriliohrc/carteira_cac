import { API_APP } from './config';

export interface DetalheErro {
  campo: string;
  mensagem: string;
}

/** Erro da API com status e, quando houver, erros por campo. */
export class ErroConta extends Error {
  constructor(
    public status: number,
    message: string,
    public detalhes?: DetalheErro[]
  ) {
    super(message);
    this.name = 'ErroConta';
  }

  /** true quando a falha foi de rede (app offline / servidor fora do ar). */
  get offline(): boolean {
    return this.status === 0;
  }
}

interface Opcoes {
  metodo?: string;
  corpo?: unknown;
  token?: string | null;
}

export async function apiApp<T = unknown>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, token } = opcoes;
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let resp: Response;
  try {
    resp = await fetch(`${API_APP}${caminho}`, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroConta(0, 'Sem conexão com o servidor. Verifique sua internet.');
  }

  if (resp.status === 204) return null as T;

  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ErroConta(resp.status, dados?.erro ?? 'Erro na requisição', dados?.detalhes);
  }
  return dados as T;
}
