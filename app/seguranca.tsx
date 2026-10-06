import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Cartao, Tela } from '@/ui/base';
import { avisar, confirmar } from '@/ui/dialogo';
import { TecladoPin } from '@/seguranca/TecladoPin';
import { useTranca } from '@/seguranca/TrancaProvider';
import {
  autenticarBiometria,
  definirBiometria,
  definirPin,
  removerTranca,
  rotuloBiometria,
  verificarPin,
} from '@/seguranca/tranca';

type Etapa = 'menu' | 'criarNovo' | 'confirmarNovo' | 'verificarParaTrocar' | 'verificarParaRemover';

export default function Seguranca() {
  const c = useCores();
  const s = useEstilos(folha);
  const { temPin, biometria, biometriaLigada, sincronizar } = useTranca();

  const [etapa, setEtapa] = useState<Etapa>(temPin ? 'menu' : 'criarNovo');
  const [pin, setPin] = useState('');
  const [primeiro, setPrimeiro] = useState('');
  const [erro, setErro] = useState(false);

  const bio = rotuloBiometria(biometria.tipo);

  const irPara = (e: Etapa) => {
    setPin('');
    setPrimeiro('');
    setErro(false);
    setEtapa(e);
  };

  const aoMudar = (v: string) => {
    setErro(false);
    setPin(v);
  };

  const aoCompletar = async (valor: string) => {
    switch (etapa) {
      case 'criarNovo':
        setPrimeiro(valor);
        setPin('');
        setEtapa('confirmarNovo');
        return;

      case 'confirmarNovo':
        if (valor !== primeiro) {
          setErro(true);
          setPin('');
          return;
        }
        await definirPin(valor);
        await sincronizar();
        avisar('PIN criado', 'Seu acervo agora abre só com o PIN.');
        irPara('menu');
        return;

      case 'verificarParaTrocar':
        if (await verificarPin(valor)) irPara('criarNovo');
        else {
          setErro(true);
          setPin('');
        }
        return;

      case 'verificarParaRemover':
        if (await verificarPin(valor)) {
          await removerTranca();
          await sincronizar();
          avisar('Bloqueio desativado', 'O app volta a abrir sem PIN.');
          router.back();
        } else {
          setErro(true);
          setPin('');
        }
        return;
    }
  };

  const alternarBiometria = async (ligar: boolean) => {
    if (ligar) {
      const ok = await autenticarBiometria(`Confirme para ligar o desbloqueio por ${bio}`);
      if (!ok) return;
      await definirBiometria(true);
    } else {
      await definirBiometria(false);
    }
    await sincronizar();
  };

  const removerBloqueio = async () => {
    const ok = await confirmar({
      titulo: 'Desativar o bloqueio?',
      mensagem: 'O app deixará de pedir PIN ou biometria para abrir.',
      rotuloConfirmar: 'Desativar',
      destrutivo: true,
    });
    if (ok) irPara('verificarParaRemover');
  };

  // --- telas de digitação (criar / confirmar / verificar)
  if (etapa !== 'menu') {
    const titulos: Record<Exclude<Etapa, 'menu'>, string> = {
      criarNovo: 'Crie um PIN de 6 dígitos',
      confirmarNovo: 'Repita o PIN',
      verificarParaTrocar: 'Digite o PIN atual',
      verificarParaRemover: 'Confirme o PIN atual',
    };
    const subtitulos: Record<Exclude<Etapa, 'menu'>, string | undefined> = {
      criarNovo: 'Será pedido toda vez que você abrir o app.',
      confirmarNovo: 'Só para conferir que não houve engano.',
      verificarParaTrocar: undefined,
      verificarParaRemover: undefined,
    };
    return (
      <Tela voltar tituloCabecalho="Segurança" estilo={s.centro}>
        <View style={s.wrapKeypad}>
          <TecladoPin
            titulo={erro && etapa === 'confirmarNovo' ? 'Os PINs não conferem' : titulos[etapa]}
            subtitulo={erro ? undefined : subtitulos[etapa]}
            valor={pin}
            aoMudar={aoMudar}
            aoCompletar={aoCompletar}
            erro={erro}
          />
        </View>
      </Tela>
    );
  }

  // --- menu (já existe PIN)
  return (
    <Tela voltar tituloCabecalho="Segurança" estilo={s.conteudo}>
      <View style={s.intro}>
        <View style={s.emblema}>
          <Ionicons name="lock-closed" size={24} color={c.primario} />
        </View>
        <Text style={s.titulo}>Bloqueio do app</Text>
        <Text style={s.subtitulo}>
          A Carteira CAC pede seu PIN de 6 dígitos ao abrir. Seus documentos ficam protegidos mesmo se
          o celular for parar em outras mãos.
        </Text>
      </View>

      <ItemMenu
        icone="keypad-outline"
        titulo="Alterar PIN"
        subtitulo="Trocar os 6 dígitos de acesso"
        aoTocar={() => irPara('verificarParaTrocar')}
      />

      <Cartao estilo={s.linhaSwitch}>
        <Ionicons
          name={biometria.tipo === 'digital' ? 'finger-print' : 'scan-outline'}
          size={20}
          color={biometria.disponivel ? c.primario : c.textoFraco}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitulo}>Desbloquear com {bio}</Text>
          <Text style={s.itemSub}>
            {biometria.disponivel
              ? `Abra sem digitar o PIN usando ${bio}.`
              : `Nenhuma ${bio} cadastrada neste aparelho.`}
          </Text>
        </View>
        <Switch
          value={biometriaLigada && biometria.disponivel}
          disabled={!biometria.disponivel}
          onValueChange={(v) => void alternarBiometria(v)}
          trackColor={{ true: c.primario, false: c.bordaForte }}
          thumbColor="#FFFFFF"
        />
      </Cartao>

      <ItemMenu
        icone="lock-open-outline"
        titulo="Desativar bloqueio"
        subtitulo="Voltar a abrir o app sem PIN"
        destrutivo
        aoTocar={() => void removerBloqueio()}
      />
    </Tela>
  );
}

function ItemMenu({
  icone,
  titulo,
  subtitulo,
  aoTocar,
  destrutivo,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  subtitulo: string;
  aoTocar: () => void;
  destrutivo?: boolean;
}) {
  const c = useCores();
  const s = useEstilos(folha);
  return (
    <Cartao aoTocar={aoTocar} estilo={s.item}>
      <Ionicons name={icone} size={20} color={destrutivo ? c.perigo : c.primario} />
      <View style={{ flex: 1 }}>
        <Text style={[s.itemTitulo, destrutivo ? { color: c.perigo } : null]}>{titulo}</Text>
        <Text style={s.itemSub}>{subtitulo}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={c.textoFraco} />
    </Cartao>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flexGrow: 1, justifyContent: 'center' },
    wrapKeypad: { alignItems: 'center', paddingVertical: espaco.xl },

    conteudo: { gap: espaco.sm },
    intro: { alignItems: 'center', marginBottom: espaco.lg },
    emblema: {
      width: 56,
      height: 56,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.md,
    },
    titulo: { ...tipo.telaTitulo, fontSize: 22, color: c.texto, textAlign: 'center' },
    subtitulo: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
      maxWidth: 340,
    },

    item: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    itemTitulo: { ...tipo.subtitulo, fontSize: 14.5, color: c.texto },
    itemSub: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
  });
