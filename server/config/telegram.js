'use strict';

module.exports = {
  TELEGRAM_API_BASE: () => {
    const raw = process.env.TELEGRAM_BOT_TOKEN;
    if (!raw) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    const token = String(raw).trim().replace(/^['"]|['"]$/g, '');
    return `https://api.telegram.org/bot${token}`;
  },
  TELEGRAM_FILE_BASE: () => {
    const raw = process.env.TELEGRAM_BOT_TOKEN;
    if (!raw) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    const token = String(raw).trim().replace(/^['"]|['"]$/g, '');
    return `https://api.telegram.org/file/bot${token}`;
  },
};
