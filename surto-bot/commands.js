// commands.js - Interpretação e roteamento de comandos
const config = require('./config');
const game = require('./game');
const db = require('./database');
const { helpMessage, rulesMessage } = require('./messages');
const { formatTime } = require('./utils');

/**
 * Processa uma mensagem recebida e executa o comando correspondente
 */
async function handleCommand(sock, msg) {
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (!body.startsWith(config.prefix)) return false;

    const args = body.slice(config.prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;
    const groupId = isGroup ? msg.key.remoteJid : null;

    // Comandos de grupo (só funcionam em grupos)
    if (isGroup) {
        switch (cmd) {
            case 'criar':
                await game.createMatch(sock, groupId, sender);
                break;
            case 'entrar':
                await game.joinMatch(sock, groupId, sender, msg.pushName || sender.split('@')[0]);
                break;
            case 'sair':
                await game.leaveMatch(sock, groupId, sender);
                break;
            case 'iniciar':
                await game.startMatch(sock, groupId, sender);
                break;
            case 'status':
                await game.showStatus(sock, groupId);
                break;
            case 'ajuda':
                await sock.sendMessage(groupId, { text: helpMessage() });
                break;
            case 'regras':
                await sock.sendMessage(groupId, { text: rulesMessage() });
                break;
            case 'ranking':
                await showRanking(sock, groupId);
                break;
            case 'perfil':
                await showProfile(sock, groupId, sender);
                break;
            case 'votar':
                await game.handleVote(sock, groupId, sender, args[0]);
                break;
            default:
                // Comando desconhecido
                break;
        }
    } else {
        // Comandos privados (ações noturnas, etc.)
        await handlePrivateCommand(sock, msg, cmd, args, sender);
    }
    return true;
}

/**
 * Comandos recebidos no privado (durante a noite)
 */
async function handlePrivateCommand(sock, msg, cmd, args, sender) {
    // Encontrar partida ativa onde o jogador está
    const match = game.findActiveMatchByPlayer(sender);
    if (!match) {
        await sock.sendMessage(sender, { text: 'Você não está em nenhuma partida ativa.' });
        return;
    }

    const player = match.players.find(p => p.id === sender);
    if (!player || !player.alive) {
        await sock.sendMessage(sender, { text: 'Você está eliminado ou não participa desta partida.' });
        return;
    }

    switch (cmd) {
        case 'acao':
            // Ação noturna (médico, atirador, guarda, investigador)
            await game.processNightAction(sock, match, player, args[0]);
            break;
        case 'atacar':
            // Apenas zumbis (no grupo de zumbis)
            await game.zombieAttackVote(sock, match, player, args[0]);
            break;
        case 'executar':
            // Guarda solicita execução especial
            await game.requestSpecialExecution(sock, match, player, args[0]);
            break;
        case 'confirmar':
            // Investigador confirma execução
            await game.confirmSpecialExecution(sock, match, player);
            break;
        default:
            await sock.sendMessage(sender, { text: 'Comando privado desconhecido.' });
    }
}

async function showRanking(sock, groupId) {
    const { ranking } = db.loadAll();
    if (ranking.length === 0) {
        return sock.sendMessage(groupId, { text: '🏆 Ranking vazio. Jogue para aparecer!' });
    }
    let msg = '🏆 *TOP JOGADORES*\n\n';
    ranking.slice(0, 10).forEach((p, i) => {
        msg += `${i+1}. ${p.name} - Vitórias: ${p.wins} | Jogos: ${p.gamesPlayed}\n`;
    });
    await sock.sendMessage(groupId, { text: msg });
}

async function showProfile(sock, groupId, sender) {
    const { players } = db.loadAll();
    const p = players[sender];
    if (!p) {
        return sock.sendMessage(groupId, { text: 'Perfil não encontrado. Participe de uma partida primeiro!' });
    }
    const msg = `👤 *PERFIL*\n\n` +
                `Nome: ${p.name}\n` +
                `Vitórias: ${p.wins}\n` +
                `Derrotas: ${p.losses}\n` +
                `Jogos: ${p.gamesPlayed}`;
    await sock.sendMessage(groupId, { text: msg });
}

module.exports = { handleCommand };
