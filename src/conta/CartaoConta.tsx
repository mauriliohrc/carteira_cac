import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useConta } from './ContaContext';

/**
 * Informativo de conta no topo do painel.
 *  - Deslogado: convida a entrar ou criar conta (o app segue 100% offline).
 *  - Logado: mostra quem está conectado e leva ao perfil.
 */
export function CartaoConta() {
  const c = useCores();
  const p = useEstilos(folha);
  const { usuario, carregando, logado } = useConta();

  // No boot, enquanto restaura a sessão, não pisca o estado "deslogado".
  if (carregando) return null;

  if (logado && usuario) {
    const primeiroNome = usuario.nome.trim().split(/\s+/)[0];
    return (
      <Pressable
        onPress={() => router.push('/conta/perfil')}
        style={({ pressed }) => [p.cartao, pressed ? { opacity: 0.7 } : null]}
      >
        <View style={p.avatar}>
          <Ionicons name="person" size={18} color={c.primario} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={p.ola}>Olá, {primeiroNome}</Text>
          <Text style={p.sub} numberOfLines={1}>
            Conta conectada · {usuario.email}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
      </Pressable>
    );
  }

  return (
    <View style={p.cartao}>
      <View style={p.avatar}>
        <Ionicons name="cloud-offline-outline" size={18} color={c.textoMedio} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={p.titulo}>Você está usando sem conta</Text>
        <Text style={p.sub}>
          Tudo funciona offline. Entre para ter benefícios como backup e vínculo com entidades.
        </Text>
        <View style={p.acoes}>
          <Pressable
            onPress={() => router.push('/conta/entrar')}
            style={({ pressed }) => [p.botao, p.botaoPrimario, pressed ? { opacity: 0.75 } : null]}
          >
            <Text style={p.botaoPrimarioTexto}>Clique aqui para entrar</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/conta/cadastrar')}
            style={({ pressed }) => [p.botao, p.botaoFantasma, pressed ? { opacity: 0.6 } : null]}
          >
            <Text style={p.botaoFantasmaTexto}>Criar uma nova conta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    cartao: {
      flexDirection: 'row',
      gap: espaco.md,
      alignItems: 'flex-start',
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.lg,
      marginBottom: espaco.md,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: raio.sm,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}44`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ola: { ...tipo.subtitulo, color: c.texto },
    titulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    sub: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },

    acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginTop: espaco.md },
    botao: {
      paddingVertical: 9,
      paddingHorizontal: espaco.md,
      borderRadius: raio.sm,
      borderWidth: 1,
    },
    botaoPrimario: { backgroundColor: c.primario, borderColor: c.primario },
    botaoPrimarioTexto: { fontSize: 13, fontWeight: '700', color: c.sobrePrimario },
    botaoFantasma: { backgroundColor: 'transparent', borderColor: c.borda },
    botaoFantasmaTexto: { fontSize: 13, fontWeight: '600', color: c.textoMedio },
  });
