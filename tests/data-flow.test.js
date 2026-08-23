const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
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

test('GET /api/data returns validated external data when upstream is available', async () => {
  upstreamAvailable = true;
  const response = await request(server, 'GET', '/api/data?refresh=true');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, externalPayload);
  assert.ok(Array.isArray(response.body.dailyFacts));
});

test('GET /api/data returns local fallback when upstream is unavailable', async () => {
  upstreamAvailable = false;
  const response = await request(server, 'GET', '/api/data?refresh=true');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.dailyFacts));
  assert.notEqual(response.body.exportDate, externalPayload.exportDate);
});

test('POST /api/refresh-data force-refreshes and reports upstream metadata', async () => {
  upstreamAvailable = true;
  const response = await request(server, 'POST', '/api/refresh-data');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.records, externalPayload.dailyFacts.length);
  assert.equal(response.body.exportDate, externalPayload.exportDate);
  assert.match(response.body.source, /test\.invalid/);
});

test('DataService reloads client state from /api/data after refresh', async () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'data-service.js'), 'utf8');
  const requests = [];
  const storage = new Map();
  const clientPayload = {
    metadata: { brandsIncluded: ['Test Brand'] },
    dailyFacts: [{ date: '2099-01-03', brands: { 'Test Brand': { sales: 9 } } }],
  };
  const context = {
    window: {},
    console,
    JSON,
    Date,
    fetch: async (url) => {
      requests.push(url);
      return jsonResponse(clientPayload);
    },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    DashboardUtils: {
      validateJsonStructure: () => ({ valid: true }),
      extractBrandsFromJson: (data) => data.metadata.brandsIncluded,
      generateBrandMapping: (brands) => Object.fromEntries(brands.map((brand) => [brand, brand])),
      getLastDataDate: (data) => data.dailyFacts.at(-1).date,
      getAvailableMonthsFromJson: () => ['2099-01'],
      aggregateJsonDataByMonth: () => ({}),
    },
  };
  vm.runInNewContext(source, context, { filename: 'data-service.js' });
  const service = new context.window.DataService();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(service.getJsonData(), clientPayload);
  assert.deepEqual(service.getJsonBrands(), ['Test Brand']);
  assert.equal(requests.length, 1);
  await service.refreshJsonData();
  assert.equal(requests.length, 2);
});

test('DashboardCore refresh reloads data and moves range to the latest date', async () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/core/dashboard-core.js'), 'utf8');
  const context = { window: {}, console, document: {}, fetch: null, confirm: () => true };
  source = source.replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(source, context, { filename: 'dashboard-core.js' });
  const calls = [];
  const freshData = { metadata: { brandsIncluded: ['Test Brand'] }, dailyFacts: [{ date: '2099-01-04' }] };
  context.fetch = async (url, options) => {
    calls.push([url, options?.method || 'GET']);
    return url === '/api/refresh-data'
      ? jsonResponse({ success: true, records: 1 })
      : jsonResponse(freshData);
  };
  const rangeStart = { value: '2099-01-01' };
  const rangeEnd = { value: '2099-01-01' };
  const core = Object.create(context.window.DashboardCore.prototype);
  core.uiManager = { showNotification: () => {} };
  core.dataService = { processJsonData: (data) => calls.push(['processJsonData', data]) };
  core.dataManager = {
    getJsonBrandMapping: () => ({}),
    getLastDataDate: () => '2099-01-04',
  };
  core.elements = { rangeStart, rangeEnd };
  core.updateAvailableDates = () => calls.push(['updateAvailableDates']);
  core.updateBrandsFromJson = () => calls.push(['updateBrandsFromJson']);
  core.loadDataForRange = () => calls.push(['loadDataForRange']);
  await core.refreshDataFromServer(true);
  assert.deepEqual(calls.slice(0, 2), [['/api/refresh-data', 'POST'], ['/api/data', 'GET']]);
  assert.deepEqual(rangeStart.value, '2099-01-04');
  assert.deepEqual(rangeEnd.value, '2099-01-04');
  assert.deepEqual(core.jsonData, freshData);
});
