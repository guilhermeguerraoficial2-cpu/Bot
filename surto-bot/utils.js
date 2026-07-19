// utils.js - Funções utilitárias reutilizáveis
const fs = require('fs');
const path = require('path');

/**
 * Embaralha um array (Fisher-Yates)
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Retorna um número inteiro aleatório entre min e max (inclusivo)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Aguarda X milissegundos (Promise)
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formata segundos para mm:ss
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Garante que um diretório exista
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Lê um arquivo JSON, retorna objeto ou array vazio se não existir
 */
function readJSON(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error(`Erro ao ler ${filePath}:`, err.message);
    }
    return null;
}

/**
 * Escreve um objeto em arquivo JSON (cria diretórios se necessário)
 */
function writeJSON(filePath, data) {
    try {
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Erro ao salvar ${filePath}:`, err.message);
        return false;
    }
}

module.exports = {
    shuffle,
    randomInt,
    sleep,
    formatTime,
    ensureDir,
    readJSON,
    writeJSON
};
