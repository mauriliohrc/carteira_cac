import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Cartao, Etiqueta, Tela, Vazio } from '@/ui/base';
import { avisar, confirmar } from '@/ui/dialogo';
import { BlocoFormulario, Campo, CampoData, SeletorChips, SeletorLista } from '@/ui/formulario';
import { hojeISO, isoParaBR } from '@/lib/data';
import {
  ACERVO_POR_VALOR,
  corDe,
  GRUPO_POR_VALOR,
  TIPOS_SESSAO,
} from '@/domain/catalogos';
import { inicioJanela, MESES_JANELA } from '@/domain/habitualidade';
import { nomeArma } from '@/domain/rotulos';
import {
  atualizarHabitualidade,
  criarHabitualidade,
  removerHabitualidade,
  type EntradaHabitualidade,
} from '@/db/habitualidades';
import { criarLocal } from '@/db/locais';
import type { Arma, Grupo, TipoSessao } from '@/domain/tipos';

/**
 * Registrar uma habitualidade.
 *
 * O fluxo é curto de propósito: data, treino ou competição, onde foi, e quais
 * armas. Os grupos creditados o app deduz das armas marcadas e mostra na hora,
 * antes de salvar — assim o atirador confere o que vai contar sem precisar
 * entender a tabela de grupos.
 */
export default function EditorHabitualidade() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useCores();
  const s = useEstilos(folha);
  const { armas, habitualidades, locais, recarregar } = useApp();

  const existente = useMemo(
    () => habitualidades.find((h) => h.id === id) ?? null,
    [habitualidades, id]
  );
  const editando = !!existente;

  // Estado semeado direto do registro existente, como nos outros editores: o
  // contexto já está carregado quando o modal abre, e o CampoData lê o valor
  // inicial só na montagem.
  const [data, setData] = useState<string | null>(existente?.data ?? hojeISO());
  const [tipo, setTipo] = useState<TipoSessao>(existente?.tipo ?? 'TREINO');
  /** Ou o id de um local cadastrado, ou um nome novo digitado na busca. */
  const [local, setLocal] = useState<string | null>(
    existente?.localId ?? existente?.localNome ?? null
  );
  const [marcadas, setMarcadas] = useState<string[]>(
    () => existente?.armas.map((a) => a.armaId).filter((v): v is string => !!v) ?? []
  );
  const [observacoes, setObservacoes] = useState(existente?.observacoes ?? '');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  // Armas que saíram do acervo: o crédito do grupo continua valendo, então elas
  // seguem na sessão mesmo sem poder ser marcadas de novo.
  const orfas = useMemo(() => existente?.armas.filter((a) => !a.armaId) ?? [], [existente]);

  const selecionadas = useMemo(
    () => armas.filter((a) => marcadas.includes(a.id)),
    [armas, marcadas]
  );

  const gruposCreditados = useMemo<Grupo[]>(
    () => [...new Set([...selecionadas.map((a) => a.grupo), ...orfas.map((a) => a.grupo)])],
    [orfas, selecionadas]
  );

  const foraDaJanela = !!data && data < inicioJanela();

  const alternar = (armaId: string) => {
    setMarcadas((atual) =>
      atual.includes(armaId) ? atual.filter((v) => v !== armaId) : [...atual, armaId]
    );
    setErros((atual) => {
      if (!atual.armas) return atual;
      const copia = { ...atual };
      delete copia.armas;
      return copia;
    });
  };

  const validar = (): boolean => {
    const novos: Record<string, string> = {};
    if (!data) novos.data = 'Informe a data da sessão no formato dd/mm/aaaa.';
    else if (data > hojeISO()) novos.data = 'A sessão não pode estar no futuro.';
    if (!marcadas.length && !orfas.length) {
      novos.armas = 'Marque pelo menos uma arma usada na sessão.';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const salvar = async () => {
    if (!validar() || !data) return;
    setSalvando(true);
    try {
      // O local pode ser um cadastro existente ou um nome digitado agora — neste
      // caso ele é cadastrado, para aparecer pronto na próxima sessão.
      let localId: string | null = null;
      let localNome: string | null = null;
      const escolhido = (local ?? '').trim();
      if (escolhido) {
        const cadastrado = locais.find((l) => l.id === escolhido);
        if (cadastrado) {
          localId = cadastrado.id;
          localNome = cadastrado.nome;
        } else {
          const porNome = locais.find(
            (l) => l.nome.trim().toLowerCase() === escolhido.toLowerCase()
          );
          localId = porNome ? porNome.id : await criarLocal({
            nome: escolhido,
            cidade: null,
            uf: null,
            cr: null,
            observacoes: null,
          });
          localNome = porNome ? porNome.nome : escolhido;
        }
      }

      const entrada: EntradaHabitualidade = {
        data,
        tipo,
        localId,
        localNome,
        observacoes,
        armas: [
          ...selecionadas.map((a) => ({ armaId: a.id, grupo: a.grupo, nome: nomeArma(a) })),
          ...orfas,
        ],
      };

      if (existente) await atualizarHabitualidade(existente.id, entrada);
      else await criarHabitualidade(entrada);
      await recarregar();
      router.back();
    } catch (e) {
      console.error('[CAC Brasil] falha ao salvar habitualidade', e);
      avisar('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!existente) return;
    const ok = await confirmar({
      titulo: 'Excluir habitualidade',
      mensagem: `A sessão de ${isoParaBR(existente.data)} sai da contagem dos grupos. Não dá para desfazer.`,
      rotuloConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    await removerHabitualidade(existente.id);
    await recarregar();
    router.back();
  };

  if (!armas.length) {
    return (
      <Tela voltar tituloCabecalho="Nova habitualidade">
        <Vazio
          icone="locate-outline"
          titulo="Cadastre uma arma primeiro"
          descricao="A habitualidade é registrada com as armas usadas na sessão — é delas que o app tira o grupo creditado."
          acao={
            <Botao
              titulo="Cadastrar arma"
              icone="add"
              aoTocar={() => router.replace('/arma/editar')}
            />
          }
        />
      </Tela>
    );
  }

  return (
    <Tela
      teclado
      voltar
      tituloCabecalho={editando ? 'Editar habitualidade' : 'Nova habitualidade'}
    >
      <BlocoFormulario titulo="A sessão">
        <CampoData
          rotulo="Data"
          obrigatorio
          valorISO={data}
          aoMudar={(iso) => {
            setData(iso);
            setErros((atual) => {
              if (!atual.data) return atual;
              const copia = { ...atual };
              delete copia.data;
              return copia;
            });
          }}
          erro={erros.data}
          dica={
            foraDaJanela
              ? `Fora da janela: sessões com mais de ${MESES_JANELA} meses ficam no histórico, mas não contam hoje.`
              : 'Como consta no comprovante emitido pelo clube.'
          }
        />

        <SeletorChips
          rotulo="Tipo"
          obrigatorio
          itens={TIPOS_SESSAO.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))}
          selecionado={tipo}
          aoSelecionar={(v) => setTipo(v as TipoSessao)}
          dica={TIPOS_SESSAO.find((t) => t.valor === tipo)?.detalhe}
        />

        <SeletorLista
          rotulo="Local"
          permiteLivre
          tituloFolha="Clube / estande"
          placeholder="Selecionar ou cadastrar"
          itens={locais.map((l) => ({
            valor: l.id,
            rotulo: l.nome,
            detalhe: [l.cidade, l.uf].filter(Boolean).join(' / ') || undefined,
          }))}
          selecionado={local}
          aoSelecionar={setLocal}
          dica="Não achou? Digite o nome na busca e toque em “Usar” — ele fica cadastrado."
        />
        <Pressable
          onPress={() => router.push('/habitualidade/locais')}
          style={({ pressed }) => [s.atalhoLocais, pressed && { opacity: 0.65 }]}
        >
          <Ionicons name="business-outline" size={15} color={c.primario} />
          <Text style={s.atalhoLocaisTexto}>Gerenciar locais de tiro</Text>
          <Ionicons name="chevron-forward" size={14} color={c.primario} />
        </Pressable>
      </BlocoFormulario>

      <BlocoFormulario titulo="Armas usadas">
        {erros.armas ? <Text style={s.erro}>{erros.armas}</Text> : null}

        {armas.map((arma) => (
          <ItemArma
            key={arma.id}
            arma={arma}
            marcada={marcadas.includes(arma.id)}
            aoTocar={() => alternar(arma.id)}
          />
        ))}

        {orfas.length ? (
          <Text style={s.nota}>
            Esta sessão também tem {orfas.length} arma(s) que saiu(ram) do acervo (
            {orfas.map((a) => a.nome).join(', ')}). O crédito do grupo continua valendo.
          </Text>
        ) : null}

        <Cartao plano estilo={s.credito}>
          <Text style={s.creditoRotulo}>ESTA SESSÃO CREDITA</Text>
          {gruposCreditados.length ? (
            <View style={s.creditoEtiquetas}>
              {gruposCreditados.map((g) => (
                <Etiqueta
                  key={g}
                  texto={GRUPO_POR_VALOR[g]?.curto ?? g}
                  cor={c.primario}
                  fundo={c.primarioFraco}
                  icone="checkmark"
                />
              ))}
            </View>
          ) : (
            <Text style={s.creditoVazio}>
              Nenhum grupo ainda — marque as armas que você usou.
            </Text>
          )}
          <Text style={s.creditoNota}>
            Uma habitualidade por grupo, por sessão. Duas armas do mesmo grupo não valem duas.
          </Text>
        </Cartao>
      </BlocoFormulario>

      <BlocoFormulario titulo="Observações (opcional)">
        <Campo
          rotulo="Anotações"
          valor={observacoes}
          aoMudar={setObservacoes}
          multilinha
          placeholder="Nº do comprovante, quantidade de tiros, prova disputada…"
        />
      </BlocoFormulario>

      <Botao
        titulo={editando ? 'Salvar alterações' : 'Registrar habitualidade'}
        icone="checkmark"
        aoTocar={salvar}
        carregando={salvando}
      />

      {editando ? (
        <Botao
          titulo="Excluir habitualidade"
          icone="trash-outline"
          variante="perigo"
          aoTocar={excluir}
          estilo={{ marginTop: espaco.md }}
        />
      ) : null}
    </Tela>
  );
}

function ItemArma({
  arma,
  marcada,
  aoTocar,
}: {
  arma: Arma;
  marcada: boolean;
  aoTocar: () => void;
}) {
  const c = useCores();
  const s = useEstilos(folha);
  const acervo = ACERVO_POR_VALOR[arma.acervo];
  const corAcervo = corDe(acervo?.cor, c);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      onPress={aoTocar}
      style={({ pressed }) => [
        s.item,
        marcada ? { borderColor: c.primario, backgroundColor: c.primarioFraco } : null,
        pressed ? { opacity: 0.65 } : null,
      ]}
    >
      <Ionicons
        name={marcada ? 'checkbox' : 'square-outline'}
        size={20}
        color={marcada ? c.primario : c.textoFraco}
      />
      <View style={{ flex: 1 }}>
        <Text style={s.itemNome} numberOfLines={1}>
          {nomeArma(arma)}
        </Text>
        <View style={s.itemEtiquetas}>
          <Etiqueta texto={GRUPO_POR_VALOR[arma.grupo]?.curto ?? arma.grupo} />
          <Etiqueta
            texto={acervo?.curto ?? arma.acervo}
            cor={corAcervo}
            fundo={`${corAcervo}1A`}
          />
        </View>
      </View>
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    atalhoLocais: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      paddingVertical: espaco.sm,
    },
    atalhoLocaisTexto: { flex: 1, fontSize: 12.5, fontWeight: '600', color: c.primario },

    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      borderRadius: raio.sm,
      borderWidth: 1,
      borderColor: c.borda,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.superficie,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    itemNome: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    itemEtiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },

    credito: { marginTop: espaco.sm, backgroundColor: c.primarioFraco, borderColor: `${c.primario}44` },
    creditoRotulo: { ...tipo.etiqueta, color: c.textoMedio },
    creditoEtiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espaco.md },
    creditoVazio: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.md },
    creditoNota: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, marginTop: espaco.md },

    erro: { ...tipo.legenda, color: c.perigo, marginBottom: espaco.md },
    nota: { ...tipo.legenda, color: c.textoFraco, marginBottom: espaco.sm },
  });
