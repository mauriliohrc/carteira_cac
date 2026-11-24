import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FS from 'expo-file-system/legacy';

/** Dados já formatados (strings) da carteira para montar o PDF. */
export interface DadosCarteiraPdf {
  nomeLiga: string;
  nome: string;
  cpf: string;
  nascimento: string;
  matricula: string;
  validade: string;
  statusTexto: string;
  vigente: boolean;
  /** Caminho local absoluto da foto (ou null). */
  fotoUri: string | null;
  /** URL do logo da liga (opcional). */
  logoUrl: string | null;
}

function esc(s: string): string {
  return (s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

/**
 * Exporta a carteira de filiado como PDF (layout de documento, com a foto) e
 * abre a folha de compartilhamento do sistema (salvar/enviar). A foto é embutida
 * como data URI — ela vive só no aparelho, então o PDF é gerado localmente.
 */
export async function exportarCarteiraPdf(d: DadosCarteiraPdf): Promise<void> {
  let fotoHtml = '<div class="foto foto-vazia">SEM<br/>FOTO</div>';
  if (d.fotoUri) {
    try {
      const b64 = await FS.readAsStringAsync(d.fotoUri, { encoding: FS.EncodingType.Base64 });
      fotoHtml = `<img class="foto" src="data:image/jpeg;base64,${b64}" />`;
    } catch {
      /* mantém placeholder */
    }
  }
  const logoHtml = d.logoUrl ? `<img class="logo" src="${esc(d.logoUrl)}" />` : '';
  const seloCor = d.vigente ? '#2f7d4f' : '#9b2c2c';

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; background: #fff; }
  .wrap { padding: 28px; display: flex; justify-content: center; }
  .cartao { width: 520px; border: 1px solid #16351f55; border-radius: 16px; overflow: hidden; background: #f4f1e8; }
  .faixa { display: flex; align-items: center; gap: 12px; background: #16351f; padding: 14px 18px; }
  .faixa .logo { width: 40px; height: 30px; object-fit: contain; }
  .faixa .brasao { width: 34px; height: 34px; border-radius: 17px; background: #1f4a2c; border: 1px solid #f4f1e866; }
  .faixa .tit { flex: 1; color: #f4f1e8; }
  .faixa .liga { font-size: 13px; font-weight: 700; letter-spacing: .5px; }
  .faixa .sub { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #f4f1e8cc; margin-top: 2px; }
  .selo { color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .5px; padding: 4px 9px; border-radius: 4px; background: ${seloCor}; }
  .corpo { display: flex; gap: 16px; padding: 18px; }
  .foto { width: 110px; height: 146px; border-radius: 6px; border: 1px solid #16351f66; background: #fff; object-fit: cover; }
  .foto-vazia { display: flex; align-items: center; justify-content: center; text-align: center; color: #16351f88; font-size: 12px; font-weight: 700; }
  .dados { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
  .rot { color: #16351f99; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
  .val { color: #16351f; font-size: 15px; font-family: 'Courier New', monospace; margin-top: 2px; }
  .val.nome { font-size: 17px; font-weight: 700; }
  .linha { display: flex; gap: 12px; }
  .linha > div { flex: 1; }
  .rodape { display: flex; align-items: center; gap: 6px; padding: 10px 18px; border-top: 1px solid #16351f22; background: #16351f0e; color: #16351faa; font-size: 10px; }
</style></head>
<body><div class="wrap"><div class="cartao">
  <div class="faixa">
    ${logoHtml || '<div class="brasao"></div>'}
    <div class="tit"><div class="liga">${esc(d.nomeLiga.toUpperCase())}</div><div class="sub">CARTEIRA DE FILIADO</div></div>
    <div class="selo">${esc(d.statusTexto.toUpperCase())}</div>
  </div>
  <div class="corpo">
    ${fotoHtml}
    <div class="dados">
      <div><div class="rot">NOME</div><div class="val nome">${esc(d.nome)}</div></div>
      <div class="linha">
        <div><div class="rot">CPF</div><div class="val">${esc(d.cpf)}</div></div>
        <div><div class="rot">NASCIMENTO</div><div class="val">${esc(d.nascimento)}</div></div>
      </div>
      <div class="linha">
        <div><div class="rot">MATRÍCULA</div><div class="val">${esc(d.matricula)}</div></div>
        <div><div class="rot">VÁLIDO ATÉ</div><div class="val">${esc(d.validade)}</div></div>
      </div>
    </div>
  </div>
  <div class="rodape">Documento associativo — autenticidade verificável pelo certificado (QR).</div>
</div></div></body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Carteira de filiado',
      UTI: 'com.adobe.pdf',
    });
  }
}
