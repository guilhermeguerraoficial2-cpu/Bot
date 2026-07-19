const config = require('./config');
const game = require('./game');
const messages = require('./messages');
const { roles, getRoleDescription } = require('./roles');
const { handleAdminCommand } = require('./admin');
const database = require('./database');

// Mapa de cooldown por jogador
const cooldowns = new Map();

// Processa comandos recebidos (menção ao bot ou prefixo)
async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  if (!text.startsWith(config.prefix)) return;

  // Anti-spam cooldown
  if (cooldowns.has(sender)) {
    const last = cooldowns.get(sender);
    if (Date.now() - last < config.tempos.cooldown) {
      await sock.sendMessage(from, { text: messages.cooldown });
      return;
    }
  }
  cooldowns.set(sender, Date.now());

  const args = text.slice(1).trim().split(' ');
  const command = args.shift().toLowerCase();

  // Comandos administrativos (privado)
  if (command in { forcarfim:1, cancelar:1, ban:1, desban:1, reload:1 }) {
    await handleAdminCommand(sock, msg, [command, ...args], config.adminId);
    return;
  }

  // Comandos de jogo (grupo)
  const isGroup = from.endsWith('@g.us');
  if (!isGroup) {
    // Comandos privados permitidos: /votar, /acao, /executar
    if (['votar', 'acao', 'executar'].includes(command)) {
      await handlePrivateCommand(sock, msg, command, args);
    } else {
      await sock.sendMessage(from, { text: 'Este comando só funciona em grupos.' });
    }
    return;
  }

  // Grupo
  switch (command) {
    case 'criar': await handleCriar(sock, msg, from); break;
    case 'entrar': await handleEntrar(sock, msg, from, sender); break;
    case 'sair': await handleSair(sock, msg, from, sender); break;
    case 'iniciar': await handleIniciar(sock, msg, from); break;
    case 'status': await handleStatus(sock, msg, from); break;
    case 'ajuda': await sock.sendMessage(from, { text: messages.ajuda }); break;
    case 'regras': await sock.sendMessage(from, { text: messages.regras }); break;
    case 'ranking': await handleRanking(sock, msg, from); break;
    case 'perfil': await handlePerfil(sock, msg, sender); break;
    default:
      await sock.sendMessage(from, { text: messages.comandoInvalido });
  }
}

// -- Handlers de comandos de grupo --

async function handleCriar(sock, msg, groupId) {
  const existing = game.getMatchByGroup(groupId);
  if (existing) {
    await sock.sendMessage(groupId, { text: messages.partidaJaEmAndamento });
    return;
  }
  const match = game.createMatch(groupId);
  await sock.sendMessage(groupId, { text: messages.partidaCriada(match.matchId) });
}

async function handleEntrar(sock, msg, groupId, sender) {
  const match = game.getMatchByGroup(groupId);
  if (!match || match.status !== 'waiting') {
    await sock.sendMessage(groupId, { text: messages.semPartidaAtiva });
    return;
  }
  const playerName = sender.split('@')[0];
  const added = game.addPlayer(match, sender, sender); // nome = sender
  if (added) {
    await sock.sendMessage(groupId, { text: messages.entrouNaPartida(playerName, match.jogadores.length, config.minPlayers) });
  } else {
    await sock.sendMessage(groupId, { text: messages.jaEstaNaPartida });
  }
}

async function handleSair(sock, msg, groupId, sender) {
  const match = game.getMatchByGroup(groupId);
  if (!match || match.status !== 'waiting') {
    await sock.sendMessage(groupId, { text: messages.semPartidaAtiva });
    return;
  }
  const removed = game.removePlayer(match, sender);
  if (removed) {
    await sock.sendMessage(groupId, { text: messages.saiuDaPartida(sender.split('@')[0], match.jogadores.length) });
  } else {
    await sock.sendMessage(groupId, { text: messages.naoParticipa });
  }
}

async function handleIniciar(sock, msg, groupId) {
  const match = game.getMatchByGroup(groupId);
  if (!match || match.status !== 'waiting') {
    await sock.sendMessage(groupId, { text: messages.semPartidaAtiva });
    return;
  }
  if (match.jogadores.length < config.minPlayers) {
    await sock.sendMessage(groupId, { text: messages.minimoNaoAtingido(config.minPlayers) });
    return;
  }
  const success = game.startMatch(match);
  if (!success) {
    await sock.sendMessage(groupId, { text: 'Erro ao iniciar partida.' });
    return;
  }

  // Envia cartas no privado
  for (const player of match.jogadores) {
    const desc = getRoleDescription(player.role);
    const msgText = messages.suaCarta(roles[player.role].name, desc);
    try {
      await sock.sendMessage(player.id, { text: msgText });
    } catch {
      await sock.sendMessage(groupId, { text: messages.privadoNecessario(player.id.split('@')[0]) });
    }
  }
  await sock.sendMessage(groupId, { text: messages.partidaIniciada });

  // Inicia ciclo dia
  const { startDayPhase } = require('./game'); // circular, mas ok
  startDayPhase(match, sock);
}

async function handleStatus(sock, msg, groupId) {
  const match = game.getMatchByGroup(groupId);
  if (!match) {
    await sock.sendMessage(groupId, { text: 'Nenhuma partida ativa.' });
    return;
  }
  const statusText = `Status: ${match.status}\nJogadores: ${match.jogadores.length}\nFase: ${match.fase || 'nenhuma'}`;
  await sock.sendMessage(groupId, { text: statusText });
}

async function handleRanking(sock, msg, groupId) {
  const ranking = database.getRanking();
  const top = ranking.slice(0, 10).map((p, i) => `${i+1}. ${p.nome} - ${p.pontos} pts`).join('\n');
  await sock.sendMessage(groupId, { text: `🏆 Ranking:\n${top}` });
}

async function handlePerfil(sock, msg, sender) {
  const players = database.getPlayers();
  const player = players.find(p => p.id === sender);
  if (!player) {
    await sock.sendMessage(sender, { text: 'Perfil não encontrado.' });
    return;
  }
  const perfil = `👤 ${player.nome}\nPartidas: ${player.partidasJogadas}\nVitórias: ${player.vitorias}\nMortes: ${player.mortes}`;
  await sock.sendMessage(sender, { text: perfil });
}

// -- Comandos privados (durante a partida) --

async function handlePrivateCommand(sock, msg, command, args) {
  const sender = msg.key.remoteJid;
  const match = game.getMatchByPlayer(sender);
  if (!match) {
    await sock.sendMessage(sender, { text: 'Você não está em nenhuma partida ativa.' });
    return;
  }

  const player = match.jogadores.find(p => p.id === sender);
  if (!player || !player.alive) {
    await sock.sendMessage(sender, { text: messages.eliminado });
    return;
  }

  switch (command) {
    case 'votar':
      if (match.fase !== 'voting') {
        await sock.sendMessage(sender, { text: 'A votação não está aberta.' });
        return;
      }
      const targetMention = args[0]; // espera @usuario
      const targetId = targetMention?.replace('@', '') + '@s.whatsapp.net';
      if (!match.jogadores.some(p => p.id === targetId && p.alive)) {
        await sock.sendMessage(sender, { text: 'Jogador inválido.' });
        return;
      }
      game.registerVote(match, sender, targetId);
      await sock.sendMessage(sender, { text: messages.votoRegistrado });
      break;

    case 'acao':
      if (match.fase !== 'night') {
        await sock.sendMessage(sender, { text: 'Ações noturnas não estão disponíveis.' });
        return;
      }
      const role = roles[player.role];
      if (!role || !role.canAct) {
        await sock.sendMessage(sender, { text: 'Você não tem ação noturna.' });
        return;
      }
      const acaoTarget = args[0]?.replace('@', '') + '@s.whatsapp.net';
      if (!match.jogadores.some(p => p.id === acaoTarget && p.alive)) {
        await sock.sendMessage(sender, { text: 'Alvo inválido.' });
        return;
      }
      // Verifica restrições (ex.: guarda não pode proteger mesmo alvo)
      if (player.role === 'guarda') {
        const lastProtected = match.guardaProtecaoAnterior;
        if (lastProtected === acaoTarget) {
          await sock.sendMessage(sender, { text: 'Você não pode proteger a mesma pessoa duas noites seguidas.' });
          return;
        }
      }
      // Registra ação
      game.recordNightAction(match, player.role, sender, acaoTarget);
      await sock.sendMessage(sender, { text: 'Ação registrada.' });
      break;

    case 'executar':
      if (match.fase !== 'night') {
        await sock.sendMessage(sender, { text: 'Execução especial só pode ser solicitada durante a noite.' });
        return;
      }
      if (player.role !== 'investigador') {
        await sock.sendMessage(sender, { text: 'Apenas o Investigador pode solicitar execução especial.' });
        return;
      }
      if (match.execucaoEspecialUsada) {
        await sock.sendMessage(sender, { text: 'Execução especial já foi usada.' });
        return;
      }
      const execTarget = args[0]?.replace('@', '') + '@s.whatsapp.net';
      const targetPlayer = match.jogadores.find(p => p.id === execTarget && p.alive && p.role === 'zumbi');
      if (!targetPlayer) {
        await sock.sendMessage(sender, { text: 'Alvo inválido ou não é um zumbi.' });
        return;
      }
      // Marca para execução (será processada no resolveNight)
      match.nightActions.executarZumbi = execTarget;
      await sock.sendMessage(sender, { text: messages.execucaoEspecialSolicitada });
      break;

    default:
      await sock.sendMessage(sender, { text: 'Comando privado desconhecido.' });
  }
}

module.exports = { handleMessage };
