/**
 * Extração best-effort de campos a partir do TEXTO de um PDF (CRAF, guia, CR…).
 *
 * Só PDF com camada de texto (a maioria dos documentos digitais). Fotos/scans
 * não passam por aqui — o app nem chama para imagem. É assistência: o usuário
 * revisa tudo antes de salvar, e só preenchemos campos que vierem com confiança
 * razoável. Os rótulos variam entre layouts, então o parser é tolerante e, no
 * pior caso, devolve menos campos (nunca inventa).
 */
import { PDFParse } from 'pdf-parse';

export interface CamposExtraidos {
  // Documento
  numero?: string;
  dataValidade?: string; // ISO yyyy-mm-dd
  dataEmissao?: string;
  origem?: string;
  destino?: string;
  observacoes?: string;
  // Arma (CRAF)
  numeroSerie?: string;
  marca?: string;
  modelo?: string;
  calibre?: string;
  especie?: string;
  fabricante?: string;
  paisOrigem?: string;
  anoFabricacao?: string;
}

/** Texto plano do PDF (camada de texto). Vazio se não houver texto. */
export async function extrairTextoPdf(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const parser = new PDFParse({ data: buffer });
  try {
    const r = await parser.getText();
    return r.text ?? '';
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function normalizar(t: string): string {
  return t
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n');
}

/** Primeiro valor após um dos rótulos, na mesma linha. */
function valorApos(texto: string, rotulos: string[], max = 80): string | undefined {
  for (const r of rotulos) {
    const m = texto.match(new RegExp(`${r}\\s*[:\\-]?\\s*([^\\n]+)`, 'i'));
    const v = m?.[1]?.trim().slice(0, max).trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Bloco multi-linha após um rótulo, até o próximo campo conhecido (stops).
 * Usado em origem/destino da guia, que trazem nome + endereço + CEP em linhas.
 */
function blocoApos(texto: string, rotulos: string[], stops: string[]): string | undefined {
  const stopRe = new RegExp(`\\n\\s*(?:${stops.join('|')})\\b`, 'i');
  for (const r of rotulos) {
    const m = texto.match(new RegExp(`${r}\\s*[:\\-]?\\s*([\\s\\S]{0,240})`, 'i'));
    if (!m) continue;
    let bloco = m[1];
    const corte = bloco.search(stopRe);
    if (corte >= 0) bloco = bloco.slice(0, corte);
    const linhas = bloco
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (linhas.length) return linhas.join(', ').slice(0, 180);
  }
  return undefined;
}

/** Primeira data dd/mm/aaaa logo após um dos rótulos → ISO. */
function dataApos(texto: string, rotulos: string[]): string | undefined {
  for (const r of rotulos) {
    const m = texto.match(new RegExp(`${r}[^0-9]{0,40}(\\d{2})[\\/.\\-](\\d{2})[\\/.\\-](\\d{4})`, 'i'));
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return undefined;
}

function limpo<T extends Record<string, string | undefined>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Partial<T>;
}

/** Rótulos que encerram um bloco de endereço (origem/destino) da guia. */
const PARADAS_ENDERECO = [
  'pa[ií]s',
  'cidade',
  'uf',
  'estado',
  'munic[ií]pio',
  'validade',
  'meio',
  'observ',
  'finalidade',
  'origem',
  'destino',
  'data',
  'n[º°o]',
];

/** Mapeia o texto nos campos. `tipo` ajusta quais rótulos priorizar. */
export function mapearCampos(textoBruto: string, tipo?: string): CamposExtraidos {
  const texto = normalizar(textoBruto);

  const campos: CamposExtraidos = {
    numero: valorApos(texto, [
      'n[uú]mero do craf',
      'craf n[º°o]',
      'n[uú]mero do registro',
      'n[º°o] do registro',
      'n[º°o] da guia',
      'n[uú]mero da guia',
      'n[uú]mero do cr',
    ]),
    dataValidade: dataApos(texto, ['validade', 'v[aá]lido at[eé]', 'vencimento', 'validade do registro']),
    dataEmissao: dataApos(texto, ['expedi[cç][aã]o', 'emiss[aã]o', 'emitido em', 'data de expedi']),
    numeroSerie: valorApos(texto, ['n[uú]mero de s[eé]rie', 'n[º°o] de s[eé]rie', 's[eé]rie']),
    marca: valorApos(texto, ['marca']),
    modelo: valorApos(texto, ['modelo']),
    calibre: valorApos(texto, ['calibre']),
    especie: valorApos(texto, ['esp[eé]cie', 'tipo de arma']),
    fabricante: valorApos(texto, ['fabricante']),
    paisOrigem: valorApos(texto, ['pa[ií]s de origem', 'pa[ií]s']),
    anoFabricacao: valorApos(texto, ['ano de fabrica[cç][aã]o', 'ano de fabrica']),
    // Origem/destino da guia: pega o bloco (nome, endereço, CEP) até o próximo
    // campo — assim o destino traz o endereço e o CEP, não só o nome.
    origem: blocoApos(texto, ['origem'], PARADAS_ENDERECO),
    destino: blocoApos(texto, ['destino'], PARADAS_ENDERECO),
    // Finalidade do tráfego → vai para as observações do documento.
    observacoes: (() => {
      const f = valorApos(texto, ['finalidade do tr[aá]fego', 'finalidade', 'motivo do transporte', 'motivo']);
      return f ? `Finalidade: ${f}` : undefined;
    })(),
  };

  // Guia de tráfego não tem dados de arma; CRAF não tem origem/destino.
  if (tipo === 'GUIA_TRAFEGO') {
    delete campos.numeroSerie;
    delete campos.marca;
    delete campos.modelo;
    delete campos.calibre;
    delete campos.especie;
    delete campos.fabricante;
    delete campos.paisOrigem;
    delete campos.anoFabricacao;
  } else {
    delete campos.origem;
    delete campos.destino;
  }

  return limpo(campos as Record<string, string | undefined>) as CamposExtraidos;
}
