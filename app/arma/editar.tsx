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
  TIPO_DOC_POR_VALOR,
} from '@/domain/catalogos';
import { atualizarArma, criarArma, type EntradaArma } from '@/db/armas';
import { criarDocumento } from '@/db/documentos';
import { guardarArquivo, type ArquivoEscolhido } from '@/arquivos/cofre';
import { pedirAvaliacaoUmaVez } from '@/avaliacao';
import { podeCadastrarArma } from '@/billing';
import type { CamposExtraidos } from '@/integracoes/extracao';
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
  const params = useLocalSearchParams<{
    id?: string;
    campos?: string;
    crafUri?: string;
    crafNome?: string;
    crafMime?: string;
    crafTamanho?: string;
  }>();
  const { id } = params;
  const c = useCores();
  const s = useEstilos(folha);
  const { armas, premium, recarregar } = useApp();

  const existente = useMemo(() => armas.find((a) => a.id === id) ?? null, [armas, id]);
  const editando = !!existente;

  const [form, setForm] = useState<EntradaArma>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  // Campos que a IA leu do CRAF e o arquivo pendente a anexar ao salvar.
  const camposIa = useMemo<CamposExtraidos>(() => {
    if (!params.campos) return {};
    try {
      return JSON.parse(params.campos) as CamposExtraidos;
    } catch {
      return {};
    }
  }, [params.campos]);
  const crafPendente: ArquivoEscolhido | null = params.crafUri
    ? {
        uri: params.crafUri,
        nome: params.crafNome ?? 'CRAF',
        mime: params.crafMime ?? null,
        tamanho: params.crafTamanho ? Number(params.crafTamanho) : null,
      }
    : null;

  // Edição: carrega a arma existente no formulário.
  useEffect(() => {
    if (!existente) return;
    const { id: _id, criadoEm, atualizadoEm, ...resto } = existente;
    void _id;
    void criadoEm;
    void atualizadoEm;
    setForm(resto);
  }, [existente]);

  // Cadastro novo via CRAF: pré-preenche com o que a IA leu (o usuário revisa).
  useEffect(() => {
    if (existente || !params.campos) return;
    setForm((f) => ({
      ...f,
      modelo: camposIa.modelo ?? f.modelo,
      marca: camposIa.marca ?? f.marca,
      numeroSerie: camposIa.numeroSerie ?? f.numeroSerie,
      calibre: camposIa.calibre ?? f.calibre,
      especie: camposIa.especie ?? f.especie,
      fabricante: camposIa.fabricante ?? f.fabricante,
      paisOrigem: camposIa.paisOrigem ?? f.paisOrigem,
      anoFabricacao: camposIa.anoFabricacao ?? f.anoFabricacao,
      registroNumero: camposIa.numero ?? f.registroNumero,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente, params.campos]);

  // Trava do plano grátis: só bloqueia cadastro NOVO, nunca edição do que já existe.
  useEffect(() => {
    if (!editando && !podeCadastrarArma(armas.length, premium)) {
      router.replace('/premium');
    }
  }, [armas.length, editando, premium]);

  const alterar = <K extends keyof EntradaArma>(campo: K, valor: EntradaArma[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  // Sem campos obrigatórios nem únicos: vale o que o usuário informar; o resto
  // fica em branco e pode ser completado depois.
  const salvar = async () => {
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
        // Fluxo "CRAF primeiro": anexa o CRAF lido à arma recém-criada.
        if (crafPendente) {
          try {
            const docId = await criarDocumento({
              tipo: 'CRAF',
              armaId: novoIdArma,
              titulo: null,
              numero: camposIa.numero ?? null,
              orgao: TIPO_DOC_POR_VALOR.CRAF.orgaoPadrao,
              dataEmissao: camposIa.dataEmissao ?? null,
              dataValidade: camposIa.dataValidade ?? '',
              origem: null,
              destino: null,
              localManejo: null,
              observacoes: null,
            });
            await guardarArquivo(docId, crafPendente);
          } catch {
            /* anexo é best-effort; a arma já foi salva */
          }
        }
        await recarregar();
        router.replace({ pathname: '/arma/[id]', params: { id: novoIdArma, recemCriada: '1' } });
        // Só na primeira arma, e depois de a tela da arma assentar: aí pedimos a
        // avaliação de 5 estrelas — momento em que o usuário tirou valor do app.
        if (primeiraArma) setTimeout(() => void pedirAvaliacaoUmaVez(), 1500);
      }
    } catch (e) {
      console.error('[CAC Brasil] falha ao salvar arma', e);
      avisar('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela teclado voltar tituloCabecalho={editando ? 'Editar arma' : 'Nova arma'}>
        {params.campos ? (
          <View style={s.avisoIa}>
            <Text style={s.avisoIaTxt}>
              ✨ Preenchemos com o que a IA leu do CRAF. Confira e ajuste o que precisar antes de salvar.
            </Text>
          </View>
        ) : null}

        <BlocoFormulario titulo="Identificação">
          <Campo
            rotulo="Modelo"
            valor={form.modelo}
            aoMudar={(v) => alterar('modelo', v)}
            placeholder="Ex.: G25 Gen4"
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
            autoCapitalize="characters"
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
            itens={ACERVOS.map((a) => ({ valor: a.valor, rotulo: a.curto }))}
            selecionado={form.acervo}
            aoSelecionar={(v) => alterar('acervo', v as Acervo)}
            dica={ACERVOS.find((a) => a.valor === form.acervo)?.detalhe}
          />
          <SeletorLista
            rotulo="Grupo"
            tituloFolha="Grupo da arma"
            itens={GRUPOS.map((g) => ({ valor: g.valor, rotulo: g.rotulo, detalhe: g.detalhe }))}
            selecionado={form.grupo}
            aoSelecionar={(v) => alterar('grupo', v as Grupo)}
          />
          <SeletorLista
            rotulo="Calibre"
            permiteLivre
            tituloFolha="Calibre"
            placeholder="Selecionar ou digitar"
            itens={CALIBRES.map((c) => ({ valor: c, rotulo: c }))}
            selecionado={form.calibre || null}
            aoSelecionar={(v) => alterar('calibre', v)}
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
          {crafPendente
            ? 'O CRAF que você enviou será anexado a esta arma ao salvar. As guias de tráfego você adiciona em seguida.'
            : 'Nenhum campo é obrigatório. Depois de salvar você anexa o CRAF, as guias de tráfego e os demais documentos.'}
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
    avisoIa: {
      backgroundColor: c.primarioFraco,
      borderRadius: 10,
      padding: espaco.md,
      marginBottom: espaco.md,
    },
    avisoIaTxt: { ...tipo.corpoPequeno, color: c.primario },
  });
