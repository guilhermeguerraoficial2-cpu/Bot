const database = require('./database');
const { generateId, shuffleArray, randomPick, findByProp } = require('./utils');
const { roles, getRoleDescription } = require('./roles');
const config = require('./config');
const messages = require('./messages');
const events = require('./events');
const { startPhaseTimer, cancelTimer } = require('./timers');

// Estado ativo em memória (sincronizado com JSON)
let matches = [];

// Inicializa carregando do banco
function init() {
  matches = database.getMatches() || [];
  // Reativa temporizadores de partidas em execução (simplificado)
  matches.forEach(match => {
    if (match.status === 'running') {
      // restart do timer da fase atual
      resumeMatchTimers(match);
    }
  });
}

// Salva matches no banco
function persistMatches() {
  database.saveMatches(matches);
}

// Cria uma nova partida em espera
function createMatch(groupId) {
  if (matches.some(m => m.groupId === groupId && m.status !== 'finished')) {
    return null; // já existe partida ativa
  }
  const match = {
    matchId: generateId(),
    groupId,
    status: 'waiting',
    fase: null,
    jogadores: [],
    nightActions: {},
    round: 0,
    winner: null,
    historia: [],
    zumbiChat: [],
    execucaoEspecialUsada: false,
    medicoCura: 1,
    atiradorBala: 1,
    guardaProtecaoAnterior: null,
  };
  matches.push(match);
  persistMatches();
  return match;
}

// Adiciona jogador à partida em espera
function addPlayer(match, playerId, playerName) {
  if (match.status !== 'waiting') return false;
  if (match.jogadores.some(p => p.id === playerId)) return false;
  match.jogadores.push({
    id: playerId,
    nome: playerName,
    role: null,
    alive: true,
    votedFor: null,
  });
  persistMatches();
  return true;
}

// Remove jogador da partida em espera
function removePlayer(match, playerId) {
  if (match.status !== 'waiting') return false;
  match.jogadores = match.jogadores.filter(p => p.id !== playerId);
  persistMatches();
  return true;
}

// Inicia a partida (distribui papéis, notifica, começa dia)
function startMatch(match) {
  const totalPlayers = match.jogadores.length;
  if (totalPlayers < config.minPlayers) return false;

  // Distribuição de papéis conforme tabela
  const { distribution } = getRoleDistribution(totalPlayers);
  const deck = [];
  for (const [role, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      deck.push(role);
    }
  }
  const shuffled = shuffleArray(deck);
  match.jogadores.forEach((player, index) => {
    player.role = shuffled[index];
    player.alive = true;
  });

  // Define primeiro zumbi master (para chat)
  match.zumbiMaster = match.jogadores.find(p => p.role === 'zumbi')?.id;

  match.status = 'running';
  match.fase = 'day';
  match.round = 1;
  persistMatches();

  // Notifica cada jogador no privado sobre sua carta
  // (será feito pelo commands.js usando sendMessage)
  return true;
}

// Distribuição de papéis
function getRoleDistribution(total) {
  let zumbis = 0;
  if (total === 8) zumbis = 1;
  else if (total === 12) zumbis = 2;
  else if (total === 16) zumbis = 3;
  else if (total === 20) zumbis = 4;
  else {
    // Proporção ~20% de zumbis, mínimo 1
    zumbis = Math.max(1, Math.floor(total * config.maxZumbisPercent));
  }
  const sobreviventes = total - zumbis - 4; // médico, guarda, investigador, atirador
  return {
    distribution: {
      zumbi: zumbis,
      medico: 1,
      guarda: 1,
      investigador: 1,
      atirador: 1,
      sobrevivente: sobreviventes,
    }
  };
}

// Avança fase do dia (já inicia timer)
function startDayPhase(match, sock) {
  match.fase = 'day';
  // Limpa ações noturnas
  match.nightActions = {};
  match.jogadores.forEach(p => { p.votedFor = null; });

  // Envia mensagem de início do dia
  sock.sendMessage(match.groupId, { text: messages.diaIniciado.replace('{tempo}', formatTimeStr(config.tempos.dia)) });
  startPhaseTimer(match.groupId, 'day', config.tempos.dia,
    (timeStr) => {
      sock.sendMessage(match.groupId, { text: messages.contagemRegressiva('☀️ Dia', timeStr) });
    },
    () => startVotingPhase(match, sock)
  );
}

// Inicia votação
function startVotingPhase(match, sock) {
  match.fase = 'voting';
  sock.sendMessage(match.groupId, { text: messages.votacaoIniciada.replace('{tempo}', formatTimeStr(config.tempos.votacao)) });
  startPhaseTimer(match.groupId, 'voting', config.tempos.votacao,
    (timeStr) => {
      sock.sendMessage(match.groupId, { text: messages.contagemRegressiva('🗳️ Votação', timeStr) });
    },
    () => processVotes(match, sock)
  );
}

// Processa votação
function processVotes(match, sock) {
  const votes = {};
  match.jogadores.filter(p => p.alive).forEach(p => {
    if (p.votedFor) {
      votes[p.votedFor] = (votes[p.votedFor] || 0) + 1;
    }
  });

  let maxVotes = 0;
  let eliminated = [];
  for (const [playerId, count] of Object.entries(votes)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminated = [playerId];
    } else if (count === maxVotes) {
      eliminated.push(playerId);
    }
  }

  if (eliminated.length === 1 && maxVotes > 0) {
    // Elimina o mais votado
    eliminatePlayer(match, eliminated[0], 'votação');
    sock.sendMessage(match.groupId, { text: messages.eliminadoPorVotacao(getPlayerName(match, eliminated[0])) });
  } else {
    // Empate -> nova votação rápida? Conforme regras: nova votação de 30s, se continuar ninguém eliminado.
    sock.sendMessage(match.groupId, { text: messages.empateVotacao });
    // Lógica de desempate simplificada: após 30s, se ainda empatado, ninguém morre.
    setTimeout(() => {
      startNightPhase(match, sock);
    }, 30000);
    return;
  }

  checkWinCondition(match, sock);
  if (match.status === 'running') {
    startNightPhase(match, sock);
  }
}

// Inicia noite
function startNightPhase(match, sock) {
  match.fase = 'night';
  match.nightActions = {};
  // Zera proteção do guarda (a anterior é usada para validação)
  match.guardaProtecaoAnterior = match.nightActions.protectTarget || null;

  sock.sendMessage(match.groupId, { text: messages.noiteIniciada.replace('{tempo}', formatTimeStr(config.tempos.noite)) });

  // Envia mensagens privadas para cada papel ativo pedindo ação
  match.jogadores.filter(p => p.alive).forEach(p => {
    const role = roles[p.role];
    if (role && role.canAct && role.actionRequired) {
      const actionMsg = `🌙 Noite! Você é *${role.name}*. Escolha um jogador usando /acao @jogador`;
      sock.sendMessage(p.id, { text: actionMsg }).catch(() => {
        sock.sendMessage(match.groupId, { text: messages.privadoNecessario(p.nome.split('@')[0]) });
      });
    }
  });

  startPhaseTimer(match.groupId, 'night', config.tempos.noite,
    (timeStr) => {
      sock.sendMessage(match.groupId, { text: messages.contagemRegressiva('🌙 Noite', timeStr) });
    },
    () => resolveNight(match, sock)
  );
}

// Resolve ações da noite
function resolveNight(match, sock) {
  const actions = match.nightActions || {};
  const deadThisNight = [];

  // 1. Proteção do Guarda (já registrada em protectTarget)
  // 2. Ataque do Zumbi
  const infectTarget = actions.infectTarget;
  const protectTarget = actions.protectTarget;
  const cureTarget = actions.cureTarget;
  const shootTarget = actions.shootTarget;
  const investigateTarget = actions.investigateTarget;

  // Verifica ataque do zumbi
  let zombieAttackSuccess = false;
  if (infectTarget) {
    // Se o alvo for o Guarda, ataque falha e Guarda descobre zumbi atacante
    const targetPlayer = findPlayerById(match, infectTarget);
    if (targetPlayer.role === 'guarda') {
      // Guarda descobre quem atacou (o primeiro zumbi que agiu)
      const zombieActor = match.jogadores.find(p => p.role === 'zumbi' && p.alive);
      if (zombieActor) {
        sock.sendMessage(targetPlayer.id, { text: messages.guardaDescobriuZumbi(zombieActor.nome.split('@')[0]) });
      }
    } else if (protectTarget === infectTarget) {
      // Proteção impede infecção
    } else {
      // Infecta se não curado
      if (cureTarget !== infectTarget) {
        // Zumbi infecta
        infectPlayer(match, infectTarget, sock);
        zombieAttackSuccess = true;
      }
    }
  }

  // 3. Cura do Médico
  if (cureTarget) {
    const medicoPlayer = match.jogadores.find(p => p.role === 'medico' && p.alive);
    if (medicoPlayer) {
      if (zombieAttackSuccess && cureTarget === infectTarget) {
        // Cura bem-sucedida
        // jogador não infectado, médico ganha nova cura
        match.medicoCura += 1;
        sock.sendMessage(medicoPlayer.id, { text: messages.novaCura });
      } else {
        // Cura falhou
        sock.sendMessage(medicoPlayer.id, { text: messages.curaPerdida });
        // Perde poder, transfere carta
        transferRole(match, medicoPlayer.id, 'medico', sock);
      }
    }
  }

  // 4. Investigação
  if (investigateTarget) {
    const invPlayer = match.jogadores.find(p => p.role === 'investigador' && p.alive);
    if (invPlayer) {
      const target = findPlayerById(match, investigateTarget);
      const isZumbi = target.role === 'zumbi';
      sock.sendMessage(invPlayer.id, { text: messages.investigacaoResultado(target.nome.split('@')[0], isZumbi) });
    }
  }

  // 5. Tiro do Atirador
  if (shootTarget) {
    const atirador = match.jogadores.find(p => p.role === 'atirador' && p.alive);
    if (atirador) {
      eliminatePlayer(match, shootTarget, 'tiro');
      deadThisNight.push(shootTarget);
      // Atirador perde função
      transferRole(match, atirador.id, 'atirador', sock);
    }
  }

  // 6. Execução especial do Investigador (se solicitada via comando /executar)
  // A execução é tratada no command handler (fica pendente), mas a resolução noturna já passou.
  // Na verdade, a execução especial deve ocorrer aqui se tiver sido solicitada antes do fim da noite.
  if (actions.executarZumbi && !match.execucaoEspecialUsada) {
    const alvo = actions.executarZumbi;
    const inv = match.jogadores.find(p => p.role === 'investigador' && p.alive);
    if (inv) {
      eliminatePlayer(match, alvo, 'execução especial');
      deadThisNight.push(alvo);
      match.execucaoEspecialUsada = true;
      // Anúncio genérico
      sock.sendMessage(match.groupId, { text: messages.morteNoturna });
    }
  }

  // Anúncios de mortes
  if (deadThisNight.length > 0) {
    // já foram enviados individualmente
    // mensagem genérica se não foi execução
  } else if (!actions.executarZumbi) {
    sock.sendMessage(match.groupId, { text: messages.nenhumaMorte });
  }

  // Processa transferências e verifica vitória
  checkWinCondition(match, sock);
  if (match.status === 'running') {
    // Inicia novo dia
    startDayPhase(match, sock);
  }
}

// Funções auxiliares
function eliminatePlayer(match, playerId, cause) {
  const player = findPlayerById(match, playerId);
  if (!player || !player.alive) return;
  player.alive = false;
  match.historia.push({ playerId, cause, round: match.round });

  // Se era zumbi, remove do chat secreto
  if (player.role === 'zumbi') {
    match.zumbiChat = match.zumbiChat.filter(id => id !== playerId);
  }

  // Notifica jogador eliminado
  events.emit('playerEliminated', match, player);

  // Se o jogador era portador de carta especial, transfere
  const transferableRoles = ['medico', 'atirador', 'investigador'];
  if (transferableRoles.includes(player.role)) {
    transferRole(match, playerId, player.role, null); // sock passado depois
  }
}

function infectPlayer(match, playerId, sock) {
  const player = findPlayerById(match, playerId);
  if (!player || !player.alive || player.role === 'guarda') return;
  const previousRole = player.role;
  player.role = 'zumbi';
  match.zumbiChat.push(playerId);
  // Notifica infecção
  sock.sendMessage(playerId, { text: messages.infectado });
  // Transfere carta se era especial
  if (['medico', 'atirador', 'investigador'].includes(previousRole)) {
    transferRole(match, playerId, previousRole, sock);
  }
}

function transferRole(match, oldPlayerId, roleKey, sock) {
  const survivors = match.jogadores.filter(p => p.alive && p.role === 'sobrevivente');
  if (survivors.length === 0) return; // não há para quem transferir
  const newHolder = randomPick(survivors);
  newHolder.role = roleKey;
  // Mensagem privada para o novo portador
  if (sock) {
    sock.sendMessage(newHolder.id, { text: messages.cartaTransferida(roles[roleKey].name) });
    sock.sendMessage(newHolder.id, { text: getRoleDescription(roleKey) });
  }
  events.emit('roleTransfer', oldPlayerId, newHolder.id, roleKey);
}

function checkWinCondition(match, sock) {
  const alivePlayers = match.jogadores.filter(p => p.alive);
  const aliveZumbis = alivePlayers.filter(p => p.role === 'zumbi').length;
  const aliveHumanos = alivePlayers.filter(p => p.role !== 'zumbi').length;

  if (aliveZumbis === 0) {
    endMatch(match, 'humanos', sock);
  } else if (aliveZumbis >= aliveHumanos) {
    endMatch(match, 'zumbis', sock);
  }
}

function endMatch(match, winner, sock) {
  match.status = 'finished';
  match.winner = winner;
  match.fase = null;
  cancelTimer(match.groupId);
  persistMatches();

  const msg = winner === 'humanos' ? messages.humanosVencem : messages.zumbisVencem;
  sock.sendMessage(match.groupId, { text: msg });
  sock.sendMessage(match.groupId, { text: messages.partidaEncerrada });

  // Atualizar estatísticas (ranking)
  updateStatistics(match);
}

function updateStatistics(match) {
  const playersDb = database.getPlayers();
  const stats = database.getStatistics();
  // ... atualiza partidas jogadas, vitórias, etc (simplificado)
  // Implementação real: iterar jogadores e contabilizar
  database.savePlayers(playersDb);
  database.saveStatistics(stats);
}

function findPlayerById(match, id) {
  return match.jogadores.find(p => p.id === id);
}

function getPlayerName(match, id) {
  return findPlayerById(match, id)?.nome || 'Desconhecido';
}

// Retomar timers
function resumeMatchTimers(match) {
  // ... lógica de retomada simplificada (não implementada por brevidade)
}

// Registra voto de um jogador
function registerVote(match, voterId, targetId) {
  if (match.fase !== 'voting') return false;
  const voter = findPlayerById(match, voterId);
  if (!voter || !voter.alive) return false;
  voter.votedFor = targetId;
  persistMatches();
  return true;
}

// Zumbi envia mensagem para o chat secreto
function sendZumbiMessage(match, senderId, message) {
  match.zumbiChat.push({ from: senderId, text: message, timestamp: Date.now() });
  // Retransmite para todos os zumbis vivos (será feito no command handler)
}

module.exports = {
  init,
  createMatch,
  addPlayer,
  removePlayer,
  startMatch,
  getMatchByGroup: (groupId) => matches.find(m => m.groupId === groupId && m.status !== 'finished'),
  getMatchByPlayer: (playerId) => matches.find(m => m.jogadores.some(p => p.id === playerId && p.alive)),
  getMatchById: (matchId) => matches.find(m => m.matchId === matchId),
  registerVote,
  sendZumbiMessage,
  // Ações noturnas serão tratadas pelo command handler, que armazenará em nightActions
  recordNightAction: (match, actionType, playerId, targetId) => {
    match.nightActions[actionType] = targetId;
    persistMatches();
  },
  getRoleDistribution,
  // Para comandos
};
