import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Cartao, Divisor, Linha, Secao, Tela } from '@/ui/base';
import { avisar, confirmar, escolher } from '@/ui/dialogo';
import { SeloSituacao } from '@/ui/cartoes';
import { ORGAO_POR_VALOR, TIPO_DOC_POR_VALOR } from '@/domain/catalogos';
import { isoParaBR, textoPrazo } from '@/lib/data';
import { avaliarComCor } from '@/domain/vencimento';
import { nomeArma } from '@/domain/rotulos';
import { atualizarDocumento, removerDocumento } from '@/db/documentos';
import { atualizarArma } from '@/db/armas';
import { AnalisandoDocumento } from '@/ui/AnalisandoDocumento';
import { extrairCamposDoArquivo } from '@/integracoes/extracao';
import {
  abrirNoSistema,
  apagarArquivo,
  apagarPastaDoDocumento,
  arquivoExiste,
  compartilhar,
  ehImagem,
  ehPdf,
  escolherDaGaleria,
  escolherPdfOuImagem,
  fotografar,
  guardarArquivo,
  tamanhoLegivel,
  type ArquivoEscolhido,
} from '@/arquivos/cofre';
import type { Arquivo } from '@/domain/tipos';

export default function DetalheDocumento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useCores();
  const v = useEstilos(folha);
  const { documentos, recarregar } = useApp();
  const [anexando, setAnexando] = useState(false);
  const [analisando, setAnalisando] = useState(false);

  const doc = useMemo(() => documentos.find((d) => d.id === id) ?? null, [documentos, id]);
  const def = doc ? TIPO_DOC_POR_VALOR[doc.tipo] : null;

  if (!doc || !def) {
    return (
      <Tela voltar>
        <Text style={v.aviso}>Documento não encontrado.</Text>
      </Tela>
    );
  }

  const info = avaliarComCor(doc.dataValidade, c);

  // Lê o arquivo no servidor (PDF por texto; foto/scan por OCR) e preenche só
  // os campos AINDA VAZIOS do documento e, quando houver arma vinculada (CRAF),
  // dela também. Nunca sobrescreve.
  const analisarEEnriquecer = async (uri: string, mime: string) => {
    if (!doc) return;
    setAnalisando(true);
    try {
      const campos = await extrairCamposDoArquivo(uri, mime, doc.tipo);
      const vazio = (v?: string | null) => !v || !String(v).trim();
      let preenchidos = 0;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _i, criadoEm: _c, atualizadoEm: _a, arma, arquivos: _arq, ...docBase } = doc;
      const docEntrada = { ...docBase };
      let mudouDoc = false;
      if (campos.numero && vazio(docEntrada.numero)) { docEntrada.numero = campos.numero; preenchidos++; mudouDoc = true; }
      if (campos.dataEmissao && vazio(docEntrada.dataEmissao)) { docEntrada.dataEmissao = campos.dataEmissao; preenchidos++; mudouDoc = true; }
      if (campos.origem && vazio(docEntrada.origem)) { docEntrada.origem = campos.origem; preenchidos++; mudouDoc = true; }
      if (campos.destino && vazio(docEntrada.destino)) { docEntrada.destino = campos.destino; preenchidos++; mudouDoc = true; }
      if (campos.observacoes && vazio(docEntrada.observacoes)) { docEntrada.observacoes = campos.observacoes; preenchidos++; mudouDoc = true; }
      if (mudouDoc) await atualizarDocumento(doc.id, docEntrada);

      if (arma) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: aid, criadoEm: _ac, atualizadoEm: _aa, ...armaBase } = arma;
        const a = { ...armaBase };
        let mudouArma = false;
        if (campos.numeroSerie && vazio(a.numeroSerie)) { a.numeroSerie = campos.numeroSerie; preenchidos++; mudouArma = true; }
        if (campos.marca && vazio(a.marca)) { a.marca = campos.marca; preenchidos++; mudouArma = true; }
        if (campos.modelo && vazio(a.modelo)) { a.modelo = campos.modelo; preenchidos++; mudouArma = true; }
        if (campos.calibre && vazio(a.calibre)) { a.calibre = campos.calibre; preenchidos++; mudouArma = true; }
        if (campos.especie && vazio(a.especie)) { a.especie = campos.especie; preenchidos++; mudouArma = true; }
        if (campos.fabricante && vazio(a.fabricante)) { a.fabricante = campos.fabricante; preenchidos++; mudouArma = true; }
        if (campos.paisOrigem && vazio(a.paisOrigem)) { a.paisOrigem = campos.paisOrigem; preenchidos++; mudouArma = true; }
        if (campos.anoFabricacao && vazio(a.anoFabricacao)) { a.anoFabricacao = campos.anoFabricacao; preenchidos++; mudouArma = true; }
        if (mudouArma) await atualizarArma(aid, a);
      }

      await recarregar();
      avisar(
        preenchidos ? 'Documento analisado' : 'Nada a preencher',
        preenchidos
          ? `Preenchi ${preenchidos} campo(s) a partir do documento. Confira antes de confiar.`
          : 'Não encontrei campos novos no documento (ou já estavam preenchidos).'
      );
    } catch (e) {
      console.error('[CAC Brasil] falha ao analisar documento', e);
    } finally {
      setAnalisando(false);
    }
  };

  const anexar = async (obter: () => Promise<ArquivoEscolhido | null>) => {
    setAnexando(true);
    try {
      const escolhido = await obter();
      if (!escolhido) return;
      await guardarArquivo(doc.id, escolhido);
      await recarregar();
      // PDF (texto) e foto/scan (OCR) são analisados para preencher o que faltar.
      await analisarEEnriquecer(escolhido.uri, escolhido.mime ?? '');
    } catch (e) {
      console.error('[CAC Brasil] falha ao anexar', e);
      avisar('Não foi possível anexar', e instanceof Error ? e.message : String(e));
    } finally {
      setAnexando(false);
    }
  };

  const menuAnexo = () =>
    void escolher('Anexar documento', 'Como você quer adicionar o arquivo?', [
      {
        rotulo: 'Escolher PDF ou imagem',
        icone: 'document-attach-outline',
        acao: () => anexar(escolherPdfOuImagem),
      },
      {
        rotulo: 'Fotografar documento',
        icone: 'camera-outline',
        acao: () => anexar(fotografar),
      },
      {
        rotulo: 'Escolher da galeria',
        icone: 'images-outline',
        acao: () => anexar(escolherDaGaleria),
      },
    ]);

  const removerAnexo = async (arquivo: Arquivo) => {
    const ok = await confirmar({
      titulo: 'Remover anexo',
      mensagem: `“${arquivo.nome}” será apagado deste aparelho.`,
      rotuloConfirmar: 'Remover',
      destrutivo: true,
    });
    if (!ok) return;
    await apagarArquivo(arquivo);
    await recarregar();
  };

  const excluir = async () => {
    const ok = await confirmar({
      titulo: 'Excluir documento',
      mensagem: 'O documento e seus anexos serão apagados. Não dá para desfazer.',
      rotuloConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    await apagarPastaDoDocumento(doc.id);
    await removerDocumento(doc.id);
    await recarregar();
    router.back();
  };

  return (
    <Tela
      voltar
      tituloCabecalho={def.curto}
      acao={
        <Pressable
          onPress={() => router.push({ pathname: '/documento/editar', params: { id: doc.id } })}
          hitSlop={12}
        >
          <Ionicons name="create-outline" size={20} color={c.primario} />
        </Pressable>
      }
    >
      <Cartao corBorda={info.cor}>
        <Text style={v.tipo}>{def.rotulo}</Text>
        {doc.arma ? (
          <Pressable
            onPress={() => router.push({ pathname: '/arma/[id]', params: { id: doc.arma!.id } })}
            style={v.linkArma}
          >
            <Ionicons name="albums-outline" size={13} color={c.primario} />
            <Text style={v.linkArmaTexto}>{nomeArma(doc.arma)}</Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: espaco.md }}>
          <SeloSituacao validade={doc.dataValidade} />
        </View>

        <Divisor />

        <Linha rotulo="Validade" valor={isoParaBR(doc.dataValidade)} />
        <Linha rotulo="Situação" valor={textoPrazo(info.dias)} />
        <Linha rotulo="Emissão" valor={doc.dataEmissao ? isoParaBR(doc.dataEmissao) : null} />
        <Linha rotulo={def.campos.numero ?? 'Número'} valor={doc.numero} monoespacado />
        <Linha rotulo="Órgão" valor={doc.orgao ? ORGAO_POR_VALOR[doc.orgao]?.rotulo : null} />
        <Linha rotulo="Identificação" valor={doc.titulo} />

        {doc.tipo === 'GUIA_TRAFEGO' ? (
          <>
            <Divisor />
            <Linha rotulo="Origem" valor={doc.origem} />
            <Linha rotulo="Destino" valor={doc.destino} />
          </>
        ) : null}

        {def.campos.local && doc.localManejo ? (
          <>
            <Divisor />
            <Linha rotulo="Local do manejo" valor={doc.localManejo} />
          </>
        ) : null}

        {doc.observacoes ? (
          <>
            <Divisor />
            <Text style={v.observacoes}>{doc.observacoes}</Text>
          </>
        ) : null}
      </Cartao>

      <Secao
        titulo={`Anexos · ${doc.arquivos.length}`}
        acao={
          <Pressable onPress={menuAnexo} hitSlop={10} disabled={anexando}>
            <Text style={v.acaoSecao}>{anexando ? 'Anexando…' : '+ Anexar'}</Text>
          </Pressable>
        }
      >
        {doc.arquivos.length ? (
          doc.arquivos.map((arquivo) => (
            <ItemArquivo
              key={arquivo.id}
              arquivo={arquivo}
              aoRemover={() => void removerAnexo(arquivo)}
            />
          ))
        ) : (
          <Pressable onPress={menuAnexo} style={({ pressed }) => [v.anexoVazio, pressed && { opacity: 0.7 }]}>
            <Ionicons name="cloud-upload-outline" size={24} color={c.primario} />
            <Text style={v.anexoVazioTitulo}>Anexar PDF ou foto</Text>
            <Text style={v.anexoVazioSub}>
              Fica guardado dentro do app, disponível mesmo sem internet.
            </Text>
          </Pressable>
        )}
      </Secao>

      <Botao
        titulo="Excluir documento"
        icone="trash"
        variante="perigo"
        aoTocar={() => void excluir()}
        estilo={{ marginTop: espaco.xl }}
      />

      <AnalisandoDocumento visivel={analisando} />
    </Tela>
  );
}

function ItemArquivo({ arquivo, aoRemover }: { arquivo: Arquivo; aoRemover: () => void }) {
  const c = useCores();
  const v = useEstilos(folha);
  const existe = arquivoExiste(arquivo.uri);
  const imagem = ehImagem(arquivo);
  const pdf = ehPdf(arquivo);

  const abrir = () => {
    if (!existe) {
      avisar('Arquivo indisponível', 'O anexo não está mais no aparelho. Anexe novamente.');
      return;
    }
    router.push({
      pathname: '/visualizador',
      params: { uri: arquivo.uri, nome: arquivo.nome, mime: arquivo.mime ?? '' },
    });
  };

  return (
    <View style={v.arquivo}>
      <Pressable onPress={abrir} style={v.arquivoToque}>
        {imagem && existe ? (
          <Image source={{ uri: arquivo.uri }} style={v.miniatura} />
        ) : (
          <View style={[v.miniatura, v.miniaturaIcone]}>
            <Ionicons
              name={pdf ? 'document-text' : 'document'}
              size={20}
              color={existe ? c.primario : c.perigo}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={v.arquivoNome} numberOfLines={1}>
            {arquivo.nome}
          </Text>
          <Text style={v.arquivoMeta}>
            {existe
              ? [pdf ? 'PDF' : imagem ? 'Imagem' : 'Arquivo', tamanhoLegivel(arquivo.tamanho)]
                  .filter(Boolean)
                  .join(' · ')
              : 'Arquivo não encontrado'}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={() => void abrirNoSistema(arquivo)} hitSlop={8} style={v.acaoArquivo}>
        <Ionicons name="open-outline" size={17} color={c.textoMedio} />
      </Pressable>
      <Pressable onPress={() => void compartilhar(arquivo)} hitSlop={8} style={v.acaoArquivo}>
        <Ionicons name="share-outline" size={17} color={c.textoMedio} />
      </Pressable>
      <Pressable onPress={aoRemover} hitSlop={8} style={v.acaoArquivo}>
        <Ionicons name="trash-outline" size={17} color={c.perigo} />
      </Pressable>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    aviso: { ...tipo.corpo, color: c.textoMedio, textAlign: 'center', marginTop: espaco.xxl },
    tipo: { ...tipo.titulo, fontSize: 17, color: c.texto, lineHeight: 23 },
    linkArma: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
    linkArmaTexto: { ...tipo.etiqueta, color: c.primario },
    observacoes: { ...tipo.corpoPequeno, color: c.textoMedio },

    acaoSecao: { ...tipo.etiqueta, fontSize: 10, color: c.primario },

    arquivo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.sm,
      marginBottom: espaco.sm,
    },
    arquivoToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    miniatura: {
      width: 40,
      height: 40,
      borderRadius: raio.sm,
      backgroundColor: c.superficieAlta,
    },
    miniaturaIcone: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
    },
    arquivoNome: { ...tipo.corpoPequeno, fontWeight: '600', color: c.texto },
    arquivoMeta: { ...tipo.etiqueta, fontSize: 9.5, color: c.textoFraco, marginTop: 3 },
    acaoArquivo: { padding: espaco.sm },

    anexoVazio: {
      alignItems: 'center',
      padding: espaco.xl,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: c.bordaForte,
      gap: 6,
    },
    anexoVazioTitulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto, marginTop: 6 },
    anexoVazioSub: { ...tipo.legenda, color: c.textoFraco, textAlign: 'center' },
  });
