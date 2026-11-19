/**
 * O resumo que vai para o widget da tela inicial.
 *
 * O widget não calcula nada — ele só desenha o que este módulo entrega. Então
 * o que importa aqui é que as três situações do produto (tudo em ordem,
 * documento a vencer, habitualidade atrasada) caiam nos campos certos, porque
 * um resumo errado é o widget mentindo na cara do usuário o dia inteiro.
 */
import { montarResumoWidget } from '@/widget/resumo';
import { somarDias } from '@/lib/data';
import type { Arma, Documento, Grupo, Habitualidade } from '@/domain/tipos';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`${condicao ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

const HOJE = '2026-09-27';

let seq = 0;
function arma(grupo: Grupo, acervo: Arma['acervo'] = 'ATIRADOR'): Arma {
  seq += 1;
  return {
    id: `a${seq}`,
    apelido: null,
    marca: null,
    modelo: `Modelo ${seq}`,
    numeroSerie: `S${seq}`,
    acervo,
    grupo,
    calibre: '9x19mm',
    especie: null,
    funcionamento: null,
    fabricante: null,
    paisOrigem: null,
    anoFabricacao: null,
    numeroCano: null,
    capacidade: null,
    registroNumero: null,
    localGuarda: null,
    observacoes: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
  };
}

function doc(tipo: Documento['tipo'], validade: string, titulo: string | null = null): Documento {
  seq += 1;
  return {
    id: `d${seq}`,
    tipo,
    armaId: null,
    titulo,
    numero: null,
    orgao: null,
    dataEmissao: null,
    dataValidade: validade,
    origem: null,
    destino: null,
    localManejo: null,
    observacoes: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
  };
}

function sessao(data: string, grupos: Grupo[]): Habitualidade {
  seq += 1;
  return {
    id: `h${seq}`,
    data,
    tipo: 'TREINO',
    localId: null,
    localNome: 'Clube',
    observacoes: null,
    armas: grupos.map((g, i) => ({ armaId: `x${seq}-${i}`, grupo: g, nome: `Arma ${i}` })),
    ambito: null,
    criadoEm: `${data}T10:00:00.000Z`,
    atualizadoEm: `${data}T10:00:00.000Z`,
  };
}

/** Oito sessões de um grupo, todas dentro da janela — cumpre o mínimo. */
function oitoSessoes(grupo: Grupo): Habitualidade[] {
  return Array.from({ length: 8 }, (_, i) => sessao(somarDias(HOJE, -(i + 1)), [grupo]));
}

// --------------------------------------------------------------- tudo em ordem

{
  // Documento longe do vencimento + habitualidade cumprida = check verde.
  const r = montarResumoWidget(
    [doc('CRAF', somarDias(HOJE, 200))],
    [arma('CC_RESTRITA')],
    oitoSessoes('CC_RESTRITA'),
    true,
    HOJE
  );
  conferir('tudo ok: estadoGeral OK', r.estadoGeral === 'OK');
  conferir('tudo ok: mensagem do acervo', r.docMsg === 'Tudo em ordem com seu acervo');
  conferir('tudo ok: docEstado OK', r.docEstado === 'OK' && r.docQtdAtencao === 0);
  conferir('tudo ok: habitualidade em dia e barra cheia', r.habEmDia && r.habProgresso === 1);
}

// ------------------------------------------------------- documento a vencer

{
  // Um único documento dentro dos 30 dias: frase específica e acionável.
  const r = montarResumoWidget([doc('CRAF', somarDias(HOJE, 12))], [], [], true, HOJE);
  conferir('1 doc a vencer: docEstado ATENCAO', r.docEstado === 'ATENCAO' && r.docQtdAtencao === 1);
  conferir('1 doc a vencer: frase específica', r.docMsg === 'CRAF vence em 12 dias', r.docMsg);
  conferir('1 doc a vencer: estadoGeral ATENCAO', r.estadoGeral === 'ATENCAO');
}

{
  // Documento vencido pesa mais que um só a vencer: estado VENCIDO.
  const r = montarResumoWidget(
    [doc('CRAF', somarDias(HOJE, -3)), doc('CR', somarDias(HOJE, 10))],
    [],
    [],
    true,
    HOJE
  );
  conferir('doc vencido: docEstado VENCIDO', r.docEstado === 'VENCIDO');
  conferir('doc vencido: conta 2 em atenção', r.docQtdAtencao === 2);
  conferir('doc vencido: mensagem plural', r.docMsg === '2 documentos precisam de atenção', r.docMsg);
}

{
  // Documento a 90 dias ainda não entra na janela de atenção.
  const r = montarResumoWidget([doc('CRAF', somarDias(HOJE, 90))], [], [], true, HOJE);
  conferir('doc a 90 dias: fora da janela, estado OK', r.docEstado === 'OK' && r.docQtdAtencao === 0);
}

// --------------------------------------------------------- habitualidade

{
  // Habitualidade atrasada (3 de 8): barra parcial e fora de dia.
  const r = montarResumoWidget(
    [doc('CRAF', somarDias(HOJE, 200))],
    [arma('CC_RESTRITA')],
    [sessao(somarDias(HOJE, -1), ['CC_RESTRITA']), sessao(somarDias(HOJE, -2), ['CC_RESTRITA']), sessao(somarDias(HOJE, -3), ['CC_RESTRITA'])],
    true,
    HOJE
  );
  conferir('hab atrasada: não está em dia', !r.habEmDia && r.habExigido);
  conferir('hab atrasada: barra em 3/8', Math.abs(r.habProgresso - 3 / 8) < 1e-9, String(r.habProgresso));
  conferir('hab atrasada: estadoGeral ATENCAO mesmo com docs ok', r.estadoGeral === 'ATENCAO');
  conferir('hab atrasada: um grupo na lista', r.habGrupos.length === 1 && r.habGrupos[0].feitas === 3);
}

{
  // Dois grupos, um cumprido e um pela metade: barra = média ponderada (75%).
  const r = montarResumoWidget(
    [doc('CRAF', somarDias(HOJE, 200))],
    [arma('CC_RESTRITA'), arma('CLL_PERMITIDA')],
    [...oitoSessoes('CC_RESTRITA'), ...Array.from({ length: 4 }, (_, i) => sessao(somarDias(HOJE, -(i + 1)), ['CLL_PERMITIDA']))],
    true,
    HOJE
  );
  conferir('dois grupos: barra 12/16 = 75%', Math.abs(r.habProgresso - 0.75) < 1e-9, String(r.habProgresso));
  conferir('dois grupos: texto "1 de 2 grupos em dia"', r.habTexto === '1 de 2 grupos em dia', r.habTexto);
  conferir('dois grupos: lista com os dois', r.habGrupos.length === 2);
}

{
  // Acompanhamento desligado: habitualidade não é exigida nem derruba o geral.
  const r = montarResumoWidget(
    [doc('CRAF', somarDias(HOJE, 200))],
    [arma('CC_RESTRITA')],
    [],
    false,
    HOJE
  );
  conferir('desligado: não exigido e em dia', !r.habExigido && r.habEmDia);
  conferir('desligado: estadoGeral OK', r.estadoGeral === 'OK');
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam\n` : '\nTodas as verificações passaram\n');
process.exit(falhas ? 1 : 0);
