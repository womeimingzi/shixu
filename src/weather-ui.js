import { searchCities, fetchForecast, clothingHint, weatherLabel, weatherSymbol, cityToday, WEATHER_SOURCE } from './weather.mjs';
import { addDays } from './schedule.mjs';

export function initWeather({ getData, save, desktop, escapeHTML, toast }) {
  const $ = selector => document.querySelector(selector);
  const cacheKey = 'shixu:weather:cache:v1';
  let forecast = null;
  let busy = false;
  let error = '';
  let generation = 0;
  let searchGeneration = 0;
  let lastAttempt = 0;
  const location = () => getData().weather.location;
  const sameCity = (a, b) => !!a && !!b && a.latitude === b.latitude && a.longitude === b.longitude && a.timezone === b.timezone;
  function loadCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (sameCity(cached?.location, location()) && Number.isFinite(cached.fetchedAt) && Array.isArray(cached.days) && cached.days.every(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(day.min) && Number.isFinite(day.max))) forecast = cached;
    } catch { /* Weather cache is disposable; journal data is stored separately. */ }
  }
  function render() {
    const city = location();
    const heading = `<div class="weather-heading"><h2>窗外的天气</h2>${city ? `<button type="button" class="text-button" data-weather-settings title="${escapeHTML(city.name)}">${escapeHTML(city.name.split(' · ')[0])} · 更换</button>` : ''}</div>`;
    if (!city) {
      $('#weather-panel').innerHTML = `<div class="weather-empty">${heading}<p>今天怎样出门，<br>明天要不要多带一件外套。</p><button type="button" class="soft-button" data-weather-settings>选择城市</button></div>`;
      return;
    }
    const today = cityToday(city);
    const tomorrow = addDays(today, 1);
    const days = sameCity(forecast?.location, city) ? forecast.days : [];
    const todayForecast = days.find(day => day.date === today);
    const tomorrowForecast = days.find(day => day.date === tomorrow);
    const stale = !forecast || Date.now() - forecast.fetchedAt > 3 * 3600000;
    const card = (day, label, date) => `<div class="weather-day"><span class="weather-date">${label} · ${Number(date.slice(5,7))}/${Number(date.slice(8))}</span>${day ? `<div class="weather-symbol" aria-hidden="true">${weatherSymbol(day.code)}</div><strong>${Math.round(day.min)}–${Math.round(day.max)}°</strong><small>${weatherLabel(day.code)}</small><small>${day.rain === null ? '降雨概率暂无' : `降雨 ${Math.round(day.rain)}%`}</small>` : '<p class="weather-error">暂无预报</p>'}</div>`;
    const updated = forecast ? new Intl.DateTimeFormat('zh-CN', { timeZone:city.timezone, month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(forecast.fetchedAt)) : '';
    $('#weather-panel').innerHTML = `${heading}<div class="weather-days">${card(todayForecast, '今天', today)}${card(tomorrowForecast, '明天', tomorrow)}</div>${!stale ? `${todayForecast ? `<p class="weather-hint"><strong>今天出门</strong> · ${clothingHint(todayForecast)}</p>` : ''}${tomorrowForecast ? `<p class="weather-hint"><strong>给明天的准备</strong> · ${clothingHint(tomorrowForecast)}</p>` : ''}` : ''}<div class="weather-meta"><span>${busy ? '正在看一眼天气…' : updated ? `${updated} 更新${stale ? ' · 缓存' : ''}` : '尚未取得天气'}</span><button type="button" class="text-button" data-weather-refresh ${busy ? 'disabled' : ''}>刷新</button></div>${error ? `<p class="weather-error">${escapeHTML(error)}${todayForecast || tomorrowForecast ? ' 当前展示上次获取的预报。' : ''}</p>` : stale && forecast ? '<p class="weather-error">预报有些旧了，刷新后再看看穿衣建议。</p>' : ''}<button type="button" class="weather-provider" data-weather-source>Open-Meteo · CC BY 4.0</button><p class="weather-error">按城市当地日期；穿衣建议可随体感调整。</p>`;
  }
  async function refresh(force = false) {
    const city = location();
    if (!city || busy) { render(); return; }
    if (!force && ((forecast && sameCity(forecast.location, city) && Date.now() - forecast.fetchedAt < 3600000 && forecast.days.some(day => day.date === cityToday(city))) || Date.now() - lastAttempt < 60000)) { render(); return; }
    const request = ++generation;
    busy = true; error = ''; lastAttempt = Date.now(); render();
    try {
      const result = desktop ? await desktop.weatherForecast(city) : { ok:true, forecast:await fetchForecast(city) };
      if (request !== generation) return;
      if (!result.ok) throw Error(result.error);
      forecast = result.forecast;
      try { localStorage.setItem(cacheKey, JSON.stringify(forecast)); } catch { /* A failed weather cache never blocks writing. */ }
    } catch {
      if (request === generation) error = '暂时连不上天气服务，稍后再试；记事不受影响。';
    } finally { if (request === generation) { busy = false; render(); } }
  }
  function reset() { generation++; busy = false; error = ''; forecast = null; lastAttempt = 0; loadCache(); render(); refresh(); }
  function chooseCity(city) {
    const before = location(); getData().weather.location = city;
    if (!save()) { getData().weather.location = before; toast('城市未能保存，请重试'); return; }
    $('#weather-settings').close();
    try { localStorage.removeItem(cacheKey); } catch {}
    reset();
  }
  $('#weather-search-form').addEventListener('submit', async event => {
    event.preventDefault();
    const query = $('#weather-query').value.trim();
    if (query.length < 2) { $('#weather-search-status').textContent = '请输入至少两个字的城市名。'; return; }
    const request = ++searchGeneration;
    $('#weather-search-button').disabled = true; $('#weather-search-results').replaceChildren(); $('#weather-search-status').textContent = '正在找这座城市…';
    try {
      const result = desktop ? await desktop.weatherSearch(query) : { ok:true, cities:await searchCities(query) };
      if (request !== searchGeneration) return;
      if (!result.ok) throw Error(result.error);
      $('#weather-search-status').textContent = result.cities.length ? '选中你想看的城市：' : '没有找到，可以试试拼音或附近的大城市。';
      for (const city of result.cities) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'city-result'; button.textContent = city.name;
        button.addEventListener('click', () => chooseCity(city)); $('#weather-search-results').append(button);
      }
    } catch { if (request === searchGeneration) $('#weather-search-status').textContent = '暂时连不上城市查询服务，请检查网络后再试。'; }
    finally { if (request === searchGeneration) $('#weather-search-button').disabled = false; }
  });
  $('#weather-disable').addEventListener('click', () => chooseCity(null));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-weather-settings]')) { $('#weather-settings').showModal(); $('#weather-query').focus(); }
    if (event.target.closest('[data-weather-refresh]')) refresh(true);
    if (event.target.closest('[data-weather-source]')) {
      if (desktop) desktop.weatherSource(); else window.open(WEATHER_SOURCE, '_blank', 'noopener,noreferrer');
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', () => refresh(true));
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  reset();
  return { refresh, reset };
}
