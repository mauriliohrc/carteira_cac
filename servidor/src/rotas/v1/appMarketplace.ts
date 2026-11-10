import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/cliente.js';
import { ambiente } from '../../config/ambiente.js';
import { exigirApp, usuarioAppOpcional } from '../../http/guardas.js';
import { invalido, naoEncontrado, proibido } from '../../http/erros.js';
import {
  criarAnuncioSchema,
  denunciaSchema,
  destaqueSchema,
  editarAnuncioSchema,
  mensagemMarketSchema,
} from '../../dominio/validacao.js';
import {
  CATEGORIAS_MARKET,
  DESTAQUE_PRODUTOS,
  ESTADOS_USO,
  categoriaValida,
  termoProibido,
} from '../../dominio/marketplace.js';
import { validarReciboIap } from '../../integracoes/iap.js';
import { enviarPush } from '../../push/expo.js';

// ---------------------------------------------------------------- utilidades

/** Base pública da API (mesma lógica de uploads.ts) para montar URLs de foto. */
function baseUrl(req: FastifyRequest): string {
  if (ambiente.apiPublicaUrl) return ambiente.apiPublicaUrl;
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'http';
  const host = req.headers.host ?? `localhost:${ambiente.porta}`;
  return `${proto}://${host}`;
}

/** Só o primeiro nome — o anúncio P2P é anônimo (nunca nome completo/CPF/telefone). */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

const INCLUIR_ANUNCIO = {
  fotos: { orderBy: { ordem: 'asc' as const } },
  loja: true,
  vendedor: { select: { nome: true } },
} satisfies Prisma.AnuncioInclude;

type AnuncioComRel = Prisma.AnuncioGetPayload<{ include: typeof INCLUIR_ANUNCIO }>;

/**
 * Serializa um anúncio para o cliente. NUNCA inclui telefone/CPF/e-mail/nome
 * completo do vendedor P2P (anonimato). Para loja parceira ATIVA, identifica a
 * loja; o contato público da loja só sai quando `contatoLoja` é true (app) —
 * na web (`contatoLoja: false`) nem a loja expõe contato: o interesse vai para
 * o download do app.
 */
export function apresentarAnuncio(
  a: AnuncioComRel,
  base: string,
  opts: { contatoLoja: boolean }
) {
  const lojaAtiva = a.loja && a.loja.ativo ? a.loja : null;
  const loja = lojaAtiva
    ? {
        id: lojaAtiva.id,
        nome: lojaAtiva.nome,
        verificada: lojaAtiva.verificada,
        logoUrl: lojaAtiva.logoUploadId ? `${base}/uploads/${lojaAtiva.logoUploadId}` : null,
        uf: lojaAtiva.uf,
        cidade: lojaAtiva.cidade,
        ...(opts.contatoLoja ? { whatsapp: lojaAtiva.whatsapp, site: lojaAtiva.site } : {}),
      }
    : null;

  return {
    id: a.id,
    categoria: a.categoria,
    subcategoria: a.subcategoria,
    estadoUso: a.estadoUso,
    precoCentavos: a.precoCentavos,
    uf: a.uf,
    cidade: a.cidade,
    titulo: a.titulo,
    descricao: a.descricao,
    status: a.status,
    destacado: a.destaqueAte ? a.destaqueAte.getTime() > Date.now() : false,
    criadoEm: a.criadoEm,
    // Vendedor: só identidade mínima e anônima em P2P; loja assume a frente.
    vendedor: loja ? null : { primeiroNome: primeiroNome(a.vendedor.nome) },
    loja,
    fotos: a.fotos.map((f) => `${base}/uploads/${f.uploadId}`),
  };
}

/** Envia um push para todos os aparelhos ativos de um usuário (best-effort). */
async function notificarUsuario(
  usuarioId: string,
  msg: { titulo: string; corpo: string; dados?: Record<string, string> }
): Promise<void> {
  try {
    const disp = await prisma.dispositivoPush.findMany({
      where: { usuarioId, ativo: true },
      select: { token: true },
    });
    const tokens = disp.map((d) => d.token);
    if (tokens.length) await enviarPush(tokens, msg);
  } catch {
    /* push é best-effort — nunca derruba a requisição */
  }
}

// ------------------------------------------------------------------- rotas

export async function rotasMarketplaceAppV1(app: FastifyInstance) {
  // Catálogo curado (categorias/allow-list + estados de uso). Público — o app
  // pode carregar na abertura em vez de embutir uma cópia que envelhece.
  app.get('/app/marketplace/catalogo', async () => ({
    categorias: CATEGORIAS_MARKET,
    estadosUso: ESTADOS_USO,
  }));

  // Lista pública de anúncios APROVADOS (login opcional). Filtros combináveis.
  app.get('/app/marketplace/anuncios', async (req) => {
    const q = req.query as {
      cursor?: string;
      limite?: string;
      categoria?: string;
      subcategoria?: string;
      uf?: string;
      texto?: string;
      precoMin?: string;
      precoMax?: string;
      lojaId?: string;
    };
    const limite = Math.min(50, Math.max(1, Number(q.limite) || 20));

    const and: Prisma.AnuncioWhereInput[] = [{ status: 'APROVADO' }];
    if (q.categoria) and.push({ categoria: q.categoria });
    if (q.subcategoria) and.push({ subcategoria: q.subcategoria });
    if (q.uf) and.push({ uf: q.uf.toUpperCase() });
    if (q.lojaId) and.push({ lojaId: q.lojaId });
    if (q.texto) and.push({ OR: [{ titulo: { contains: q.texto } }, { descricao: { contains: q.texto } }] });
    const precoMin = Number(q.precoMin);
    const precoMax = Number(q.precoMax);
    if (precoMin > 0) and.push({ precoCentavos: { gte: precoMin } });
    if (precoMax > 0) and.push({ precoCentavos: { lte: precoMax } });

    // Esconde anúncios de quem o usuário bloqueou (se logado).
    const usuarioId = usuarioAppOpcional(req);
    if (usuarioId) {
      const bloqueados = await prisma.bloqueioUsuario.findMany({
        where: { usuarioId },
        select: { bloqueadoId: true },
      });
      if (bloqueados.length) and.push({ vendedorId: { notIn: bloqueados.map((b) => b.bloqueadoId) } });
    }

    const lista = await prisma.anuncio.findMany({
      where: { AND: and },
      // Destaque (destaqueAte no futuro) primeiro; depois recentes. A ordenação
      // fina de "só destaque vigente no topo" entra junto com o IAP (M7).
      orderBy: [{ destaqueAte: 'desc' }, { criadoEm: 'desc' }, { id: 'desc' }],
      include: INCLUIR_ANUNCIO,
      take: limite + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const temMais = lista.length > limite;
    const pagina = temMais ? lista.slice(0, limite) : lista;
    const base = baseUrl(req);
    return {
      anuncios: pagina.map((a) => apresentarAnuncio(a, base, { contatoLoja: true })),
      proximoCursor: temMais ? pagina[pagina.length - 1]!.id : null,
    };
  });

  // Detalhe. APROVADO para qualquer um; o dono vê o próprio em qualquer status.
  app.get('/app/marketplace/anuncios/:id', async (req) => {
    const { id } = req.params as { id: string };
    const usuarioId = usuarioAppOpcional(req);
    const a = await prisma.anuncio.findUnique({ where: { id }, include: INCLUIR_ANUNCIO });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    if (a.status !== 'APROVADO' && a.vendedorId !== usuarioId)
      throw naoEncontrado('Anúncio não encontrado');
    return { anuncio: apresentarAnuncio(a, baseUrl(req), { contatoLoja: true }) };
  });

  // --- Daqui para baixo, tudo exige usuário do app logado ---
  app.register(async (priv) => {
    priv.addHook('preHandler', exigirApp());

    // Aceite do EULA do marketplace (obrigatório antes de anunciar).
    priv.post('/app/marketplace/eula', async (req) => {
      const u = await prisma.usuarioApp.update({
        where: { id: req.usuario!.id },
        data: { aceitouEulaMarketplaceEm: new Date() },
        select: { aceitouEulaMarketplaceEm: true },
      });
      return { ok: true, aceitoEm: u.aceitouEulaMarketplaceEm };
    });

    // Meus anúncios (todos os status).
    priv.get('/app/marketplace/meus', async (req) => {
      const lista = await prisma.anuncio.findMany({
        where: { vendedorId: req.usuario!.id },
        orderBy: { criadoEm: 'desc' },
        include: INCLUIR_ANUNCIO,
      });
      const base = baseUrl(req);
      return { anuncios: lista.map((a) => apresentarAnuncio(a, base, { contatoLoja: true })) };
    });

    // Criar anúncio. P2P → PENDENTE; loja ativa do próprio usuário → APROVADO.
    priv.post('/app/marketplace/anuncios', async (req, reply) => {
      const usuarioId = req.usuario!.id;
      const dados = criarAnuncioSchema.parse(req.body);

      const u = await prisma.usuarioApp.findUnique({
        where: { id: usuarioId },
        select: { aceitouEulaMarketplaceEm: true, ativo: true },
      });
      if (!u?.ativo) throw proibido('Conta inativa');
      if (!u.aceitouEulaMarketplaceEm) throw invalido('Aceite os termos do marketplace antes de anunciar.');

      if (!categoriaValida(dados.categoria, dados.subcategoria))
        throw invalido('Categoria ou subcategoria inválida.');
      const termo = termoProibido(dados.titulo, dados.descricao);
      if (termo)
        throw invalido(
          `O anúncio contém um termo não permitido ("${termo}"). O marketplace é só de acessórios — sem armas, munição ou itens controlados.`
        );

      // Loja: só aceita se for do próprio usuário e estiver ativa. Loja ativa
      // dispensa moderação (entra APROVADO); senão, P2P → PENDENTE.
      let lojaId: string | null = null;
      let status = 'PENDENTE';
      if (dados.lojaId) {
        const loja = await prisma.loja.findFirst({
          where: { id: dados.lojaId, usuarioId, ativo: true },
          select: { id: true },
        });
        if (!loja) throw proibido('Loja inválida ou inativa.');
        lojaId = loja.id;
        status = 'APROVADO';
      }

      const criado = await prisma.anuncio.create({
        data: {
          vendedorId: usuarioId,
          lojaId,
          categoria: dados.categoria,
          subcategoria: dados.subcategoria ?? null,
          estadoUso: dados.estadoUso,
          precoCentavos: dados.precoCentavos ?? null,
          uf: dados.uf,
          cidade: dados.cidade,
          titulo: dados.titulo,
          descricao: dados.descricao,
          status,
          fotos: dados.fotos?.length
            ? { create: dados.fotos.map((uploadId, i) => ({ uploadId, ordem: i })) }
            : undefined,
        },
        include: INCLUIR_ANUNCIO,
      });

      reply.code(201);
      return { anuncio: apresentarAnuncio(criado, baseUrl(req), { contatoLoja: true }) };
    });

    // Editar. Reenvia P2P para moderação (PENDENTE); loja permanece APROVADO.
    priv.patch('/app/marketplace/anuncios/:id', async (req) => {
      const { id } = req.params as { id: string };
      const usuarioId = req.usuario!.id;
      const atual = await prisma.anuncio.findUnique({ where: { id }, select: { vendedorId: true, lojaId: true } });
      if (!atual || atual.vendedorId !== usuarioId) throw naoEncontrado('Anúncio não encontrado');

      const dados = editarAnuncioSchema.parse(req.body);
      if (dados.categoria && !categoriaValida(dados.categoria, dados.subcategoria ?? undefined))
        throw invalido('Categoria ou subcategoria inválida.');
      const termo = termoProibido(dados.titulo, dados.descricao);
      if (termo) throw invalido(`Termo não permitido ("${termo}").`);

      const patch: Prisma.AnuncioUpdateInput = {};
      for (const k of ['categoria', 'subcategoria', 'estadoUso', 'precoCentavos', 'uf', 'cidade', 'titulo', 'descricao'] as const) {
        if (dados[k] !== undefined) (patch as Record<string, unknown>)[k] = dados[k];
      }
      // Editar reabre moderação para P2P; anúncio de loja segue aprovado.
      if (!atual.lojaId) patch.status = 'PENDENTE';

      // Substitui as fotos quando vierem no corpo.
      if (dados.fotos) {
        await prisma.anuncioFoto.deleteMany({ where: { anuncioId: id } });
        patch.fotos = { create: dados.fotos.map((uploadId, i) => ({ uploadId, ordem: i })) };
      }

      const atualizado = await prisma.anuncio.update({ where: { id }, data: patch, include: INCLUIR_ANUNCIO });
      return { anuncio: apresentarAnuncio(atualizado, baseUrl(req), { contatoLoja: true }) };
    });

    // Ações de estado do próprio anúncio.
    const mudarStatus = async (req: FastifyRequest, novo: string, exigeAtual?: string) => {
      const { id } = req.params as { id: string };
      const a = await prisma.anuncio.findUnique({ where: { id }, select: { vendedorId: true, status: true } });
      if (!a || a.vendedorId !== req.usuario!.id) throw naoEncontrado('Anúncio não encontrado');
      if (exigeAtual && a.status !== exigeAtual) throw invalido('Ação indisponível para o status atual.');
      await prisma.anuncio.update({ where: { id }, data: { status: novo } });
      return { ok: true, status: novo };
    };
    priv.post('/app/marketplace/anuncios/:id/pausar', (req) => mudarStatus(req, 'PAUSADO', 'APROVADO'));
    priv.post('/app/marketplace/anuncios/:id/reativar', (req) => mudarStatus(req, 'APROVADO', 'PAUSADO'));
    // "Já vendi" — marca como vendido (some da vitrine, fica no histórico do dono).
    priv.post('/app/marketplace/anuncios/:id/vendido', (req) => mudarStatus(req, 'VENDIDO'));

    // Excluir o próprio anúncio (fotos/conversas caem por cascade).
    priv.delete('/app/marketplace/anuncios/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const a = await prisma.anuncio.findUnique({ where: { id }, select: { vendedorId: true } });
      if (!a || a.vendedorId !== req.usuario!.id) throw naoEncontrado('Anúncio não encontrado');
      await prisma.anuncio.delete({ where: { id } });
      reply.code(204);
      return null;
    });

    // ------------------------------------------------------------- chat
    // "Tenho interesse" — cria (ou retoma) a conversa comprador↔vendedor.
    priv.post('/app/marketplace/anuncios/:id/interesse', async (req) => {
      const { id } = req.params as { id: string };
      const compradorId = req.usuario!.id;
      const a = await prisma.anuncio.findUnique({
        where: { id },
        select: { vendedorId: true, status: true },
      });
      if (!a || a.status !== 'APROVADO') throw naoEncontrado('Anúncio não encontrado');
      if (a.vendedorId === compradorId) throw invalido('Este anúncio é seu.');

      let conversa = await prisma.conversa.findUnique({
        where: { anuncioId_compradorId: { anuncioId: id, compradorId } },
        select: { id: true },
      });
      if (!conversa) {
        conversa = await prisma.conversa.create({
          data: { anuncioId: id, compradorId, vendedorId: a.vendedorId },
          select: { id: true },
        });
        void notificarUsuario(a.vendedorId, {
          titulo: 'Novo interesse 👀',
          corpo: 'Alguém se interessou pelo seu anúncio.',
          dados: { tipo: 'marketplace_conversa', conversaId: conversa.id },
        });
      }
      return { conversaId: conversa.id };
    });

    // Minhas conversas (como comprador e como vendedor), mais recentes primeiro.
    priv.get('/app/marketplace/conversas', async (req) => {
      const uid = req.usuario!.id;
      const convs = await prisma.conversa.findMany({
        where: { OR: [{ compradorId: uid }, { vendedorId: uid }] },
        orderBy: { atualizadoEm: 'desc' },
        include: {
          anuncio: { select: { id: true, titulo: true, fotos: { orderBy: { ordem: 'asc' }, take: 1 } } },
          comprador: { select: { nome: true } },
          vendedor: { select: { nome: true } },
          mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
        },
      });
      const base = baseUrl(req);
      const conversas = await Promise.all(
        convs.map(async (conv) => {
          const souVendedor = conv.vendedorId === uid;
          const outroNome = souVendedor ? conv.comprador.nome : conv.vendedor.nome;
          const naoLidas = await prisma.mensagem.count({
            where: { conversaId: conv.id, lidaEm: null, autorId: { not: uid } },
          });
          const ultima = conv.mensagens[0];
          const foto = conv.anuncio.fotos[0];
          return {
            id: conv.id,
            anuncio: {
              id: conv.anuncio.id,
              titulo: conv.anuncio.titulo,
              foto: foto ? `${base}/uploads/${foto.uploadId}` : null,
            },
            outro: { primeiroNome: primeiroNome(outroNome) },
            souVendedor,
            ultimaMensagem: ultima
              ? { texto: ultima.texto, criadoEm: ultima.criadoEm, meu: ultima.autorId === uid }
              : null,
            naoLidas,
            atualizadoEm: conv.atualizadoEm,
          };
        })
      );
      return { conversas };
    });

    // Mensagens de uma conversa (desc, cursor) + marca as recebidas como lidas.
    priv.get('/app/marketplace/conversas/:id', async (req) => {
      const uid = req.usuario!.id;
      const { id } = req.params as { id: string };
      const q = req.query as { cursor?: string; limite?: string };
      const limite = Math.min(50, Math.max(1, Number(q.limite) || 30));

      const conv = await prisma.conversa.findUnique({
        where: { id },
        include: {
          anuncio: { select: { id: true, titulo: true } },
          comprador: { select: { nome: true } },
          vendedor: { select: { nome: true, celular: true } },
        },
      });
      if (!conv || (conv.compradorId !== uid && conv.vendedorId !== uid))
        throw naoEncontrado('Conversa não encontrada');
      const souVendedor = conv.vendedorId === uid;

      const msgs = await prisma.mensagem.findMany({
        where: { conversaId: id },
        orderBy: { criadoEm: 'desc' },
        take: limite + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      });
      const temMais = msgs.length > limite;
      const pagina = temMais ? msgs.slice(0, limite) : msgs;

      await prisma.mensagem.updateMany({
        where: { conversaId: id, autorId: { not: uid }, lidaEm: null },
        data: { lidaEm: new Date() },
      });

      // O telefone do vendedor só vai ao comprador quando liberado (opt-in/LGPD).
      const telefoneVendedor = conv.contatoLiberado && !souVendedor ? conv.vendedor.celular : null;
      return {
        id: conv.id,
        anuncio: conv.anuncio,
        souVendedor,
        outro: { primeiroNome: primeiroNome(souVendedor ? conv.comprador.nome : conv.vendedor.nome) },
        contatoLiberado: conv.contatoLiberado,
        telefoneVendedor,
        mensagens: pagina.map((m) => ({
          id: m.id,
          meu: m.autorId === uid,
          texto: m.texto,
          criadoEm: m.criadoEm,
        })),
        proximoCursor: temMais ? pagina[pagina.length - 1]!.id : null,
      };
    });

    priv.post('/app/marketplace/conversas/:id/mensagens', async (req) => {
      const uid = req.usuario!.id;
      const { id } = req.params as { id: string };
      const { texto } = mensagemMarketSchema.parse(req.body);
      const conv = await prisma.conversa.findUnique({
        where: { id },
        select: { compradorId: true, vendedorId: true },
      });
      if (!conv || (conv.compradorId !== uid && conv.vendedorId !== uid))
        throw naoEncontrado('Conversa não encontrada');
      const msg = await prisma.mensagem.create({ data: { conversaId: id, autorId: uid, texto } });
      await prisma.conversa.update({ where: { id }, data: { atualizadoEm: new Date() } });
      const destino = conv.compradorId === uid ? conv.vendedorId : conv.compradorId;
      void notificarUsuario(destino, {
        titulo: 'Nova mensagem 💬',
        corpo: texto.slice(0, 80),
        dados: { tipo: 'marketplace_conversa', conversaId: id },
      });
      return { mensagem: { id: msg.id, meu: true, texto: msg.texto, criadoEm: msg.criadoEm } };
    });

    // Vendedor libera o próprio telefone para aquele comprador (reversível no app).
    priv.post('/app/marketplace/conversas/:id/liberar-contato', async (req) => {
      const uid = req.usuario!.id;
      const { id } = req.params as { id: string };
      const conv = await prisma.conversa.findUnique({
        where: { id },
        select: { vendedorId: true, compradorId: true, contatoLiberado: true },
      });
      if (!conv || conv.vendedorId !== uid) throw proibido('Só o vendedor pode liberar o contato.');
      if (!conv.contatoLiberado) {
        await prisma.conversa.update({
          where: { id },
          data: { contatoLiberado: true, contatoLiberadoEm: new Date() },
        });
        void notificarUsuario(conv.compradorId, {
          titulo: 'Contato liberado ✅',
          corpo: 'O vendedor liberou o telefone para você.',
          dados: { tipo: 'marketplace_conversa', conversaId: id },
        });
      }
      return { ok: true };
    });

    // ----------------------------------------------------- denúncia / bloqueio
    priv.post('/app/marketplace/denuncias', async (req, reply) => {
      const dados = denunciaSchema.parse(req.body);
      await prisma.denuncia.create({
        data: {
          anuncioId: dados.anuncioId ?? null,
          conversaId: dados.conversaId ?? null,
          denuncianteId: req.usuario!.id,
          motivo: dados.motivo,
        },
      });
      reply.code(201);
      return { ok: true };
    });

    // ----------------------------------------------------------- destaque (IAP)
    // Recebe o recibo de uma compra consumível e dá destaque ao anúncio.
    priv.post('/app/marketplace/anuncios/:id/destaque', async (req) => {
      const uid = req.usuario!.id;
      const { id } = req.params as { id: string };
      const { produtoId, plataforma, transacaoId } = destaqueSchema.parse(req.body);
      const dias = DESTAQUE_PRODUTOS[produtoId];
      if (!dias) throw invalido('Produto de destaque inválido.');

      const a = await prisma.anuncio.findUnique({
        where: { id },
        select: { vendedorId: true, destaqueAte: true },
      });
      if (!a || a.vendedorId !== uid) throw naoEncontrado('Anúncio não encontrado');

      // Idempotência: a mesma transação da loja nunca concede destaque 2×.
      const jaRegistrado = await prisma.destaqueCompra.findUnique({ where: { transacaoId } });
      if (jaRegistrado) {
        const atual = await prisma.anuncio.findUnique({ where: { id }, select: { destaqueAte: true } });
        return { ok: true, destaqueAte: atual?.destaqueAte ?? null, jaRegistrado: true };
      }

      const valido = await validarReciboIap({ plataforma, produtoId, transacaoId });
      if (!valido) throw invalido('Não foi possível validar a compra na loja.');

      // Estende a partir do fim do destaque vigente (ou de agora, se expirou).
      const agora = Date.now();
      const baseMs = a.destaqueAte && a.destaqueAte.getTime() > agora ? a.destaqueAte.getTime() : agora;
      const destaqueAte = new Date(baseMs + dias * 86_400_000);
      await prisma.$transaction([
        prisma.destaqueCompra.create({
          data: { anuncioId: id, usuarioId: uid, produtoId, plataforma, transacaoId, dias, validadoEm: new Date() },
        }),
        prisma.anuncio.update({ where: { id }, data: { destaqueAte } }),
      ]);
      return { ok: true, destaqueAte };
    });

    // Bloquear o outro participante de uma conversa (some da vitrine daqui p/ frente).
    priv.post('/app/marketplace/conversas/:id/bloquear', async (req) => {
      const uid = req.usuario!.id;
      const { id } = req.params as { id: string };
      const conv = await prisma.conversa.findUnique({
        where: { id },
        select: { compradorId: true, vendedorId: true },
      });
      if (!conv || (conv.compradorId !== uid && conv.vendedorId !== uid))
        throw naoEncontrado('Conversa não encontrada');
      const alvo = conv.compradorId === uid ? conv.vendedorId : conv.compradorId;
      await prisma.bloqueioUsuario.upsert({
        where: { usuarioId_bloqueadoId: { usuarioId: uid, bloqueadoId: alvo } },
        create: { usuarioId: uid, bloqueadoId: alvo },
        update: {},
      });
      return { ok: true };
    });
  });
}

/** Push de "anúncio aprovado" — usado pela moderação do backoffice. */
export async function notificarAnuncioAprovado(anuncioId: string): Promise<void> {
  const a = await prisma.anuncio.findUnique({
    where: { id: anuncioId },
    select: { vendedorId: true, titulo: true },
  });
  if (!a) return;
  await notificarUsuario(a.vendedorId, {
    titulo: 'Anúncio aprovado ✅',
    corpo: `"${a.titulo}" já está no marketplace.`,
    dados: { tipo: 'marketplace_anuncio', anuncioId },
  });
}
