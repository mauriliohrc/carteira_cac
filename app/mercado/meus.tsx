import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, Vazio } from '@/ui/base';
import { avisar, confirmar, escolher } from '@/ui/dialogo';
import {
  destacarAnuncio,
  excluirAnuncio,
  formatarPreco,
  marcarVendido,
  meusAnuncios,
  pausarAnuncio,
  reativarAnuncio,
} from '@/mercado/api';
import { ROTULO_STATUS_ANUNCIO, type Anuncio, type StatusAnuncio } from '@/mercado/tipos';
import { comprarDestaque, type IdDestaque } from '@/billing';

const COR_STATUS = (c: ReturnType<typeof useCores>): Record<StatusAnuncio, string> => ({
  PENDENTE: c.textoMedio,
  APROVADO: c.primario,
  PAUSADO: c.textoFraco,
  VENDIDO: c.latao,
  REJEITADO: c.perigo,
});

export default function MeusAnuncios() {
  const c = useCores();
  const p = useEstilos(folha);
  const [itens, setItens] = useState<Anuncio[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setItens(await meusAnuncios());
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const comprarEaplicar = async (id: string, produtoId: IdDestaque) => {
    try {
      const recibo = await comprarDestaque(produtoId);
      if (!recibo) return; // cancelado pelo usuário
      await destacarAnuncio(id, { ...recibo, produtoId });
      await avisar('Anúncio destacado ⭐', 'Ele já aparece no topo da lista.');
      void carregar();
    } catch (e) {
      await avisar('Não foi possível destacar', e instanceof Error ? e.message : 'Tente novamente.');
    }
  };
  const destacar = (a: Anuncio) =>
    void escolher('Destacar anúncio', 'Por quantos dias seu anúncio fica no topo?', [
      { rotulo: '7 dias', icone: 'star' as const, acao: () => comprarEaplicar(a.id, 'destaque_7d') },
      { rotulo: '15 dias', icone: 'star' as const, acao: () => comprarEaplicar(a.id, 'destaque_15d') },
      { rotulo: '30 dias', icone: 'star' as const, acao: () => comprarEaplicar(a.id, 'destaque_30d') },
    ]);

  const abrirAcoes = (a: Anuncio) => {
    const opcoes = [];
    if (a.status === 'APROVADO') {
      opcoes.push({ rotulo: a.destacado ? 'Renovar destaque' : 'Destacar (turbinar)', icone: 'star-outline' as const, acao: () => destacar(a) });
      opcoes.push({ rotulo: 'Pausar', icone: 'pause-outline' as const, acao: async () => { await pausarAnuncio(a.id); void carregar(); } });
    }
    if (a.status === 'PAUSADO') opcoes.push({ rotulo: 'Reativar', icone: 'play-outline' as const, acao: async () => { await reativarAnuncio(a.id); void carregar(); } });
    if (a.status === 'APROVADO' || a.status === 'PAUSADO')
      opcoes.push({ rotulo: 'Já vendi', icone: 'checkmark-done-outline' as const, acao: async () => { await marcarVendido(a.id); void carregar(); } });
    opcoes.push({ rotulo: 'Editar', icone: 'create-outline' as const, acao: () => router.push({ pathname: '/mercado/novo', params: { id: a.id } }) });
    opcoes.push({
      rotulo: 'Excluir',
      icone: 'trash-outline' as const,
      destrutivo: true,
      acao: async () => {
        const ok = await confirmar({ titulo: 'Excluir anúncio?', mensagem: 'Esta ação não pode ser desfeita.', destrutivo: true, rotuloConfirmar: 'Excluir' });
        if (ok) { await excluirAnuncio(a.id); void carregar(); }
      },
    });
    void escolher(a.titulo, 'O que deseja fazer?', opcoes);
  };

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Meus anúncios">
        <View style={p.centro}><ActivityIndicator color={c.primario} /></View>
      </Tela>
    );
  }

  return (
    <Tela voltar tituloCabecalho="Meus anúncios" aoAtualizar={carregar}>
      <View style={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.md }}>
        <Botao titulo="Novo anúncio" icone="add" aoTocar={() => router.push('/mercado/novo')} />
      </View>
      {itens.length === 0 ? (
        <Vazio icone="pricetags-outline" titulo="Você ainda não anunciou" descricao="Crie seu primeiro anúncio de acessório." />
      ) : (
        <View style={{ paddingHorizontal: espaco.lg, gap: espaco.md }}>
          {itens.map((a) => {
            const cor = COR_STATUS(c)[a.status];
            return (
              <Pressable key={a.id} style={p.cartao} onPress={() => abrirAcoes(a)}>
                {a.fotos[0] ? (
                  <Image source={{ uri: a.fotos[0] }} style={p.foto} />
                ) : (
                  <View style={[p.foto, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={20} color={c.textoFraco} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={p.titulo} numberOfLines={1}>{a.titulo}</Text>
                  <Text style={p.preco}>{formatarPreco(a.precoCentavos)}</Text>
                  <View style={p.statusLinha}>
                    <View style={[p.bolinha, { backgroundColor: cor }]} />
                    <Text style={[p.status, { color: cor }]}>{ROTULO_STATUS_ANUNCIO[a.status]}</Text>
                    {a.status === 'REJEITADO' ? (
                      <Text style={p.reprovaDica} onPress={() => avisar('Anúncio reprovado', 'Edite e reenvie para nova análise.')}> · ver motivo</Text>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="ellipsis-vertical" size={18} color={c.textoFraco} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cartao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.md,
    },
    foto: { width: 54, height: 54, borderRadius: raio.sm, backgroundColor: c.superficieAlta },
    titulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    preco: { ...tipo.corpoPequeno, color: c.textoMedio, marginTop: 2 },
    statusLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    bolinha: { width: 7, height: 7, borderRadius: 4 },
    status: { ...tipo.legenda, fontWeight: '600' },
    reprovaDica: { ...tipo.legenda, color: c.textoFraco },
  });
