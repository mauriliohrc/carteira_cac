import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Cartao, Divisor, Etiqueta, Linha, Tela } from '@/ui/base';
import { confirmar } from '@/ui/dialogo';
import { CartaoDestaque, CartaoDocumento, CartaoGuia } from '@/ui/cartoes';
import { GaleriaArma } from '@/ui/GaleriaArma';
import { ACERVO_POR_VALOR, corDe, GRUPO_POR_VALOR } from '@/domain/catalogos';
import { nomeArma } from '@/domain/rotulos';
import { removerArma } from '@/db/armas';
import { apagarPastaDeFotos, apagarPastaDoDocumento } from '@/arquivos/cofre';
import { avaliar } from '@/domain/vencimento';
import { isoParaBR } from '@/lib/data';
import type { DocumentoComContexto, TipoDocumento } from '@/domain/tipos';

/**
 * Ficha da arma: identificação em cima, documentos embaixo separados por
 * categoria. Documentos vencidos saem da frente (ficam recolhidos), mas nunca
 * são apagados — dá para abrir o histórico quando precisar.
 */

interface Categoria {
  chave: string;
  titulo: string;
  descricao: string;
  icone: keyof typeof Ionicons.glyphMap;
  tipos: TipoDocumento[];
  layout: 'destaque' | 'guia' | 'lista';
  tipoParaAdicionar: TipoDocumento;
}

const CATEGORIAS: Categoria[] = [
  {
    chave: 'craf',
    titulo: 'CRAF',
    descricao: 'Certificado de Registro de Arma de Fogo',
    icone: 'document-text-outline',
    tipos: ['CRAF'],
    layout: 'destaque',
    tipoParaAdicionar: 'CRAF',
  },
  {
    chave: 'guias',
    titulo: 'Guias de tráfego',
    descricao: 'Trajetos autorizados para transporte',
    icone: 'car-outline',
    tipos: ['GUIA_TRAFEGO'],
    layout: 'guia',
    tipoParaAdicionar: 'GUIA_TRAFEGO',
  },
  {
    chave: 'outros',
    titulo: 'Outros documentos',
    descricao: 'Autorizações de compra e anexos diversos',
    icone: 'folder-outline',
    tipos: ['AUTORIZACAO_COMPRA', 'OUTRO'],
    layout: 'lista',
    tipoParaAdicionar: 'AUTORIZACAO_COMPRA',
  },
];

export default function FichaArma() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useCores();
  const f = useEstilos(folha);
  const { armas, documentosDaArma, recarregar } = useApp();
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const arma = useMemo(() => armas.find((a) => a.id === id) ?? null, [armas, id]);
  const documentos = useMemo(
    () => (arma ? documentosDaArma(arma.id) : []),
    [arma, documentosDaArma]
  );

  const categorias = useMemo(
    () =>
      CATEGORIAS.map((cat) => {
        const daCategoria = documentos.filter((d) => cat.tipos.includes(d.tipo));
        const vigentes: DocumentoComContexto[] = [];
        const vencidos: DocumentoComContexto[] = [];
        for (const doc of daCategoria) {
          if (avaliar(doc.dataValidade).situacao === 'VENCIDO') vencidos.push(doc);
          else vigentes.push(doc);
        }
        // Vigentes: o que vence primeiro aparece primeiro.
        vigentes.sort((a, b) => a.dataValidade.localeCompare(b.dataValidade));
        // Vencidos: o mais recente primeiro, que é o que se costuma procurar.
        vencidos.sort((a, b) => b.dataValidade.localeCompare(a.dataValidade));
        return { ...cat, vigentes, vencidos };
      }),
    [documentos]
  );

  if (!arma) {
    return (
      <Tela voltar>
        <Text style={f.aviso}>Arma não encontrada.</Text>
      </Tela>
    );
  }

  const acervo = ACERVO_POR_VALOR[arma.acervo];
  const grupo = GRUPO_POR_VALOR[arma.grupo];
  const corAcervo = corDe(acervo?.cor, c);

  const abrirDoc = (docId: string) =>
    router.push({ pathname: '/documento/[id]', params: { id: docId } });

  const adicionar = (t: TipoDocumento) =>
    router.push({ pathname: '/documento/editar', params: { armaId: arma.id, tipo: t } });

  const excluir = async () => {
    const ok = await confirmar({
      titulo: 'Excluir arma',
      mensagem: `“${nomeArma(arma)}” e seus ${documentos.length} documento(s) serão apagados deste aparelho. Não dá para desfazer.`,
      rotuloConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    for (const doc of documentos) await apagarPastaDoDocumento(doc.id);
    await apagarPastaDeFotos(arma.id);
    await removerArma(arma.id);
    await recarregar();
    router.back();
  };

  return (
    <Tela
      voltar
      tituloCabecalho={nomeArma(arma)}
      acao={
        <Pressable
          onPress={() => router.push({ pathname: '/arma/editar', params: { id: arma.id } })}
          hitSlop={12}
        >
          <Ionicons name="create-outline" size={20} color={c.primario} />
        </Pressable>
      }
    >
      {/* ---------------------------------------------------- identificação */}
      <Cartao corBorda={corAcervo}>
        <Text style={f.rotuloFicha}>FICHA DA ARMA</Text>
        <Text style={f.nome}>{nomeArma(arma)}</Text>

        <View style={f.etiquetas}>
          <Etiqueta texto={acervo?.curto ?? arma.acervo} cor={corAcervo} fundo={`${corAcervo}1A`} />
          <Etiqueta texto={arma.calibre} />
          {arma.especie ? <Etiqueta texto={arma.especie} /> : null}
        </View>

        <Divisor />

        <Linha rotulo="Modelo" valor={arma.modelo} />
        <Linha rotulo="Marca" valor={arma.marca} />
        <Linha rotulo="Nº de série" valor={arma.numeroSerie} monoespacado />
        <Linha rotulo="Grupo" valor={grupo?.rotulo} />
        <Linha
          rotulo={arma.acervo === 'DEFESA_PESSOAL' ? 'Registro SINARM' : 'Registro SIGMA'}
          valor={arma.registroNumero}
          monoespacado
        />
        <Linha rotulo="Funcionamento" valor={arma.funcionamento} />
        <Linha rotulo="Capacidade" valor={arma.capacidade} />
        <Linha rotulo="Nº do cano" valor={arma.numeroCano} monoespacado />
        <Linha rotulo="Ano" valor={arma.anoFabricacao} />
        <Linha rotulo="Origem" valor={arma.paisOrigem} />
        <Linha rotulo="Guarda" valor={arma.localGuarda} />

        {arma.observacoes ? (
          <>
            <Divisor />
            <Text style={f.observacoes}>{arma.observacoes}</Text>
          </>
        ) : null}
      </Cartao>

      <GaleriaArma armaId={arma.id} />

      {/* --------------------------------------------------- documentos */}
      {categorias.map((cat) => {
        const aberto = !!expandidos[cat.chave];
        return (
          <View key={cat.chave} style={f.categoria}>
            <View style={f.cabecalhoCategoria}>
              <View style={f.iconeCategoria}>
                <Ionicons name={cat.icone} size={15} color={c.primario} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={f.tituloCategoria}>{cat.titulo.toUpperCase()}</Text>
                <Text style={f.descricaoCategoria}>
                  {cat.vigentes.length
                    ? `${cat.vigentes.length} válido${cat.vigentes.length > 1 ? 's' : ''}`
                    : cat.descricao}
                </Text>
              </View>
              <Pressable onPress={() => adicionar(cat.tipoParaAdicionar)} hitSlop={10}>
                <Ionicons name="add-circle-outline" size={23} color={c.primario} />
              </Pressable>
            </View>

            {cat.vigentes.map((doc) =>
              cat.layout === 'destaque' ? (
                <CartaoDestaque key={doc.id} documento={doc} aoTocar={() => abrirDoc(doc.id)} />
              ) : cat.layout === 'guia' ? (
                <CartaoGuia key={doc.id} documento={doc} aoTocar={() => abrirDoc(doc.id)} />
              ) : (
                <CartaoDocumento
                  key={doc.id}
                  documento={doc}
                  mostrarArma={false}
                  aoTocar={() => abrirDoc(doc.id)}
                />
              )
            )}

            {!cat.vigentes.length ? (
              <Pressable
                onPress={() => adicionar(cat.tipoParaAdicionar)}
                style={({ pressed }) => [f.vazioCategoria, pressed && { opacity: 0.65 }]}
              >
                <Ionicons name="add" size={15} color={c.textoFraco} />
                <Text style={f.vazioTexto}>
                  {cat.vencidos.length
                    ? `Nenhum ${cat.titulo.toLowerCase()} válido — adicionar`
                    : `Adicionar ${cat.titulo.toLowerCase()}`}
                </Text>
              </Pressable>
            ) : null}

            {/* Vencidos: recolhidos por padrão, mas sempre acessíveis. */}
            {cat.vencidos.length ? (
              <>
                <Pressable
                  onPress={() =>
                    setExpandidos((atual) => ({ ...atual, [cat.chave]: !atual[cat.chave] }))
                  }
                  style={({ pressed }) => [f.alternador, pressed && { opacity: 0.65 }]}
                >
                  <Ionicons
                    name={aberto ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={c.textoFraco}
                  />
                  <Text style={f.alternadorTexto}>
                    {aberto ? 'Ocultar' : 'Mostrar'} {cat.vencidos.length} vencido
                    {cat.vencidos.length > 1 ? 's' : ''}
                  </Text>
                  {!aberto ? (
                    <Text style={f.alternadorData}>
                      último: {isoParaBR(cat.vencidos[0].dataValidade)}
                    </Text>
                  ) : null}
                </Pressable>

                {aberto ? (
                  <View style={f.historico}>
                    {cat.vencidos.map((doc) =>
                      cat.layout === 'guia' ? (
                        <CartaoGuia key={doc.id} documento={doc} aoTocar={() => abrirDoc(doc.id)} />
                      ) : (
                        <View key={doc.id} style={{ opacity: 0.68 }}>
                          <CartaoDocumento
                            documento={doc}
                            mostrarArma={false}
                            aoTocar={() => abrirDoc(doc.id)}
                          />
                        </View>
                      )
                    )}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}

      <Botao
        titulo="Excluir arma"
        icone="trash-outline"
        variante="perigo"
        aoTocar={() => void excluir()}
        estilo={{ marginTop: espaco.xxl }}
      />
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    aviso: { ...tipo.corpo, color: c.textoMedio, textAlign: 'center', marginTop: espaco.xxl },
    rotuloFicha: { ...tipo.carimbo, fontSize: 9, color: c.textoFraco, marginBottom: 6 },
    nome: { ...tipo.telaTitulo, fontSize: 22, color: c.texto },
    etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espaco.md },
    observacoes: { ...tipo.corpoPequeno, color: c.textoMedio },

    categoria: { marginTop: espaco.xl },
    cabecalhoCategoria: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      marginBottom: espaco.md,
    },
    iconeCategoria: {
      width: 30,
      height: 30,
      borderRadius: raio.sm,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tituloCategoria: { ...tipo.carimbo, color: c.texto },
    descricaoCategoria: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, marginTop: 2 },

    vazioCategoria: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espaco.sm,
      paddingVertical: espaco.lg,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: c.borda,
    },
    vazioTexto: { ...tipo.legenda, color: c.textoFraco },

    alternador: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: espaco.md,
      paddingHorizontal: espaco.sm,
    },
    alternadorTexto: { fontSize: 12.5, fontWeight: '600', color: c.textoFraco },
    alternadorData: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, opacity: 0.85 },
    historico: { paddingLeft: espaco.md, borderLeftWidth: 1, borderLeftColor: c.borda },
  });
