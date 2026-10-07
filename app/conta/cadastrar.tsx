import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { ErroConta } from '@/conta/api';
import { emailValido, limparCPF, mascaraCPF, validarCPF } from '@/conta/cpf';

/** (DD) 9XXXX-XXXX conforme o usuário digita. */
function mascaraCelular(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Cadastrar() {
  const p = useEstilos(folha);
  const { cadastrar } = useConta();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cpfOk = validarCPF(cpf);
  const emailOk = emailValido(email);
  const senhaOk = senha.length >= 6;
  const nomeOk = nome.trim().length >= 2;
  const celularDigitos = celular.replace(/\D/g, '');
  const celularOk = celularDigitos.length === 0 || celularDigitos.length === 10 || celularDigitos.length === 11;
  const podeEnviar = nomeOk && cpfOk && emailOk && senhaOk && celularOk;

  async function aoCadastrar() {
    setTocado(true);
    if (!podeEnviar) return;
    setErro(null);
    setEnviando(true);
    try {
      await cadastrar({
        nome: nome.trim(),
        cpf: limparCPF(cpf),
        email: email.trim(),
        senha,
        celular: celularDigitos || null,
      });
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
        rotulo="Celular (opcional)"
        valor={celular}
        aoMudar={(v) => setCelular(mascaraCelular(v))}
        teclado="numeric"
        placeholder="(11) 99999-9999"
        maxLength={16}
        dica="Usamos só para entrar em contato e dar suporte, se você precisar."
        erro={tocado && !celularOk ? 'Informe um celular válido com DDD, ou deixe em branco.' : null}
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
