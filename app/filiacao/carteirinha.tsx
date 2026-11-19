import React, { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Carregando, Etiqueta, Tela, Vazio } from '@/ui/base';
import { API_BASE } from '@/conta/config';
import { obterFiliacao, type ConfigFiliacao } from '@/filiacao/api';
import { filiacaoVigente } from '@/db/filiacoes';
import type { Filiacao } from '@/domain/tipos';

function formatarCpf(cpf: string | null): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf ?? '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function dataBR(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Carteirinha digital de filiação. Puxa o status atual do servidor. O QR fica no
 * certificado (página web): aqui há o atalho para abri-lo/imprimi-lo e o acesso
 * à assessoria jurídica.
 */
export default function Carteirinha() {
  const c = useCores();
  const s = useEstilos(folha);
  const [filiacao, setFiliacao] = useState<Filiacao | null>(null);
  const [config, setConfig] = useState<ConfigFiliacao | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const r = await obterFiliacao();
    if (r) {
      setFiliacao(r.filiacao);
      setConfig(r.config);
    }
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  if (carregando) {
    return (
      <Tela voltar tituloCabecalho="Carteirinha">
        <Carregando />
      </Tela>
    );
  }

  if (!filiacao) {
    return (
      <Tela voltar tituloCabecalho="Carteirinha" estilo={{ paddingHorizontal: espaco.lg }}>
        <Vazio
          icone="ribbon-outline"
          titulo="Você ainda não é filiado"
          descricao="Filie-se à liga para ter sua carteirinha digital e o certificado."
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
    <Tela voltar tituloCabecalho="Carteirinha" estilo={{ paddingHorizontal: espaco.lg }}>
      {/* Cartão de filiação */}
      <View style={s.cartao}>
        <View style={s.cartaoTopo}>
          {config?.logoUrl ? (
            <Image source={{ uri: config.logoUrl }} style={s.logo} resizeMode="contain" />
          ) : (
            <Ionicons name="ribbon" size={22} color={c.latao} />
          )}
          <Text style={s.cartaoLiga} numberOfLines={1}>
            {nomeLiga}
          </Text>
        </View>
        <Text style={s.cartaoRotulo}>FILIADO</Text>
        <Text style={s.cartaoNome}>{filiacao.nomeCompleto ?? '—'}</Text>
        <Text style={s.cartaoCpf}>CPF {formatarCpf(filiacao.cpf)}</Text>
        <View style={s.cartaoRodape}>
          <View>
            <Text style={s.campoRotulo}>Nº DE REGISTRO</Text>
            <Text style={s.campoValor}>{filiacao.numeroFiliacao ?? '—'}</Text>
          </View>
          <View>
            <Text style={s.campoRotulo}>VÁLIDO ATÉ</Text>
            <Text style={s.campoValor}>{dataBR(filiacao.vigenteAte)}</Text>
          </View>
        </View>
        <View style={s.selo}>
          <Etiqueta
            texto={vigente ? 'ATIVA' : filiacao.status.toUpperCase()}
            cor={vigente ? c.primario : c.perigo}
            icone={vigente ? 'checkmark-circle' : 'alert-circle'}
          />
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

      {certificadoUrl ? (
        <Botao
          titulo="Abrir certificado de filiação"
          icone="ribbon-outline"
          aoTocar={() => void Linking.openURL(certificadoUrl)}
          estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
        />
      ) : null}

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

const folha = (c: Paleta) =>
  StyleSheet.create({
    cartao: {
      borderRadius: raio.md,
      padding: espaco.lg,
      backgroundColor: c.superficieAlta,
      borderWidth: 1,
      borderColor: `${c.latao}55`,
      marginTop: espaco.md,
    },
    cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, marginBottom: espaco.lg },
    logo: { width: 40, height: 28 },
    cartaoLiga: { flex: 1, ...tipo.subtitulo, color: c.texto },
    cartaoRotulo: { ...tipo.carimbo, color: c.latao },
    cartaoNome: { ...tipo.titulo, color: c.texto, marginTop: 4 },
    cartaoCpf: { ...tipo.corpoPequeno, color: c.textoMedio, marginTop: 2, fontFamily: MONO },
    cartaoRodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: espaco.xl },
    campoRotulo: { ...tipo.etiqueta, fontSize: 9, color: c.textoFraco },
    campoValor: { ...tipo.corpo, color: c.texto, fontFamily: MONO, marginTop: 2 },
    selo: { marginTop: espaco.lg },
    aviso: {
      ...tipo.corpoPequeno,
      color: c.perigo,
      textAlign: 'center',
      marginTop: espaco.md,
    },
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
