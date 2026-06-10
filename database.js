const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'jarvis.db');

let db;

async function getDB() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function runSQL(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function getSQL(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function allSQL(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

async function initDB() {
  await getDB();
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      task1 TEXT, task2 TEXT, task3 TEXT,
      done1 INTEGER DEFAULT 0, done2 INTEGER DEFAULT 0, done3 INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, habit TEXT NOT NULL,
      logged_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS lifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise TEXT NOT NULL, weight REAL NOT NULL,
      sets INTEGER NOT NULL, reps INTEGER NOT NULL,
      date TEXT NOT NULL, logged_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS weekly_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week TEXT NOT NULL, goal TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY, value TEXT
    );
    CREATE TABLE IF NOT EXISTS custom_habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL
    );
  `);
  saveDB();
}

function getToday() {
  return new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' }).split('/').reverse().join('-');
}

function getWeekKey() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getTodayTasks() { return getSQL('SELECT * FROM tasks WHERE date = ?', [getToday()]); }

function setTodayTasks(task1, task2, task3) {
  const today = getToday();
  const existing = getSQL('SELECT id FROM tasks WHERE date = ?', [today]);
  if (existing) {
    runSQL('UPDATE tasks SET task1=?, task2=?, task3=?, done1=0, done2=0, done3=0 WHERE date=?', [task1, task2, task3, today]);
  } else {
    runSQL('INSERT INTO tasks (date, task1, task2, task3) VALUES (?, ?, ?, ?)', [today, task1, task2, task3]);
  }
}

function completeTask(num) { runSQL(`UPDATE tasks SET done${num}=1 WHERE date=?`, [getToday()]); }

function logHabit(habit) { runSQL('INSERT INTO habits (date, habit) VALUES (?, ?)', [getToday(), habit]); }

function getTodayHabits() { return allSQL('SELECT habit FROM habits WHERE date = ?', [getToday()]); }

function getHabitStreak(habit) {
  const rows = allSQL('SELECT DISTINCT date FROM habits WHERE habit = ? ORDER BY date DESC', [habit]);
  if (!rows.length) return 0;
  let streak = 0;
  let current = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  for (const row of rows) {
    const rowDate = new Date(row.date);
    const diff = Math.round((current - rowDate) / (1000 * 60 * 60 * 24));
    if (diff <= 1) { streak++; current = rowDate; } else break;
  }
  return streak;
}

function addExercise(name) {
  try { runSQL('INSERT INTO exercises (name) VALUES (?)', [name.toLowerCase()]); return true; }
  catch { return false; }
}

function getExercises() { return allSQL('SELECT name FROM exercises ORDER BY name'); }

function logLift(exercise, weight, sets, reps) {
  runSQL('INSERT INTO lifts (exercise, weight, sets, reps, date) VALUES (?, ?, ?, ?, ?)',
    [exercise.toLowerCase(), weight, sets, reps, getToday()]);
}

function getPR(exercise) {
  return getSQL('SELECT weight, sets, reps, date FROM lifts WHERE exercise = ? ORDER BY weight DESC LIMIT 1', [exercise.toLowerCase()]);
}

function getAllPRs() {
  return allSQL('SELECT exercise, MAX(weight) as weight, sets, reps, date FROM lifts GROUP BY exercise ORDER BY exercise');
}

function getLiftHistory(exercise) {
  return allSQL('SELECT weight, sets, reps, date FROM lifts WHERE exercise = ? ORDER BY date DESC LIMIT 10', [exercise.toLowerCase()]);
}

function getWeekLifts() {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  return allSQL('SELECT exercise, MAX(weight) as weight, date FROM lifts WHERE date >= ? GROUP BY exercise ORDER BY exercise', [weekAgoStr]);
}

function setWeeklyGoal(goal) {
  const week = getWeekKey();
  const existing = getSQL('SELECT id FROM weekly_goals WHERE week = ?', [week]);
  if (existing) { runSQL('UPDATE weekly_goals SET goal = ? WHERE week = ?', [goal, week]); }
  else { runSQL('INSERT INTO weekly_goals (week, goal) VALUES (?, ?)', [week, goal]); }
}

function getWeeklyGoal() { return getSQL('SELECT goal FROM weekly_goals WHERE week = ?', [getWeekKey()]); }

function setState(key, value) { runSQL('INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)', [key, String(value)]); }

function getState(key) { const row = getSQL('SELECT value FROM state WHERE key = ?', [key]); return row ? row.value : null; }

function addCustomHabit(name) {
  try { runSQL('INSERT INTO custom_habits (name) VALUES (?)', [name.toLowerCase()]); return true; }
  catch { return false; }
}

function getCustomHabits() { return allSQL('SELECT name FROM custom_habits ORDER BY name'); }

module.exports = {
  initDB, getToday, getWeekKey,
  getTodayTasks, setTodayTasks, completeTask,
  logHabit, getTodayHabits, getHabitStreak,
  addExercise, getExercises, logLift, getPR, getAllPRs, getLiftHistory, getWeekLifts,
  setWeeklyGoal, getWeeklyGoal,
  setState, getState,
  addCustomHabit, getCustomHabits
};
