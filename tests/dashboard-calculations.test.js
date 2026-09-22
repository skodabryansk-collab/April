const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClass(filePath, className, dependencySource = '', globals = {}) {
  let source = fs.readFileSync(filePath, 'utf8');
  source = source.replace(/^import[^\n]+\n/gm, dependencySource);
  source = source.replace(new RegExp(`export class ${className}`), `class ${className}`);
  const context = { console, window: {}, ...globals };
  vm.runInNewContext(`${source}\nwindow.${className} = ${className};`, context, { filename: filePath });
  return context.window[className];
}

test('JSON brand keys use the current Tenet names', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8');
  const context = { console, window: {} };
  vm.runInNewContext(source, context, { filename: 'utils.js' });

  const mapping = context.window.DashboardUtils.generateBrandMapping(['ch', 'tp']);

  assert.equal(mapping.ch, 'Тенет');
  assert.equal(mapping.tp, 'Тенет Плюс');
});

test('forecast edge cases remain stable', () => {
  const DashboardCalculations = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-calculations.js'),
    'DashboardCalculations',
    ''
  );
  const calculator = new DashboardCalculations();

  assert.equal(calculator.calculateForecast(0, 100, 'sales', 10, 30), 30);
  assert.equal(calculator.calculateForecast(25, 100, 'sales', 30, 30), 25);
  assert.equal(calculator.calculateForecast(-10, 100, 'sales', 10, 30), -30);
  assert.equal(typeof calculator.calculateBrandData, 'undefined');
});

test('traffic forecast extrapolates only from the selected date range', () => {
  const DashboardCalculations = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-calculations.js'),
    'DashboardCalculations',
    ''
  );
  const calculator = new DashboardCalculations();
  const dailyFacts = Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    return {
      date: `2026-09-${String(day).padStart(2, '0')}`,
      om: { traffic: day >= 11 && day <= 20 ? 10 : 100 },
    };
  });

  const forecast = calculator.calculateFeatureForecast(
    100,
    'traffic',
    10,
    30,
    'om',
    dailyFacts,
    '2026-09',
    11,
    20
  );

  assert.equal(forecast, 300);
});

test('pace analysis calculates actual and required daily rates', () => {
  const DashboardCalculations = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-calculations.js'),
    'DashboardCalculations',
    ''
  );
  const calculator = new DashboardCalculations();

  const pace = calculator.calculatePaceAnalysis(62, 100, 15, 30, 92);

  assert.equal(pace.fact, 62);
  assert.equal(pace.plan, 100);
  assert.equal(pace.elapsedDays, 15);
  assert.equal(pace.remainingDays, 15);
  assert.equal(pace.remainingPlan, 38);
  assert.equal(pace.actualDailyPace, 62 / 15);
  assert.equal(pace.requiredDailyPace, 38 / 15);
  assert.equal(pace.projectedTotal, 92);
  assert.equal(pace.projectedPercent, 92);
  assert.ok(Math.abs(pace.paceRatioPercent - ((62 / 38) * 100)) < 1e-10);
});

test('pace analysis handles a completed month and missing plan', () => {
  const DashboardCalculations = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-calculations.js'),
    'DashboardCalculations',
    ''
  );
  const calculator = new DashboardCalculations();

  const completed = calculator.calculatePaceAnalysis(95, 100, 30, 30, 95);
  assert.equal(completed.remainingDays, 0);
  assert.equal(completed.requiredDailyPace, 0);
  assert.equal(completed.remainingPlan, 5);

  const withoutPlan = calculator.calculatePaceAnalysis(12, 0, 10, 30);
  assert.equal(withoutPlan.factPercent, null);
  assert.equal(withoutPlan.projectedTotal, null);
  assert.equal(withoutPlan.projectedPercent, null);
  assert.equal(withoutPlan.paceRatioPercent, null);
});

test('forecast totals use the forecasts already calculated for each card', () => {
  const DashboardCore = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-core.js'),
    'DashboardCore',
    ''
  );
  const core = Object.create(DashboardCore.prototype);
  const items = [
    {
      data: {
        sales: { fact: 10, plan: 20 },
        traffic: { fact: 100, plan: 200 },
        revenue: { fact: 1000, plan: 2000 },
        contracts: { fact: 5, plan: 10 },
        trading: { fact: 3, plan: 6 },
      },
      salesForecast: 18,
      trafficForecast: 175,
      revenueForecast: 1900,
      contractsForecast: 9,
      tradingForecast: 5,
      forecastPlan: {
        sales: 40,
        traffic: 400,
        revenue: 4000,
        contracts: 20,
        trading: 12,
      },
    },
    {
      data: {
        sales: { fact: 4, plan: 8 },
        traffic: { fact: 50, plan: 100 },
        revenue: { fact: 400, plan: 800 },
        contracts: { fact: 2, plan: 4 },
        trading: { fact: 1, plan: 2 },
      },
      salesForecast: 7,
      trafficForecast: 90,
      revenueForecast: 700,
      contractsForecast: 4,
      tradingForecast: 2,
      forecastPlan: {
        sales: 16,
        traffic: 200,
        revenue: 1600,
        contracts: 8,
        trading: 4,
      },
    },
  ];

  const totals = core.calculateForecastTotals(items);
  assert.deepEqual(JSON.parse(JSON.stringify(totals.sales)), { totalFact: 14, totalPlan: 56, totalForecast: 25 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.traffic)), { totalFact: 150, totalPlan: 600, totalForecast: 265 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.revenue)), { totalFact: 1400, totalPlan: 5600, totalForecast: 2600 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.contracts)), { totalFact: 7, totalPlan: 28, totalForecast: 13 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.trading)), { totalFact: 4, totalPlan: 16, totalForecast: 7 });
});

test('full-plan forecast mode switches cards from the period plan to the monthly plan', () => {
  const DashboardCore = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-core.js'),
    'DashboardCore',
    ''
  );
  const core = Object.create(DashboardCore.prototype);

  core.forecastFullPlan = false;
  assert.equal(core.getDisplayPlan(10, 30), 10);

  core.forecastFullPlan = true;
  assert.equal(core.getDisplayPlan(10, 30), 30);
});

test('plan inputs accept explicit zeroes and clear brands missing from the month plan', () => {
  const inputs = Object.fromEntries(
    ['om-sp', 'om-tp', 'om-rp', 'om-cp', 'om-trp', 'jk-sp', 'jk-tp', 'jk-rp', 'jk-cp', 'jk-trp']
      .map(id => [id, { value: 999 }])
  );
  const DashboardCore = loadClass(
    path.join(__dirname, '..', 'js/core/dashboard-core.js'),
    'DashboardCore',
    '',
    { document: { getElementById: id => inputs[id] || null } }
  );
  const core = Object.create(DashboardCore.prototype);
  core.brands = [{ key: 'om' }, { key: 'jk' }];
  core.brandInputs = {
    om: { sp: 'om-sp', tp: 'om-tp', rp: 'om-rp', cp: 'om-cp', trp: 'om-trp' },
    jk: { sp: 'jk-sp', tp: 'jk-tp', rp: 'jk-rp', cp: 'jk-cp', trp: 'jk-trp' },
  };

  core.updateInputsWithPlans({
    om: { sales: 0, traffic: 0, revenue: 0, contracts: 0, trading: 0 },
  });

  for (const input of Object.values(inputs)) {
    assert.equal(input.value, 0);
  }
});