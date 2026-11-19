'use client';

import Link from 'next/link';
import { categoriaPlano, PLANO_META } from '@/lib/tipos';
import type { UsuarioApp } from '@/lib/tipos';
import { tempoRelativo } from '@/lib/formato';

// Colunas PADRÃO de usuário, reaproveitadas em TODAS as listagens (usuários,
// churn, dashboard, notícias, push) para manter as mesmas colunas em todo lugar.
// Não inclui "Armas SH" (consulta externa sob demanda, exclusiva da tela
// principal de /usuarios) nem ordenação por coluna.

/** dd/mm/aaaa (ou — quando ausente). */
export function formatarData(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Celular só-dígitos como (DD) 9XXXX-XXXX. */
export function formatarCelular(c?: string | null): string | null {
  if (!c) return null;
  const d = c.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return c;
}

/** Ícone da plataforma do aparelho (Apple para iOS, robô para Android). */
export function IconePlataforma({ plataforma }: { plataforma: string }) {
  const ios = plataforma === 'IOS';
  const cor = ios ? 'var(--texto)' : '#3DDC84';
  return (
    <span
      title={ios ? 'iOS' : 'Android'}
      aria-label={ios ? 'iOS' : 'Android'}
      style={{ display: 'inline-flex', verticalAlign: 'middle' }}
    >
      {ios ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={cor} aria-hidden="true">
          <path d="M16.37 1.43c.06 1.02-.33 2-1 2.73-.7.77-1.84 1.37-2.94 1.28-.09-1 .4-2.03 1.05-2.72.72-.77 1.96-1.34 2.89-1.29zM20.3 17.2c-.5 1.16-.74 1.67-1.39 2.69-.9 1.42-2.17 3.19-3.75 3.2-1.4.02-1.76-.92-3.66-.9-1.9.01-2.3.92-3.7.9-1.58-.01-2.78-1.6-3.69-3.03C1.5 16.1 1.24 11.4 2.82 8.92c1.12-1.77 2.9-2.8 4.57-2.8 1.7 0 2.77.93 4.18.93 1.37 0 2.2-.93 4.17-.93 1.49 0 3.07.81 4.2 2.21-3.69 2.02-3.09 7.29.36 8.87z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={cor} aria-hidden="true">
          <path d="M6 9v7a1.5 1.5 0 0 0 1.5 1.5H8V21a1 1 0 0 0 2 0v-3.5h4V21a1 1 0 0 0 2 0v-3.5h.5A1.5 1.5 0 0 0 18 16V9H6zm-2.5 0A1.5 1.5 0 0 0 2 10.5v4a1.5 1.5 0 0 0 3 0v-4A1.5 1.5 0 0 0 3.5 9zm17 0A1.5 1.5 0 0 0 19 10.5v4a1.5 1.5 0 0 0 3 0v-4A1.5 1.5 0 0 0 20.5 9zM7.8 7.6h8.4c.2 0 .3-.2.3-.4 0-1.5-.86-2.82-2.16-3.57l.86-1.3a.3.3 0 0 0-.5-.33l-.9 1.35A5.3 5.3 0 0 0 12 2.9c-.64 0-1.26.1-1.84.3l-.9-1.34a.3.3 0 1 0-.5.33l.86 1.3C8.32 4.38 7.5 5.7 7.5 7.2c0 .22.1.4.3.4zm1.7-2.1a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2zm5 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2z" />
        </svg>
      )}
    </span>
  );
}

/** Cabeçalho (<th>) das colunas padrão de usuário. */
export function CabecalhoUsuario() {
  return (
    <>
      <th>Usuário</th>
      <th style={{ textAlign: 'center' }}>E-mail</th>
      <th>Telefone</th>
      <th>Plano</th>
      <th>Criado</th>
      <th>Último acesso</th>
      <th>Entidades</th>
      <th>Armas</th>
      <th>Disp.</th>
      <th>Versão</th>
    </>
  );
}

/** Quantas colunas o cabeçalho/células de usuário ocupam (p/ colSpan de vazio). */
export const COLUNAS_USUARIO = 10;

/**
 * Células (<td>) das colunas padrão de um usuário. Deve ser usada dentro de um
 * <tr>, na mesma ordem de {@link CabecalhoUsuario}. `linkPerfil` (padrão true)
 * transforma o nome em link para /usuarios/[id].
 */
export function CelulasUsuario({
  u,
  linkPerfil = true,
  churn = false,
}: {
  u: UsuarioApp;
  linkPerfil?: boolean;
  /** Churn consumado: mostra uma etiqueta "Churn" vermelha no lugar do plano. */
  churn?: boolean;
}) {
  const meta = PLANO_META[categoriaPlano(u.premium, u.premiumTipo)];
  return (
    <>
      <td>
        {linkPerfil ? (
          <Link href={`/usuarios/${u.id}`}>{u.nome}</Link>
        ) : (
          <span>{u.nome}</span>
        )}
        <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{u.email}</div>
      </td>
      <td style={{ textAlign: 'center' }}>
        {u.emailVerificado ? (
          <span title="E-mail confirmado" style={{ color: 'var(--ok)', fontSize: 16, fontWeight: 700 }}>
            ✓
          </span>
        ) : (
          <span title="E-mail não confirmado" style={{ color: '#c99a2e', fontSize: 15 }}>
            ⧗
          </span>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {formatarCelular(u.celular) ?? <span style={{ color: 'var(--texto-suave)' }}>—</span>}
      </td>
      <td>
        {churn ? (
          <span
            className="etiqueta"
            title="Assinatura encerrada — o usuário perdeu o acesso Premium"
            style={{ borderColor: 'var(--perigo, #d0585a)', color: 'var(--perigo, #d0585a)' }}
          >
            Churn
          </span>
        ) : (
          <span className={`etiqueta ${meta.classe}`}>{meta.rotulo}</span>
        )}
      </td>
      <td
        style={{ whiteSpace: 'nowrap', color: 'var(--texto-suave)', fontSize: 13 }}
        title={u.criadoEm ? new Date(u.criadoEm).toLocaleString('pt-BR') : undefined}
      >
        {formatarData(u.criadoEm)}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className={`ponto ${u.online ? 'online' : 'offline'}`} />
        {u.online ? 'online' : tempoRelativo(u.ultimoAcessoEm)}
      </td>
      <td>
        {!u.entidades || u.entidades.length === 0 ? (
          <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {u.entidades.map((e) => (
              <span key={e.id} className="etiqueta">
                {e.nome}
              </span>
            ))}
          </div>
        )}
      </td>
      <td title="Armas cadastradas no app">{u.armasSistema ?? 0}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(u.plataformas ?? []).map((pl) => (
            <IconePlataforma key={pl} plataforma={pl} />
          ))}
          <span>{u.dispositivos ?? 0}</span>
        </div>
      </td>
      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {u.appVersao ?? <span style={{ color: 'var(--texto-suave)' }}>—</span>}
      </td>
    </>
  );
}
