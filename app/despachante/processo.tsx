import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Carregando, Secao, Tela, TituloTela, Vazio } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { avisar } from '@/ui/dialogo';
import { escolherPdfOuImagem } from '@/arquivos/cofre';
import {
  baixarArquivoProcesso,
  enviarArquivoCampo,
  enviarCampo,
  listarPedidos,
  type CampoDespachante,
  type ProcessoDetalhe,
  type ValorCampoProcesso,
} from '@/despachante/api';
import { reais } from '@/despachante/formato';

export default function ProcessoDocumentos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useCores();
  const p = useEstilos(folha);
  const [proc, setProc] = useState<ProcessoDetalhe | null | undefined>(undefined);

  const carregar = useCallback(async () => {
    try {
      const todos = await listarPedidos();
      setProc(todos.find((x) => x.id === id) ?? null);
    } catch {
      setProc((v) => (v === undefined ? null : v));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  if (proc === undefined) return <Tela voltar tituloCabecalho="Processo"><Carregando /></Tela>;
  if (proc === null)
    return (
      <Tela voltar tituloCabecalho="Processo">
        <Vazio icone="alert-circle-outline" titulo="Processo não encontrado" descricao="Tente voltar e abrir novamente." />
      </Tela>
    );

  const cor = proc.statusCor || c.textoFraco;
  const valorPorCampo = new Map(proc.valores.filter((v) => v.campoId).map((v) => [v.campoId!, v]));
  const finais = proc.valores.filter((v) => v.final);
  const prog = proc.progresso;

  async function baixar(v: ValorCampoProcesso) {
    try {
      const uri = await baixarArquivoProcesso(proc!.id, v.id, v.nome ?? 'documento');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else await avisar('Baixado', 'Documento salvo no aparelho.');
    } catch {
      await avisar('Não foi possível baixar', 'Tente novamente em instantes.');
    }
  }

  return (
    <Tela voltar tituloCabecalho={proc.servicoNome} aoAtualizar={carregar}>
      <TituloTela titulo={proc.servicoNome} sub={proc.armaNome ?? undefined} />

      <View style={p.cabeca}>
        <View style={[p.chip, { backgroundColor: `${cor}22`, borderColor: `${cor}66` }]}>
          <Text style={[p.chipTexto, { color: cor }]}>{proc.statusLabel}</Text>
        </View>
        <Text style={p.valor}>{reais(proc.valorCentavos)}</Text>
      </View>

      {prog && prog.totalObrigatorios > 0 ? (
        <View style={{ marginBottom: espaco.md }}>
          <View style={p.progFundo}>
            <View
              style={[
                p.progBarra,
                {
                  width: `${(prog.preenchidosObrigatorios / prog.totalObrigatorios) * 100}%`,
                  backgroundColor: prog.completo ? c.primario : c.latao,
                },
              ]}
            />
          </View>
          <Text style={p.progTexto}>
            {prog.completo
              ? 'Tudo certo! Documentação completa — já estamos trabalhando no seu processo.'
              : `Faltam ${prog.totalObrigatorios - prog.preenchidosObrigatorios} de ${prog.totalObrigatorios} item(ns).`}
          </Text>
        </View>
      ) : null}

      {proc.campos.length ? (
        <Secao titulo="Documentos e informações">
          <View style={{ gap: espaco.md }}>
            {proc.campos.map((campo) => (
              <CampoItem
                key={campo.id}
                processoId={proc.id}
                campo={campo}
                valor={valorPorCampo.get(campo.id)}
                aoSalvar={carregar}
              />
            ))}
          </View>
        </Secao>
      ) : (
        <Text style={p.semCampos}>Este serviço não exige o envio de documentos pelo app.</Text>
      )}

      {finais.length ? (
        <Secao titulo="Documentos finais">
          <View style={{ gap: espaco.sm }}>
            {finais.map((v) => (
              <View key={v.id} style={p.finalLinha}>
                <Text style={p.finalNome}>{v.nome ?? 'Documento'}</Text>
                <Botao titulo="Baixar" icone="download-outline" variante="fantasma" compacto aoTocar={() => void baixar(v)} />
              </View>
            ))}
          </View>
        </Secao>
      ) : null}
    </Tela>
  );
}

function CampoItem({
  processoId,
  campo,
  valor,
  aoSalvar,
}: {
  processoId: string;
  campo: CampoDespachante;
  valor?: ValorCampoProcesso;
  aoSalvar: () => void;
}) {
  const c = useCores();
  const p = useEstilos(folha);
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState(valor?.valorTexto ?? '');
  const [cpf, setCpf] = useState(valor?.valorCpf ?? '');
  const [senha, setSenha] = useState('');
  const [check, setCheck] = useState(valor?.valorTexto === 'true');

  const preenchido = valor?.preenchido ?? false;
  const rejeitado = valor?.status === 'REJEITADO';

  async function anexar() {
    const arq = await escolherPdfOuImagem();
    if (!arq) return;
    setOcupado(true);
    try {
      await enviarArquivoCampo(processoId, campo.id, { uri: arq.uri, nome: arq.nome, mime: arq.mime });
      aoSalvar();
    } catch {
      await avisar('Não foi possível enviar', 'Tente novamente em instantes.');
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(corpo: { valorTexto?: string | null; valorCpf?: string | null; checkbox?: boolean }) {
    setOcupado(true);
    try {
      await enviarCampo(processoId, campo.id, corpo);
      aoSalvar();
    } catch {
      await avisar('Não foi possível salvar', 'Tente novamente em instantes.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View style={p.campoCard}>
      <View style={p.campoTopo}>
        <Text style={p.campoNome}>
          {campo.nome}
          {campo.obrigatorio ? <Text style={{ color: c.latao }}> *</Text> : null}
        </Text>
        {preenchido ? (
          <Text style={[p.selo, { color: valor?.status === 'APROVADO' ? c.primario : c.textoMedio }]}>
            {valor?.status === 'APROVADO' ? 'Aprovado ✓' : 'Enviado'}
          </Text>
        ) : null}
      </View>
      {campo.descricao ? <Text style={p.campoDesc}>{campo.descricao}</Text> : null}
      {rejeitado ? (
        <Text style={p.rejeitado}>Rejeitado{valor?.motivo ? `: ${valor.motivo}` : ''}. Envie novamente.</Text>
      ) : null}

      {campo.tipo === 'ARQUIVO' ? (
        <View style={{ marginTop: espaco.sm }}>
          {valor?.temArquivo ? <Text style={p.arquivoNome}>{valor.nome}</Text> : null}
          <Botao
            titulo={valor?.temArquivo ? 'Trocar documento' : 'Anexar documento'}
            icone="cloud-upload-outline"
            variante={valor?.temArquivo ? 'fantasma' : 'primario'}
            compacto
            carregando={ocupado}
            aoTocar={() => void anexar()}
          />
        </View>
      ) : campo.tipo === 'CHECKBOX' ? (
        <View style={p.checkLinha}>
          <Switch
            value={check}
            onValueChange={(v) => {
              setCheck(v);
              void salvar({ checkbox: v });
            }}
            disabled={ocupado}
          />
          <Text style={p.checkTexto}>{check ? 'Confirmado' : 'Toque para confirmar'}</Text>
        </View>
      ) : campo.tipo === 'SENHA_GOV' ? (
        <View style={{ marginTop: espaco.sm, gap: espaco.sm }}>
          <Campo rotulo="CPF" valor={cpf} aoMudar={setCpf} teclado="numeric" placeholder="Somente números" />
          <Campo rotulo="Senha do gov.br" valor={senha} aoMudar={setSenha} segredo placeholder={preenchido ? '•••••• (já enviada)' : 'Sua senha do gov.br'} />
          <Botao titulo="Salvar" icone="save-outline" compacto carregando={ocupado} aoTocar={() => void salvar({ valorCpf: cpf, valorTexto: senha })} />
          <Text style={p.aviso}>Usamos sua senha apenas para dar andamento ao processo em seu nome.</Text>
        </View>
      ) : (
        <View style={{ marginTop: espaco.sm, gap: espaco.sm }}>
          <Campo rotulo="" valor={texto} aoMudar={setTexto} placeholder="Digite aqui" multilinha />
          <Botao titulo="Salvar" icone="save-outline" compacto carregando={ocupado} aoTocar={() => void salvar({ valorTexto: texto })} />
        </View>
      )}
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    cabeca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: espaco.md },
    chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    chipTexto: { ...tipo.etiqueta, fontSize: 11 },
    valor: { ...tipo.corpo, fontWeight: '700', color: c.texto },
    progFundo: { height: 8, borderRadius: 4, backgroundColor: c.borda, overflow: 'hidden' },
    progBarra: { height: '100%', borderRadius: 4 },
    progTexto: { ...tipo.legenda, color: c.textoMedio, marginTop: 6 },
    semCampos: { ...tipo.corpo, color: c.textoMedio },
    campoCard: {
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.md,
    },
    campoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.sm },
    campoNome: { ...tipo.corpo, fontWeight: '700', color: c.texto, flex: 1 },
    selo: { ...tipo.etiqueta, fontSize: 11 },
    campoDesc: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
    rejeitado: { ...tipo.legenda, color: c.latao, marginTop: 4 },
    arquivoNome: { ...tipo.legenda, color: c.textoMedio, marginBottom: 6 },
    checkLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, marginTop: espaco.sm },
    checkTexto: { ...tipo.corpo, color: c.texto },
    aviso: { ...tipo.legenda, color: c.textoFraco },
    finalLinha: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: espaco.sm,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.md,
    },
    finalNome: { ...tipo.corpo, color: c.texto, flex: 1 },
  });
