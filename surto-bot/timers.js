const config = require('./config');
const { formatTime } = require('./utils');
const messages = require('./messages');

// Armazena temporizadores ativos por grupo
const activeTimers = new Map();

// Função para exibir contagem regressiva e executar callback ao final
function startPhaseTimer(groupId, phase, durationMs, onTick, onEnd) {
  // Cancela timer anterior
  if (activeTimers.has(groupId)) {
    clearInterval(activeTimers.get(groupId).interval);
  }

  let remaining = durationMs;
  const interval = setInterval(() => {
    remaining -= 10000; // a cada 10 segundos
    if (remaining <= 0) {
      clearInterval(interval);
      activeTimers.delete(groupId);
      if (onEnd) onEnd();
    } else {
      const timeStr = formatTime(remaining);
      if (onTick) onTick(timeStr);
    }
  }, 10000);

  activeTimers.set(groupId, { interval, phase });
}

// Cancela temporizador de um grupo
function cancelTimer(groupId) {
  if (activeTimers.has(groupId)) {
    clearInterval(activeTimers.get(groupId).interval);
    activeTimers.delete(groupId);
  }
}

module.exports = {
  startPhaseTimer,
  cancelTimer,
};
