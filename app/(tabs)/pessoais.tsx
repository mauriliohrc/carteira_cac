import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Secao, Tela, TituloTela, Vazio } from '@/ui/base';
import { CartaoDocumento } from '@/ui/cartoes';
import { AnalisandoDocumento } from '@/ui/AnalisandoDocumento';
import { useNovoDocumento } from '@/ui/useNovoDocumento';
import { TIPOS_DOCUMENTO } from '@/domain/catalogos';
import type { TipoDocumento } from '@/domain/tipos';

/** Documentos do CAC (não da arma), na ordem em que a PF/EB costuma exigir. */
const ORDEM: TipoDocumento[] = [
  'CR',
  'LAUDO_PSICOLOGICO',
  'LAUDO_CAPACIDADE_TECNICA',
  'FILIACAO_CLUBE',
  'HABITUALIDADE',
  'AUTORIZACAO_MANEJO',
  'AUTORIZACAO_IBAMA',
  'CERTIDAO',
  'OUTRO',
];

/**
 * Tipos que não entram em "Ainda não cadastrados": ou são genéricos
 * (Outro/Certidão), ou valem só para quem caça (Manejo/IBAMA) e virariam
 * sugestão sem sentido para a maioria, que é atirador.
 */
const SEM_SUGESTAO: TipoDocumento[] = [
  'OUTRO',
  'CERTIDAO',
  'AUTORIZACAO_MANEJO',
  'AUTORIZACAO_IBAMA',
];

export default function Pessoais() {
  const c = useCores();
  const m = useEstilos(folha);
  const { documentosPessoais } = useApp();

  const porTipo = useMemo(() => {
    const mapa = new Map<TipoDocumento, typeof documentosPessoais>();
    for (const doc of documentosPessoais) {
      const lista = mapa.get(doc.tipo);
      if (lista) lista.push(doc);
      else mapa.set(doc.tipo, [doc]);
    }
    return mapa;
  }, [documentosPessoais]);

  const { iniciar, analisando } = useNovoDocumento();
  const faltando = ORDEM.filter((t) => !SEM_SUGESTAO.includes(t) && !porTipo.has(t));
  const novo = (tipo?: TipoDocumento) => void iniciar({ escopo: 'PESSOAL', tipo });

  return (
    <Tela sobBarra>
      <View style={m.topo}>
        <View style={{ flex: 1 }}>
          <TituloTela titulo="Meus documentos" sub="Documentos do CAC, não vinculados a uma arma" />
        </View>
        <Pressable
          onPress={() => novo()}
          style={({ pressed }) => [m.botaoMais, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="add" size={21} color={c.sobrePrimario} />
        </Pressable>
      </View>

      {!documentosPessoais.length ? (
        <Vazio
          icone="person-outline"
          titulo="Nenhum documento pessoal"
          descricao="Guarde aqui o CR, o laudo de aptidão psicológica, o laudo de capacidade técnica, filiação ao clube e comprovantes de habitualidade."
          acao={<Botao titulo="Adicionar documento" icone="add" aoTocar={() => novo()} />}
        />
      ) : (
        <>
          {ORDEM.map((t) => {
            const lista = porTipo.get(t);
            if (!lista?.length) return null;
            const def = TIPOS_DOCUMENTO.find((d) => d.valor === t);
            return (
              <Secao key={t} titulo={def?.curto ?? t}>
                {lista
                  .slice()
                  .sort((a, b) => a.dataValidade.localeCompare(b.dataValidade))
                  .map((doc) => (
                    <CartaoDocumento
                      key={doc.id}
                      documento={doc}
                      mostrarArma={false}
                      aoTocar={() =>
                        router.push({ pathname: '/documento/[id]', params: { id: doc.id } })
                      }
                    />
                  ))}
              </Secao>
            );
          })}

          {faltando.length ? (
            <Secao titulo="Ainda não cadastrados">
              {faltando.map((t) => {
                const def = TIPOS_DOCUMENTO.find((d) => d.valor === t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => novo(t)}
                    style={({ pressed }) => [m.sugestao, pressed && { opacity: 0.65 }]}
                  >
                    <Ionicons name="add" size={16} color={c.textoFraco} />
                    <Text style={m.sugestaoTexto}>{def?.rotulo ?? t}</Text>
                    <Ionicons name="chevron-forward" size={15} color={c.textoFraco} />
                  </Pressable>
                );
              })}
            </Secao>
          ) : null}
        </>
      )}

      <AnalisandoDocumento visivel={analisando} />
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    botaoMais: {
      width: 42,
      height: 42,
      borderRadius: raio.sm,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sugestao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.md,
      paddingHorizontal: espaco.md,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderStyle: 'dashed',
      marginBottom: espaco.sm,
    },
    sugestaoTexto: { flex: 1, ...tipo.corpoPequeno, color: c.textoMedio },
  });
