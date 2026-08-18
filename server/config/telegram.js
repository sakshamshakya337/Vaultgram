'use strict';

module.exports = {
  TELEGRAM_API_BASE: () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    return `https://api.telegram.org/bot${token}`;
  },
  TELEGRAM_FILE_BASE: () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    return `https://api.telegram.org/file/bot${token}`;
  },
};
