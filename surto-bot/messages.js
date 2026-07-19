// messages.js - Modelos de mensagens enviadas pelo bot
const config = require('./config');

// Mensagens de boas-vindas / ajuda
function helpMessage() {
    return `🤖 *SURTO: A CIDADE INFECTADA*\n\n` +
           `Comandos disponíveis:\n` +
           `${config.prefix}criar - Criar nova partida\n` +
           `${config.prefix}entrar - Entrar na partida\n` +
           `${config.prefix}sair - Sair da partida\n` +
           `${config.prefix}iniciar - Iniciar o jogo\n` +
           `${config.prefix}status - Ver status da partida\n` +
           `${config.prefix}regras - Regras completas\n` +
           `${config.prefix}ranking - Ranking global\n` +
           `${config.prefix}perfil - Seu perfil\n`;
}

function rulesMessage() {
    return `📖 *REGRAS — SURTO: A CIDADE INFECTADA*\n\n` +
           `🧟 Bem-vindo ao Surto.\n` +
           `Existe uma cidade infectada por zumbis.\n` +
           `Alguns jogadores são humanos tentando sobreviver. Outros são zumbis tentando dominar a cidade.\n\n` +
           `1. Não revele sua carta\n` +
           `Cada jogador possui uma função secreta. Nunca diga sua função para outros jogadores.\n\n` +
           `2. Respeite as fases\n` +
           `☀️ Dia: Todos conversam.\n` +
           `🌙 Noite: As habilidades são usadas no privado.\n\n` +
           `3. Votação\n` +
           `Durante o dia os jogadores escolhem quem deve ser eliminado.\n` +
           `O mais votado sai. Em empate: nova votação; se persistir, ninguém sai.\n\n` +
           `4. Mensagens privadas\n` +
           `Todas as habilidades no privado: ataque, cura, proteção, investigação.\n` +
           `Nunca faça ações pelo grupo.\n\n` +
           `5. Vitória dos Humanos: eliminar todos os zumbis.\n` +
           `6. Vitória dos Zumbis: número de zumbis ≥ número de humanos vivos.\n\n` +
           `7. Não trapaceie.\n` +
           `Boa sorte. A cidade depende de você.`;
}

function gameStartMessage(players, roles) {
    // Não revela papéis, apenas contagem
    const humanCount = players.filter(p => p.role !== 'zombie').length;
    const zombieCount = players.length - humanCount;
    return `🎮 *O JOGO COMEÇOU!*\n\n` +
           `👥 Jogadores: ${players.length}\n` +
           `🧟 Zumbis: ${zombieCount}\n` +
           `👤 Humanos: ${humanCount}\n\n` +
           `Verifiquem suas mensagens privadas. Bom jogo!`;
}

function nightPrompt(role, targetOptions) {
    return `🌙 *Fase Noturna - ${role.name}*\n` +
           `Escolha um jogador para usar sua habilidade.\n` +
           `Digite: /acao @jogador\n` +
           (targetOptions ? `Opções: ${targetOptions.join(', ')}` : '');
}

function votePrompt(players) {
    let list = players.map(p => `- @${p.id.split('@')[0]}`).join('\n');
    return `🗳 *VOTAÇÃO*\n` +
           `Escolha quem eliminar:\n${list}\n\n` +
           `Digite: /votar @jogador`;
}

function phaseAnnouncement(phase, timeLeft) {
    const icons = {
        day: '☀️',
        night: '🌙',
        voting: '🗳'
    };
    return `${icons[phase] || '⏳'} *${phase.toUpperCase()}*\n` +
           `Tempo restante: ${timeLeft}`;
}

module.exports = {
    helpMessage,
    rulesMessage,
    gameStartMessage,
    nightPrompt,
    votePrompt,
    phaseAnnouncement
};
