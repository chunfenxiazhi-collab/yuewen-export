#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const hash = (s, alg = 'sha256') => crypto.createHash(alg).update(s).digest('hex');
function safeName(s) {
  let name = String(s || '未命名').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 70);
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return name;
}
function parse(args) {
  const out = {};
  const flags = new Set(['list', 'help']);
  const values = new Set(['title', 'book-id', 'profile', 'out', 'install-dir', 'logs-dir']);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (args[i] !== '--' + key || (!flags.has(key) && !values.has(key))) throw Error('Unknown argument: ' + args[i]);
    if (flags.has(key)) out[key] = true;
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error('Missing value: ' + key); out[key] = args[++i]; }
  }
  return out;
}
function findBinding(root) {
  const app = path.join(root, 'program', 'resources', 'app');
  const versions = fs.readdirSync(app).filter(n => /^authorwrite_.*\.asar\.unpacked$/.test(n)).sort((a,b) => b.localeCompare(a, undefined, {numeric:true}));
  for (const version of versions) {
    const file = path.join(app, version, 'node_modules', '@journeyapps', 'sqlcipher', 'lib', 'binding', 'napi-v6-win32-x64', 'node_sqlite3.node');
    if (fs.existsSync(file)) return file;
  }
  throw Error('Compatible SQLCipher binding not found; specify --install-dir for the installed Windows x64 YuewenEdit directory.');
}
function collectIdentities(logDir, root) {
  const ids = new Set();
  for (const name of fs.readdirSync(logDir).filter(n => n.startsWith('browser_'))) {
    const file = path.join(logDir, name);
    if (!fs.statSync(file).isFile()) continue;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/initDataBase userId = ([^,\s]+)/g)) ids.add(match[1]);
  }
  return [...ids].map(id => ({profile: hash(id, 'md5'), key: hash(id + 'yuewen', 'md5')}))
    .filter(item => fs.existsSync(path.join(root, 'profiles', item.profile, 'chapter.db')));
}
function api(binding) {
  for (const klass of [binding.Database, binding.Statement, binding.Backup].filter(Boolean)) {
    for (const name of Object.getOwnPropertyNames(EventEmitter.prototype)) {
      if (name !== 'constructor') Object.defineProperty(klass.prototype, name, Object.getOwnPropertyDescriptor(EventEmitter.prototype, name));
    }
  }
  return {
    open: file => new Promise((resolve,reject) => { const db = new binding.Database(file, binding.OPEN_READONLY, e => e ? reject(e) : resolve(db)); }),
    exec: (db, sql) => new Promise((resolve,reject) => db.exec(sql, e => e ? reject(e) : resolve())),
    all: (db, sql, params = []) => new Promise((resolve,reject) => {
      const st = new binding.Statement(db, sql, e => {
        if (e) return reject(e);
        st.all(...params, (err, rows) => st.finalize(() => err ? reject(err) : resolve(rows)));
      });
    }),
    close: db => new Promise((resolve,reject) => db.close(e => e ? reject(e) : resolve()))
  };
}
function writeExport(book, rows, parent, source) {
  fs.mkdirSync(parent, {recursive:true});
  const directory = fs.mkdtempSync(path.join(parent, safeName(book.title) + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '-'));
  const files = [], warnings = [], merged = [];
  const write = (name, content) => {
    fs.writeFileSync(path.join(directory, name), content, {encoding:'utf8', flag:'wx'});
    files.push({name, bytes:Buffer.byteLength(content), sha256:hash(content)});
  };
  const extractedAt = new Date().toISOString();
  write('raw.json', JSON.stringify({title:book.title, bookId:book.CBID, extractedAt, source, chapters:rows}, null, 2));
  const chapters = rows.map((row, i) => {
    const text = typeof row.content === 'string' ? row.content : '';
    if (typeof row.content !== 'string') warnings.push({chapterId:row.CCID, title:row.chaptertitle, reason:'No plain-text content; original fields retained in raw.json.'});
    const name = String(i + 1).padStart(4, '0') + '-' + safeName(row.chaptertitle) + '.txt';
    write(name, text);
    merged.push(String(row.chaptertitle || '未命名章节') + '\n\n' + text);
    return {id:row.CCID, title:row.chaptertitle, sort:row.chaptersort, file:name, characters:text.length};
  });
  write('全文.txt', merged.join('\n\n\n'));
  const manifest = {title:book.title, bookId:book.CBID, extractedAt, chapterCount:rows.length, order:'CAST(chaptersort AS INTEGER), createtime, CCID (local database order; not inferred from titles)', source, chapters, warnings, files};
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), {encoding:'utf8', flag:'wx'});
  for (const file of files) if (hash(fs.readFileSync(path.join(directory, file.name))) !== file.sha256) throw Error('Export verification failed: ' + file.name);
  return {directory, title:book.title, chapters:rows.length, warnings, verifiedFiles:files.length};
}
async function main(argv) {
  const options = parse(argv);
  if (options.help) { console.log('node export.cjs --list | --title <exact title> --out <directory> | --book-id <id> --out <directory>\nOptional: --profile <profile hash> --install-dir <YuewenEdit directory> --logs-dir <authorwrite logs directory>'); return; }
  if (!options.list && ((!options.title && !options['book-id']) || !options.out)) throw Error('Export requires --title or --book-id and --out. Use --list first.');
  const root = path.resolve(options['install-dir'] || path.join(process.env.ProgramFiles || 'C:/Program Files', 'YuewenEdit'));
  const logDir = options['logs-dir'] || path.join(process.env.APPDATA || '', 'authorwrite', 'logs');
  const bindingFile = findBinding(root);
  const dbApi = api(require(bindingFile));
  const identities = collectIdentities(logDir, root).filter(x => !options.profile || x.profile === options.profile);
  if (!identities.length) throw Error('No local profiles found. Open Writer Assistant and the book first, or provide the correct installation/log directory.');
  const books = [], failures = [];
  for (const identity of identities) {
    let db;
    try {
      db = await dbApi.open(path.join(root, 'profiles', identity.profile, 'chapter.db'));
      await dbApi.exec(db, `PRAGMA key='${identity.key}'; PRAGMA query_only=ON; BEGIN;`);
      const found = await dbApi.all(db, 'SELECT CBID,title FROM BookModels');
      for (const book of found) books.push({...book, profile:identity.profile, identity});
      await dbApi.exec(db, 'COMMIT;');
    } catch (e) { failures.push({profile:identity.profile, error:e.message}); }
    finally { if (db) await dbApi.close(db); }
  }
  if (failures.length) { console.error(JSON.stringify({failures})); throw Error('Some profiles could not be read. Resolve the error or select a readable --profile; no export performed.'); }
  if (options.list) { console.log(JSON.stringify({books:books.map(({identity,...book}) => book)}, null, 2)); return; }
  const matches = books.filter(b => (!options.title || b.title === options.title) && (!options['book-id'] || String(b.CBID) === options['book-id']));
  if (matches.length !== 1) throw Error(`Expected one book, found ${matches.length}. Use --list and select --book-id and --profile to disambiguate.`);
  const book = matches[0];
  let db;
  try {
    db = await dbApi.open(path.join(root, 'profiles', book.profile, 'chapter.db'));
    await dbApi.exec(db, `PRAGMA key='${book.identity.key}'; PRAGMA query_only=ON; BEGIN;`);
    const rows = await dbApi.all(db, 'SELECT * FROM chapterModels WHERE CBID = ? AND COALESCE(isDelete,0)=0 ORDER BY CAST(chaptersort AS INTEGER),createtime,CCID', [book.CBID]);
    await dbApi.exec(db, 'COMMIT;');
    console.log(JSON.stringify(writeExport(book, rows, path.resolve(options.out), {profile:book.profile, bindingVersion:path.basename(path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(bindingFile))))))))}), null, 2));
  } finally { if (db) await dbApi.close(db); }
}
module.exports = {safeName, parse, writeExport, findBinding};
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
