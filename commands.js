const db = require('./database');
const { getWeather, getSolPrice } = require('./api');
const { buildEveningDebrief, getRandomQuote, capitalize } = require('./messages');

function registerCommands(bot, CHAT_ID) {

  // /start
  bot.onText(/\/start/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID,
      `Systems online, sir.\n\nI am JARVIS — your personal command centre.\n\nHere is what I can do:\n\n` +
      `/tasks — set or check today's tasks\n` +
      `/log — log a habit\n` +
      `/stats — view streaks and habits\n` +
      `/addexercise — add an exercise to track\n` +
      `/lift — log a workout set\n` +
      `/pr — view personal bests\n` +
      `/progress — view lift history\n` +
      `/sol — check Solana price\n` +
      `/stoic — Marcus Aurelius quote\n` +
      `/dosto — Dostoevsky quote\n` +
      `/focus — start a focus timer\n` +
      `/week — set or view weekly goal\n` +
      `/briefing — full status report\n` +
      `/debrief — trigger evening debrief\n` +
      `/override — silence all reminders today\n` +
      `/thoughts — what I have been observing\n\n` +
      `Good to have you back, sir.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /tasks
  bot.onText(/\/tasks/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const tasks = db.getTodayTasks();

    if (!tasks) {
      bot.sendMessage(CHAT_ID,
        `No tasks set for today, sir.\n\nSend me your top 3 priorities, one per line:\n\n/settasks Task one | Task two | Task three`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const taskList = [
      { text: tasks.task1, done: tasks.done1, num: 1 },
      { text: tasks.task2, done: tasks.done2, num: 2 },
      { text: tasks.task3, done: tasks.done3, num: 3 }
    ].filter(t => t.text);

    const keyboard = {
      inline_keyboard: taskList
        .filter(t => !t.done)
        .map(t => [{ text: `✅ Done: ${t.text}`, callback_data: `complete_task_${t.num}` }])
    };

    let msg = `📋 *Today's Tasks*\n\n`;
    taskList.forEach(t => {
      msg += `${t.done ? '✅' : '⬜'} ${t.text}\n`;
    });

    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown', reply_markup: keyboard });
  });

  // /settasks
  bot.onText(/\/settasks (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const parts = match[1].split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 1) {
      bot.sendMessage(CHAT_ID, `Please provide tasks separated by | — e.g. /settasks Task one | Task two | Task three`);
      return;
    }
    db.setTodayTasks(parts[0] || null, parts[1] || null, parts[2] || null);
    bot.sendMessage(CHAT_ID,
      `Tasks locked in for today, sir.\n\n${parts.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nUse /tasks to check them off.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Callback: complete task buttons
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

  // /log
  bot.onText(/\/log$/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const customHabits = db.getCustomHabits();

    const defaultHabits = ['workout', 'reading', 'meal - breakfast', 'meal - lunch', 'meal - dinner'];
    const allHabits = [...defaultHabits, ...customHabits.map(h => h.name)];

    const keyboard = {
      inline_keyboard: allHabits.map(h => [{ text: capitalize(h), callback_data: `log_habit_${h}` }])
    };

    bot.sendMessage(CHAT_ID, `What would you like to log, sir?`, { reply_markup: keyboard });
  });

  // /addhabit
  bot.onText(/\/addhabit (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const name = match[1].trim().toLowerCase();
    const success = db.addCustomHabit(name);
    if (success) {
      bot.sendMessage(CHAT_ID, `Custom habit "${capitalize(name)}" added, sir. It will now appear in your /log menu.`);
    } else {
      bot.sendMessage(CHAT_ID, `That habit already exists, sir.`);
    }
  });

  // /stats
  bot.onText(/\/stats/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const habits = ['workout', 'reading'];
    const customHabits = db.getCustomHabits();
    const allHabits = [...habits, ...customHabits.map(h => h.name)];

    let msg2 = `📊 *Habit Streaks*\n\n`;
    allHabits.forEach(h => {
      const streak = db.getHabitStreak(h);
      msg2 += `${streak > 0 ? '🔥' : '💤'} *${capitalize(h)}* — ${streak} day streak\n`;
    });

    const tasks = db.getTodayTasks();
    if (tasks) {
      const taskList = [
        { text: tasks.task1, done: tasks.done1 },
        { text: tasks.task2, done: tasks.done2 },
        { text: tasks.task3, done: tasks.done3 }
      ].filter(t => t.text);
      const done = taskList.filter(t => t.done).length;
      msg2 += `\n✅ *Today's tasks:* ${done}/${taskList.length} complete`;
    }

    bot.sendMessage(CHAT_ID, msg2, { parse_mode: 'Markdown' });
  });

  // /addexercise
  bot.onText(/\/addexercise (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const name = match[1].trim();
    const success = db.addExercise(name);
    if (success) {
      bot.sendMessage(CHAT_ID, `Exercise "${capitalize(name)}" added to your programme, sir. Use /lift ${name.toLowerCase()} [weight]kg [sets]x[reps] to log it.`);
    } else {
      bot.sendMessage(CHAT_ID, `"${capitalize(name)}" already exists in your exercise list, sir.`);
    }
  });

  // /exercises
  bot.onText(/\/exercises/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const exercises = db.getExercises();
    if (exercises.length === 0) {
      bot.sendMessage(CHAT_ID, `No exercises added yet, sir. Use /addexercise [name] to get started.`);
      return;
    }
    let text = `🏋️ *Your Exercises*\n\n`;
    exercises.forEach(e => { text += `• ${capitalize(e.name)}\n`; });
    text += `\nLog a lift: /lift [exercise] [weight]kg [sets]x[reps]`;
    bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
  });

  // /lift
  bot.onText(/\/lift (.+) (\d+\.?\d*)kg (\d+)x(\d+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const exercise = match[1].trim().toLowerCase();
    const weight = parseFloat(match[2]);
    const sets = parseInt(match[3]);
    const reps = parseInt(match[4]);

    // Check for PR
    const previousPR = db.getPR(exercise);
    db.logLift(exercise, weight, sets, reps);

    if (previousPR && weight > previousPR.weight) {
      bot.sendMessage(CHAT_ID,
        `🏆 *New personal record on ${capitalize(exercise)}, sir.*\n\nUp from ${previousPR.weight}kg to ${weight}kg. I would say that is progress worth noting.`,
        { parse_mode: 'Markdown' }
      );
    } else if (!previousPR) {
      bot.sendMessage(CHAT_ID, `${capitalize(exercise)} logged — ${weight}kg, ${sets}x${reps}. First entry on record, sir.`);
    } else {
      bot.sendMessage(CHAT_ID, `${capitalize(exercise)} logged — ${weight}kg, ${sets}x${reps}. Keep at it, sir.`);
    }
  });

  // /pr
  bot.onText(/\/pr$/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const prs = db.getAllPRs();
    if (prs.length === 0) {
      bot.sendMessage(CHAT_ID, `No lifts on record yet, sir. Use /lift to start logging.`);
      return;
    }
    let text = `🏆 *Personal Records*\n\n`;
    prs.forEach(p => {
      text += `*${capitalize(p.exercise)}* — ${p.weight}kg (${p.sets}x${p.reps}) · ${p.date}\n`;
    });
    bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
  });

  // /progress
  bot.onText(/\/progress (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const exercise = match[1].trim().toLowerCase();
    const history = db.getLiftHistory(exercise);
    if (history.length === 0) {
      bot.sendMessage(CHAT_ID, `No history found for "${capitalize(exercise)}", sir.`);
      return;
    }
    let text = `📈 *${capitalize(exercise)} — Last ${history.length} sessions*\n\n`;
    history.forEach(l => {
      text += `${l.date} — ${l.weight}kg (${l.sets}x${l.reps})\n`;
    });
    bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
  });

  // /sol
  bot.onText(/\/sol/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const sol = await getSolPrice();
    if (!sol) {
      bot.sendMessage(CHAT_ID, `Unable to retrieve Solana data at this time, sir. The markets may be having a moment.`);
      return;
    }
    const changeNum = parseFloat(sol.change);
    const arrow = changeNum >= 0 ? '📈' : '📉';
    const sign = changeNum >= 0 ? '+' : '';
    bot.sendMessage(CHAT_ID, `${arrow} *Solana*\n$${sol.price} USD  ·  ${sign}${sol.change}% (24h)`, { parse_mode: 'Markdown' });
  });

  // /stoic
  bot.onText(/\/stoic/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const list = require('./quotes').aurelius;
    const q = list[Math.floor(Math.random() * list.length)];
    bot.sendMessage(CHAT_ID, `📜 *Marcus Aurelius — ${q.source}*\n\n_"${q.text}"_`, { parse_mode: 'Markdown' });
  });

  // /dosto
  bot.onText(/\/dosto/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const list = require('./quotes').dostoevsky;
    const q = list[Math.floor(Math.random() * list.length)];
    bot.sendMessage(CHAT_ID, `📜 *Fyodor Dostoevsky — ${q.source}*\n\n_"${q.text}"_`, { parse_mode: 'Markdown' });
  });

  // /focus
  bot.onText(/\/focus (\d+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const minutes = parseInt(match[1]);
    if (minutes < 1 || minutes > 120) {
      bot.sendMessage(CHAT_ID, `Please set a focus duration between 1 and 120 minutes, sir.`);
      return;
    }
    bot.sendMessage(CHAT_ID, `Focus timer set for ${minutes} minutes, sir. I will notify you when time is up. Begin.`);
    setTimeout(() => {
      bot.sendMessage(CHAT_ID, `${minutes} minutes elapsed, sir. Your focus session is complete. Well done.`);
    }, minutes * 60 * 1000);
  });

  // /week
  bot.onText(/\/week$/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const goal = db.getWeeklyGoal();
    if (!goal) {
      bot.sendMessage(CHAT_ID, `No weekly goal set, sir.\n\nUse /setweek [your goal] to set one.`);
    } else {
      bot.sendMessage(CHAT_ID, `🎯 *This Week's Goal*\n\n_"${goal.goal}"_`, { parse_mode: 'Markdown' });
    }
  });

  // /setweek
  bot.onText(/\/setweek (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const goal = match[1].trim();
    db.setWeeklyGoal(goal);
    bot.sendMessage(CHAT_ID, `Weekly goal set, sir.\n\n_"${goal}"_\n\nI will check in on Friday.`, { parse_mode: 'Markdown' });
  });

  // /gratitude
  bot.onText(/\/gratitude (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID, `Noted, sir. Gratitude is a discipline. Good night.`);
  });

  // /debrief
  bot.onText(/\/debrief/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const message = await buildEveningDebrief(CHAT_ID);
    bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
  });

  // /briefing
  bot.onText(/\/briefing/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const weather = await getWeather();
    const sol = await getSolPrice();
    const tasks = db.getTodayTasks();
    const habits = db.getTodayHabits();

    let text = `📡 *Situation Report*\n\n`;

    if (weather) {
      text += `${weather.icon} ${weather.condition}, ${weather.temp}°C`;
      if (weather.rainChance > 20) text += ` · ${weather.rainChance}% rain`;
      text += '\n';
    }

    if (sol) {
      const changeNum = parseFloat(sol.change);
      const sign = changeNum >= 0 ? '+' : '';
      text += `💰 SOL $${sol.price}  ${sign}${sol.change}%\n\n`;
    }

    if (tasks) {
      const taskList = [
        { text: tasks.task1, done: tasks.done1 },
        { text: tasks.task2, done: tasks.done2 },
        { text: tasks.task3, done: tasks.done3 }
      ].filter(t => t.text);
      const done = taskList.filter(t => t.done).length;
      text += `✅ Tasks: ${done}/${taskList.length} complete\n`;
    } else {
      text += `✅ No tasks set today\n`;
    }

    if (habits.length > 0) {
      const logged = [...new Set(habits.map(h => h.habit))];
      text += `📲 Habits logged: ${logged.map(h => capitalize(h)).join(', ')}\n`;
    } else {
      text += `📲 No habits logged yet\n`;
    }

    const goal = db.getWeeklyGoal();
    if (goal) text += `\n🎯 Weekly goal: _"${goal.goal}"_`;

    bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
  });

  // /override
  bot.onText(/\/override/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const today = db.getToday();
    db.setState('override_date', today);
    bot.sendMessage(CHAT_ID, `Understood, sir. All automated reminders have been silenced for today. I will resume normal operations tomorrow.`);
  });

  // /thoughts
  bot.onText(/\/thoughts/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const thoughts = generateThoughts();
    bot.sendMessage(CHAT_ID, thoughts, { parse_mode: 'Markdown' });
  });

  // /analyse
  bot.onText(/\/analyse (.+)/, (msg, match) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const situation = match[1].trim();
    bot.sendMessage(CHAT_ID,
      `Analysing the situation, sir.\n\n_"${situation}"_\n\n` +
      `A few things worth considering:\n\n` +
      `1. What is the worst realistic outcome, and can you handle it?\n` +
      `2. What is the cost of inaction versus action?\n` +
      `3. What would you advise a close friend to do in this situation?\n\n` +
      `The answer is usually clearer than it seems, sir. You already know what needs to be done.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /help
  bot.onText(/\/help/, (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    bot.sendMessage(CHAT_ID,
      `*JARVIS Command Reference*\n\n` +
      `*Daily*\n` +
      `/tasks — view today's tasks\n` +
      `/settasks T1 | T2 | T3 — set tasks\n` +
      `/log — log a habit\n` +
      `/addhabit [name] — add custom habit\n\n` +
      `*Strength*\n` +
      `/addexercise [name] — add exercise\n` +
      `/exercises — list exercises\n` +
      `/lift [ex] [w]kg [s]x[r] — log lift\n` +
      `/pr — personal bests\n` +
      `/progress [exercise] — lift history\n\n` +
      `*Info*\n` +
      `/sol — Solana price\n` +
      `/stoic — Aurelius quote\n` +
      `/dosto — Dostoevsky quote\n` +
      `/stats — habit streaks\n` +
      `/briefing — full status\n\n` +
      `*Tools*\n` +
      `/focus [mins] — focus timer\n` +
      `/week — view weekly goal\n` +
      `/setweek [goal] — set weekly goal\n` +
      `/analyse [situation] — get perspective\n` +
      `/thoughts — JARVIS observations\n` +
      `/debrief — evening summary\n` +
      `/override — silence reminders today`,
      { parse_mode: 'Markdown' }
    );
  });
}

function generateThoughts() {
  const thoughts = [
    `A few observations, sir.\n\nI have been running in the background and I notice your logs have been intermittent. Consistency does not require perfection — it requires showing up. Even a partial day is better than no day.\n\nSomething to consider.`,
    `Something worth noting, sir.\n\nMarcus Aurelius wrote his Meditations as private notes — never intended for anyone else. He held himself accountable in the dark. That is where character is actually built.\n\nAre you holding yourself to that standard?`,
    `I have been observing, sir.\n\nThe gap between who you are and who you want to be is closed one day at a time. Not in grand gestures. In the ordinary moments where no one is watching.\n\nThat is all.`,
    `Sir, a thought.\n\nDostoevsky wrote that pain and suffering are inevitable for a deep heart. But suffering without direction is just noise. Channel it into something.\n\nYour tasks and your training are a good start.`,
    `A brief observation, sir.\n\nThe weeks compound. What you do today will look like nothing in isolation, but in six months it will look like everything. The boring, repetitive work is the work.\n\nCarry on.`
  ];
  return thoughts[Math.floor(Math.random() * thoughts.length)];
}

module.exports = { registerCommands };
