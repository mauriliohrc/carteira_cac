import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import {
  espaco,
  PREFERENCIAS,
  raio,
  tipo,
  useCores,
  useEstilos,
  useTema,
  type Paleta,
  type PreferenciaTema,
} from '@/tema';
import { useApp } from '@/estado/AppContext';
import { useTranca } from '@/seguranca/TrancaProvider';
import { Cartao, Secao, Tela, TituloTela } from '@/ui/base';
import { avisar } from '@/ui/dialogo';

// Versão e build lidos do app embutido (app.json → nativo), diferenciando
// iOS (buildNumber) de Android (versionCode). Nada fica fixo no código.
const VERSAO_APP = Constants.expoConfig?.version ?? '';
const BUILD_APP =
  Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber ?? ''
    : String(Constants.expoConfig?.android?.versionCode ?? '');
const RODAPE_VERSAO = `CARTEIRA CAC · VERSÃO ${VERSAO_APP}${BUILD_APP ? ` (${BUILD_APP})` : ''}`;
import { LIMITE_GRATUITO_ARMAS, restaurarCompras } from '@/billing';
import { contarAgendadas, permissaoConcedida } from '@/notificacoes';

export default function Mais() {
  const c = useCores();
  const m = useEstilos(folha);
  const { preferencia, definirPreferencia, esquema } = useTema();
  const { armas, documentos, premium, definirPremium } = useApp();
  const { temPin } = useTranca();
  const [restaurando, setRestaurando] = useState(false);
  const [statusAvisos, setStatusAvisos] = useState<{ ativo: boolean; agendadas: number } | null>(null);

  const carregarAvisos = useCallback(async () => {
    const [ativo, agendadas] = await Promise.all([permissaoConcedida(), contarAgendadas()]);
    setStatusAvisos({ ativo, agendadas });
  }, []);

  useEffect(() => {
    void carregarAvisos();
  }, [carregarAvisos]);

  // Exigido pelas lojas: restaurar precisa estar acessível sem passar pelo
  // paywall, para quem trocou de aparelho ou reinstalou o app.
  const restaurar = async () => {
    setRestaurando(true);
    try {
      const ok = await restaurarCompras();
      await definirPremium(ok);
      avisar(
        ok ? 'Assinatura restaurada' : 'Nenhuma assinatura encontrada',
        ok
          ? 'Seu Premium foi reativado neste aparelho.'
          : 'Não encontramos uma assinatura ativa nesta conta da loja. Se você assinou com outra conta, entre com ela e tente de novo.'
      );
    } finally {
      setRestaurando(false);
    }
  };

  const totalAnexos = documentos.reduce((n, d) => n + d.arquivos.length, 0);

  return (
    <Tela sobBarra>
      <TituloTela titulo="Mais" />

      <Secao titulo="Aparência">
        <Cartao>
          <Text style={m.rotuloCampo}>TEMA</Text>
          <View style={m.temas}>
            {PREFERENCIAS.map((op) => {
              const ativo = preferencia === op.valor;
              return (
                <Pressable
                  key={op.valor}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => void definirPreferencia(op.valor as PreferenciaTema)}
                  style={[m.tema, ativo ? m.temaAtivo : null]}
                >
                  <Ionicons
                    name={op.icone as keyof typeof Ionicons.glyphMap}
                    size={19}
                    color={ativo ? c.primario : c.textoFraco}
                  />
                  <Text style={[m.temaTexto, ativo ? m.temaTextoAtivo : null]}>
                    {op.rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={m.dica}>
            {preferencia === 'automatico'
              ? `Seguindo o sistema — agora em modo ${esquema}.`
              : `Fixo em modo ${esquema}, independente do sistema.`}
          </Text>
        </Cartao>
      </Secao>

      <Secao titulo="Assinatura">
        <Pressable
          onPress={() => router.push('/premium')}
          style={({ pressed }) => [
            m.item,
            premium ? m.itemPremium : null,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="star-outline" size={19} color={premium ? c.latao : c.textoMedio} />
          <View style={{ flex: 1 }}>
            <Text style={m.itemTitulo}>{premium ? 'Premium ativo' : 'Plano gratuito'}</Text>
            <Text style={m.itemSub}>
              {premium
                ? 'Acervo ilimitado liberado'
                : `${armas.length}/${LIMITE_GRATUITO_ARMAS} arma · assine para liberar o acervo`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={c.textoFraco} />
        </Pressable>

        <ItemMenu
          icone="refresh-outline"
          titulo={restaurando ? 'Restaurando…' : 'Restaurar compra'}
          subtitulo="Já assinou antes? Recupere o Premium neste aparelho"
          aoTocar={() => void restaurar()}
        />

        {premium ? null : (
          <ItemMenu
            icone="pricetag-outline"
            titulo="Código promocional"
            subtitulo="Tem um código de liberação? Ative aqui"
            aoTocar={() => router.push('/resgatar')}
          />
        )}
      </Secao>

      <Secao titulo="Segurança">
        <ItemMenu
          icone="lock-closed-outline"
          titulo="Bloqueio do app"
          subtitulo={temPin ? 'PIN ativo · toque para gerenciar' : 'Proteja o acervo com um PIN de 6 dígitos'}
          aoTocar={() => router.push('/seguranca')}
        />
      </Secao>

      <Secao titulo="Notificações">
        <Cartao>
          <View style={m.linhaAviso}>
            <Ionicons
              name={statusAvisos?.ativo ? 'notifications' : 'notifications-off-outline'}
              size={20}
              color={statusAvisos?.ativo ? c.primario : c.textoFraco}
            />
            <View style={{ flex: 1 }}>
              <Text style={m.itemTitulo}>
                {statusAvisos == null
                  ? 'Verificando…'
                  : statusAvisos.ativo
                    ? 'Avisos ativados'
                    : 'Avisos desativados'}
              </Text>
              <Text style={m.itemSub}>
                {statusAvisos?.ativo
                  ? `${statusAvisos.agendadas} aviso(s) de vencimento agendado(s) no aparelho`
                  : 'Ative nos Ajustes para ser avisado antes de cada vencimento'}
              </Text>
            </View>
          </View>
        </Cartao>
      </Secao>

      <Secao titulo="Seus dados">
        <Cartao>
          <View style={m.numeros}>
            <Numero valor={armas.length} rotulo="Armas" />
            <Numero valor={documentos.length} rotulo="Documentos" />
            <Numero valor={totalAnexos} rotulo="Anexos" />
          </View>
          <Text style={m.notaDados}>
            Tudo fica só neste aparelho, sem servidor. Os arquivos ficam na área privada do app e
            entram no backup do celular.
          </Text>
        </Cartao>

        <ItemMenu
          icone="cloud-upload-outline"
          titulo="Backup e restauração"
          subtitulo="Exporte tudo num arquivo com senha — iCloud, Drive ou Arquivos"
          aoTocar={() => router.push('/backup')}
        />
      </Secao>

      <Text style={m.rodape}>{RODAPE_VERSAO}</Text>
    </Tela>
  );
}

function ItemMenu({
  icone,
  titulo,
  subtitulo,
  aoTocar,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  subtitulo: string;
  aoTocar: () => void;
}) {
  const c = useCores();
  const m = useEstilos(folha);
  return (
    <Pressable onPress={aoTocar} style={({ pressed }) => [m.item, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icone} size={19} color={c.primario} />
      <View style={{ flex: 1 }}>
        <Text style={m.itemTitulo}>{titulo}</Text>
        <Text style={m.itemSub}>{subtitulo}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={c.textoFraco} />
    </Pressable>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  const m = useEstilos(folha);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={m.numeroValor}>{valor}</Text>
      <Text style={m.numeroRotulo}>{rotulo.toUpperCase()}</Text>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.lg,
      marginBottom: espaco.sm,
    },
    itemPremium: { borderColor: `${c.latao}88`, backgroundColor: c.lataoFraco },
    linhaAviso: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    itemTitulo: { ...tipo.subtitulo, fontSize: 14.5, color: c.texto },
    itemSub: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },

    rotuloCampo: { ...tipo.etiqueta, color: c.textoMedio, marginBottom: espaco.md },
    dica: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.md },

    temas: { flexDirection: 'row', gap: espaco.sm },
    tema: {
      flex: 1,
      alignItems: 'center',
      gap: 7,
      paddingVertical: espaco.md,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.fundo,
    },
    temaAtivo: { borderColor: c.primario, backgroundColor: c.primarioFraco },
    temaTexto: { fontSize: 12, fontWeight: '600', color: c.textoFraco },
    temaTextoAtivo: { color: c.primario },




    numeros: { flexDirection: 'row' },
    numeroValor: { ...tipo.numero, fontSize: 22, color: c.texto },
    numeroRotulo: { ...tipo.etiqueta, fontSize: 9, color: c.textoFraco, marginTop: 3 },
    notaDados: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.lg, textAlign: 'center' },

    rodape: { ...tipo.etiqueta, fontSize: 9.5, color: c.textoFraco, textAlign: 'center', marginTop: espaco.xxl },
  });
