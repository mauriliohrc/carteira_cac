import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Cartao, Secao, Tela, Vazio } from '@/ui/base';
import { avisar, confirmar } from '@/ui/dialogo';
import { BlocoFormulario, Campo } from '@/ui/formulario';
import { atualizarLocal, criarLocal, removerLocal, type EntradaLocal } from '@/db/locais';
import type { LocalTiro } from '@/domain/tipos';

const VAZIO: EntradaLocal = { nome: '', cidade: '', uf: '', cr: '', observacoes: '' };

/**
 * Cadastro dos clubes e estandes.
 *
 * Fica fora do formulário da sessão porque é cadastro de apoio: o atirador
 * frequenta dois ou três locais a vida toda, cadastra uma vez e depois só
 * escolhe. Quem quiser pode cadastrar na hora, digitando o nome direto no
 * seletor de local da sessão.
 */
export default function Locais() {
  const c = useCores();
  const s = useEstilos(folha);
  const { locais, habitualidades, recarregar } = useApp();

  const [form, setForm] = useState<EntradaLocal>(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  /** Quantas sessões cada local já recebeu — ajuda a decidir o que apagar. */
  const usos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const h of habitualidades) {
      if (h.localId) mapa.set(h.localId, (mapa.get(h.localId) ?? 0) + 1);
    }
    return mapa;
  }, [habitualidades]);

  const alterar = <K extends keyof EntradaLocal>(campo: K, valor: EntradaLocal[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErro(null);
  };

  const limpar = () => {
    setForm(VAZIO);
    setEditandoId(null);
    setErro(null);
  };

  const editar = (local: LocalTiro) => {
    setEditandoId(local.id);
    setForm({
      nome: local.nome,
      cidade: local.cidade ?? '',
      uf: local.uf ?? '',
      cr: local.cr ?? '',
      observacoes: local.observacoes ?? '',
    });
  };

  const salvar = async () => {
    const nome = form.nome.trim();
    if (!nome) {
      setErro('Informe o nome do clube ou estande.');
      return;
    }
    const duplicado = locais.find(
      (l) => l.id !== editandoId && l.nome.trim().toLowerCase() === nome.toLowerCase()
    );
    if (duplicado) {
      setErro('Já existe um local com este nome.');
      return;
    }

    setSalvando(true);
    try {
      if (editandoId) await atualizarLocal(editandoId, form);
      else await criarLocal(form);
      await recarregar();
      limpar();
    } catch (e) {
      avisar('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (local: LocalTiro) => {
    const quantas = usos.get(local.id) ?? 0;
    const ok = await confirmar({
      titulo: 'Excluir local',
      mensagem: quantas
        ? `“${local.nome}” sai da lista, mas as ${quantas} habitualidade(s) feitas nele continuam registradas com esse nome.`
        : `“${local.nome}” sai da lista de locais.`,
      rotuloConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    await removerLocal(local.id);
    await recarregar();
    if (editandoId === local.id) limpar();
  };

  return (
    <Tela teclado voltar tituloCabecalho="Locais de tiro">
      <BlocoFormulario titulo={editandoId ? 'Editar local' : 'Novo local'}>
        <Campo
          rotulo="Nome"
          obrigatorio
          valor={form.nome}
          aoMudar={(v) => alterar('nome', v)}
          placeholder="Ex.: Clube de Tiro Alvo Certo"
          erro={erro}
        />
        <View style={s.duasColunas}>
          <View style={{ flex: 2 }}>
            <Campo
              rotulo="Cidade"
              valor={form.cidade ?? ''}
              aoMudar={(v) => alterar('cidade', v)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="UF"
              valor={form.uf ?? ''}
              aoMudar={(v) => alterar('uf', v.replace(/[^a-zA-Z]/g, '').toUpperCase())}
              placeholder="SP"
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>
        <Campo
          rotulo="Nº do CR do clube"
          valor={form.cr ?? ''}
          aoMudar={(v) => alterar('cr', v)}
          placeholder="Como consta no comprovante"
          autoCapitalize="characters"
        />
        <Campo
          rotulo="Observações"
          valor={form.observacoes ?? ''}
          aoMudar={(v) => alterar('observacoes', v)}
          multilinha
          placeholder="Endereço, horários, contato…"
        />

        <Botao
          titulo={editandoId ? 'Salvar alterações' : 'Cadastrar local'}
          icone="checkmark"
          aoTocar={salvar}
          carregando={salvando}
        />
        {editandoId ? (
          <Botao
            titulo="Cancelar edição"
            variante="fantasma"
            aoTocar={limpar}
            estilo={{ marginTop: espaco.sm }}
          />
        ) : null}
      </BlocoFormulario>

      <Secao titulo={`Cadastrados · ${locais.length}`}>
        {!locais.length ? (
          <Vazio
            icone="business-outline"
            titulo="Nenhum local cadastrado"
            descricao="Cadastre os clubes e estandes onde você treina. Depois basta escolher na hora de registrar a habitualidade."
          />
        ) : (
          locais.map((local) => {
            const quantas = usos.get(local.id) ?? 0;
            const emEdicao = editandoId === local.id;
            return (
              <Cartao
                key={local.id}
                plano
                estilo={[s.local, emEdicao ? { borderColor: c.primario } : null]}
              >
                <Pressable
                  onPress={() => editar(local)}
                  style={({ pressed }) => [s.localToque, pressed && { opacity: 0.65 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.localNome} numberOfLines={1}>
                      {local.nome}
                    </Text>
                    <Text style={s.localSub} numberOfLines={1}>
                      {[local.cidade, local.uf].filter(Boolean).join(' / ') || 'Sem cidade'}
                      {quantas ? ` · ${quantas} sessão(ões)` : ''}
                    </Text>
                    {local.cr ? <Text style={s.localCr}>CR {local.cr}</Text> : null}
                  </View>
                  <Ionicons name="create-outline" size={18} color={c.primario} />
                </Pressable>

                <Pressable
                  onPress={() => void excluir(local)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir ${local.nome}`}
                  style={({ pressed }) => [s.lixeira, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="trash-outline" size={17} color={c.perigo} />
                </Pressable>
              </Cartao>
            );
          })
        )}
      </Secao>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    duasColunas: { flexDirection: 'row', gap: espaco.md },

    local: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    localToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    localNome: { ...tipo.subtitulo, fontSize: 14.5, color: c.texto },
    localSub: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
    localCr: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, fontFamily: MONO, marginTop: 3 },
    lixeira: {
      width: 34,
      height: 34,
      borderRadius: raio.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.perigoFraco,
    },
  });
