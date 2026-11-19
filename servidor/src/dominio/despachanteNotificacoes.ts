import type { ProcessoDespachante, StatusProcessoDespachante } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { enviarPush } from '../push/expo.js';
import { enviarTexto, estaConectado } from '../whatsapp/cliente.js';
import { aplicarNome } from '../whatsapp/mensagens.js';
import { registrarLog } from '../log/auditoria.js';
import { lerTexto, CHAVE_WHATSAPP_JURIDICO } from '../config/configStore.js';
import { refletirProcessoNoSync } from './despachanteSync.js';
import { registrarEventoUsuario } from './eventoUsuario.js';
import {
  calcularProgresso,
  resolverServicoDinamico,
  statusPorPapel,
} from './despachanteCatalogo.js';

/** Push para todos os aparelhos ativos do usuário + log de auditoria. */
async function pushUsuario(
  usuarioId: string,
  titulo: string,
  corpo: string,
  destino?: string | null
): Promise<void> {
  const disp = await prisma.dispositivoPush.findMany({
    where: { usuarioId, ativo: true },
    select: { token: true },
  });
  let status: 'OK' | 'FALHOU' | 'PULADO' = 'PULADO';
  if (disp.length) {
    const r = await enviarPush(disp.map((d) => d.token), { titulo, corpo, dados: { tipo: 'despachante' } }).catch(
      () => ({ aceitos: 0, erros: [] as { token: string; motivo: string }[] })
    );
    status = r.aceitos > 0 ? 'OK' : 'FALHOU';
  }
  await registrarLog({ usuarioId, canal: 'PUSH', tipo: 'DESPACHANTE', titulo, corpo, destino, status });
}

/** WhatsApp para o usuário (best-effort) + log. */
async function whatsappUsuario(
  usuarioId: string,
  celular: string | null,
  nome: string,
  corpoBruto: string
): Promise<void> {
  const corpo = aplicarNome(corpoBruto, nome);
  if (!celular || !estaConectado()) {
    await registrarLog({ usuarioId, canal: 'WHATSAPP', tipo: 'DESPACHANTE', corpo, destino: celular, status: 'PULADO' });
    return;
  }
  try {
    await enviarTexto(celular, corpo, nome);
    await registrarLog({ usuarioId, canal: 'WHATSAPP', tipo: 'DESPACHANTE', corpo, destino: celular, status: 'OK' });
  } catch (e) {
    await registrarLog({
      usuarioId,
      canal: 'WHATSAPP',
      tipo: 'DESPACHANTE',
      corpo,
      destino: celular,
      status: 'FALHOU',
      erro: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Alerta interno ao despachante (número do Auxílio Jurídico), se configurado. */
async function alertarDespachante(texto: string): Promise<void> {
  const numero = (await lerTexto(CHAVE_WHATSAPP_JURIDICO)) ?? '';
  if (!numero || !estaConectado()) return;
  try {
    await enviarTexto(numero, texto, '');
  } catch {
    /* alerta interno é best-effort */
  }
}

/** Corpo da notificação de entrada em um status (push), por papel. */
function corpoDoStatus(servicoNome: string, st: StatusProcessoDespachante): string {
  switch (st.papel) {
    case 'AGUARDANDO_DOC':
      return `Pagamento confirmado! Envie os documentos no app para darmos início ao seu ${servicoNome}.`;
    case 'EM_ANALISE':
      return `Recebemos sua documentação de ${servicoNome} e já estamos conferindo tudo.`;
    case 'FINAL':
      return `Seu ${servicoNome} foi finalizado! Os documentos finais já estão disponíveis no app.`;
    case 'CANCELADO':
      return `Seu processo de ${servicoNome} foi cancelado.`;
    default:
      return `Seu ${servicoNome} agora está: ${st.label}.`;
  }
}

/**
 * MUDA O STATUS do processo (caminho único — admin e automação) e notifica o
 * usuário (push sempre; WhatsApp nos marcos: início/pago e finalização). Reflete
 * no sync. Idempotente: status igual não renotifica.
 */
export async function mudarStatusProcesso(
  processo: ProcessoDespachante,
  novoCodigo: string,
  opts: { notificar?: boolean } = {}
): Promise<ProcessoDespachante> {
  const notificar = opts.notificar ?? true;
  if (processo.status === novoCodigo) return processo;

  const atualizado = await prisma.processoDespachante.update({
    where: { id: processo.id },
    data: { status: novoCodigo },
  });
  await refletirProcessoNoSync(atualizado);

  const [st, servico, usuario] = await Promise.all([
    prisma.statusProcessoDespachante.findUnique({ where: { codigo: novoCodigo } }),
    resolverServicoDinamico(atualizado.tipoServico),
    prisma.usuarioApp.findUnique({ where: { id: atualizado.usuarioId } }),
  ]);
  const nome = servico?.nome ?? 'processo';

  // Timeline de ações do usuário (histórico no backoffice).
  const tipoEvento =
    st?.papel === 'PAGO'
      ? 'PROCESSO_PAGO'
      : st?.papel === 'FINAL'
        ? 'PROCESSO_FINALIZADO'
        : st?.papel === 'CANCELADO'
          ? 'PROCESSO_CANCELADO'
          : 'PROCESSO_STATUS';
  void registrarEventoUsuario(atualizado.usuarioId, tipoEvento, {
    descricao: `${nome} — ${st?.label ?? novoCodigo}`,
    origem: 'DESPACHANTE',
  });

  if (notificar && st && usuario) {
    const corpo = corpoDoStatus(nome, st);
    await pushUsuario(usuario.id, nome, corpo);
    // WhatsApp só nos marcos: início (pago/aguardando doc) e finalização.
    if (st.papel === 'AGUARDANDO_DOC' || st.papel === 'PAGO') {
      const msg = servico?.mensagemWhatsappInicio?.trim() || corpo;
      await whatsappUsuario(usuario.id, usuario.celular, usuario.nome, msg);
    } else if (st.papel === 'FINAL') {
      await whatsappUsuario(usuario.id, usuario.celular, usuario.nome, corpo);
    }
  }
  return atualizado;
}

/** Ao criar o processo (aguardando pagamento): push lembrando de pagar + evento. */
export async function aoCriarProcesso(processo: ProcessoDespachante, servicoNome: string): Promise<void> {
  void registrarEventoUsuario(processo.usuarioId, 'PROCESSO_CRIADO', {
    descricao: `${servicoNome}${processo.armaNome ? ` — ${processo.armaNome}` : ''}`,
    origem: 'DESPACHANTE',
  });
  await pushUsuario(
    processo.usuarioId,
    servicoNome,
    'Pedido criado! Conclua o pagamento para iniciarmos o seu processo.'
  );
}

/**
 * Ao confirmar o PAGAMENTO (webhook): escolhe o próximo status — se o serviço
 * tem campos obrigatórios a preencher, vai para "aguardando documentação"; senão
 * "pago". Dispara a mensagem de início (WhatsApp por serviço).
 */
export async function aoPagarProcesso(processo: ProcessoDespachante): Promise<void> {
  const servico = await resolverServicoDinamico(processo.tipoServico);
  const temCampos = (servico?.campos.length ?? 0) > 0;
  const alvo = temCampos
    ? (await statusPorPapel('AGUARDANDO_DOC')) ?? (await statusPorPapel('PAGO'))
    : await statusPorPapel('PAGO');
  await mudarStatusProcesso(processo, alvo?.codigo ?? 'pago');
}

/**
 * Após o usuário enviar/alterar um documento: se completou os obrigatórios e o
 * processo está "aguardando documentação", avança para "em análise", avisa o
 * usuário e alerta o despachante de que o processo está 100%.
 */
export async function aoEnviarDocumento(processoId: string): Promise<void> {
  const processo = await prisma.processoDespachante.findUnique({
    where: { id: processoId },
    include: { valores: true },
  });
  if (!processo) return;
  const servico = await resolverServicoDinamico(processo.tipoServico);
  if (!servico) return;

  const progresso = calcularProgresso(servico.campos, processo.valores);
  if (!progresso.completo) return;

  const st = await prisma.statusProcessoDespachante.findUnique({ where: { codigo: processo.status } });
  if (st?.papel !== 'AGUARDANDO_DOC') return; // só avança a partir de aguardando doc

  const analise = await statusPorPapel('EM_ANALISE');
  if (analise) await mudarStatusProcesso(processo, analise.codigo);

  const usuario = await prisma.usuarioApp.findUnique({ where: { id: processo.usuarioId } });
  await alertarDespachante(
    `✅ Documentação 100% completa — ${servico.nome}${usuario ? ` · ${usuario.nome}` : ''}. Pronto para trabalhar.`
  );
}
