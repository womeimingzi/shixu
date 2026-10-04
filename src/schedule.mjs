// Calendar dates are plain YYYY-MM-DD values. UTC arithmetic avoids DST shifts.
export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function dateValue(iso) { return new Date(`${iso}T12:00:00Z`); }
export function addDays(iso, days) {
  const date = dateValue(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function daysBetween(from, to) { return Math.round((dateValue(to) - dateValue(from)) / 86400000); }
export function weekday(iso) { return WEEKDAYS[dateValue(iso).getUTCDay()]; }
export function dateLabel(iso, full = false) {
  if (!iso) return '日期待补充';
  const [year, month, day] = iso.split('-').map(Number);
  return `${full ? `${year} 年 ` : ''}${month} 月 ${day} 日`;
}
export function occursOn(task, day) {
  if (!task.date || day < task.date) return false;
  return task.repeat === 'weekly' ? daysBetween(task.date, day) % 7 === 0 : task.date === day;
}
export function isDone(task, day) {
  return task.repeat === 'weekly' ? (task.doneOccurrences || []).includes(day) : !!task.completed;
}
export function dailyApplies(task, day) {
  return task.kind === 'task' && task.dailyEnabled && !task.completed && (!task.createdDate || day >= task.createdDate) && (!task.date || day <= task.date);
}
export function nextOccurrence(task, from) {
  if (task.completed || !task.date) return null;
  if (task.repeat !== 'weekly') return task.date;
  let next = from <= task.date ? task.date : addDays(task.date, Math.ceil(daysBetween(task.date, from) / 7) * 7);
  while ((task.doneOccurrences || []).includes(next)) next = addDays(next, 7);
  return next;
}
export function dayItems(tasks, day) {
  return tasks.filter(task => !task.deleted && !isDone(task, day) && (occursOn(task, day) || dailyApplies(task, day)));
}
export function monthDays(month) {
  const first = `${month}-01`;
  const offset = (dateValue(first).getUTCDay() + 6) % 7;
  const last = new Date(`${first}T12:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const count = last.getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i < offset || i >= offset + count ? null : addDays(first, i - offset));
}
export function changeMonth(month, delta) {
  const date = dateValue(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function toggleDaily(task, day) {
  const checks = task.dailyChecks || [];
  return { ...task, dailyChecks: checks.includes(day) ? checks.filter(d => d !== day) : [...checks, day] };
}
export function completeTask(task, day) {
  return task.repeat === 'weekly'
    ? { ...task, doneOccurrences: [...new Set([...(task.doneOccurrences || []), day])] }
    : { ...task, completed: true, completedAt: day };
}
export function initialData(today) {
  const firstWednesday = addDays(today, (3 - dateValue(today).getUTCDay() + 7) % 7);
  const common = { deleted: false, completed: false, dailyChecks: [], doneOccurrences: [], notes: '', location: '', start: '', end: '', repeat: 'none', dailyEnabled: false, dailyTime: '19:30', createdDate: today };
  return {
    version: 3, theme: 'light', journal: [], weather: { location: null },
    tasks: [
      { ...common, id: 'mooc', kind: 'task', category: 'course', title: '刷完 MOOC 课程', date: addDays(today, 14), dailyEnabled: true, notes: '每天学一点，给最后的测验留些时间。' },
      { ...common, id: 'meeting', kind: 'event', category: 'research', title: '每周组会', date: firstWednesday, start: '20:00', end: '21:00', repeat: 'weekly', notes: '提前整理本周进展，以及想和老师讨论的问题。' },
      { ...common, id: 'report', kind: 'event', category: 'research', title: '参加学术报告', date: '', notes: '收到通知后，补上时间和地点。' },
    ],
  };
}
