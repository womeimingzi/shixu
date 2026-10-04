import { addDays, todayISO, dailyApplies, occursOn, isDone, dateLabel } from '../src/schedule.mjs';

const at = (day, time) => Date.parse(`${day}T${time}:00+08:00`);
export function createSnooze(task, context, now = Date.now()) {
  const { type, day } = context || {};
  if (!['daily', 'deadline', 'event'].includes(type) ||
      (type === 'event') !== (task.kind === 'event') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day) throw Error('提醒信息不正确');
  return { taskId: task.id, type, day, due: +now + 600000 };
}
export function collectDueReminders(tasks, now = new Date(), ledger = {}, snoozes = []) {
  const day = todayISO(now);
  const timestamp = +now;
  const result = [];
  const add = (task, type, occurrence, due, expires, body) => {
    const key = `${type}:${task.id}:${occurrence}:${due}`;
    if (!ledger[key] && timestamp >= due && timestamp <= expires) result.push({ key, taskId: task.id, type, day: occurrence, title: task.title, body, due });
  };
  for (const task of tasks) {
    if (task.deleted || task.completed) continue;
    const endOfDay = at(addDays(day, 1), '00:00') - 1;
    if (dailyApplies(task, day) && !(task.dailyChecks || []).includes(day)) {
      add(task, 'daily', day, at(day, task.dailyTime), endOfDay, `到了留给它的一点时间，今天推进一点就好。${task.date ? `\n${dateLabel(task.date)}截止。` : ''}`);
    }
    if (task.kind === 'task' && task.date && [task.date, addDays(task.date, -1)].includes(day)) {
      add(task, 'deadline', day, at(day, '09:00'), endOfDay, `${day === task.date ? '今天' : '明天'}截止，记得留出提交和检查的时间。`);
    }
    if (task.kind === 'event') {
      // Tomorrow matters for events shortly after midnight: 00:05 reminds at 23:55.
      for (const occurrence of [day, addDays(day, 1)]) {
        if (!occursOn(task, occurrence) || isDone(task, occurrence)) continue;
        const start = at(occurrence, task.start || '09:00');
        const due = task.start ? start - 10 * 60000 : start;
        const expires = task.end ? at(occurrence, task.end) : task.start ? start + 3600000 : at(addDays(occurrence, 1), '00:00') - 1;
        add(task, 'event', occurrence, due, expires, `${dateLabel(occurrence)}${task.start ? ` ${task.start}${task.end ? `–${task.end}` : ''}` : ''}${timestamp >= start && task.start ? '，已经开始' : '，记得参加'}。${task.location ? `\n${task.location}` : ''}`);
      }
    }
  }
  for (const snooze of snoozes) {
    const task = tasks.find(t => t.id === snooze.taskId);
    if (!task || task.deleted || task.completed || isDone(task, snooze.day) || (snooze.type === 'daily' && (task.dailyChecks || []).includes(snooze.day))) continue;
    if (!ledger[snooze.key] && timestamp >= snooze.due && timestamp < snooze.due + 86400000) result.push({ ...snooze, title: task.title, body: '这是你选择稍后再看的事项。' });
  }
  return result.sort((a, b) => a.due - b.due);
}
