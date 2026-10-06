import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { avisar, confirmar, escolher } from '@/ui/dialogo';
import {
  apagarFoto,
  escolherDaGaleria,
  escolherPdfOuImagem,
  fotografar,
  guardarFoto,
  type ArquivoEscolhido,
} from '@/arquivos/cofre';
import { definirComoCapa, type Foto } from '@/db/fotos';

/**
 * Galeria do armamento.
 *
 * A primeira foto é a capa — é ela que identifica a arma numa lista, mais
 * rápido que ler modelo e número de série. Por isso a grade tem ação de
 * "definir como capa" em vez de arrastar para reordenar: é o único movimento
 * que realmente interessa aqui.
 */
export function GaleriaArma({ armaId }: { armaId: string }) {
  const c = useCores();
  const g = useEstilos(folha);
  const { fotosDaArma, recarregar } = useApp();
  const [ocupado, setOcupado] = useState(false);

  const fotos = fotosDaArma(armaId);

  const adicionar = async (obter: () => Promise<ArquivoEscolhido | null>) => {
    setOcupado(true);
    try {
      const escolhida = await obter();
      if (!escolhida) return;
      await guardarFoto(armaId, escolhida);
      await recarregar();
    } catch (e) {
      console.error('[CAC Brasil] falha ao guardar foto', e);
      avisar('Não foi possível adicionar', e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  const menuAdicionar = () =>
    void escolher('Adicionar foto', 'De onde vem a imagem do armamento?', [
      { rotulo: 'Tirar foto agora', icone: 'camera-outline', acao: () => adicionar(fotografar) },
      {
        rotulo: 'Escolher da galeria',
        icone: 'images-outline',
        acao: () => adicionar(escolherDaGaleria),
      },
      {
        rotulo: 'Escolher arquivo',
        icone: 'folder-open-outline',
        acao: () => adicionar(escolherPdfOuImagem),
      },
    ]);

  const menuFoto = (foto: Foto, indice: number) =>
    void escolher('Foto do armamento', `Imagem ${indice + 1} de ${fotos.length}`, [
      {
        rotulo: 'Ver em tela cheia',
        icone: 'expand-outline',
        acao: () =>
          router.push({
            pathname: '/visualizador',
            params: { uri: foto.uri, nome: 'Foto do armamento', mime: 'image/jpeg' },
          }),
      },
      ...(indice === 0
        ? []
        : [
            {
              rotulo: 'Usar como capa',
              icone: 'star-outline',
              acao: async () => {
                await definirComoCapa(foto);
                await recarregar();
              },
            },
          ]),
      {
        rotulo: 'Remover foto',
        icone: 'trash-outline',
        destrutivo: true,
        acao: async () => {
          const ok = await confirmar({
            titulo: 'Remover foto',
            mensagem: 'A imagem será apagada deste aparelho.',
            rotuloConfirmar: 'Remover',
            destrutivo: true,
          });
          if (!ok) return;
          await apagarFoto(foto);
          await recarregar();
        },
      },
    ]);

  return (
    <View style={g.raiz}>
      <View style={g.cabecalho}>
        <View style={g.iconeCabecalho}>
          <Ionicons name="images-outline" size={15} color={c.primario} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={g.titulo}>FOTOS</Text>
          <Text style={g.descricao}>
            {fotos.length
              ? `${fotos.length} imagem${fotos.length > 1 ? 'ns' : ''} · a primeira é a capa`
              : 'Registre o armamento em imagem'}
          </Text>
        </View>
        <Pressable onPress={menuAdicionar} hitSlop={10} disabled={ocupado}>
          <Ionicons
            name={ocupado ? 'hourglass-outline' : 'add-circle-outline'}
            size={23}
            color={c.primario}
          />
        </Pressable>
      </View>

      {fotos.length ? (
        <View style={g.grade}>
          {fotos.map((foto, indice) => (
            <Pressable
              key={foto.id}
              onPress={() => menuFoto(foto, indice)}
              style={({ pressed }) => [g.celula, pressed && { opacity: 0.7 }]}
            >
              <Image source={{ uri: foto.uri }} style={g.imagem} resizeMode="cover" />
              {indice === 0 ? (
                <View style={g.selo}>
                  <Text style={g.seloTexto}>CAPA</Text>
                </View>
              ) : null}
            </Pressable>
          ))}

          <Pressable
            onPress={menuAdicionar}
            disabled={ocupado}
            style={({ pressed }) => [g.celula, g.celulaVazia, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="add" size={22} color={c.textoFraco} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={menuAdicionar}
          disabled={ocupado}
          style={({ pressed }) => [g.convite, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="camera-outline" size={20} color={c.textoFraco} />
          <Text style={g.conviteTexto}>Adicionar foto do armamento</Text>
        </Pressable>
      )}
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: { marginTop: espaco.xl },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      marginBottom: espaco.md,
    },
    iconeCabecalho: {
      width: 30,
      height: 30,
      borderRadius: raio.sm,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titulo: { ...tipo.carimbo, color: c.texto },
    descricao: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, marginTop: 2 },

    grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
    celula: {
      width: '31.5%',
      aspectRatio: 1,
      borderRadius: raio.md,
      overflow: 'hidden',
      backgroundColor: c.superficieAlta,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
    },
    imagem: { width: '100%', height: '100%' },
    celulaVazia: {
      alignItems: 'center',
      justifyContent: 'center',
      borderStyle: 'dashed',
      borderColor: c.bordaForte,
    },
    selo: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 8.5, color: '#FFF' },

    convite: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espaco.sm,
      paddingVertical: espaco.xl,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: c.borda,
    },
    conviteTexto: { ...tipo.corpoPequeno, color: c.textoFraco },
  });
