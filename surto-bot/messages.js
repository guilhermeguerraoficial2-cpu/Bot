// Todas as strings do bot centralizadas para fácil tradução

module.exports = {
  regras: `📖 REGRAS — SURTO: A CIDADE INFECTADA
🧟 Bem-vindo ao Surto.
Existe uma cidade infectada por zumbis.
Alguns jogadores são humanos tentando sobreviver. Outros são zumbis tentando dominar a cidade.

1. Não revele sua carta
Cada jogador possui uma função secreta.
Nunca diga sua função para outros jogadores.

2. Respeite as fases
☀️ Dia: Todos conversam.
🌙 Noite: As habilidades são usadas no privado.

3. Votação
Durante o dia os jogadores escolhem quem deve ser eliminado.
O jogador mais votado sai da partida.
Em caso de empate: nova votação. Se continuar, ninguém é eliminado.

4. Mensagens privadas
Todas as habilidades acontecem no privado: ataque, cura, proteção, investigação.
Nunca faça ações pelo grupo.

5. Vitória dos Humanos
Os humanos vencem quando todos os zumbis forem eliminados.

6. Vitória dos Zumbis
Os zumbis vencem quando: Número de zumbis vivos >= número de humanos vivos.

7. Não trapaceie
É proibido: mostrar sua carta, usar informações externas, jogar após morrer.
Boa sorte. A cidade depende de você.`,

  // Mensagens de sistema
  partidaCriada: (id) => `🏙️ Partida criada! Use */entrar* para participar. (ID: ${id})`,
  partidaCheia: '❌ A partida já está cheia.',
  jaEstaNaPartida: '❌ Você já está na partida.',
  entrouNaPartida: (nome, atual, min) => `✅ @${nome} entrou na partida. (${atual}/${min} mínimo)`,
  saiuDaPartida: (nome, atual) => `👋 @${nome} saiu da partida. (${atual} jogadores)`,
  partidaIniciada: '🚨 A partida começou! Verifiquem suas mensagens privadas.',
  minimoNaoAtingido: (min) => `❌ Mínimo de ${min} jogadores não atingido.`,
  partidaJaEmAndamento: '❌ Já existe uma partida em andamento neste grupo.',
  comandoInvalido: '❌ Comando inválido. Use /ajuda.',
  ajuda: `📋 Comandos disponíveis:
/criar - Criar uma nova partida
/entrar - Entrar na partida
/sair - Sair da partida
/iniciar - Iniciar a partida (mínimo ${require('./config').minPlayers} jogadores)
/status - Ver situação atual
/regras - Ver as regras oficiais
/ranking - Ranking geral
/perfil - Suas estatísticas`,

  // Fases
  diaIniciado: '☀️ *DIA* — Discutam entre si. Duração: {tempo}',
  votacaoIniciada: '🗳️ *VOTAÇÃO* — Enviem /votar @jogador no privado. Duração: {tempo}',
  noiteIniciada: '🌙 *NOITE* — Personagens, realizem suas ações no privado. Duração: {tempo}',
  contagemRegressiva: (fase, tempo) => `⏳ ${fase} — ${tempo} restantes.`,

  // Votação
  votoPrivado: 'Use /votar @jogador para votar em alguém.',
  votoRegistrado: '✅ Seu voto foi registrado.',
  empateVotacao: '⚖️ Empate! Nova votação (30s).',
  eliminadoPorVotacao: (nome) => `☠️ @${nome} foi eliminado pela cidade.`,

  // Mortes e resultados noturnos
  morteNoturna: '☠️ Um membro da cidade foi eliminado durante a noite.',
  nenhumaMorte: '🌅 Ninguém morreu durante a noite.',

  // Cartas e habilidades
  suaCarta: (role, descricao) => `🃏 Sua carta: *${role}*\n${descricao}`,
  infectado: '🧟 Você foi infectado e agora é um ZUMBI! Veja as instruções no chat secreto.',
  zumbiChatInstrucao: '🧟 Chat dos Zumbis: envie qualquer mensagem aqui que será retransmitida. Lista de zumbis: {lista}',
  curaPerdida: '❌ Você usou a cura em alguém que não foi atacado. Você perdeu a função de Médico.',
  novaCura: '💊 Sua cura foi bem-sucedida! Você ganhou uma nova cura.',
  atiradorUsouTiro: '🔫 Você usou seu tiro. Agora é um Sobrevivente.',
  guardaDescobriuZumbi: (nome) => `🛡 Você foi atacado e descobriu que *${nome}* é um zumbi!`,
  investigacaoResultado: (nome, isZumbi) => `🔎 Resultado da investigação de @${nome}: *${isZumbi ? 'É Zumbi' : 'Não é Zumbi'}*`,
  execucaoEspecialSolicitada: '⚡ Você solicitou a execução especial.',
  cartaTransferida: (novoCargo) => `🔄 Você recebeu a carta de *${novoCargo}*!`,

  // Eliminado
  eliminado: '☠️ Você foi eliminado desta partida e só poderá jogar novamente quando uma nova partida começar.',
  interferenciaEliminado: '⚠️ Você foi eliminado e não pode interferir na partida.',
  privadoNecessario: (nome) => `⚠️ @${nome}, preciso que você envie qualquer mensagem no privado para receber suas instruções.`,

  // Vitória
  humanosVencem: '🏆 *HUMANOS VENCERAM!* Todos os zumbis foram eliminados.',
  zumbisVencem: '🧟 *ZUMBIS VENCERAM!* Eles dominaram a cidade.',
  partidaEncerrada: '🏁 Partida encerrada. Estatísticas atualizadas.',

  // Erros e permissões
  semPartidaAtiva: '❌ Não há partida ativa neste grupo.',
  naoParticipa: '❌ Você não está participando da partida.',
  acaoNoturnaJaRealizada: '❌ Você já realizou sua ação esta noite.',
  acaoNoturnaInvalida: '❌ Ação inválida.',
  cooldown: '⏳ Aguarde um pouco antes de usar comandos novamente.',
};
