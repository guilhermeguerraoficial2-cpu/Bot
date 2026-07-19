// roles.js - Definição dos personagens e suas habilidades noturnas
// Estrutura expansível: para adicionar um novo personagem, basta incluir neste objeto.
const rolesConfig = {
    zombie: {
        name: 'Zumbi',
        emoji: '🧟',
        team: 'zombies',
        hasNightAction: true,
        description: 'Infecta um jogador por noite (decisão em grupo)'
    },
    doctor: {
        name: 'Médico',
        emoji: '💉',
        team: 'humans',
        hasNightAction: true,
        description: 'Cura um jogador. Cura bem-sucedida gera nova cura; erro faz perder o poder.'
    },
    shooter: {
        name: 'Atirador',
        emoji: '🔫',
        team: 'humans',
        hasNightAction: true,
        description: 'Possui 1 bala para eliminar qualquer jogador. Após uso, vira Sobrevivente.'
    },
    guard: {
        name: 'Guarda',
        emoji: '🛡',
        team: 'humans',
        hasNightAction: true,
        description: 'Protege um jogador (não pode repetir alvo). Se atacado, descobre um zumbi.'
    },
    investigator: {
        name: 'Investigador',
        emoji: '🔎',
        team: 'humans',
        hasNightAction: true,
        description: 'Investiga um jogador: descobre se é Zumbi ou não.'
    },
    survivor: {
        name: 'Sobrevivente',
        emoji: '👤',
        team: 'humans',
        hasNightAction: false,
        description: 'Sem poderes especiais, ajuda na discussão e votação.'
    }
};

/**
 * Retorna as configurações de um papel
 */
function getRole(roleKey) {
    return rolesConfig[roleKey] || null;
}

/**
 * Lista todos os papéis disponíveis (chaves)
 */
function getRoleKeys() {
    return Object.keys(rolesConfig);
}

module.exports = {
    rolesConfig,
    getRole,
    getRoleKeys
};
