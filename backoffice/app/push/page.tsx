'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ErroApi } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import type { AppVersoes, Entidade, EnvioPush, PublicoPush, UsuarioApp } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

type Base = PublicoPush['base'];
type Plataforma = 'IOS' | 'ANDROID';

const ROTULO_BASE: Record<Base, string> = {
  CONTAS: 'Com conta',
  TODOS: 'Todos (contas + anônimos)',
  ANONIMOS: 'Sem cadastro (anônimos)',
  USUARIO: 'Um usuário',
};

export default function PaginaPush() {
  return (
    <Protegido>
      <Suspense fallback={<div className="vazio">Carregando…</div>}>
        <Push />
      </Suspense>
    </Protegido>
  );
}

/**
 * Destino ao tocar no push: vira `dados.tela` (rota literal), que o app resolve
 * em `hrefDeDados`. Retrocompatível — apps que não conhecem a rota só abrem
 * normalmente. 'premium' leva ao paywall (o app manda quem já é Premium pro
 * acervo). '' = sem destino (abre a caixa de avisos).
 */
const DESTINOS_PUSH: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Nenhum (abre o app)' },
  { valor: '/(tabs)/acervo', rotulo: 'Acervo' },
  { valor: '/(tabs)/despachante', rotulo: 'Serviços' },
  { valor: '/(tabs)/pessoais', rotulo: 'Meus docs' },
  { valor: '/premium', rotulo: 'Paywall (assinatura)' },
];

function CartaoNumero({ titulo, valor, cor }: { titulo: string; valor: number; cor?: string }) {
  return (
    <div
      style={{
        minWidth: 110,
        flex: '1 1 110px',
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid var(--borda, #e2e2e2)',
        background: 'var(--fundo-suave, #fafafa)',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: cor ?? 'var(--texto, #222)' }}>{valor}</div>
      <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{titulo}</div>
    </div>
  );
}

function Push() {
  const sp = useSearchParams();
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [destino, setDestino] = useState('');

  // Público = filtros combináveis (AND).
  const [base, setBase] = useState<Base>('CONTAS');
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]); // vazio = todas
  const [usuarioId, setUsuarioId] = useState('');
  const [usuarioNome, setUsuarioNome] = useState('');
  const [entidadeAtiva, setEntidadeAtiva] = useState(false);
  const [entidadeId, setEntidadeId] = useState('');
  const [excluirEntidades, setExcluirEntidades] = useState(false);
  const [excluirIds, setExcluirIds] = useState<string[]>([]);
  const [soDesatualizados, setSoDesatualizados] = useState(false);
  const [versoes, setVersoes] = useState<AppVersoes | null>(null);
  const [semArma, setSemArma] = useState(false);
  const [semEmail, setSemEmail] = useState(false);
  const [inativosAtivo, setInativosAtivo] = useState(false);
  const [dias, setDias] = useState(30);

  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [historico, setHistorico] = useState<EnvioPush[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);

  // ---- Lembrete de habitualidade (push personalizado por usuário) ----
  const [tituloFalta, setTituloFalta] = useState('🎯 Faltam {faltam} habitualidades');
  const [corpoFalta, setCorpoFalta] = useState(
    'Olá {nome}! Faltam apenas {faltam} habitualidades para ficar ok no período de 12 meses. Vá ao clube ou lance suas habitualidades!'
  );
  const [incluirEmDia, setIncluirEmDia] = useState(false);
  const [tituloOk, setTituloOk] = useState('🎯 Habitualidade em dia!');
  const [corpoOk, setCorpoOk] = useState(
    'Parabéns {nome}! Suas {feitas} habitualidades estão em dia nos últimos 12 meses. Continue assim!'
  );
  const [enviandoHab, setEnviandoHab] = useState(false);
  const [erroHab, setErroHab] = useState('');
  const [resultadoHab, setResultadoHab] = useState<string | null>(null);

  // Filtros de conta só valem para público com conta.
  const permiteFiltroConta = base === 'CONTAS' || base === 'TODOS';

  // Prefill vindo da lista de usuários ("Notificar").
  useEffect(() => {
    const uid = sp.get('usuarioId');
    const nome = sp.get('nome');
    if (uid) {
      setBase('USUARIO');
      setUsuarioId(uid);
      setUsuarioNome(nome ?? uid);
    }
  }, [sp]);

  const carregarHistorico = useCallback(async () => {
    const r = await api<{ envios: EnvioPush[] }>('/api/admin/push?limite=20');
    setHistorico(r.envios);
  }, []);

  useEffect(() => {
    api<{ entidades: Entidade[] }>('/api/admin/entidades').then((r) => setEntidades(r.entidades));
    api<AppVersoes>('/api/admin/app-versoes').then(setVersoes).catch(() => {});
    carregarHistorico();
  }, [carregarHistorico]);

  function alternarExcluir(id: string) {
    setExcluirIds((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  function alternarPlataforma(p: Plataforma) {
    setPlataformas((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]));
  }

  function montarPublico(): PublicoPush {
    const pub: PublicoPush = { base };
    if (plataformas.length) pub.plataformas = plataformas;
    if (base === 'USUARIO') pub.usuarioId = usuarioId;
    if (permiteFiltroConta) {
      if (entidadeAtiva && entidadeId) pub.entidadeId = entidadeId;
      if (semArma) pub.semArma = true;
      if (semEmail) pub.semEmail = true;
      if (inativosAtivo && dias >= 1) pub.inativosDias = Number(dias);
    }
    // Exclusão por entidade e filtro de versão valem para qualquer base.
    if (excluirEntidades && excluirIds.length) pub.excluirEntidadeIds = excluirIds;
    if (soDesatualizados && versoes?.latest) pub.versaoMenorQue = versoes.latest;
    return pub;
  }

  const publicoValido =
    (base !== 'USUARIO' || !!usuarioId) &&
    (!permiteFiltroConta || !entidadeAtiva || !!entidadeId) &&
    (!permiteFiltroConta || !inativosAtivo || dias >= 1);

  async function enviar() {
    setErro('');
    setResultado(null);
    setEnviando(true);
    try {
      const r = await api<{ totalUsuarios: number; totalTokens: number; aceitos: number; falhas: number }>(
        '/api/admin/push',
        {
          metodo: 'POST',
          corpo: {
            titulo,
            corpo,
            // Só manda `dados` quando há destino escolhido.
            ...(destino ? { dados: { tela: destino } } : {}),
            publico: montarPublico(),
          },
        }
      );
      setResultado(
        `Enviado para ${r.totalUsuarios} usuário(s) · ${r.totalTokens} dispositivo(s) · ${r.aceitos} aceito(s)` +
          (r.falhas ? ` · ${r.falhas} falha(s)` : '')
      );
      setTitulo('');
      setCorpo('');
      setDestino('');
      carregarHistorico();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao enviar');
    } finally {
      setEnviando(false);
    }
  }

  type RespostaHab = {
    simulado: boolean;
    usuariosAvaliados: number;
    usuariosFalta: number;
    usuariosEmDia: number;
    usuariosSemObrigacao: number;
    usuariosSemDispositivo: number;
    totalTokens: number;
    aceitos: number;
    falhas: number;
  };

  async function dispararHabitualidade(simular: boolean) {
    setErroHab('');
    setResultadoHab(null);
    setEnviandoHab(true);
    try {
      const r = await api<RespostaHab>('/api/admin/push/habitualidade', {
        metodo: 'POST',
        corpo: {
          tituloFalta,
          corpoFalta,
          incluirEmDia,
          tituloOk: incluirEmDia ? tituloOk : undefined,
          corpoOk: incluirEmDia ? corpoOk : undefined,
          simular,
          publico: montarPublico(),
        },
      });
      const base =
        `${r.usuariosFalta} com habitualidade faltando` +
        (incluirEmDia ? ` · ${r.usuariosEmDia} em dia` : '') +
        ` · ${r.totalTokens} dispositivo(s)` +
        ` · ${r.usuariosSemObrigacao} sem obrigação` +
        (r.usuariosSemDispositivo ? ` · ${r.usuariosSemDispositivo} sem aparelho` : '');
      setResultadoHab(
        r.simulado
          ? `Prévia (nada enviado): ${base}`
          : `Enviado! ${base} · ${r.aceitos} aceito(s)` + (r.falhas ? ` · ${r.falhas} falha(s)` : '')
      );
      if (!r.simulado) carregarHistorico();
    } catch (e) {
      setErroHab(e instanceof ErroApi ? e.message : 'Falha ao disparar');
    } finally {
      setEnviandoHab(false);
    }
  }

  return (
    <>
      <h1>Enviar push</h1>
      <p className="subtitulo">Notificação para os usuários do aplicativo.</p>

      {/* ---------- Versões do app (estatística em cards) ---------- */}
      {versoes && (
        <div className="cartao" style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600 }}>Versões do app</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '10px 0' }}>
            <CartaoNumero titulo="Com conta" valor={versoes.totalUsuarios} />
            <CartaoNumero
              titulo={`Na última${versoes.latest ? ` (${versoes.latest})` : ''}`}
              valor={versoes.versoes.find((v) => v.versao === versoes.latest)?.usuarios ?? 0}
              cor="#1a7f37"
            />
            <CartaoNumero titulo="Desatualizados" valor={versoes.desatualizados} cor="#b25000" />
            <CartaoNumero titulo="Sem versão" valor={versoes.desconhecidos} cor="var(--texto-suave)" />
          </div>
          {versoes.versoes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {versoes.versoes.map((v) => (
                <span
                  key={v.versao ?? 'desc'}
                  style={{
                    fontSize: 12,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: 'var(--fundo-suave, #f0f0f0)',
                    border: '1px solid var(--borda, #ddd)',
                    color:
                      v.versao && v.versao !== versoes.latest ? '#b25000' : 'var(--texto, #222)',
                  }}
                >
                  {v.versao ?? 'sem versão'} · {v.usuarios}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="cartao">
        <div className="campo">
          <label>Título *</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        </div>
        <div className="campo">
          <label>Mensagem *</label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            maxLength={1000}
            style={{ minHeight: 90 }}
          />
        </div>

        {/* ---------- Abrir ao tocar (deep link) ---------- */}
        <div className="campo">
          <label>Abrir ao tocar</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            {DESTINOS_PUSH.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.rotulo}
              </option>
            ))}
          </select>
          <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>
            Para onde o app vai quando o usuário toca na notificação.
          </span>
        </div>

        {/* ---------- Plataforma (checklist) ---------- */}
        <div className="campo">
          <label>Plataforma</label>
          <div className="radio-linha">
            {(['IOS', 'ANDROID'] as Plataforma[]).map((p) => (
              <label key={p} className={`radio-opcao ${plataformas.includes(p) ? 'sel' : ''}`}>
                <input
                  type="checkbox"
                  checked={plataformas.includes(p)}
                  onChange={() => alternarPlataforma(p)}
                  style={{ width: 'auto' }}
                />
                {p === 'IOS' ? 'iOS' : 'Android'}
              </label>
            ))}
          </div>
          <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>
            {plataformas.length === 0 || plataformas.length === 2
              ? 'Todas as plataformas'
              : `Só ${plataformas[0] === 'IOS' ? 'iOS' : 'Android'}`}
          </span>
        </div>

        {/* ---------- Excluir entidades + desatualizados (qualquer base) ---------- */}
        <div className="campo">
          <label>Refinos do envio</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="radio-opcao" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={excluirEntidades}
                onChange={(e) => setExcluirEntidades(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Excluir entidades do envio
            </label>
            {excluirEntidades && (
              <div style={{ marginLeft: 26, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {entidades.map((e) => (
                  <label
                    key={e.id}
                    className={`radio-opcao ${excluirIds.includes(e.id) ? 'sel' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={excluirIds.includes(e.id)}
                      onChange={() => alternarExcluir(e.id)}
                      style={{ width: 'auto' }}
                    />
                    {e.nome}
                  </label>
                ))}
                {entidades.length === 0 && (
                  <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>Nenhuma entidade.</span>
                )}
              </div>
            )}

            <label
              className="radio-opcao"
              style={{ cursor: versoes?.latest ? 'pointer' : 'not-allowed', opacity: versoes?.latest ? 1 : 0.6 }}
            >
              <input
                type="checkbox"
                checked={soDesatualizados}
                onChange={(e) => setSoDesatualizados(e.target.checked)}
                disabled={!versoes?.latest}
                style={{ width: 'auto' }}
              />
              Só desatualizados{' '}
              {versoes?.latest ? `(versão < ${versoes.latest})` : '(sem dados de versão)'}
            </label>
          </div>
        </div>

        {/* ---------- Público base (radio) ---------- */}
        <div className="campo">
          <label>Público</label>
          <div className="radio-linha">
            {(Object.keys(ROTULO_BASE) as Base[]).map((b) => (
              <label key={b} className={`radio-opcao ${base === b ? 'sel' : ''}`}>
                <input
                  type="radio"
                  name="base"
                  checked={base === b}
                  onChange={() => setBase(b)}
                  style={{ width: 'auto' }}
                />
                {ROTULO_BASE[b]}
              </label>
            ))}
          </div>

          {base === 'USUARIO' && (
            <BuscaUsuario
              selecionadoId={usuarioId}
              selecionadoNome={usuarioNome}
              aoEscolher={(u) => {
                setUsuarioId(u.id);
                setUsuarioNome(u.nome);
              }}
            />
          )}
        </div>

        {/* ---------- Filtros de conta (checklist, combináveis) ---------- */}
        {permiteFiltroConta && (
          <div className="campo">
            <label>Filtros (combináveis)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={entidadeAtiva}
                  onChange={(e) => setEntidadeAtiva(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Vinculados a uma entidade
              </label>
              {entidadeAtiva && (
                <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)} style={{ marginLeft: 26, maxWidth: 360 }}>
                  <option value="">— escolha uma entidade —</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              )}

              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={semArma} onChange={(e) => setSemArma(e.target.checked)} style={{ width: 'auto' }} />
                Sem arma cadastrada
              </label>

              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={semEmail} onChange={(e) => setSemEmail(e.target.checked)} style={{ width: 'auto' }} />
                E-mail não validado
              </label>

              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inativosAtivo}
                  onChange={(e) => setInativosAtivo(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Inativos
              </label>
              {inativosAtivo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 26 }}>
                  <span style={{ color: 'var(--texto-suave)', fontSize: 14 }}>Sem acessar há mais de</span>
                  <input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} style={{ width: 90 }} />
                  <span style={{ color: 'var(--texto-suave)', fontSize: 14 }}>dias</span>
                </div>
              )}
            </div>
          </div>
        )}

        {resultado && <div className="resultado-ok">{resultado}</div>}
        {erro && <p className="erro">{erro}</p>}

        <button onClick={enviar} disabled={enviando || !titulo || !corpo || !publicoValido}>
          {enviando ? 'Enviando…' : 'Enviar push'}
        </button>
      </div>

      <h2>Lembrete de habitualidade</h2>
      <p className="subtitulo">
        Push personalizado: cada usuário recebe quantas habitualidades faltam para ficar em dia nos
        últimos 12 meses. Usa o <strong>mesmo público selecionado acima</strong> (quem não é atirador
        é ignorado automaticamente).
      </p>

      <div className="cartao">
        <div
          style={{
            background: 'var(--fundo-suave, rgba(0,0,0,.04))',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 14,
            fontSize: 13,
            color: 'var(--texto-suave)',
          }}
        >
          Variáveis: <code>{'{nome}'}</code> (primeiro nome) · <code>{'{faltam}'}</code> (quantas
          faltam) · <code>{'{feitas}'}</code> (habitualidades nos últimos 12 meses)
        </div>

        <div className="campo">
          <label>Título — quem está faltando *</label>
          <input value={tituloFalta} onChange={(e) => setTituloFalta(e.target.value)} maxLength={120} />
        </div>
        <div className="campo">
          <label>Mensagem — quem está faltando *</label>
          <textarea
            value={corpoFalta}
            onChange={(e) => setCorpoFalta(e.target.value)}
            maxLength={1000}
            style={{ minHeight: 80 }}
          />
        </div>

        <div className="campo">
          <label className="radio-opcao" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={incluirEmDia}
              onChange={(e) => setIncluirEmDia(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Também avisar quem já está em dia
          </label>
        </div>

        {incluirEmDia && (
          <>
            <div className="campo">
              <label>Título — quem está em dia *</label>
              <input value={tituloOk} onChange={(e) => setTituloOk(e.target.value)} maxLength={120} />
            </div>
            <div className="campo">
              <label>Mensagem — quem está em dia *</label>
              <textarea
                value={corpoOk}
                onChange={(e) => setCorpoOk(e.target.value)}
                maxLength={1000}
                style={{ minHeight: 80 }}
              />
            </div>
          </>
        )}

        {resultadoHab && <div className="resultado-ok">{resultadoHab}</div>}
        {erroHab && <p className="erro">{erroHab}</p>}

        <div className="linha-acoes" style={{ gap: 10 }}>
          <button
            className="secundario"
            onClick={() => dispararHabitualidade(true)}
            disabled={enviandoHab || !tituloFalta || !corpoFalta || !publicoValido}
          >
            {enviandoHab ? 'Calculando…' : 'Simular (não envia)'}
          </button>
          <button
            onClick={() => dispararHabitualidade(false)}
            disabled={enviandoHab || !tituloFalta || !corpoFalta || !publicoValido}
          >
            {enviandoHab ? 'Enviando…' : 'Enviar lembrete'}
          </button>
        </div>
      </div>

      <h2>Histórico</h2>
      <div className="cartao" style={{ padding: 0 }}>
        {historico.length === 0 ? (
          <div className="vazio">Nenhum envio ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Título</th>
                <th>Público</th>
                <th>Usuários</th>
                <th>Aceitos</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.criadoEm)}</td>
                  <td>{e.titulo}</td>
                  <td>{e.alvoTipo}</td>
                  <td>{e.totalUsuarios}</td>
                  <td>
                    {e.totalAceitos}/{e.totalTokens}
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

function BuscaUsuario({
  selecionadoId,
  selecionadoNome,
  aoEscolher,
}: {
  selecionadoId: string;
  selecionadoNome: string;
  aoEscolher: (u: UsuarioApp) => void;
}) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<UsuarioApp[]>([]);

  useEffect(() => {
    if (termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<{ usuarios: UsuarioApp[] }>(
        `/api/admin/usuarios-app?busca=${encodeURIComponent(termo.trim())}&limite=8`
      );
      setResultados(r.usuarios);
    }, 250);
    return () => clearTimeout(t);
  }, [termo]);

  if (selecionadoId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span>
          Para: <strong>{selecionadoNome}</strong>
        </span>
        <button className="secundario pequeno" onClick={() => aoEscolher({ id: '', nome: '' } as UsuarioApp)}>
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input
        placeholder="Buscar usuário por nome, e-mail ou CPF…"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {resultados.length > 0 && (
        <div className="cartao" style={{ marginTop: 6, padding: 6 }}>
          {resultados.map((u) => (
            <div
              key={u.id}
              onClick={() => {
                aoEscolher(u);
                setTermo('');
                setResultados([]);
              }}
              style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6 }}
            >
              {u.nome} <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>· {u.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
