import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela } from '@/ui/base';
import { avisar, escolher } from '@/ui/dialogo';
import { ErroConta } from '@/conta/api';
import {
  aceitarEula,
  criarAnuncio,
  editarAnuncio,
  enviarFoto,
  obterAnuncio,
  obterCatalogo,
  precoParaCentavos,
} from '@/mercado/api';
import {
  ROTULO_ESTADO_USO,
  type CategoriaMarket,
  type EstadoUso,
  type SubcategoriaMarket,
} from '@/mercado/tipos';

const ESTADOS: EstadoUso[] = ['NOVO', 'SEMINOVO', 'USADO'];
const MAX_FOTOS = 6;

export default function NovoAnuncio() {
  const c = useCores();
  const p = useEstilos(folha);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const edicao = !!id;

  const [catalogo, setCatalogo] = useState<CategoriaMarket[]>([]);
  const [categoria, setCategoria] = useState<CategoriaMarket | null>(null);
  const [subcategoria, setSubcategoria] = useState<SubcategoriaMarket | null>(null);
  const [estadoUso, setEstadoUso] = useState<EstadoUso>('USADO');
  const [titulo, setTitulo] = useState('');
  const [preco, setPreco] = useState('');
  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [descricao, setDescricao] = useState('');
  // Fotos novas (ids de Upload) + preview; edição não mexe nas fotos existentes.
  const [fotos, setFotos] = useState<{ id: string; uri: string }[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<string[]>([]);

  const [carregando, setCarregando] = useState(edicao);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void obterCatalogo()
      .then((cat) => setCatalogo(cat.categorias))
      .catch(() => setCatalogo([]));
  }, []);

  // Em edição, pré-carrega o anúncio.
  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const a = await obterAnuncio(id);
        setTitulo(a.titulo);
        setPreco(a.precoCentavos != null ? (a.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
        setUf(a.uf);
        setCidade(a.cidade);
        setDescricao(a.descricao);
        setEstadoUso(a.estadoUso);
        setFotosExistentes(a.fotos);
      } catch {
        await avisar('Erro', 'Não foi possível abrir o anúncio.');
        router.back();
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  // Casa a categoria do anúncio carregado quando o catálogo chega (edição).
  const escolherCategoria = useCallback(() => {
    void escolher(
      'Categoria',
      'Escolha a categoria do acessório',
      catalogo.map((cat) => ({
        rotulo: cat.rotulo,
        icone: 'pricetag-outline' as const,
        acao: () => {
          setCategoria(cat);
          setSubcategoria(null);
        },
      }))
    );
  }, [catalogo]);

  const escolherSub = useCallback(() => {
    if (!categoria || categoria.subcategorias.length === 0) return;
    void escolher(
      categoria.rotulo,
      'Subcategoria',
      categoria.subcategorias.map((s) => ({
        rotulo: s.rotulo,
        icone: 'chevron-forward' as const,
        acao: () => setSubcategoria(s),
      }))
    );
  }, [categoria]);

  const adicionarFoto = async () => {
    if (fotos.length + fotosExistentes.length >= MAX_FOTOS) {
      await avisar('Limite de fotos', `No máximo ${MAX_FOTOS} fotos por anúncio.`);
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const asset = r.assets[0];
    setEnviandoFoto(true);
    try {
      const uploadId = await enviarFoto(asset.mimeType ?? 'image/jpeg', asset.base64!);
      setFotos((f) => [...f, { id: uploadId, uri: asset.uri }]);
    } catch (e) {
      await avisar('Falha no envio', e instanceof ErroConta ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const validar = (): string | null => {
    if (!categoria) return 'Escolha a categoria.';
    if (categoria.subcategorias.length > 0 && !subcategoria) return 'Escolha a subcategoria.';
    if (titulo.trim().length < 3) return 'Dê um título ao anúncio.';
    if (descricao.trim().length < 5) return 'Descreva o item.';
    if (uf.trim().length !== 2) return 'Informe a UF (2 letras).';
    if (!cidade.trim()) return 'Informe a cidade.';
    return null;
  };

  const publicar = async () => {
    const erro = validar();
    if (erro) {
      await avisar('Confira o anúncio', erro);
      return;
    }
    setSalvando(true);
    try {
      const base = {
        categoria: categoria!.valor,
        subcategoria: subcategoria?.valor ?? null,
        estadoUso,
        precoCentavos: precoParaCentavos(preco),
        uf: uf.trim().toUpperCase(),
        cidade: cidade.trim(),
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      };
      if (edicao && id) {
        await editarAnuncio(id, base);
        await avisar('Anúncio atualizado', 'Ele volta para análise antes de aparecer no mercado.');
      } else {
        await aceitarEula(); // consentimento no ato de publicar
        await criarAnuncio({ ...base, fotos: fotos.map((f) => f.id) });
        await avisar('Anúncio enviado', 'Ele passa por uma análise rápida e já aparece no mercado.');
      }
      router.back();
    } catch (e) {
      await avisar('Não foi possível publicar', e instanceof ErroConta ? e.message : 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho={edicao ? 'Editar anúncio' : 'Novo anúncio'}>
        <View style={p.centro}><ActivityIndicator color={c.primario} /></View>
      </Tela>
    );
  }

  const totalFotos = fotos.length + fotosExistentes.length;

  return (
    <Tela voltar teclado tituloCabecalho={edicao ? 'Editar anúncio' : 'Novo anúncio'}>
      <View style={p.form}>
        {/* Fotos (só na criação) */}
        {!edicao ? (
          <View>
            <Text style={p.rotulo}>FOTOS ({totalFotos}/{MAX_FOTOS})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espaco.sm }}>
              {fotos.map((f) => (
                <View key={f.id} style={p.fotoBox}>
                  <Image source={{ uri: f.uri }} style={p.fotoImg} />
                  <Pressable style={p.remover} onPress={() => setFotos((x) => x.filter((y) => y.id !== f.id))}>
                    <Ionicons name="close" size={13} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {totalFotos < MAX_FOTOS ? (
                <Pressable style={p.addFoto} onPress={adicionarFoto} disabled={enviandoFoto}>
                  {enviandoFoto ? (
                    <ActivityIndicator color={c.primario} />
                  ) : (
                    <Ionicons name="camera-outline" size={22} color={c.primario} />
                  )}
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : fotosExistentes.length ? (
          <View>
            <Text style={p.rotulo}>FOTOS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espaco.sm }}>
              {fotosExistentes.map((uri) => (
                <Image key={uri} source={{ uri }} style={p.fotoImg} />
              ))}
            </ScrollView>
            <Text style={p.dica}>Para trocar as fotos, crie um novo anúncio.</Text>
          </View>
        ) : null}

        {/* Categoria / subcategoria */}
        <Campo rotulo="CATEGORIA">
          <Seletor texto={categoria?.rotulo ?? 'Escolher categoria'} vazio={!categoria} aoTocar={escolherCategoria} />
        </Campo>
        {categoria && categoria.subcategorias.length > 0 ? (
          <Campo rotulo="SUBCATEGORIA">
            <Seletor texto={subcategoria?.rotulo ?? 'Escolher subcategoria'} vazio={!subcategoria} aoTocar={escolherSub} />
          </Campo>
        ) : null}

        {/* Estado de uso */}
        <Campo rotulo="ESTADO">
          <View style={p.chips}>
            {ESTADOS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEstadoUso(e)}
                style={[p.chip, estadoUso === e ? { backgroundColor: c.primario, borderColor: c.primario } : null]}
              >
                <Text style={[p.chipTxt, estadoUso === e ? { color: c.sobrePrimario } : null]}>
                  {ROTULO_ESTADO_USO[e]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Campo>

        <Campo rotulo="TÍTULO">
          <TextInput value={titulo} onChangeText={setTitulo} placeholder="Ex.: Luneta 4-16x50" placeholderTextColor={c.textoFraco} style={p.input} maxLength={120} />
        </Campo>

        <Campo rotulo="PREÇO (deixe vazio p/ 'a combinar')">
          <TextInput value={preco} onChangeText={setPreco} placeholder="R$ 0,00" placeholderTextColor={c.textoFraco} keyboardType="numeric" style={p.input} />
        </Campo>

        <View style={{ flexDirection: 'row', gap: espaco.md }}>
          <View style={{ width: 90 }}>
            <Campo rotulo="UF">
              <TextInput value={uf} onChangeText={(t) => setUf(t.toUpperCase().slice(0, 2))} placeholder="SP" placeholderTextColor={c.textoFraco} autoCapitalize="characters" style={p.input} />
            </Campo>
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="CIDADE">
              <TextInput value={cidade} onChangeText={setCidade} placeholder="Cidade" placeholderTextColor={c.textoFraco} style={p.input} maxLength={80} />
            </Campo>
          </View>
        </View>

        <Campo rotulo="DESCRIÇÃO">
          <TextInput
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Detalhe o item, estado de conservação, o que acompanha…"
            placeholderTextColor={c.textoFraco}
            multiline
            style={[p.input, { minHeight: 110, textAlignVertical: 'top' }]}
            maxLength={4000}
          />
        </Campo>

        <View style={p.aviso}>
          <Ionicons name="alert-circle-outline" size={15} color={c.textoFraco} />
          <Text style={p.avisoTxt}>
            Só acessórios. Armas, munição, pólvora e itens controlados não são permitidos e reprovam o
            anúncio. Ao publicar você concorda com os termos do marketplace.
          </Text>
        </View>

        <Botao
          titulo={edicao ? 'Salvar alterações' : 'Publicar anúncio'}
          icone="checkmark"
          carregando={salvando}
          aoTocar={publicar}
          estilo={{ marginTop: espaco.sm }}
        />
      </View>
    </Tela>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const p = useEstilos(folha);
  return (
    <View>
      <Text style={p.rotulo}>{rotulo}</Text>
      {children}
    </View>
  );
}

function Seletor({ texto, vazio, aoTocar }: { texto: string; vazio: boolean; aoTocar: () => void }) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <Pressable style={p.input} onPress={aoTocar}>
      <Text style={{ color: vazio ? c.textoFraco : c.texto, fontSize: 15 }}>{texto}</Text>
      <Ionicons name="chevron-down" size={16} color={c.textoFraco} style={{ position: 'absolute', right: 12, top: 14 }} />
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    form: { padding: espaco.lg, gap: espaco.lg },
    rotulo: { ...tipo.etiqueta, color: c.textoMedio, marginBottom: espaco.sm },
    dica: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.sm },
    input: {
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.md,
      paddingVertical: 12,
      color: c.texto,
      fontSize: 15,
    },
    chips: { flexDirection: 'row', gap: espaco.sm },
    chip: {
      paddingHorizontal: espaco.lg,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.superficie,
    },
    chipTxt: { fontSize: 13, fontWeight: '600', color: c.textoMedio },
    fotoBox: { position: 'relative' },
    fotoImg: { width: 84, height: 84, borderRadius: raio.sm, backgroundColor: c.superficieAlta },
    remover: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: c.perigo,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addFoto: {
      width: 84,
      height: 84,
      borderRadius: raio.sm,
      borderWidth: 1,
      borderColor: c.borda,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.superficie,
    },
    aviso: {
      flexDirection: 'row',
      gap: espaco.sm,
      backgroundColor: c.superficieAlta,
      borderRadius: raio.sm,
      padding: espaco.md,
    },
    avisoTxt: { ...tipo.legenda, color: c.textoFraco, flex: 1 },
  });
