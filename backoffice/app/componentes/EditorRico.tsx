'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';

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

  return (
    <div className="editor-barra">
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
