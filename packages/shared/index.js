// @amane/shared — point d'entrée. Exports nommés uniquement, ES modules sans étape de build.
export * from './constants.js';
export * from './rules.js';
export * from './i18n.js';
export * from './tokens.js';
export { validate, client as validateClient, mission as validateMission, devis as validateDevis, vehicule as validateVehicule, partenaire as validatePartenaire, service as validateService } from './validate.js';
