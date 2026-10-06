import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { espaco, tipo, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { ErroConta } from '@/conta/api';

/** Troca de senha do usuário logado — exige a senha atual. */
export default function AlterarSenha() {
  const p = useEstilos(folha);
  const { alterarSenha } = useConta();

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const podeEnviar = atual.length > 0 && nova.length >= 6 && nova === confirma;

  async function salvar() {
    if (nova !== confirma) {
      setErro('A confirmação não bate com a nova senha.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await alterarSenha(atual, nova);
      // Sem diálogo bloqueante (ele travaria o botão se não renderizasse):
      // volta direto, a senha já foi trocada.
      router.back();
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível alterar a senha.');
      setEnviando(false);
    }
  }

  return (
    <Tela voltar teclado tituloCabecalho="Conta">
      <TituloTela titulo="Alterar senha" sub="Informe a senha atual e defina uma nova." />

      <Campo
        rotulo="Senha atual"
        valor={atual}
        aoMudar={setAtual}
        placeholder="Sua senha de agora"
        obrigatorio
        segredo
      />
      <Campo
        rotulo="Nova senha"
        valor={nova}
        aoMudar={setNova}
        placeholder="Mínimo 6 caracteres"
        obrigatorio
        segredo
      />
      <Campo
        rotulo="Confirmar nova senha"
        valor={confirma}
        aoMudar={setConfirma}
        placeholder="Repita a nova senha"
        obrigatorio
        segredo
      />

      {erro ? <Text style={p.erro}>{erro}</Text> : null}

      <Botao
        titulo="Salvar nova senha"
        icone="checkmark-circle-outline"
        aoTocar={salvar}
        carregando={enviando}
        desabilitado={!podeEnviar}
        estilo={{ marginTop: espaco.md }}
      />
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    erro: { ...tipo.legenda, color: c.perigo, marginBottom: espaco.sm, marginTop: espaco.sm },
  });
