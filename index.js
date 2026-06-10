require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { initDB } = require('./db/database');
const { registerCommands } = require('./handlers/commands');
const { startCronJobs } = require('./cron/scheduler');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.YOUR_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN or YOUR_CHAT_ID in .env file');
  process.exit(1);
}

async function main() {
  // Init database
  await initDB();
  console.log('✅ Database initialised');

  // Init bot
  const bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Bot polling started');

  // Register all commands
  registerCommands(bot, CHAT_ID);
  console.log('✅ Commands registered');

  // Start scheduled jobs
  startCronJobs(bot, CHAT_ID);

  // Boot message
  bot.sendMessage(CHAT_ID, `Systems online, sir. JARVIS is active and ready.\n\nType /start for a full command list or /help at any time.`)
    .then(() => console.log('✅ Boot message sent'))
    .catch(err => console.error('Boot message error:', err.message));

  bot.on('polling_error', (err) => {
    console.error('Polling error:', err.message);
  });

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err.message);
  });

  console.log('🤖 JARVIS is running');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
