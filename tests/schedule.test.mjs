import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayISO, occursOn, nextOccurrence, monthDays, dayItems, initialData, toggleDaily, completeTask } from '../src/schedule.mjs';

test('weekly meetings follow Wednesdays across month/year boundaries without starting early', () => {
  const meeting = { date: '2026-12-30', repeat: 'weekly', doneOccurrences: [] };
  assert.equal(occursOn(meeting, '2026-12-23'), false);
  assert.equal(occursOn(meeting, '2027-01-06'), true);
  assert.equal(occursOn(meeting, '2027-01-07'), false);
  assert.equal(nextOccurrence(meeting, '2027-01-01'), '2027-01-06');
  const done = completeTask(meeting, '2027-01-06');
  assert.equal(nextOccurrence(done, '2027-01-06'), '2027-01-13');
  assert.equal(occursOn(done, '2027-01-13'), true);
});

test('daily check-in does not complete a course and naturally resets the next day', () => {
  const course = initialData('2026-10-04').tasks[0];
  const checked = toggleDaily(course, '2026-10-04');
  assert.equal(checked.completed, false);
  assert.equal(checked.dailyChecks.includes('2026-10-05'), false);
  assert.equal(dayItems([checked], '2026-10-04').length, 1);
  assert.equal(dayItems([checked], '2026-10-05').length, 1);
  const done = completeTask(checked, '2026-10-04');
  assert.equal(dayItems([done], '2026-10-05').length, 0);
});

test('calendar selection includes that date’s meeting, but not another day’s', () => {
  const { tasks } = initialData('2026-10-04');
  assert.deepEqual(dayItems(tasks, '2026-10-07').map(t => t.id), ['mooc', 'meeting']);
  assert.deepEqual(dayItems(tasks, '2026-10-08').map(t => t.id), ['mooc']);
  assert.equal(dayItems(tasks, '2026-10-19').some(t => t.id === 'mooc'), false);
});

test('first-launch examples stay current in future years and keep the weekly meeting on Wednesday', () => {
  const { tasks } = initialData('2028-12-29');
  assert.equal(tasks[0].date, '2029-01-12');
  assert.equal(tasks[1].date, '2029-01-03');
  assert.equal(tasks.every(task => task.createdDate === '2028-12-29'), true);
});

test('calendar handles leap days and Monday alignment', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  assert.equal(monthDays('2026-10')[3], '2026-10-01');
  assert.equal(monthDays('2028-02').filter(Boolean).length, 29);
  assert.equal(todayISO(new Date('2026-10-03T17:00:00Z')), '2026-10-04');
});
