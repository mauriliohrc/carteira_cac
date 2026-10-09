/**
 * Extração por VISÃO (Google Gemini) para documentos que são FOTO/scan (sem
 * camada de texto) — laudos, CRAFs fotografados, etc. Usado só quando o parser
 * de texto não resolve. A chave fica no servidor (GEMINI_API_KEY); sem ela, a
 * função é no-op (devolve {}), então nada quebra.
 *
 * ⚠️ Envia a imagem do documento ao Google. Para dado sensível (laudo
 * psicológico) use projeto com faturamento/tier pago ou Vertex (sem treino).
 */
import type { CamposExtraidos } from './extracaoDocumento.js';

const API_KEY = process.env.GEMINI_API_KEY ?? '';
// Alias estável: sempre aponta para o flash atual (evita quebra quando o
// Google aposenta uma versão numerada).
const MODELO = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

export function geminiDisponivel(): boolean {
  return API_KEY.length > 0;
}

const CAMPOS_DESC = `
- numero: número/registro do documento (CRAF: Nº SIGMA ou registro; CR: Nº CR; guia: GTE Nº; porte: nº do certificado; autorização: Nº; laudo: nº do laudo ou CRP)
- dataValidade: validade, formato ISO yyyy-mm-dd
- dataEmissao: emissão/expedição, ISO yyyy-mm-dd
- numeroSerie: número de série da arma
- marca: fabricante/marca da arma (ex.: Forjas Taurus, Glock)
- modelo: modelo da arma (ex.: G-25, TH9)
- calibre: calibre (ex.: .380, 9mm, .357 Magnum)
- especie: tipo da arma (revólver, pistola, carabina/fuzil, espingarda, rifle…)
- fabricante, paisOrigem, anoFabricacao: demais dados da arma, quando houver
- origem, destino: endereço COMPLETO com CEP de cada local (guia de tráfego)
- observacoes: finalidade (guia), atividades autorizadas (CR) ou profissional/CRP (laudo)`;

interface RespostaGemini {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** Extrai campos de um documento (imagem ou PDF) via Gemini. {} se indisponível. */
export async function extrairComGemini(
  base64: string,
  mime: string,
  tipo?: string
): Promise<CamposExtraidos> {
  if (!geminiDisponivel()) return {};
  const prompt =
    `Você lê documentos brasileiros de CAC (colecionador, atirador, caçador): ` +
    `CRAF, CR, guia de tráfego (GTE), porte, autorização e laudos. ` +
    `Extraia os campos abaixo deste documento${tipo ? ` (tipo: ${tipo})` : ''} e responda ` +
    `APENAS um JSON (sem markdown) com as chaves que encontrar. Datas em ISO (yyyy-mm-dd). ` +
    `Ignore marcas d'água, QR codes, assinaturas e avisos legais (ex.: "NÃO É VÁLIDO COMO PORTE"). ` +
    `Se um campo não existir ou vier preenchido como "XXX", omita a chave. Campos:${CAMPOS_DESC}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${API_KEY}`;
  const corpo = {
    contents: [
      { parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] },
    ],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text().catch(() => '')}`);

  const dados = (await resp.json()) as RespostaGemini;
  const texto = dados.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(texto);
  } catch {
    return {};
  }
  // Só devolve chaves conhecidas, como string não-vazia.
  const chaves: (keyof CamposExtraidos)[] = [
    'numero', 'dataValidade', 'dataEmissao', 'numeroSerie', 'marca', 'modelo',
    'calibre', 'especie', 'fabricante', 'paisOrigem', 'anoFabricacao',
    'origem', 'destino', 'observacoes',
  ];
  const out: CamposExtraidos = {};
  for (const k of chaves) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}
