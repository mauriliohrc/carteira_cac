import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { apiApp, ErroConta } from './api';
import {
  guardarSessao,
  guardarUsuario,
  lerToken,
  lerUsuarioCache,
  limparSessao,
} from './armazenamento';
import type { UsuarioApp } from './tipos';
import { desassociarDispositivo, registrarDispositivo } from '@/push/registro';
import { limparAcervoLocal } from '@/db/sync';
import { CHAVES, lerConfig } from '@/db/config';

interface RespostaAuth {
  token: string;
  usuario: UsuarioApp;
}

interface Conta {
  /** null = deslogado (usando o app offline). */
  usuario: UsuarioApp | null;
  /** Enquanto restaura a sessão guardada, no boot. */
  carregando: boolean;
  logado: boolean;
  cadastrar: (dados: {
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    /** Opcional — número para contato e suporte. */
    celular?: string | null;
  }) => Promise<void>;
  /** descartarLocal: ignora o acervo do aparelho e traz só o da nuvem (true), ou mescla (false). */
  entrar: (email: string, senha: string, descartarLocal?: boolean) => Promise<void>;
  /** limparDados: apaga o acervo local (true) ou mantém anônimo no aparelho (false). */
  sair: (limparDados: boolean) => Promise<void>;
  /** Pede o reset; em dev o servidor devolve o código para teste. */
  pedirResetSenha: (email: string) => Promise<{ codigoDev?: string }>;
  redefinirSenha: (email: string, codigo: string, senha: string) => Promise<void>;
  /** Dispara o e-mail com o código de confirmação da conta logada. */
  enviarCodigoEmail: () => Promise<{ codigoDev?: string; jaVerificado?: boolean }>;
  /** Confirma o e-mail com o código; atualiza o usuário em memória/cache. */
  confirmarEmail: (codigo: string) => Promise<void>;
  /** Troca a senha do usuário logado (exige a senha atual). */
  alterarSenha: (senhaAtual: string, senhaNova: string) => Promise<void>;
}

const Contexto = createContext<Conta | null>(null);

export function ContaProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Boot: restaura a sessão do SecureStore. Mostra o usuário em cache na hora
  // e revalida com o servidor em segundo plano — sem travar o app offline.
  useEffect(() => {
    let vivo = true;
    (async () => {
      // Instalação nova: no iOS o SecureStore (keychain) SOBREVIVE à
      // desinstalação, mas o SQLite não. Se o onboarding ainda não foi visto,
      // é um reinstall — a sessão guardada é órfã da instalação anterior e faria
      // o app "logar sozinho". Descarta antes de restaurar. (Espelha a limpeza
      // da tranca em limparTrancaSeInstalacaoNova.)
      const jaViu = (await lerConfig(CHAVES.onboardingVisto).catch(() => null)) === '1';
      if (!jaViu) await limparSessao().catch(() => {});

      const token = await lerToken();
      if (!token) {
        // Anônimo: registra o aparelho mesmo assim, para alcançar "Todos".
        void registrarDispositivo();
        return;
      }
      const cache = await lerUsuarioCache();
      if (vivo && cache) setUsuario(cache);

      try {
        const r = await apiApp<{ usuario: UsuarioApp }>('/auth/eu', { token });
        if (!vivo) return;
        setUsuario(r.usuario);
        await guardarUsuario(r.usuario);
        void registrarDispositivo(token); // garante o token de push a cada boot
      } catch (e) {
        // Token rejeitado: encerra a sessão. Falha de rede: mantém o cache.
        if (e instanceof ErroConta && !e.offline) {
          await limparSessao();
          if (vivo) setUsuario(null);
        }
      }
    })()
      .catch(() => {})
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Revalida o usuário no servidor (fonte de verdade da verificação de
  // e-mail/conta). Chamado logo após login/cadastro para o app refletir o
  // estado atual na hora — inclusive se o e-mail foi confirmado em outro
  // aparelho — sem esperar o próximo boot.
  const atualizarUsuario = useCallback(async (token?: string) => {
    const t = token ?? (await lerToken());
    if (!t) return;
    try {
      const r = await apiApp<{ usuario: UsuarioApp }>('/auth/eu', { token: t });
      setUsuario(r.usuario);
      await guardarUsuario(r.usuario);
    } catch {
      /* mantém o usuário que veio do login/cadastro */
    }
  }, []);

  const aplicar = useCallback(
    async (r: RespostaAuth) => {
      await guardarSessao(r.token, r.usuario);
      setUsuario(r.usuario);
      void registrarDispositivo(r.token); // registra push após login/cadastro
      void atualizarUsuario(r.token); // revalida verificação de e-mail/conta já
    },
    [atualizarUsuario]
  );

  const cadastrar = useCallback<Conta['cadastrar']>(
    async (dados) => {
      const r = await apiApp<RespostaAuth>('/auth/cadastro', { metodo: 'POST', corpo: dados });
      await aplicar(r);
    },
    [aplicar]
  );

  const entrar = useCallback<Conta['entrar']>(
    async (email, senha, descartarLocal = false) => {
      const r = await apiApp<RespostaAuth>('/auth/login', {
        metodo: 'POST',
        corpo: { email, senha },
      });
      // "Usar só os dados da nuvem": zera o acervo local antes de aplicar a
      // sessão, então a sincronização não sobe nada e só baixa o da nuvem.
      if (descartarLocal) {
        try {
          await limparAcervoLocal();
        } catch {
          /* segue mesmo assim */
        }
      }
      await aplicar(r);
    },
    [aplicar]
  );

  const sair = useCallback(async (limparDados: boolean) => {
    const token = await lerToken();
    // Logout instantâneo e local. O usuário escolhe manter o acervo de forma
    // anônima no aparelho ou apagar tudo.
    await limparSessao();
    if (limparDados) {
      try {
        await limparAcervoLocal();
      } catch {
        /* não bloqueia o logout */
      }
    }
    setUsuario(null);
    if (token) {
      void desassociarDispositivo();
      void apiApp('/auth/logout', { metodo: 'POST', token }).catch(() => {});
    }
  }, []);

  const pedirResetSenha = useCallback<Conta['pedirResetSenha']>(async (email) => {
    const r = await apiApp<{ ok: true; codigo?: string }>('/auth/senha/esqueci', {
      metodo: 'POST',
      corpo: { email },
    });
    return { codigoDev: r.codigo };
  }, []);

  const redefinirSenha = useCallback<Conta['redefinirSenha']>(async (email, codigo, senha) => {
    await apiApp('/auth/senha/redefinir', { metodo: 'POST', corpo: { email, codigo, senha } });
  }, []);

  const enviarCodigoEmail = useCallback<Conta['enviarCodigoEmail']>(async () => {
    const token = await lerToken();
    const r = await apiApp<{ ok: true; enviado: boolean; codigo?: string; jaVerificado?: boolean }>(
      '/auth/email/enviar',
      { metodo: 'POST', token }
    );
    return { codigoDev: r.codigo, jaVerificado: r.jaVerificado };
  }, []);

  const confirmarEmail = useCallback<Conta['confirmarEmail']>(async (codigo) => {
    const token = await lerToken();
    const r = await apiApp<{ ok: true; usuario: UsuarioApp }>('/auth/email/confirmar', {
      metodo: 'POST',
      token,
      corpo: { codigo },
    });
    setUsuario(r.usuario);
    await guardarUsuario(r.usuario);
  }, []);

  const alterarSenha = useCallback<Conta['alterarSenha']>(async (senhaAtual, senhaNova) => {
    const token = await lerToken();
    await apiApp('/auth/senha/alterar', { metodo: 'POST', token, corpo: { senhaAtual, senhaNova } });
  }, []);

  const valor = useMemo<Conta>(
    () => ({
      usuario,
      carregando,
      logado: usuario !== null,
      cadastrar,
      entrar,
      sair,
      pedirResetSenha,
      redefinirSenha,
      enviarCodigoEmail,
      confirmarEmail,
      alterarSenha,
    }),
    [
      usuario,
      carregando,
      cadastrar,
      entrar,
      sair,
      pedirResetSenha,
      redefinirSenha,
      enviarCodigoEmail,
      confirmarEmail,
      alterarSenha,
    ]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useConta(): Conta {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useConta precisa estar dentro de <ContaProvider>');
  return ctx;
}
