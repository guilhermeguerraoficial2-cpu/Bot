// config.js - Configurações globais do bot
module.exports = {
    // Número do bot (apenas referência, não afeta conexão)
    botNumber: '955923567',
    
    // Prefixo dos comandos (grupo)
    prefix: '/',
    
    // Tempos das fases (em segundos)
    timers: {
        discussion: 120,
        voting: 60,
        reVoting: 30,   // em caso de empate
        night: 90
    },
    
    // Mínimo de jogadores para iniciar
    minPlayers: 8,
    
    // Caminho para os arquivos de dados
    dataPath: './data',
    
    // Caminho para a sessão de autenticação
    sessionPath: './sessions',
    
    // Ativar logs de debug (desenvolvimento)
    debug: false
};
