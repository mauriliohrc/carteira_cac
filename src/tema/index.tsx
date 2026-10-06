import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import { PALETA_CLARA, PALETA_ESCURA, type Paleta } from './paleta';

export { espaco, raio, MONO, type Paleta } from './paleta';

export type PreferenciaTema = 'automatico' | 'claro' | 'escuro';

export const PREFERENCIAS: { valor: PreferenciaTema; rotulo: string; icone: string }[] = [
  { valor: 'automatico', rotulo: 'Automático', icone: 'phone-portrait-outline' },
  { valor: 'claro', rotulo: 'Claro', icone: 'sunny-outline' },
  { valor: 'escuro', rotulo: 'Escuro', icone: 'moon-outline' },
];

interface Contexto {
  paleta: Paleta;
  /** O que está valendo na tela agora. */
  esquema: 'claro' | 'escuro';
  /** O que o usuário escolheu — 'automatico' segue o sistema. */
  preferencia: PreferenciaTema;
  definirPreferencia: (p: PreferenciaTema) => Promise<void>;
}

const TemaContexto = createContext<Contexto | null>(null);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const doSistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('automatico');

  useEffect(() => {
    void (async () => {
      const salva = await lerConfig(CHAVES.tema);
      if (salva === 'claro' || salva === 'escuro' || salva === 'automatico') {
        setPreferencia(salva);
      }
    })();
  }, []);

  const definirPreferencia = useCallback(async (p: PreferenciaTema) => {
    setPreferencia(p);
    await gravarConfig(CHAVES.tema, p);
  }, []);

  // As superfícies de vidro (GlassView) são nativas e, por padrão, seguem a
  // aparência do SISTEMA — não o tema que o usuário escolheu no app. Sem isto,
  // fixar "claro" com o aparelho no escuro deixa a barra e o cabeçalho pretos.
  // Forçar o overrideUserInterfaceStyle alinha o nativo ao tema do app.
  useEffect(() => {
    Appearance.setColorScheme(
      preferencia === 'claro' ? 'light' : preferencia === 'escuro' ? 'dark' : 'unspecified'
    );
  }, [preferencia]);

  const valor = useMemo<Contexto>(() => {
    const esquema: 'claro' | 'escuro' =
      preferencia === 'automatico' ? (doSistema === 'light' ? 'claro' : 'escuro') : preferencia;
    return {
      esquema,
      paleta: esquema === 'claro' ? PALETA_CLARA : PALETA_ESCURA,
      preferencia,
      definirPreferencia,
    };
  }, [definirPreferencia, doSistema, preferencia]);

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema(): Contexto {
  const ctx = useContext(TemaContexto);
  if (!ctx) throw new Error('useTema precisa estar dentro de <TemaProvider>');
  return ctx;
}

export function useCores(): Paleta {
  return useTema().paleta;
}

/**
 * Folhas de estilo dependentes da paleta.
 *
 * `StyleSheet.create` no topo do arquivo congelaria as cores do tema em que o
 * módulo foi carregado. Aqui a folha é uma função da paleta, criada uma única
 * vez por (fábrica, paleta) e reaproveitada daí em diante — o custo de trocar
 * de tema é uma criação por folha, não uma por render.
 */
const cache = new WeakMap<object, Map<Paleta, unknown>>();

export function useEstilos<T>(fabrica: (c: Paleta) => T): T {
  const paleta = useCores();
  return useMemo(() => {
    let porPaleta = cache.get(fabrica);
    if (!porPaleta) {
      porPaleta = new Map();
      cache.set(fabrica, porPaleta);
    }
    const existente = porPaleta.get(paleta);
    if (existente) return existente as T;
    const criada = fabrica(paleta);
    porPaleta.set(paleta, criada);
    return criada;
  }, [fabrica, paleta]);
}

// ---------------------------------------------------------------- tipografia

/**
 * Escala tipográfica do app. O ar militar vem daqui: rótulos curtos em caixa
 * alta com entreletra larga, como carimbo de formulário, contra um corpo de
 * texto sóbrio.
 */
export const tipo = {
  marca: { fontSize: 16, fontWeight: '800' as const, letterSpacing: 3.5 },
  telaTitulo: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  titulo: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2 },
  subtitulo: { fontSize: 15, fontWeight: '600' as const },
  corpo: { fontSize: 14, lineHeight: 20 },
  corpoPequeno: { fontSize: 12.5, lineHeight: 18 },
  /** Carimbo: cabeçalho de seção. */
  carimbo: { fontSize: 10.5, fontWeight: '700' as const, letterSpacing: 1.8 },
  /** Etiqueta pequena, também em caixa alta. */
  etiqueta: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.9 },
  legenda: { fontSize: 11.5, lineHeight: 16 },
  numero: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.6 },
} as const;
