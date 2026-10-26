import { brands, type Measure, type Metric, months } from "./annual-data";

export type DailyFactsResponse = {
  dailyFacts: Array<{ date: string; [key: string]: unknown }>;
  monthlyPlans: Array<{ month: string; [key: string]: unknown }>;
};

export function buildLiveSeries(payload: DailyFactsResponse) {
  const years = [...new Set(payload.dailyFacts.map(fact => fact.date.slice(0, 4)))].sort();
  const year = years.at(-1) ?? new Date().getFullYear().toString();
  const dailyFacts = payload.dailyFacts.filter(fact => fact.date.startsWith(`${year}-`));
  const latestDate = dailyFacts.map(fact => fact.date.slice(0, 10)).sort().at(-1) ?? "";
  const latestMonth = latestDate ? Number(latestDate.slice(5, 7)) - 1 : -1;
  const empty = (): Measure => ({ sales: 0, traffic: 0, contracts: 0, revenue: 0, trading: 0 });
  const monthly: Record<string, Measure[]> = Object.fromEntries(brands.map(brand => [brand.id, Array.from({ length: 12 }, empty)]));
  const planSeries: Record<string, Record<Metric, number[]>> = {};
  for (const brand of brands) {
    planSeries[brand.id] = { sales: Array(12).fill(0), traffic: Array(12).fill(0), contracts: Array(12).fill(0), revenue: Array(12).fill(0), trading: Array(12).fill(0) };
  }
  for (const fact of dailyFacts) {
    const month = Number(fact.date.slice(5, 7)) - 1;
    for (const brand of brands) {
      const values = fact[brand.id] as Measure | undefined;
      if (!values) continue;
      for (const metric of Object.keys(empty()) as Metric[]) monthly[brand.id][month][metric] += values[metric];
    }
  }
  for (const plan of payload.monthlyPlans.filter(item => item.month.startsWith(`${year}-`))) {
    const month = Number(plan.month.slice(5, 7)) - 1;
    for (const brand of brands) {
      const values = plan[brand.id] as Measure | undefined;
      if (!values) continue;
      for (const metric of Object.keys(empty()) as Metric[]) planSeries[brand.id][metric][month] = values[metric];
    }
  }
  return { year, latestDate, latestMonth, monthly, planSeries, months };
}
