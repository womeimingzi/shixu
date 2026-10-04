const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function date(value) {
  if (!value) return '';
  if (!datePattern.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error('日期格式不正确');
  return value;
}
function text(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw Error('记录内容过长或格式不正确');
  return value;
}
function time(value) {
  if (!value) return '';
  if (!timePattern.test(value)) throw Error('时间格式不正确');
  return value;
}
export function validateData(input) {
  if (!input || ![2, 3].includes(input.version) || !Array.isArray(input.tasks) || input.tasks.length > 10000) throw Error('这不是可识别的拾序备份');
  if (!['light','dark','system'].includes(input.theme)) throw Error('主题设置不正确');
  const ids = new Set();
  return { version: 3, theme: input.theme, journal: validateJournal(input.journal), weather: { location: validateLocation(input.weather?.location) }, tasks: input.tasks.map(task => {
    if (!task || typeof task !== 'object') throw Error('事项格式不正确');
    const id = text(task.id, 128);
    const title = text(task.title, 120).trim();
    if (!id || !title || ids.has(id)) throw Error('事项名称或标识不正确');
    ids.add(id);
    if (!['task','event'].includes(task.kind) || !['course','research','other'].includes(task.category) || !['none','weekly'].includes(task.repeat)) throw Error('事项类型不正确');
    const dates = value => {
      if (value === undefined) return [];
      if (!Array.isArray(value) || value.length > 10000) throw Error('打卡记录格式不正确');
      return [...new Set(value.map(date))];
    };
    const result = {
      id, title, kind: task.kind, category: task.category, repeat: task.repeat, date: date(task.date),
      start: time(task.start), end: time(task.end), location: text(task.location, 160), notes: text(task.notes, 2000),
      dailyEnabled: !!task.dailyEnabled, dailyTime: time(task.dailyTime) || '19:30', dailyChecks: dates(task.dailyChecks),
      doneOccurrences: dates(task.doneOccurrences), completed: !!task.completed, deleted: !!task.deleted,
      completedAt: date(task.completedAt), createdDate: date(task.createdDate),
    };
    if (result.repeat === 'weekly' && (result.kind !== 'event' || !result.date)) throw Error('每周重复日程需要开始日期');
    if (result.end && (!result.start || result.end <= result.start)) throw Error('结束时间需要晚于开始时间');
    return result;
  }) };
}

export const MOODS = { calm: '平静', happy: '开心', inspired: '有灵感', tired: '有点累', cloudy: '低落' };
function validateJournal(value = []) {
  if (!Array.isArray(value) || value.length > 10000) throw Error('随笔格式不正确');
  const ids = new Set();
  return value.map(entry => {
    if (!entry || typeof entry !== 'object') throw Error('随笔格式不正确');
    const id = text(entry.id, 128);
    const day = date(entry.date);
    if (!id || ids.has(id) || !day || (entry.mood && (typeof entry.mood !== 'string' || !Object.hasOwn(MOODS, entry.mood)))) throw Error('随笔日期或标识不正确');
    ids.add(id);
    return { id, date: day, title: text(entry.title, 120), body: text(entry.body, 50000), mood: entry.mood || '', deleted: !!entry.deleted };
  });
}

export function validateLocation(value) {
  if (value == null) return null;
  const latitude = value.latitude;
  const longitude = value.longitude;
  const name = text(value.name, 160).trim();
  const timezone = text(value.timezone, 80);
  if (!name || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !timezone) throw Error('城市信息不正确');
  try { new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); } catch { throw Error('城市时区不正确'); }
  return { name, latitude, longitude, timezone };
}

// Imports add records and keep existing ones. ID collisions get new IDs unless identical.
export function mergeData(current, incoming, createId) {
  const next = validateData(current);
  const source = validateData(incoming);
  let added = 0;
  let journalAdded = 0;
  for (const task of source.tasks) {
    const existing = next.tasks.find(t => t.id === task.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(task)) continue;
    next.tasks.push({ ...task, id: existing ? createId() : task.id });
    added++;
  }
  for (const entry of source.journal) {
    const existing = next.journal.find(item => item.id === entry.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(entry)) continue;
    next.journal.push({ ...entry, id: existing ? createId() : entry.id });
    journalAdded++;
  }
  return { data: validateData(next), added, journalAdded };
}
