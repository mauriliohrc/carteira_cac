'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style';

/** Tamanhos de fonte oferecidos na barra (rótulo → valor CSS no HTML gerado). */
const TAMANHOS: { rotulo: string; valor: string }[] = [
  { rotulo: 'Pequena', valor: '14px' },
  { rotulo: 'Normal', valor: '' }, // '' = remove o estilo (volta ao padrão da página)
  { rotulo: 'Média', valor: '20px' },
  { rotulo: 'Grande', valor: '26px' },
  { rotulo: 'Enorme', valor: '34px' },
];

/** Fontes oferecidas (rótulo → font-family aplicada no HTML). */
const FONTES: { rotulo: string; valor: string }[] = [
  { rotulo: 'Padrão', valor: '' },
  { rotulo: 'Serifada', valor: 'Georgia, "Times New Roman", serif' },
  { rotulo: 'Arredondada', valor: '"Trebuchet MS", Verdana, sans-serif' },
  { rotulo: 'Monoespaçada', valor: 'ui-monospace, "Courier New", monospace' },
];

/**
 * Editor rich text do conteúdo da notícia. Entrada e saída em HTML.
 * Suporta formatação, imagens e vídeos do YouTube no meio do texto.
 */
export function EditorRico({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false, // evita mismatch de SSR no Next
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image.configure({ inline: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      // Base para marcas de estilo inline (tamanho/fonte) no HTML gerado.
      TextStyle,
      FontSize,
      FontFamily,
    ],
    content: valor || '',
    onUpdate: ({ editor }) => aoMudar(editor.getHTML()),
    editorProps: {
      attributes: { class: 'prosa', spellcheck: 'true' },
    },
  });

  // Sincroniza quando o valor externo chega depois (ex.: ao carregar a edição).
  useEffect(() => {
    if (editor && valor && valor !== editor.getHTML()) {
      editor.commands.setContent(valor, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, valor]);

  if (!editor) return <div className="editor-caixa">Carregando editor…</div>;

  return (
    <div className="editor-caixa">
      <Barra editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Barra({ editor }: { editor: Editor }) {
  const b = (ativo: boolean) => `editor-btn${ativo ? ' ativo' : ''}`;

  function inserirImagem() {
    const url = window.prompt('URL da imagem (https://…)');
    if (url) editor.chain().focus().setImage({ src: url.trim() }).run();
  }
  function inserirYoutube() {
    const url = window.prompt('URL do vídeo do YouTube');
    if (url) editor.commands.setYoutubeVideo({ src: url.trim() });
  }
  function inserirLink() {
    const url = window.prompt('URL do link (https://…)');
    if (url === null) return;
    if (url.trim() === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url.trim() }).run();
  }

  // Tamanho/fonte atuais da seleção (para refletir no <select>).
  const tamanhoAtual = (editor.getAttributes('textStyle').fontSize as string) || '';
  const fonteAtual = (editor.getAttributes('textStyle').fontFamily as string) || '';

  function aplicarTamanho(valor: string) {
    if (valor === '') editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(valor).run();
  }
  function aplicarFonte(valor: string) {
    if (valor === '') editor.chain().focus().unsetFontFamily().run();
    else editor.chain().focus().setFontFamily(valor).run();
  }

  return (
    <div className="editor-barra">
      <select
        className="editor-select"
        value={tamanhoAtual}
        onChange={(e) => aplicarTamanho(e.target.value)}
        title="Tamanho da fonte"
      >
        {TAMANHOS.map((t) => (
          <option key={t.rotulo} value={t.valor}>{t.rotulo}</option>
        ))}
      </select>
      <select
        className="editor-select"
        value={fonteAtual}
        onChange={(e) => aplicarFonte(e.target.value)}
        title="Fonte"
      >
        {FONTES.map((f) => (
          <option key={f.rotulo} value={f.valor}>{f.rotulo}</option>
        ))}
      </select>
      <span className="editor-sep" />
      <button type="button" className={b(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><b>B</b></button>
      <button type="button" className={b(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><i>I</i></button>
      <span className="editor-sep" />
      <button type="button" className={b(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título">H2</button>
      <button type="button" className={b(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Subtítulo">H3</button>
      <span className="editor-sep" />
      <button type="button" className={b(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">•</button>
      <button type="button" className={b(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">1.</button>
      <button type="button" className={b(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">❝</button>
      <span className="editor-sep" />
      <button type="button" className={b(editor.isActive('link'))} onClick={inserirLink} title="Link">🔗</button>
      <button type="button" className="editor-btn" onClick={inserirImagem} title="Imagem">🖼️</button>
      <button type="button" className="editor-btn" onClick={inserirYoutube} title="Vídeo do YouTube">▶</button>
    </div>
  );
}
