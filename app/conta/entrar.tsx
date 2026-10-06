import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { useApp } from '@/estado/AppContext';
import { ErroConta } from '@/conta/api';
import { emailValido } from '@/conta/cpf';
import { escolher } from '@/ui/dialogo';

export default function Entrar() {
  const p = useEstilos(folha);
  const { entrar } = useConta();
  const { armas, documentos, habitualidades } = useApp();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const podeEnviar = emailValido(email) && senha.length > 0;
  const temDadosLocais = armas.length + documentos.length + habitualidades.length > 0;

  async function aoEntrar() {
    // Se há dados neste aparelho, pergunta o que fazer com eles ao entrar.
    let descartarLocal = false;
    if (temDadosLocais) {
      let escolha: 'mesclar' | 'nuvem' | null = null;
      await escolher(
        'Dados deste aparelho',
        'Você já tem armas/documentos salvos aqui. Ao entrar na conta, o que fazer com eles?',
        [
          {
            rotulo: 'Enviar e mesclar com a nuvem',
            icone: 'cloud-upload-outline',
            acao: () => {
              escolha = 'mesclar';
            },
          },
          {
            rotulo: 'Usar só os dados da nuvem',
            icone: 'cloud-download-outline',
            destrutivo: true,
            acao: () => {
              escolha = 'nuvem';
            },
          },
        ]
      );
      if (escolha === null) return; // cancelou
      descartarLocal = escolha === 'nuvem';
    }

    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha, descartarLocal);
      router.back();
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela voltar teclado tituloCabecalho="Conta">
      <TituloTela titulo="Entrar" sub="Acesse sua conta da Carteira CAC." />
      <View style={{ height: espaco.xl }} />

      <Campo
        rotulo="E-mail"
        valor={email}
        aoMudar={setEmail}
        teclado="email-address"
        autoCapitalize="none"
        placeholder="voce@email.com"
        obrigatorio
      />
      <Campo
        rotulo="Senha"
        valor={senha}
        aoMudar={setSenha}
        placeholder="Sua senha"
        obrigatorio
        segredo
      />

      {erro ? <Text style={p.erro}>{erro}</Text> : null}

      <Botao
        titulo="Entrar"
        icone="log-in-outline"
        aoTocar={aoEntrar}
        carregando={enviando}
        desabilitado={!podeEnviar}
        estilo={{ marginTop: espaco.md }}
      />

      <Pressable
        onPress={() => router.replace('/conta/senha')}
        hitSlop={8}
        style={{ alignSelf: 'center', marginTop: espaco.lg }}
      >
        <Text style={p.link}>Esqueci minha senha</Text>
      </Pressable>

      <View style={p.rodape}>
        <Text style={p.rodapeTexto}>Ainda não tem conta?</Text>
        <Pressable onPress={() => router.replace('/conta/cadastrar')} hitSlop={8}>
          <Text style={p.linkForte}>Criar uma nova conta</Text>
        </Pressable>
      </View>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    erro: { ...tipo.legenda, color: c.perigo, marginBottom: espaco.sm },
    link: { ...tipo.corpoPequeno, color: c.textoMedio, fontWeight: '600' },
    linkForte: { ...tipo.corpoPequeno, color: c.primario, fontWeight: '700' },
    rodape: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: espaco.xxl,
    },
    rodapeTexto: { ...tipo.corpoPequeno, color: c.textoFraco },
  });
