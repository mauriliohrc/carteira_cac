/**
 * Datas são sempre guardadas como 'AAAA-MM-DD' (sem hora, sem fuso).
 * Toda a matemática usa Date.UTC para não sofrer com horário de verão.
 */

export type DataISO = string; // AAAA-MM-DD

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function hojeISO(): DataISO {
  const d = new Date();
  return paraISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function paraISO(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function ehISOValida(v: string | null | undefined): v is DataISO {
  if (!v || !RE_ISO.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function paraUTC(iso: DataISO): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Dias de `de` até `ate`. Positivo = `ate` está no futuro. */
export function diffDias(de: DataISO, ate: DataISO): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86400000);
}

export function somarDias(iso: DataISO, dias: number): DataISO {
  const d = new Date(paraUTC(iso) + dias * 86400000);
  return paraISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Soma (ou subtrai) meses de calendário, e não 30 dias.
 *
 * Quando o dia não existe no mês de destino, ancora no último dia dele: um
 * 31/03 menos um mês vira 28/02, não 03/03. É o que importa para a janela de
 * 12 meses da habitualidade, contada por mês e não por 365 dias.
 */
export function somarMeses(iso: DataISO, meses: number): DataISO {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ano = alvo.getUTCFullYear();
  const mes = alvo.getUTCMonth() + 1;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return paraISO(ano, mes, Math.min(d, ultimoDia));
}

/** 'AAAA-MM-DD' -> '31/12/2026' */
export function isoParaBR(iso: string | null | undefined): string {
  if (!ehISOValida(iso)) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** '31/12/2026' (ou '31122026') -> 'AAAA-MM-DD'. Retorna null se inválida. */
export function brParaISO(br: string | null | undefined): DataISO | null {
  if (!br) return null;
  const nums = br.replace(/\D/g, '');
  if (nums.length !== 8) return null;
  const iso = `${nums.slice(4, 8)}-${nums.slice(2, 4)}-${nums.slice(0, 2)}`;
  return ehISOValida(iso) ? iso : null;
}

/** Aplica a máscara dd/mm/aaaa enquanto o usuário digita. */
export function mascaraData(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

/** "vence em 12 dias" / "venceu há 3 dias" / "vence hoje" */
export function textoPrazo(dias: number): string {
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${Math.abs(dias)} dias`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}
