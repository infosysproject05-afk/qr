const store = globalThis.__verifierCredentialStore || new Map();

globalThis.__verifierCredentialStore = store;

export default store;