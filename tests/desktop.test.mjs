import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initialData } from '../src/schedule.mjs';
import { validateData, mergeData } from '../src/data.mjs';
import { StateStore } from '../desktop/store.mjs';
import { collectDueReminders, createSnooze } from '../desktop/reminders.mjs';

test('daily reminders survive a restart without repeating, and skip checked days', () => {
  const { tasks } = initialData('2026-10-04');
  const now = new Date('2026-10-04T19:31:00+08:00');
  assert.equal(collectDueReminders(tasks, new Date('2026-10-04T19:29:00+08:00')).length, 0);
  const due = collectDueReminders(tasks, now);
  assert.equal(due.length, 1);
  assert.equal(due[0].type, 'daily');
  assert.equal(collectDueReminders(tasks, now, { [due[0].key]: +now }).length, 0);
  tasks[0].dailyChecks.push('2026-10-04');
  assert.equal(collectDueReminders(tasks, now).length, 0);
  assert.equal(collectDueReminders(tasks, new Date('2026-10-05T19:31:00+08:00')).length, 1);
});
test('meeting reminders arrive ten minutes early, catch up after sleep, and skip completed occurrences', () => {
  const task = initialData('2026-10-04').tasks[1];
  assert.equal(collectDueReminders([task], new Date('2026-10-07T19:49:00+08:00')).length, 0);
  assert.equal(collectDueReminders([task], new Date('2026-10-07T19:50:00+08:00')).length, 1);
  assert.equal(collectDueReminders([task], new Date('2026-10-07T20:10:00+08:00')).length, 1);
  assert.equal(collectDueReminders([task], new Date('2026-10-07T21:01:00+08:00')).length, 0);
  task.doneOccurrences.push('2026-10-07');
  assert.equal(collectDueReminders([task], new Date('2026-10-07T19:50:00+08:00')).length, 0);
  assert.equal(collectDueReminders([task], new Date('2026-10-14T19:50:00+08:00')).length, 1);
});
test('just-after-midnight events remind the previous evening', () => {
  const task = { ...initialData('2026-10-04').tasks[1], date: '2026-10-05', start: '00:05', end: '01:00', repeat: 'none' };
  const reminders = collectDueReminders([task], new Date('2026-10-04T23:55:00+08:00'));
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].day, '2026-10-05');
});
test('deadline reminders run at 9am on the day before and the due date, not afterward', () => {
  const task = { ...initialData('2026-10-04').tasks[0], dailyEnabled: false };
  assert.equal(collectDueReminders([task], new Date('2026-10-17T08:59:00+08:00')).length, 0);
  assert.equal(collectDueReminders([task], new Date('2026-10-17T09:00:00+08:00'))[0].type, 'deadline');
  assert.equal(collectDueReminders([task], new Date('2026-10-18T09:00:00+08:00')).length, 1);
  assert.equal(collectDueReminders([task], new Date('2026-10-19T09:00:00+08:00')).length, 0);
  task.completed = true;
  assert.equal(collectDueReminders([task], new Date('2026-10-18T09:00:00+08:00')).length, 0);
});
test('snoozes use persisted due times and are suppressed after completion', () => {
  const task = initialData('2026-10-04').tasks[0];
  const snooze = { key: 'snooze:test', taskId: task.id, type: 'daily', day: '2026-10-04', due: +new Date('2026-10-04T12:10:00+08:00') };
  assert.equal(collectDueReminders([task], new Date('2026-10-04T12:09:00+08:00'), {}, [snooze]).length, 0);
  assert.equal(collectDueReminders([task], new Date('2026-10-04T12:10:00+08:00'), {}, [snooze]).length, 1);
  task.deleted = true;
  assert.equal(collectDueReminders([task], new Date('2026-10-04T12:10:00+08:00'), {}, [snooze]).length, 0);
});
test('snoozed deadlines survive a daily check-in and midnight events retain their occurrence date', () => {
  const course = initialData('2026-10-04').tasks[0];
  const now = new Date('2026-10-17T09:00:00+08:00');
  const deadline = collectDueReminders([course], now)[0];
  const snooze = { key: 'snooze:deadline', ...createSnooze(course, deadline, now) };
  course.dailyChecks.push('2026-10-17');
  const due = collectDueReminders([course], new Date(+now + 600000), { [deadline.key]: +now }, [snooze]);
  assert.equal(due.length, 1);
  assert.equal(due[0].type, 'deadline');
  const meeting = initialData('2026-10-04').tasks[1];
  assert.equal(createSnooze(meeting, { type: 'event', day: '2026-10-05' }, new Date('2026-10-04T23:55:00+08:00')).day, '2026-10-05');
  assert.throws(() => createSnooze(course, { type: 'event', day: '2026-10-17' }), /提醒信息/);
  assert.throws(() => createSnooze(course, { type: 'deadline', day: '2026-02-30' }), /提醒信息/);
});

test('imports validate dates and preserve existing records on ID collisions', () => {
  const current = initialData('2026-10-04');
  const incoming = structuredClone(current);
  incoming.tasks[0].title = '另一门课程';
  const merged = mergeData(current, incoming, () => 'new-id');
  assert.equal(merged.added, 1);
  assert.equal(merged.data.tasks.length, 4);
  assert.equal(merged.data.tasks[0].title, current.tasks[0].title);
  incoming.tasks[0].date = '2026-02-30';
  assert.throws(() => validateData(incoming), /日期/);
});
test('atomic local storage reloads records and recovers the last valid backup without discarding damaged files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shixu-test-'));
  try {
    const store = new StateStore(directory);
    const data = initialData('2026-10-04');
    data.tasks[0].title = '第一份保存'; store.saveData(data);
    data.tasks[0].title = '第二份保存'; store.saveData(data);
    assert.equal(new StateStore(directory).state.data.tasks[0].title, '第二份保存');
    fs.writeFileSync(store.file, 'interrupted write');
    const recovered = new StateStore(directory);
    assert.equal(recovered.state.data.tasks[0].title, '第一份保存');
    assert.match(recovered.notice, /备份/);
    assert.ok(fs.readdirSync(directory).some(name => name.startsWith('state-unreadable-')));
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true });
  }
});
