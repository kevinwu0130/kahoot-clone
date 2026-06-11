// In-memory per-game runtime config (chosen question subset + advance mode).
// Kept in the same process as the socket server and the games HTTP route.
// Intentionally NOT persisted: a server restart mid-game simply falls back to
// "all questions, manual advance", which is a safe degradation for a short
// live quiz. This avoids a Prisma schema migration on the Render deploy.
const configs = new Map();

module.exports = {
  set(gameId, cfg) {
    configs.set(Number(gameId), cfg);
  },
  get(gameId) {
    return configs.get(Number(gameId));
  },
  delete(gameId) {
    configs.delete(Number(gameId));
  },
};
