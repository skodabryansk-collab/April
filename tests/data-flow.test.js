const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const externalPayload = {
  exportDate: '2099-01-02',
  metadata: { brandsIncluded: ['Test Brand'] },
  dailyFacts: [
    { date: '2099-01-02', brands: { 'Test Brand': { sales: 7, traffic: 11 } } },
  ],
};

const SNAPSHOT_METRICS = ['sales', 'traffic', 'contracts', 'revenue', 'trading'];
const SNAPSHOT_BRANDS = ['asp', 'ch', 'hc', 'hp', 'jk', 'jt', 'om', 'se'];
const EXPECTED_DAILY_FACTS_SHA256 =
  'f0c2d87a2e38db218c75ee7ddcbd2e7451dbb25f4ee45adf601b867cf3d27961';
const EXPECTED_MONTHLY_PLANS_SHA256 =
  '2fa077890bc4b1e1118bae4b1d409970b8b98c5a94e41dd30d9366c5dd68c7a8';

// Short per-date/per-brand fingerprints are only used to make a SHA mismatch actionable.
// The SHA-256 values above remain the authoritative completeness check.
const EXPECTED_DAILY_DATE_HASHES = ["e190d792","44804e6b","d16b3bcc","9402913e","5d950a70","f3c06aa8","8a4eb6c6","d7f52956","da1de741","8779374e","23b4a4ed","d9c659c5","6cddade1","697296f9","ebb49fb7","79272c53","906cca53","1ab7ca87","1e72f38a","01259d16","bbffce52","3e0c5dc7","b1f0e525","bcbc62cf","6d78a969","22114891","1191c808","f36ce0a8","27c08a46","c819b380","d7dbf440","cf5f7d57","2cd82523","57e0dca7","6bbceaf2","36950fa1","b36f9017","2324ce10","a850ba7b","1ca8a997","f44aec4f","7828b15b","3695e35c","2c1efc5a","88eaff4d","ddcf769e","4aaa62f7","905d407a","e418c0ae","f16db437","846f7376","188b5306","f9e6f902","e9ee629b","818bccaa","7cd17ac0","b7ff2454","b3e02e0d","4cc780ff","8bd8394a","bb39d6d2","e410c798","286cf8da","ece1828e","f018b329","35d62204","c7990b7b","c8837a21","07814020","8f3803c4","04982663","f6543836","52273232","b3de6425","e59056ec","71910f18","fa7c32a3","695c4a83","10268c95","345b43e9","a6af344e","6f363151","851efb79","2f6af184","1f86d827","5219f654","631e4907","1fd43784","8ddb2a9a","aa98dcf4","1bdae20a","8aeeba7d","8f865edf","08f80c0d","e82cfbcc","8ef7b56b","2a4e4304","75da5333","a305b607","26d37a42","8fce453d","79715e92","ebcad941","196b9a7c","10fe1acb","32c0c05e","9b145e21","800f3911","378faf32","cb135d29","a484a5b1","76555b01","f0790b85","6ae48521","c2c056cb","5c35c308","213b417e","1d83f52c","17a0e641","27bafcf4","9b04f970","60b3abdb","3651b4dd","e95fad4c","4ae2e3f2","57bb598c","3c43c365","f9a220b2","976d084d","622c865a","64678b29","f6c4e2f1","16ed2c00","b46f7f64","f0791b40","a9e1b630","2fd44be4","e164b568","f22867d8","1aac4bb5","950f2c89","7fb2865d","d54d96a6","5568d855","0579d134","117ed99a","84f337ca","bd79afe8","a3f1c29b","3605b099","414dc596","f3073480","2dbde50f","6266c0f1","ff0315fa","8c4f254a","baacdab1","7faedc3e","b8b4ff89","38f02307","09726592","49e19786","21fc7e56","b4f7fb95","9e1ddada","47cbe96b","fee7faa5","a4fa2242","b9a2a96f","e3b9a258","5c83b627","6221c8d6","0602a785","94748a46","f41880ac","0c2e03dc","bcb14cd1","a4abc249","fb31f07e","962b41a3","18cd0745","3e992e09","83ffc100","ef17fac1","1b1623e5","ec9e61d4","2b852569","19dccafc","1f04dfd3","b7496a99","811fa289","e3c526dd","ead97925","3d880dc5","5d18c6ac","d192d7d2","e9dda2e5","9fc3a882","b7a984c7","2de0f180","8a7a24fd","aca1f257","775b3139","69d3a219","5e0daf48","28215400","7dbc1a88","3beba135","912c02f3","f72eb215","fbc9e890","0a5da330","f4b76b2a","88d62510","98611537","1b2b5123","a7eb08cb","7e94ced5","6a257ccc","8e84ab4c","786ff149","2d021326","24347ad2","0acd3113","d71a708d","cf640aba","12e6d03c","ade0c756","51c73817","b8f3c189","8806bfa4","96ef5d05","b11abe2c","4846b110","71c75311","75a5a1cf","1581deaa"];
const EXPECTED_DAILY_BRAND_HASHES = {"asp":"95a9d5ea","ch":"c55afbc1","hc":"4237f948","hp":"0e30cb52","jk":"35d5526f","jt":"83a470fb","om":"0ac033fa","se":"02a21744"};
const EXPECTED_PLAN_HASHES = {"2026-01:asp":"c5ec245c","2026-01:ch":"c28d9a7d","2026-01:hc":"fb807442","2026-01:hp":"45cbdfc3","2026-01:jk":"7bea2d0a","2026-01:jt":"684be63f","2026-01:om":"e54135be","2026-01:se":"7666e0c8","2026-02:asp":"3398ad49","2026-02:ch":"bfe23fe6","2026-02:hc":"20fbb93b","2026-02:hp":"4cf84e83","2026-02:jk":"dfe20cbb","2026-02:jt":"142666b9","2026-02:om":"a3fa3ebb","2026-02:se":"05dc893f","2026-03:asp":"d70594f5","2026-03:ch":"46f66199","2026-03:hc":"7d57dbc4","2026-03:hp":"3b0a3882","2026-03:jk":"cae7cbdb","2026-03:jt":"33d18daf","2026-03:om":"a5c7f186","2026-03:jt":"33d18daf","2026-03:om":"a5c7f186","2026-03:se":"1429c6c6","2026-04:asp":"c0bfed04","2026-04:ch":"8cb57dd9","2026-04:hc":"dc497d43","2026-04:hp":"e7e3dcce","2026-04:jk":"67ac4d1b","2026-04:jt":"cd51354f","2026-04:om":"c13b032b","2026-04:se":"501b13dd","2026-05:asp":"c9e518a4","2026-05:ch":"5361784d","2026-05:hc":"f35d3c26","2026-05:hp":"6a1ed5ba","2026-05:jk":"da7b42ca","2026-05:jt":"ad813311","2026-05:om":"45080e39","2026-05:se":"7c6daf3c","2026-06:asp":"98361b13","2026-06:ch":"7d835718","2026-06:hc":"4549bf21","2026-06:hp":"8fcd3706","2026-06:jk":"01e1ab08","2026-06:jt":"d7518858","2026-06:om":"8f4f2ae1","2026-06:om":"8f4f2ae1","2026-06:se":"213b39a0","2026-07:asp":"f363d068","2026-07:ch":"10e540e1","2026-07:hc":"316d0ee3","2026-07:hp":"cf081e16","2026-07:jk":"b9827f99","2026-07:jt":"3fa4d15f","2026-07:om":"e05ec72a","2026-07:se":"7186497a","2026-08:asp":"032f5181","2026-08:ch":"86321e07","2026-08:hc":"9a82ca55","2026-08:hp":"40cd5a39","2026-08:jk":"7634a09f","2026-08:jt":"b04c3a0e","2026-08:om":"b7686e2a","2026-08:se":"e9172fed"};

function snapshotHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function shortFingerprint(value) {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(JSON.stringify(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeSnapshot(snapshot) {
  const facts = Array.isArray(snapshot?.dailyFacts) ? snapshot.dailyFacts : [];
  const plans = Array.isArray(snapshot?.monthlyPlans) ? snapshot.monthlyPlans : [];
  const brands = [...new Set([
    ...SNAPSHOT_BRANDS,
    ...facts.flatMap(fact => Object.keys(fact).filter(key => key !== 'date')),
    ...plans.flatMap(plan => Object.keys(plan).filter(key => key !== 'month')),
  ])].sort();

  const normalizeValues = (record, brand) => Object.fromEntries(
    SNAPSHOT_METRICS.map(metric => [
      metric,
      Object.prototype.hasOwnProperty.call(record?.[brand] || {}, metric)
        ? record[brand][metric]
        : null,
    ]),
  );

  return {
    brands,
    dailyFacts: facts.map(fact => ({
      date: fact.date,
      brands: Object.fromEntries(brands.map(brand => [brand, normalizeValues(fact, brand)])),
    })),
    monthlyPlans: plans.map(plan => ({
      month: plan.month,
      brands: Object.fromEntries(brands.map(brand => [brand, normalizeValues(plan, brand)])),
    })),
  };
}

function findSnapshotMismatch(normalized) {
  const dateMismatches = normalized.dailyFacts
    .map((fact, index) => shortFingerprint(fact) === EXPECTED_DAILY_DATE_HASHES[index]
      ? null
      : fact.date)
    .filter(Boolean);
  const brandMismatches = normalized.brands.filter(brand => {
    if (!Object.prototype.hasOwnProperty.call(EXPECTED_DAILY_BRAND_HASHES, brand)) return true;
    const values = normalized.dailyFacts.map(fact => ({
      date: fact.date,
      brand,
      metrics: fact.brands[brand],
    }));
    return shortFingerprint(values) !== EXPECTED_DAILY_BRAND_HASHES[brand];
  });

  return {
    date: dateMismatches[0] || normalized.dailyFacts[0]?.date || 'неизвестна',
    brand: brandMismatches[0] || normalized.brands[0] || 'неизвестен',
  };
}

function findPlanMismatch(normalized) {
  for (const plan of normalized.monthlyPlans) {
    for (const brand of normalized.brands) {
      const key = `${plan.month}:${brand}`;
      const expectedHash = EXPECTED_PLAN_HASHES[key];
      const actualHash = shortFingerprint({
        month: plan.month,
        brand,
        metrics: plan.brands[brand],
      });
      if (!expectedHash || actualHash !== expectedHash) {
        return { month: plan.month || 'неизвестен', brand };
      }
    }
  }
  return {
    month: normalized.monthlyPlans[0]?.month || 'неизвестен',
    brand: normalized.brands[0] || 'неизвестен',
  };
}

function assertFallbackSnapshotIntegrity(snapshot) {
  const facts = Array.isArray(snapshot?.dailyFacts) ? snapshot.dailyFacts : [];
  const dates = facts.map(fact => fact.date);
  const firstBrand = SNAPSHOT_BRANDS[0];

  assert.equal(facts.length, 237, 'Резервный срез должен содержать 237 дневных записей');
  assert.equal(new Set(dates).size, dates.length, `Дублирующаяся дата ${dates[0]}, бренд ${firstBrand}`);
  assert.equal(dates[0], '2026-01-01', `Неверная начальная дата ${dates[0]}, бренд ${firstBrand}`);
  assert.equal(dates.at(-1), '2026-08-25', `Неверная конечная дата ${dates.at(-1)}, бренд ${firstBrand}`);

  for (let index = 0; index < dates.length; index++) {
    assert.match(
      dates[index],
      /^\d{4}-\d{2}-\d{2}$/,
      `Некорректная дата ${dates[index]}, бренд ${firstBrand}`,
    );
    if (index === 0) continue;
    const previous = Date.parse(`${dates[index - 1]}T00:00:00Z`);
    const current = Date.parse(`${dates[index]}T00:00:00Z`);
    assert.equal(
      current - previous,
      24 * 60 * 60 * 1000,
      `Непрерывность дат нарушена: ${dates[index - 1]} -> ${dates[index]}, бренд ${firstBrand}`,
    );
  }

  const normalized = normalizeSnapshot(snapshot);
  assert.equal(
    snapshotHash(normalized.dailyFacts),
    EXPECTED_DAILY_FACTS_SHA256,
    (() => {
      const mismatch = findSnapshotMismatch(normalized);
      return `Метрики резервного среза отличаются: дата ${mismatch.date}, бренд ${mismatch.brand}`;
    })(),
  );
  assert.equal(
    normalized.monthlyPlans.length,
    8,
    'Резервный срез должен содержать планы за 8 месяцев',
  );
  assert.equal(
    snapshotHash(normalized.monthlyPlans),
    EXPECTED_MONTHLY_PLANS_SHA256,
    (() => {
      const mismatch = findPlanMismatch(normalized);
      return `Планы резервного среза отличаются: дата ${mismatch.month}-01, бренд ${mismatch.brand}`;
    })(),
  );
}

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return body; },
  };
}

function request(server, method, path) {
  return requestPort(server.address().port, method, path);
}

function requestPort(port, method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function startApiProcess(environment) {
  const childSource = [
    "const fs = require('node:fs');",
    "const app = require('./api/index.js');",
    "const server = app.listen(0, () => fs.writeSync(3, JSON.stringify({ port: server.address().port }) + '\\n'));",
    "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
  ].join('\n');

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', childSource], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'ignore', 'pipe', 'pipe'],
    });
    let startupMessage = '';
    let errorOutput = '';
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdio[3].setEncoding('utf8');
    child.stdio[3].on('data', (chunk) => {
      startupMessage += chunk;
      const line = startupMessage.split('\n')[0];
      try {
        const message = JSON.parse(line);
        settled = true;
        resolve({ child, port: message.port });
      } catch {
        // Wait for the complete startup message.
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { errorOutput += chunk; });
    child.once('error', fail);
    child.once('exit', (code, signal) => {
      if (!settled) {
        fail(new Error(`API process exited before startup (${code || signal}): ${errorOutput}`));
      }
    });
  });
}

function stopApiProcess(child) {
  if (child.exitCode !== null || child.signalCode) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
  });
}

let app;
let server;
let upstreamAvailable = true;
let fetchUpstream = async () => upstreamAvailable
  ? jsonResponse(externalPayload)
  : jsonResponse({ error: 'upstream unavailable' }, false, 503);
let originalDatabaseUrl;
const fallbackPath = path.join(os.tmpdir(), `april-fallback-${process.pid}.json`);
const fallbackSnapshot = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'daily_facts.json'),
  'utf8',
));
const originalFallback = JSON.stringify(fallbackSnapshot);

function withFallbackContents(contents, callback) {
  fs.writeFileSync(fallbackPath, contents);
  return Promise.resolve().then(callback).finally(() => fs.writeFileSync(fallbackPath, originalFallback));
}

async function waitFor(condition, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for the upstream request');
    await new Promise(resolve => setImmediate(resolve));
  }
}

test.before(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.FALLBACK_DATA_PATH = fallbackPath;
  fs.writeFileSync(fallbackPath, originalFallback);
  process.env.DATA_SOURCE_URL = 'https://test.invalid/daily_facts.json';
  global.fetch = (...args) => fetchUpstream(...args);
  app = require('../api/index.js');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(fallbackPath, { force: true });
  delete process.env.FALLBACK_DATA_PATH;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

test('fallback snapshot contains the complete normalized reference slice', () => {
  assertFallbackSnapshotIntegrity(fallbackSnapshot);
});

test('fallback integrity failures identify the affected date and brand', () => {
  const corruptedSnapshot = JSON.parse(JSON.stringify(fallbackSnapshot));
  corruptedSnapshot.dailyFacts[0].ch.sales += 1;

  assert.throws(
    () => assertFallbackSnapshotIntegrity(corruptedSnapshot),
    /дата 2026-01-01, бренд ch/,
  );
});

test('API data flow preserves external and fallback contracts', async () => {
  upstreamAvailable = true;
  let response = await request(server, 'GET', '/api/data?refresh=true');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.dailyFacts, externalPayload.dailyFacts);
  assert.equal(response.body.source, 'external');
  assert.equal(response.body.fallbackAt, null);
  assert.ok(Array.isArray(response.body.dailyFacts));

  upstreamAvailable = false;
  response = await request(server, 'GET', '/api/data?refresh=true');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.dailyFacts));
  assert.equal(response.body.source, 'fallback');
  assert.ok(response.body.fallbackAt);
  assert.deepEqual(response.body.dailyFacts, externalPayload.dailyFacts);
  assert.equal(JSON.parse(fs.readFileSync(fallbackPath, 'utf8')).exportDate, externalPayload.exportDate);

  upstreamAvailable = true;
  response = await request(server, 'POST', '/api/refresh-data');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.records, externalPayload.dailyFacts.length);
  assert.equal(response.body.exportDate, externalPayload.exportDate);
  assert.match(response.body.source, /test\.invalid/);
});

test('API rejects a malformed fallback when the upstream source is unavailable', async () => {
  upstreamAvailable = false;

  let response = await withFallbackContents('{ invalid json', () => request(server, 'GET', '/api/data?refresh=true'));
  assert.equal(response.status, 502);
  assert.deepEqual(response.body, { error: 'Не удалось получить данные из внешнего источника' });

  response = await withFallbackContents(JSON.stringify({ exportDate: '2099-01-02' }), () => request(server, 'GET', '/api/data?refresh=true'));
  assert.equal(response.status, 502);
  assert.deepEqual(response.body, { error: 'Не удалось получить данные из внешнего источника' });

  upstreamAvailable = true;
});

test('fallback write failures do not fail the external response or damage the previous copy', async () => {
  upstreamAvailable = true;
  const previousContents = fs.readFileSync(fallbackPath, 'utf8');
  fs.unlinkSync(fallbackPath);
  fs.mkdirSync(fallbackPath);

  try {
    const response = await request(server, 'GET', '/api/data?refresh=true');
    assert.equal(response.status, 200);
    assert.equal(response.body.source, 'external');
    assert.deepEqual(response.body.dailyFacts, externalPayload.dailyFacts);
    assert.equal(fs.statSync(fallbackPath).isDirectory(), true);
  } finally {
    fs.rmSync(fallbackPath, { recursive: true, force: true });
    fs.writeFileSync(fallbackPath, previousContents);
  }
});

test('parallel forced refreshes keep the newest successful fallback intact', async () => {
  const olderPayload = {
    exportDate: '2099-01-03',
    dailyFacts: [
      { date: '2099-01-03', brands: { 'Test Brand': { sales: 8, traffic: 12 } } },
    ],
  };
  const newerPayload = {
    exportDate: '2099-01-04',
    dailyFacts: [
      { date: '2099-01-04', brands: { 'Test Brand': { sales: 9, traffic: 13 } } },
    ],
  };
  const successfulPayload = {
    exportDate: '2099-01-05',
    dailyFacts: [
      { date: '2099-01-05', brands: { 'Test Brand': { sales: 10, traffic: 14 } } },
    ],
  };
  const fallbackTemporaryPrefix = `${path.basename(fallbackPath)}.`;
  const temporaryFallbackFiles = () => fs.readdirSync(path.dirname(fallbackPath))
    .filter(file => file.startsWith(fallbackTemporaryPrefix) && file.endsWith('.tmp'));
  let resolveOlder;
  let resolveNewer;
  let fetchCall = 0;
  fetchUpstream = () => {
    fetchCall++;
    if (fetchCall === 1) return new Promise(resolve => { resolveOlder = resolve; });
    if (fetchCall === 2) return new Promise(resolve => { resolveNewer = resolve; });
    return Promise.resolve(jsonResponse(successfulPayload));
  };

  try {
    const olderRequest = request(server, 'GET', '/api/data?refresh=true');
    await waitFor(() => fetchCall === 1);
    const newerRequest = request(server, 'GET', '/api/data?refresh=true');
    await waitFor(() => fetchCall === 2);
    assert.equal(fetchCall, 2);

    resolveNewer(jsonResponse(newerPayload));
    const newerResponse = await newerRequest;
    resolveOlder(jsonResponse(olderPayload));
    const olderResponse = await olderRequest;

    assert.equal(newerResponse.status, 200);
    assert.equal(olderResponse.status, 200);
    assert.equal(newerResponse.body.exportDate, newerPayload.exportDate);
    assert.equal(olderResponse.body.exportDate, olderPayload.exportDate);
    assert.deepEqual(JSON.parse(fs.readFileSync(fallbackPath, 'utf8')), newerPayload);
    assert.deepEqual(temporaryFallbackFiles(), []);

    fetchCall = 0;
    fetchUpstream = () => {
      fetchCall++;
      if (fetchCall === 1) return new Promise(resolve => { resolveOlder = resolve; });
      return Promise.resolve(jsonResponse({ error: 'upstream unavailable' }, false, 503));
    };
    const successfulRequest = request(server, 'GET', '/api/data?refresh=true');
    await waitFor(() => fetchCall === 1);
    const failedRequest = request(server, 'GET', '/api/data?refresh=true');
    await waitFor(() => fetchCall === 2);
    const failedResponse = await failedRequest;
    resolveOlder(jsonResponse(successfulPayload));
    const successfulResponse = await successfulRequest;

    assert.equal(failedResponse.status, 200);
    assert.equal(failedResponse.body.source, 'fallback');
    assert.equal(successfulResponse.status, 200);
    assert.equal(successfulResponse.body.exportDate, successfulPayload.exportDate);
    assert.deepEqual(JSON.parse(fs.readFileSync(fallbackPath, 'utf8')), successfulPayload);
    assert.deepEqual(temporaryFallbackFiles(), []);
  } finally {
    fetchUpstream = async () => upstreamAvailable
      ? jsonResponse(externalPayload)
      : jsonResponse({ error: 'upstream unavailable' }, false, 503);
  }
});

test('separate API processes keep a shared fallback as one complete successful JSON response', async () => {
  const processCount = 6;
  const payloads = Array.from({ length: processCount }, (_, index) => ({
    exportDate: `2099-02-${String(index + 1).padStart(2, '0')}`,
    metadata: { worker: index },
    dailyFacts: Array.from({ length: 250 }, (_, factIndex) => ({
      date: `2099-02-${String((factIndex % 28) + 1).padStart(2, '0')}`,
      brands: { 'Test Brand': { sales: index + factIndex, traffic: index + factIndex + 10 } },
    })),
  }));
  const upstreamRequests = [];
  let releaseUpstream;
  const allUpstreamRequestsReceived = new Promise(resolve => { releaseUpstream = resolve; });
  const upstreamServer = http.createServer((req, res) => {
    const match = req.url.match(/^\/payload\/(\d+)$/);
    if (!match) {
      res.writeHead(404).end();
      return;
    }

    const index = Number(match[1]);
    upstreamRequests.push(index);
    if (upstreamRequests.length === processCount) releaseUpstream();
    allUpstreamRequestsReceived.then(() => {
      setTimeout(() => {
        const body = JSON.stringify(payloads[index]);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
      }, (processCount - index) * 3);
    });
  });
  await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));

  const processes = [];
  try {
    for (let index = 0; index < processCount; index++) {
      processes.push(await startApiProcess({
        DATA_SOURCE_URL: `http://127.0.0.1:${upstreamServer.address().port}/payload/${index}`,
        FALLBACK_DATA_PATH: fallbackPath,
        FALLBACK_LOCK_TIMEOUT_MS: '3000',
        DATABASE_URL: '',
      }));
    }

    const responses = await Promise.all(
      processes.map(({ port }) => requestPort(port, 'GET', '/api/data?refresh=true')),
    );
    assert.deepEqual(upstreamRequests.sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.body.source, 'external');
    }

    const finalContents = fs.readFileSync(fallbackPath, 'utf8');
    const finalFallback = JSON.parse(finalContents);
    const matchesPayload = payloads.some((payload) => {
      try {
        assert.deepEqual(finalFallback, payload);
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(matchesPayload, true, 'fallback должен совпадать с одним полным upstream-ответом');
    assert.deepEqual(
      fs.readdirSync(path.dirname(fallbackPath))
        .filter(file => file.startsWith(`${path.basename(fallbackPath)}.`) && file.endsWith('.tmp')),
      [],
    );
    assert.equal(fs.existsSync(`${fallbackPath}.lock`), false);
  } finally {
    await Promise.all(processes.map(({ child }) => stopApiProcess(child)));
    await new Promise((resolve, reject) => upstreamServer.close(error => error ? reject(error) : resolve()));
  }
});
