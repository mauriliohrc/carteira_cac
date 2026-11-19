import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Secao, Tela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { avisar } from '@/ui/dialogo';
import { useConta } from '@/conta/ContaContext';
import { escolherDocumento, type ArquivoEscolhido } from '@/arquivos/cofre';
import {
  filiar,
  enviarDocumentoFiliacao,
  obterFiliacao,
  type TipoDocIdentificacao,
} from '@/filiacao/api';
import type { Filiacao } from '@/domain/tipos';

const TIPOS_DOC: { tipo: TipoDocIdentificacao; rotulo: string }[] = [
  { tipo: 'CNH', rotulo: 'CNH' },
  { tipo: 'RG', rotulo: 'RG' },
  { tipo: 'RNE', rotulo: 'RNE' },
  { tipo: 'OUTRO', rotulo: 'Outro' },
];

/**
 * Coleta os dados do filiado (nome, endereço, documento de identificação) e
 * dispara a filiação (abre o checkout do Asaas). Quando o usuário já é filiado
 * cortesia (migrado), a tela vira "completar documento".
 */
export default function DadosFiliacao() {
  const c = useCores();
  const s = useEstilos(folha);
  const { usuario, atualizarPerfil } = useConta();

  const [filiacao, setFiliacao] = useState<Filiacao | null>(null);
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [celular, setCelular] = useState(usuario?.celular ?? '');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [docTipo, setDocTipo] = useState<TipoDocIdentificacao>('CNH');
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await obterFiliacao();
      if (r?.filiacao) {
        setFiliacao(r.filiacao);
        const e = r.filiacao.endereco;
        setNome((n) => n || r.filiacao!.nomeCompleto || '');
        setCep((v) => v || e.cep || '');
        setLogradouro((v) => v || e.logradouro || '');
        setNumero((v) => v || e.numero || '');
        setComplemento((v) => v || e.complemento || '');
        setBairro((v) => v || e.bairro || '');
        setCidade((v) => v || e.cidade || '');
        setUf((v) => v || e.uf || '');
        if (r.filiacao.docTipo) setDocTipo(r.filiacao.docTipo as TipoDocIdentificacao);
      }
    })();
  }, []);

  // Já filiado e ativo, faltando só o documento → modo "completar documento".
  const soDocumento = filiacao?.status === 'ativa' && !filiacao?.documentacaoCompleta;

  const anexar = useCallback(async () => {
    const escolhido = await escolherDocumento();
    if (escolhido) setArquivo(escolhido);
  }, []);

  const salvarCelularSePreciso = useCallback(async () => {
    const limpo = celular.replace(/\D/g, '');
    if (limpo && limpo !== (usuario?.celular ?? '')) {
      await atualizarPerfil({ celular: limpo });
    }
  }, [celular, usuario?.celular, atualizarPerfil]);

  const enviarDocumento = useCallback(async () => {
    if (!arquivo) return avisar('Anexe o documento', 'Escolha a foto ou o PDF da sua CNH/RG.');
    setProcessando(true);
    try {
      await enviarDocumentoFiliacao(docTipo, arquivo);
      avisar('Documento enviado', 'Recebemos seu documento. Obrigado!');
      router.back();
    } catch (e) {
      avisar('Não deu para enviar', e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(false);
    }
  }, [arquivo, docTipo]);

  const confirmarFiliacao = useCallback(async () => {
    if (nome.trim().length < 3) return avisar('Informe seu nome', 'Preencha o nome completo.');
    const cel = celular.replace(/\D/g, '');
    if (cel.length < 10) {
      return avisar('Informe seu celular', 'Precisamos do seu celular para a cobrança da liga.');
    }
    setProcessando(true);
    try {
      await salvarCelularSePreciso();
      const { invoiceUrl } = await filiar({
        nomeCompleto: nome.trim(),
        endereco: {
          cep: cep.trim() || null,
          logradouro: logradouro.trim() || null,
          numero: numero.trim() || null,
          complemento: complemento.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf.trim().toUpperCase() || null,
        },
        docTipo,
      });
      // Se o usuário já anexou o documento, sobe em segundo plano.
      if (arquivo) void enviarDocumentoFiliacao(docTipo, arquivo).catch(() => {});
      if (invoiceUrl) {
        router.replace({ pathname: '/filiacao/checkout', params: { url: invoiceUrl } });
      } else {
        avisar('Filiação registrada', 'Acompanhe o status pela sua carteirinha.');
        router.back();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      avisar(
        'Não deu para filiar',
        msg.includes('celular_requerido')
          ? 'Informe seu celular para continuar.'
          : msg.includes('filiacao_indisponivel')
            ? 'A filiação está indisponível no momento. Tente mais tarde.'
            : msg
      );
    } finally {
      setProcessando(false);
    }
  }, [nome, celular, cep, logradouro, numero, complemento, bairro, cidade, uf, docTipo, arquivo, salvarCelularSePreciso]);

  return (
    <Tela voltar tituloCabecalho={soDocumento ? 'Documento' : 'Filiação'} teclado estilo={s.conteudo}>
      {!soDocumento ? (
        <>
          <Secao titulo="Dados do filiado" />
          <Campo rotulo="Nome completo" valor={nome} aoMudar={setNome} obrigatorio autoCapitalize="words" />
          <Campo
            rotulo="Celular"
            valor={celular}
            aoMudar={setCelular}
            obrigatorio
            teclado="numeric"
            placeholder="(DDD) 90000-0000"
          />

          <Secao titulo="Endereço" />
          <Campo rotulo="CEP" valor={cep} aoMudar={setCep} teclado="numeric" />
          <Campo rotulo="Logradouro" valor={logradouro} aoMudar={setLogradouro} />
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Campo rotulo="Número" valor={numero} aoMudar={setNumero} />
            </View>
            <View style={{ flex: 2 }}>
              <Campo rotulo="Complemento" valor={complemento} aoMudar={setComplemento} />
            </View>
          </View>
          <Campo rotulo="Bairro" valor={bairro} aoMudar={setBairro} />
          <View style={s.linha}>
            <View style={{ flex: 3 }}>
              <Campo rotulo="Cidade" valor={cidade} aoMudar={setCidade} />
            </View>
            <View style={{ flex: 1 }}>
              <Campo rotulo="UF" valor={uf} aoMudar={setUf} autoCapitalize="characters" maxLength={2} />
            </View>
          </View>
        </>
      ) : null}

      <Secao titulo="Documento de identificação" />
      <View style={s.tipos}>
        {TIPOS_DOC.map((d) => {
          const ativo = docTipo === d.tipo;
          return (
            <Pressable
              key={d.tipo}
              onPress={() => setDocTipo(d.tipo)}
              style={[s.tipo, ativo ? s.tipoAtivo : null]}
            >
              <Text style={[s.tipoTexto, ativo ? { color: c.primario } : null]}>{d.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={anexar} style={s.anexo}>
        <Ionicons
          name={arquivo ? 'checkmark-circle' : 'cloud-upload-outline'}
          size={20}
          color={arquivo ? c.primario : c.textoMedio}
        />
        <Text style={s.anexoTexto} numberOfLines={1}>
          {arquivo ? arquivo.nome : 'Anexar foto ou PDF do documento'}
        </Text>
      </Pressable>

      <Botao
        titulo={soDocumento ? 'Enviar documento' : 'Filiar-se e pagar'}
        icone={soDocumento ? 'document-attach-outline' : 'card-outline'}
        aoTocar={soDocumento ? enviarDocumento : confirmarFiliacao}
        carregando={processando}
        estilo={{ alignSelf: 'stretch', marginTop: espaco.xl }}
      />
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    conteudo: { paddingHorizontal: espaco.lg },
    linha: { flexDirection: 'row', gap: espaco.md },
    tipos: { flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.md },
    tipo: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.superficie,
      alignItems: 'center',
    },
    tipoAtivo: { borderColor: c.primario, backgroundColor: c.primarioFraco },
    tipoTexto: { ...tipo.corpoPequeno, color: c.textoMedio, fontWeight: '600' },
    anexo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      padding: espaco.lg,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: c.bordaForte,
      backgroundColor: c.superficie,
    },
    anexoTexto: { flex: 1, ...tipo.corpoPequeno, color: c.texto },
  });
