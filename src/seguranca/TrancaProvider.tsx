import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  biometriaAtiva as lerBiometriaAtiva,
  biometriaDoAparelho,
  limparTrancaSeInstalacaoNova,
  temPin as lerTemPin,
  type EstadoBiometria,
} from './tranca';

interface EstadoTranca {
  /** Terminou a checagem inicial — evita piscar a tela por baixo da tranca. */
  pronta: boolean;
  temPin: boolean;
  bloqueado: boolean;
  /** Sensor disponível e biometria cadastrada no aparelho. */
  biometria: EstadoBiometria;
  /** O usuário ligou o desbloqueio por biometria. */
  biometriaLigada: boolean;
  desbloquear: () => void;
  /** Relê o estado após mexer nas configurações de segurança. */
  sincronizar: () => Promise<void>;
}

const Contexto = createContext<EstadoTranca | null>(null);

export function TrancaProvider({ children }: { children: React.ReactNode }) {
  const [pronta, setPronta] = useState(false);
  const [temPin, setTemPin] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [biometria, setBiometria] = useState<EstadoBiometria>({ disponivel: false, tipo: null });
  const [biometriaLigada, setBiometriaLigada] = useState(false);

  const temPinRef = useRef(false);
  temPinRef.current = temPin;

  const carregar = useCallback(async () => {
    const [tp, bio, bioLigada] = await Promise.all([
      lerTemPin(),
      biometriaDoAparelho(),
      lerBiometriaAtiva(),
    ]);
    setTemPin(tp);
    setBiometria(bio);
    setBiometriaLigada(bioLigada);
    return tp;
  }, []);

  // Checagem inicial: se há PIN, o app abre trancado.
  useEffect(() => {
    let vivo = true;
    (async () => {
      // Antes de decidir a tranca: numa instalação nova, apaga o PIN órfão que o
      // Keychain do iOS mantém de uma instalação anterior — senão o app abriria
      // trancado pedindo Face ID sem o usuário ter definido nada.
      await limparTrancaSeInstalacaoNova().catch(() => {});
      const tp = await carregar().catch(() => false);
      if (!vivo) return;
      setBloqueado(tp);
      setPronta(true);
    })();
    return () => {
      vivo = false;
    };
  }, [carregar]);

  // Ao sair do app, tranca de novo: quem voltar cai na tela de PIN.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (proximo) => {
      if ((proximo === 'background' || proximo === 'inactive') && temPinRef.current) {
        setBloqueado(true);
      }
    });
    return () => sub.remove();
  }, []);

  const desbloquear = useCallback(() => setBloqueado(false), []);

  const sincronizar = useCallback(async () => {
    const tp = await carregar();
    // Deixou de ter PIN: não faz sentido seguir trancado.
    if (!tp) setBloqueado(false);
  }, [carregar]);

  return (
    <Contexto.Provider
      value={{
        pronta,
        temPin,
        bloqueado,
        biometria,
        biometriaLigada,
        desbloquear,
        sincronizar,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useTranca(): EstadoTranca {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTranca precisa estar dentro de <TrancaProvider>');
  return ctx;
}
