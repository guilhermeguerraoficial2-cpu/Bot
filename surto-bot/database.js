const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Garante que o diretório data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Arquivos JSON
const FILES = {
  players: path.join(DATA_DIR, 'players.json'),
  matches: path.join(DATA_DIR, 'matches.json'),
  ranking: path.join(DATA_DIR, 'ranking.json'),
  statistics: path.join(DATA_DIR, 'statistics.json'),
};

// Carrega dados de um arquivo JSON (retorna array/objeto vazio se não existir)
function load(fileKey) {
  try {
    if (fs.existsSync(FILES[fileKey])) {
      const raw = fs.readFileSync(FILES[fileKey], 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Erro ao carregar ${fileKey}:`, err);
  }
  // Retorna array vazio para listas, objeto vazio para estatísticas
  return fileKey === 'statistics' ? {} : [];
}

// Salva dados em um arquivo JSON de forma síncrona (seguro para pequenas cargas)
function save(fileKey, data) {
  try {
    fs.writeFileSync(FILES[fileKey], JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Erro ao salvar ${fileKey}:`, err);
  }
}

// Abstração para migração futura
const database = {
  getPlayers: () => load('players'),
  savePlayers: (data) => save('players', data),
  getMatches: () => load('matches'),
  saveMatches: (data) => save('matches', data),
  getRanking: () => load('ranking'),
  saveRanking: (data) => save('ranking', data),
  getStatistics: () => load('statistics'),
  saveStatistics: (data) => save('statistics', data),
};

module.exports = database;
