/**
 * Diálogos do app.
 *
 * Toda escolha é feita com **botão** — nunca digitando. Antes a web caía num
 * `prompt` pedindo o número da opção, o que é hostil e feio; hoje as três
 * plataformas mostram a mesma folha de ações desenhada em `DialogoProvider`.
 *
 * Como a folha precisa estar na árvore React para renderizar, o provider
 * registra aqui o seu apresentador. Este módulo continua sendo importável de
 * qualquer lugar — inclusive de código fora de componente, como o cofre de
 * arquivos — e cai nos diálogos do sistema caso seja chamado antes de o
 * provider montar.
 */
import { Alert, Platform } from 'react-native';

export interface OpcaoDialogo {
  rotulo: string;
  acao?: () => void | Promise<void>;
  destrutivo?: boolean;
  icone?: string;
}

export interface PedidoDialogo {
  titulo: string;
  mensagem?: string;
  opcoes: OpcaoDialogo[];
  cancelavel?: boolean;
  rotuloCancelar?: string;
}

type Apresentador = (pedido: PedidoDialogo) => Promise<number | null>;

let apresentar: Apresentador | null = null;

export function registrarApresentador(fn: Apresentador): void {
  apresentar = fn;
}

/** Fallback para quando a folha ainda não montou. */
function sistemaAviso(titulo: string, mensagem?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.([titulo, mensagem].filter(Boolean).join('\n\n'));
    return;
  }
  Alert.alert(titulo, mensagem);
}

export async function avisar(titulo: string, mensagem?: string): Promise<void> {
  if (!apresentar) return sistemaAviso(titulo, mensagem);
  await apresentar({
    titulo,
    mensagem,
    opcoes: [{ rotulo: 'Entendi' }],
    cancelavel: false,
  });
}

export async function confirmar(opcoes: {
  titulo: string;
  mensagem?: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  destrutivo?: boolean;
}): Promise<boolean> {
  const {
    titulo,
    mensagem,
    rotuloConfirmar = 'Confirmar',
    rotuloCancelar = 'Cancelar',
    destrutivo,
  } = opcoes;

  if (!apresentar) {
    if (Platform.OS === 'web') {
      return Boolean(globalThis.confirm?.([titulo, mensagem].filter(Boolean).join('\n\n')));
    }
    return new Promise((resolve) => {
      Alert.alert(titulo, mensagem, [
        { text: rotuloCancelar, style: 'cancel', onPress: () => resolve(false) },
        {
          text: rotuloConfirmar,
          style: destrutivo ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ]);
    });
  }

  const escolhida = await apresentar({
    titulo,
    mensagem,
    rotuloCancelar,
    opcoes: [
      {
        rotulo: rotuloConfirmar,
        destrutivo,
        icone: destrutivo ? 'trash-outline' : 'checkmark-circle-outline',
      },
    ],
  });
  return escolhida === 0;
}

/** Menu de ações. Sempre botões, nunca entrada de texto. */
export async function escolher(
  titulo: string,
  mensagem: string,
  opcoes: OpcaoDialogo[]
): Promise<void> {
  if (!apresentar) {
    sistemaAviso(titulo, mensagem);
    return;
  }
  const indice = await apresentar({ titulo, mensagem, opcoes });
  if (indice === null) return;
  await opcoes[indice]?.acao?.();
}
