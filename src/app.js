import { todayISO, dateLabel, weekday, daysBetween, occursOn, isDone, dailyApplies, nextOccurrence, dayItems, monthDays, changeMonth, toggleDaily, completeTask, initialData } from './schedule.mjs';
import { validateData } from './data.mjs';
import { initJournal } from './journal.js';
import { initWeather } from './weather-ui.js';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.5 14.2A9 9 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  inbox: '<path d="m3 14 4-9h10l4 9v5H3Zm0 0h5l2 3h4l2-3h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  circle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  settings: '<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  enter: '<path d="M19 5v9H5m4-4-4 4 4 4"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 20h4"/>',
  leaf: '<path d="M20 3c-8-1-16 3-16 10a6 6 0 0 0 10 4c4-4 5-8 6-14ZM4 21l10-11"/>',
  book: '<path d="M4 4h6c2 0 2 2 2 2s0-2 2-2h6v16h-6c-2 0-2 1-2 1s0-1-2-1H4ZM12 6v15"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.circle}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const categoryNames = { course: '课程学习', research: '科研日常', other: '生活杂事' };
const STORAGE_KEY = 'shixu:desktop:v2';
const desktop = window.shixuDesktop;
let desktopState = null;
const media = matchMedia('(prefers-color-scheme: dark)');
let today = todayISO();
let data = initialData(today);
let storageError = '';
let savedRaw = null;
let unreadableBackup = null;
try {
  if (desktop) {
    desktopState = await desktop.load();
    if (!desktopState.ok) throw Error(desktopState.error);
    savedRaw = JSON.stringify(desktopState.data);
  } else savedRaw = localStorage.getItem(STORAGE_KEY);
  if (savedRaw) {
    const parsed = JSON.parse(savedRaw);
    data = validateData(parsed);
  }
} catch {
  unreadableBackup = savedRaw;
  storageError = savedRaw ? '记录读取失败，请先导出备份' : '浏览器存储不可用，请导出备份';
}
let view = 'today';
let selectedDay = today;
let month = today.slice(0, 7);
let catTimer;
let toastTimer;
let undoAction;
let reminderId;
let reminderContext;
let snoozeTimer;
let notificationOpener;
let journal;
let weather;

function save() {
  try {
    // Do not overwrite unparseable storage with sample data.
    if (storageError.startsWith('记录读取')) { storageStatus(); return false; }
    if (desktop) {
      const result = desktop.save(data);
      if (!result.ok) throw Error(result.error);
    } else localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    storageError = '';
  } catch { storageError = '保存失败，请导出备份'; }
  storageStatus();
  return !storageError;
}
function storageStatus() {
  $('#storage-state').classList.toggle('error', !!storageError);
  $('#storage-state').innerHTML = `<i></i>${escapeHTML(storageError || (desktop ? '已保存到这台电脑' : '已保存到此浏览器'))}`;
}
function activeTasks() { return data.tasks.filter(t => !t.deleted); }
function taskById(id) { return data.tasks.find(t => t.id === id); }
function updateTask(id, change) {
  const index = data.tasks.findIndex(t => t.id === id);
  if (index < 0) return;
  data.tasks[index] = { ...data.tasks[index], ...change };
  save();
  render();
}
function applyTheme() {
  const theme = data.theme === 'system' ? (media.matches ? 'dark' : 'light') : data.theme;
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const choice = button.dataset.themeChoice;
    button.innerHTML = icon({ light: 'sun', dark: 'moon', system: 'monitor' }[choice]);
    button.setAttribute('aria-pressed', String(data.theme === choice));
  });
  $('#theme-select').value = data.theme;
  if (!catTimer) resetCat();
}
function resetCat() {
  catTimer = undefined;
  const night = document.documentElement.dataset.theme === 'dark';
  $('#companion-cat').dataset.pose = night ? 'sleep' : 'idle';
  $('#companion-cat').setAttribute('aria-label', night ? '蜷着休息的小橘猫' : '坐着陪你的小橘猫');
  $('#cat-caption').textContent = night ? '慢慢做，也记得休息。' : '我在这里陪你。';
}
function celebrate(message) {
  clearTimeout(catTimer);
  $('#companion-cat').dataset.pose = 'happy';
  $('#companion-cat').setAttribute('aria-label', '举爪庆祝的小橘猫');
  $('#cat-caption').textContent = message;
  catTimer = setTimeout(resetCat, 2800);
}
function toast(message, undo) {
  clearTimeout(toastTimer);
  $('#toast-message').textContent = storageError ? `${message} · ${storageError}` : message;
  $('#toast').hidden = false;
  $('#toast-undo').hidden = !undo;
  undoAction = undo;
  toastTimer = setTimeout(hideToast, undo ? 12000 : 5000);
}
function hideToast() { $('#toast').hidden = true; undoAction = undefined; clearTimeout(toastTimer); }
$('#toast-undo').addEventListener('click', () => { const action = undoAction; hideToast(); action?.(); });

function todayTasks() {
  return activeTasks().filter(t => !t.completed && !isDone(t, today) && (dailyApplies(t, today) || occursOn(t, today) || (t.repeat !== 'weekly' && t.date && t.date < today)));
}
function completedEntries() {
  return activeTasks().flatMap(task => task.repeat === 'weekly'
    ? (task.doneOccurrences || []).map(day => ({ task, day, done: true }))
    : task.completed ? [{ task, day: task.completedAt || today, done: true }] : []).sort((a, b) => b.day.localeCompare(a.day));
}
function renderNav() {
  const counts = { today: todayTasks().length, all: activeTasks().filter(t => !t.completed).length, done: completedEntries().length };
  $('#main-nav').innerHTML = [['today', 'sun', '我的一天'], ['schedule', 'calendar', '日程安排'], ['all', 'inbox', '全部事项'], ['done', 'circle', '已完成'], ['journal', 'book', '随手记']].map(([id, symbol, title]) => `<button type="button" class="nav-button" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span>${counts[id] !== undefined ? `<span class="nav-count">${String(counts[id]).padStart(2, '0')}</span>` : ''}</button>`).join('');
  $('#category-nav').innerHTML = Object.entries(categoryNames).map(([id, title]) => `<button type="button" class="nav-button category-button" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}><i class="category-dot ${id}"></i>${title}</button>`).join('');
}
function dueLabel(task, day) {
  if (!task.date) return '日期待补充';
  if (task.kind === 'event') return task.repeat === 'weekly' ? `每${weekday(task.date)}` : dateLabel(task.date);
  const diff = daysBetween(today, task.date);
  return diff < 0 ? `已过期 ${-diff} 天` : diff === 0 ? '今天截止' : `还有 ${diff} 天`;
}
function card({ task, day, done = false }) {
  const daily = task.kind === 'task' && task.dailyEnabled;
  const checked = (task.dailyChecks || []).includes(today);
  const isSelectedOtherDay = view === 'schedule' && selectedDay !== today;
  const checkAllowed = !isSelectedOtherDay && dailyApplies(task, today);
  const completeAllowed = task.repeat !== 'weekly' || day <= today;
  const attrs = `data-id="${escapeHTML(task.id)}" data-day="${day || today}"`;
  const time = task.start ? `${task.start}${task.end ? `–${task.end}` : ''}` : '';
  const meta = [
    task.date ? `<span>${icon('calendar')}${dateLabel(task.kind === 'event' ? day : task.date)}${task.kind === 'task' ? ' 截止' : ''}</span>` : `<span>先记着，时间之后再补</span>`,
    time ? `<span>${icon('clock')}${escapeHTML(time)}</span>` : '',
    daily ? `<span>${icon('bell')}每天 ${escapeHTML(task.dailyTime)}</span>` : '',
    task.location ? `<span class="location">${escapeHTML(task.location)}</span>` : '',
  ].join('');
  let actions;
  if (done) {
    actions = `<span class="completed-note">${icon('check')} ${dateLabel(day)} 已完成${task.repeat === 'weekly' ? '这一场' : ''}</span><button class="complete-button" type="button" data-action="restore-done" ${attrs}>恢复未完成</button>`;
  } else {
    let dailyButton = '';
    if (daily) {
      dailyButton = checkAllowed
        ? `<div class="daily-action"><button class="soft-button" type="button" data-action="daily" ${attrs} aria-pressed="${checked}">${icon(checked ? 'check' : 'leaf')}${checked ? '今日已打卡' : '今日打卡'}</button><small>${checked ? '今天的小进展，记下了' : '推进一点，就算进步'}</small></div>`
        : `<span class="tag">${isSelectedOtherDay ? ((task.dailyChecks || []).includes(selectedDay) ? '这一天已打卡' : '每日打卡在当天开放') : '截止日期已过，可调整计划'}</span>`;
    }
    actions = `${dailyButton || `<button class="text-button" type="button" data-action="edit" ${attrs}>${icon('edit')}编辑安排</button>`}<button class="complete-button" type="button" data-action="complete" ${attrs} ${completeAllowed ? '' : 'disabled title="当天参加后再标记完成"'}>${icon('circle')}${task.repeat === 'weekly' ? '本次已参加' : task.kind === 'event' ? '已参加' : '整件事完成'}</button>`;
  }
  return `<article class="task-card ${daily && !done ? 'featured' : ''} ${done ? 'completed-card' : ''}"><div class="task-topline"><span class="tag"><i class="category-dot ${escapeHTML(task.category)}"></i>${categoryNames[task.category] || '生活杂事'} · ${task.kind === 'event' ? '日程' : '待办'}</span><span class="due-label ${task.kind === 'task' && task.date < today ? 'overdue' : ''}">${done ? '已完成' : dueLabel(task, day)}</span></div><div class="task-main"><button type="button" class="task-title-button" data-action="edit" ${attrs}>${escapeHTML(task.title)}</button><button type="button" class="icon-button" data-action="edit" ${attrs} aria-label="编辑${escapeHTML(task.title)}">${icon('edit')}</button></div><div class="task-meta">${meta}</div>${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ''}<div class="task-actions">${actions}</div></article>`;
}
function renderTasks() {
  let entries;
  let title;
  if (view === 'done') {
    entries = completedEntries(); title = '已经做好的事';
  } else {
    let tasks = activeTasks().filter(t => !t.completed);
    if (view === 'today') { tasks = todayTasks(); title = '今天，慢慢推进'; }
    else if (view === 'schedule') { tasks = dayItems(tasks, selectedDay); title = `${dateLabel(selectedDay)} · ${weekday(selectedDay)}`; }
    else if (categoryNames[view]) { tasks = tasks.filter(t => t.category === view); title = categoryNames[view]; }
    else title = '所有事，都放在这里';
    entries = tasks.map(task => ({ task, day: view === 'schedule' ? selectedDay : nextOccurrence(task, today) || today }));
    entries.sort((a, b) => Number(!a.task.date) - Number(!b.task.date) || a.day.localeCompare(b.day) || (a.task.start || '').localeCompare(b.task.start || ''));
  }
  $('#view-title').textContent = title;
  $('#view-count').textContent = `${entries.length} 件`;
  $('#back-today').hidden = view === 'today';
  const emptyCopy = view === 'done' ? ['慢慢积累就好', '完成的事项会收在这里，也可以恢复。'] : view === 'schedule' ? ['这一天，还留着空白', '可以安排一点事情，也可以留给自己。'] : view === 'today' ? ['今天的安排已经妥当', '有新的事情，随时记在上面。'] : ['这里还没有事项', '先记下一件小事吧。'];
  $('#task-list').innerHTML = entries.length ? entries.map(card).join('') : `<div class="empty-state">${icon('leaf')}<h3>${emptyCopy[0]}</h3><p>${emptyCopy[1]}</p></div>`;
  const checked = activeTasks().filter(t => (t.dailyChecks || []).includes(today)).length;
  $('#greeting-copy').textContent = checked ? '今天已经往前走了一小步，很好。' : '把事情放在这里，把心思留给当下。';
  renderUpcoming();
}
function renderUpcoming() {
  const section = $('#upcoming-section');
  section.hidden = view !== 'today';
  if (section.hidden) return;
  const current = new Set(todayTasks().map(t => t.id));
  const upcoming = activeTasks().filter(t => !t.completed && !current.has(t.id)).map(task => ({ task, day: nextOccurrence(task, today) }));
  upcoming.sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999'));
  section.innerHTML = `<div class="section-heading"><h2 id="upcoming-title">接下来</h2><span>提前记着，就好</span></div>${upcoming.slice(0, 4).map(({ task, day }) => `<button type="button" class="upcoming-row" data-action="edit" data-id="${escapeHTML(task.id)}"><span class="date-block"><strong>${day ? day.slice(8) : '—'}</strong><small>${day ? `${Number(day.slice(5, 7))}月 · ${weekday(day)}` : '待定'}</small></span><span class="upcoming-content"><span class="upcoming-title">${escapeHTML(task.title)}</span><span class="upcoming-meta">${day ? `${task.start || (task.kind === 'task' ? '当天截止' : '时间待补充')}${task.end ? `–${task.end}` : ''}${task.repeat === 'weekly' ? ` · 每${weekday(task.date)}` : ''}` : '日期待补充'} · ${categoryNames[task.category] || '生活杂事'}</span></span>${icon('arrow')}</button>`).join('')}${!upcoming.length ? '<p class="trash-empty">暂时没有其他安排，留一点空白也很好。</p>' : ''}`;
}
function renderCalendar() {
  const [year, monthNumber] = month.split('-').map(Number);
  $('#month-label').innerHTML = `${['一','二','三','四','五','六','七','八','九','十','十一','十二'][monthNumber - 1]}月<small>${year}</small>`;
  $('#calendar-days').innerHTML = monthDays(month).map(day => {
    if (!day) return '<span></span>';
    const scheduled = activeTasks().filter(t => !isDone(t, day) && occursOn(t, day));
    const deadline = scheduled.some(t => t.kind === 'task');
    const event = scheduled.some(t => t.kind === 'event');
    return `<button type="button" class="calendar-day ${today === day ? 'is-today' : ''} ${deadline ? 'has-deadline' : ''}" data-action="select-day" data-day="${day}" aria-pressed="${selectedDay === day}" ${today === day ? 'aria-current="date"' : ''} aria-label="${dateLabel(day, true)} ${weekday(day)}${deadline ? '，有截止事项' : ''}${event ? '，有日程' : ''}">${Number(day.slice(8))}<span class="dots">${deadline ? '<i class="deadline-dot"></i>' : ''}${event ? '<i></i>' : ''}</span></button>`;
  }).join('');
  const selected = dayItems(activeTasks(), selectedDay);
  const journalCount = data.journal.filter(entry => !entry.deleted && entry.date === selectedDay).length;
  $('#selected-summary').innerHTML = `${dateLabel(selectedDay)} · ${weekday(selectedDay)}<p>${view === 'journal' ? (journalCount ? `${journalCount} 篇随笔，记录了这一天。` : '这一天，还可以留下一点文字。') : selected.length ? `${selected.length} 件安排${selected.some(t => dailyApplies(t, selectedDay)) ? '，含每日推进' : ''}` : '暂无安排，留一点自己的时间。'}</p>`;
  const deadlines = activeTasks().filter(t => !t.completed && t.kind === 'task' && t.date).sort((a, b) => a.date.localeCompare(b.date));
  const nearest = deadlines[0];
  if (nearest) {
    const days = daysBetween(today, nearest.date);
    $('#deadline-panel').innerHTML = `<div class="mini-label">${days < 0 ? '记得重新安排' : '下一个截止'}</div><div class="deadline-number"><strong>${days === 0 ? '今天' : Math.abs(days)}</strong><span>${days < 0 ? '天前到期' : days === 0 ? '截止' : '天后'}</span></div><button type="button" class="deadline-title" data-action="edit" data-id="${escapeHTML(nearest.id)}">${escapeHTML(nearest.title)}</button><p class="deadline-date">${dateLabel(nearest.date)} · ${weekday(nearest.date)}</p>`;
  } else $('#deadline-panel').innerHTML = '<div class="mini-label">下一个截止</div><div class="deadline-number"><strong>—</strong></div><p class="deadline-title">暂时没有待办截止</p><p class="deadline-date">可以稍稍松一口气。</p>';
}
function renderTrash() {
  const trash = data.tasks.filter(t => t.deleted);
  $('#trash-list').innerHTML = trash.length ? trash.map(t => `<div class="trash-row"><span>${escapeHTML(t.title)}</span><button type="button" class="text-button" data-action="restore-trash" data-id="${escapeHTML(t.id)}">恢复</button></div>`).join('') : data.journal.some(entry => entry.deleted) ? '' : '<p class="trash-empty">回收站是空的。</p>';
}
function render() {
  const focused = document.activeElement;
  const focusKey = focused?.dataset?.action ? { action: focused.dataset.action, id: focused.dataset.id, day: focused.dataset.day } : null;
  $('#date-line').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric', timeZone: 'Asia/Taipei' }).format(new Date()).toUpperCase();
  const writing = view === 'journal';
  $('#journal-view').hidden = !writing;
  $('#quick-form').hidden = writing;
  $('.content-heading').hidden = writing;
  $('#task-list').hidden = writing;
  $('h1').innerHTML = writing ? '留一点字，<br>给今天。' : '一件一件，<br>慢慢来。';
  renderNav();
  if (!writing) renderTasks();
  else { $('#upcoming-section').hidden = true; $('#greeting-copy').textContent = '不必写得很好，这里只属于你。'; journal?.render(); }
  renderJournalInvitation(); renderCalendar(); renderTrash(); storageStatus();
  if (focusKey && !document.contains(focused)) {
    const same = [...document.querySelectorAll('[data-action]')].find(el => el.dataset.action === focusKey.action && el.dataset.id === focusKey.id && el.dataset.day === focusKey.day);
    (same || $('#main-content')).focus({ preventScroll: true });
  }
}
function renderJournalInvitation() {
  $('#journal-invitation').hidden = view !== 'today';
  const written = data.journal.some(entry => !entry.deleted && entry.date === today);
  $('#journal-invitation').innerHTML = `<div><h2>给今天留一点字</h2><p>${written ? '想起来什么，就接着写一点。' : '感想、灵感，或一件很小的开心事。'}</p></div><button type="button" class="soft-button" data-action="journal">${icon('book')}${written ? '接着写' : '随手记'}</button>`;
}
function goToday() { view = 'today'; selectedDay = today; month = today.slice(0, 7); render(); }

const editor = $('#editor');
const form = $('#editor-form');
const field = name => form.elements.namedItem(name);
function adjustEditor() {
  const event = field('kind').value === 'event';
  $('#event-fields').hidden = !event;
  $('#repeat-field').hidden = !event;
  $('#daily-fields').hidden = event;
  $('#reminder-hint').hidden = event || !field('dailyEnabled').checked;
  $('#date-field-label').textContent = event ? '开始日期（可留空）' : '截止日期（可留空）';
  $('#series-hint').hidden = !event || field('repeat').value !== 'weekly';
  field('dailyTime').disabled = event || !field('dailyEnabled').checked;
  field('dailyTime').required = !event && field('dailyEnabled').checked;
}
function openEditor(id) {
  const task = id ? taskById(id) : null;
  form.reset();
  $('#editor-title').textContent = task ? '把安排理一理' : '记下一件事';
  $('#editor-error').hidden = true;
  $('#archive-button').hidden = !task;
  const values = task || { id: '', title: '', kind: 'task', category: categoryNames[view] ? view : 'course', date: view === 'schedule' ? selectedDay : '', repeat: 'none', dailyTime: '19:30' };
  for (const name of ['id','title','kind','category','date','repeat','start','end','location','dailyTime','notes']) field(name).value = values[name] || '';
  field('dailyEnabled').checked = !!values.dailyEnabled;
  adjustEditor();
  editor.showModal();
  field('title').focus();
}
form.addEventListener('change', adjustEditor);
form.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const eventTask = values.kind === 'event';
  const error = !values.title.trim() ? '给这件事起个名字吧。' : eventTask && values.repeat === 'weekly' && !values.date ? '重复日程需要一个开始日期。' : eventTask && values.end && !values.start ? '请先填写开始时间。' : eventTask && values.start && values.end && values.end <= values.start ? '结束时间需要晚于开始时间；跨天日程暂不支持。' : '';
  if (error) { $('#editor-error').textContent = error; $('#editor-error').hidden = false; return; }
  const existing = values.id ? taskById(values.id) : null;
  const task = {
    ...existing, id: existing?.id || crypto.randomUUID(), title: values.title.trim(), kind: values.kind, category: values.category,
    date: values.date || '', repeat: eventTask ? values.repeat : 'none', start: eventTask ? values.start : '', end: eventTask ? values.end : '',
    location: eventTask ? values.location.trim() : '', notes: values.notes.trim(), dailyEnabled: !eventTask && field('dailyEnabled').checked,
    dailyTime: values.dailyTime || existing?.dailyTime || '19:30', dailyChecks: existing?.dailyChecks || [], doneOccurrences: existing?.doneOccurrences || [],
    completed: existing?.completed || false, deleted: false, createdDate: existing?.createdDate || today,
  };
  if (existing) data.tasks[data.tasks.findIndex(t => t.id === task.id)] = task;
  else data.tasks.push(task);
  save(); editor.close();
  if (!existing) view = 'all';
  render(); toast(existing ? '安排已经更新' : '记下了，不用一直惦记着');
});
$('#quick-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#quick-title');
  const title = input.value.trim();
  if (!title) { input.value = ''; input.focus(); return; }
  const id = crypto.randomUUID();
  data.tasks.push({ id, title, kind: 'task', category: categoryNames[view] ? view : 'other', date: '', repeat: 'none', dailyEnabled: false, dailyTime: '19:30', dailyChecks: [], doneOccurrences: [], completed: false, deleted: false, createdDate: today, notes: '', location: '', start: '', end: '' });
  input.value = ''; view = 'all'; save(); render(); toast('已记下 · 点标题可以补充日期和提醒');
  input.focus();
});

function checkIn(id) {
  const task = taskById(id);
  if (!task || task.deleted || !dailyApplies(task, today)) return;
  const next = toggleDaily(task, today);
  updateTask(id, { dailyChecks: next.dailyChecks });
  const checked = next.dailyChecks.includes(today);
  if (checked) { celebrate('这一步，也很了不起。'); toast('今日已打卡，整件事仍在进行中'); }
  else toast('已撤回今天的打卡');
}
function finish(id, day) {
  const task = taskById(id);
  if (!task || task.deleted || (task.repeat === 'weekly' && (day > today || !occursOn(task, day)))) return;
  const before = { completed: task.completed, completedAt: task.completedAt, doneOccurrences: [...(task.doneOccurrences || [])] };
  updateTask(id, completeTask(task, task.repeat === 'weekly' ? day : today));
  closeReminder(false);
  celebrate('又做好了一件事！');
  toast(task.repeat === 'weekly' ? '本次已完成，下周的安排还在' : '整件事已完成，收进「已完成」了', () => { updateTask(id, before); toast('已恢复为未完成'); });
}
function restoreDone(id, day) {
  const task = taskById(id);
  if (!task) return;
  updateTask(id, task.repeat === 'weekly' ? { doneOccurrences: (task.doneOccurrences || []).filter(d => d !== day) } : { completed: false, completedAt: null });
  toast('已恢复，可以接着安排');
}
function previewReminder(id) {
  const task = id ? taskById(id) : activeTasks().find(t => dailyApplies(t, today) && !(t.dailyChecks || []).includes(today));
  if (!task || task.deleted || task.completed || !dailyApplies(task, today) || (task.dailyChecks || []).includes(today)) { toast('今天没有待打卡的每日事项'); return; }
  reminderId = task.id;
  reminderContext = { type: 'daily', day: todayISO() };
  notificationOpener = document.activeElement;
  $('#notification').innerHTML = `<div class="notification-top"><span class="cat mini-cat" aria-hidden="true"></span>拾序 · 提醒预览<button class="icon-button" type="button" data-action="dismiss-reminder" aria-label="关闭提醒">${icon('close')}</button></div><h3>${escapeHTML(task.title)}</h3><p>到了留给它的一点时间。今天推进一点就好。</p><div class="notification-actions"><button type="button" class="soft-button" data-action="reminder-daily">${icon('check')}今日打卡</button><button type="button" class="secondary-button" data-action="snooze">10 分钟后提醒</button></div><small>仅在此页面演示；关闭或刷新页面后不再提醒。</small>`;
  if (desktop) $('#notification > small').textContent = '保持拾序在托盘运行，即可继续收到系统提醒。';
  $('#notification').hidden = false;
  $('#notification').querySelector('button').focus({ preventScroll: true });
}
function closeReminder(restoreFocus = true) {
  $('#notification').hidden = true;
  if (restoreFocus && notificationOpener?.isConnected) notificationOpener.focus({ preventScroll: true });
}
async function exportData() {
  journal?.flush();
  if (desktop) {
    const result = await desktop.exportData(data);
    if (!result.ok) toast(result.error);
    else if (!result.cancelled) toast('备份已导出');
    return;
  }
  const link = $('#backup-download');
  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(unreadableBackup || JSON.stringify(data, null, 2))}`;
  link.download = `拾序备份-${today}.json`;
  $('#backup-dialog').showModal();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button, .brand');
  if (!button) return;
  if (button.matches('.brand')) { event.preventDefault(); goToday(); return; }
  if (button.dataset.close) { document.getElementById(button.dataset.close).close(); return; }
  if (button.dataset.themeChoice) { data.theme = button.dataset.themeChoice; save(); applyTheme(); return; }
  if (button.dataset.view) { view = button.dataset.view; if (view === 'journal') journal.openDay(); if (view === 'today') goToday(); else render(); return; }
  const { action, id, day } = button.dataset;
  switch (action) {
    case 'new': openEditor(); break;
    case 'journal': view = 'journal'; journal.openDay(); render(); $('#journal-body').focus(); break;
    case 'edit': openEditor(id); break;
    case 'daily': checkIn(id); break;
    case 'complete': finish(id, day || today); break;
    case 'restore-done': restoreDone(id, day); break;
    case 'cat': celebrate('喵，今天也陪着你。'); break;
    case 'settings': renderTrash(); journal.render(); $('#settings').showModal(); break;
    case 'today': goToday(); break;
    case 'select-day': selectedDay = day; if (view === 'journal') journal.openDay(day); else view = 'schedule'; render(); break;
    case 'prev-month': month = changeMonth(month, -1); renderCalendar(); break;
    case 'next-month': month = changeMonth(month, 1); renderCalendar(); break;
    case 'archive': {
      const taskId = field('id').value;
      editor.close(); updateTask(taskId, { deleted: true });
      toast('已移到回收站', () => { updateTask(taskId, { deleted: false }); toast('事项已找回来'); });
      break;
    }
    case 'restore-trash': updateTask(id, { deleted: false }); toast('事项已恢复到原来的分类'); break;
    case 'export': exportData(); break;
    case 'import': importData(); break;
    case 'data-folder': desktop?.showDataFolder().then(result => { if (!result.ok) toast(result.error); }); break;
    case 'test-notification': desktop?.testNotification().then(result => toast(result.ok ? '已请求系统通知，请查看 Windows 通知区' : result.error)); break;
    case 'window-minimize': desktop?.minimize(); break;
    case 'window-maximize': desktop?.maximize(); break;
    case 'window-close': desktop?.close(); break;
    case 'quit': desktop?.quit(); break;
    case 'reminder-open': closeReminder(); if (!editor.open) openEditor(reminderId); break;
    case 'dismiss-toast': hideToast(); break;
    case 'preview-reminder': previewReminder(); break;
    case 'dismiss-reminder': closeReminder(); break;
    case 'reminder-daily': checkIn(reminderId); closeReminder(); break;
    case 'snooze': {
      const target = reminderId;
      closeReminder(); clearTimeout(snoozeTimer);
      if (desktop) desktop.snooze({ id: target, ...reminderContext }).then(result => toast(result.ok ? '10 分钟后再提醒，留在托盘即可' : result.error));
      else {
        snoozeTimer = setTimeout(() => previewReminder(target), 10 * 60 * 1000);
        toast('10 分钟后在此页再提醒，请保持页面打开');
      }
      break;
    }
  }
});
$('#theme-select').addEventListener('change', event => { data.theme = event.target.value; save(); applyTheme(); });
media.addEventListener('change', () => { if (data.theme === 'system') applyTheme(); });
document.addEventListener('keydown', event => {
  if (event.altKey && event.key.toLowerCase() === 'n' && !document.querySelector('dialog[open]')) { event.preventDefault(); openEditor(); }
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { closeReminder(); hideToast(); }
});
// Keep date-based check-ins correct if the page stays open overnight.
function checkDate() {
  const now = todayISO();
  if (now === today) return;
  const followingToday = selectedDay === today;
  today = now;
  if (followingToday) { selectedDay = now; month = now.slice(0, 7); }
  render();
}
setInterval(checkDate, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDate(); });
window.addEventListener('storage', event => {
  if (desktop) return;
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const incoming = JSON.parse(event.newValue);
    if (journal?.dirty) { toast('另一窗口更新了记录，请先保存当前文字'); return; }
    data = validateData(incoming); journal?.refresh(); weather?.reset(); render(); applyTheme();
  } catch { /* Keep the current data if another tab writes invalid storage. */ }
});
async function importData() {
  if (!desktop) return;
  const result = await desktop.importData();
  if (!result.ok) { toast(result.error); return; }
  if (result.cancelled) return;
  data = result.data; view = 'all'; journal.refresh(); weather.reset(); render(); applyTheme();
  toast(`已导入 ${result.added} 件事项、${result.journalAdded || 0} 篇随笔，原有记录已保留`);
}
function renderDesktopPreferences() {
  document.querySelectorAll('[data-preference]').forEach(input => { input.checked = !!desktopState.preferences[input.dataset.preference]; });
}
if (desktop && desktopState?.ok) {
  document.documentElement.classList.add('desktop');
  $('.preview-label').textContent = `v${desktopState.info.version}`;
  $('.window-controls').hidden = false;
  $('#preview-settings').hidden = true;
  $('#desktop-settings').hidden = false;
  $('#import-button').hidden = false;
  $('.desktop-data-actions').hidden = false;
  $('#storage-title').textContent = '数据保存在这台电脑';
  $('#storage-copy').textContent = '每次保存会保留上一份备份，也能导入网页预览导出的记录。';
  $('#reminder-hint').textContent = '每日按设定时间发送系统通知，关闭主窗口后也能在托盘继续提醒。';
  $('.reminder-note small').textContent = '系统通知 · 托盘后台守候';
  renderDesktopPreferences();
  document.querySelectorAll('[data-preference]').forEach(input => input.addEventListener('change', async () => {
    input.disabled = true;
    try {
      const result = await desktop.preferences({ [input.dataset.preference]: input.checked });
      if (result.ok) { desktopState.preferences = result.preferences; toast('设置已保存'); }
      else toast(result.error);
    } catch { toast('设置未能保存，请重试'); }
    finally { input.disabled = false; renderDesktopPreferences(); }
  }));
  desktop.onReminder(reminder => {
    const task = taskById(reminder.taskId);
    if (!task || task.deleted || task.completed) return;
    reminderId = task.id;
    reminderContext = { type: reminder.type, day: reminder.day };
    notificationOpener = document.activeElement;
    $('#notification').innerHTML = `<div class="notification-top"><span class="cat mini-cat" aria-hidden="true"></span>拾序 · 小提醒<button type="button" class="icon-button" data-action="dismiss-reminder" aria-label="关闭提醒">${icon('close')}</button></div><h3>${escapeHTML(task.title)}</h3><p>${escapeHTML(reminder.body)}</p><div class="notification-actions"><button type="button" class="soft-button" data-action="${reminder.type === 'daily' ? 'reminder-daily' : 'reminder-open'}">${reminder.type === 'daily' ? '今日打卡' : '查看安排'}</button><button type="button" class="secondary-button" data-action="snooze">10 分钟后提醒</button></div>`;
    $('#notification').hidden = false;
  });
}
journal = initJournal({ getData: () => data, save, toast, escapeHTML, onChange: () => { renderJournalInvitation(); renderCalendar(); renderTrash(); } });
weather = initWeather({ getData: () => data, save, desktop, escapeHTML, toast });
render(); applyTheme();
if (!storageError) save();
if (desktopState?.notice) toast(desktopState.notice);
desktop?.ready();
