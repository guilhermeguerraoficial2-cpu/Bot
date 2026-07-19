const EventEmitter = require('events');

// EventEmitter global para comunicação desacoplada entre módulos
const gameEvents = new EventEmitter();
gameEvents.setMaxListeners(100); // evita warnings

module.exports = gameEvents;
