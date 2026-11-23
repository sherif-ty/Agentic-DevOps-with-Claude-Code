// Static weather app: runs entirely in the browser, no backend.
// Uses Open-Meteo (free, no API key) for geocoding and current weather.

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO weather interpretation codes -> [description, day icon, night icon]
const WMO = {
    0: ['clear sky', '☀️', '🌙'],
    1: ['mainly clear', '🌤️', '🌙'],
    2: ['partly cloudy', '⛅', '☁️'],
    3: ['overcast', '☁️', '☁️'],
    45: ['fog', '🌫️', '🌫️'],
    48: ['depositing rime fog', '🌫️', '🌫️'],
    51: ['light drizzle', '🌦️', '🌧️'],
    53: ['moderate drizzle', '🌦️', '🌧️'],
    55: ['dense drizzle', '🌧️', '🌧️'],
    56: ['light freezing drizzle', '🌧️', '🌧️'],
    57: ['dense freezing drizzle', '🌧️', '🌧️'],
    61: ['slight rain', '🌦️', '🌧️'],
    63: ['moderate rain', '🌧️', '🌧️'],
    65: ['heavy rain', '🌧️', '🌧️'],
    66: ['light freezing rain', '🌧️', '🌧️'],
    67: ['heavy freezing rain', '🌧️', '🌧️'],
    71: ['slight snow', '🌨️', '🌨️'],
    73: ['moderate snow', '🌨️', '🌨️'],
    75: ['heavy snow', '❄️', '❄️'],
    77: ['snow grains', '🌨️', '🌨️'],
    80: ['slight rain showers', '🌦️', '🌧️'],
    81: ['moderate rain showers', '🌧️', '🌧️'],
    82: ['violent rain showers', '⛈️', '⛈️'],
    85: ['slight snow showers', '🌨️', '🌨️'],
    86: ['heavy snow showers', '❄️', '❄️'],
    95: ['thunderstorm', '⛈️', '⛈️'],
    96: ['thunderstorm with slight hail', '⛈️', '⛈️'],
    99: ['thunderstorm with heavy hail', '⛈️', '⛈️'],
};

const form = document.getElementById('weather-form');
const input = document.getElementById('city');
const result = document.getElementById('result');
const button = form.querySelector('button');

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function showMessage(text) {
    result.innerHTML = `<h3 class="one">${escapeHtml(text)}</h3>`;
}

async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function getWeather(city) {
    const geo = await getJson(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!geo.results || geo.results.length === 0) return null;

    const place = geo.results[0];
    const params = new URLSearchParams({
        latitude: place.latitude,
        longitude: place.longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
        timezone: 'auto',
    });
    const data = await getJson(`${WEATHER_URL}?${params}`);
    const c = data.current;
    const [description, dayIcon, nightIcon] = WMO[c.weather_code] || ['unknown', '🌡️', '🌡️'];

    return {
        city: place.name,
        country: place.country || '',
        temp: Math.round(c.temperature_2m * 10) / 10,
        humidity: c.relative_humidity_2m,
        wind: c.wind_speed_10m,
        description,
        icon: c.is_day ? dayIcon : nightIcon,
    };
}

function render(w) {
    const location = w.country ? `${w.city}, ${w.country}` : w.city;
    result.innerHTML = `
        <h2>${escapeHtml(location)}</h2>
        <p>Temperature: ${w.temp}°C</p>
        <p>Condition: ${escapeHtml(w.description)}
            <span class="weather-icon" aria-hidden="true">${w.icon}</span>
        </p>
        <p>Humidity: ${w.humidity}%</p>
        <p>Wind: ${w.wind} km/h</p>
    `;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = input.value.trim();
    if (!city) return;

    button.disabled = true;
    showMessage('Loading...');
    try {
        const weather = await getWeather(city);
        if (weather) render(weather);
        else showMessage('OOPS! CITY NOT FOUND');
    } catch (err) {
        console.error(err);
        showMessage('Could not load weather. Try again.');
    } finally {
        button.disabled = false;
    }
});
