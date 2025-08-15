#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const COLLECTIONS = path.join(DATA_DIR, 'collections.json');
const MEDIA_INDEX = path.join(DATA_DIR, 'media-index.json');
const BACKUP_BASE = path.join(DATA_DIR, 'local_backups');
const LOG_FILE = path.join(DATA_DIR, 'merge.log');

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function snapshot() {
  const dir = path.join(BACKUP_BASE, timestamp());
  fs.mkdirSync(dir, {recursive: true});
  [COLLECTIONS, MEDIA_INDEX].forEach(f => {
    if (fs.existsSync(f)) {
      fs.copyFileSync(f, path.join(dir, path.basename(f)));
    }
  });
  return dir;
}

function mergeArrays(existing, incoming, type, conflictDir, conflicts) {
  const map = new Map(existing.map(item => [item.id, item]));
  for (const item of incoming) {
    if (!item.id) {
      continue;
    }
    if (map.has(item.id)) {
      const current = map.get(item.id);
      if (JSON.stringify(current) !== JSON.stringify(item)) {
        const conflictFile = path.join(conflictDir, `${type}_${item.id}_conflictCopy.json`);
        fs.writeFileSync(conflictFile, JSON.stringify(current, null, 2));
        conflicts.push(`${type}:${item.id} -> ${conflictFile}`);
      }
    }
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function validate(data) {
  for (const arr of Object.values(data)) {
    arr.forEach(obj => {
      if (!Object.prototype.hasOwnProperty.call(obj, 'id')) {
        throw new Error('Validation failed: missing id');
      }
    });
  }
}

function diff(existing, incoming) {
  const diff = {};
  for (const [key, arr] of Object.entries(incoming)) {
    const existingMap = new Map(existing[key].map(i => [i.id, i]));
    const incomingMap = new Map(arr.map(i => [i.id, i]));
    const added = [];
    const removed = [];
    const updated = [];
    for (const [id, item] of incomingMap.entries()) {
      if (!existingMap.has(id)) {
        added.push(item);
      } else if (JSON.stringify(existingMap.get(id)) !== JSON.stringify(item)) {
        updated.push({before: existingMap.get(id), after: item});
      }
    }
    for (const [id, item] of existingMap.entries()) {
      if (!incomingMap.has(id)) {
        removed.push(item);
      }
    }
    diff[key] = {added, removed, updated};
  }
  return diff;
}

function rebuildIndices() {
  console.log('Rebuilding search index...');
  console.log('Rebuilding text index...');
}

function preview(newData) {
  const existing = {
    collections: readJson(COLLECTIONS),
    media: readJson(MEDIA_INDEX)
  };
  validate(newData);
  console.log(JSON.stringify(diff(existing, newData), null, 2));
}

function overwrite(newData) {
  snapshot();
  writeJson(COLLECTIONS, newData.collections);
  writeJson(MEDIA_INDEX, newData.media);
  rebuildIndices();
}

function merge(newData) {
  const conflicts = [];
  const backupDir = snapshot();
  const conflictDir = path.join(backupDir, 'conflicts');
  fs.mkdirSync(conflictDir, {recursive: true});
  const mergedCollections = mergeArrays(readJson(COLLECTIONS), newData.collections, 'collections', conflictDir, conflicts);
  const mergedMedia = mergeArrays(readJson(MEDIA_INDEX), newData.media, 'media', conflictDir, conflicts);
  writeJson(COLLECTIONS, mergedCollections);
  writeJson(MEDIA_INDEX, mergedMedia);
  if (conflicts.length) {
    const logTime = new Date().toISOString();
    const lines = conflicts.map(c => `${logTime} ${c}`);
    fs.appendFileSync(LOG_FILE, lines.join('\n') + '\n');
  }
  rebuildIndices();
}

function loadIncoming(dir) {
  return {
    collections: readJson(path.join(dir, 'collections.json')),
    media: readJson(path.join(dir, 'media-index.json'))
  };
}

const [,, mode, incomingDir] = process.argv;

if (!mode) {
  console.error('Usage: node data-sync.js <preview|overwrite|merge> <incomingDir>');
  process.exit(1);
}

const newData = loadIncoming(incomingDir || DATA_DIR);

if (mode === 'preview') {
  preview(newData);
} else if (mode === 'overwrite') {
  overwrite(newData);
} else if (mode === 'merge') {
  merge(newData);
} else {
  console.error('Unknown mode', mode);
  process.exit(1);
}
