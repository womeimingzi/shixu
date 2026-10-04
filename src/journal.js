import { MOODS } from './data.mjs';
import { todayISO, dateLabel } from './schedule.mjs';

export function initJournal({ getData, save, toast, escapeHTML, onChange }) {
  const $ = selector => document.querySelector(selector);
  let currentId = null;
  let timer;
  let dirty = false;
  let promptIndex = 0;
  const prompts = ['今天哪一个很小的瞬间，让你想多停留一会儿？', '有什么还没想明白，但想先记下来的？', '如果给明天的自己留一句话，你会写什么？', '最近读到、听到的一句话，让你想到了什么？', '今天有没有做一件单纯因为喜欢才做的事？'];
  const entries = () => getData().journal;
  const active = () => entries().filter(entry => !entry.deleted);
  const titleOf = entry => entry.title.trim() || entry.body.trim().split('\n')[0].slice(0, 35) || '这一刻的心情';
  function status(message, error = false) { $('#journal-save-state').textContent = message; $('#journal-save-state').classList.toggle('error', error); }
  function flush() {
    clearTimeout(timer);
    if (!dirty) return true;
    const ok = save();
    if (ok) { dirty = false; status('已自动保存 · 只在本机'); }
    else status('未能保存，请先复制文字或导出备份', true);
    return ok;
  }
  function edit(entry = null, day = todayISO()) {
    if (!flush()) return;
    currentId = entry?.id || null;
    $('#journal-date').value = entry?.date || day;
    $('#journal-title').value = entry?.title || '';
    $('#journal-body').value = entry?.body || '';
    $('#journal-mood').value = entry?.mood || '';
    $('#journal-delete').hidden = !entry;
    $('#journal-prompt-copy').hidden = true;
    status(entry ? '已保存 · 随时可以接着写' : '不赶时间，写什么都可以。');
    renderHistory();
  }
  function openDay(day = todayISO()) {
    const entry = active().findLast(item => item.date === day);
    edit(entry, day);
  }
  function changed() {
    if (!$('#journal-date').validity.valid || !$('#journal-date').value) {
      $('#journal-date').value = entries().find(item => item.id === currentId)?.date || todayISO();
      toast('日期没有填完整，先保留原日期，文字会继续保存');
    }
    const entry = { id: currentId || crypto.randomUUID(), date: $('#journal-date').value, title: $('#journal-title').value,
      body: $('#journal-body').value, mood: $('#journal-mood').value, deleted: false };
    if (!currentId && !entry.title.trim() && !entry.body.trim() && !entry.mood) return;
    if (currentId) entries()[entries().findIndex(item => item.id === currentId)] = entry;
    else { entries().push(entry); currentId = entry.id; }
    dirty = true; status('正在保存…'); $('#journal-delete').hidden = false;
    clearTimeout(timer); timer = setTimeout(flush, 450);
    renderHistory(); onChange();
  }
  function renderHistory() {
    const search = $('#journal-search').value.trim().toLocaleLowerCase();
    const matches = active().filter(entry => `${entry.title}\n${entry.body}\n${MOODS[entry.mood] || ''}`.toLocaleLowerCase().includes(search)).sort((a,b) => b.date.localeCompare(a.date));
    $('#journal-history').innerHTML = matches.length ? matches.map(entry => `<button type="button" class="journal-entry" data-journal-id="${escapeHTML(entry.id)}" aria-pressed="${currentId === entry.id}"><span class="journal-entry-top"><span>${dateLabel(entry.date, true)}</span><span>${MOODS[entry.mood] || ''}</span></span><strong>${escapeHTML(titleOf(entry))}</strong><p>${escapeHTML(entry.body.slice(0, 90))}${entry.body.length > 90 ? '…' : ''}</p></button>`).join('') : `<p class="trash-empty">${search ? '还没有找到这段文字，换个词试试。' : '这里慢慢收下你的想法。第一篇，从一句话开始就好。'}</p>`;
    const trash = entries().filter(entry => entry.deleted);
    $('#journal-trash').innerHTML = trash.length ? `<p class="journal-trash-heading">随笔</p>${trash.map(entry => `<div class="trash-row"><span>${escapeHTML(titleOf(entry))}</span><button type="button" class="text-button" data-journal-restore="${escapeHTML(entry.id)}">恢复</button></div>`).join('')}` : '';
  }
  for (const id of ['journal-title', 'journal-body', 'journal-mood']) $('#' + id).addEventListener('input', changed);
  $('#journal-date').addEventListener('change', changed);
  $('#journal-view').addEventListener('focusout', flush);
  $('#journal-search').addEventListener('input', renderHistory);
  $('#journal-new').addEventListener('click', () => { edit(); $('#journal-body').focus(); });
  $('#journal-delete').addEventListener('click', () => {
    if (!currentId || !flush()) return;
    const entry = entries().find(item => item.id === currentId);
    entry.deleted = true;
    if (!save()) { entry.deleted = false; status('移除未保存，请重试', true); return; }
    edit(); onChange();
    toast('随笔已收进回收站，可以找回来', () => { entry.deleted = false; save(); renderHistory(); onChange(); });
  });
  $('#journal-prompt').addEventListener('click', () => { $('#journal-prompt-copy').textContent = prompts[promptIndex++ % prompts.length]; $('#journal-prompt-copy').hidden = false; });
  document.addEventListener('click', event => {
    const entryButton = event.target.closest('[data-journal-id]');
    if (entryButton) edit(entries().find(item => item.id === entryButton.dataset.journalId));
    const restoreButton = event.target.closest('[data-journal-restore]');
    if (restoreButton) { const entry = entries().find(item => item.id === restoreButton.dataset.journalRestore); entry.deleted = false; save(); renderHistory(); onChange(); toast('这段文字已经找回来'); }
  });
  document.addEventListener('click', event => { if (event.target.closest('button, a')) flush(); }, true);
  window.addEventListener('beforeunload', flush);
  edit();
  return { flush, openDay, render: renderHistory, refresh() { openDay(); renderHistory(); }, get dirty() { return dirty; } };
}
