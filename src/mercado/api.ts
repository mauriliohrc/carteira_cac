import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import type {
  Anuncio,
  CatalogoMarket,
  ConversaDetalhe,
  ConversaResumo,
  DadosAnuncio,
  MensagemChat,
  PaginaAnuncios,
} from './tipos';

/** Filtros da vitrine (todos opcionais, combináveis). */
export interface FiltrosMercado {
  categoria?: string;
  subcategoria?: string;
  uf?: string;
  texto?: string;
  precoMin?: number;
  precoMax?: number;
  lojaId?: string;
}

/** Catálogo curado (categorias + estados) — carregado do servidor. */
export async function obterCatalogo(): Promise<CatalogoMarket> {
  return apiApp<CatalogoMarket>('/marketplace/catalogo');
}

/** Vitrine pública (login opcional). `cursor` nulo = primeira página. */
export async function listarAnuncios(
  cursor: string | null,
  filtros: FiltrosMercado = {},
  limite = 20
): Promise<PaginaAnuncios> {
  const params = new URLSearchParams({ limite: String(limite) });
  if (cursor) params.set('cursor', cursor);
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.subcategoria) params.set('subcategoria', filtros.subcategoria);
  if (filtros.uf) params.set('uf', filtros.uf);
  if (filtros.texto) params.set('texto', filtros.texto);
  if (filtros.precoMin) params.set('precoMin', String(filtros.precoMin));
  if (filtros.precoMax) params.set('precoMax', String(filtros.precoMax));
  if (filtros.lojaId) params.set('lojaId', filtros.lojaId);
  const token = await lerToken();
  return apiApp<PaginaAnuncios>(`/marketplace/anuncios?${params.toString()}`, { token });
}

export async function obterAnuncio(id: string): Promise<Anuncio> {
  const token = await lerToken();
  const r = await apiApp<{ anuncio: Anuncio }>(`/marketplace/anuncios/${id}`, { token });
  return r.anuncio;
}

/** Meus anúncios (todos os status). Exige login. */
export async function meusAnuncios(): Promise<Anuncio[]> {
  const token = await lerToken();
  const r = await apiApp<{ anuncios: Anuncio[] }>('/marketplace/meus', { token });
  return r.anuncios;
}

/** Registra o aceite do EULA do marketplace (obrigatório antes de anunciar). */
export async function aceitarEula(): Promise<void> {
  const token = await lerToken();
  await apiApp('/marketplace/eula', { metodo: 'POST', token });
}

/** Envia uma foto (base64) e devolve o id do Upload para anexar ao anúncio. */
export async function enviarFoto(mime: string, dadosBase64: string): Promise<string> {
  const token = await lerToken();
  // apiApp já prefixa `/api/v1/app`; a rota é `/api/v1/app/uploads`.
  const r = await apiApp<{ id: string }>('/uploads', {
    metodo: 'POST',
    token,
    corpo: { mime, dadosBase64 },
  });
  return r.id;
}

export async function criarAnuncio(dados: DadosAnuncio): Promise<Anuncio> {
  const token = await lerToken();
  const r = await apiApp<{ anuncio: Anuncio }>('/marketplace/anuncios', {
    metodo: 'POST',
    token,
    corpo: dados,
  });
  return r.anuncio;
}

export async function editarAnuncio(id: string, dados: Partial<DadosAnuncio>): Promise<Anuncio> {
  const token = await lerToken();
  const r = await apiApp<{ anuncio: Anuncio }>(`/marketplace/anuncios/${id}`, {
    metodo: 'PATCH',
    token,
    corpo: dados,
  });
  return r.anuncio;
}

async function acao(id: string, caminho: string): Promise<void> {
  const token = await lerToken();
  await apiApp(`/marketplace/anuncios/${id}/${caminho}`, { metodo: 'POST', token });
}
export const pausarAnuncio = (id: string) => acao(id, 'pausar');
export const reativarAnuncio = (id: string) => acao(id, 'reativar');
/** "Já vendi" — tira da vitrine e marca como vendido. */
export const marcarVendido = (id: string) => acao(id, 'vendido');

export async function excluirAnuncio(id: string): Promise<void> {
  const token = await lerToken();
  await apiApp(`/marketplace/anuncios/${id}`, { metodo: 'DELETE', token });
}

// ------------------------------------------------------------------ chat

/** "Tenho interesse" — cria/retoma a conversa e devolve o id. */
export async function manifestarInteresse(anuncioId: string): Promise<string> {
  const token = await lerToken();
  const r = await apiApp<{ conversaId: string }>(`/marketplace/anuncios/${anuncioId}/interesse`, {
    metodo: 'POST',
    token,
  });
  return r.conversaId;
}

export async function listarConversas(): Promise<ConversaResumo[]> {
  const token = await lerToken();
  const r = await apiApp<{ conversas: ConversaResumo[] }>('/marketplace/conversas', { token });
  return r.conversas;
}

export async function obterConversa(id: string, cursor?: string | null): Promise<ConversaDetalhe> {
  const token = await lerToken();
  const params = cursor ? `?cursor=${cursor}` : '';
  return apiApp<ConversaDetalhe>(`/marketplace/conversas/${id}${params}`, { token });
}

export async function enviarMensagem(id: string, texto: string): Promise<MensagemChat> {
  const token = await lerToken();
  const r = await apiApp<{ mensagem: MensagemChat }>(`/marketplace/conversas/${id}/mensagens`, {
    metodo: 'POST',
    token,
    corpo: { texto },
  });
  return r.mensagem;
}

export async function liberarContato(id: string): Promise<void> {
  const token = await lerToken();
  await apiApp(`/marketplace/conversas/${id}/liberar-contato`, { metodo: 'POST', token });
}

export async function bloquearNaConversa(id: string): Promise<void> {
  const token = await lerToken();
  await apiApp(`/marketplace/conversas/${id}/bloquear`, { metodo: 'POST', token });
}

export async function denunciar(dados: {
  anuncioId?: string;
  conversaId?: string;
  motivo: string;
}): Promise<void> {
  const token = await lerToken();
  await apiApp('/marketplace/denuncias', { metodo: 'POST', token, corpo: dados });
}

/** Aplica o destaque após a compra na loja (IAP). */
export async function destacarAnuncio(
  anuncioId: string,
  recibo: { produtoId: string; plataforma: 'IOS' | 'ANDROID'; transacaoId: string }
): Promise<{ destaqueAte: string | null }> {
  const token = await lerToken();
  return apiApp<{ destaqueAte: string | null }>(`/marketplace/anuncios/${anuncioId}/destaque`, {
    metodo: 'POST',
    token,
    corpo: recibo,
  });
}

// ------------------------------------------------------------------ util

/** Centavos → "R$ 1.234,56" ou "A combinar". */
export function formatarPreco(centavos: number | null): string {
  if (centavos == null) return 'A combinar';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "R$ 1.234,56" / "1234,56" / "1234.56" → centavos. Null se vazio. */
export function precoParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Link público compartilhável: mercado.carteiracac.com/titulo-<id>. */
export function linkPublicoAnuncio(id: string, titulo = ''): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `https://mercado.carteiracac.com/${slug ? `${slug}-${id}` : id}`;
}
