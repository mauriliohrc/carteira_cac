import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { ErroConta } from '@/conta/api';
import { emailValido } from '@/conta/cpf';

export default function Senha() {
  const p = useEstilos(folha);
  const { pedirResetSenha, redefinirSenha } = useConta();

  const [etapa, setEtapa] = useState<'pedir' | 'redefinir'>('pedir');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedir() {
    setErro(null);
    setEnviando(true);
    try {
      const { codigoDev } = await pedirResetSenha(email.trim());
      if (codigoDev) setToken(codigoDev); // só em desenvolvimento
      setEtapa('redefinir');
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível enviar o código.');
    } finally {
      setEnviando(false);
    }
  }

  async function redefinir() {
    setErro(null);
    setEnviando(true);
    try {
      await redefinirSenha(email.trim(), token.trim(), senha);
      // Vai direto ao login (sem diálogo bloqueante, que travaria o botão se
      // não renderizasse). A nova senha já está valendo.
      router.replace('/conta/entrar');
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível redefinir a senha.');
      setEnviando(false);
    }
  }

  return (
    <Tela voltar teclado tituloCabecalho="Conta">
      {etapa === 'pedir' ? (
        <>
          <TituloTela
            titulo="Redefinir senha"
            sub="Informe o e-mail da sua conta. Você receberá um código para criar uma nova senha."
          />
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
          {erro ? <Text style={p.erro}>{erro}</Text> : null}
          <Botao
            titulo="Enviar código"
            icone="mail-outline"
            aoTocar={pedir}
            carregando={enviando}
            desabilitado={!emailValido(email)}
            estilo={{ marginTop: espaco.md }}
          />
        </>
      ) : (
        <>
          <TituloTela
            titulo="Nova senha"
            sub="Cole o código recebido e defina sua nova senha."
          />
          <View style={{ height: espaco.xl }} />
          <Campo
            rotulo="Código"
            valor={token}
            aoMudar={(v) => setToken(v.replace(/\D/g, '').slice(0, 6))}
            teclado="numeric"
            autoCapitalize="none"
            placeholder="000000"
            obrigatorio
          />
          <Campo
            rotulo="Nova senha"
            valor={senha}
            aoMudar={setSenha}
            placeholder="Mínimo 6 caracteres"
            obrigatorio
            segredo
          />
          {erro ? <Text style={p.erro}>{erro}</Text> : null}
          <Botao
            titulo="Redefinir senha"
            icone="checkmark-circle-outline"
            aoTocar={redefinir}
            carregando={enviando}
            desabilitado={token.trim().length !== 6 || senha.length < 6}
            estilo={{ marginTop: espaco.md }}
          />
          <Text style={p.nota}>
            Enviamos um código de 6 dígitos para {email || 'seu e-mail'}. Não chegou? Verifique o
            spam ou volte e peça de novo.
          </Text>
        </>
      )}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    erro: { ...tipo.legenda, color: c.perigo, marginBottom: espaco.sm },
    nota: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.lg, textAlign: 'center' },
  });
