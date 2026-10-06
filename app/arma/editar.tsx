import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Tela } from '@/ui/base';
import { avisar } from '@/ui/dialogo';
import { BlocoFormulario, Campo, SeletorChips, SeletorLista } from '@/ui/formulario';
import {
  ACERVOS,
  CALIBRES,
  ESPECIES,
  FUNCIONAMENTOS,
  GRUPOS,
} from '@/domain/catalogos';
import { atualizarArma, criarArma, type EntradaArma } from '@/db/armas';
import { pedirAvaliacaoUmaVez } from '@/avaliacao';
import { podeCadastrarArma } from '@/billing';
import type { Acervo, Grupo } from '@/domain/tipos';

const VAZIO: EntradaArma = {
  apelido: '',
  marca: '',
  modelo: '',
  numeroSerie: '',
  acervo: 'ATIRADOR',
  grupo: 'CC_RESTRITA',
  calibre: '',
  especie: '',
  funcionamento: '',
  fabricante: '',
  paisOrigem: '',
  anoFabricacao: '',
  numeroCano: '',
  capacidade: '',
  registroNumero: '',
  localGuarda: '',
  observacoes: '',
};

export default function EditorArma() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useCores();
  const s = useEstilos(folha);
  const { armas, premium, recarregar } = useApp();

  const existente = useMemo(() => armas.find((a) => a.id === id) ?? null, [armas, id]);
  const editando = !!existente;

  const [form, setForm] = useState<EntradaArma>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!existente) return;
    const { id: _id, criadoEm, atualizadoEm, ...resto } = existente;
    void _id;
    void criadoEm;
    void atualizadoEm;
    setForm(resto);
  }, [existente]);

  // Trava do plano grátis: só bloqueia cadastro NOVO, nunca edição do que já existe.
  useEffect(() => {
    if (!editando && !podeCadastrarArma(armas.length, premium)) {
      router.replace('/premium');
    }
  }, [armas.length, editando, premium]);

  const alterar = <K extends keyof EntradaArma>(campo: K, valor: EntradaArma[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => {
      if (!atual[campo as string]) return atual;
      const copia = { ...atual };
      delete copia[campo as string];
      return copia;
    });
  };

  const validar = (): boolean => {
    const novos: Record<string, string> = {};
    if (!form.modelo.trim()) novos.modelo = 'Informe o modelo da arma.';
    if (!form.numeroSerie.trim()) novos.numeroSerie = 'Informe o número de série.';
    if (!form.calibre.trim()) novos.calibre = 'Informe o calibre.';

    const duplicada = armas.find(
      (a) =>
        a.id !== existente?.id &&
        a.numeroSerie.trim().toLowerCase() === form.numeroSerie.trim().toLowerCase()
    );
    if (duplicada) novos.numeroSerie = 'Já existe uma arma com este número de série.';

    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const salvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      if (existente) {
        await atualizarArma(existente.id, form);
        await recarregar();
        router.back();
      } else {
        // `armas` é a lista de ANTES desta criação: vazia = esta é a primeira.
        const primeiraArma = armas.length === 0;
        const novoIdArma = await criarArma(form);
        await recarregar();
        router.replace({ pathname: '/arma/[id]', params: { id: novoIdArma, recemCriada: '1' } });
        // Só na primeira arma, e depois de a tela da arma assentar: aí pedimos a
        // avaliação de 5 estrelas — momento em que o usuário tirou valor do app.
        if (primeiraArma) setTimeout(() => void pedirAvaliacaoUmaVez(), 1500);
      }
    } catch (e) {
      console.error('[CAC Brasil] falha ao salvar arma', e);
      avisar(
        'Não foi possível salvar',
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela teclado voltar tituloCabecalho={editando ? 'Editar arma' : 'Nova arma'}>
        <BlocoFormulario titulo="Identificação">
          <Campo
            rotulo="Modelo"
            valor={form.modelo}
            aoMudar={(v) => alterar('modelo', v)}
            placeholder="Ex.: G25 Gen4"
            obrigatorio
            erro={erros.modelo}
          />
          <Campo
            rotulo="Marca / fabricante"
            valor={form.marca ?? ''}
            aoMudar={(v) => alterar('marca', v)}
            placeholder="Ex.: Glock, Taurus, CBC"
          />
          <Campo
            rotulo="Número de série"
            valor={form.numeroSerie}
            aoMudar={(v) => alterar('numeroSerie', v)}
            placeholder="Como consta no CRAF"
            obrigatorio
            autoCapitalize="characters"
            erro={erros.numeroSerie}
          />
          <Campo
            rotulo="Apelido (opcional)"
            valor={form.apelido ?? ''}
            aoMudar={(v) => alterar('apelido', v)}
            placeholder="Como você chama esta arma no dia a dia"
            dica="Aparece no lugar do modelo nas listas e nas notificações."
          />
        </BlocoFormulario>

        <BlocoFormulario titulo="Enquadramento legal">
          <SeletorChips
            rotulo="Acervo"
            obrigatorio
            itens={ACERVOS.map((a) => ({ valor: a.valor, rotulo: a.curto }))}
            selecionado={form.acervo}
            aoSelecionar={(v) => alterar('acervo', v as Acervo)}
            dica={ACERVOS.find((a) => a.valor === form.acervo)?.detalhe}
          />
          <SeletorLista
            rotulo="Grupo"
            obrigatorio
            tituloFolha="Grupo da arma"
            itens={GRUPOS.map((g) => ({ valor: g.valor, rotulo: g.rotulo, detalhe: g.detalhe }))}
            selecionado={form.grupo}
            aoSelecionar={(v) => alterar('grupo', v as Grupo)}
          />
          <SeletorLista
            rotulo="Calibre"
            obrigatorio
            permiteLivre
            tituloFolha="Calibre"
            placeholder="Selecionar ou digitar"
            itens={CALIBRES.map((c) => ({ valor: c, rotulo: c }))}
            selecionado={form.calibre || null}
            aoSelecionar={(v) => alterar('calibre', v)}
            erro={erros.calibre}
            dica="Não achou? Digite na busca e toque em “Usar”."
          />
          <Campo
            rotulo={form.acervo === 'DEFESA_PESSOAL' ? 'Nº de registro SINARM' : 'Nº de registro SIGMA'}
            valor={form.registroNumero ?? ''}
            aoMudar={(v) => alterar('registroNumero', v)}
            placeholder="Número do registro no sistema"
            autoCapitalize="characters"
          />
        </BlocoFormulario>

        <BlocoFormulario titulo="Características (opcional)">
          <SeletorLista
            rotulo="Espécie"
            permiteLivre
            tituloFolha="Espécie"
            itens={ESPECIES.map((e) => ({ valor: e, rotulo: e }))}
            selecionado={form.especie || null}
            aoSelecionar={(v) => alterar('especie', v)}
          />
          <SeletorLista
            rotulo="Funcionamento"
            permiteLivre
            tituloFolha="Funcionamento"
            itens={FUNCIONAMENTOS.map((e) => ({ valor: e, rotulo: e }))}
            selecionado={form.funcionamento || null}
            aoSelecionar={(v) => alterar('funcionamento', v)}
          />
          <View style={s.duasColunas}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Capacidade"
                valor={form.capacidade ?? ''}
                aoMudar={(v) => alterar('capacidade', v)}
                placeholder="Ex.: 15+1"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Ano de fabricação"
                valor={form.anoFabricacao ?? ''}
                aoMudar={(v) => alterar('anoFabricacao', v.replace(/\D/g, ''))}
                placeholder="AAAA"
                teclado="numeric"
                maxLength={4}
              />
            </View>
          </View>
          <View style={s.duasColunas}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Nº do cano"
                valor={form.numeroCano ?? ''}
                aoMudar={(v) => alterar('numeroCano', v)}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="País de origem"
                valor={form.paisOrigem ?? ''}
                aoMudar={(v) => alterar('paisOrigem', v)}
                placeholder="Ex.: Brasil"
              />
            </View>
          </View>
          <Campo
            rotulo="Local de guarda"
            valor={form.localGuarda ?? ''}
            aoMudar={(v) => alterar('localGuarda', v)}
            placeholder="Residência, clube, cofre…"
          />
          <Campo
            rotulo="Observações"
            valor={form.observacoes ?? ''}
            aoMudar={(v) => alterar('observacoes', v)}
            multilinha
            placeholder="Anotações livres sobre esta arma"
          />
        </BlocoFormulario>

        <Text style={s.rodape}>
          Depois de salvar você anexa o CRAF, as guias de tráfego e os demais documentos desta arma.
        </Text>

        <Botao
          titulo={editando ? 'Salvar alterações' : 'Cadastrar arma'}
          icone="checkmark"
          aoTocar={salvar}
          carregando={salvando}
          estilo={{ marginTop: espaco.lg }}
        />
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    duasColunas: { flexDirection: 'row', gap: espaco.md },
    rodape: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.md, textAlign: 'center' },
  });
