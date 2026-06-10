const axios = require('axios');

const LAT = -37.8167;
const LON = 145.3167;

async function getWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weathercode,precipitation_probability&timezone=Australia%2FMelbourne&forecast_days=1`;
    const res = await axios.get(url, { timeout: 8000 });
    const current = res.data.current;
    const temp = Math.round(current.temperature_2m);
    const rainChance = current.precipitation_probability;
    const code = current.weathercode;
    return { temp, rainChance, condition: weatherCodeToDescription(code), icon: weatherCodeToIcon(code) };
  } catch { return null; }
}

function weatherCodeToDescription(code) {
  if (code === 0) return 'Clear skies';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function weatherCodeToIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

async function getSolPrice() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true';
    const res = await axios.get(url, { timeout: 8000 });
    const data = res.data.solana;
    return { price: data.usd.toFixed(2), change: data.usd_24h_change.toFixed(2) };
  } catch { return null; }
}

module.exports = { getWeather, getSolPrice };
