const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {safeName, parse, writeExport, findBinding} = require('./export.cjs');

function fakeInstallation(t, versions) {
  const tempRoot = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempRoot, 'yuewen-binding-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), tempRoot);
    assert.ok(path.basename(root).startsWith('yuewen-binding-test-'));
    fs.rmSync(root, {recursive:true, force:true});
  });
  const files = {};
  for (const [version, hasBinding] of Object.entries(versions)) {
    const app = path.join(root, 'program', 'resources', 'app', `authorwrite_${version}.asar.unpacked`);
    fs.mkdirSync(app, {recursive:true});
    if (hasBinding) {
      const file = path.join(app, 'node_modules', '@journeyapps', 'sqlcipher', 'lib', 'binding', 'napi-v6-win32-x64', 'node_sqlite3.node');
      fs.mkdirSync(path.dirname(file), {recursive:true});
      fs.writeFileSync(file, 'Path-discovery fixture only; not a native module.');
      files[version] = file;
    }
  }
  return {root, files};
}

test('binding discovery chooses 5.25 over 5.20 and 5.9 numerically', t => {
  const {root, files} = fakeInstallation(t, {'5.9.0':true, '5.20.0':true, '5.25.0':true});
  assert.equal(findBinding(root), files['5.25.0']);
});

test('binding discovery falls back when the newest version has no target module', t => {
  const {root, files} = fakeInstallation(t, {'5.9.0':true, '5.20.0':true, '5.25.0':false});
  assert.equal(findBinding(root), files['5.20.0']);
});

test('binding discovery reports when no version has a compatible module', t => {
  const {root} = fakeInstallation(t, {'5.20.0':false, '5.25.0':false});
  assert.throws(() => findBinding(root), /Compatible SQLCipher binding not found/);
});
test('Windows unsafe and reserved filenames', () => {
  for (const input of ['CON', 'aux.txt', '../第1章:?', 'NUL', '']) {
    const name = safeName(input);
    assert.ok(!/[<>:"/\\|?*]/.test(name));
    assert.ok(!/^(con|aux|nul)(\.|$)/i.test(name));
  }
});
test('export preserves raw content, duplicate titles, missing fields and earlier snapshots', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuewen-export-test-'));
  try {
    const rows = [{CCID:'1', chaptertitle:'重复', content:'汉字\n&lt;正文&gt;'}, {CCID:'2', chaptertitle:'重复', chapterContentFormat:'opaque'}];
    const first = writeExport({title:'CON', CBID:'1'}, rows, dir, {});
    const second = writeExport({title:'CON', CBID:'1'}, rows, dir, {});
    assert.notEqual(first.directory, second.directory);
    const raw = JSON.parse(fs.readFileSync(path.join(first.directory,'raw.json'),'utf8'));
    assert.deepEqual(raw.chapters, rows);
    const manifest = JSON.parse(fs.readFileSync(path.join(first.directory,'manifest.json'),'utf8'));
    assert.equal(manifest.warnings.length, 1);
    assert.notEqual(manifest.chapters[0].file, manifest.chapters[1].file);
    assert.equal(fs.readFileSync(path.join(first.directory, manifest.chapters[0].file),'utf8'), rows[0].content);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('yuewen-export-test-'));
    fs.rmSync(dir, {recursive:true, force:true});
  }
});
test('arguments reject mistakes and preserve quoted title data', () => {
  assert.throws(() => parse(['--out']));
  assert.throws(() => parse(['--write-back']));
  assert.equal(parse(['--title', "书名' OR 1=1 --"]).title, "书名' OR 1=1 --");
});
