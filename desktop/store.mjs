import fs from 'node:fs';
import path from 'node:path';
import { initialData, todayISO } from '../src/schedule.mjs';
import { validateData } from '../src/data.mjs';

export class StateStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'state.json');
    this.backup = path.join(directory, 'state.backup.json');
    this.notice = '';
    fs.mkdirSync(directory, { recursive: true });
    const fresh = { format: 1, data: initialData(todayISO()), preferences: { autoStart: false, closeToTray: true, notifications: true }, ledger: {}, snoozes: [] };
    if (!fs.existsSync(this.file) && !fs.existsSync(this.backup)) { this.state = fresh; this.commit(fresh); return; }
    let raw;
    try { raw = this.read(this.file); }
    catch {
      try { raw = this.read(this.backup); }
      catch { throw Error('日程文件暂时无法读取。原文件已保留，请先备份数据目录后再处理，避免丢失记录。'); }
      this.notice = '上次保存的文件异常，已恢复上一份自动备份。';
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, path.join(directory, `state-unreadable-${Date.now()}.json`));
      // Remove the unreadable original from the backup rotation without deleting it.
      fs.writeFileSync(this.file, JSON.stringify(raw), { encoding: 'utf8', flush: true });
    }
    this.state = raw;
  }
  read(file) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (value.format !== 1 || !value.preferences || !value.ledger || !Array.isArray(value.snoozes)) throw Error('Unsupported state');
    return { ...value, data: validateData(value.data) };
  }
  commit(next) {
    const output = JSON.stringify(next, null, 2);
    if (Buffer.byteLength(output) > 16 * 1024 * 1024) throw Error('记录超过容量限制，请先导出备份。');
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, output, { encoding: 'utf8', flush: true });
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.backup);
    fs.renameSync(temp, this.file);
    this.state = next;
  }
  saveData(data) { this.commit({ ...this.state, data: validateData(data) }); }
  patch(changes) { this.commit({ ...this.state, ...changes }); }
}
