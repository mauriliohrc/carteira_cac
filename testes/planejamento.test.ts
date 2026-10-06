import {
  planejar,
  agruparNoDia,
  avisosDoDia,
  CHAVE_PESSOAL,
  DIAS_DETALHADOS,
  ORCAMENTO_PENDENTES,
  TETO_DIARIO,
  type EntradaAlerta,
  type FrenteExtra,
} from '@/notificacoes/planejamento';
import { somarDias } from '@/lib/data';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`${condicao ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

const HOJE = '2026-09-20';
const ONTEM_A_NOITE = new Date(2026, 8, 19, 23, 0, 0);
const OPCOES = { hoje: HOJE, hora: 9, agora: ONTEM_A_NOITE };

function doc(grupo: string, titulo: string, rotulo: string, validade: string): EntradaAlerta {
  return { grupoChave: grupo, grupoTitulo: titulo, rotulo, validade };
}

/** A frente de habitualidade como ela chega ao planejador. */
const HABITUALIDADE: FrenteExtra = {
  aviso: {
    titulo: '🎯 Habitualidade incompleta',
    subtitulo: '2 grupos abaixo de 8',
    corpo: '• Curto restrita — 5/8, faltam 3',
    urgente: false,
  },
  pior: -1,
  itens: 2,
};

const porDiaDe = (plano: { quando: Date }[]) => {
  const m = new Map<string, number>();
  for (const a of plano) {
    const k = a.quando.toDateString();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

// ---------------------------------------------------------------- cenários

console.log('\n1. Acervo pequeno: 2 armas, 3 documentos');
{
  const entradas = [
    doc('a1', 'Glock G25', 'CRAF', somarDias(HOJE, 10)),
    doc('a1', 'Glock G25', 'Guia de Tráfego', somarDias(HOJE, 25)),
    doc(CHAVE_PESSOAL, 'Meus documentos', 'Laudo Psicológico', somarDias(HOJE, -3)),
  ];
  const plano = planejar(entradas, OPCOES);
  const porDia = new Map<string, number>();
  for (const a of plano) {
    const k = a.quando.toDateString();
    porDia.set(k, (porDia.get(k) ?? 0) + 1);
  }
  conferir('nunca passa de 10 por dia', [...porDia.values()].every((n) => n <= TETO_DIARIO));
  conferir('cabe no orçamento do iOS', plano.length <= ORCAMENTO_PENDENTES, `${plano.length} avisos`);
  conferir('dias detalhados geram 2 avisos (1 por frente)', porDia.get(new Date(2026, 8, 20).toDateString()) === 2);
  console.log('    exemplo:', JSON.stringify(plano[0].titulo), '/', JSON.stringify(plano[0].subtitulo));
}

console.log('\n2. Acervo grande: 40 armas, todas com CRAF vencendo em 5 dias');
{
  const entradas = Array.from({ length: 40 }, (_, i) =>
    doc(`a${i}`, `Arma ${String(i).padStart(2, '0')}`, 'CRAF', somarDias(HOJE, 5))
  );
  const plano = planejar(entradas, OPCOES);
  const porDia = new Map<string, number>();
  for (const a of plano) {
    const k = a.quando.toDateString();
    porDia.set(k, (porDia.get(k) ?? 0) + 1);
  }
  const maxDia = Math.max(...porDia.values());
  conferir('teto de 10 por dia respeitado', maxDia <= TETO_DIARIO, `máximo observado: ${maxDia}`);
  conferir('cabe no orçamento do iOS', plano.length <= ORCAMENTO_PENDENTES, `${plano.length} avisos`);
  const agregado = plano.find((a) => a.titulo.includes('frentes com pendência'));
  conferir('excedente vira 1 aviso agregado', !!agregado, agregado?.titulo);
  conferir('badge conta documentos, não avisos', plano[0].badge === 40, `badge=${plano[0].badge}`);
}

console.log('\n3. Pior caso possível: 60 frentes, cada uma com 3 documentos vencidos');
{
  const entradas = Array.from({ length: 60 }, (_, i) => [
    doc(`a${i}`, `Arma ${i}`, 'CRAF', somarDias(HOJE, -1)),
    doc(`a${i}`, `Arma ${i}`, 'Guia de Tráfego', somarDias(HOJE, 2)),
    doc(`a${i}`, `Arma ${i}`, 'Autorização', somarDias(HOJE, 20)),
  ]).flat();
  const plano = planejar(entradas, OPCOES);
  const porDia = new Map<string, number>();
  for (const a of plano) {
    const k = a.quando.toDateString();
    porDia.set(k, (porDia.get(k) ?? 0) + 1);
  }
  const maxDia = Math.max(...porDia.values());
  conferir('teto de 10 por dia respeitado', maxDia <= TETO_DIARIO, `máximo observado: ${maxDia}`);
  conferir('nunca passa de 64 pendentes do iOS', plano.length <= 64, `${plano.length} avisos`);
  conferir('fica sob o orçamento de segurança', plano.length <= ORCAMENTO_PENDENTES, `${plano.length} de ${ORCAMENTO_PENDENTES}`);
  conferir('cobre os 3 dias detalhados + resumos', porDia.size >= DIAS_DETALHADOS, `${porDia.size} dias cobertos`);
  conferir('vencidos marcados como urgentes', plano[0].urgente === true);
}

console.log('\n4. Nada vencendo nos próximos 30 dias');
{
  const entradas = [doc('a1', 'Glock G25', 'CRAF', somarDias(HOJE, 200))];
  const plano = planejar(entradas, OPCOES);
  conferir('não agenda nada', plano.length === 0);
}

console.log('\n5. Fronteira dos 30 dias');
{
  const entradas = [doc('a1', 'Glock G25', 'CRAF', somarDias(HOJE, 30))];
  const plano = planejar(entradas, OPCOES);
  conferir('30 dias entra na janela', plano.length > 0, `${plano.length} avisos`);
  conferir('primeiro aviso é hoje', plano[0].quando.getDate() === 20);

  const foraDaJanela = planejar([doc('a1', 'G', 'CRAF', somarDias(HOJE, 31))], OPCOES);
  conferir('31 dias ainda não alerta hoje', agruparNoDia(HOJE, [doc('a1', 'G', 'CRAF', somarDias(HOJE, 31))]).length === 0);
  conferir('...mas já agenda para amanhã', foraDaJanela.length > 0, `${foraDaJanela.length} avisos`);
}

console.log('\n6. Horário do dia já passou');
{
  const entradas = [doc('a1', 'Glock G25', 'CRAF', somarDias(HOJE, 10))];
  const tarde = planejar(entradas, { hoje: HOJE, hora: 9, agora: new Date(2026, 8, 20, 14, 0, 0) });
  const noveDeHoje = new Date(2026, 8, 20, 9, 0, 0).getTime();
  conferir('não agenda para as 9h de hoje se já são 14h', tarde.every((a) => a.quando.getTime() !== noveDeHoje));
  conferir('mas segue agendando os próximos dias', tarde.length > 0, `${tarde.length} avisos`);
}

console.log('\n7. Agrupamento: 1 arma com 6 documentos vira 1 aviso');
{
  const entradas = Array.from({ length: 6 }, (_, i) =>
    doc('a1', 'Glock G25', `Documento ${i}`, somarDias(HOJE, i + 1))
  );
  const grupos = agruparNoDia(HOJE, entradas);
  conferir('tudo num grupo só', grupos.length === 1);
  const avisos = avisosDoDia(grupos, true);
  conferir('gera 1 notificação, não 6', avisos.length === 1);
  conferir('corpo lista 4 e resume o resto', avisos[0].corpo.includes('+ 2 outro(s)'), JSON.stringify(avisos[0].corpo));
}

console.log('\n8. Habitualidade entra sem mexer no orçamento do iOS');
{
  // O mesmo pior caso do cenário 3, agora COM a frente de habitualidade. É a
  // verificação que importa: ela precisa concorrer no teto do dia, não somar.
  const entradas = Array.from({ length: 60 }, (_, i) => [
    doc(`a${i}`, `Arma ${i}`, 'CRAF', somarDias(HOJE, -1)),
    doc(`a${i}`, `Arma ${i}`, 'Guia de Tráfego', somarDias(HOJE, 2)),
    doc(`a${i}`, `Arma ${i}`, 'Autorização', somarDias(HOJE, 20)),
  ]).flat();

  const sem = planejar(entradas, OPCOES);
  const com = planejar(entradas, { ...OPCOES, extra: HABITUALIDADE });

  const maxDia = Math.max(...porDiaDe(com).values());
  conferir('teto de 10 por dia respeitado', maxDia <= TETO_DIARIO, `máximo observado: ${maxDia}`);
  conferir('não passa de 64 pendentes do iOS', com.length <= 64, `${com.length} avisos`);
  conferir('fica sob o orçamento de segurança', com.length <= ORCAMENTO_PENDENTES, `${com.length} de ${ORCAMENTO_PENDENTES}`);
  conferir('não custa NENHUM aviso a mais', com.length === sem.length, `${sem.length} -> ${com.length}`);
  conferir(
    'a habitualidade aparece nos dias detalhados',
    com.some((a) => a.titulo.includes('Habitualidade'))
  );
  conferir('o badge soma os grupos pendentes', com[0].badge === sem[0].badge + HABITUALIDADE.itens);
}

console.log('\n9. Nos dias de resumo, vira LINHA e não um segundo aviso');
{
  const entradas = [doc('a1', 'Glock G25', 'CRAF', somarDias(HOJE, 20))];
  const plano = planejar(entradas, { ...OPCOES, extra: HABITUALIDADE });
  // Ordem de inserção do Map = ordem cronológica, porque o plano é montado dia
  // a dia. Nos dias detalhados a habitualidade TEM aviso próprio (é o desenho);
  // é do dia 3 em diante que ela precisa virar linha do resumo.
  const contagens = [...porDiaDe(plano).values()];
  const detalhados = contagens.slice(0, DIAS_DETALHADOS);
  const resumidos = contagens.slice(DIAS_DETALHADOS);
  conferir('dias detalhados: no máximo 2 (documento + habitualidade)', detalhados.every((n) => n <= 2), detalhados.join(','));
  conferir('dias de resumo: exatamente 1 aviso', resumidos.every((n) => n === 1), `máx ${Math.max(...resumidos)}`);

  // O dia 20 é resumo (>= DIAS_DETALHADOS): a habitualidade tem de estar no corpo.
  const resumo = plano[plano.length - 1];
  conferir('o resumo menciona a habitualidade', resumo.corpo.includes('abaixo de 8'), resumo.corpo);

  const detalhado = plano[0];
  conferir('no dia detalhado ela tem aviso próprio', detalhado.titulo.includes('Habitualidade'));
}

console.log('\n10. Habitualidade sozinha, sem documento em alerta');
{
  const plano = planejar([], { ...OPCOES, extra: HABITUALIDADE });
  conferir('mesmo assim agenda', plano.length > 0, `${plano.length} avisos`);
  conferir('um por dia, nada mais', [...porDiaDe(plano).values()].every((n) => n === 1));
  conferir('cabe no orçamento', plano.length <= ORCAMENTO_PENDENTES, `${plano.length} avisos`);
  conferir('todos falam de habitualidade', plano.every((a) => a.titulo.includes('Habitualidade')));
  conferir('sem documento, sem urgência forçada', plano.every((a) => a.urgente === false));
}

console.log('\n11. Sem nada pendente, nem habitualidade, não agenda');
{
  conferir('plano vazio', planejar([], OPCOES).length === 0);
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam\n` : '\nTodas as verificações passaram\n');
process.exit(falhas ? 1 : 0);
