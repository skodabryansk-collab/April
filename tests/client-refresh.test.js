const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const vm = require('node:vm');

function jsonResponse(body, ok = true, status = 200) { return { ok, status, async json() { return body; } }; }
test('DataService reloads client state from /api/data after refresh', { concurrency: false }, async () => {
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

test('DashboardCore refresh reloads data and moves range to the latest date', { concurrency: false }, async () => {
  let source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/core/dashboard-core.js'), 'utf8');
  const context = { window: {}, console, document: {}, fetch: null, confirm: () => true };
  source = source.replace(/^import[^\n]+\n/m, '');
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
