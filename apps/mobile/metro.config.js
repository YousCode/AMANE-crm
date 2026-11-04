// Metro : monorepo (racine du dépôt surveillée, node_modules de la racine et du paquet). @amane/shared est un workspace (packages/shared).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules'), path.join(repoRoot, 'node_modules')];

module.exports = config;
