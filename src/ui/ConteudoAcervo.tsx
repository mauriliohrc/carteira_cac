import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Vazio } from '@/ui/base';
import { CartaoArma } from '@/ui/cartoes';
import { ACERVOS } from '@/domain/catalogos';
import { LIMITE_GRATUITO_ARMAS } from '@/billing';
import type { Arma } from '@/domain/tipos';

/** 'TODOS' | valor de acervo | tipo de arma (T_*). */
type Filtro = string;

const TIPOS_ARMA = [
  { valor: 'T_PISTOLA', rotulo: 'Pistola' },
  { valor: 'T_REVOLVER', rotulo: 'Revólver' },
  { valor: 'T_LONGA', rotulo: 'Longa' },
] as const;

/** Uma arma corresponde ao filtro selecionado? */
function corresponde(a: Arma, filtro: Filtro): boolean {
  if (filtro === 'TODOS') return true;
  if (filtro === 'T_PISTOLA') return /pistol/i.test(a.especie ?? '');
  if (filtro === 'T_REVOLVER') return /rev[oó]lver|revolver/i.test(a.especie ?? '');
  if (filtro === 'T_LONGA') return a.grupo.startsWith('CLR') || a.grupo.startsWith('CLL');
  return a.acervo === filtro; // valor de acervo
}

/**
 * A lista de armas. Vive fora de `app/` porque a aba passou a hospedar dois
 * conteúdos — acervo e habitualidade — e cada arquivo dentro de `app/` seria
 * uma rota nova.
 */
export function ConteudoAcervo({ aoAdicionar }: { aoAdicionar: () => void }) {
  const c = useCores();
  const s = useEstilos(folha);
  const { armas, documentosDaArma, fotosDaArma, premium } = useApp();
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  // Plano grátis libera só 1 arma (a primeira). Filtros e contagens operam
  // apenas sobre o conjunto liberado — não dá para "passear" pelas bloqueadas.
  const liberadas = premium ? armas : armas.slice(0, LIMITE_GRATUITO_ARMAS);
  const bloqueadas = armas.length - liberadas.length;

  const contar = (f: Filtro) => liberadas.reduce((n, a) => (corresponde(a, f) ? n + 1 : n), 0);
  const visiveis = liberadas.filter((a) => corresponde(a, filtro));

  const chip = (valor: Filtro, rotulo: string) => {
    const n = contar(valor);
    if (valor !== 'TODOS' && n === 0) return null;
    const ativo = filtro === valor;
    return (
      <Pressable
        key={valor}
        onPress={() => setFiltro(valor)}
        style={[s.filtro, ativo ? s.filtroAtivo : null]}
      >
        <Text style={[s.filtroTexto, ativo ? s.filtroTextoAtivo : null]}>
          {rotulo} · {n}
        </Text>
      </Pressable>
    );
  };

  if (!armas.length) {
    return (
      <Vazio
        icone="albums-outline"
        titulo="Nenhuma arma cadastrada"
        descricao="Cadastre a arma com modelo, número de série, acervo, calibre e grupo. Depois anexe o CRAF e as guias de tráfego."
        acao={<Botao titulo="Cadastrar arma" icone="add" aoTocar={aoAdicionar} />}
      />
    );
  }

  return (
    <>
      <View style={s.filtros}>
        {chip('TODOS', 'Todos')}
        {ACERVOS.map((a) => chip(a.valor, a.curto))}
        {TIPOS_ARMA.some((t) => contar(t.valor) > 0) ? <View style={s.separador} /> : null}
        {TIPOS_ARMA.map((t) => chip(t.valor, t.rotulo))}
      </View>

      <View style={{ marginTop: espaco.lg }}>
        {visiveis.map((arma) => (
          <CartaoArma
            key={arma.id}
            arma={arma}
            documentos={documentosDaArma(arma.id)}
            capa={fotosDaArma(arma.id)[0]?.uri}
            aoTocar={() => router.push({ pathname: '/arma/[id]', params: { id: arma.id } })}
          />
        ))}

        {!premium && bloqueadas > 0 ? (
          <Pressable
            onPress={() => router.push('/premium')}
            style={({ pressed }) => [s.convite, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="lock-closed" size={19} color={c.latao} />
            <View style={{ flex: 1 }}>
              <Text style={s.conviteTitulo}>
                + {bloqueadas} arma{bloqueadas > 1 ? 's' : ''} no Premium
              </Text>
              <Text style={s.conviteSub}>
                O plano grátis mostra {LIMITE_GRATUITO_ARMAS}. Assine para ver todo o acervo.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={c.latao} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espaco.lg },
    filtro: {
      paddingHorizontal: espaco.md,
      paddingVertical: 7,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.superficie,
    },
    separador: { width: StyleSheet.hairlineWidth, backgroundColor: c.borda, alignSelf: 'stretch', marginHorizontal: 2 },
    filtroAtivo: { borderColor: c.primario, backgroundColor: c.primarioFraco },
    filtroTexto: { fontSize: 12.5, fontWeight: '600', color: c.textoMedio },
    filtroTextoAtivo: { color: c.primario },
    convite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      padding: espaco.lg,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
      backgroundColor: c.lataoFraco,
      marginTop: espaco.sm,
    },
    conviteTitulo: { ...tipo.subtitulo, fontSize: 14, color: c.latao },
    conviteSub: { ...tipo.legenda, color: c.textoMedio, marginTop: 4 },
  });
