const database = require('./database');
const game = require('./game');
const config = require('./config');

// Processa comandos administrativos (apenas adminId)
async function handleAdminCommand(sock, msg, args, adminId) {
  const sender = msg.key.remoteJid;
  if (sender !== config.adminId) return false;

  const [command, ...params] = args;
  switch (command) {
    case 'forcarfim': {
      const matchId = params[0];
      const matches = database.getMatches();
      const match = matches.find(m => m.matchId === matchId);
      if (match) {
        game.endMatch(match.groupId, 'forced');
        await sock.sendMessage(sender, { text: `Partida ${matchId} forçada a terminar.` });
      } else {
        await sock.sendMessage(sender, { text: 'Partida não encontrada.' });
      }
      break;
    }
    case 'cancelar': {
      const matchId = params[0];
      const matches = database.getMatches();
      const idx = matches.findIndex(m => m.matchId === matchId && m.status === 'waiting');
      if (idx !== -1) {
        matches.splice(idx, 1);
        database.saveMatches(matches);
        await sock.sendMessage(sender, { text: 'Partida cancelada.' });
      } else {
        await sock.sendMessage(sender, { text: 'Partida não encontrada ou já iniciada.' });
      }
      break;
    }
    case 'ban': {
      const playerId = params[0];
      // Implementar sistema de banimento (simples flag nos players)
      const players = database.getPlayers();
      const player = players.find(p => p.id === playerId);
      if (player) {
        player.banned = true;
        database.savePlayers(players);
        await sock.sendMessage(sender, { text: `Jogador ${player.nome} banido.` });
      } else {
        await sock.sendMessage(sender, { text: 'Jogador não encontrado.' });
      }
      break;
    }
    case 'desban': {
      const playerId = params[0];
      const players = database.getPlayers();
      const player = players.find(p => p.id === playerId);
      if (player) {
        delete player.banned;
        database.savePlayers(players);
        await sock.sendMessage(sender, { text: `Jogador ${player.nome} desbanido.` });
      }
      break;
    }
    case 'reload':
      // Recarrega config (já está no require cache, apenas avisa)
      delete require.cache[require.resolve('./config')];
      await sock.sendMessage(sender, { text: 'Configurações recarregadas.' });
      break;
    default:
      await sock.sendMessage(sender, { text: 'Comando admin inválido.' });
  }
  return true;
}

module.exports = { handleAdminCommand };
