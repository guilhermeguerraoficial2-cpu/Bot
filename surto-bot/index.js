// index.js - Entrada principal do bot Surto
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { handleCommand } = require('./commands');
const { init: initGame } = require('./game');
const pino = require('pino');

// Inicializa dados do jogo
initGame();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'silent' }))
        },
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['SurtoBot', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
            console.log('Conexão fechada, reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot conectado!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Escuta mensagens
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            // Processa comandos
            await handleCommand(sock, msg).catch(err => console.error('Erro no comando:', err));
        }
    });

    return sock;
}

connectToWhatsApp().catch(err => console.error('Falha ao iniciar:', err));
