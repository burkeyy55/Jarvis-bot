const db = require('./database');
const { getWeather, getSolPrice } = require('./api');
const { buildEveningDebrief, getRandomQuote, capitalize } = require('./messages');

function registerCommands(bot, CHAT_ID) {

  bot.onText(/\/start/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID,
      `Systems online, sir.\n\nI am JARVIS — your personal command centre.\n\n` +
      `/tasks — set or check today's tasks\n/settasks T1 | T2 | T3 — set tasks\n` +
      `/log — log a habit\n/stats — view streaks\n` +
      `/addexercise — add an exercise\n/lift — log a workout set\n` +
      `/pr — personal bests\n/progress — lift history\n` +
      `/sol — Solana price\n/stoic — Aurelius quote\n/dosto — Dostoevsky quote\n` +
      `/focus — start a focus timer\n/week — weekly goal\n` +
      `/briefing — full status report\n/debrief — evening summary\n` +
      `/override — silence reminders today\n/thoughts — my observations\n\nGood to have you back, sir.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/tasks/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const tasks = db.getTodayTasks();
    if (!tasks) {
      return bot.sendMessage(CHAT_ID, `No tasks set for today, sir.\n\nUse /settasks Task one | Task two | Task three`);
    }
    const taskList = [
      { text: tasks.task1, done: tasks.done1, num: 1 },
      { text: tasks.task2, done: tasks.done2, num: 2 },
      { text: tasks.task3, done: tasks.done3, num: 3 }
    ].filter(t => t.text);
    const keyboard = {
      inline_keyboard: taskList.filter(t => !t.done).map(t => [{ text: `✅ Done: ${t.text}`, callback_data: `complete_task_${t.num}` }])
    };
    let taskMsg = `📋 *Today's Tasks*\n\n`;
    taskList.forEach(t => { taskMsg += `${t.done ? '✅' : '⬜'} ${t.text}\n`; });
    bot.sendMessage(CHAT_ID, taskMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
  });

  bot.onText(/\/settasks (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const parts = match[1].split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 1) return bot.sendMessage(CHAT_ID, `Format: /settasks Task one | Task two | Task three`);
    db.setTodayTasks(parts[0] || null, parts[1] || null, parts[2] || null);
    bot.sendMessage(CHAT_ID, `Tasks locked in for today, sir.\n\n${parts.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nUse /tasks to check them off.`, { parse_mode: 'Markdown' });
  });

  bot.on('callback_query', (query) => {
    if (String(query.message.chat.id) !== String(CHAT_ID)) return;
    const data = query.data;
    if (data.startsWith('complete_task_')) {
      const num = data.replace('complete_task_', '');
      db.completeTask(num);
      bot.answerCallbackQuery(query.id, { text: 'Task marked complete, sir.' });
      bot.sendMessage(CHAT_ID, `Task ${num} complete. Well done, sir.`);
    }
    if (data.startsWith('log_habit_')) {
      const habit = data.replace('log_habit_', '');
      db.logHabit(habit);
      bot.answerCallbackQuery(query.id, { text: `${capitalize(habit)} logged.` });
      bot.sendMessage(CHAT_ID, `${capitalize(habit)} logged, sir.`);
    }
  });

  bot.onText(/\/log$/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const customHabits = db.getCustomHabits();
    const defaultHabits = ['workout', 'reading', 'meal - breakfast', 'meal - lunch', 'meal - dinner'];
    const allHabits = [...defaultHabits, ...customHabits.map(h => h.name)];
    const keyboard = { inline_keyboard: allHabits.map(h => [{ text: capitalize(h), callback_data: `log_habit_${h}` }]) };
    bot.sendMessage(CHAT_ID, `What would you like to log, sir?`, { reply_markup: keyboard });
  });

  bot.onText(/\/addhabit (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const name = match[1].trim().toLowerCase();
    const success = db.addCustomHabit(name);
    bot.sendMessage(CHAT_ID, success ? `Custom habit "${capitalize(name)}" added, sir.` : `That habit already exists, sir.`);
  });

  bot.onText(/\/stats/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const allHabits = ['workout', 'reading', ...db.getCustomHabits().map(h => h.name)];
    let statsMsg = `📊 *Habit Streaks*\n\n`;
    allHabits.forEach(h => {
      const streak = db.getHabitStreak(h);
      statsMsg += `${streak > 0 ? '🔥' : '💤'} *${capitalize(h)}* — ${streak} day streak\n`;
    });
    const tasks = db.getTodayTasks();
    if (tasks) {
      const taskList = [{ text: tasks.task1, done: tasks.done1 }, { text: tasks.task2, done: tasks.done2 }, { text: tasks.task3, done: tasks.done3 }].filter(t => t.text);
      statsMsg += `\n✅ *Today's tasks:* ${taskList.filter(t => t.done).length}/${taskList.length} complete`;
    }
    bot.sendMessage(CHAT_ID, statsMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/addexercise (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const name = match[1].trim();
    const success = db.addExercise(name);
    bot.sendMessage(CHAT_ID, success ? `"${capitalize(name)}" added to your programme, sir.` : `"${capitalize(name)}" already exists, sir.`);
  });

  bot.onText(/\/exercises/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const exercises = db.getExercises();
    if (exercises.length === 0) return bot.sendMessage(CHAT_ID, `No exercises added yet, sir. Use /addexercise [name].`);
    let exMsg = `🏋️ *Your Exercises*\n\n`;
    exercises.forEach(e => { exMsg += `• ${capitalize(e.name)}\n`; });
    bot.sendMessage(CHAT_ID, exMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/lift (.+) (\d+\.?\d*)kg (\d+)x(\d+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const exercise = match[1].trim().toLowerCase();
    const weight = parseFloat(match[2]);
    const sets = parseInt(match[3]);
    const reps = parseInt(match[4]);
    const previousPR = db.getPR(exercise);
    db.logLift(exercise, weight, sets, reps);
    if (previousPR && weight > previousPR.weight) {
      bot.sendMessage(CHAT_ID, `🏆 *New personal record on ${capitalize(exercise)}, sir.*\n\nUp from ${previousPR.weight}kg to ${weight}kg. I would say that is progress worth noting.`, { parse_mode: 'Markdown' });
    } else if (!previousPR) {
      bot.sendMessage(CHAT_ID, `${capitalize(exercise)} logged — ${weight}kg, ${sets}x${reps}. First entry on record, sir.`);
    } else {
      bot.sendMessage(CHAT_ID, `${capitalize(exercise)} logged — ${weight}kg, ${sets}x${reps}. Keep at it, sir.`);
    }
  });

  bot.onText(/\/pr$/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const prs = db.getAllPRs();
    if (prs.length === 0) return bot.sendMessage(CHAT_ID, `No lifts on record yet, sir. Use /lift to start logging.`);
    let prMsg = `🏆 *Personal Records*\n\n`;
    prs.forEach(p => { prMsg += `*${capitalize(p.exercise)}* — ${p.weight}kg (${p.sets}x${p.reps}) · ${p.date}\n`; });
    bot.sendMessage(CHAT_ID, prMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/progress (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const exercise = match[1].trim().toLowerCase();
    const history = db.getLiftHistory(exercise);
    if (history.length === 0) return bot.sendMessage(CHAT_ID, `No history found for "${capitalize(exercise)}", sir.`);
    let progMsg = `📈 *${capitalize(exercise)} — Last ${history.length} sessions*\n\n`;
    history.forEach(l => { progMsg += `${l.date} — ${l.weight}kg (${l.sets}x${l.reps})\n`; });
    bot.sendMessage(CHAT_ID, progMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/sol/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const sol = await getSolPrice();
    if (!sol) return bot.sendMessage(CHAT_ID, `Unable to retrieve Solana data at this time, sir. The markets may be having a moment.`);
    const changeNum = parseFloat(sol.change);
    const arrow = changeNum >= 0 ? '📈' : '📉';
    const sign = changeNum >= 0 ? '+' : '';
    bot.sendMessage(CHAT_ID, `${arrow} *Solana*\n$${sol.price} USD  ·  ${sign}${sol.change}% (24h)`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/stoic/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const list = require('./quotes').aurelius;
    const q = list[Math.floor(Math.random() * list.length)];
    bot.sendMessage(CHAT_ID, `📜 *Marcus Aurelius — ${q.source}*\n\n_"${q.text}"_`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/dosto/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const list = require('./quotes').dostoevsky;
    const q = list[Math.floor(Math.random() * list.length)];
    bot.sendMessage(CHAT_ID, `📜 *Fyodor Dostoevsky — ${q.source}*\n\n_"${q.text}"_`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/focus (\d+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const minutes = parseInt(match[1]);
    if (minutes < 1 || minutes > 120) return bot.sendMessage(CHAT_ID, `Please set a duration between 1 and 120 minutes, sir.`);
    bot.sendMessage(CHAT_ID, `Focus timer set for ${minutes} minutes, sir. Begin.`);
    setTimeout(() => { bot.sendMessage(CHAT_ID, `${minutes} minutes elapsed, sir. Your focus session is complete. Well done.`); }, minutes * 60 * 1000);
  });

  bot.onText(/\/week$/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const goal = db.getWeeklyGoal();
    if (!goal) return bot.sendMessage(CHAT_ID, `No weekly goal set, sir. Use /setweek [your goal] to set one.`);
    bot.sendMessage(CHAT_ID, `🎯 *This Week's Goal*\n\n_"${goal.goal}"_`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/setweek (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const goal = match[1].trim();
    db.setWeeklyGoal(goal);
    bot.sendMessage(CHAT_ID, `Weekly goal set, sir.\n\n_"${goal}"_\n\nI will check in on Friday.`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/gratitude (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID, `Noted, sir. Gratitude is a discipline. Good night.`);
  });

  bot.onText(/\/debrief/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const message = await buildEveningDebrief();
    bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/briefing/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const weather = await getWeather();
    const sol = await getSolPrice();
    const tasks = db.getTodayTasks();
    const habits = db.getTodayHabits();
    let briefMsg = `📡 *Situation Report*\n\n`;
    if (weather) { briefMsg += `${weather.icon} ${weather.condition}, ${weather.temp}°C`; if (weather.rainChance > 20) briefMsg += ` · ${weather.rainChance}% rain`; briefMsg += '\n'; }
    if (sol) { const sign = parseFloat(sol.change) >= 0 ? '+' : ''; briefMsg += `💰 SOL $${sol.price}  ${sign}${sol.change}%\n\n`; }
    if (tasks) { const tl = [{ text: tasks.task1, done: tasks.done1 }, { text: tasks.task2, done: tasks.done2 }, { text: tasks.task3, done: tasks.done3 }].filter(t => t.text); briefMsg += `✅ Tasks: ${tl.filter(t => t.done).length}/${tl.length} complete\n`; }
    else { briefMsg += `✅ No tasks set today\n`; }
    if (habits.length > 0) { briefMsg += `📲 Habits: ${[...new Set(habits.map(h => h.habit))].map(h => capitalize(h)).join(', ')}\n`; }
    const goal = db.getWeeklyGoal();
    if (goal) briefMsg += `\n🎯 Weekly goal: _"${goal.goal}"_`;
    bot.sendMessage(CHAT_ID, briefMsg, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/override/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    db.setState('override_date', db.getToday());
    bot.sendMessage(CHAT_ID, `Understood, sir. All automated reminders silenced for today. I will resume normal operations tomorrow.`);
  });

  bot.onText(/\/thoughts/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const thoughts = [
      `A few observations, sir.\n\nYour logs have been intermittent. Consistency does not require perfection — it requires showing up. Even a partial day is better than no day.`,
      `Something worth noting, sir.\n\nMarcus Aurelius wrote his Meditations as private notes — never intended for anyone else. He held himself accountable in the dark. That is where character is actually built.`,
      `I have been observing, sir.\n\nThe gap between who you are and who you want to be is closed one day at a time. Not in grand gestures. In the ordinary moments where no one is watching.`,
      `Sir, a thought.\n\nDostoevsky wrote that pain and suffering are inevitable for a deep heart. But suffering without direction is just noise. Channel it into something.`,
      `A brief observation, sir.\n\nThe weeks compound. What you do today will look like nothing in isolation, but in six months it will look like everything. The boring work is the work.`
    ];
    bot.sendMessage(CHAT_ID, thoughts[Math.floor(Math.random() * thoughts.length)], { parse_mode: 'Markdown' });
  });

  bot.onText(/\/analyse (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const situation = match[1].trim();
    bot.sendMessage(CHAT_ID,
      `Analysing, sir.\n\n_"${situation}"_\n\nA few things worth considering:\n\n1. What is the worst realistic outcome, and can you handle it?\n2. What is the cost of inaction versus action?\n3. What would you advise a close friend in this situation?\n\nThe answer is usually clearer than it seems, sir.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/help/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID,
      `*JARVIS Command Reference*\n\n*Daily*\n/tasks — view today's tasks\n/settasks T1 | T2 | T3 — set tasks\n/log — log a habit\n/addhabit [name] — add custom habit\n\n*Strength*\n/addexercise [name] — add exercise\n/exercises — list exercises\n/lift [ex] [w]kg [s]x[r] — log lift\n/pr — personal bests\n/progress [exercise] — lift history\n\n*Info*\n/sol — Solana price\n/stoic — Aurelius quote\n/dosto — Dostoevsky quote\n/stats — habit streaks\n/briefing — full status\n\n*Tools*\n/focus [mins] — focus timer\n/week — view weekly goal\n/setweek [goal] — set weekly goal\n/analyse [situation] — get perspective\n/thoughts — JARVIS observations\n/debrief — evening summary\n/override — silence reminders today`,
      { parse_mode: 'Markdown' }
    );
  });

  // Free text — JARVIS responds in character
  bot.on('message', (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    if (!msg.text || msg.text.startsWith('/')) return;

    const text = msg.text.toLowerCase();

    if (text.match(/^(hey|hi|hello|sup|yo|wassup)/)) {
      const r = [`Online and operational, sir. What do you need?`, `Good to hear from you, sir. How can I assist?`, `At your service, sir. What's on your mind?`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(how are you|how are u|you good|u good)/)) {
      const r = [`All systems nominal, sir. I don't experience fatigue, but I appreciate you asking.`, `Running at full capacity, sir. The more relevant question is how are you doing.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/^(thanks|thank you|cheers|ty|thx)/)) {
      const r = [`Of course, sir. That's what I'm here for.`, `Always, sir.`, `My pleasure, sir.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(motivat|inspire|hype me|pump me|encourage)/)) {
      const r = [`Sir, Marcus Aurelius wrote: "You have power over your mind, not outside events." The only thing between you and what you want is the decision to begin.`, `You don't need motivation, sir. You need discipline. Motivation is a feeling — discipline shows up regardless. Get to work.`, `Dostoevsky said pain and suffering are inevitable for a deep heart. That means feeling the resistance is proof you care. Use it.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(tired|exhausted|drained|no energy|cant be bothered|can't be bothered)/)) {
      const r = [`Even Marcus Aurelius wrote about not wanting to get out of bed. He got up anyway. So can you.`, `The body gets tired, sir. The question is whether the mind follows. Don't let it.`, `Rest is not weakness — it's maintenance. But know the difference between needing rest and avoiding discomfort.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(bored|nothing to do|so bored)/)) {
      const r = [`Boredom is a choice, sir. You have tasks to complete and habits to log. I'd suggest starting there.`, `A disciplined man is never bored, sir. He always has something to improve. Try /focus 25.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(stress|anxious|anxiety|overwhelm|worried)/)) {
      const r = [`Sir, what is actually within your control right now? Focus only on that. Everything else is noise.`, `Marcus Aurelius faced war, plague and betrayal and still wrote "confine yourself to the present." One thing at a time, sir.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(good|great|amazing|awesome|killing it|smashing it)/)) {
      const r = [`Good to hear, sir. Channel that energy into something productive.`, `Excellent, sir. Momentum is valuable — don't waste it.`, `That's what I like to hear, sir. Keep it going.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(bad|not good|terrible|awful|rough day|hard day)/)) {
      const r = [`Noted, sir. Bad days are data, not destiny.`, `Even the worst days end, sir. The question is what you do with what remains of today.`, `Dostoevsky said the darker the night, the brighter the stars. It won't always feel like this.`];
      return bot.sendMessage(CHAT_ID, r[Math.floor(Math.random() * r.length)]);
    }
    if (text.match(/(gym|workout|training|lift|bench|squat|deadlift)/)) {
      return bot.sendMessage(CHAT_ID, `Good to hear you're thinking about it, sir. Use /log to record your session and /lift to track your weights.`);
    }
    if (text.match(/(sol|solana|crypto|bitcoin|market)/)) {
      return bot.sendMessage(CHAT_ID, `Use /sol for live data, sir. I'll alert you automatically if it moves more than 5%.`);
    }

    const defaults = [`I'm not sure I follow, sir. Try /help to see what I can do.`, `Could you clarify, sir? I want to assist but I need more to work with.`, `Noted, sir. If you need something specific, /help has the full list.`];
    return bot.sendMessage(CHAT_ID, defaults[Math.floor(Math.random() * defaults.length)]);
  });

}

module.exports = { registerCommands };
