/**
 * O núcleo da habitualidade: quem é cobrado, o que conta e quando sai da conta.
 *
 * A janela é móvel, então a fronteira dos 12 meses é o ponto mais fácil de
 * errar — e o mais caro, porque um "em dia" errado é o app dizendo ao atirador
 * que ele pode ficar em casa. Por isso a fronteira é exercitada nos dois lados.
 */
import {
  avisoDeHabitualidade,
  calcularProgresso,
  gruposDaSessao,
  gruposExigidos,
  inicioJanela,
  MINIMO_POR_GRUPO,
  saiDaJanelaEm,
} from '@/domain/habitualidade';
import { isoParaBR, somarDias, somarMeses } from '@/lib/data';
import type { Arma, Grupo, Habitualidade } from '@/domain/tipos';

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
    criadoEm: `${data}T10:00:00.000Z`,
    atualizadoEm: `${data}T10:00:00.000Z`,
  };
}

/** n sessões espaçadas de 20 dias, a partir de `dias` atrás. */
function varias(n: number, grupos: Grupo[], diasAtras = 10): Habitualidade[] {
  return Array.from({ length: n }, (_, i) => sessao(somarDias(HOJE, -(diasAtras + i * 20)), grupos));
}

console.log('\n1. Só o acervo de atirador é cobrado');
{
  conferir(
    'caça, coleção e defesa pessoal não exigem nada',
    gruposExigidos([
      arma('CC_PERMITIDA', 'DEFESA_PESSOAL'),
      arma('CLL_PERMITIDA', 'CACA'),
      arma('CLR_RESTRITA', 'COLECAO'),
    ]).length === 0
  );

  const exigidos = gruposExigidos([
    arma('CC_RESTRITA'),
    arma('CC_RESTRITA'),
    arma('CLL_PERMITIDA'),
    arma('CLR_RESTRITA', 'CACA'),
  ]);
  conferir('só os grupos com arma de atirador entram', exigidos.length === 2, exigidos.join(', '));
  conferir(
    'ordem do catálogo (longo raiada antes de curto)',
    exigidos[0] === 'CC_RESTRITA' && exigidos[1] === 'CLL_PERMITIDA'
  );

  // Quem NÃO é atirador (ehAtirador falso) não deve nada, nem genérica — mesmo
  // com sessões registradas. A dedução padrão (todo mundo é atirador) só não
  // vale para quem desmarcou.
  const naoAtirador = calcularProgresso(
    [arma('CC_PERMITIDA', 'CACA')],
    varias(10, ['CC_PERMITIDA']),
    HOJE,
    false
  );
  conferir(
    'não atirador não vira cobrança',
    !naoAtirador.exigido && naoAtirador.grupos.length === 0 && naoAtirador.generico === null
  );
}

console.log('\n2. A fronteira dos 12 meses');
{
  const limite = somarMeses(HOJE, -12); // 2025-09-27
  conferir('início da janela é o dia seguinte aos 12 meses', inicioJanela(HOJE) === '2025-09-28');

  const armas = [arma('CC_RESTRITA')];

  const noLimite = calcularProgresso(armas, [sessao(limite, ['CC_RESTRITA'])], HOJE);
  conferir('sessão de exatos 12 meses atrás NÃO conta', noLimite.grupos[0].feitas === 0, limite);

  const umDiaDentro = calcularProgresso(
    armas,
    [sessao(somarDias(limite, 1), ['CC_RESTRITA'])],
    HOJE
  );
  conferir('um dia depois disso conta', umDiaDentro.grupos[0].feitas === 1);

  const hoje = calcularProgresso(armas, [sessao(HOJE, ['CC_RESTRITA'])], HOJE);
  conferir('sessão de hoje conta', hoje.grupos[0].feitas === 1);

  const futuro = calcularProgresso(
    armas,
    [sessao(somarDias(HOJE, 1), ['CC_RESTRITA'])],
    HOJE
  );
  conferir('sessão com data futura não conta', futuro.grupos[0].feitas === 0);

  conferir('saiDaJanelaEm soma 12 meses de calendário', saiDaJanelaEm('2026-02-29') === '2027-02-28');
}

console.log('\n3. Uma sessão credita cada grupo uma vez');
{
  const armas = [arma('CC_RESTRITA'), arma('CLL_PERMITIDA')];

  const duasDoMesmo = sessao('2026-09-01', ['CC_RESTRITA', 'CC_RESTRITA']);
  conferir('duas armas do mesmo grupo = 1 grupo creditado', gruposDaSessao(duasDoMesmo).length === 1);

  const p = calcularProgresso(armas, [duasDoMesmo], HOJE);
  conferir(
    'e vale uma habitualidade, não duas',
    p.grupos.find((g) => g.grupo === 'CC_RESTRITA')?.feitas === 1
  );

  const misto = calcularProgresso(
    armas,
    [sessao('2026-09-01', ['CC_RESTRITA', 'CLL_PERMITIDA'])],
    HOJE
  );
  conferir(
    'grupos diferentes na mesma sessão creditam os dois',
    misto.grupos.every((g) => g.feitas === 1)
  );
  conferir('a sessão em si é contada uma vez', misto.sessoesNaJanela === 1);
}

console.log('\n4. O mínimo de 8 por grupo');
{
  const armas = [arma('CC_RESTRITA'), arma('CLL_PERMITIDA')];
  const sessoes = [...varias(MINIMO_POR_GRUPO, ['CC_RESTRITA']), ...varias(3, ['CLL_PERMITIDA'])];
  const p = calcularProgresso(armas, sessoes, HOJE);

  const curto = p.grupos.find((g) => g.grupo === 'CC_RESTRITA')!;
  const longo = p.grupos.find((g) => g.grupo === 'CLL_PERMITIDA')!;

  conferir('8 sessões cumprem o grupo', curto.cumprido && curto.faltam === 0);
  conferir('3 sessões não cumprem', !longo.cumprido && longo.faltam === MINIMO_POR_GRUPO - 3);
  conferir('cumpridos conta só os grupos em dia', p.cumpridos === 1);
  conferir('faltamTotal soma o que falta em todos', p.faltamTotal === MINIMO_POR_GRUPO - 3);
  conferir('armas por grupo são contadas', curto.armas === 1 && longo.armas === 1);
  conferir('última sessão é a mais recente', curto.ultima === somarDias(HOJE, -10));
}

console.log('\n5. perdeEm avisa antes de cair abaixo do mínimo');
{
  const armas = [arma('CC_RESTRITA')];
  // 8 sessões: a mais antiga (a 8ª mais recente) é a que define o prazo.
  const sessoes = varias(MINIMO_POR_GRUPO, ['CC_RESTRITA']);
  const oitava = sessoes[MINIMO_POR_GRUPO - 1].data;
  const p = calcularProgresso(armas, sessoes, HOJE).grupos[0];

  conferir('perdeEm = 12 meses após a 8ª mais recente', p.perdeEm === saiDaJanelaEm(oitava), `${p.perdeEm}`);
  conferir('e está no futuro', !!p.perdeEm && p.perdeEm > HOJE);

  // Só a 8ª MAIS RECENTE define o prazo: uma sessão nova empurra a fronteira
  // para frente, uma sessão antiga a mais não muda nada.
  const comNova = calcularProgresso(
    armas,
    [sessao(somarDias(HOJE, -2), ['CC_RESTRITA']), ...sessoes],
    HOJE
  ).grupos[0];
  conferir('sessão nova empurra o prazo para frente', comNova.perdeEm! > p.perdeEm!);
  conferir('excedente não estraga a contagem', comNova.feitas === MINIMO_POR_GRUPO + 1);

  const comVelha = calcularProgresso(
    armas,
    [...sessoes, sessao(somarDias(HOJE, -300), ['CC_RESTRITA'])],
    HOJE
  ).grupos[0];
  conferir('sessão antiga a mais não muda o prazo', comVelha.perdeEm === p.perdeEm);

  const incompleto = calcularProgresso(armas, varias(7, ['CC_RESTRITA']), HOJE).grupos[0];
  conferir('grupo incompleto não tem perdeEm', incompleto.perdeEm === null);
}

console.log('\n6. A sessão sobrevive à venda da arma');
{
  const armas = [arma('CC_RESTRITA')];
  // Sessão registrada com uma arma que já saiu do acervo: armaId null, grupo gravado.
  const orfa: Habitualidade = {
    ...sessao('2026-09-10', []),
    armas: [{ armaId: null, grupo: 'CC_RESTRITA', nome: 'Pistola vendida' }],
  };
  const p = calcularProgresso(armas, [orfa], HOJE);
  conferir('crédito do grupo continua valendo', p.grupos[0].feitas === 1);
}

console.log('\n7. Não atirador: acervo vazio não inventa cobrança');
{
  const p = calcularProgresso([], [], HOJE, false);
  conferir('nada exigido', !p.exigido);
  conferir(
    'nenhum grupo, nenhum genérico, nenhuma pendência',
    p.grupos.length === 0 && p.generico === null && p.faltamTotal === 0
  );
  conferir('janela ainda é informada', p.inicio === '2025-09-28' && p.hoje === HOJE);
}

console.log('\n8. O aviso: só fala quando há o que cobrar');
{
  const armas = [arma('CC_RESTRITA'), arma('CLL_PERMITIDA')];

  // Tudo em dia e longe de cair: nada a notificar.
  const emDia = calcularProgresso(
    armas,
    [...varias(MINIMO_POR_GRUPO, ['CC_RESTRITA'], 1), ...varias(MINIMO_POR_GRUPO, ['CLL_PERMITIDA'], 1)],
    HOJE
  );
  conferir('em dia não gera aviso', avisoDeHabitualidade(emDia) === null);

  // Quem não é atirador não tem cobrança, logo não tem aviso.
  const semExigencia = calcularProgresso([arma('CC_RESTRITA', 'CACA')], [], HOJE, false);
  conferir('não atirador não gera aviso', avisoDeHabitualidade(semExigencia) === null);
}

console.log('\n9. Grupo atrasado: falta em aberto, sem data');
{
  const armas = [arma('CC_RESTRITA'), arma('CLL_PERMITIDA')];
  const p = calcularProgresso(armas, varias(5, ['CC_RESTRITA']), HOJE);
  const aviso = avisoDeHabitualidade(p)!;

  conferir('gera aviso', !!aviso);
  conferir('título diz incompleta', aviso.titulo.includes('incompleta'), aviso.titulo);
  conferir('conta os grupos abaixo do mínimo', aviso.subtitulo.includes('2 grupos'), aviso.subtitulo);
  conferir('corpo mostra a contagem de cada grupo', aviso.corpo.includes('5/8') && aviso.corpo.includes('faltam 3'), aviso.corpo.replace(/\n/g, ' | '));
  conferir('urgência negativa: já irregular hoje', aviso.pior === -1);
  conferir('NÃO fura o Foco do iOS (seria ruído diário)', aviso.urgente === false);
  conferir('itens = grupos cobrados, para o badge', aviso.itens === 2);
}

console.log('\n10. Grupo a caminho de cair: aí sim tem data');
{
  const armas = [arma('CC_RESTRITA')];
  // 8 sessões em que a 8ª mais recente cai dentro de 30 dias.
  const oitavaCaiEm = somarDias(HOJE, 10);
  const oitava = somarMeses(oitavaCaiEm, -12);
  const sessoes = [
    ...Array.from({ length: MINIMO_POR_GRUPO - 1 }, (_, i) =>
      sessao(somarDias(HOJE, -(1 + i)), ['CC_RESTRITA'])
    ),
    sessao(oitava, ['CC_RESTRITA']),
  ];
  const p = calcularProgresso(armas, sessoes, HOJE);
  conferir('o grupo está cumprido', p.grupos[0].cumprido, `${p.grupos[0].feitas}/8`);
  conferir('perdeEm cai dentro da janela', p.grupos[0].perdeEm === oitavaCaiEm, `${p.grupos[0].perdeEm}`);

  const aviso = avisoDeHabitualidade(p)!;
  conferir('gera aviso mesmo estando em dia hoje', !!aviso);
  conferir('título diz a vencer', aviso.titulo.includes('a vencer'), aviso.titulo);
  conferir('corpo traz a data absoluta, não contagem', aviso.corpo.includes(isoParaBR(oitavaCaiEm)), aviso.corpo);
  conferir('corpo diz para quanto cai', aviso.corpo.includes('cai para 7'), aviso.corpo);
  conferir('urgência = dias até cair', aviso.pior === 10);
  conferir('a 10 dias não fura o Foco', aviso.urgente === false);
}

console.log('\n11. Perda iminente (≤7 dias) fura o Foco');
{
  const armas = [arma('CC_RESTRITA')];
  const caiEm = somarDias(HOJE, 5);
  const sessoes = [
    ...Array.from({ length: MINIMO_POR_GRUPO - 1 }, (_, i) =>
      sessao(somarDias(HOJE, -(1 + i)), ['CC_RESTRITA'])
    ),
    sessao(somarMeses(caiEm, -12), ['CC_RESTRITA']),
  ];
  const aviso = avisoDeHabitualidade(calcularProgresso(armas, sessoes, HOJE))!;
  conferir('a 5 dias da perda, é time sensitive', aviso.urgente === true);
  conferir('urgência reflete os 5 dias', aviso.pior === 5);
}

console.log('\n12. Grupo em dia e longe de cair não entra no aviso');
{
  const armas = [arma('CC_RESTRITA'), arma('CLL_PERMITIDA')];
  // Curto: atrasado. Longo: completo com sessões recentes, longe de cair.
  const sessoes = [
    ...varias(3, ['CC_RESTRITA']),
    ...varias(MINIMO_POR_GRUPO, ['CLL_PERMITIDA'], 1),
  ];
  const aviso = avisoDeHabitualidade(calcularProgresso(armas, sessoes, HOJE))!;
  conferir('só o atrasado é citado', aviso.itens === 1, `itens=${aviso.itens}`);
  conferir('corpo fala do curto', aviso.corpo.includes('Curto restrita'), aviso.corpo);
  conferir('corpo não fala do longo', !aviso.corpo.includes('Longo lisa'), aviso.corpo);
}

console.log('\n13. Atirador sem arma de atirador: 8 genéricas de qualquer grupo');
{
  // Nenhuma arma: a dedução padrão é que a pessoa é atiradora e deve 8.
  const semArma = calcularProgresso([], [], HOJE);
  conferir('exige mesmo sem arma', semArma.exigido && semArma.generico !== null);
  conferir('não há grupos a cobrar', semArma.grupos.length === 0);
  conferir('faltam as 8', semArma.generico!.faltam === MINIMO_POR_GRUPO && !semArma.generico!.cumprido);
  conferir('faltamTotal reflete o genérico', semArma.faltamTotal === MINIMO_POR_GRUPO);

  // Só arma de caça não vira grupo — segue genérico, e as sessões contam.
  const soCaca = calcularProgresso(
    [arma('CLL_PERMITIDA', 'CACA')],
    varias(5, ['CC_RESTRITA']),
    HOJE
  );
  conferir('acervo só de caça cai no genérico', soCaca.generico !== null && soCaca.grupos.length === 0);
  conferir('genérico conta as 5 sessões', soCaca.generico!.feitas === 5 && soCaca.generico!.faltam === 3);

  // Qualquer grupo conta, e cada sessão vale uma — mesmo com dois grupos nela.
  const doisGrupos = calcularProgresso(
    [],
    [sessao('2026-09-01', ['CC_RESTRITA', 'CLL_PERMITIDA'])],
    HOJE
  );
  conferir('sessão com dois grupos conta como uma genérica', doisGrupos.generico!.feitas === 1);

  // 8 sessões cumprem, e o prazo nasce da 8ª mais recente.
  const cheio = calcularProgresso([], varias(MINIMO_POR_GRUPO, ['CC_PERMITIDA']), HOJE);
  const oitava = somarDias(HOJE, -(10 + (MINIMO_POR_GRUPO - 1) * 20));
  conferir('8 genéricas cumprem', cheio.generico!.cumprido && cheio.generico!.faltam === 0);
  conferir('cumpridos conta o genérico em dia', cheio.cumpridos === 1);
  conferir('perdeEm = 12 meses após a 8ª mais recente', cheio.generico!.perdeEm === saiDaJanelaEm(oitava), `${cheio.generico!.perdeEm}`);
}

console.log('\n14. Aviso do genérico');
{
  const atrasado = avisoDeHabitualidade(calcularProgresso([], varias(3, ['CC_PERMITIDA']), HOJE))!;
  conferir('genérico incompleto gera aviso', !!atrasado);
  conferir('título diz incompleta', atrasado.titulo.includes('incompleta'), atrasado.titulo);
  conferir('subtítulo fala em sessões, não grupos', atrasado.subtitulo.includes('5 de 8') || atrasado.subtitulo.includes('sessões'), atrasado.subtitulo);
  conferir('corpo mostra 3/8', atrasado.corpo.includes('3/8'), atrasado.corpo);
  conferir('já irregular hoje', atrasado.pior === -1);

  // Genérico cumprido, com a 8ª mais recente caindo em 10 dias.
  const caiEm = somarDias(HOJE, 10);
  const sessoes = [
    ...Array.from({ length: MINIMO_POR_GRUPO - 1 }, (_, i) =>
      sessao(somarDias(HOJE, -(1 + i)), ['CC_PERMITIDA'])
    ),
    sessao(somarMeses(caiEm, -12), ['CC_PERMITIDA']),
  ];
  const aCair = avisoDeHabitualidade(calcularProgresso([], sessoes, HOJE))!;
  conferir('genérico a vencer gera aviso', !!aCair && aCair.titulo.includes('a vencer'), aCair?.titulo);
  conferir('traz a data da perda', aCair.corpo.includes(isoParaBR(caiEm)), aCair.corpo);
}

console.log('\n15. Não atirador tem prioridade sobre o acervo');
{
  // Mesmo com arma de atirador e sessões, quem desmarcou não deve nada.
  const p = calcularProgresso([arma('CC_RESTRITA')], varias(MINIMO_POR_GRUPO, ['CC_RESTRITA']), HOJE, false);
  conferir('não exige', !p.exigido);
  conferir('sem grupos e sem genérico', p.grupos.length === 0 && p.generico === null);
  conferir('nenhum aviso', avisoDeHabitualidade(p) === null);
}

console.log('\n16. Só defesa pessoal não cobra (nem genérica)');
{
  // Toggle ligado (padrão): mesmo assim, acervo só de defesa pessoal não exige.
  const soDefesa = calcularProgresso([arma('CC_PERMITIDA', 'DEFESA_PESSOAL')], [], HOJE);
  conferir('não exige', !soDefesa.exigido);
  conferir('sem grupo e sem genérico', soDefesa.grupos.length === 0 && soDefesa.generico === null);
  conferir('nenhum aviso', avisoDeHabitualidade(soDefesa) === null);

  // Nem com sessões registradas — defesa pessoal não vira habitualidade.
  const comSessoes = calcularProgresso(
    [arma('CC_PERMITIDA', 'DEFESA_PESSOAL'), arma('CLL_PERMITIDA', 'DEFESA_PESSOAL')],
    varias(5, ['CC_PERMITIDA']),
    HOJE
  );
  conferir('duas de defesa, com sessões: ainda não exige', !comSessoes.exigido && comSessoes.generico === null);

  // Defesa + caça (nenhuma de atirador): NÃO é só defesa, então cai no genérico.
  const defesaMaisCaca = calcularProgresso(
    [arma('CC_PERMITIDA', 'DEFESA_PESSOAL'), arma('CLL_PERMITIDA', 'CACA')],
    varias(2, ['CC_PERMITIDA']),
    HOJE
  );
  conferir('defesa + caça cai no genérico', defesaMaisCaca.generico !== null && defesaMaisCaca.generico!.feitas === 2);

  // Com arma de atirador junto, vale o por-grupo — defesa pessoal é ignorada.
  const comAtirador = calcularProgresso(
    [arma('CC_PERMITIDA', 'DEFESA_PESSOAL'), arma('CC_RESTRITA', 'ATIRADOR')],
    [],
    HOJE
  );
  conferir('defesa + atirador: por grupo, só o grupo de atirador', comAtirador.generico === null && comAtirador.grupos.length === 1 && comAtirador.grupos[0].grupo === 'CC_RESTRITA');
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam\n` : '\nTodas as verificações passaram\n');
process.exit(falhas ? 1 : 0);
