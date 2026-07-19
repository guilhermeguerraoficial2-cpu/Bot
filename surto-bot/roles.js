const config = require('./config');
const { randomPick } = require('./utils');

// Definição de papéis e suas habilidades noturnas
const roles = {
  zumbi: {
    name: 'Zumbi',
    team: 'zumbis',
    emoji: config.emojis.zumbi,
    canAct: true,
    actionRequired: true,
    actionType: 'selectPlayer', // seleciona um jogador para infectar
    executeAction(match, actorId, targetId, gameState) {
      // Zumbi infecta um jogador (será processado na resolução noturna)
      if (!gameState.nightActions) gameState.nightActions = {};
      gameState.nightActions.infectTarget = targetId; // apenas um zumbi ataca por noite
      return true;
    }
  },
  medico: {
    name: 'Médico',
    team: 'humanos',
    emoji: config.emojis.medico,
    canAct: true,
    actionRequired: true,
    actionType: 'selectPlayer',
    executeAction(match, actorId, targetId, gameState) {
      gameState.nightActions.cureTarget = targetId;
      return true;
    }
  },
  guarda: {
    name: 'Guarda',
    team: 'humanos',
    emoji: config.emojis.guarda,
    canAct: true,
    actionRequired: true,
    actionType: 'selectPlayer',
    executeAction(match, actorId, targetId, gameState) {
      gameState.nightActions.protectTarget = targetId;
      return true;
    }
  },
  investigador: {
    name: 'Investigador',
    team: 'humanos',
    emoji: config.emojis.investigador,
    canAct: true,
    actionRequired: true,
    actionType: 'selectPlayer',
    executeAction(match, actorId, targetId, gameState) {
      gameState.nightActions.investigateTarget = targetId;
      return true;
    }
  },
  atirador: {
    name: 'Atirador',
    team: 'humanos',
    emoji: config.emojis.atirador,
    canAct: true,
    actionRequired: false, // pode optar por não atirar
    actionType: 'selectPlayer',
    executeAction(match, actorId, targetId, gameState) {
      if (!gameState.nightActions) gameState.nightActions = {};
      gameState.nightActions.shootTarget = targetId;
      return true;
    }
  },
  sobrevivente: {
    name: 'Sobrevivente',
    team: 'humanos',
    emoji: config.emojis.sobrevivente,
    canAct: false // sem ação noturna
  }
};

// Retorna as descrições para enviar ao jogador
function getRoleDescription(roleKey) {
  const desc = {
    zumbi: 'Você é um Zumbi. Toda noite escolha alguém para infectar. Converse com outros zumbis pelo chat secreto.',
    medico: 'Você é o Médico. Toda noite escolha alguém para curar. Se curar um ataque real, ganha uma nova cura. Se errar, perde a função.',
    guarda: 'Você é o Guarda. Proteja um jogador por noite (não pode repetir o mesmo alvo duas vezes seguidas). Se for atacado, descobre o zumbi.',
    investigador: 'Você é o Investigador. Toda noite investigue um jogador para saber se é zumbi ou não. Uma única execução especial por partida em cooperação com o Guarda.',
    atirador: 'Você é o Atirador. Possui 1 bala para eliminar qualquer jogador. Após usar, perde a função.',
    sobrevivente: 'Você é um Sobrevivente. Ajude os humanos com discussões e votos. Pode receber cartas transferidas.',
  };
  return desc[roleKey] || '';
}

module.exports = {
  roles,
  getRoleDescription,
};
