import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Tela } from '@/ui/base';
import { avisar } from '@/ui/dialogo';
import { BlocoFormulario, Campo, CampoData, SeletorChips, SeletorLista } from '@/ui/formulario';
import { ORGAOS, TIPOS_DOCUMENTO, TIPO_DOC_POR_VALOR } from '@/domain/catalogos';
import { atualizarDocumento, criarDocumento, type EntradaDocumento } from '@/db/documentos';
import { guardarArquivo } from '@/arquivos/cofre';
import { nomeArma } from '@/domain/rotulos';
import { avaliarComCor } from '@/domain/vencimento';
import { diffDias, ehISOValida, hojeISO, isoParaBR, textoPrazo } from '@/lib/data';
import type { Orgao, TipoDocumento } from '@/domain/tipos';

export default function EditorDocumento() {
  const params = useLocalSearchParams<{
    id?: string;
    armaId?: string;
    tipo?: TipoDocumento;
    escopo?: 'PESSOAL' | 'ARMA';
    // Fluxo "escolher arquivo antes": arquivo pendente + campos extraídos do PDF.
    arquivoUri?: string;
    arquivoNome?: string;
    arquivoMime?: string;
    arquivoTamanho?: string;
    campos?: string;
  }>();

  // Campos pré-extraídos de um PDF (só em documento novo).
  const camposExtraidos = useMemo<Record<string, string>>(() => {
    try {
      return params.campos ? JSON.parse(params.campos) : {};
    } catch {
      return {};
    }
  }, [params.campos]);
  const c = useCores();
  const s = useEstilos(folha);
  const { armas, documentos, recarregar } = useApp();

  const existente = useMemo(
    () => documentos.find((d) => d.id === params.id) ?? null,
    [documentos, params.id]
  );
  const editando = !!existente;

  const tipoInicial: TipoDocumento =
    existente?.tipo ??
    params.tipo ??
    (params.armaId ? 'CRAF' : params.escopo === 'PESSOAL' ? 'CR' : 'CRAF');

  const [tipo, setTipo] = useState<TipoDocumento>(tipoInicial);
  const [armaId, setArmaId] = useState<string | null>(
    existente?.armaId ?? params.armaId ?? null
  );
  const [titulo, setTitulo] = useState(existente?.titulo ?? '');
  const [numero, setNumero] = useState(existente?.numero ?? camposExtraidos.numero ?? '');
  const [orgao, setOrgao] = useState<Orgao>(
    existente?.orgao ?? TIPO_DOC_POR_VALOR[tipoInicial].orgaoPadrao
  );
  const [emissao, setEmissao] = useState<string | null>(
    existente?.dataEmissao ?? camposExtraidos.dataEmissao ?? null
  );
  const [validade, setValidade] = useState<string | null>(
    existente?.dataValidade ?? camposExtraidos.dataValidade ?? null
  );
  const [validadeBruta, setValidadeBruta] = useState(
    existente
      ? isoParaBR(existente.dataValidade)
      : camposExtraidos.dataValidade
        ? isoParaBR(camposExtraidos.dataValidade)
        : ''
  );
  const [origem, setOrigem] = useState(existente?.origem ?? camposExtraidos.origem ?? '');
  const [destino, setDestino] = useState(existente?.destino ?? camposExtraidos.destino ?? '');
  const [localManejo, setLocalManejo] = useState(existente?.localManejo ?? '');
  const [observacoes, setObservacoes] = useState(
    existente?.observacoes ?? camposExtraidos.observacoes ?? ''
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const def = TIPO_DOC_POR_VALOR[tipo];
  const ehDeArma = def.escopo === 'ARMA';
  // "Outro" é genérico: pode pertencer a uma arma (quando cadastrado a partir
  // dela) ou ser pessoal (quando cadastrado em "Meus documentos"). É o único
  // tipo genérico que a ficha da arma exibe, então preserva o vínculo.
  const ehDual = tipo === 'OUTRO';
  const vinculavelArma = ehDeArma || (ehDual && !!armaId);
  const ehGuia = tipo === 'GUIA_TRAFEGO';
  const ehManejo = !!def.campos.local;

  // Trocar de tipo reposiciona o órgão emissor e solta o vínculo com a arma
  // quando o documento passa a ser estritamente pessoal. Tipos genéricos
  // (Outro) preservam o contexto: se veio de uma arma, continua da arma.
  const trocarTipo = (novo: TipoDocumento) => {
    setTipo(novo);
    const novoDef = TIPO_DOC_POR_VALOR[novo];
    setOrgao(novoDef.orgaoPadrao);
    if (novoDef.escopo === 'PESSOAL' && novo !== 'OUTRO') setArmaId(null);
    else if (novoDef.escopo === 'ARMA' && !armaId && armas.length === 1) setArmaId(armas[0].id);
  };

  const validar = (): boolean => {
    const novos: Record<string, string> = {};

    if (ehDeArma && !armaId) novos.arma = 'Escolha a qual arma este documento pertence.';

    // A validade é sempre informada pelo usuário — nunca calculada pelo app.
    if (!validadeBruta.trim()) {
      novos.validade = 'Informe a data de validade do documento.';
    } else if (!ehISOValida(validade)) {
      novos.validade = 'Data inválida. Use o formato dd/mm/aaaa.';
    }

    if (emissao && validade && ehISOValida(emissao) && ehISOValida(validade)) {
      if (diffDias(emissao, validade) < 0) {
        novos.validade = 'A validade não pode ser anterior à emissão.';
      }
    }

    if (ehGuia) {
      if (!origem.trim()) novos.origem = 'Informe a origem do trajeto.';
      if (!destino.trim()) novos.destino = 'Informe o destino do trajeto.';
    }

    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const salvar = async () => {
    if (!validar() || !validade) return;
    setSalvando(true);
    const entrada: EntradaDocumento = {
      tipo,
      armaId: ehDeArma || ehDual ? armaId : null,
      titulo,
      numero,
      orgao,
      dataEmissao: emissao,
      dataValidade: validade,
      origem: ehGuia ? origem : null,
      destino: ehGuia ? destino : null,
      localManejo: ehManejo ? localManejo : null,
      observacoes,
    };
    try {
      if (existente) {
        await atualizarDocumento(existente.id, entrada);
        await recarregar();
        router.back();
      } else {
        const novoId = await criarDocumento(entrada);
        // Anexa o arquivo escolhido lá no início do fluxo (se houve).
        if (params.arquivoUri) {
          await guardarArquivo(novoId, {
            uri: params.arquivoUri,
            nome: params.arquivoNome ?? 'documento',
            mime: params.arquivoMime || null,
            tamanho: Number(params.arquivoTamanho) || null,
          });
        }
        await recarregar();
        router.replace({ pathname: '/documento/[id]', params: { id: novoId, novo: '1' } });
      }
    } catch (e) {
      console.error('[CAC Brasil] falha ao salvar documento', e);
      avisar('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const previa = validade && ehISOValida(validade) ? avaliarComCor(validade, c) : null;

  return (
    <Tela teclado voltar tituloCabecalho={editando ? 'Editar documento' : 'Novo documento'}>
        <BlocoFormulario titulo="Tipo de documento">
          <SeletorLista
            rotulo="Documento"
            obrigatorio
            tituloFolha="Tipo de documento"
            itens={TIPOS_DOCUMENTO.map((t) => ({
              valor: t.valor,
              rotulo: t.rotulo,
              detalhe: t.escopo === 'ARMA' ? 'Vinculado a uma arma' : 'Documento do CAC',
            }))}
            selecionado={tipo}
            aoSelecionar={(v) => trocarTipo(v as TipoDocumento)}
          />

          {vinculavelArma ? (
            armas.length ? (
              <SeletorLista
                rotulo="Arma"
                obrigatorio={ehDeArma}
                tituloFolha="A qual arma pertence"
                itens={armas.map((a) => ({
                  valor: a.id,
                  rotulo: nomeArma(a),
                  detalhe: `${a.calibre} · nº ${a.numeroSerie}`,
                }))}
                selecionado={armaId}
                aoSelecionar={setArmaId}
                erro={erros.arma}
              />
            ) : (
              <View style={s.avisoBox}>
                <Ionicons name="information-circle-outline" size={17} color={c.aviso} />
                <Text style={s.avisoTexto}>
                  Cadastre uma arma antes de lançar um {def.curto}.
                </Text>
              </View>
            )
          ) : null}
        </BlocoFormulario>

        <BlocoFormulario titulo="Validade">
          <CampoData
            rotulo="Data de validade"
            obrigatorio
            valorISO={validade}
            aoMudar={(iso, bruto) => {
              setValidade(iso);
              setValidadeBruta(bruto);
              setErros((e) => {
                const c = { ...e };
                delete c.validade;
                return c;
              });
            }}
            erro={erros.validade}
            dica="Copie exatamente a data que consta no documento."
          />
          <CampoData
            rotulo="Data de emissão"
            valorISO={emissao}
            aoMudar={(iso) => setEmissao(iso)}
            dica={def.referenciaPrazo ? `Referência: ${def.referenciaPrazo}` : undefined}
          />

          {previa ? (
            <View style={[s.previa, { borderColor: `${previa.cor}88`, backgroundColor: previa.fundo }]}>
              <Ionicons
                name={previa.dias < 0 ? 'alert-circle' : 'notifications'}
                size={17}
                color={previa.cor}
              />
              <Text style={[s.previaTexto, { color: previa.cor }]}>
                {previa.dias < 0
                  ? `Atenção: este documento ${textoPrazo(previa.dias)}.`
                  : previa.dias <= 30
                    ? `Já está na janela de alerta — você será avisado todo dia até ${isoParaBR(validade)}.`
                    : `Os avisos diários começam em ${isoParaBR(recuar30(validade!))}.`}
              </Text>
            </View>
          ) : null}
        </BlocoFormulario>

        <BlocoFormulario titulo="Dados do documento">
          <Campo
            rotulo={def.campos.numero ?? 'Número'}
            valor={numero}
            aoMudar={setNumero}
            autoCapitalize="characters"
          />
          <SeletorChips
            rotulo="Órgão emissor"
            itens={ORGAOS.map((o) => ({ valor: o.valor, rotulo: o.curto }))}
            selecionado={orgao}
            aoSelecionar={(v) => setOrgao(v as Orgao)}
          />
          <Campo
            rotulo="Identificação (opcional)"
            valor={titulo}
            aoMudar={setTitulo}
            placeholder={
              tipo === 'HABITUALIDADE'
                ? 'Ex.: Semestre 1/2026'
                : 'Como você quer reconhecer este documento'
            }
          />
        </BlocoFormulario>

        {ehGuia ? (
          <BlocoFormulario titulo="Trajeto autorizado">
            <Campo
              rotulo="Origem"
              obrigatorio
              valor={origem}
              aoMudar={setOrigem}
              placeholder="Ex.: Residência — Curitiba/PR"
              erro={erros.origem}
            />
            <Campo
              rotulo="Destino"
              obrigatorio
              valor={destino}
              aoMudar={setDestino}
              placeholder="Ex.: Clube de Tiro Alfa — Pinhais/PR"
              erro={erros.destino}
            />
          </BlocoFormulario>
        ) : null}

        {ehManejo ? (
          <BlocoFormulario titulo="Local do manejo">
            <Campo
              rotulo="Local autorizado"
              valor={localManejo}
              aoMudar={setLocalManejo}
              placeholder="Ex.: Fazenda Santa Clara — Bagé/RS"
              dica="Propriedade, município ou área onde o manejo está autorizado."
            />
          </BlocoFormulario>
        ) : null}

        <BlocoFormulario>
          <Campo
            rotulo="Observações"
            valor={observacoes}
            aoMudar={setObservacoes}
            multilinha
            placeholder="Protocolo de renovação, pendências, anotações…"
          />
        </BlocoFormulario>

        <Text style={s.rodape}>
          Depois de salvar, anexe o PDF ou a foto do documento na tela de detalhes.
        </Text>

        <Botao
          titulo={editando ? 'Salvar alterações' : 'Salvar documento'}
          icone="checkmark"
          aoTocar={salvar}
          carregando={salvando}
          desabilitado={ehDeArma && !armas.length}
          estilo={{ marginTop: espaco.lg }}
        />
    </Tela>
  );
}

function recuar30(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d) - 30 * 86400000);
  const hoje = hojeISO();
  const calculado = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
  return calculado < hoje ? hoje : calculado;
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    avisoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      padding: espaco.md,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.aviso}88`,
      backgroundColor: c.avisoFraco,
    },
    avisoTexto: { flex: 1, ...tipo.legenda, color: c.textoMedio },
    previa: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      padding: espaco.md,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
    },
    previaTexto: { flex: 1, ...tipo.legenda, fontWeight: '600' },
    rodape: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.md, textAlign: 'center' },
  });
