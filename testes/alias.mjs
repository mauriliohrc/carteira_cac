/**
 * Resolve os imports "@/..." para node, permitindo rodar os testes do núcleo
 * puro sem bundler. Node 24 já remove os tipos sozinho (type stripping).
 */
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

registerHooks({
  resolve(spec, contexto, proximo) {
    if (spec.startsWith('@/')) {
      const base = join(RAIZ, spec.slice(2));
      for (const cand of [base, `${base}.ts`, join(base, 'index.ts')]) {
        if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
      }
    }
    return proximo(spec, contexto);
  },
});
