/**
 * Extração best-effort de campos a partir do TEXTO de um PDF (CRAF, guia…).
 *
 * Só PDF com camada de texto (documentos digitais). O app nem chama para foto.
 * É assistência: o usuário revisa antes de salvar. Há três layouts reais, bem
 * diferentes, então o parser detecta o formato e usa um ramo para cada:
 *   - Guia de Tráfego (GTE/PF): rótulos limpos ("Endereço e CEP:", "FINALIDADE").
 *   - CRAF do Exército (SIGMA): cabeçalho de colunas + bloco de valores no fim.
 *   - CRAF do SINARM (PF): rótulos em bloco e valores em bloco (posicional).
 */
import { PDFParse } from 'pdf-parse';

export interface CamposExtraidos {
  numero?: string;
  dataValidade?: string; // ISO yyyy-mm-dd
  dataEmissao?: string;
  origem?: string;
  destino?: string;
  observacoes?: string;
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

// ----------------------------------------------------------------- utilidades
function normalizar(t: string): string {
  return t
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n');
}

const ESPECIE =
  'carabina\\s*/\\s*fuzil|pistola|rev[óo]lver|carabina|fuzil|espingarda|rifle|garrucha|mosquet[ãa]o|submetralhadora';

/** 'dd/mm/aaaa' → ISO. */
function paraISO(br?: string | null): string | undefined {
  if (!br) return undefined;
  const m = br.match(/(\d{2})[/.\-](\d{2})[/.\-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

function limpo(o: CamposExtraidos): CamposExtraidos {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v != null && String(v).trim() !== '')
  ) as CamposExtraidos;
}

/** Trecho entre dois marcadores (para isolar origem/destino da guia). */
function secao(texto: string, de: RegExp, ate: RegExp): string {
  const i = texto.search(de);
  if (i < 0) return '';
  const resto = texto.slice(i);
  const j = resto.slice(1).search(ate);
  return j < 0 ? resto : resto.slice(0, j + 1);
}

// --------------------------------------------------------------- Guia (GTE)
function parseGuia(texto: string): CamposExtraidos {
  const numero = texto.match(/GTE\s*N[º°o:]+\s*([0-9]{6,})/i)?.[1];
  const val = texto.match(
    /Validade:\s*(\d{2}\/\d{2}\/\d{4})\s*(?:à|a|at[ée])\s*(\d{2}\/\d{2}\/\d{4})/i
  );

  const secOrigem = secao(texto, /LOCAL DE ORIGEM/i, /LOCAL DE DESTINO/i);
  const secDestino = secao(texto, /LOCAL DE DESTINO/i, /\n\s*4\.\s*FINALIDADE|FINALIDADE/i);

  const enderecoDe = (sec: string) => {
    // "País" (acento no i) na origem e "Páis" (acento no a) no destino — cobre os dois.
    const m = sec.match(/Endere[çc]o e CEP:\s*([\s\S]*?)(?:\n\s*P[aá][ií]s\s*\/|\n\s*Telefone|$)/i);
    return m?.[1]?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
  };

  const finalidade = texto
    .match(/\n\s*4\.\s*FINALIDADE\s*\n\s*([^\n]+)/i)?.[1]
    ?.trim();

  return limpo({
    numero,
    dataEmissao: paraISO(val?.[1]),
    dataValidade: paraISO(val?.[2]),
    origem: enderecoDe(secOrigem),
    destino: enderecoDe(secDestino),
    observacoes: finalidade ? `Finalidade: ${finalidade}` : undefined,
  });
}

// ------------------------------------------------------ CRAF do Exército (SIGMA)
function parseCrafExercito(texto: string): CamposExtraidos {
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const validade = paraISO(texto.match(/VALIDADE\s*\n\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]);

  // Bloco de valores (fim do doc): [TIPO MARCA] / [CALIBRE] / [SÉRIE SIGMA] / [DATA].
  // Âncora: a linha "SÉRIE SIGMA" = algo como "ACK443000 1975996".
  const iSerie = linhas.findIndex((l) => /^[A-Z][A-Z0-9.\/-]{3,}\s+\d{6,}$/.test(l));
  let numeroSerie: string | undefined;
  let numero: string | undefined;
  let especie: string | undefined;
  let marca: string | undefined;
  let calibre: string | undefined;
  let dataEmissao: string | undefined;

  if (iSerie >= 0) {
    const mSerie = linhas[iSerie].match(/^([A-Z][A-Z0-9.\/-]{3,})\s+(\d{6,})$/);
    numeroSerie = mSerie?.[1];
    numero = mSerie?.[2]; // Nº SIGMA = registro
    calibre = linhas[iSerie - 1]?.replace(/\s*\((?:restrito|permitido)\)\s*/i, '').trim();
    const tipoMarca = linhas[iSerie - 2] ?? '';
    const mTM = tipoMarca.match(new RegExp(`^(${ESPECIE})\\s+(.*)$`, 'i'));
    if (mTM) {
      especie = mTM[1].trim();
      marca = mTM[2].trim();
    } else {
      marca = tipoMarca || undefined;
    }
    dataEmissao = paraISO(linhas[iSerie + 1]);
  }

  return limpo({ numero, dataValidade: validade, dataEmissao, numeroSerie, especie, marca, calibre });
}

// --------------------------------------------------------- CRAF do SINARM (PF)
function parseCrafSinarm(texto: string): CamposExtraidos {
  const mVal = texto.match(/Data de Validade:\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})/i);
  const numero = mVal?.[1];
  const dataValidade = paraISO(mVal?.[2]);

  // Valores posicionais logo após o último rótulo do quadro da arma.
  const apos = texto.split(/Comprimento dos Canos:/i)[1] ?? '';
  const v = apos
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/Goi[âa]nia|Registro|Propriet|DELEGADO|REP[ÚU]BLICA/i.test(l));

  let especie: string | undefined;
  let marca: string | undefined;
  let modelo: string | undefined;
  let numeroSerie: string | undefined;
  let calibre: string | undefined;
  let paisOrigem: string | undefined;

  if (v.length >= 4) {
    especie = v[0].split(/\s+/).slice(1).join(' ') || undefined; // "SINARM PISTOLA" → PISTOLA
    marca = v[1] || undefined;
    const vm = v[2].split(/\s+/);
    if (vm.length >= 2) {
      numeroSerie = vm[vm.length - 1];
      modelo = vm.slice(0, -1).join(' ');
    } else {
      modelo = v[2];
    }
    calibre = v[3].split(/\s+/)[0];
    paisOrigem = marca?.match(/\(([^)]+)\)/)?.[1];
  }
  const dataEmissao = paraISO(texto.match(/Data da NF:\s*\n?[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)?.[1]);

  return limpo({ numero, dataValidade, dataEmissao, numeroSerie, especie, marca, modelo, calibre, paisOrigem });
}

/** Valor na LINHA SEGUINTE a um rótulo isolado (layout do porte/CR). */
function valorLinhaSeguinte(linhas: string[], rotulos: string[]): string | undefined {
  for (let i = 0; i < linhas.length - 1; i++) {
    if (rotulos.some((r) => new RegExp(`^${r}\\s*$`, 'i').test(linhas[i]))) {
      const v = linhas[i + 1]?.trim();
      if (v) return v;
    }
  }
  return undefined;
}

// --------------------------------------------------- CR (Certificado de Registro)
function parseCR(texto: string): CamposExtraidos {
  const numero = texto.match(/N[º°o]\s*CR\s*([\d.\-]{6,})/i)?.[1];
  const dataValidade = paraISO(texto.match(/VALIDADE\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]);
  const atividades = texto
    .match(/ATIVIDADES AUTORIZADAS\s*\n([\s\S]*?)(?:\nDocumento Assinado|\nQR|\nA Autenticidade|$)/i)?.[1]
    ?.replace(/\s+/g, ' ')
    .trim();
  return limpo({ numero, dataValidade, observacoes: atividades ? `Atividades: ${atividades}` : undefined });
}

// --------------------------------------------------------- Porte Federal de Arma
function parsePorte(texto: string): CamposExtraidos {
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  return limpo({
    numero: valorLinhaSeguinte(linhas, ['CERTIFICADO N[º°o]']),
    numeroSerie: valorLinhaSeguinte(linhas, ['N[º°o] DA ARMA']),
    especie: valorLinhaSeguinte(linhas, ['ESP[ÉE]CIE']),
    marca: valorLinhaSeguinte(linhas, ['MARCA']),
    dataValidade: paraISO(texto.match(/validade[^0-9]{0,20}(\d{2}\/\d{2}\/\d{4})/i)?.[1]),
  });
}

// ----------------------------------------- Autorização de Aquisição (PCE/compra)
function parseAutorizacao(texto: string): CamposExtraidos {
  return limpo({
    numero: texto.match(/Autoriza[çc][ãa]o\s*N[º°o]:?\s*\n?\s*([0-9]{6,})/i)?.[1],
    dataEmissao: paraISO(texto.match(/Data de Emiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]),
    dataValidade: paraISO(texto.match(/Data de Validade:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]),
  });
}

/** Detecta o formato pelo texto e delega ao parser certo. */
export function mapearCampos(textoBruto: string, _tipo?: string): CamposExtraidos {
  const t = normalizar(textoBruto);
  if (/GUIA DE TR[ÁA]FEGO|AUTORIZA[ÇC][ÃA]O PARA TR[ÁA]FEGO/i.test(t)) return parseGuia(t);
  if (/AUTORIZA[ÇC][ÃA]O PARA AQUISI[ÇC][ÃA]O/i.test(t)) return parseAutorizacao(t);
  if (/PORTE\s+(?:FEDERAL\s+)?DE ARMA/i.test(t)) return parsePorte(t);
  if (/CERTIFICADO DE REGISTRO DE ARMA DE FOGO/i.test(t)) return parseCrafExercito(t);
  if (/\bN[º°o]\s*CR\b|ATIVIDADES AUTORIZADAS/i.test(t)) return parseCR(t);
  if (/SINARM|CERTIFICADO DE REGISTRO FEDERAL DE ARMA DE FOGO|N[º°o] Cad\. SINARM/i.test(t))
    return parseCrafSinarm(t);
  // Sem camada de texto (scan) ou formato desconhecido → nada (preenche à mão).
  return {};
}
