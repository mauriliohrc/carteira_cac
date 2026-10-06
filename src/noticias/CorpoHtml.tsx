import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { useCores, type Paleta } from '@/tema';

/** Converte texto puro (notícias antigas, sem HTML) em parágrafos. */
function normalizar(conteudo: string): string {
  const temHtml = /<[a-z][\s\S]*>/i.test(conteudo);
  if (temHtml) return conteudo;
  const escapar = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return conteudo
    .split(/\n{2,}/)
    .map((p) => `<p>${escapar(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function montarDocumento(conteudo: string, c: Paleta): string {
  const corpo = normalizar(conteudo);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  :root { color-scheme: ${c.nome === 'claro' ? 'light' : 'dark'}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { color: ${c.texto}; font: 16px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-text-size-adjust: 100%; word-wrap: break-word; }
  p { margin: 0 0 14px; }
  h1, h2, h3 { color: ${c.texto}; line-height: 1.3; margin: 20px 0 10px; }
  h2 { font-size: 21px; } h3 { font-size: 18px; } h1 { font-size: 24px; }
  a { color: ${c.primario}; }
  ul, ol { padding-left: 22px; margin: 0 0 14px; }
  li { margin: 4px 0; }
  blockquote { margin: 14px 0; padding: 4px 0 4px 14px; border-left: 3px solid ${c.primario}; color: ${c.textoFraco}; }
  img { max-width: 100%; height: auto; border-radius: 10px; margin: 10px 0; display: block; }
  iframe { max-width: 100%; width: 100%; border: 0; border-radius: 10px; }
  /* YouTube do TipTap vem em <div data-youtube-video><iframe></div> */
  div[data-youtube-video] { position: relative; width: 100%; padding-bottom: 56.25%; height: 0; margin: 12px 0; }
  div[data-youtube-video] iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  hr { border: 0; border-top: 1px solid ${c.borda}; margin: 18px 0; }
</style></head>
<body>${corpo}</body></html>`;
}

const SCRIPT_ALTURA = `
(function(){
  function post(){ if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight)); } }
  post();
  window.addEventListener('load', post);
  [250, 800, 1600].forEach(function(t){ setTimeout(post, t); });
  if (window.ResizeObserver) { try { new ResizeObserver(post).observe(document.body); } catch(e){} }
  Array.prototype.forEach.call(document.images, function(img){ img.addEventListener('load', post); });
})();
true;
`;

/**
 * Renderiza o HTML da notícia com o visual do app, num WebView de altura
 * automática — imagens responsivas, YouTube inline e links abrindo no navegador.
 */
export function CorpoHtml({ html }: { html: string }) {
  const c = useCores();
  const [altura, setAltura] = useState(1);
  const documento = useMemo(() => montarDocumento(html, c), [html, c]);

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: documento }}
      style={[styles.web, { height: altura }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
      injectedJavaScript={SCRIPT_ALTURA}
      onMessage={(e) => {
        const h = Number(e.nativeEvent.data);
        if (h > 0) setAltura(h);
      }}
      // Toque em link abre no navegador; iframes do YouTube carregam normalmente.
      onShouldStartLoadWithRequest={(req) => {
        if (req.navigationType === 'click' && /^https?:/i.test(req.url)) {
          void Linking.openURL(req.url);
          return false;
        }
        return true;
      }}
    />
  );
}

const styles = StyleSheet.create({
  web: { width: '100%', backgroundColor: 'transparent' },
});
