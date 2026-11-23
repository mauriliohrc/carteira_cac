import sanitizeHtml from 'sanitize-html';

/**
 * Sanitização do HTML rico das notícias (editor TipTap) contra XSS armazenado.
 *
 * O conteúdo é escrito por admin e por entidades (privilégio menor) e depois
 * renderizado com `dangerouslySetInnerHTML` no portal público e numa WebView do
 * app — ou seja, qualquer `<script>`/`onerror`/`javascript:` injetado rodaria na
 * origem da vítima (inclusive admins). Aqui aplicamos uma allowlist estrita de
 * tags/atributos compatível com o que o TipTap gera, removendo tudo que possa
 * executar código. Links são forçados a abrir com `rel="noopener noreferrer"` e
 * iframes ficam restritos a hosts de vídeo conhecidos (YouTube/Vimeo).
 */
const OPCOES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'span', 'div',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'mark',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img', 'iframe',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
    div: ['data-youtube-video'],
    // Alinhamento de texto do TipTap vem via style="text-align:..."; o
    // sanitize-html filtra apenas valores seguros (ver allowedStyles).
    p: ['style'],
    h1: ['style'], h2: ['style'], h3: ['style'],
    h4: ['style'], h5: ['style'], h6: ['style'],
    td: ['colspan', 'rowspan', 'style'],
    th: ['colspan', 'rowspan', 'style'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  // Protocolos permitidos em href/src: sem `javascript:`, `data:` (SVG/HTML) etc.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
    iframe: ['https'],
  },
  allowProtocolRelative: false,
  // iframes só de players de vídeo conhecidos (evita iframe de phishing).
  allowedIframeHostnames: [
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
    'player.vimeo.com',
  ],
  // Garante abertura segura de links externos.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.href && /^https?:/i.test(attribs.href)
          ? { target: '_blank', rel: 'noopener noreferrer nofollow' }
          : {}),
      },
    }),
  },
};

/** Remove qualquer HTML executável do conteúdo, preservando a formatação válida. */
export function sanitizarHtmlNoticia(html: string): string {
  return sanitizeHtml(html, OPCOES);
}
