const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const externalPayload = {
  exportDate: '2099-01-02',
  metadata: { brandsIncluded: ['Test Brand'] },
  dailyFacts: [
    { date: '2099-01-02', brands: { 'Test Brand': { sales: 7, traffic: 11 } } },
  ],
};

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return body; },
  };
}

function request(server, method, path) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ hostname: '127.0.0.1', port: address.port, method, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

let app;
let server;
let upstreamAvailable = true;
const fallbackPath = path.join(__dirname, '..', 'data', 'daily_facts.json');
const originalFallback = fs.readFileSync(fallbackPath, 'utf8');

function withFallbackContents(contents, callback) {
  fs.writeFileSync(fallbackPath, contents);
  return Promise.resolve().then(callback).finally(() => {
    fs.writeFileSync(fallbackPath, originalFallback);
  });
}

test.before(async () => {
  process.env.DATA_SOURCE_URL = 'https://test.invalid/daily_facts.json';
  global.fetch = async () => upstreamAvailable
    ? jsonResponse(externalPayload)
    : jsonResponse({ error: 'upstream unavailable' }, false, 503);
  app = require('../api/index.js');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('GET /api/data returns validated external data when upstream is available', { concurrency: false }, async () => {
  upstreamAvailable = true;
  const response = await request(server, 'GET', '/api/data?refresh=true');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, externalPayload);
  assert.ok(Array.isArray(response.body.dailyFacts));
});

test('GET /api/data returns local fallback when upstream is unavailable', { concurrency: false }, async () => {
  upstreamAvailable = false;
  const response = await request(server, 'GET', '/api/data?refresh=true');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.dailyFacts));
  assert.notEqual(response.body.exportDate, externalPayload.exportDate);
});

test('GET /api/data returns 502 when local fallback is invalid JSON', { concurrency: false }, async () => {
  upstreamAvailable = false;
  const response = await withFallbackContents('{ invalid json', () => request(server, 'GET', '/api/data?refresh=true'));
  assert.equal(response.status, 502);
  assert.deepEqual(response.body, { error: 'Не удалось получить данные из внешнего источника' });
});

test('GET /api/data returns 502 when local fallback has no dailyFacts', { concurrency: false }, async () => {
  upstreamAvailable = false;
  const response = await withFallbackContents(JSON.stringify({ exportDate: '2099-01-02' }), () => request(server, 'GET', '/api/data?refresh=true'));
  assert.equal(response.status, 502);
  assert.deepEqual(response.body, { error: 'Не удалось получить данные из внешнего источника' });
});

test('POST /api/refresh-data force-refreshes and reports upstream metadata', { concurrency: false }, async () => {
  upstreamAvailable = true;
  const response = await request(server, 'POST', '/api/refresh-data');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.records, externalPayload.dailyFacts.length);
  assert.equal(response.body.exportDate, externalPayload.exportDate);
  assert.match(response.body.source, /test\.invalid/);
});
