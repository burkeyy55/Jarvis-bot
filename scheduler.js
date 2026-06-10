const cron = require('node-cron');
const db = require('./database');
const { buildMorningMessage, buildEveningDebrief, buildTaskNudge, buildWeeklyStrengthReport, buildWeeklyGoalCheckin } = require('./messages');
const { getSolPrice } = require('./api');

function isOverrideActive() { return db.getState('override_date') === db.getToday(); }

function startCronJobs(bot, CHAT_ID) {
  cron.schedule('0 8 * * *', async () => {
    try {
      const message = await buildMorningMessage();
      await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
      setTimeout(() => { bot.sendMessage(CHAT_ID, `Use /settasks to lock in your top 3 priorities for today, sir.\n\nFormat: /settasks Task one | Task two | Task three`); }, 3000);
    } catch (err) { console.error('Morning briefing error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  cron.schedule('0 18 * * *', async () => {
    if (isOverrideActive()) return;
    try {
      const tasks = db.getTodayTasks();
      if (!tasks) return;
      const nudge = buildTaskNudge(tasks);
      if (nudge) await bot.sendMessage(CHAT_ID, nudge);
    } catch (err) { console.error('Task nudge error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  cron.schedule('0 20 * * 0-5', async () => {
    if (isOverrideActive()) return;
    try {
      const message = await buildEveningDebrief();
      await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (err) { console.error('Evening debrief error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  cron.schedule('0 20 * * 5', async () => {
    if (isOverrideActive()) return;
    try { await bot.sendMessage(CHAT_ID, buildWeeklyGoalCheckin(), { parse_mode: 'Markdown' }); }
    catch (err) { console.error('Weekly goal check-in error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  cron.schedule('0 20 * * 0', async () => {
    if (isOverrideActive()) return;
    try {
      await bot.sendMessage(CHAT_ID, buildWeeklyStrengthReport(), { parse_mode: 'Markdown' });
      setTimeout(async () => { await bot.sendMessage(CHAT_ID, await buildEveningDebrief(), { parse_mode: 'Markdown' }); }, 3000);
    } catch (err) { console.error('Sunday report error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  cron.schedule('0 * * * *', async () => {
    try {
      const sol = await getSolPrice();
      if (!sol) return;
      const change = parseFloat(sol.change);
      const lastAlerted = db.getState('sol_last_alerted');
      const today = db.getToday();
      if (Math.abs(change) >= 5 && lastAlerted !== today) {
        db.setState('sol_last_alerted', today);
        const dir = change > 0 ? 'up' : 'down';
        const arrow = change > 0 ? '📈' : '📉';
        const sign = change > 0 ? '+' : '';
        await bot.sendMessage(CHAT_ID, `${arrow} *Solana Alert*\n\nSOL is ${dir} ${sign}${sol.change}% in the last 24 hours. Currently $${sol.price} USD.\n\nThought you would want to know, sir.`, { parse_mode: 'Markdown' });
      }
    } catch (err) { console.error('SOL alert error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  cron.schedule('0 14 * * 2,4', async () => {
    if (isOverrideActive()) return;
    try {
      const thoughts = [
        `Something worth noting, sir.\n\nMarcus Aurelius wrote: _"You have power over your mind, not outside events."_\n\nThe day will throw what it throws. How you respond is the only variable in your control.`,
        `A thought, sir.\n\nDostoevsky wrote that beauty will save the world. He was not talking about aesthetics. He was talking about the kind of person who chooses to be good when it is hard.\n\nBe that person today.`,
        `Sir, a brief observation.\n\nThe gap between your current self and your best self is not closed in dramatic moments. It is closed in the small decisions no one sees.\n\nWhat is one thing you can do in the next hour?`,
        `Worth considering, sir.\n\nMarcus Aurelius ruled an empire and still woke up every morning and wrote down what he needed to work on. Discipline requires daily renewal.\n\nCheck your tasks. Move forward.`,
        `Sir.\n\nDostoevsky spent four years in a Siberian prison camp. When he came out, he wrote some of the greatest literature in human history.\n\nWhatever you are facing today is manageable. Get to work.`
      ];
      await bot.sendMessage(CHAT_ID, thoughts[Math.floor(Math.random() * thoughts.length)], { parse_mode: 'Markdown' });
    } catch (err) { console.error('Random thought error:', err.message); }
  }, { timezone: 'Australia/Melbourne' });

  console.log('✅ All cron jobs started (timezone: Australia/Melbourne)');
}

module.exports = { startCronJobs };
