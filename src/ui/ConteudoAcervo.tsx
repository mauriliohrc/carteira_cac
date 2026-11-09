import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Vazio } from '@/ui/base';
import { CartaoArma } from '@/ui/cartoes';
import { ACERVOS } from '@/domain/catalogos';
import { nomeArma } from '@/domain/rotulos';
import { LIMITE_GRATUITO_ARMAS } from '@/billing';
import type { Arma } from '@/domain/tipos';

/** 'TODOS' | valor de acervo | tipo de arma (T_*). */
type Filtro = string;

const TIPOS_ARMA = [
  { valor: 'T_PISTOLA', rotulo: 'Pistola' },
  { valor: 'T_REVOLVER', rotulo: 'Revólver' },
  { valor: 'T_LONGA', rotulo: 'Longa' },
] as const;

/**
 * Acervo de vitrine. Quando o usuário termina o onboarding sem cadastrar nada
 * (nenhum CRAF, nada importado da Shooting House), o acervo não fica vazio: mostramos
 * estes três equipamentos sob borrão. É uma amostra do que o app vira cheio —
 * tocar leva ao paywall. Nada aqui é persistido; são só objetos de exibição.
 */
const ARMAS_VITRINE: Arma[] = [
  {
    id: 'vitrine-1', apelido: null, marca: 'Glock', modelo: 'G19 Gen5',
    numeroSerie: 'BXK204', acervo: 'DEFESA_PESSOAL', grupo: 'CC_RESTRITA',
    calibre: '9mm', especie: 'Pistola', funcionamento: null, fabricante: 'Glock',
    paisOrigem: 'Áustria', anoFabricacao: '2023', numeroCano: null, capacidade: '15',
    registroNumero: null, localGuarda: null, observacoes: null, criadoEm: '', atualizadoEm: '',
  },
  {
    id: 'vitrine-2', apelido: null, marca: 'Taurus', modelo: 'TH40',
    numeroSerie: 'TA9F118', acervo: 'ATIRADOR', grupo: 'CC_RESTRITA',
    calibre: '.40 S&W', especie: 'Pistola', funcionamento: null, fabricante: 'Taurus',
    paisOrigem: 'Brasil', anoFabricacao: '2022', numeroCano: null, capacidade: '15',
    registroNumero: null, localGuarda: null, observacoes: null, criadoEm: '', atualizadoEm: '',
  },
  {
    id: 'vitrine-3', apelido: null, marca: 'CBC', modelo: '8122 Bolt Action',
    numeroSerie: 'CB7720', acervo: 'ATIRADOR', grupo: 'CLL_PERMITIDA',
    calibre: '.22 LR', especie: 'Carabina', funcionamento: null, fabricante: 'CBC',
    paisOrigem: 'Brasil', anoFabricacao: '2021', numeroCano: null, capacidade: '10',
    registroNumero: null, localGuarda: null, observacoes: null, criadoEm: '', atualizadoEm: '',
  },
];

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
export function ConteudoAcervo({
  aoAdicionar,
  aoSelecionar,
  selecionadoId,
  compacto,
}: {
  aoAdicionar: () => void;
  /** Painel master-detail (tablet): seleciona em vez de navegar; realça o item. */
  aoSelecionar?: (id: string) => void;
  selecionadoId?: string;
  /** No painel, a lista vira linhas enxutas (não cards) — a cara de master-detail. */
  compacto?: boolean;
}) {
  const s = useEstilos(folha);
  const { armas, favoritos, alternarFavorito, documentosDaArma, fotosDaArma, premium } = useApp();
  const [filtro, setFiltro] = useState<Filtro>('TODOS');

  // Favoritas no topo, preservando a ordem original (criado_em ASC) dentro de
  // cada grupo — o sort do Hermes é estável.
  const ordenadas = useMemo(
    () =>
      [...armas].sort((a, b) => (favoritos.has(a.id) ? 0 : 1) - (favoritos.has(b.id) ? 0 : 1)),
    [armas, favoritos]
  );

  // Plano grátis libera só 1 arma (a primeira — já considerando as favoritas no
  // topo). As demais NÃO somem: ficam no acervo sob borrão, como isca para o
  // Premium. Filtros e contagens dos chips operam só sobre o conjunto liberado.
  const liberadas = premium ? ordenadas : ordenadas.slice(0, LIMITE_GRATUITO_ARMAS);
  const bloqueadasArr = premium ? [] : ordenadas.slice(LIMITE_GRATUITO_ARMAS);

  const contar = (f: Filtro) => liberadas.reduce((n, a) => (corresponde(a, f) ? n + 1 : n), 0);
  const visiveis = liberadas.filter((a) => corresponde(a, filtro));
  const bloqueadasVisiveis = bloqueadasArr.filter((a) => corresponde(a, filtro));

  const irParaPremium = () => router.push('/premium');

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
    // Premium sem nada cadastrado: estado vazio honesto. No plano grátis, em vez
    // do vazio, mostramos a vitrine borrada — o acervo "cheio" que o Premium abre.
    if (premium) {
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
      <View style={{ marginTop: espaco.lg }}>
        <View style={s.vitrineTopo}>
          <Text style={s.vitrineTitulo}>Seu acervo, pronto para abrir</Text>
          <Text style={s.vitrineSub}>
            Cadastre suas armas ou assine o Premium para ver tudo como abaixo.
          </Text>
        </View>
        <Botao titulo="Cadastrar arma" icone="add" aoTocar={aoAdicionar} estilo={{ marginBottom: espaco.lg }} />
        {ARMAS_VITRINE.map((arma) => (
          <CartaoArma
            key={arma.id}
            arma={arma}
            documentos={[]}
            bloqueado
            aoTocar={irParaPremium}
          />
        ))}
      </View>
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

      <View style={{ marginTop: compacto ? espaco.md : espaco.lg }}>
        {visiveis.map((arma) =>
          compacto ? (
            <LinhaArma
              key={arma.id}
              arma={arma}
              docs={documentosDaArma(arma.id).length}
              capa={fotosDaArma(arma.id)[0]?.uri}
              selecionado={arma.id === selecionadoId}
              aoTocar={() => aoSelecionar?.(arma.id)}
            />
          ) : (
            <CartaoArma
              key={arma.id}
              arma={arma}
              documentos={documentosDaArma(arma.id)}
              capa={fotosDaArma(arma.id)[0]?.uri}
              favorito={favoritos.has(arma.id)}
              aoFavoritar={() => alternarFavorito(arma.id)}
              selecionado={!!selecionadoId && arma.id === selecionadoId}
              aoTocar={() =>
                aoSelecionar
                  ? aoSelecionar(arma.id)
                  : router.push({ pathname: '/arma/[id]', params: { id: arma.id } })
              }
            />
          )
        )}

        {bloqueadasVisiveis.length > 0 ? (
          <>
            <Text style={s.bloqueioAviso}>
              O plano grátis mostra {LIMITE_GRATUITO_ARMAS}. As demais ficam aqui, bloqueadas —
              assine o Premium para ver todo o acervo.
            </Text>
            {bloqueadasVisiveis.map((arma) =>
              compacto ? (
                <LinhaArma key={arma.id} arma={arma} docs={0} bloqueado aoTocar={irParaPremium} />
              ) : (
                <CartaoArma
                  key={arma.id}
                  arma={arma}
                  documentos={documentosDaArma(arma.id)}
                  capa={fotosDaArma(arma.id)[0]?.uri}
                  bloqueado
                  aoTocar={irParaPremium}
                />
              )
            )}
          </>
        ) : null}
      </View>
    </>
  );
}

/** Linha enxuta da arma para o painel master-detail (sem card). */
function LinhaArma({
  arma,
  docs,
  capa,
  selecionado,
  bloqueado,
  aoTocar,
}: {
  arma: Arma;
  docs: number;
  capa?: string | null;
  selecionado?: boolean;
  bloqueado?: boolean;
  aoTocar: () => void;
}) {
  const c = useCores();
  const s = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [s.linha, selecionado ? s.linhaSel : null, pressed && { opacity: 0.7 }]}
    >
      {capa && !bloqueado ? (
        <Image source={{ uri: capa }} style={s.linhaCapa} />
      ) : (
        <View style={s.linhaIcone}>
          <Ionicons
            name={bloqueado ? 'lock-closed' : 'ellipse-outline'}
            size={16}
            color={bloqueado ? c.latao : c.textoFraco}
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.linhaNome} numberOfLines={1}>
          {bloqueado ? 'Desbloquear no Premium' : nomeArma(arma)}
        </Text>
        <Text style={s.linhaSub} numberOfLines={1}>
          {[arma.especie, arma.calibre].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {bloqueado ? null : (
        <Text style={s.linhaDocs}>
          {docs} doc{docs === 1 ? '' : 's'}
        </Text>
      )}
      <Ionicons name="chevron-forward" size={15} color={selecionado ? c.primario : c.textoFraco} />
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    // Linha compacta do painel master-detail.
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.md,
      paddingHorizontal: espaco.sm,
      borderRadius: raio.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    linhaSel: { backgroundColor: c.primarioFraco, borderBottomColor: 'transparent' },
    linhaCapa: {
      width: 34,
      height: 34,
      borderRadius: raio.sm,
      backgroundColor: c.superficieAlta,
    },
    linhaIcone: {
      width: 34,
      height: 34,
      borderRadius: raio.sm,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linhaNome: { ...tipo.subtitulo, fontSize: 14.5, color: c.texto },
    linhaSub: { ...tipo.legenda, fontSize: 11.5, color: c.textoFraco, marginTop: 1 },
    linhaDocs: { ...tipo.legenda, fontSize: 11, color: c.textoFraco },

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

    vitrineTopo: { marginBottom: espaco.lg },
    vitrineTitulo: { ...tipo.titulo, fontSize: 18, color: c.texto },
    vitrineSub: { ...tipo.legenda, color: c.textoMedio, marginTop: 4, lineHeight: 18 },

    bloqueioAviso: {
      ...tipo.legenda,
      color: c.textoMedio,
      lineHeight: 18,
      marginTop: espaco.sm,
      marginBottom: espaco.md,
    },
  });
