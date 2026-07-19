# Surto: A Cidade Infectada - Bot de WhatsApp

Bot multiplayer de dedução social para grupos do WhatsApp. Um jogo de zumbis vs humanos com papéis secretos e habilidades noturnas.

## Instalação

1. Clone o repositório e instale as dependências:
```bash
git clone https://github.com/seuusuario/surto-bot.git
cd surto-bot
npm install
```

2. Configure o arquivo `config.js` com seu número e preferências.

3. Execute o bot:
```bash
npm start
```

4. Escaneie o QR code com o WhatsApp (dispositivo multi-device).

## Comandos do Jogo

- `/criar` - Criar sala de espera
- `/entrar` - Entrar na partida
- `/sair` - Sair da sala
- `/iniciar` - Iniciar partida (mínimo 8 jogadores)
- `/status` - Ver situação atual
- `/ajuda` - Lista de comandos
- `/regras` - Exibir regras oficiais
- `/ranking` - Ranking geral
- `/perfil` - Suas estatísticas

**Durante o jogo (privado):**
- `/votar @jogador` - Votar para eliminar
- `/acao @jogador` - Usar habilidade noturna
- `/executar @zumbi` - (Investigador) Execução especial

## Personagens

- 🧟 Zumbi - Infecta um jogador por noite, chat secreto
- 💉 Médico - Cura, mas perde poder se errar
- 🔫 Atirador - Um tiro, depois vira Sobrevivente
- 🛡 Guarda - Protege e descobre zumbi se atacado
- 🔎 Investigador - Investiga e pode executar uma vez
- 👤 Sobrevivente - Sem poderes, pode receber cartas

## Arquitetura

- `index.js` - Conexão WhatsApp e loop principal
- `config.js` - Configurações centralizadas
- `database.js` - Abstração JSON (pronto para Supabase)
- `game.js` - Motor do jogo (estados, turnos, regras)
- `roles.js` - Definição e ações dos papéis
- `commands.js` - Processamento de comandos
- `messages.js` - Strings do bot (internacionalizável)
- `events.js` - Eventos para extensibilidade
- `timers.js` - Gerenciamento de contagens regressivas
- `admin.js` - Comandos administrativos

## Adicionar Novos Personagens

1. Em `roles.js`, adicione o novo papel seguindo o padrão.
2. Registre ações noturnas em `game.js` na função `resolveNight`.
3. Utilize os eventos em `events.js` para comportamento extra.

## Migração para Supabase

Substitua as funções de `database.js` por chamadas ao cliente Supabase, mantendo a mesma interface.

## Licença

MIT
