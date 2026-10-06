import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { espaco, tipo, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { ErroConta } from '@/conta/api';

/**
 * Confirmação do e-mail da conta por código de 6 dígitos.
 *
 * Ao abrir, dispara o envio do código. Confirmar o e-mail é pré-requisito para
 * importar o acervo da Shooting House (evita que alguém puxe documentos de
 * terceiros cadastrando o CPF alheio com outro e-mail).
 */
export default function Verificar() {
  const p = useEstilos(folha);
  const { usuario, enviarCodigoEmail, confirmarEmail } = useConta();

  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const jaDisparou = useRef(false);

  async function enviar(manual: boolean) {
    if (manual) setReenviando(true);
    setErro(null);
    try {
      const { codigoDev, jaVerificado } = await enviarCodigoEmail();
      if (jaVerificado) {
        router.back();
        return;
      }
      if (codigoDev) setCodigo(codigoDev); // só em desenvolvimento
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível enviar o código.');
    } finally {
      if (manual) setReenviando(false);
    }
  }

  // Dispara o envio uma única vez ao abrir a tela.
  useEffect(() => {
    if (jaDisparou.current) return;
    jaDisparou.current = true;
    void enviar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await confirmarEmail(codigo.trim());
      // Conta confirmada: volta direto (o estado já reflete "verificado").
      // Nada de diálogo bloqueante aqui — ele deixaria o botão travado se não
      // renderizasse. router.back() encerra a tela.
      router.back();
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível confirmar o e-mail.');
      setEnviando(false);
    }
  }

  return (
    <Tela voltar teclado tituloCabecalho="Conta">
      <TituloTela
        titulo="Confirme seu e-mail"
        sub={`Enviamos um código de 6 dígitos para ${usuario?.email ?? 'seu e-mail'}.`}
      />
      <View style={{ height: espaco.xl }} />

      <Campo
        rotulo="Código"
        valor={codigo}
        aoMudar={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
        teclado="numeric"
        autoCapitalize="none"
        placeholder="000000"
        obrigatorio
      />

      {erro ? <Text style={p.erro}>{erro}</Text> : null}

      <Botao
        titulo="Confirmar e-mail"
        icone="checkmark-circle-outline"
        aoTocar={confirmar}
        carregando={enviando}
        desabilitado={codigo.trim().length !== 6}
        estilo={{ marginTop: espaco.md }}
      />

      <Botao
        titulo="Reenviar código"
        icone="refresh-outline"
        variante="fantasma"
        aoTocar={() => enviar(true)}
        carregando={reenviando}
        estilo={{ marginTop: espaco.sm }}
      />

      <Text style={p.nota}>Não chegou? Verifique a caixa de spam.</Text>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    erro: { ...tipo.legenda, color: c.perigo, marginBottom: espaco.sm },
    nota: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.lg, textAlign: 'center' },
  });
