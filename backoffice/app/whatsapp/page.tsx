'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import {
  ROTULO_STATUS_CAMPANHA,
  type CampanhaWhats,
  type FiltrosWhats,
  type StatusWhatsapp,
} from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

const NOME_EXEMPLO = 'João';

export default function PaginaWhatsapp() {
  return (
    <Protegido>
      <Whatsapp />
    </Protegido>
  );
}

function Whatsapp() {
  return (
    <>
      <h1>WhatsApp</h1>
      <p className="subtitulo">Relacionamento ativo: conecte um número e dispare mensagens.</p>
      <Conexao />
      <Disparo />
      <Campanhas />
    </>
  );
}

/* ------------------------------------------------------------------ conexão */
function Conexao() {
  const [st, setSt] = useState<StatusWhatsapp | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    const r = await api<StatusWhatsapp>('/api/admin/whatsapp/status');
    setSt(r);
    return r;
  }, []);

  // Polling adaptativo: rápido enquanto há QR/conectando; devagar quando estável.
  useEffect(() => {
    let vivo = true;
    const laco = async () => {
      let prox = 8000;
      try {
        const r = await carregar();
        if (r.estado === 'QR' || r.estado === 'CONECTANDO') prox = 2000;
      } catch {
        /* ignora */
      }
      if (vivo) timer.current = setTimeout(laco, prox);
    };
    laco();
    return () => {
      vivo = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [carregar]);

  async function conectar() {
    setOcupado(true);
    try {
      await api('/api/admin/whatsapp/conectar', { metodo: 'POST' });
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar o WhatsApp e apagar a sessão? Será preciso ler o QR de novo.')) return;
    setOcupado(true);
    try {
      await api('/api/admin/whatsapp/logout', { metodo: 'POST' });
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  const estado = st?.estado ?? 'DESCONECTADO';

  return (
    <>
      <h2>Conexão</h2>
      <div className="cartao">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={`ponto ${estado === 'CONECTADO' ? 'online' : 'offline'}`} />
          <strong>
            {estado === 'CONECTADO'
              ? `Conectado${st?.numero ? ` — ${st.numero}` : ''}`
              : estado === 'QR'
                ? 'Aguardando leitura do QR'
                : estado === 'CONECTANDO'
                  ? 'Conectando…'
                  : 'Desconectado'}
          </strong>
        </div>

        {estado === 'QR' && st?.qr && (
          <div style={{ margin: '10px 0' }}>
            <p className="subtitulo" style={{ marginTop: 0 }}>
              No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={st.qr} alt="QR do WhatsApp" width={260} height={260} style={{ borderRadius: 8 }} />
          </div>
        )}

        <div className="linha-acoes" style={{ gap: 10 }}>
          {estado !== 'CONECTADO' && (
            <button onClick={conectar} disabled={ocupado}>
              {ocupado ? 'Aguarde…' : estado === 'QR' ? 'Gerar novo QR' : 'Conectar'}
            </button>
          )}
          {estado !== 'DESCONECTADO' && (
            <button className="secundario" onClick={desconectar} disabled={ocupado}>
              Desconectar
            </button>
          )}
        </div>

        <p className="subtitulo" style={{ marginBottom: 0 }}>
          ⚠️ WhatsApp não-oficial (Baileys). Disparo em massa pode levar a bloqueio do número — use
          com moderação e intervalos espaçados.
        </p>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- disparo */
function Disparo() {
  const [filtros, setFiltros] = useState<FiltrosWhats>({ ativos: true });
  const [diasUso, setDiasUso] = useState(false);
  const [dias, setDias] = useState(30);
  const [mensagem, setMensagem] = useState('');
  const [usarNome, setUsarNome] = useState(true);
  const [min, setMin] = useState(10);
  const [max, setMax] = useState(40);

  const [previa, setPrevia] = useState<{ total: number; amostra: { nome: string; celular: string }[] } | null>(
    null
  );
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  function montarFiltros(): FiltrosWhats {
    const f: FiltrosWhats = { ...filtros };
    if (diasUso) f.diasDeUsoMin = dias;
    else delete f.diasDeUsoMin;
    return f;
  }

  const calcularPrevia = useCallback(async (f: FiltrosWhats) => {
    setCarregandoPrevia(true);
    try {
      const r = await api<{ total: number; amostra: { nome: string; celular: string }[] }>(
        '/api/admin/whatsapp/previa',
        { metodo: 'POST', corpo: { filtros: f } }
      );
      setPrevia(r);
    } finally {
      setCarregandoPrevia(false);
    }
  }, []);

  // Recalcula a prévia sempre que os filtros mudam (debounce).
  useEffect(() => {
    const f = montarFiltros();
    const t = setTimeout(() => calcularPrevia(f), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, diasUso, dias]);

  const previaTexto = aplicarNomeLocal(mensagem, NOME_EXEMPLO, usarNome);

  async function disparar() {
    setErro('');
    setOk('');
    setEnviando(true);
    try {
      const r = await api<CampanhaWhats>('/api/admin/whatsapp/campanhas', {
        metodo: 'POST',
        corpo: {
          mensagem,
          usarNome,
          filtros: montarFiltros(),
          intervaloMin: Number(min),
          intervaloMax: Number(max),
        },
      });
      setOk(`Campanha criada para ${r.totalAlvos} destinatário(s). O envio é gradual.`);
      setMensagem('');
      window.dispatchEvent(new Event('whats:campanhas'));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao criar campanha');
    } finally {
      setEnviando(false);
    }
  }

  const tri = (v: boolean | undefined) => (v === true ? 'sim' : v === false ? 'nao' : '');

  function setTri(chave: 'emailVerificado' | 'comArma', valor: string) {
    setFiltros((f) => {
      const n = { ...f };
      if (valor === 'sim') n[chave] = true;
      else if (valor === 'nao') n[chave] = false;
      else delete n[chave];
      return n;
    });
  }

  const intervaloInvalido = Number(min) > Number(max) || Number(min) < 5;

  return (
    <>
      <h2>Novo disparo</h2>
      <div className="cartao">
        <div className="campo">
          <label>Filtros (combináveis)</label>
          <div style={{ display: 'grid', gap: 10 }}>
            <label className="radio-opcao" style={{ width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={!!filtros.ativos}
                onChange={(e) => setFiltros((f) => ({ ...f, ativos: e.target.checked || undefined }))}
                style={{ width: 'auto' }}
              />
              Somente usuários ativos
            </label>

            <label className="radio-opcao" style={{ width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={!!filtros.comCadastro}
                onChange={(e) => setFiltros((f) => ({ ...f, comCadastro: e.target.checked || undefined }))}
                style={{ width: 'auto' }}
              />
              Cadastro completo (CPF + nome)
            </label>

            <SeletorTri
              rotulo="Conta validada (e-mail)"
              valor={tri(filtros.emailVerificado)}
              onChange={(v) => setTri('emailVerificado', v)}
              simLabel="Validadas"
              naoLabel="Sem validar"
            />

            <SeletorTri
              rotulo="Armas cadastradas"
              valor={tri(filtros.comArma)}
              onChange={(v) => setTri('comArma', v)}
              simLabel="Com arma"
              naoLabel="Sem arma"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label className="radio-opcao" style={{ width: 'fit-content' }}>
                <input
                  type="checkbox"
                  checked={diasUso}
                  onChange={(e) => setDiasUso(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Usando o app há mais de
              </label>
              <input
                type="number"
                min={1}
                value={dias}
                disabled={!diasUso}
                onChange={(e) => setDias(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <span className="subtitulo" style={{ margin: 0 }}>dias</span>
            </div>
          </div>

          <div className="ajuda-previa" style={{ marginTop: 10 }}>
            {carregandoPrevia ? (
              'Calculando destinatários…'
            ) : previa ? (
              <>
                <strong>{previa.total}</strong> destinatário(s) com telefone.{' '}
                {previa.amostra.length > 0 && (
                  <span className="subtitulo" style={{ margin: 0 }}>
                    Ex.: {previa.amostra.map((a) => `${a.nome} (${a.celular})`).join(', ')}
                  </span>
                )}
              </>
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="campo">
          <label>Mensagem *</label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={4096}
            placeholder="Olá {{nome}}, tudo bem? ..."
            style={{ minHeight: 110 }}
          />
          <label className="radio-opcao" style={{ width: 'fit-content', marginTop: 6 }}>
            <input
              type="checkbox"
              checked={usarNome}
              onChange={(e) => setUsarNome(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Personalizar com o primeiro nome{' '}
            <code style={{ marginLeft: 4 }}>{'{{nome}}'}</code>
          </label>
          {mensagem && (
            <div className="resultado-ok" style={{ marginTop: 8 }}>
              Prévia: {previaTexto || '—'}
            </div>
          )}
        </div>

        <div className="campo">
          <label>Intervalo entre mensagens (segundos)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="subtitulo" style={{ margin: 0 }}>de</span>
            <input type="number" min={5} value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ width: 90 }} />
            <span className="subtitulo" style={{ margin: 0 }}>a</span>
            <input type="number" min={5} value={max} onChange={(e) => setMax(Number(e.target.value))} style={{ width: 90 }} />
            <span className="subtitulo" style={{ margin: 0 }}>(aleatório, reduz risco de bloqueio)</span>
          </div>
          {intervaloInvalido && <p className="erro">Intervalo inválido (mín. 5s e mín. ≤ máx.).</p>}
        </div>

        {ok && <div className="resultado-ok">{ok}</div>}
        {erro && <p className="erro">{erro}</p>}

        <button
          onClick={disparar}
          disabled={enviando || !mensagem.trim() || !previa?.total || intervaloInvalido}
        >
          {enviando ? 'Criando…' : `Disparar${previa?.total ? ` para ${previa.total}` : ''}`}
        </button>
      </div>
    </>
  );
}

function SeletorTri({
  rotulo,
  valor,
  onChange,
  simLabel,
  naoLabel,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  simLabel: string;
  naoLabel: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ minWidth: 190 }}>{rotulo}</span>
      <div className="radio-linha">
        {[
          { v: '', l: 'Tanto faz' },
          { v: 'sim', l: simLabel },
          { v: 'nao', l: naoLabel },
        ].map((o) => (
          <label key={o.v} className={`radio-opcao ${valor === o.v ? 'sel' : ''}`}>
            <input
              type="radio"
              checked={valor === o.v}
              onChange={() => onChange(o.v)}
              style={{ width: 'auto' }}
            />
            {o.l}
          </label>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- campanhas */
function Campanhas() {
  const [campanhas, setCampanhas] = useState<CampanhaWhats[]>([]);

  const carregar = useCallback(async () => {
    const r = await api<{ campanhas: CampanhaWhats[] }>('/api/admin/whatsapp/campanhas?limite=30');
    setCampanhas(r.campanhas);
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 10000); // progresso ao vivo
    const h = () => carregar();
    window.addEventListener('whats:campanhas', h);
    return () => {
      clearInterval(t);
      window.removeEventListener('whats:campanhas', h);
    };
  }, [carregar]);

  async function acao(id: string, acao: 'pausar' | 'retomar' | 'cancelar') {
    await api(`/api/admin/whatsapp/campanhas/${id}/${acao}`, { metodo: 'POST' });
    carregar();
  }

  return (
    <>
      <h2>Campanhas</h2>
      <div className="cartao" style={{ padding: 0 }}>
        {campanhas.length === 0 ? (
          <div className="vazio">Nenhuma campanha ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Mensagem</th>
                <th>Progresso</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => (
                <tr key={c.id}>
                  <td>{dataHora(c.criadoEm)}</td>
                  <td style={{ maxWidth: 320 }}>
                    <span title={c.mensagem}>
                      {c.mensagem.length > 70 ? c.mensagem.slice(0, 70) + '…' : c.mensagem}
                    </span>
                  </td>
                  <td>
                    {c.totalEnviados}/{c.totalAlvos}
                    {c.totalFalhas > 0 && <span className="perigo"> · {c.totalFalhas} falha(s)</span>}
                  </td>
                  <td>{ROTULO_STATUS_CAMPANHA[c.status]}</td>
                  <td>
                    <div className="linha-acoes" style={{ gap: 6 }}>
                      {c.status === 'EM_ANDAMENTO' && (
                        <button className="secundario pequeno" onClick={() => acao(c.id, 'pausar')}>
                          Pausar
                        </button>
                      )}
                      {c.status === 'PAUSADA' && (
                        <button className="secundario pequeno" onClick={() => acao(c.id, 'retomar')}>
                          Retomar
                        </button>
                      )}
                      {(c.status === 'EM_ANDAMENTO' || c.status === 'PAUSADA') && (
                        <button className="secundario pequeno perigo" onClick={() => acao(c.id, 'cancelar')}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** Espelha a personalização do servidor para a prévia na tela. */
function aplicarNomeLocal(texto: string, nome: string, usarNome: boolean): string {
  const alvo = usarNome ? nome : '';
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, alvo)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .trim();
}
