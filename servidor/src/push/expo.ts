// Cliente mínimo da API de push da Expo. Sem SDK: um POST com os tokens.
// Funciona para iOS (APNs) e Android (FCM) — a Expo faz a ponte.

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const LOTE = 100; // a Expo aceita até 100 mensagens por requisição

export interface MensagemPush {
  titulo: string;
  corpo: string;
  dados?: Record<string, string>;
}

export interface ResultadoEnvio {
  aceitos: number;
  erros: { token: string; motivo: string }[];
}

function dividir<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

/**
 * Envia uma mensagem para vários tokens Expo. Devolve quantos foram aceitos
 * e os tokens que a Expo recusou (ex.: DeviceNotRegistered), para limpeza.
 */
export async function enviarPush(
  tokens: string[],
  msg: MensagemPush
): Promise<ResultadoEnvio> {
  const resultado: ResultadoEnvio = { aceitos: 0, erros: [] };
  if (tokens.length === 0) return resultado;

  for (const lote of dividir(tokens, LOTE)) {
    const corpo = lote.map((to) => ({
      to,
      title: msg.titulo,
      body: msg.corpo,
      sound: 'default' as const,
      data: msg.dados ?? {},
    }));

    let dados: { data?: { status: string; message?: string }[] };
    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(corpo),
      });
      dados = (await resp.json()) as { data?: { status: string; message?: string }[] };
    } catch (e) {
      // Falha de rede com a Expo: conta o lote inteiro como erro.
      for (const to of lote) {
        resultado.erros.push({ token: to, motivo: e instanceof Error ? e.message : 'rede' });
      }
      continue;
    }

    const tickets = dados.data ?? [];
    lote.forEach((to, i) => {
      const t = tickets[i];
      if (t && t.status === 'ok') resultado.aceitos += 1;
      else resultado.erros.push({ token: to, motivo: t?.message ?? 'desconhecido' });
    });
  }

  return resultado;
}
