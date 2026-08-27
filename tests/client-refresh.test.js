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

test('fallback notice exposes retry action and clears it after success', { concurrency: false }, () => {
  let retryClick;
  const nodes = {
    notification: {
      style: {},
      classList: { add() {}, remove() {} },
    },
    notificationMessage: { textContent: '' },
    notificationMeta: { textContent: '', hidden: true },
    notificationRetry: {
      hidden: true,
      disabled: false,
      addEventListener: (event, handler) => {
        if (event === 'click') retryClick = handler;
      },
    },
    notificationClose: { addEventListener() {} },
  };
  const context = {
    window: {},
    console,
    Date,
    document: { getElementById: (id) => nodes[id] || null },
    localStorage: { getItem: () => null },
    setTimeout: () => 1,
    clearTimeout: () => {},
  };
  let source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'js/managers/ui-manager.js'),
    'utf8'
  );
  source = source.replace(/^export class /m, 'class ') + '\nwindow.UIManager = UIManager;';
  vm.runInNewContext(source, context, { filename: 'ui-manager.js' });

  const uiManager = new context.window.UIManager(null);
  let retryCount = 0;
  uiManager.showDataUpdate(
    { source: 'fallback', dailyFacts: [{ date: '2099-01-03' }] },
    'warning',
    () => { retryCount += 1; }
  );

  assert.equal(nodes.notificationRetry.hidden, false);
  retryClick({ currentTarget: nodes.notificationRetry });
  assert.equal(retryCount, 1);
  assert.equal(nodes.notificationRetry.disabled, true);

  uiManager.showNotification('Данные успешно обновлены', 'success');
  assert.equal(nodes.notificationRetry.hidden, true);
  assert.equal(nodes.notificationRetry.disabled, false);
});

test('DashboardCore refresh reloads data and moves range to the latest date', { concurrency: false }, async () => {
  let source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/core/dashboard-core.js'), 'utf8');
  const context = { window: {}, console, document: {}, fetch: null, confirm: () => true };
  source = source.replace(/^import[^\n]+\n/gm, '').replace(/^export class /m, 'class ');
  vm.runInNewContext(source, context, { filename: 'dashboard-core.js' });
  const calls = [];
  const notifications = [];
  const dataUpdateNotices = [];
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
  core.uiManager = {
    showNotification: (message, type) => notifications.push([message, type]),
    showDataUpdate: (data, type, retryHandler) => dataUpdateNotices.push([data, type, retryHandler]),
  };
  core.dataService = { processJsonData: (data) => calls.push(['processJsonData', data]) };
  core.dataManager = {
    getJsonBrandMapping: () => ({}),
    getLastDataDate: () => '2099-01-04',
  };
  core.elements = { rangeStart, rangeEnd };
  core.updateAvailableDates = () => calls.push(['updateAvailableDates']);
  core.updateBrandsFromJson = () => calls.push(['updateBrandsFromJson']);
  core.loadDataForRange = () => calls.push(['loadDataForRange']);

  const fallbackData = {
    metadata: { brandsIncluded: ['Test Brand'] },
    dailyFacts: [{ date: '2099-01-03' }],
    source: 'fallback',
    fallbackAt: '2099-01-04T09:30:00.000Z',
  };
  core.updateDataSourceNotice(fallbackData);
  assert.equal(dataUpdateNotices.length, 1);
  assert.equal(dataUpdateNotices[0][0], fallbackData);
  assert.equal(dataUpdateNotices[0][1], 'warning');

  const retryHandler = dataUpdateNotices[0][2];
  assert.equal(typeof retryHandler, 'function');
  const retryPromise = retryHandler();
  const duplicatePromise = core.refreshDataFromServer();
  await Promise.all([retryPromise, duplicatePromise]);
  assert.deepEqual(
    calls.filter(([url]) => url === '/api/refresh-data' || url === '/api/data'),
    [['/api/refresh-data', 'POST'], ['/api/data', 'GET']]
  );
  assert.deepEqual(rangeStart.value, '2099-01-04');
  assert.deepEqual(rangeEnd.value, '2099-01-04');
  assert.deepEqual(core.jsonData, freshData);
  assert.equal(dataUpdateNotices.at(-1)[0], freshData);
  assert.equal(dataUpdateNotices.at(-1)[1], 'success');
  assert.equal(dataUpdateNotices.at(-1)[2], null);
  assert.deepEqual(notifications.at(-1), ['Данные обновлены! Загружено 1 записей', 'success']);
});

test('DashboardCore refresh error keeps a retry action until refresh succeeds', { concurrency: false }, async () => {
  let source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/core/dashboard-core.js'), 'utf8');
  const context = { window: {}, console, document: {}, fetch: null, confirm: () => true };
  source = source.replace(/^import[^\n]+\n/gm, '').replace(/^export class /m, 'class ');
  vm.runInNewContext(source, context, { filename: 'dashboard-core.js' });

  const notifications = [];
  const dataUpdateNotices = [];
  const freshData = { metadata: { brandsIncluded: ['Test Brand'] }, dailyFacts: [{ date: '2099-01-04' }] };
  let refreshAttempts = 0;
  context.fetch = async (url) => {
    if (url === '/api/refresh-data' && refreshAttempts++ === 0) {
      return jsonResponse({ success: false, error: 'Сервер недоступен' });
    }
    return url === '/api/refresh-data'
      ? jsonResponse({ success: true, records: 1 })
      : jsonResponse(freshData);
  };

  const core = Object.create(context.window.DashboardCore.prototype);
  core.uiManager = {
    showNotification: (message, type, retryHandler) => notifications.push([message, type, retryHandler]),
    showDataUpdate: (data, type, retryHandler) => dataUpdateNotices.push([data, type, retryHandler]),
  };
  core.dataService = { processJsonData: () => {} };
  core.dataManager = {
    getJsonBrandMapping: () => ({}),
    getLastDataDate: () => '2099-01-04',
  };
  core.elements = {
    rangeStart: { value: '2099-01-01' },
    rangeEnd: { value: '2099-01-01' },
  };
  core.updateAvailableDates = () => {};
  core.updateBrandsFromJson = () => {};
  core.loadDataForRange = () => {};

  await core.refreshDataFromServer();

  const errorNotification = notifications.at(-1);
  assert.equal(errorNotification[1], 'error');
  assert.match(errorNotification[0], /Сервер недоступен/);
  assert.equal(typeof errorNotification[2], 'function');

  await errorNotification[2]();

  assert.equal(dataUpdateNotices.at(-1)[1], 'success');
  assert.equal(notifications.at(-1)[0], 'Данные обновлены! Загружено 1 записей');
  assert.equal(notifications.at(-1)[1], 'success');
  assert.equal(notifications.at(-1)[2], undefined);
});
