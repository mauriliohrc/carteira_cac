import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { ErroConta } from '@/conta/api';
import { emailValido, limparCPF, mascaraCPF, validarCPF } from '@/conta/cpf';

export default function Cadastrar() {
  const p = useEstilos(folha);
  const { cadastrar } = useConta();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cpfOk = validarCPF(cpf);
  const emailOk = emailValido(email);
  const senhaOk = senha.length >= 6;
  const nomeOk = nome.trim().length >= 2;
  const podeEnviar = nomeOk && cpfOk && emailOk && senhaOk;

  async function aoCadastrar() {
    setTocado(true);
    if (!podeEnviar) return;
    setErro(null);
    setEnviando(true);
    try {
      await cadastrar({ nome: nome.trim(), cpf: limparCPF(cpf), email: email.trim(), senha });
      router.back();
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível criar a conta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela voltar teclado tituloCabecalho="Conta">
      <TituloTela
        titulo="Criar conta"
        sub="Opcional — o app funciona offline. A conta libera benefícios como backup e vínculo com entidades."
      />
      <View style={{ height: espaco.xl }} />

      <Campo rotulo="Nome completo" valor={nome} aoMudar={setNome} placeholder="Seu nome" obrigatorio
        autoCapitalize="words"
        erro={tocado && !nomeOk ? 'Informe seu nome.' : null} />
      <Campo
        rotulo="CPF"
        valor={cpf}
        aoMudar={(v) => setCpf(mascaraCPF(v))}
        teclado="numeric"
        placeholder="000.000.000-00"
        obrigatorio
        maxLength={14}
        erro={tocado && !cpfOk ? 'CPF inválido.' : null}
      />
      <Campo
        rotulo="E-mail"
        valor={email}
        aoMudar={setEmail}
        teclado="email-address"
        autoCapitalize="none"
        placeholder="voce@email.com"
        obrigatorio
        erro={tocado && !emailOk ? 'E-mail inválido.' : null}
      />
      <Campo
        rotulo="Senha"
        valor={senha}
        aoMudar={setSenha}
        placeholder="Mínimo 6 caracteres"
        obrigatorio
        segredo
        erro={tocado && !senhaOk ? 'A senha deve ter ao menos 6 caracteres.' : null}
      />

      {erro ? <Text style={p.erro}>{erro}</Text> : null}

      <Botao
        titulo="Criar conta"
        icone="person-add-outline"
        aoTocar={aoCadastrar}
        carregando={enviando}
        estilo={{ marginTop: espaco.md }}
      />

      <View style={p.rodape}>
        <Text style={p.rodapeTexto}>Já tem conta?</Text>
        <Pressable onPress={() => router.replace('/conta/entrar')} hitSlop={8}>
          <Text style={p.linkForte}>Entrar</Text>
        </Pressable>
      </View>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    erro: { ...tipo.legenda, color: c.perigo, marginBottom: espaco.sm },
    linkForte: { ...tipo.corpoPequeno, color: c.primario, fontWeight: '700' },
    rodape: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: espaco.xxl },
    rodapeTexto: { ...tipo.corpoPequeno, color: c.textoFraco },
  });
