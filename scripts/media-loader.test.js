const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert');
const { test } = require('node:test');
const path = require('node:path');

const scriptSrc = fs.readFileSync(path.join(__dirname, 'media-loader.js'), 'utf8');

function setup(fetchImpl) {
  const errors = [];
  const sandbox = {
    console: {
      error: (...args) => errors.push(args),
      warn: () => {},
      log: () => {},
      table: () => {}
    },
    window: {},
    document: {
      addEventListener: (evt, handler) => {
        sandbox._handler = handler;
      }
    },
    fetch: fetchImpl,
    Response,
    Headers
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox);
  return { sandbox, errors };
}

test('loadMedia logs friendly error on missing file', async () => {
  const fetchImpl = async () => new Response('', { status: 404, statusText: 'Not Found' });
  const { sandbox, errors } = setup(fetchImpl);
  await sandbox.window.mediaLoader.loadMedia();
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0][0], 'Failed to load media index');
  assert.match(errors[0][1].message, /HTTP 404/);
});

test('loadMedia logs friendly error on invalid JSON', async () => {
  const fetchImpl = async () =>
    new Response('not-json', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  const { sandbox, errors } = setup(fetchImpl);
  await sandbox.window.mediaLoader.loadMedia();
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0][0], 'Failed to load media index');
  assert.match(errors[0][1].message, /Invalid JSON/);
});

