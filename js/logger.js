// Minimal logger - writes to Firestore 'logs' collection (best-effort)
const Logger = {
  async log(level, message, meta = {}) {
    try {
      const entry = {
        level, message: String(message), meta,
        ts: new Date().toISOString(),
        uid: auth.currentUser ? auth.currentUser.uid : null
      };
      console[level === 'error' ? 'error' : 'log']('[LOG]', level, message, meta);
      if (db) await db.collection('logs').add(entry);
    } catch (e) {
      console.error('Logger error', e);
    }
  },
  info(m, meta) { return this.log('info', m, meta); },
  warn(m, meta) { return this.log('warn', m, meta); },
  error(m, meta) { return this.log('error', m, meta); }
};
window.Logger = Logger;
