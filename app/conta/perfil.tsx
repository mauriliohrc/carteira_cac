import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Cartao, Linha, Tela, TituloTela } from '@/ui/base';
import { SeletorChips } from '@/ui/formulario';
import { useConta } from '@/conta/ContaContext';
import { useApp } from '@/estado/AppContext';
import { mascaraCPF } from '@/conta/cpf';
import { escolher } from '@/ui/dialogo';
import { NIVEIS_ATIRADOR, NIVEL_POR_VALOR } from '@/domain/catalogos';
import type { NivelAtirador } from '@/domain/tipos';

export default function Perfil() {
  const c = useCores();
  const p = useEstilos(folha);
  const { usuario, sair } = useConta();
  const { nivelAtirador, definirNivelAtirador } = useApp();

  // Deslogou (ou abriu sem sessão): não renderiza nada (a navegação é tratada
  // por quem chama o sair()).
  if (!usuario) return null;

  async function aoSair() {
    await escolher(
      'Sair da conta',
      'O que fazer com os dados deste aparelho? Eles continuam salvos na sua conta na nuvem de qualquer forma.',
      [
        {
          rotulo: 'Manter no aparelho (offline)',
          icone: 'phone-portrait-outline',
          acao: async () => {
            await sair(false);
            router.back();
          },
        },
        {
          rotulo: 'Sair e apagar deste aparelho',
          destrutivo: true,
          icone: 'trash-outline',
          acao: async () => {
            await sair(true);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <Tela voltar tituloCabecalho="Conta">
      <TituloTela titulo="Minha conta" />
      <View style={{ height: espaco.xl }} />

      <View style={p.avatarLinha}>
        <View style={p.avatar}>
          <Ionicons name="person" size={26} color={c.primario} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={p.nome}>{usuario.nome}</Text>
          <Text style={p.email}>{usuario.email}</Text>
        </View>
      </View>

      <Cartao estilo={{ marginTop: espaco.xl }}>
        <Linha rotulo="Nome" valor={usuario.nome} />
        <Linha rotulo="E-mail" valor={usuario.email} />
        <Linha rotulo="CPF" valor={mascaraCPF(usuario.cpf)} monoespacado />
        <Linha rotulo="E-mail verificado" valor={usuario.emailVerificado ? 'Sim' : 'Ainda não'} />
      </Cartao>

      <Cartao estilo={{ marginTop: espaco.xl }}>
        <SeletorChips
          rotulo="Nível de atirador desportivo"
          itens={NIVEIS_ATIRADOR.map((n) => ({ valor: n.valor, rotulo: n.rotulo }))}
          selecionado={nivelAtirador}
          aoSelecionar={(v) => void definirNivelAtirador(v as NivelAtirador)}
          dica={NIVEL_POR_VALOR[nivelAtirador]?.detalhe}
        />
        <Text style={p.notaNivel}>
          Define a exigência de habitualidade (IN DG/PF nº 311/2025). A conformidade aparece na aba
          Habitualidade, dentro do Acervo.
        </Text>
      </Cartao>

      <View style={p.nota}>
        <Ionicons name="sync-outline" size={15} color={c.textoFraco} />
        <Text style={p.notaTexto}>
          Seu acervo e documentos sincronizam na nuvem e o acervo da Shooting House entra
          automaticamente, sem precisar importar nada.
        </Text>
      </View>

      {!usuario.emailVerificado ? (
        <Botao
          titulo="Confirmar e-mail"
          icone="mail-unread-outline"
          aoTocar={() => router.push('/conta/verificar')}
          estilo={{ marginTop: espaco.xl }}
        />
      ) : null}

      <Botao
        titulo="Alterar senha"
        icone="lock-closed-outline"
        variante="secundario"
        aoTocar={() => router.push('/conta/alterar-senha')}
        estilo={{ marginTop: usuario.emailVerificado ? espaco.xl : espaco.md }}
      />

      <Botao
        titulo="Sair da conta"
        icone="log-out-outline"
        variante="perigo"
        aoTocar={aoSair}
        estilo={{ marginTop: espaco.md }}
      />
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    avatarLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.lg },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nome: { ...tipo.titulo, color: c.texto },
    email: { ...tipo.corpoPequeno, color: c.textoFraco, marginTop: 2 },
    nota: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.lg, paddingHorizontal: 2 },
    notaTexto: { flex: 1, ...tipo.legenda, color: c.textoFraco, lineHeight: 16 },
    notaNivel: { ...tipo.legenda, color: c.textoFraco, lineHeight: 16, marginTop: espaco.sm },
  });
