import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Cartao, Secao, Tela, Vazio } from '@/ui/base';
import { ErroConta } from '@/conta/api';
import { formatarData, linkPublicoCompeticao, obterCompeticao } from '@/competicoes/api';
import type { CategoriaRanking, CompeticaoDetalhe, LinhaRanking } from '@/competicoes/tipos';

export default function DetalheCompeticao() {
  const c = useCores();
  const p = useEstilos(folha);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [comp, setComp] = useState<CompeticaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [verBanner, setVerBanner] = useState(false);

  async function compartilhar() {
    if (!comp) return;
    const url = linkPublicoCompeticao(comp.id);
    try {
      await Share.share({
        title: comp.nome,
        message: `${comp.nome} — ranking da competição\n${url}`,
        url,
      });
    } catch {
      /* usuário cancelou */
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await obterCompeticao(String(id));
        if (vivo) setComp(d);
      } catch (e) {
        if (vivo) {
          setErro(
            e instanceof ErroConta && e.offline
              ? 'Sem conexão para abrir a competição.'
              : 'Competição indisponível.'
          );
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Competição">
        <View style={p.centro}>
          <ActivityIndicator color={c.primario} />
        </View>
      </Tela>
    );
  }

  if (erro || !comp) {
    return (
      <Tela voltar tituloCabecalho="Competição">
        <Vazio icone="trophy-outline" titulo="Indisponível" descricao={erro ?? 'Competição não encontrada.'} />
      </Tela>
    );
  }

  return (
    <Tela
      voltar
      tituloCabecalho="Competição"
      aoAtualizar={async () => {
        try {
          setComp(await obterCompeticao(String(id)));
        } catch {
          /* mantém o que já está na tela */
        }
      }}
      acao={
        <Pressable
          onPress={compartilhar}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar competição"
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={20} color={c.primario} />
        </Pressable>
      }
    >
      {comp.bannerUrl ? (
        <Pressable
          onPress={() => setVerBanner(true)}
          accessibilityRole="imagebutton"
          accessibilityLabel="Ver banner"
        >
          <Image source={{ uri: comp.bannerUrl }} style={p.banner} resizeMode="cover" />
        </Pressable>
      ) : null}

      {/* Visualizador do banner em tela cheia. */}
      <Modal visible={verBanner} transparent animationType="fade" onRequestClose={() => setVerBanner(false)}>
        <Pressable style={p.modalFundo} onPress={() => setVerBanner(false)}>
          <Image source={{ uri: comp.bannerUrl ?? undefined }} style={p.modalImagem} resizeMode="contain" />
          <View style={p.modalFechar}>
            <Ionicons name="close" size={26} color="#fff" />
          </View>
        </Pressable>
      </Modal>

      <Text style={p.selo}>★ {comp.entidadeNome}</Text>
      <Text style={p.titulo}>{comp.nome}</Text>
      <View style={p.periodoLinha}>
        <Ionicons name="calendar-outline" size={14} color={c.textoFraco} />
        <Text style={p.periodo}>
          {formatarData(comp.dataInicio)} – {formatarData(comp.dataFim)}
        </Text>
      </View>

      {comp.descricao ? <Text style={p.descricao}>{comp.descricao}</Text> : null}

      {comp.regras ? <Dobravel titulo="Regulamento" texto={comp.regras} /> : null}

      {comp.categorias.length === 0 ? (
        <Vazio
          icone="list-outline"
          titulo="Sem categorias"
          descricao="Esta competição ainda não tem categorias publicadas."
        />
      ) : (
        comp.categorias.map((cat) => <CartaoCategoria key={cat.id} categoria={cat} />)
      )}
    </Tela>
  );
}

function Dobravel({ titulo, texto }: { titulo: string; texto: string }) {
  const c = useCores();
  const p = useEstilos(folha);
  const [aberto, setAberto] = useState(false);
  return (
    <Cartao estilo={{ marginTop: espaco.lg }} plano>
      <Pressable
        onPress={() => setAberto((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        style={p.dobravelTopo}
      >
        <Ionicons name="document-text-outline" size={16} color={c.primario} />
        <Text style={p.dobravelTitulo}>{titulo}</Text>
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={16} color={c.textoFraco} />
      </Pressable>
      {aberto ? <Text style={p.dobravelTexto}>{texto}</Text> : null}
    </Cartao>
  );
}

function CartaoCategoria({ categoria }: { categoria: CategoriaRanking }) {
  const c = useCores();
  const p = useEstilos(folha);
  const sentido = categoria.ordenamento === 'MENOR' ? 'menor pontuação vence' : 'maior pontuação vence';

  return (
    <Secao titulo={categoria.nome}>
      <Cartao>
        <Text style={p.catInfo}>
          {categoria.totalParticipantes} participante{categoria.totalParticipantes === 1 ? '' : 's'} ·{' '}
          {sentido}
        </Text>

        {categoria.top.length === 0 ? (
          <Text style={p.vazioCat}>Nenhum resultado lançado ainda.</Text>
        ) : (
          <View style={p.ranking}>
            {categoria.top.map((l) => (
              <LinhaRank key={`${l.posicao}-${l.nome}`} linha={l} />
            ))}
          </View>
        )}

        {/* Posição do usuário quando ele está fora do Top 10 exibido. */}
        {categoria.minhaPosicao && !categoria.minhaPosicao.noTop ? (
          <>
            <Text style={p.separador}>· · ·</Text>
            <LinhaRank
              linha={{
                posicao: categoria.minhaPosicao.posicao,
                nome: 'Você',
                pontuacao: categoria.minhaPosicao.pontuacao,
                ehVoce: true,
              }}
            />
          </>
        ) : null}

        {/* Não participou desta categoria. */}
        {categoria.minhaPosicao === null && categoria.totalParticipantes > 0 ? (
          <View style={p.semVoce}>
            <Ionicons name="information-circle-outline" size={14} color={c.textoFraco} />
            <Text style={p.semVoceTexto}>Você ainda não tem resultado nesta categoria.</Text>
          </View>
        ) : null}
      </Cartao>
    </Secao>
  );
}

function LinhaRank({ linha }: { linha: LinhaRanking }) {
  const c = useCores();
  const p = useEstilos(folha);
  const medalha =
    linha.posicao === 1
      ? c.latao
      : linha.posicao === 2
        ? c.textoMedio
        : linha.posicao === 3
          ? '#B07A4F'
          : null;

  return (
    <View
      style={[p.linha, linha.ehVoce ? p.linhaVoce : null]}
      accessibilityLabel={`${linha.posicao}º lugar, ${linha.nome}, ${linha.pontuacao} pontos${linha.ehVoce ? ', você' : ''}`}
    >
      <View style={[p.posicao, medalha ? { borderColor: medalha, backgroundColor: `${medalha}22` } : null]}>
        <Text style={[p.posicaoTexto, medalha ? { color: medalha } : null]}>{linha.posicao}</Text>
      </View>
      <Text style={[p.nome, linha.ehVoce ? p.nomeVoce : null]} numberOfLines={1}>
        {linha.nome}
        {linha.ehVoce ? '  •  você' : ''}
      </Text>
      <Text style={p.pontuacao}>{linha.pontuacao}</Text>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    banner: {
      width: '100%',
      height: 170,
      borderRadius: raio.md,
      backgroundColor: c.superficieAlta,
      marginBottom: espaco.lg,
    },
    modalFundo: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalImagem: { width: '100%', height: '80%' },
    modalFechar: { position: 'absolute', top: 52, right: 20 },
    selo: { ...tipo.etiqueta, fontSize: 10, color: c.latao, marginBottom: 6 },
    titulo: { ...tipo.telaTitulo, fontSize: 24, color: c.texto },
    periodoLinha: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
    periodo: { ...tipo.legenda, color: c.textoFraco },
    descricao: { ...tipo.corpo, color: c.textoMedio, marginTop: espaco.lg },

    dobravelTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    dobravelTitulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto, flex: 1 },
    dobravelTexto: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      marginTop: espaco.md,
    },

    catInfo: { ...tipo.legenda, color: c.textoFraco, marginBottom: espaco.md },
    vazioCat: { ...tipo.corpoPequeno, color: c.textoFraco, paddingVertical: espaco.sm },
    ranking: { gap: 2 },

    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: 9,
      paddingHorizontal: espaco.sm,
      borderRadius: raio.sm,
    },
    linhaVoce: {
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
    },
    posicao: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.superficieAlta,
    },
    posicaoTexto: { ...tipo.etiqueta, fontSize: 12, color: c.textoMedio, letterSpacing: 0 },
    nome: { ...tipo.corpo, color: c.texto, flex: 1, fontWeight: '500' },
    nomeVoce: { fontWeight: '700' },
    pontuacao: { ...tipo.numero, fontSize: 17, color: c.texto },

    separador: { textAlign: 'center', color: c.textoFraco, marginVertical: 4, letterSpacing: 2 },
    semVoce: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: espaco.md,
      paddingTop: espaco.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
    semVoceTexto: { ...tipo.legenda, color: c.textoFraco, flex: 1 },
  });
