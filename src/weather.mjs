import { validateLocation } from './data.mjs';

export const WEATHER_SOURCE = 'https://open-meteo.com/';
const codes = { 0:'晴', 1:'大部晴朗', 2:'多云', 3:'阴', 45:'雾', 48:'雾凇', 51:'小毛毛雨', 53:'毛毛雨', 55:'较强毛毛雨', 56:'冻毛毛雨', 57:'冻毛毛雨', 61:'小雨', 63:'中雨', 65:'大雨', 66:'冻雨', 67:'冻雨', 71:'小雪', 73:'中雪', 75:'大雪', 77:'雪粒', 80:'阵雨', 81:'较强阵雨', 82:'强阵雨', 85:'阵雪', 86:'较强阵雪', 95:'雷雨', 96:'雷雨伴冰雹', 97:'强雷雨', 99:'雷雨伴冰雹' };
export const weatherLabel = code => codes[code] || '天气数据待更新';
export const weatherSymbol = code => code == null ? '—' : code <= 1 ? '☀' : code <= 3 ? '☁' : [45,48].includes(code) ? '≋' : code >= 95 ? 'ϟ' : [71,73,75,77,85,86].includes(code) ? '❄' : '☂';
export function cityToday(location, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: location.timezone, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
async function requestJSON(url, fetcher) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(10000), credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw Error('天气服务暂时没有回应，请稍后再试');
  return response.json();
}
export async function searchCities(query, fetcher = fetch) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 80) throw Error('请输入至少两个字的城市名');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query.trim(), count:'6', language:'zh', format:'json' });
  const result = await requestJSON(url, fetcher);
  return (result.results || []).map(place => validateLocation({
    name: [...new Set([place.name, place.admin1, place.country].filter(Boolean))].join(' · '),
    latitude: place.latitude, longitude: place.longitude, timezone: place.timezone,
  }));
}
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function normalizeForecast(result, location, fetchedAt = Date.now()) {
  if (!Array.isArray(result?.daily?.time) || result.daily.time.length < 1) throw Error('天气数据不完整，请稍后刷新');
  const daily = result.daily;
  const days = daily.time.slice(0, 3).map((date, index) => ({
    date, code: finite(daily.weather_code?.[index]), min: finite(daily.temperature_2m_min?.[index]), max: finite(daily.temperature_2m_max?.[index]),
    rain: finite(daily.precipitation_probability_max?.[index]), wind: finite(daily.wind_speed_10m_max?.[index]),
  }));
  if (days.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || day.min === null || day.max === null || day.min > day.max)) throw Error('天气数据不完整，请稍后刷新');
  return { location: validateLocation(location), fetchedAt, days };
}
export async function fetchForecast(location, fetcher = fetch) {
  const city = validateLocation(location);
  if (!city) throw Error('请先选择城市');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude:String(city.latitude), longitude:String(city.longitude), timezone:city.timezone,
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max', forecast_days:'3', temperature_unit:'celsius', wind_speed_unit:'kmh' });
  return normalizeForecast(await requestJSON(url, fetcher), city);
}

// Simple, transparent comfort hints from the forecast, not personal or medical advice.
export function clothingHint(day) {
  if (!day || !Number.isFinite(day.min) || !Number.isFinite(day.max)) return '等天气更新后，再准备出门的衣服。';
  const average = (day.min + day.max) / 2;
  const outfit = average < 5 ? '厚外套或羽绒服，围巾也可以备上' : average < 12 ? '毛衣搭外套，早晚多穿一层' : average < 18 ? '长袖加外套，方便随温度增减' : average < 24 ? '长袖或薄外套，穿得轻松一点' : '轻薄透气的衣服，午后注意防晒';
  const extras = [];
  if (day.max - day.min >= 9) extras.push('温差较大，适合分层穿搭');
  if ([71,73,75,77,85,86].includes(day.code)) extras.push('可能有雪，穿防滑保暖的鞋');
  else if (day.rain >= 40 || [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,97,99].includes(day.code)) extras.push('出门带伞');
  if (day.wind >= 30) extras.push('风较大，带件防风外套');
  return [outfit, ...extras].join('；') + '。';
}
