// apteczka-domowa/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 🔑 dodajemy obsługę plików .wasm
config.resolver.assetExts.push('wasm');

module.exports = config;
