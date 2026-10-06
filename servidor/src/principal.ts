import { ambiente } from './config/ambiente.js';
import { construirApp } from './app.js';

const app = construirApp();

app
  .listen({ port: ambiente.porta, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`API no ar em http://localhost:${ambiente.porta}`);
  })
  .catch((erro) => {
    app.log.error(erro);
    process.exit(1);
  });
