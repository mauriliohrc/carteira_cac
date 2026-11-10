import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Etiqueta, Tela, Vazio } from '@/ui/base';
import { avisar, confirmar } from '@/ui/dialogo';
import { denunciar, formatarPreco, manifestarInteresse, obterAnuncio } from '@/mercado/api';
import { ErroConta } from '@/conta/api';
import { ROTULO_ESTADO_USO } from '@/mercado/tipos';
import type { Anuncio } from '@/mercado/tipos';

export default function DetalheAnuncio() {
  const c = useCores();
  const p = useEstilos(folha);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [a, setA] = useState<Anuncio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setErro(false);
    try {
      setA(await obterAnuncio(id));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Anúncio">
        <View style={p.centro}>
          <ActivityIndicator color={c.primario} />
        </View>
      </Tela>
    );
  }
  if (erro || !a) {
    return (
      <Tela voltar tituloCabecalho="Anúncio">
        <Vazio icone="alert-circle-outline" titulo="Anúncio indisponível" descricao="Ele pode ter sido removido ou vendido." />
      </Tela>
    );
  }

  const larguraFoto = Dimensions.get('window').width;
  const [abrindo, setAbrindo] = useState(false);

  const contato = async () => {
    if (a.loja?.whatsapp) {
      const num = a.loja.whatsapp.replace(/\D/g, '');
      void Linking.openURL(`https://wa.me/55${num}`);
      return;
    }
    // P2P: abre (ou retoma) a conversa anônima com o vendedor.
    setAbrindo(true);
    try {
      const conversaId = await manifestarInteresse(a.id);
      router.push({ pathname: '/mercado/conversa/[id]', params: { id: conversaId } });
    } catch (e) {
      await avisar('Não foi possível', e instanceof ErroConta ? e.message : 'Entre na sua conta e tente de novo.');
    } finally {
      setAbrindo(false);
    }
  };

  const reportar = async () => {
    const ok = await confirmar({ titulo: 'Denunciar anúncio?', mensagem: 'Nossa equipe vai analisar. Use para conteúdo proibido (arma, munição, golpe).', rotuloConfirmar: 'Denunciar', destrutivo: true });
    if (!ok) return;
    try {
      await denunciar({ anuncioId: a.id, motivo: 'Denúncia pelo anúncio' });
      await avisar('Denúncia enviada', 'Obrigado por ajudar a manter o mercado seguro.');
    } catch {
      await avisar('Ops', 'Não foi possível enviar a denúncia.');
    }
  };

  return (
    <Tela voltar tituloCabecalho="Anúncio">
      {a.fotos.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={p.galeria}>
          {a.fotos.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: larguraFoto, height: 280 }} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : (
        <View style={[p.semFoto, { width: larguraFoto }]}>
          <Ionicons name="image-outline" size={34} color={c.textoFraco} />
        </View>
      )}

      <View style={p.conteudo}>
        <Text style={p.preco}>{formatarPreco(a.precoCentavos)}</Text>
        <Text style={p.titulo}>{a.titulo}</Text>

        <View style={p.etiquetas}>
          <Etiqueta texto={ROTULO_ESTADO_USO[a.estadoUso]} />
          <Etiqueta texto={`${a.cidade}/${a.uf}`} icone="location-outline" />
          {a.destacado ? <Etiqueta texto="Destaque" cor={c.latao} icone="star" /> : null}
        </View>

        {a.loja ? (
          <View style={p.loja}>
            {a.loja.logoUrl ? (
              <Image source={{ uri: a.loja.logoUrl }} style={p.logo} />
            ) : (
              <View style={[p.logo, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="storefront-outline" size={18} color={c.primario} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={p.lojaNome}>
                {a.loja.nome} {a.loja.verificada ? <Ionicons name="checkmark-circle" size={13} color={c.primario} /> : null}
              </Text>
              <Text style={p.lojaMeta}>Loja parceira</Text>
            </View>
          </View>
        ) : a.vendedor ? (
          <Text style={p.vendedor}>Anunciante: {a.vendedor.primeiroNome}</Text>
        ) : null}

        <Text style={p.descricao}>{a.descricao}</Text>

        <View style={p.aviso}>
          <Ionicons name="shield-checkmark-outline" size={15} color={c.textoFraco} />
          <Text style={p.avisoTxt}>
            A negociação e a transferência são responsabilidade das partes e seguem a legislação.
            Nunca pague adiantado sem confiança.
          </Text>
        </View>

        <Botao
          titulo={a.loja?.whatsapp ? 'Falar com a loja' : 'Tenho interesse'}
          icone={a.loja?.whatsapp ? 'logo-whatsapp' : 'chatbubble-ellipses-outline'}
          carregando={abrindo}
          aoTocar={contato}
          estilo={{ marginTop: espaco.lg }}
        />
        {a.loja?.site ? (
          <Botao
            titulo="Ver site da loja"
            variante="secundario"
            icone="globe-outline"
            aoTocar={() => a.loja?.site && Linking.openURL(a.loja.site)}
            estilo={{ marginTop: espaco.sm }}
          />
        ) : null}

        <Pressable onPress={reportar} style={{ alignSelf: 'center', marginTop: espaco.lg, padding: espaco.sm }}>
          <Text style={{ color: c.textoFraco, fontSize: 12.5 }}>
            <Ionicons name="flag-outline" size={12} color={c.textoFraco} /> Denunciar anúncio
          </Text>
        </Pressable>
      </View>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    galeria: { maxHeight: 280 },
    semFoto: { height: 220, backgroundColor: c.superficieAlta, alignItems: 'center', justifyContent: 'center' },
    conteudo: { padding: espaco.lg, gap: espaco.sm },
    preco: { ...tipo.titulo, fontSize: 24, color: c.texto },
    titulo: { ...tipo.subtitulo, color: c.textoMedio },
    etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginVertical: espaco.sm },
    loja: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.md,
    },
    logo: { width: 40, height: 40, borderRadius: raio.sm, backgroundColor: c.superficieAlta },
    lojaNome: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    lojaMeta: { ...tipo.legenda, color: c.textoFraco },
    vendedor: { ...tipo.corpoPequeno, color: c.textoFraco },
    descricao: { ...tipo.corpo, color: c.texto, marginTop: espaco.sm },
    aviso: {
      flexDirection: 'row',
      gap: espaco.sm,
      backgroundColor: c.superficieAlta,
      borderRadius: raio.sm,
      padding: espaco.md,
      marginTop: espaco.md,
    },
    avisoTxt: { ...tipo.legenda, color: c.textoFraco, flex: 1 },
  });
