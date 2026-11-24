import React, { useCallback, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Carregando, Tela, Vazio } from '@/ui/base';
import { API_BASE } from '@/conta/config';
import { obterFiliacao, type ConfigFiliacao } from '@/filiacao/api';
import { obterFotoCarteirinha, definirFotoCarteirinha, removerFotoCarteirinha } from '@/filiacao/foto';
import { exportarCarteiraPdf } from '@/filiacao/carteiraPdf';
import { filiacaoVigente } from '@/db/filiacoes';
import { escolher, avisar } from '@/ui/dialogo';
import type { Filiacao } from '@/domain/tipos';

/** Verde "documento oficial" — fixo (não tematizado) para manter a identidade. */
const VERDE = '#16351f';
const VERDE_CLARO = '#1f4a2c';
const CREME = '#f4f1e8';

function formatarCpf(cpf: string | null): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf ?? '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Carteira de filiado — identidade visual de documento oficial (sem imitar o
 * porte federal): faixa verde, foto 3×4, dados do filiado e da filiação. A foto
 * fica só no aparelho. A autenticidade é verificável pelo certificado (QR).
 */
export default function Carteirinha() {
  const c = useCores();
  const s = useEstilos(folha);
  const [filiacao, setFiliacao] = useState<Filiacao | null>(null);
  const [config, setConfig] = useState<ConfigFiliacao | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    const [r, f] = await Promise.all([obterFiliacao(), obterFotoCarteirinha()]);
    if (r) {
      setFiliacao(r.filiacao);
      setConfig(r.config);
    }
    setFoto(f);
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const trocarFoto = useCallback(async () => {
    if (foto) {
      void escolher('Foto da carteira', 'O que você quer fazer?', [
        { rotulo: 'Trocar foto', icone: 'camera-outline', acao: async () => setFoto((await definirFotoCarteirinha()) ?? foto) },
        {
          rotulo: 'Remover foto',
          icone: 'trash-outline',
          destrutivo: true,
          acao: async () => {
            await removerFotoCarteirinha();
            setFoto(null);
          },
        },
      ]);
    } else {
      const nova = await definirFotoCarteirinha();
      if (nova) setFoto(nova);
    }
  }, [foto]);

  const exportarPdf = useCallback(async () => {
    if (!filiacao) return;
    setExportando(true);
    try {
      await exportarCarteiraPdf({
        nomeLiga: config?.nomeLiga ?? 'Liga',
        nome: filiacao.nomeCompleto ?? '—',
        cpf: formatarCpf(filiacao.cpf),
        nascimento: dataBR(filiacao.dataNascimento),
        matricula: filiacao.numeroFiliacao ?? '—',
        validade: dataBR(filiacao.vigenteAte),
        statusTexto: filiacaoVigente(filiacao) ? 'ATIVA' : filiacao.status.toUpperCase(),
        vigente: filiacaoVigente(filiacao),
        fotoUri: foto,
        logoUrl: config?.logoUrl ?? null,
      });
    } catch (e) {
      await avisar('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  }, [filiacao, config, foto]);

  if (carregando) {
    return (
      <Tela voltar tituloCabecalho="Carteira de filiado">
        <Carregando />
      </Tela>
    );
  }

  if (!filiacao) {
    return (
      <Tela voltar tituloCabecalho="Carteira de filiado" estilo={{ paddingHorizontal: espaco.lg }}>
        <Vazio
          icone="card-outline"
          titulo="Você ainda não é filiado"
          descricao="Filie-se à liga para ter sua carteira de filiado digital e o certificado."
          acao={<Botao titulo="Filiar-se" icone="ribbon" aoTocar={() => router.replace('/filiacao')} />}
        />
      </Tela>
    );
  }

  const vigente = filiacaoVigente(filiacao);
  const nomeLiga = config?.nomeLiga ?? 'Liga';
  const certificadoUrl = filiacao.numeroFiliacao
    ? `${API_BASE}/filiacao/certificado/${encodeURIComponent(filiacao.numeroFiliacao)}`
    : null;

  return (
    <Tela voltar tituloCabecalho="Carteira de filiado" estilo={{ paddingHorizontal: espaco.lg }}>
      {/* ---------------------------------------------- CARTÃO (documento) */}
      <View style={s.cartao}>
        {/* Faixa superior */}
        <View style={s.faixa}>
          {config?.logoUrl ? (
            <Image source={{ uri: config.logoUrl }} style={s.logo} resizeMode="contain" />
          ) : (
            <View style={s.brasao}>
              <Ionicons name="shield-half" size={20} color={CREME} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.faixaLiga} numberOfLines={1}>
              {nomeLiga.toUpperCase()}
            </Text>
            <Text style={s.faixaTitulo}>CARTEIRA DE FILIADO</Text>
          </View>
          <View style={[s.selo, { backgroundColor: vigente ? '#2f7d4f' : '#9b2c2c' }]}>
            <Text style={s.seloTexto}>{vigente ? 'ATIVA' : filiacao.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Corpo: foto + dados */}
        <View style={s.corpo}>
          <Pressable style={s.fotoBox} onPress={trocarFoto}>
            {foto ? (
              <Image source={{ uri: foto }} style={s.foto} resizeMode="cover" />
            ) : (
              <View style={s.fotoVazia}>
                <Ionicons name="person" size={38} color={`${VERDE}88`} />
                <Text style={s.fotoDica}>Adicionar{'\n'}foto</Text>
              </View>
            )}
            <View style={s.fotoEditar}>
              <Ionicons name="camera" size={12} color={CREME} />
            </View>
          </Pressable>

          <View style={s.dados}>
            <Campo s={s} rotulo="NOME" valor={filiacao.nomeCompleto ?? '—'} forte />
            <View style={s.linhaDados}>
              <Campo s={s} rotulo="CPF" valor={formatarCpf(filiacao.cpf)} />
              <Campo s={s} rotulo="NASCIMENTO" valor={dataBR(filiacao.dataNascimento)} />
            </View>
            <View style={s.linhaDados}>
              <Campo s={s} rotulo="MATRÍCULA" valor={filiacao.numeroFiliacao ?? '—'} />
              <Campo s={s} rotulo="VÁLIDO ATÉ" valor={dataBR(filiacao.vigenteAte)} />
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.rodape}>
          <Ionicons name="shield-checkmark" size={13} color={`${VERDE}aa`} />
          <Text style={s.rodapeTexto} numberOfLines={2}>
            Documento associativo. Autenticidade verificável pelo certificado (QR).
          </Text>
        </View>
      </View>

      {filiacao.status === 'pendente_pagamento' ? (
        <Text style={s.aviso}>Pagamento pendente. Conclua para ativar sua filiação.</Text>
      ) : null}

      {!filiacao.documentacaoCompleta ? (
        <Botao
          titulo="Enviar documento de identificação"
          variante="secundario"
          icone="document-attach-outline"
          aoTocar={() => router.push('/filiacao/dados')}
          estilo={{ alignSelf: 'stretch', marginTop: espaco.lg }}
        />
      ) : null}

      <Botao
        titulo="Exportar carteira em PDF"
        variante="secundario"
        icone="download-outline"
        aoTocar={exportarPdf}
        carregando={exportando}
        estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
      />

      {certificadoUrl ? (
        <Botao
          titulo="Abrir certificado de filiação"
          icone="ribbon-outline"
          aoTocar={() => void Linking.openURL(certificadoUrl)}
          estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
        />
      ) : null}

      <Text style={s.notaAcervo}>
        O certificado também fica salvo no seu acervo de documentos, em “Filiação”.
      </Text>

      {/* Assessoria jurídica */}
      <View style={s.juridico}>
        <View style={s.juridicoCabeca}>
          <Ionicons name="shield-checkmark-outline" size={18} color={c.primario} />
          <Text style={s.juridicoTitulo}>Assessoria jurídica</Text>
        </View>
        <Text style={s.juridicoTexto}>
          Como filiado, você tem direito à assessoria jurídica da liga durante a vigência. Fale com o
          suporte pelo app para ser direcionado.
        </Text>
      </View>
    </Tela>
  );
}

function Campo({
  s,
  rotulo,
  valor,
  forte,
}: {
  s: ReturnType<typeof folha>;
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.campoRotulo}>{rotulo}</Text>
      <Text style={[s.campoValor, forte ? s.campoValorForte : null]} numberOfLines={forte ? 2 : 1}>
        {valor}
      </Text>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    cartao: {
      borderRadius: raio.lg,
      backgroundColor: CREME,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: `${VERDE}55`,
      marginTop: espaco.md,
      // leve sombra/elevação para parecer um cartão físico
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    faixa: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      backgroundColor: VERDE,
      paddingHorizontal: espaco.md,
      paddingVertical: espaco.sm,
    },
    logo: { width: 34, height: 26 },
    brasao: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: VERDE_CLARO,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: `${CREME}66`,
    },
    faixaLiga: { color: CREME, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    faixaTitulo: { color: `${CREME}cc`, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 1 },
    selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    seloTexto: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    corpo: { flexDirection: 'row', gap: espaco.md, padding: espaco.md },
    fotoBox: {
      width: 92,
      height: 122,
      borderRadius: raio.sm,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: `${VERDE}66`,
      overflow: 'hidden',
    },
    foto: { width: '100%', height: '100%' },
    fotoVazia: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
    fotoDica: { color: `${VERDE}88`, fontSize: 10, textAlign: 'center', fontWeight: '600' },
    fotoEditar: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: VERDE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dados: { flex: 1, justifyContent: 'center', gap: espaco.sm },
    linhaDados: { flexDirection: 'row', gap: espaco.sm },
    campoRotulo: { color: `${VERDE}99`, fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
    campoValor: { color: VERDE, fontSize: 13, fontFamily: MONO, marginTop: 1 },
    campoValorForte: { fontSize: 15, fontWeight: '700' },
    rodape: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: espaco.md,
      paddingVertical: espaco.sm,
      borderTopWidth: 1,
      borderTopColor: `${VERDE}22`,
      backgroundColor: `${VERDE}0e`,
    },
    rodapeTexto: { flex: 1, color: `${VERDE}aa`, fontSize: 10, lineHeight: 13 },
    aviso: { ...tipo.corpoPequeno, color: c.perigo, textAlign: 'center', marginTop: espaco.md },
    notaAcervo: { ...tipo.legenda, color: c.textoMedio, textAlign: 'center', marginTop: espaco.md },
    juridico: {
      marginTop: espaco.xl,
      padding: espaco.lg,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}44`,
    },
    juridicoCabeca: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    juridicoTitulo: { ...tipo.subtitulo, color: c.texto },
    juridicoTexto: { ...tipo.corpoPequeno, color: c.textoMedio, marginTop: 6 },
  });
