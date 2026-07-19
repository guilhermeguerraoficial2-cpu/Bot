module.exports = {
  // Conexão
  botNumber: '955923567',
  prefix: '/',

  // Jogo
  minPlayers: 8,
  maxPlayers: 50,
  maxZumbisPercent: 0.2,

  // Tempos em milissegundos
  tempos: {
    dia: 120000,       // 2 minutos
    votacao: 60000,    // 1 minuto
    noite: 90000,      // 1.5 minutos
    cooldown: 1000,    // anti-spam
  },

  // Emojis dos personagens
  emojis: {
    zumbi: '🧟',
    medico: '💉',
    atirador: '🔫',
    guarda: '🛡',
    investigador: '🔎',
    sobrevivente: '👤',
  },

  // Administrador do bot (número completo com @s.whatsapp.net)
  adminId: '5511999999999@s.whatsapp.net',

  // Banco de dados atual
  db: 'json', // futuramente 'supabase'
};
