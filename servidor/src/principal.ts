import { existsSync } from 'node:fs';
import { ambiente } from './config/ambiente.js';
import { construirApp } from './app.js';
import { iniciar as iniciarWhatsapp } from './whatsapp/cliente.js';
import { registrarRetomada, retomar } from './whatsapp/dispatcher.js';
import { iniciarAgendador } from './whatsapp/automacoes.js';

const app = construirApp();

app
  .listen({ port: ambiente.porta, host: '0.0.0.0' })
  .then(async () => {
    app.log.info(`API no ar em http://localhost:${ambiente.porta}`);

    // WhatsApp (Baileys): liga o laço de disparo ao evento de reconexão e, se já
    // houver uma sessão salva em disco, reconecta sem exigir novo QR.
    registrarRetomada();
    if (existsSync(ambiente.whatsapp.authDir)) {
      iniciarWhatsapp().catch((e) => app.log.error({ e }, 'falha ao iniciar WhatsApp'));
    }
    retomar(); // retoma campanhas EM_ANDAMENTO após restart
    iniciarAgendador(); // mensagens automáticas (boas-vindas / 7 dias sem arma)
  })
  .catch((erro) => {
    app.log.error(erro);
    process.exit(1);
  });
