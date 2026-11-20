/**
 * Semeia o FORMULÁRIO de documentos e o TERMO DE USO de cada serviço do
 * despachante, com os requisitos reais de cada processo. Em TODOS os serviços:
 *   - Acesso gov.br (CPF + senha) [SENHA_GOV]
 *   - Confirmação de que a verificação em duas etapas (2FA) está DESABILITADA [CHECKBOX]
 * Certidões obtidas por consulta (criminais/eleitoral) NÃO são pedidas ao usuário.
 *
 * Idempotente: REcria os campos do serviço (apaga os existentes e insere a lista
 * abaixo) e define o termo. Rode quando quiser repor os padrões:
 *   npx tsx scripts/seed-formularios-despachante.ts         # aplica
 *   npx tsx scripts/seed-formularios-despachante.ts --dry   # só lista
 *
 * No servidor de produção o DATABASE_URL já é o MySQL local (sem túnel).
 */
import { prisma } from '../src/db/cliente.js';

type Tipo = 'ARQUIVO' | 'TEXTO' | 'CHECKBOX' | 'SENHA_GOV';
interface CampoSeed {
  tipo: Tipo;
  nome: string;
  descricao: string;
  obrigatorio: boolean;
}

const dry = process.argv.includes('--dry');

/** Campos comuns a todos os processos (acesso gov.br + 2FA + identificação). */
const COMUNS: CampoSeed[] = [
  {
    tipo: 'SENHA_GOV',
    nome: 'Acesso gov.br (CPF + senha)',
    descricao:
      'Informe o CPF e a senha do seu login gov.br. Usamos apenas para dar andamento ao seu ' +
      'processo nos sistemas oficiais (Exército/SIGMA, Polícia Federal/SINARM, IBAMA).',
    obrigatorio: true,
  },
  {
    tipo: 'CHECKBOX',
    nome: 'Verificação em duas etapas (2FA) do gov.br DESABILITADA',
    descricao:
      'Para acessarmos os sistemas em seu nome, a verificação em duas etapas do gov.br precisa ' +
      'estar DESATIVADA. Acesse sua conta gov.br → Segurança → Verificação em duas etapas e desative. ' +
      'Marque para confirmar que está desabilitada.',
    obrigatorio: true,
  },
  {
    tipo: 'ARQUIVO',
    nome: 'Documento de identificação (CNH ou RG)',
    descricao: 'Foto ou PDF legível da sua CNH ou RG (frente e verso).',
    obrigatorio: true,
  },
  {
    tipo: 'ARQUIVO',
    nome: 'Comprovante de endereço (últimos 90 dias)',
    descricao: 'Conta de água, luz, telefone ou internet em seu nome dos últimos 90 dias.',
    obrigatorio: true,
  },
];

/** Catálogo de campos específicos por código de serviço (legados mantidos). */
const POR_SERVICO: Record<string, { termo: string; campos: CampoSeed[] }> = {
  CADASTRO_RENOVACAO_IBAMA: {
    termo: termo('Cadastro / Renovação no IBAMA (CTF)'),
    campos: [
      ...COMUNS,
      {
        tipo: 'TEXTO',
        nome: 'Categoria/atividade no CTF',
        descricao: 'Ex.: atirador desportivo, colecionador, caçador. Se não souber, deixe em branco.',
        obrigatorio: false,
      },
    ],
  },
  AQUISICAO_TRANSFERENCIA: {
    termo: termo('Aquisição / Transferência de Equipamento (CAC)'),
    campos: [
      ...COMUNS,
      arq('CR — Certificado de Registro (vigente)', 'Seu CR de CAC em vigência (frente e verso).', true),
      arq('Comprovante de habitualidade', 'Comprovante de habitualidade/atividade no clube (para atirador).', false),
      arq('Comprovante de filiação a clube/entidade', 'Declaração de filiação ativa a clube de tiro ou entidade.', false),
      arq('Laudo de capacidade técnica', 'Laudo de capacidade técnica para manuseio (quando exigido).', false),
      arq('Laudo de aptidão psicológica', 'Laudo psicológico válido (quando exigido).', false),
      arq('Nota fiscal / documento da arma', 'Nota fiscal ou documento da arma a ser adquirida/transferida.', false),
    ],
  },
  POSSE_PF: {
    termo: termo('Posse de Arma de Fogo — Polícia Federal'),
    campos: [
      ...COMUNS,
      arq('Comprovante de ocupação lícita / renda', 'Declaração/comprovante de ocupação lícita e de renda.', true),
      arq('Laudo de aptidão psicológica', 'Laudo psicológico para manuseio de arma de fogo (psicólogo credenciado PF).', true),
      arq('Laudo de capacidade técnica', 'Laudo de capacidade técnica para manuseio (instrutor credenciado).', true),
      {
        tipo: 'CHECKBOX',
        nome: 'Declaro possuir local seguro para guarda do acervo',
        descricao: 'Cofre ou local seguro que impeça o acesso de menores e terceiros não autorizados.',
        obrigatorio: true,
      },
    ],
  },
  PORTE_PF: {
    termo: termo('Porte de Arma de Fogo — Polícia Federal'),
    campos: [
      ...COMUNS,
      arq('Comprovante de ocupação lícita / renda', 'Declaração/comprovante de ocupação lícita e de renda.', true),
      arq('Laudo de aptidão psicológica', 'Laudo psicológico para manuseio de arma de fogo (psicólogo credenciado PF).', true),
      arq('Laudo de capacidade técnica', 'Laudo de capacidade técnica para manuseio (instrutor credenciado).', true),
      {
        tipo: 'TEXTO',
        nome: 'Justificativa da efetiva necessidade do porte',
        descricao: 'Descreva a efetiva necessidade (atividade de risco, ameaça concreta, etc.).',
        obrigatorio: true,
      },
      arq('Comprovante da atividade de risco (se aplicável)', 'Documento que comprove a atividade de risco alegada.', false),
    ],
  },
  RENOVACAO_CRAF: {
    termo: termo('Renovação de CRAF'),
    campos: [
      ...COMUNS.map((c) =>
        c.nome.startsWith('Comprovante de endereço')
          ? { ...c, nome: 'Comprovante de endereço (histórico dos últimos 5 anos)', descricao: 'Comprovantes que demonstrem a residência nos últimos 5 anos (exigência da renovação).' }
          : c
      ),
      arq('CR — Certificado de Registro (vigente)', 'Seu CR de CAC em vigência.', true),
      arq('CRAF atual da arma', 'O CRAF vigente/vencido da arma a ser renovada.', true),
      arq('Laudo de aptidão psicológica (renovado)', 'Laudo psicológico válido, renovado (psicólogo credenciado PF).', true),
      arq('Comprovante de habitualidade (últimos 12 meses)', 'Comprovante de habitualidade do último ano (colecionador é dispensado).', false),
    ],
  },
  EMISSAO_GUIA: {
    termo: termo('Emissão de Guia de Tráfego'),
    campos: [
      ...COMUNS.filter((c) => c.nome !== 'Comprovante de endereço (últimos 90 dias)'),
      arq('CR — Certificado de Registro (vigente)', 'Seu CR de CAC em vigência.', true),
      arq('CRAF da arma', 'CRAF da arma que será transportada.', true),
      txt('Origem (cidade/UF)', 'Cidade e estado de onde a arma vai sair.', true),
      txt('Destino (cidade/UF)', 'Cidade e estado para onde a arma vai.', true),
      txt('Motivo do transporte', 'Ex.: competição, mudança, manutenção.', false),
    ],
  },
};

function arq(nome: string, descricao: string, obrigatorio: boolean): CampoSeed {
  return { tipo: 'ARQUIVO', nome, descricao, obrigatorio };
}
function txt(nome: string, descricao: string, obrigatorio: boolean): CampoSeed {
  return { tipo: 'TEXTO', nome, descricao, obrigatorio };
}

function termo(nomeServico: string): string {
  return (
    `TERMO DE USO — ${nomeServico}\n\n` +
    'O valor pago refere-se EXCLUSIVAMENTE ao serviço de despachante e às taxas administrativas ' +
    'correspondentes. NÃO estão incluídos valores de serviços de terceiros, como laudos de ' +
    'capacidade técnica, laudos psicológicos, taxas e emolumentos de órgãos (GRU/Exército, Polícia ' +
    'Federal, IBAMA) ou quaisquer custos externos.\n\n' +
    'O DEFERIMENTO do processo NÃO depende de nós: a análise e a decisão cabem exclusivamente aos ' +
    'órgãos competentes (Exército, Polícia Federal, IBAMA, Justiça). O pagamento do serviço NÃO ' +
    'garante a aprovação/deferimento do pedido.\n\n' +
    'O resultado depende de variáveis do próprio cliente — como antecedentes e histórico criminal, ' +
    'cumprimento dos requisitos legais, veracidade e completude da documentação — e da legislação ' +
    'vigente, que pode mudar a qualquer tempo.\n\n' +
    'Você é responsável por fornecer documentação verdadeira, completa e legível, e por manter os ' +
    'requisitos exigidos pela lei. Ao marcar "Li e concordo", você declara estar ciente e de acordo ' +
    'com todas estas condições.'
  );
}

async function main() {
  for (const [codigo, def] of Object.entries(POR_SERVICO)) {
    const servico = await prisma.servicoDespachante.findUnique({ where: { codigo } });
    if (!servico) {
      console.log(`• ${codigo}: serviço não encontrado — pulando`);
      continue;
    }
    console.log(`• ${codigo}: ${def.campos.length} campo(s) + termo`);
    if (dry) continue;
    await prisma.$transaction([
      prisma.campoServicoDespachante.deleteMany({ where: { servicoId: servico.id } }),
      ...def.campos.map((c, i) =>
        prisma.campoServicoDespachante.create({
          data: {
            servicoId: servico.id,
            tipo: c.tipo,
            nome: c.nome,
            descricao: c.descricao,
            obrigatorio: c.obrigatorio,
            ordem: (i + 1) * 10,
          },
        })
      ),
      prisma.servicoDespachante.update({ where: { id: servico.id }, data: { termoAceite: def.termo } }),
    ]);
  }
  console.log(dry ? 'Dry-run concluído.' : 'Formulários e termos aplicados.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
