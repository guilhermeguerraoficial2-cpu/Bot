const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { handleMessage } = require('./commands');
const game = require('./game');
const database = require('./database');

// Inicializa o estado do jogo
game.init();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessions');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys versão: ${version}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, console),
    },
    printQRInTerminal: true,
    // logger: P para menos logs
  });

  // Salva credenciais quando atualizadas
  sock.ev.on('creds.update', saveCreds);

  // Conexão aberta
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada, reconectando...', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('Bot conectado!');
      // Recupera partidas ativas e reenvia timers
    }
  });

  // Escuta mensagens
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify') {
      for (const msg of messages) {
        // Ignora mensagens do próprio bot e broadcasts
        if (msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        // Processa comando (prefixo /)
        await handleMessage(sock, msg);
      }
    }
  });

  // Tratamento de mensagens privadas pendentes? (já tratado no commands)
  return sock;
}

startBot().catch(err => console.error('Erro fatal:', err));
