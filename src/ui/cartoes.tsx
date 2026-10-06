import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { isoParaBR, textoPrazo } from '@/lib/data';
import { avaliarComCor } from '@/domain/vencimento';
import {
  ACERVO_POR_VALOR,
  corDe,
  GRUPO_POR_VALOR,
  rotuloTipoDoc,
  TIPO_DOC_POR_VALOR,
} from '@/domain/catalogos';
import { nomeArma } from '@/domain/rotulos';
import type { Arma, DocumentoComContexto } from '@/domain/tipos';
import { Etiqueta } from './base';

export function SeloSituacao({ validade, compacto }: { validade: string; compacto?: boolean }) {
  const c = useCores();
  const e = useEstilos(folha);
  const info = avaliarComCor(validade, c);
  return (
    <View
      style={[
        e.selo,
        { backgroundColor: info.fundo, borderColor: `${info.cor}55` },
        compacto ? e.seloCompacto : null,
      ]}
    >
      <View style={[e.ponto, { backgroundColor: info.cor }]} />
      <Text style={[e.seloTexto, { color: info.cor }]}>
        {compacto ? info.rotulo : `${info.rotulo} · ${textoPrazo(info.dias)}`}
      </Text>
    </View>
  );
}

export function CartaoArma({
  arma,
  documentos,
  capa,
  aoTocar,
}: {
  arma: Arma;
  documentos: DocumentoComContexto[];
  /** Primeira foto da galeria: reconhece a arma antes de o olho ler o texto. */
  capa?: string | null;
  aoTocar: () => void;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const acervo = ACERVO_POR_VALOR[arma.acervo];
  const grupo = GRUPO_POR_VALOR[arma.grupo];
  const corAcervo = corDe(acervo?.cor, c);
  const pior = piorSituacao(documentos, c);

  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [e.cartaoArma, pressed ? { opacity: 0.65 } : null]}
    >
      <View style={[e.faixa, { backgroundColor: pior?.cor ?? c.borda }]} />
      <View style={{ flex: 1, padding: espaco.lg }}>
        <View style={e.topoArma}>
          {capa ? (
            <Image source={{ uri: capa }} style={e.capa} resizeMode="cover" />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={e.nomeArma} numberOfLines={1}>
              {nomeArma(arma)}
            </Text>
            <Text style={e.subArma} numberOfLines={1}>
              {[arma.especie, arma.calibre].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={c.textoFraco} />
        </View>

        <View style={e.etiquetas}>
          <Etiqueta texto={acervo?.curto ?? arma.acervo} cor={corAcervo} fundo={`${corAcervo}1A`} />
          <Etiqueta texto={grupo?.curto ?? arma.grupo} />
        </View>

        <View style={e.rodapeArma}>
          <Text style={e.serie} numberOfLines={1}>
            SÉRIE <Text style={e.serieValor}>{arma.numeroSerie}</Text>
          </Text>
          {documentos.length ? (
            <Text style={[e.contagem, pior ? { color: pior.cor } : null]}>
              {documentos.length} doc{documentos.length > 1 ? 's' : ''}
              {pior ? ` · ${pior.rotulo}` : ''}
            </Text>
          ) : (
            <Text style={[e.contagem, { color: c.critico }]}>Sem documentos</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function CartaoDocumento({
  documento,
  aoTocar,
  mostrarArma = true,
}: {
  documento: DocumentoComContexto;
  aoTocar: () => void;
  mostrarArma?: boolean;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const def = TIPO_DOC_POR_VALOR[documento.tipo];
  const info = avaliarComCor(documento.dataValidade, c);
  const subtitulo = [
    mostrarArma && documento.arma ? nomeArma(documento.arma) : null,
    documento.titulo,
    documento.numero ? `nº ${documento.numero}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [
        e.cartaoDoc,
        { borderLeftColor: info.cor },
        pressed ? { opacity: 0.65 } : null,
      ]}
    >
      <View style={[e.iconeDoc, { backgroundColor: info.fundo, borderColor: `${info.cor}44` }]}>
        <Ionicons
          name={(def?.icone ?? 'document-text') as keyof typeof Ionicons.glyphMap}
          size={17}
          color={info.cor}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={e.tituloDoc} numberOfLines={1}>
          {rotuloTipoDoc(documento.tipo)}
        </Text>
        {subtitulo ? (
          <Text style={e.subDoc} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
        <View style={e.linhaPrazo}>
          <Text style={[e.prazo, { color: info.cor }]}>{textoPrazo(info.dias)}</Text>
          <Text style={e.dataDoc}>{isoParaBR(documento.dataValidade)}</Text>
          {documento.arquivos.length ? (
            <View style={e.anexoMarca}>
              <Ionicons name="attach" size={11} color={c.textoFraco} />
              <Text style={e.anexoTexto}>{documento.arquivos.length}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={c.textoFraco} />
    </Pressable>
  );
}

/**
 * Guia de tráfego na ficha da arma: o que importa bater o olho é
 * ORIGEM → DESTINO e até quando vale.
 */
export function CartaoGuia({
  documento,
  aoTocar,
}: {
  documento: DocumentoComContexto;
  aoTocar: () => void;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const info = avaliarComCor(documento.dataValidade, c);
  const vencida = info.situacao === 'VENCIDO';

  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [
        e.guia,
        { borderLeftColor: info.cor },
        vencida ? { opacity: 0.66 } : null,
        pressed ? { opacity: 0.55 } : null,
      ]}
    >
      <View style={e.guiaTrajeto}>
        <View style={e.guiaPonta}>
          <Text style={e.guiaRotulo}>ORIGEM</Text>
          <Text style={e.guiaLocal} numberOfLines={2}>
            {documento.origem || '—'}
          </Text>
        </View>

        <View style={e.guiaSeta}>
          <View style={[e.guiaLinha, { backgroundColor: info.cor }]} />
          <Ionicons name="arrow-forward" size={13} color={info.cor} />
          <View style={[e.guiaLinha, { backgroundColor: info.cor }]} />
        </View>

        <View style={[e.guiaPonta, { alignItems: 'flex-end' }]}>
          <Text style={e.guiaRotulo}>DESTINO</Text>
          <Text style={[e.guiaLocal, { textAlign: 'right' }]} numberOfLines={2}>
            {documento.destino || '—'}
          </Text>
        </View>
      </View>

      <View style={e.guiaRodape}>
        <View style={e.guiaValidade}>
          <Ionicons name="time-outline" size={12} color={info.cor} />
          <Text style={[e.guiaValidadeTexto, { color: info.cor }]}>
            {vencida ? 'Venceu em ' : 'Válida até '}
            {isoParaBR(documento.dataValidade)}
          </Text>
        </View>

        <View style={e.guiaExtras}>
          {documento.numero ? <Text style={e.guiaNumero}>nº {documento.numero}</Text> : null}
          {documento.arquivos.length ? (
            <View style={e.anexoMarca}>
              <Ionicons name="attach" size={11} color={c.textoFraco} />
              <Text style={e.anexoTexto}>{documento.arquivos.length}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={14} color={c.textoFraco} />
        </View>
      </View>
    </Pressable>
  );
}

/** Documento "principal" da ficha (o CRAF), em destaque. */
export function CartaoDestaque({
  documento,
  aoTocar,
}: {
  documento: DocumentoComContexto;
  aoTocar: () => void;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const def = TIPO_DOC_POR_VALOR[documento.tipo];
  const info = avaliarComCor(documento.dataValidade, c);

  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [
        e.destaque,
        { borderColor: `${info.cor}66`, backgroundColor: info.fundo },
        pressed ? { opacity: 0.68 } : null,
      ]}
    >
      <View style={e.destaqueTopo}>
        <Ionicons
          name={(def?.icone ?? 'document-text') as keyof typeof Ionicons.glyphMap}
          size={17}
          color={info.cor}
        />
        <Text style={[e.destaqueRotulo, { color: info.cor }]}>
          {rotuloTipoDoc(documento.tipo).toUpperCase()}
        </Text>
        {documento.arquivos.length ? (
          <View style={e.anexoMarca}>
            <Ionicons name="attach" size={12} color={info.cor} />
            <Text style={[e.anexoTexto, { color: info.cor }]}>{documento.arquivos.length}</Text>
          </View>
        ) : (
          <Text style={[e.semAnexo, { color: info.cor }]}>SEM ANEXO</Text>
        )}
      </View>

      <Text style={e.destaqueData}>{isoParaBR(documento.dataValidade)}</Text>
      <Text style={[e.destaquePrazo, { color: info.cor }]}>
        {info.rotulo} · {textoPrazo(info.dias)}
      </Text>
      {documento.numero ? <Text style={e.destaqueNumero}>nº {documento.numero}</Text> : null}
    </Pressable>
  );
}

function piorSituacao(documentos: DocumentoComContexto[], c: Paleta) {
  if (!documentos.length) return null;
  return documentos.map((d) => avaliarComCor(d.dataValidade, c)).sort((a, b) => a.dias - b.dias)[0];
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    selo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: espaco.md,
      paddingVertical: 6,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      alignSelf: 'flex-start',
    },
    seloCompacto: { paddingHorizontal: espaco.sm, paddingVertical: 4 },
    ponto: { width: 6, height: 6, borderRadius: 3 },
    seloTexto: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },

    cartaoArma: {
      flexDirection: 'row',
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      overflow: 'hidden',
      marginBottom: espaco.md,
    },
    faixa: { width: 3 },
    topoArma: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    capa: {
      width: 46,
      height: 46,
      borderRadius: raio.sm,
      backgroundColor: c.superficieAlta,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
    },
    nomeArma: { ...tipo.titulo, fontSize: 17, color: c.texto },
    subArma: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
    etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espaco.md },
    rodapeArma: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: espaco.sm,
      marginTop: espaco.md,
      paddingTop: espaco.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
    serie: { ...tipo.etiqueta, color: c.textoFraco, flexShrink: 1 },
    serieValor: { fontFamily: MONO, color: c.textoMedio, letterSpacing: 0 },
    contagem: { fontSize: 11.5, fontWeight: '600', color: c.textoMedio },

    cartaoDoc: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderLeftWidth: 2,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    iconeDoc: {
      width: 36,
      height: 36,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tituloDoc: { ...tipo.subtitulo, fontSize: 14.5, color: c.texto },
    subDoc: { ...tipo.legenda, color: c.textoFraco, marginTop: 2 },
    linhaPrazo: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
    prazo: { fontSize: 11.5, fontWeight: '600' },
    dataDoc: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, fontFamily: MONO },
    anexoMarca: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    anexoTexto: { ...tipo.etiqueta, fontSize: 10, color: c.textoFraco },

    guia: {
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderLeftWidth: 2,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    guiaTrajeto: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    guiaPonta: { flex: 1 },
    guiaRotulo: { ...tipo.etiqueta, fontSize: 9, color: c.textoFraco, marginBottom: 4 },
    guiaLocal: { fontSize: 13, fontWeight: '600', color: c.texto, lineHeight: 17 },
    guiaSeta: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
    guiaLinha: { width: 1, height: 6, opacity: 0.45 },
    guiaRodape: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: espaco.sm,
      marginTop: espaco.md,
      paddingTop: espaco.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
    guiaValidade: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
    guiaValidadeTexto: { fontSize: 11.5, fontWeight: '600' },
    guiaExtras: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    guiaNumero: { ...tipo.legenda, fontSize: 11, color: c.textoFraco },

    destaque: {
      borderRadius: raio.md,
      borderWidth: 1,
      padding: espaco.lg,
      marginBottom: espaco.sm,
    },
    destaqueTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    destaqueRotulo: { flex: 1, ...tipo.carimbo },
    destaqueData: {
      ...tipo.numero,
      color: c.texto,
      marginTop: espaco.md,
      fontFamily: MONO,
      letterSpacing: 0,
    },
    destaquePrazo: { fontSize: 12.5, fontWeight: '600', marginTop: 5 },
    destaqueNumero: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, marginTop: 7 },
    semAnexo: { ...tipo.etiqueta, fontSize: 9, opacity: 0.85 },
  });
