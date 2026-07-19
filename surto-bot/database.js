// database.js - Gerenciamento dos arquivos JSON (pode ser migrado para Supabase)
const path = require('path');
const { readJSON, writeJSON, ensureDir } = require('./utils');
const config = require('./config');

// Caminhos base
const DATA_DIR = config.dataPath;
ensureDir(DATA_DIR);

const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const RANKING_FILE = path.join(DATA_DIR, 'ranking.json');
const STATISTICS_FILE = path.join(DATA_DIR, 'statistics.json');

// Estrutura padrão dos dados
const defaultData = {
    players: {},   // { phoneNumber: { name, wins, losses, gamesPlayed, ... } }
    matches: [],   // lista de partidas ativas/finalizadas
    ranking: [],   // array ordenado por vitórias
    statistics: {
        totalGames: 0,
        zombieWins: 0,
        humanWins: 0,
        totalShots: 0,
        accurateShots: 0
    }
};

/**
 * Carrega todos os dados do disco
 */
function loadAll() {
    return {
        players: readJSON(PLAYERS_FILE) || defaultData.players,
        matches: readJSON(MATCHES_FILE) || defaultData.matches,
        ranking: readJSON(RANKING_FILE) || defaultData.ranking,
        statistics: readJSON(STATISTICS_FILE) || defaultData.statistics
    };
}

/**
 * Salva jogadores
 */
function savePlayers(players) {
    return writeJSON(PLAYERS_FILE, players);
}

/**
 * Salva partidas
 */
function saveMatches(matches) {
    return writeJSON(MATCHES_FILE, matches);
}

/**
 * Salva ranking
 */
function saveRanking(ranking) {
    return writeJSON(RANKING_FILE, ranking);
}

/**
 * Salva estatísticas
 */
function saveStatistics(stats) {
    return writeJSON(STATISTICS_FILE, stats);
}

/**
 * Atualiza ranking com base nos jogadores
 */
function updateRanking(players) {
    const ranking = Object.values(players)
        .filter(p => p.gamesPlayed > 0)
        .sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed)
        .slice(0, 100); // top 100
    saveRanking(ranking);
    return ranking;
}

module.exports = {
    loadAll,
    savePlayers,
    saveMatches,
    saveRanking,
    saveStatistics,
    updateRanking
};
