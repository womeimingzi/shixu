import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initialData } from '../src/schedule.mjs';
import { validateData, mergeData, validateLocation } from '../src/data.mjs';
import { StateStore } from '../desktop/store.mjs';
import { normalizeForecast, clothingHint, cityToday, searchCities, fetchForecast, weatherLabel } from '../src/weather.mjs';

const city = { name:'测试城市', latitude:30.27, longitude:120.15, timezone:'Asia/Shanghai' };
const entry = { id:'journal-example', date:'2026-10-04', title:'一小步', body:'今天整理出一个问题。\n明天再试。', mood:'calm', deleted:false };
const response = { daily: { time:['2026-10-04','2026-10-05'], weather_code:[2,63], temperature_2m_min:[15,0], temperature_2m_max:[25,10], precipitation_probability_max:[null,75], wind_speed_10m_max:[12,35] } };

test('v2 records migrate without losing tasks; journal and city persist across atomic saves', () => {
  const legacy = initialData('2026-10-04'); legacy.version = 2; delete legacy.journal; delete legacy.weather;
  const upgraded = validateData(legacy);
  assert.equal(upgraded.version, 3); assert.equal(upgraded.tasks.length, 3);
  assert.deepEqual(upgraded.journal, []); assert.equal(upgraded.weather.location, null);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shixu-life-'));
  try {
    const store = new StateStore(directory);
    upgraded.journal.push(entry); upgraded.weather.location = city;
    store.saveData(upgraded);
    assert.deepEqual(new StateStore(directory).state.data, upgraded);
    const invalid = structuredClone(upgraded); invalid.journal[0].date = '2026-02-30';
    assert.throws(() => store.saveData(invalid), /日期/);
    assert.deepEqual(new StateStore(directory).state.data.journal, [entry]);
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive:true });
  }
});

test('import retains both versions of a conflicting journal and keeps the local weather choice', () => {
  const current = initialData('2026-10-04'); current.journal = [entry]; current.weather.location = city;
  const incoming = structuredClone(current); incoming.journal[0].body = '另一份想法'; incoming.weather.location = null;
  const merged = mergeData(current, incoming, () => 'new-journal-id');
  assert.equal(merged.added, 0); assert.equal(merged.journalAdded, 1);
  assert.deepEqual(merged.data.journal.map(item => item.body), [entry.body, '另一份想法']);
  assert.equal(merged.data.journal[1].id, 'new-journal-id');
  assert.deepEqual(merged.data.weather.location, city);
  assert.equal(mergeData(current, structuredClone(current), () => 'unused').journalAdded, 0);
  const bad = structuredClone(current); bad.journal.push(entry);
  assert.throws(() => validateData(bad), /随笔/);
});

test('weather handles zero degrees, missing rainfall, invalid payloads and city-local dates', () => {
  const forecast = normalizeForecast(response, city, 1000);
  assert.equal(forecast.days[1].min, 0); assert.equal(forecast.days[0].rain, null);
  assert.equal(cityToday(city, new Date('2026-10-04T17:00:00Z')), '2026-10-05');
  assert.equal(cityToday({ ...city, timezone:'America/New_York' }, new Date('2026-10-04T17:00:00Z')), '2026-10-04');
  const bad = structuredClone(response); bad.daily.temperature_2m_min[0] = null;
  assert.throws(() => normalizeForecast(bad, city), /不完整/);
  assert.throws(() => validateLocation({ ...city, latitude:Infinity }), /城市/);
  assert.match(clothingHint(forecast.days[1]), /带伞/);
  assert.match(clothingHint(forecast.days[1]), /防风/);
  assert.match(clothingHint(forecast.days[0]), /分层/);
  assert.equal(weatherLabel(null), '天气数据待更新');
});

test('weather requests use fixed endpoints and send only the chosen city parameters', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return { ok:true, json:async () => url.hostname.startsWith('geocoding') ? { results:[{ name:city.name, latitude:city.latitude, longitude:city.longitude, timezone:city.timezone }] } : response };
  };
  const results = await searchCities('杭州&key=test', fetcher);
  assert.equal(calls[0].url.origin, 'https://geocoding-api.open-meteo.com');
  assert.equal(calls[0].url.searchParams.get('name'), '杭州&key=test');
  assert.equal(calls[0].url.searchParams.has('key'), false);
  await fetchForecast(results[0], fetcher);
  assert.equal(calls[1].url.origin, 'https://api.open-meteo.com');
  assert.equal(calls[1].url.searchParams.get('timezone'), city.timezone);
  assert.equal(calls[1].options.credentials, 'omit');
  assert.equal(calls[1].options.body, undefined);
  await assert.rejects(searchCities('a', fetcher), /两个/);
  await assert.rejects(fetchForecast(city, async () => ({ ok:false })), /稍后/);
});
