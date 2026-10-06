const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O expo-sqlite roda no navegador via wa-sqlite, que é um módulo .wasm — o
// Metro só o resolve se ele estiver declarado como asset.
config.resolver.assetExts.push('wasm');

// O wa-sqlite usa SharedArrayBuffer, que o navegador só libera em contexto
// cross-origin isolado. Sem estes dois cabeçalhos o banco não abre na web.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(req, res, next);
};

module.exports = config;
