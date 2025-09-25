// metro.config.js（專案根目錄）
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 讓 Metro 把 .sql / .yaml / .yml / .md 視為資產檔
config.resolver.assetExts.push('sql', 'yaml', 'yml', 'md');

module.exports = config;
