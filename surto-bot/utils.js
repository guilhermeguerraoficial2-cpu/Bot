const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Gera ID único
function generateId() {
  return uuidv4();
}

// Embaralha array (Fisher-Yates) usando crypto para segurança
function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Escolhe item aleatório de um array
function randomPick(arr) {
  return arr[crypto.randomInt(0, arr.length)];
}

// Filtra objetos por propriedade
function findByProp(arr, prop, value) {
  return arr.find(item => item[prop] === value);
}

// Formata tempo (ms) para string legível
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Verifica se é número de WhatsApp no formato JID
function isJid(str) {
  return str?.includes('@s.whatsapp.net') || str?.includes('@g.us');
}

module.exports = {
  generateId,
  shuffleArray,
  randomPick,
  findByProp,
  formatTime,
  isJid,
};
