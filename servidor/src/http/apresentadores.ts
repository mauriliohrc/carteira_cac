import type {
  EntidadeTiro,
  MidiaNoticia,
  Noticia,
  UsuarioAdmin,
  UsuarioApp,
  UsuarioEntidade,
} from '@prisma/client';

type NoticiaComMidias = Noticia & {
  midias?: MidiaNoticia[];
  entidade?: { id: string; nome: string } | null;
  _count?: { leituras?: number };
};

function apresentarMidia(m: MidiaNoticia) {
  return { id: m.id, tipo: m.tipo, url: m.url, legenda: m.legenda, ordem: m.ordem };
}

/** Visão completa da notícia para o backoffice (todos os status). */
export function apresentarNoticia(n: NoticiaComMidias) {
  return {
    id: n.id,
    titulo: n.titulo,
    resumo: n.resumo,
    conteudo: n.conteudo,
    imagemUrl: n.imagemUrl,
    status: n.status,
    publicadaEm: n.publicadaEm,
    autorId: n.autorId,
    // Alcance: null = geral; preenchido = restrita à entidade.
    entidadeId: n.entidadeId,
    entidadeNome: n.entidade?.nome ?? null,
    criadoEm: n.criadoEm,
    atualizadoEm: n.atualizadoEm,
    // Quantas pessoas leram (quando a consulta incluir a contagem).
    leituras: n._count?.leituras ?? 0,
    midias: (n.midias ?? []).map(apresentarMidia),
  };
}

/** Visão pública (app): sem campos internos de edição. */
export function apresentarNoticiaPublica(n: NoticiaComMidias) {
  return {
    id: n.id,
    titulo: n.titulo,
    resumo: n.resumo,
    conteudo: n.conteudo,
    imagemUrl: n.imagemUrl,
    publicadaEm: n.publicadaEm,
    // Para o app exibir um selo "exclusivo da <entidade>".
    entidadeId: n.entidadeId,
    entidadeNome: n.entidade?.nome ?? null,
    midias: (n.midias ?? []).map(apresentarMidia),
  };
}

export function apresentarUsuarioApp(u: UsuarioApp) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: u.cpf,
    celular: u.celular,
    emailVerificado: u.emailVerificado,
    ativo: u.ativo,
    criadoEm: u.criadoEm,
  };
}

// Convertem registros do banco para a resposta pública da API,
// removendo campos sensíveis como senhaHash.

export function apresentarAdmin(u: UsuarioAdmin) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    ativo: u.ativo,
    criadoEm: u.criadoEm,
    atualizadoEm: u.atualizadoEm,
  };
}

export function apresentarEntidade(e: EntidadeTiro) {
  return {
    id: e.id,
    nome: e.nome,
    tipo: e.tipo,
    cr: e.cr,
    cnpj: e.cnpj,
    email: e.email,
    telefone: e.telefone,
    cidade: e.cidade,
    uf: e.uf,
    ativo: e.ativo,
    // Integração Shooting House — nunca devolve a senha.
    shIntegracaoAtiva: e.shIntegracaoAtiva,
    shBaseUrl: e.shBaseUrl,
    shLogin: e.shLogin,
    shConfigurado: Boolean(e.shLogin && e.shSenha),
    criadoEm: e.criadoEm,
    atualizadoEm: e.atualizadoEm,
  };
}

export function apresentarUsuarioEntidade(u: UsuarioEntidade) {
  return {
    id: u.id,
    entidadeId: u.entidadeId,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    ativo: u.ativo,
    criadoEm: u.criadoEm,
    atualizadoEm: u.atualizadoEm,
  };
}
