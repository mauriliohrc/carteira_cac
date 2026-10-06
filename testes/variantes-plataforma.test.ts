/**
 * Garante que cada variante `.web` exporte tudo o que a versão nativa exporta.
 *
 * Existe por causa de um bug real: `caixa.web.ts` foi truncado numa edição e
 * ficou sem nenhuma função. O `tsc` não viu nada — ele resolve `caixa.ts`,
 * nunca o `.web` — e o app quebrou só no navegador, com
 * "observarRecebidos is not a function". Nenhum typecheck pega isso; só uma
 * comparação dos dois arquivos pega.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('../src', import.meta.url).pathname;

function listarArquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? listarArquivos(caminho) : [caminho];
  });
}

/** Nomes exportados em tempo de execução — tipos e interfaces não contam. */
function exportsDeValor(codigo: string): Set<string> {
  const nomes = new Set<string>();

  for (const m of codigo.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm
  )) {
    nomes.add(m[1]);
  }

  // Reexports e listas: export { a, b as c } [from '...']
  for (const m of codigo.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const parte of m[1].split(',')) {
      const limpo = parte.trim();
      if (!limpo || limpo.startsWith('type ')) continue;
      const apelido = limpo.split(/\s+as\s+/).pop()!.trim();
      if (apelido) nomes.add(apelido);
    }
  }

  return nomes;
}

let falhas = 0;
const conferir = (nome: string, ok: boolean, detalhe = '') => {
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas += 1;
};

const variantesWeb = listarArquivos(RAIZ).filter((f) => /\.web\.tsx?$/.test(f));

console.log(`\nVariantes .web encontradas: ${variantesWeb.length}\n`);
conferir('existe ao menos uma variante para comparar', variantesWeb.length > 0);

for (const web of variantesWeb) {
  const nativo = web.replace(/\.web\.(tsx?)$/, '.$1');
  const relativo = web.slice(RAIZ.length + 1);

  let codigoNativo: string;
  try {
    codigoNativo = readFileSync(nativo, 'utf8');
  } catch {
    conferir(relativo, false, 'não achei o arquivo nativo correspondente');
    continue;
  }

  const esperados = exportsDeValor(codigoNativo);
  const presentes = exportsDeValor(readFileSync(web, 'utf8'));
  const faltando = [...esperados].filter((n) => !presentes.has(n));

  conferir(
    relativo,
    faltando.length === 0,
    faltando.length
      ? `faltam ${faltando.length}: ${faltando.join(', ')}`
      : `${presentes.size} export(s) em dia`
  );
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam\n` : '\nTodas as verificações passaram\n');
process.exit(falhas ? 1 : 0);
