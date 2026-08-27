const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadClass(filePath, className, dependencySource = '') {
  let source = fs.readFileSync(filePath, 'utf8');
  source = source.replace(/^import[^\n]+\n/gm, dependencySource);
  source = source.replace(new RegExp(`export class ${className}`), `class ${className}`);
  const context = { console, window: {} };
  vm.runInNewContext(`${source}\nwindow.${className} = ${className};`, context, { filename: filePath });
  return context.window[className];
}

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
    },
  ];

  const totals = core.calculateForecastTotals(items);
  assert.deepEqual(JSON.parse(JSON.stringify(totals.sales)), { totalFact: 14, totalPlan: 28, totalForecast: 25 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.traffic)), { totalFact: 150, totalPlan: 300, totalForecast: 265 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.revenue)), { totalFact: 1400, totalPlan: 2800, totalForecast: 2600 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.contracts)), { totalFact: 7, totalPlan: 14, totalForecast: 13 });
  assert.deepEqual(JSON.parse(JSON.stringify(totals.trading)), { totalFact: 4, totalPlan: 8, totalForecast: 7 });
});