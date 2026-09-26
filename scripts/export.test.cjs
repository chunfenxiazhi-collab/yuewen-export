const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {safeName, parse, writeExport} = require('./export.cjs');
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
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
test('arguments reject mistakes and preserve quoted title data', () => {
  assert.throws(() => parse(['--out']));
  assert.throws(() => parse(['--write-back']));
  assert.equal(parse(['--title', "书名' OR 1=1 --"]).title, "书名' OR 1=1 --");
});
