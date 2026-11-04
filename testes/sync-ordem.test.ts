import { ordenarParaAplicar, ORDEM_APLICACAO } from '@/db/ordemSync';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`${condicao ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

// Índice do primeiro registro de um tipo na lista ordenada.
function pos(lista: { tipo: string }[], tipo: string): number {
  return lista.findIndex((r) => r.tipo === tipo);
}

console.log('\nSync — ordem de aplicação do pull (pai antes de filho)\n');

// Cenário REAL que travava o pull: o pull chega por carimbo do servidor, e na
// conta de produção os `documentos`/`arquivos` tinham carimbo de outubro
// (antigos) enquanto as `armas` foram repostadas em novembro — ou seja, os
// filhos vinham ANTES dos pais. Com FK ON, inserir o filho primeiro estoura.
const pullCru = [
  { tipo: 'arquivos', registroId: 'arq-antigo' },
  { tipo: 'documentos', registroId: 'doc-antigo' },
  { tipo: 'locais_tiro', registroId: 'loc-1' },
  { tipo: 'armas', registroId: 'arma-nova' },
  { tipo: 'fotos', registroId: 'foto-1' },
  { tipo: 'habitualidades', registroId: 'hab-1' },
  { tipo: 'favoritos', registroId: 'fav-1' },
  { tipo: 'ambitos_competicao', registroId: 'amb-1' },
];

const ordenado = ordenarParaAplicar(pullCru);

conferir('armas vêm antes de documentos', pos(ordenado, 'armas') < pos(ordenado, 'documentos'));
conferir('documentos vêm antes de arquivos', pos(ordenado, 'documentos') < pos(ordenado, 'arquivos'));
conferir('armas vêm antes de fotos', pos(ordenado, 'armas') < pos(ordenado, 'fotos'));
conferir('armas vêm antes de habitualidades', pos(ordenado, 'armas') < pos(ordenado, 'habitualidades'));
conferir('locais_tiro vêm antes de habitualidades', pos(ordenado, 'locais_tiro') < pos(ordenado, 'habitualidades'));
conferir(
  'ordem final é exatamente pai→filho',
  JSON.stringify(ordenado.map((r) => r.tipo)) ===
    JSON.stringify(['locais_tiro', 'armas', 'documentos', 'arquivos', 'fotos', 'favoritos', 'ambitos_competicao', 'habitualidades']),
  ordenado.map((r) => r.tipo).join(',')
);

// Tipo desconhecido (versão futura do app) vai para o fim, sem quebrar a ordem.
const comDesconhecido = ordenarParaAplicar([
  { tipo: 'tipo_futuro', registroId: 'x' },
  { tipo: 'armas', registroId: 'a' },
]);
conferir('tipo desconhecido fica por último', comDesconhecido[comDesconhecido.length - 1].tipo === 'tipo_futuro');

// Não perde nem duplica registros ao ordenar.
conferir('preserva todos os registros', ordenado.length === pullCru.length);

// Sanidade do mapa: todas as tabelas com FK estão mapeadas em ordem crescente.
conferir(
  'mapa respeita a cadeia de FK',
  ORDEM_APLICACAO.armas < ORDEM_APLICACAO.documentos &&
    ORDEM_APLICACAO.documentos < ORDEM_APLICACAO.arquivos &&
    ORDEM_APLICACAO.armas < ORDEM_APLICACAO.fotos
);

console.log(falhas === 0 ? '\nTodas as verificações passaram\n' : `\n${falhas} verificação(ões) falharam\n`);
process.exit(falhas === 0 ? 0 : 1);
