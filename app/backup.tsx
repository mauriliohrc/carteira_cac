import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Carregando, Cartao, Secao, Tela } from '@/ui/base';
import { avisar, confirmar } from '@/ui/dialogo';
import {
  escolherBackup,
  gerarBackup,
  compartilharBackup,
  restaurarBackup,
  SenhaIncorreta,
  ArquivoInvalido,
  type ResumoBackup,
} from '@/backup';
import type { Envelope } from '@/backup/formato';

const MIN_SENHA = 6;

/**
 * Cede um quadro à interface antes de um trabalho síncrono pesado. Sem isto o
 * `setState` do véu de progresso não chega a pintar: a criptografia do backup
 * segura a thread de JS antes de o React renderizar o indicador.
 */
const cederQuadro = () => new Promise<void>((r) => setTimeout(r, 60));

/**
 * Espera a saída da tela de loading antes de abrir a folha de compartilhamento.
 * Apresentar a folha nativa no mesmo quadro da troca de tela conflita no iOS — a
 * folha simplesmente não abre. Cobre a animação de saída.
 */
const esperarVeuFechar = () => new Promise<void>((r) => setTimeout(r, 350));

/**
 * Segura o retorno até a tela de loading ter ficado visível ao menos
 * `MIN_LOADING_MS` — sem isto, restaurar um backup pequeno termina num piscar e
 * o usuário não chega a ver o indicador, achando que o toque não fez nada.
 */
const MIN_LOADING_MS = 700;
const garantirMinimo = (inicio: number) => {
  const resta = MIN_LOADING_MS - (Date.now() - inicio);
  return resta > 0 ? new Promise<void>((r) => setTimeout(r, resta)) : Promise.resolve();
};

export default function Backup() {
  const c = useCores();
  const b = useEstilos(folha);
  const { recarregar, armas, documentos, habitualidades } = useApp();

  const totalAnexos = documentos.reduce((n, d) => n + d.arquivos.length, 0);

  // --- exportar
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [exportando, setExportando] = useState(false);

  const podeExportar = senha.length >= MIN_SENHA && senha === senha2;

  const exportar = async () => {
    if (!podeExportar) return;
    setExportando(true);
    const inicio = Date.now();
    try {
      await cederQuadro(); // deixa a tela de loading pintar antes de cifrar
      const caminho = await gerarBackup(senha);
      // Baixa a tela de loading ANTES de abrir a folha de compartilhamento:
      // apresentar a folha nativa no mesmo quadro da troca de tela dá conflito
      // de apresentação no iOS.
      await garantirMinimo(inicio);
      setExportando(false);
      await esperarVeuFechar();
      await compartilharBackup(caminho);
      setSenha('');
      setSenha2('');
    } catch (e) {
      avisar('Não deu para exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  };

  // --- restaurar
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [senhaR, setSenhaR] = useState('');
  const [restaurando, setRestaurando] = useState(false);

  const escolher = async () => {
    try {
      const env = await escolherBackup();
      if (env) {
        setEnvelope(env);
        setSenhaR('');
      }
    } catch (e) {
      avisar(
        'Arquivo inválido',
        e instanceof ArquivoInvalido ? e.message : e instanceof Error ? e.message : String(e)
      );
    }
  };

  const restaurar = async () => {
    if (!envelope || senhaR.length === 0) return;
    const ok = await confirmar({
      titulo: 'Substituir o acervo atual?',
      mensagem:
        'A restauração apaga as armas, documentos, anexos e habitualidades que estão hoje neste aparelho e coloca os do backup no lugar. Não dá para desfazer.',
      rotuloConfirmar: 'Restaurar',
      destrutivo: true,
    });
    if (!ok) return;

    setRestaurando(true); // troca a tela inteira pela de loading (ver render)
    const inicio = Date.now();

    let resumo: ResumoBackup | null = null;
    let erro: unknown = null;
    try {
      await cederQuadro(); // deixa a tela de loading pintar antes de decifrar
      resumo = await restaurarBackup(envelope, senhaR);
      await recarregar();
      setEnvelope(null);
      setSenhaR('');
    } catch (e) {
      erro = e;
    } finally {
      await garantirMinimo(inicio); // loading visível o suficiente para ser percebido
      setRestaurando(false);
    }

    // Deixa a tela de loading sair antes de abrir o aviso (Modal) e navegar —
    // senão o aviso é apresentado no mesmo quadro da troca de tela e some sem o
    // usuário ver, e ele fica sem saber se a restauração deu certo.
    await esperarVeuFechar();
    if (erro) {
      await avisar(
        erro instanceof SenhaIncorreta ? 'Senha incorreta' : 'Não deu para restaurar',
        erro instanceof Error ? erro.message : String(erro)
      );
      return;
    }
    await avisar(
      'Backup restaurado',
      `${resumo!.armas} arma(s), ${resumo!.documentos} documento(s), ${resumo!.arquivos} anexo(s) e ${resumo!.habitualidades} habitualidade(s) voltaram para o aparelho.`
    );
    router.back();
  };

  // Loading em tela cheia, não em Modal. O véu em Modal era engolido pelo iOS
  // quando aberto logo após a folha de confirmação (dois Modais em sequência) —
  // e esta tela já é uma rota apresentada como modal, o que agravava o conflito.
  // Trocar o conteúdo da rota por uma tela de progresso não disputa apresentação
  // com nada, então o loading sempre aparece.
  if (restaurando) return <Carregando texto="Restaurando seu acervo…" />;
  if (exportando) return <Carregando texto="Gerando seu backup…" />;

  return (
    <Tela voltar tituloCabecalho="Backup" teclado>
      <View style={b.intro}>
        <View style={b.emblema}>
          <Ionicons name="shield-checkmark-outline" size={24} color={c.primario} />
        </View>
        <Text style={b.titulo}>Backup e restauração</Text>
        <Text style={b.subtitulo}>
          Gera um arquivo único com todo o seu acervo — armas, documentos, anexos e habitualidades
          — protegido por senha (AES-256). Salve no iCloud Drive, no Google Drive ou onde preferir.
        </Text>
      </View>

      <Secao titulo="Exportar">
        <Cartao>
          <Text style={b.linhaResumo}>
            {armas.length} arma(s) · {documentos.length} documento(s) · {totalAnexos} anexo(s) ·{' '}
            {habitualidades.length} habitualidade(s)
          </Text>
          <CampoSenha
            rotulo="Senha do backup"
            valor={senha}
            aoMudar={setSenha}
            placeholder={`Mínimo de ${MIN_SENHA} caracteres`}
          />
          <CampoSenha
            rotulo="Repita a senha"
            valor={senha2}
            aoMudar={setSenha2}
            placeholder="Digite de novo"
            erro={senha2.length > 0 && senha !== senha2 ? 'As senhas não conferem.' : null}
          />
          <Text style={b.aviso}>
            Guarde essa senha: sem ela o backup não pode ser aberto, nem por você. Não há como
            recuperá-la.
          </Text>
          <Botao
            titulo="Exportar backup"
            icone="share-outline"
            aoTocar={() => void exportar()}
            carregando={exportando}
            desabilitado={!podeExportar}
            estilo={{ marginTop: espaco.md }}
          />
        </Cartao>
      </Secao>

      <Secao titulo="Restaurar">
        <Cartao>
          {envelope ? (
            <>
              <Text style={b.arquivoOk}>
                <Ionicons name="document-lock-outline" size={14} /> Backup selecionado. Digite a
                senha para restaurar.
              </Text>
              <CampoSenha
                rotulo="Senha do backup"
                valor={senhaR}
                aoMudar={setSenhaR}
                placeholder="A senha definida na exportação"
              />
              <Botao
                titulo="Restaurar backup"
                icone="cloud-download-outline"
                aoTocar={() => void restaurar()}
                carregando={restaurando}
                desabilitado={senhaR.length === 0}
                estilo={{ marginTop: espaco.md }}
              />
              <Botao
                titulo="Escolher outro arquivo"
                variante="fantasma"
                aoTocar={() => void escolher()}
                estilo={{ marginTop: espaco.sm }}
              />
            </>
          ) : (
            <>
              <Text style={b.subtitulo}>
                Escolha um arquivo <Text style={b.mono}>.cacbackup</Text> do iCloud Drive, do Google
                Drive ou dos Arquivos do aparelho.
              </Text>
              <Botao
                titulo="Escolher arquivo de backup"
                icone="folder-open-outline"
                variante="secundario"
                aoTocar={() => void escolher()}
                estilo={{ marginTop: espaco.md }}
              />
            </>
          )}
        </Cartao>
      </Secao>
    </Tela>
  );
}

function CampoSenha({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  erro,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  erro?: string | null;
}) {
  const c = useCores();
  const b = useEstilos(folha);
  const [ver, setVer] = useState(false);
  const [focado, setFocado] = useState(false);

  return (
    <View style={b.grupo}>
      <Text style={b.rotulo}>{rotulo.toUpperCase()}</Text>
      <View style={[b.input, focado ? b.inputFocado : null, erro ? b.inputErro : null]}>
        <Ionicons name="lock-closed-outline" size={16} color={c.textoFraco} />
        <TextInput
          style={b.inputInterno}
          value={valor}
          onChangeText={aoMudar}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          placeholder={placeholder}
          placeholderTextColor={c.textoFraco}
          secureTextEntry={!ver}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Ionicons
          name={ver ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={c.textoFraco}
          onPress={() => setVer((v) => !v)}
          suppressHighlighting
        />
      </View>
      {erro ? <Text style={b.erro}>{erro}</Text> : null}
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    intro: { alignItems: 'center', marginBottom: espaco.md },
    emblema: {
      width: 56,
      height: 56,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.md,
    },
    titulo: { ...tipo.telaTitulo, fontSize: 22, color: c.texto, textAlign: 'center' },
    subtitulo: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
      maxWidth: 340,
    },
    mono: { fontFamily: 'Courier', color: c.texto },

    linhaResumo: { ...tipo.legenda, color: c.textoFraco, marginBottom: espaco.lg },
    aviso: { ...tipo.legenda, color: c.aviso, marginTop: espaco.sm, lineHeight: 16 },
    arquivoOk: { ...tipo.corpoPequeno, color: c.primario, marginBottom: espaco.lg },

    grupo: { marginBottom: espaco.lg },
    rotulo: { ...tipo.etiqueta, color: c.textoMedio, marginBottom: 7 },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.superficie,
      borderWidth: 1,
      borderColor: c.borda,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.md,
      minHeight: 46,
    },
    inputFocado: { borderColor: c.primario },
    inputErro: { borderColor: c.perigo },
    inputInterno: { flex: 1, fontSize: 15, color: c.texto, paddingVertical: 12 },
    erro: { ...tipo.legenda, color: c.perigo, marginTop: 5 },
  });
