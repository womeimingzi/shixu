import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StateStore } from '../desktop/store.mjs';
import { validateData, mergeData } from '../src/data.mjs';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw Error('Usage: node tools/migrate-preview.mjs backup.json data-directory');
const data = validateData(JSON.parse(fs.readFileSync(source, 'utf8')));
const existing = fs.existsSync(path.join(destination, 'state.json')) || fs.existsSync(path.join(destination, 'state.backup.json'));
const store = new StateStore(destination);
const migrated = existing ? mergeData(store.state.data, data, randomUUID).data : data;
store.saveData(migrated);
fs.copyFileSync(source, path.join(destination, `preview-import-${Date.now()}.json`));
console.log(JSON.stringify({ migrated: data.tasks.length, total: migrated.tasks.length, theme: migrated.theme, destination: store.file }));
