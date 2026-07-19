// game.js - Lógica central do jogo Surto
const config = require('./config');
const db = require('./database');
const roles = require('./roles');
const { shuffle, randomInt } = require('./utils');
const { startPhaseTimer, clearPhaseTimer } = require('./timers');
const { gameStartMessage, votePrompt } = require('./messages');
const { getRole } = roles;

// Cache em memória das partidas ativas (carregadas do JSON no início e salvas periodicamente)
let matches = [];

// Inicializa carregando partidas salvas
function init() {
    const data = db.loadAll();
    matches = data.matches || [];
    // Remove partidas antigas 'active' que podem ter ficado travadas (simples reset)
    matches = matches.filter(m => m.status === 'waiting' || m.status === 'active');
    saveMatches();
}
init();

// Salva partidas no disco
function saveMatches() {
    db.saveMatches(matches);
}

// Encontra partida ativa em um grupo
function findMatchByGroup(groupId) {
    return matches.find(m => m.groupId === groupId && (m.status === 'waiting' || m.status === 'active'));
}

// Encontra partida ativa por jogador (privado)
function findActiveMatchByPlayer(playerId) {
    return matches.find(m => m.status === 'active' && m.players.some(p => p.id === playerId && p.alive));
}

/**
 * Cria uma nova partida no grupo
 */
async function createMatch(sock, groupId, creatorId) {
    if (findMatchByGroup(groupId)) {
        return sock.sendMessage(groupId, { text: '⚠️ Já existe uma partida em andamento neste grupo.' });
    }
    const match = {
        id: Date.now().toString(),
        groupId,
        creatorId,
        status: 'waiting',
        players: [],
        phase: 'waiting',
        dayCount: 1,
        specialExecutionUsed: false,
        zombieGroupId: null,
        nightActions: {}   // armazena ações durante a noite
    };
    matches.push(match);
    saveMatches();
    await sock.sendMessage(groupId, { text: '🎮 *Nova partida criada!*\nDigite /entrar para participar.' });
}

/**
 * Jogador entra na partida
 */
async function joinMatch(sock, groupId, playerId, playerName) {
    const match = findMatchByGroup(groupId);
    if (!match || match.status !== 'waiting') {
        return sock.sendMessage(groupId, { text: '❌ Nenhuma partida aguardando jogadores.' });
    }
    if (match.players.find(p => p.id === playerId)) {
        return sock.sendMessage(groupId, { text: '⚠️ Você já está na partida.' });
    }
    match.players.push({
        id: playerId,
        name: playerName,
        role: null,
        alive: true,
        specialRoleData: {}   // ex: médico tem curas, atirador balas, etc.
    });
    saveMatches();
    await sock.sendMessage(groupId, { 
        text: `✅ @${playerId.split('@')[0]} entrou! (${match.players.length} jogadores)`,
        mentions: [playerId]
    });
}

/**
 * Jogador sai da partida
 */
async function leaveMatch(sock, groupId, playerId) {
    const match = findMatchByGroup(groupId);
    if (!match || match.status !== 'waiting') {
        return sock.sendMessage(groupId, { text: '❌ Nenhuma partida aguardando.' });
    }
    const idx = match.players.findIndex(p => p.id === playerId);
    if (idx === -1) {
        return sock.sendMessage(groupId, { text: '⚠️ Você não está na partida.' });
    }
    match.players.splice(idx, 1);
    saveMatches();
    await sock.sendMessage(groupId, { text: `👋 @${playerId.split('@')[0]} saiu. (${match.players.length} jogadores)`, mentions: [playerId] });
}

/**
 * Inicia a partida (apenas o criador ou qualquer um? Deixamos qualquer um, mas pode restringir)
 */
async function startMatch(sock, groupId, requesterId) {
    const match = findMatchByGroup(groupId);
    if (!match || match.status !== 'waiting') {
        return sock.sendMessage(groupId, { text: '❌ Nenhuma partida aguardando início.' });
    }
    if (match.players.length < config.minPlayers) {
        return sock.sendMessage(groupId, { text: `❌ Mínimo de ${config.minPlayers} jogadores.` });
    }

    // Distribuir papéis
    assignRoles(match);

    // Criar grupo secreto dos zumbis
    await createZombieGroup(sock, match);

    // Envia mensagens privadas com os papéis
    for (const player of match.players) {
        const role = getRole(player.role);
        await sock.sendMessage(player.id, { 
            text: `🃏 Sua carta: *${role.emoji} ${role.name}*\n${role.description}\n\nMantenha segredo!` 
        });
    }

    match.status = 'active';
    match.phase = 'day';
    saveMatches();

    await sock.sendMessage(groupId, { text: gameStartMessage(match.players) });

    // Inicia ciclo do dia (discussão)
    startDayPhase(sock, match);
}

/**
 * Distribui papéis de acordo com número de jogadores
 */
function assignRoles(match) {
    const players = shuffle(match.players);
    const total = players.length;
    const zombieCount = Math.max(2, Math.floor(total / 4)); // mínimo 2 zumbis
    const humanSpecialRoles = ['doctor', 'shooter', 'guard', 'investigator'];
    
    // Zumbis
    for (let i = 0; i < zombieCount; i++) {
        players[i].role = 'zombie';
        players[i].specialRoleData = {};
    }

    // Humanos especiais
    let humanIndex = zombieCount;
    humanSpecialRoles.forEach(roleKey => {
        if (humanIndex < total) {
            players[humanIndex].role = roleKey;
            // Inicializa dados especiais
            if (roleKey === 'doctor') {
                players[humanIndex].specialRoleData = { cures: 1 };
            } else if (roleKey === 'shooter') {
                players[humanIndex].specialRoleData = { bullets: 1 };
            } else if (roleKey === 'guard') {
                players[humanIndex].specialRoleData = { lastProtected: null };
            }
            humanIndex++;
        }
    });

    // Resto são sobreviventes
    for (let i = humanIndex; i < total; i++) {
        players[i].role = 'survivor';
        players[i].specialRoleData = {};
    }
}

/**
 * Cria grupo secreto com os zumbis
 */
async function createZombieGroup(sock, match) {
    const zombies = match.players.filter(p => p.role === 'zombie').map(p => p.id);
    if (zombies.length === 0) return;
    try {
        const groupName = `🧟 Zumbis - Partida ${match.id.slice(-4)}`;
        const result = await sock.groupCreate(groupName, zombies);
        match.zombieGroupId = result.gid;
        await sock.sendMessage(result.gid, { text: '🧟 Grupo secreto dos zumbis. Discutam aqui e decidam o alvo da noite.\nComando para atacar: /atacar @jogador' });
    } catch (err) {
        console.error('Erro ao criar grupo zumbi:', err);
        // fallback: zumbis recebem instruções individuais
    }
}

// ---------------------------------------------
// CICLO DO DIA
// ---------------------------------------------
function startDayPhase(sock, match) {
    clearPhaseTimer(match.id);
    match.phase = 'day';
    match.nightActions = {}; // limpa ações da noite anterior
    saveMatches();
    startPhaseTimer(match.id, 'discussion', match.groupId, sock, () => {
        startVotingPhase(sock, match);
    });
}

function startVotingPhase(sock, match) {
    match.phase = 'voting';
    match.votes = {};   // { voterId: targetId }
    saveMatches();
    const alivePlayers = match.players.filter(p => p.alive);
    sock.sendMessage(match.groupId, { text: votePrompt(alivePlayers) });
    startPhaseTimer(match.id, 'voting', match.groupId, sock, () => {
        processVotes(sock, match);
    });
}

/**
 * Registra voto de um jogador
 */
async function handleVote(sock, groupId, voterId, targetMention) {
    const match = findMatchByGroup(groupId);
    if (!match || match.status !== 'active' || match.phase !== 'voting') {
        return sock.sendMessage(groupId, { text: '❌ Não é hora de votar.' });
    }
    const voter = match.players.find(p => p.id === voterId && p.alive);
    if (!voter) return;

    // Extrai ID do mencionado (formato @xxxxx)
    let targetId = targetMention?.replace('@', '') + '@s.whatsapp.net';
    const target = match.players.find(p => p.id === targetId && p.alive);
    if (!target) {
        return sock.sendMessage(groupId, { text: 'Jogador inválido ou eliminado.' });
    }

    match.votes[voterId] = targetId;
    saveMatches();
    // Não enviar confirmação para evitar poluição, apenas guarda
}

/**
 * Processa votação: elimina o mais votado ou inicia revotação
 */
async function processVotes(sock, match) {
    const votes = match.votes || {};
    const voteCount = {};
    for (let target of Object.values(votes)) {
        voteCount[target] = (voteCount[target] || 0) + 1;
    }

    const maxVotes = Math.max(...Object.values(voteCount), 0);
    const candidates = Object.keys(voteCount).filter(id => voteCount[id] === maxVotes);

    if (candidates.length === 0 || maxVotes === 0) {
        await sock.sendMessage(match.groupId, { text: 'Ninguém votou. Ninguém foi eliminado.' });
        startNightPhase(sock, match);
        return;
    }

    if (candidates.length === 1) {
        // Um único mais votado -> elimina
        const eliminatedId = candidates[0];
        await eliminatePlayer(sock, match, eliminatedId, 'votação');
        if (checkWinCondition(sock, match)) return;
        startNightPhase(sock, match);
    } else {
        // Empate: revotação apenas entre os empatados
        await sock.sendMessage(match.groupId, { text: '⚖️ Empate! Nova votação apenas entre os empatados.' });
        match.phase = 'reVoting';
        match.votes = {};
        match.reVoteCandidates = candidates;
        saveMatches();
        startPhaseTimer(match.id, 'reVoting', match.groupId, sock, () => {
            processReVotes(sock, match);
        });
        // Reenvia prompt de voto com lista reduzida
        const alive = match.players.filter(p => p.alive && candidates.includes(p.id));
        sock.sendMessage(match.groupId, { text: votePrompt(alive) });
    }
}

async function processReVotes(sock, match) {
    const votes = match.votes || {};
    const candidates = match.reVoteCandidates || [];
    const voteCount = {};
    for (let target of Object.values(votes)) {
        if (candidates.includes(target)) {
            voteCount[target] = (voteCount[target] || 0) + 1;
        }
    }
    const maxVotes = Math.max(...Object.values(voteCount), 0);
    const finalists = Object.keys(voteCount).filter(id => voteCount[id] === maxVotes);

    if (finalists.length === 1) {
        await eliminatePlayer(sock, match, finalists[0], 'votação');
        if (checkWinCondition(sock, match)) return;
    } else {
        await sock.sendMessage(match.groupId, { text: '⚖️ Empate persistente. Ninguém eliminado.' });
    }
    startNightPhase(sock, match);
}

/**
 * Elimina um jogador (mostra mensagem no grupo)
 */
async function eliminatePlayer(sock, match, playerId, reason) {
    const player = match.players.find(p => p.id === playerId);
    if (!player || !player.alive) return;
    player.alive = false;
    const roleEmoji = getRole(player.role).emoji;
    await sock.sendMessage(match.groupId, { 
        text: `☠️ ${player.name} foi eliminado (${reason}). Era um ${roleEmoji}`,
        mentions: [playerId]
    });
    saveMatches();
}

// ---------------------------------------------
// CICLO DA NOITE
// ---------------------------------------------
async function startNightPhase(sock, match) {
    match.phase = 'night';
    match.nightActions = {
        zombieTarget: null,
        doctorTarget: null,
        guardTarget: null,
        investigatorTarget: null,
        shooterTarget: null
    };
    saveMatches();

    // Envia mensagens privadas para cada jogador com ação noturna
    const alive = match.players.filter(p => p.alive);
    for (const player of alive) {
        const role = getRole(player.role);
        if (role.hasNightAction) {
            await sock.sendMessage(player.id, { text: `🌙 Noite caiu. Você é ${role.emoji} ${role.name}. Use /acao @jogador` });
        } else {
            await sock.sendMessage(player.id, { text: '🌙 A noite chegou. Sobreviventes apenas observam.' });
        }
    }

    // Zumbis recebem instrução no grupo secreto (se existir)
    if (match.zombieGroupId) {
        await sock.sendMessage(match.zombieGroupId, { text: '🧟 Escolham um alvo: /atacar @jogador' });
    }

    startPhaseTimer(match.id, 'night', match.groupId, sock, () => {
        processNightActions(sock, match);
    });
}

/**
 * Processa ação noturna de um jogador (médico, atirador, guarda, investigador)
 */
async function processNightAction(sock, match, player, targetMention) {
    if (match.phase !== 'night') {
        return sock.sendMessage(player.id, { text: 'Não é noite ainda.' });
    }
    const targetId = targetMention?.replace('@', '') + '@s.whatsapp.net';
    const target = match.players.find(p => p.id === targetId && p.alive);
    if (!target) {
        return sock.sendMessage(player.id, { text: 'Alvo inválido.' });
    }

    switch (player.role) {
        case 'doctor':
            match.nightActions.doctorTarget = targetId;
            await sock.sendMessage(player.id, { text: `💉 Você escolheu curar ${target.name}.` });
            break;
        case 'shooter':
            if (player.specialRoleData.bullets < 1) {
                return sock.sendMessage(player.id, { text: '🔫 Você não tem mais balas.' });
            }
            match.nightActions.shooterTarget = targetId;
            await sock.sendMessage(player.id, { text: `🔫 Você atirará em ${target.name}.` });
            break;
        case 'guard':
            if (player.specialRoleData.lastProtected === targetId) {
                return sock.sendMessage(player.id, { text: '🛡 Você não pode proteger o mesmo jogador duas noites seguidas.' });
            }
            match.nightActions.guardTarget = targetId;
            player.specialRoleData.lastProtected = targetId;
            await sock.sendMessage(player.id, { text: `🛡 Você protegerá ${target.name}.` });
            break;
        case 'investigator':
            match.nightActions.investigatorTarget = targetId;
            await sock.sendMessage(player.id, { text: `🔎 Investigando ${target.name}...` });
            break;
        default:
            break;
    }
    saveMatches();
}

/**
 * Voto dos zumbis para o ataque
 */
async function zombieAttackVote(sock, match, player, targetMention) {
    if (match.phase !== 'night') return;
    const targetId = targetMention?.replace('@', '') + '@s.whatsapp.net';
    // Apenas conta o voto, depois processa maioria
    if (!match._zombieVotes) match._zombieVotes = {};
    match._zombieVotes[player.id] = targetId;
    saveMatches();
    // Não envia confirmação, apenas registra
}

/**
 * Processa todas as ações da noite e gera resultados
 */
async function processNightActions(sock, match) {
    const actions = match.nightActions;
    const alivePlayers = match.players.filter(p => p.alive);

    // 1. Decisão dos zumbis (maioria dos votos)
    let zombieTarget = null;
    if (match._zombieVotes) {
        const voteCount = {};
        for (let target of Object.values(match._zombieVotes)) {
            voteCount[target] = (voteCount[target] || 0) + 1;
        }
        const maxVotes = Math.max(...Object.values(voteCount), 0);
        const candidates = Object.keys(voteCount).filter(id => voteCount[id] === maxVotes);
        zombieTarget = candidates.length === 1 ? candidates[0] : null; // empate = sem ataque
    }
    match._zombieVotes = {};

    // 2. Proteção do guarda
    let guardDiscoveredZombie = null;
    if (actions.guardTarget) {
        // Se o alvo do guarda for o mesmo do ataque zumbi, a vítima é salva
        // Se o guarda for o alvo do zumbi, ele descobre um zumbi
        const guardPlayer = match.players.find(p => p.role === 'guard' && p.alive);
        if (guardPlayer && zombieTarget === guardPlayer.id) {
            // Guarda foi atacado -> descobre um zumbi aleatório
            const zombies = match.players.filter(p => p.role === 'zombie' && p.alive);
            if (zombies.length > 0) {
                guardDiscoveredZombie = zombies[randomInt(0, zombies.length - 1)].id;
            }
            zombieTarget = null; // ataque falha
            await sock.sendMessage(guardPlayer.id, { 
                text: `🛡 Você foi atacado durante a noite!\nVocê descobriu um zumbi: ${guardDiscoveredZombie ? match.players.find(p=>p.id===guardDiscoveredZombie)?.name : 'nenhum'}` 
            });
        } else if (actions.guardTarget === zombieTarget) {
            // Guarda protegeu a vítima
            zombieTarget = null; // ataque falha
            await sock.sendMessage(guardPlayer.id, { text: `🛡 Sua proteção salvou ${match.players.find(p=>p.id===actions.guardTarget)?.name}!` });
        }
    }

    // 3. Ataque zumbi (se ainda houver alvo)
    if (zombieTarget) {
        // A vítima é marcada para infecção (será processada após cura)
    }

    // 4. Cura do médico
    let doctorLostPower = false;
    const doctor = match.players.find(p => p.role === 'doctor' && p.alive);
    if (actions.doctorTarget && doctor) {
        if (actions.doctorTarget === zombieTarget) {
            // Cura bem-sucedida
            zombieTarget = null; // salvo
            doctor.specialRoleData.cures = (doctor.specialRoleData.cures || 0) + 1;
            await sock.sendMessage(doctor.id, { text: `💉 Cura bem-sucedida! Você ganhou mais uma cura (total: ${doctor.specialRoleData.cures}).` });
        } else {
            // Cura desperdiçada
            doctorLostPower = true;
            await sock.sendMessage(doctor.id, { text: '💉 Você curou alguém que não estava infectado. Perdeu o poder de Médico.' });
        }
    }

    // 5. Investigador
    if (actions.investigatorTarget) {
        const target = match.players.find(p => p.id === actions.investigatorTarget);
        const isZombie = target?.role === 'zombie';
        await sock.sendMessage(
            match.players.find(p => p.role === 'investigator' && p.alive)?.id,
            { text: `🔎 Resultado: ${target.name} ${isZombie ? 'É ZUMBI 🧟' : 'NÃO é zumbi 👤'}` }
        );
    }

    // 6. Atirador
    if (actions.shooterTarget) {
        const shooter = match.players.find(p => p.role === 'shooter' && p.alive);
        if (shooter && shooter.specialRoleData.bullets > 0) {
            shooter.specialRoleData.bullets--;
            await eliminatePlayer(sock, match, actions.shooterTarget, 'tiro');
            // Atualizar estatísticas
            const stats = db.loadAll().statistics;
            stats.totalShots++;
            if (match.players.find(p => p.id === actions.shooterTarget)?.role === 'zombie') {
                stats.accurateShots++;
            }
            db.saveStatistics(stats);
            if (shooter.specialRoleData.bullets === 0) {
                // Perde poder, vira sobrevivente
                shooter.role = 'survivor';
                await sock.sendMessage(shooter.id, { text: '🔫 Você usou sua última bala e agora é um Sobrevivente.' });
            }
        }
    }

    // 7. Aplicar ataque zumbi se ainda existir alvo
    if (zombieTarget) {
        await eliminatePlayer(sock, match, zombieTarget, 'ataque zumbi');
    }

    // 8. Transferir poder do médico se perdeu
    if (doctorLostPower && doctor) {
        const humans = match.players.filter(p => p.team !== 'zombie' && p.alive && p.id !== doctor.id);
        if (humans.length > 0) {
            const newDoctor = humans[randomInt(0, humans.length - 1)];
            // Se já for outro papel especial, substitui
            newDoctor.role = 'doctor';
            newDoctor.specialRoleData = { cures: 1 };
            await sock.sendMessage(newDoctor.id, { text: '💉 Você foi escolhido como o novo Médico! Use com sabedoria.' });
        }
        doctor.role = 'survivor';
        doctor.specialRoleData = {};
        await sock.sendMessage(doctor.id, { text: 'Você agora é um Sobrevivente.' });
    }

    // 9. Verificar condição de vitória
    if (checkWinCondition(sock, match)) return;

    // 10. Amanhecer
    match.dayCount++;
    saveMatches();
    startDayPhase(sock, match);
}

/**
 * Verifica vitória de humanos ou zumbis
 */
function checkWinCondition(sock, match) {
    const aliveHumans = match.players.filter(p => p.alive && p.role !== 'zombie').length;
    const aliveZombies = match.players.filter(p => p.alive && p.role === 'zombie').length;

    if (aliveZombies === 0) {
        endGame(sock, match, 'humans');
        return true;
    }
    if (aliveZombies >= aliveHumans) {
        endGame(sock, match, 'zombies');
        return true;
    }
    return false;
}

function endGame(sock, match, winner) {
    match.status = 'finished';
    clearPhaseTimer(match.id);
    saveMatches();

    const winnerText = winner === 'humans' ? '🏆 Humanos venceram!' : '🧟 Zumbis dominaram a cidade!';
    sock.sendMessage(match.groupId, { text: `🎮 Fim de jogo! ${winnerText}` });

    // Atualizar estatísticas dos jogadores
    const { players: dbPlayers, statistics } = db.loadAll();
    statistics.totalGames++;
    if (winner === 'humans') statistics.humanWins++;
    else statistics.zombieWins++;
    db.saveStatistics(statistics);

    for (const p of match.players) {
        if (!dbPlayers[p.id]) {
            dbPlayers[p.id] = { name: p.name, wins: 0, losses: 0, gamesPlayed: 0 };
        }
        dbPlayers[p.id].gamesPlayed++;
        if ((winner === 'humans' && p.role !== 'zombie') || (winner === 'zombies' && p.role === 'zombie')) {
            dbPlayers[p.id].wins++;
        } else {
            dbPlayers[p.id].losses++;
        }
    }
    db.savePlayers(dbPlayers);
    db.updateRanking(dbPlayers);

    // Remove partida da lista ativa
    matches = matches.filter(m => m.id !== match.id);
    saveMatches();
}

/**
 * Guarda solicita execução especial (precisa ter descoberto um zumbi)
 */
async function requestSpecialExecution(sock, match, guardPlayer, targetMention) {
    if (match.specialExecutionUsed) {
        return sock.sendMessage(guardPlayer.id, { text: 'Execução especial já foi usada nesta partida.' });
    }
    // Verificar se o guarda realmente descobriu um zumbi (armazenado em algum lugar)
    // Simplificação: guardamos a descoberta na propriedade do jogador
    if (!guardPlayer.discoveredZombie) {
        return sock.sendMessage(guardPlayer.id, { text: 'Você não descobriu nenhum zumbi ainda.' });
    }
    const targetId = targetMention?.replace('@', '') + '@s.whatsapp.net';
    if (targetId !== guardPlayer.discoveredZombie) {
        return sock.sendMessage(guardPlayer.id, { text: 'Você só pode executar o zumbi que descobriu.' });
    }
    // Envia solicitação para o investigador
    const investigator = match.players.find(p => p.role === 'investigator' && p.alive);
    if (!investigator) {
        return sock.sendMessage(guardPlayer.id, { text: 'Não há investigador vivo para confirmar.' });
    }
    match.pendingSpecialExecution = { guardId: guardPlayer.id, zombieId: targetId };
    await sock.sendMessage(investigator.id, { 
        text: `🛡 O Guarda quer executar ${match.players.find(p=>p.id===targetId)?.name}. Digite /confirmar para autorizar.` 
    });
    saveMatches();
}

async function confirmSpecialExecution(sock, match, investigatorPlayer) {
    if (!match.pendingSpecialExecution || investigatorPlayer.role !== 'investigator') return;
    const { zombieId } = match.pendingSpecialExecution;
    match.specialExecutionUsed = true;
    await eliminatePlayer(sock, match, zombieId, 'execução especial');
    await sock.sendMessage(match.groupId, { text: '☠️ Um membro da cidade foi eliminado durante a noite.' });
    delete match.pendingSpecialExecution;
    saveMatches();
    if (!checkWinCondition(sock, match)) {
        // Se o jogo não acabou, continua o ciclo (já está de dia? depende de quando foi acionado)
        // Assumimos que ocorre durante a noite, então a noite continua normalmente
    }
}

/**
 * Mostra status da partida atual
 */
async function showStatus(sock, groupId) {
    const match = findMatchByGroup(groupId);
    if (!match) return sock.sendMessage(groupId, { text: 'Nenhuma partida ativa.' });
    const playersList = match.players.map(p => `${p.alive ? '✅' : '☠️'} ${p.name}`).join('\n');
    await sock.sendMessage(groupId, { 
        text: `📊 *Status da Partida*\n\n${playersList}\n\nFase: ${match.phase}\nDia: ${match.dayCount}` 
    });
}

module.exports = {
    createMatch,
    joinMatch,
    leaveMatch,
    startMatch,
    handleVote,
    findActiveMatchByPlayer,
    processNightAction,
    zombieAttackVote,
    requestSpecialExecution,
    confirmSpecialExecution,
    showStatus
};
