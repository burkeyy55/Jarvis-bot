const quotes = require('./quotes');
const reflections = require('./reflections');
const { getWeather, getSolPrice } = require('./api');
const db = require('./database');

function getRandomQuote() {
  const state = db.getState('last_quote_type') || 'dostoevsky';
  const nextType = state === 'aurelius' ? 'dostoevsky' : 'aurelius';
  db.setState('last_quote_type', nextType);
  const list = quotes[nextType];
  const quote = list[Math.floor(Math.random() * list.length)];
  const author = nextType === 'aurelius' ? 'Marcus Aurelius' : 'Fyodor Dostoevsky';
  return { quote, author, type: nextType };
}

function getRandomReflection() { return reflections[Math.floor(Math.random() * reflections.length)]; }

async function buildMorningMessage() {
  const weather = await getWeather();
  const sol = await getSolPrice();
  const { quote, author } = getRandomQuote();
  const now = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'long', day: 'numeric', month: 'long' });

  let msg = `Good morning, sir. ${now}.\n\n`;
  if (weather) {
    msg += `${weather.icon} *Weather — Kilsyth South*\n${weather.condition}, ${weather.temp}°C`;
    if (weather.rainChance > 20) msg += ` · ${weather.rainChance}% chance of rain — plan accordingly.`;
    msg += '\n\n';
  }
  if (sol) {
    const changeNum = parseFloat(sol.change);
    const arrow = changeNum >= 0 ? '📈' : '📉';
    const sign = changeNum >= 0 ? '+' : '';
    msg += `${arrow} *Solana*\n$${sol.price} USD  ·  ${sign}${sol.change}% (24h)\n\n`;
  }
  msg += `📜 *${author}*\n_"${quote.text}"_\n— ${quote.source}\n\n`;
  msg += `Shall we get the day started, sir?\n\nUse /settasks to set your top 3 priorities for today.`;
  return msg;
}

async function buildEveningDebrief() {
  const tasks = db.getTodayTasks();
  const habits = db.getTodayHabits();
  const reflection = getRandomReflection();
  let msg = `Good evening, sir.\n\n📋 *Today's Tasks*\n`;
  if (tasks) {
    const taskList = [{ text: tasks.task1, done: tasks.done1 }, { text: tasks.task2, done: tasks.done2 }, { text: tasks.task3, done: tasks.done3 }].filter(t => t.text);
    if (taskList.length === 0) { msg += `No tasks were set today.\n`; }
    else {
      taskList.forEach(t => { msg += `${t.done ? '✅' : '❌'} ${t.text}\n`; });
      const done = taskList.filter(t => t.done).length;
      msg += `\n${done} of ${taskList.length} completed.\n`;
    }
  } else { msg += `No tasks were set today.\n`; }
  msg += `\n📊 *Habits Logged Today*\n`;
  if (habits.length === 0) { msg += `Nothing logged today, sir.\n`; }
  else { [...new Set(habits.map(h => h.habit))].forEach(h => { msg += `✅ ${capitalize(h)}\n`; }); }
  msg += `\n🙏 *One thing you're grateful for today?*\nReply with /gratitude [your answer]\n\n`;
  msg += `💭 *Evening Reflection*\n_${reflection}_`;
  return msg;
}

function buildTaskNudge(tasks) {
  const pending = [];
  if (tasks.task1 && !tasks.done1) pending.push(tasks.task1);
  if (tasks.task2 && !tasks.done2) pending.push(tasks.task2);
  if (tasks.task3 && !tasks.done3) pending.push(tasks.task3);
  if (pending.length === 0) return null;
  let msg = `Sir, it is 6pm and you still have ${pending.length} unchecked ${pending.length === 1 ? 'task' : 'tasks'}.\n\n`;
  pending.forEach(t => { msg += `• ${t}\n`; });
  msg += `\nI would hate for ${pending.length === 1 ? 'it' : 'them'} to carry over to tomorrow. Use /tasks to check in.`;
  return msg;
}

function buildWeeklyStrengthReport() {
  const lifts = db.getWeekLifts();
  if (lifts.length === 0) return `*Weekly Strength Report*\n\nNo lifts were logged this week, sir. Something to address next week.`;
  let msg = `📈 *Weekly Strength Report*\n\n`;
  lifts.forEach(l => {
    const pr = db.getPR(l.exercise);
    const isPR = pr && l.weight >= pr.weight;
    msg += `${isPR ? '🏆' : '💪'} *${capitalize(l.exercise)}* — ${l.weight}kg${isPR ? ' (PR)' : ''}\n`;
  });
  msg += `\nKeep building, sir.`;
  return msg;
}

function buildWeeklyGoalCheckin() {
  const goal = db.getWeeklyGoal();
  if (!goal) return `Sir, no weekly goal was set this week. Use /week to set one for next week.`;
  return `*Weekly Goal Check-in*\n\nYour goal this week was:\n_"${goal.goal}"_\n\nHow did you go? Reflect honestly.`;
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

module.exports = { buildMorningMessage, buildEveningDebrief, buildTaskNudge, buildWeeklyStrengthReport, buildWeeklyGoalCheckin, getRandomQuote, getRandomReflection, capitalize };
