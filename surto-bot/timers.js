// timers.js - Gerenciamento de temporizadores das fases do jogo
const config = require('./config');
const { formatTime } = require('./utils');
const { phaseAnnouncement } = require('./messages');

// Armazena temporizadores ativos por partida (matchId -> { phase, timer, interval })
const activeTimers = {};

/**
 * Inicia a contagem regressiva de uma fase
 * @param {string} matchId - ID da partida
 * @param {string} phase - 'discussion', 'voting', 'night' ou 'reVoting'
 * @param {function} onTick - callback a cada segundo (timeLeft, formatted)
 * @param {function} onEnd - callback quando o tempo acabar
 */
function startPhaseTimer(matchId, phase, groupId, sock, onEnd) {
    // Cancela timer anterior se existir
    clearPhaseTimer(matchId);

    const duration = config.timers[phase] || 60;
    let timeLeft = duration;

    // Envia anúncio inicial
    sock.sendMessage(groupId, { text: phaseAnnouncement(phase, formatTime(timeLeft)) });

    const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(interval);
            delete activeTimers[matchId];
            sock.sendMessage(groupId, { text: `⏰ Tempo esgotado!` });
            if (onEnd) onEnd();
        } else {
            // Atualiza a cada 10 segundos para evitar spam
            if (timeLeft % 10 === 0 || timeLeft <= 5) {
                sock.sendMessage(groupId, { text: phaseAnnouncement(phase, formatTime(timeLeft)) });
            }
        }
    }, 1000);

    activeTimers[matchId] = { phase, timer: interval };
}

/**
 * Cancela o temporizador de uma partida
 */
function clearPhaseTimer(matchId) {
    if (activeTimers[matchId]) {
        clearInterval(activeTimers[matchId].timer);
        delete activeTimers[matchId];
    }
}

/**
 * Verifica se existe temporizador ativo para a partida
 */
function hasActiveTimer(matchId) {
    return !!activeTimers[matchId];
}

module.exports = {
    startPhaseTimer,
    clearPhaseTimer,
    hasActiveTimer
};
