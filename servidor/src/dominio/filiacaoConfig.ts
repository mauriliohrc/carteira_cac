import { prisma } from '../db/cliente.js';

/**
 * Configuração da filiação à liga, resolvida com defaults. O que estiver no
 * banco (editado pelo backoffice) manda; na ausência, usa os defaults abaixo.
 * Assim preço e identidade da liga mudam sem update do app.
 */
/** Conteúdo editável da tela da liga (configurável no backoffice). */
export interface ConteudoLiga {
  titulo: string;
  subtitulo: string;
  vantagens: string[];
  credibilidade: string;
  termos: string;
}

export interface ConfigFiliacaoResolvida {
  /** Valor da anuidade, em centavos. */
  valorCentavos: number;
  /** Filiação disponível para contratação (precisa de preço > 0 e ativo). */
  ativo: boolean;
  /** Nome da liga, exibido no app, carteirinha, certificado e verificação. */
  nomeLiga: string;
  /** Logo da liga (data URI ou URL), ou null. */
  logoUrl: string | null;
  /** Conteúdo da tela da liga (com defaults aplicados). */
  conteudo: ConteudoLiga;
}

/** Nome padrão enquanto o backoffice não configurou a identidade da liga. */
export const NOME_LIGA_PADRAO = 'Liga Carteira CAC';

/** Conteúdo padrão (fallback) da tela da liga — usado quando o backoffice não editou. */
export const CONTEUDO_LIGA_PADRAO: ConteudoLiga = {
  titulo: 'Faça parte da liga',
  subtitulo:
    'A filiação garante seu vínculo com uma entidade de tiro (exigência legal do CAC) e ainda libera o app completo.',
  vantagens: [
    'Vínculo anual com entidade formalizada — requisito legal para o CAC',
    'Validade na Polícia Federal para provas de nível nacional',
    'Assessoria jurídica da liga durante toda a vigência',
    'Competições federais para manter e subir de nível',
    'Acesso Premium completo ao aplicativo (acervo ilimitado)',
  ],
  credibilidade:
    'Liga formalizada e atuante. Os responsáveis pelo app e pela liga estão no mercado de tiro esportivo há mais de 10 anos.',
  termos:
    'A anuidade renova automaticamente a cada ano, salvo cancelamento. O vínculo associativo e a assessoria jurídica valem durante a vigência.',
};

/** Mescla o conteúdo salvo (JSON parcial) com os defaults. */
function resolverConteudo(raw: string | null | undefined): ConteudoLiga {
  if (!raw) return CONTEUDO_LIGA_PADRAO;
  try {
    const p = JSON.parse(raw) as Partial<ConteudoLiga>;
    return {
      titulo: p.titulo?.trim() || CONTEUDO_LIGA_PADRAO.titulo,
      subtitulo: p.subtitulo?.trim() || CONTEUDO_LIGA_PADRAO.subtitulo,
      vantagens:
        Array.isArray(p.vantagens) && p.vantagens.filter((v) => v?.trim()).length
          ? p.vantagens.map((v) => v.trim()).filter(Boolean)
          : CONTEUDO_LIGA_PADRAO.vantagens,
      credibilidade: p.credibilidade?.trim() || CONTEUDO_LIGA_PADRAO.credibilidade,
      termos: p.termos?.trim() || CONTEUDO_LIGA_PADRAO.termos,
    };
  } catch {
    return CONTEUDO_LIGA_PADRAO;
  }
}

export async function resolverConfigFiliacao(): Promise<ConfigFiliacaoResolvida> {
  let cfg = null;
  try {
    cfg = await prisma.filiacaoConfig.findUnique({ where: { id: 'unico' } });
  } catch {
    // Tabela ainda não migrada (deploy antigo): usa só os defaults.
    cfg = null;
  }
  const valorCentavos = cfg?.valorCentavos ?? 0;
  return {
    valorCentavos,
    // Sempre disponível, desde que haja um preço configurado (> 0).
    ativo: valorCentavos > 0,
    nomeLiga: cfg?.nomeLiga?.trim() || NOME_LIGA_PADRAO,
    logoUrl: cfg?.logoUrl ?? null,
    conteudo: resolverConteudo(cfg?.conteudoJson),
  };
}
