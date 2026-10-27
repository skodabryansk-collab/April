import { useMemo, useState, type MouseEvent } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Info, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import brandLogo from "../assets/logo-da_1793017642361.svg";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import {
  brands, dealerBrandSales, dealerGroups, marketBrands, marketTotals, metricInfo, months, newCarBrands, type MarketBrandId, type Metric,
} from "./annual-data";
import { buildLiveSeries, type DailyFactsResponse } from "./live-data";

async function fetchDailyFacts(): Promise<DailyFactsResponse> {
  const response = await fetch("/api/daily-facts");
  if (!response.ok) throw new Error(`Не удалось загрузить данные: ${response.status}`);
  return response.json() as Promise<DailyFactsResponse>;
}

const number = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
const decimal = (value: number) => value.toFixed(1).replace(".", ",");
const shareHeatTone = (value: number, max: number) => {
  const ratio = max > 0 ? value / max : 0;
  return ratio < .2 ? "tone-1" : ratio < .4 ? "tone-2" : ratio < .6 ? "tone-3" : ratio < .8 ? "tone-4" : "tone-5";
};
type ShareChange = { month: number; delta: number };
const strongestShareChanges = (values: Array<number | null>) => {
  const changes = values.slice(1).flatMap((value, index) => {
    const previous = values[index];
    return value === null || previous === null ? [] : [{ month: index + 1, delta: value - previous }];
  });
  return {
    increase: changes.reduce<ShareChange | null>((best, change) => change.delta > 0 && (!best || change.delta > best.delta) ? change : best, null),
    decrease: changes.reduce<ShareChange | null>((best, change) => change.delta < 0 && (!best || change.delta < best.delta) ? change : best, null),
  };
};
const signedDecimal = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value))}`;
const moneyCompact = (value: number) => `${(value / 1_000_000).toFixed(1).replace(".", ",")} млн`;
const displayMetric = (value: number, metric: Metric) => metric === "revenue" ? moneyCompact(value) : number(value);
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
type LiveSeries = ReturnType<typeof buildLiveSeries>;
const actualForBrand = (data: LiveSeries, id: string, metric: Metric) => data.monthly[id].slice(0, data.latestMonth + 1).reduce((sum, month) => sum + month[metric], 0);
const planForBrand = (data: LiveSeries, id: string, metric: Metric) => data.planSeries[id][metric].slice(0, data.latestMonth + 1).reduce((sum, value) => sum + value, 0);
const actualForMonth = (data: LiveSeries, month: number, metric: Metric) => newCarBrands.reduce((sum, brand) => sum + data.monthly[brand.id][month][metric], 0);
const planForMonth = (data: LiveSeries, month: number, metric: Metric) => newCarBrands.reduce((sum, brand) => sum + data.planSeries[brand.id][metric][month], 0);
const allActual = (data: LiveSeries, metric: Metric) => newCarBrands.reduce((sum, brand) => sum + actualForBrand(data, brand.id, metric), 0);
const allPlan = (data: LiveSeries, metric: Metric) => newCarBrands.reduce((sum, brand) => sum + planForBrand(data, brand.id, metric), 0);
const allVehiclesActual = (data: LiveSeries, metric: Metric) => brands.reduce((sum, brand) => sum + actualForBrand(data, brand.id, metric), 0);
const allVehiclesPlan = (data: LiveSeries, metric: Metric) => brands.reduce((sum, brand) => sum + planForBrand(data, brand.id, metric), 0);
const monthActual = (data: LiveSeries, id: string, month: number, metric: Metric) => month <= data.latestMonth ? data.monthly[id][month][metric] : null;

type CompetitorSales = {
  months: string[];
  groups: { name: string; values: (number | null)[]; total: number | null }[];
  fetchedAt: string;
};

async function fetchCompetitorSales(): Promise<CompetitorSales> {
  const response = await fetch("/api/competitor-sales");
  if (!response.ok) throw new Error(`Не удалось загрузить сравнение: ${response.status}`);
  return response.json() as Promise<CompetitorSales>;
}

function CompetitorSalesPanel() {
  const query = useQuery({ queryKey: ["competitor-sales-2026"], queryFn: fetchCompetitorSales, staleTime: 5 * 60 * 1000 });
  const [visibleGroups, setVisibleGroups] = useState<string[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"share" | "sales">("share");
  const [activePoint, setActivePoint] = useState<{ group: string; month: number } | null>(null);
  const [activeShareCell, setActiveShareCell] = useState<string | null>(null);

  if (query.isLoading) return <section className="aba-panel aba-competitor-sales"><p>Загружаем сравнение АСП из вкладки «2026»…</p></section>;
  if (query.isError || !query.data) return <section className="aba-panel aba-competitor-sales">
    <div className="aba-section-heading"><div><h2>Продажи АСП по дилерским группам</h2><p>Помесячные данные из вкладки «2026»</p></div></div>
    <p className="aba-data-error">Не удалось получить данные из таблицы. <button type="button" onClick={() => query.refetch()}>Повторить</button></p>
  </section>;

  const { months: monthLabels, groups } = query.data;
  const activeIds = visibleGroups.length ? visibleGroups : groups.map(group => group.name);
  const activeGroups = groups.filter(group => activeIds.includes(group.name));
  const total = (group: CompetitorSales["groups"][number]) => group.total ?? group.values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const active = activePoint ? groups.find(group => group.name === activePoint.group) : null;
  const focusedGroupName = selectedGroupName ?? groups[0]?.name ?? null;
  const monthlyTotals = monthLabels.map((_, month) => groups.reduce((sum, group) => sum + (group.values[month] ?? 0), 0));
  const groupTotals = groups.map(total);
  const periodTotal = groupTotals.reduce((sum, value) => sum + value, 0);
  const shareAt = (group: CompetitorSales["groups"][number], month: number) => {
    const value = group.values[month];
    const denominator = monthlyTotals[month] ?? 0;
    return value === null || !denominator ? null : value / denominator * 100;
  };
  const chartMax = Math.max(...activeGroups.flatMap(group => group.values.map((value, month) =>
    chartView === "share" ? (shareAt(group, month) ?? 0) : (value ?? 0),
  )), 1) * (chartView === "share" ? 1.16 : 1.12);
  const x = (index: number) => 62 + index * (826 / Math.max(monthLabels.length - 1, 1));
  const y = (value: number) => 315 - value / chartMax * 250;
  const colors = ["#173f3a", "#9a7860", "#64859a", "#957d9d"];
  const pieRows = groups.map((group, index) => ({
    id: group.name, name: group.name, color: colors[index % colors.length],
    value: chartView === "share" ? (periodTotal ? total(group) / periodTotal * 100 : 0) : total(group),
  }));
  const pieTotal = pieRows.reduce((sum, row) => sum + row.value, 0);
  let pieAngle = -Math.PI / 2;
  const pieSlices = pieRows.map(row => {
    const start = pieAngle;
    pieAngle += pieTotal ? row.value / pieTotal * Math.PI * 2 : 0;
    return { ...row, start, end: pieAngle };
  });
  const selectedPieRow = pieRows.find(row => row.id === focusedGroupName);
  const activePointValue = active && activePoint
    ? chartView === "share" ? shareAt(active, activePoint.month) : active.values[activePoint.month]
    : null;
  const selectGroup = (name: string) => {
    setSelectedGroupName(name);
    if (!activeIds.includes(name)) setVisibleGroups(current => current.length ? [...current, name] : current);
    setActivePoint(null);
  };
  const toggleVisible = (name: string) => {
    setVisibleGroups(current => {
      const base = current.length ? current : groups.map(group => group.name);
      if (base.length === 1 && base[0] === name) return current;
      const next = base.includes(name) ? base.filter(item => item !== name) : [...base, name];
      return next.length === groups.length ? [] : next;
    });
    setActivePoint(null);
  };
  const shareHeatMax = Math.max(...groups.flatMap(group => monthLabels.map((_, month) => shareAt(group, month) ?? 0)), 1);

  return <section className="aba-panel aba-competitor-sales" aria-labelledby="competitor-sales-title">
    <div className="aba-section-heading">
      <div><h2 id="competitor-sales-title">Продажи АСП по дилерским группам</h2><p>Автомобили с пробегом · помесячные данные вкладки «2026»</p></div>
      <span className="aba-demo-pill"><i />ТАБЛИЦА · 2026</span>
    </div>
    <div className="aba-competitor-sales-meta"><Info size={13} /><span>Продажи автомобилей с пробегом по группам. Итоги рассчитаны за месяцы, заполненные в таблице.</span></div>
    <div className="aba-market-chart-block">
      <div className="aba-market-chart-head">
        <div><h3>{chartView === "share" ? "Доля АСП среди групп" : "Объём продаж АСП"}</h3>
          <p>{chartView === "share" ? "Доля от продаж АСП групп из таблицы, %" : "Продажи автомобилей с пробегом по месяцам, шт."}</p></div>
        <div className="aba-mode-switch aba-market-switch" role="group" aria-label="Показатель АСП">
          <button type="button" className={chartView === "share" ? "is-active" : ""} aria-pressed={chartView === "share"} onClick={() => { setChartView("share"); setActivePoint(null); }}>Доля</button>
          <button type="button" className={chartView === "sales" ? "is-active" : ""} aria-pressed={chartView === "sales"} onClick={() => { setChartView("sales"); setActivePoint(null); }}>Объём</button>
        </div>
      </div>
      <section className="aba-market-pie" aria-label="Структура АСП по дилерским группам">
        <div className="aba-market-pie-head"><div><h3>{chartView === "share" ? "Доли групп · январь—сентябрь" : "Объём по группам · январь—сентябрь"}</h3><p>Нажмите на сектор, чтобы выбрать группу</p></div><strong>{chartView === "share" ? "100%" : `${number(periodTotal)} авто`}</strong></div>
        <div className="aba-market-pie-body">
          <svg className="aba-market-pie-svg" viewBox="0 0 240 224" role="img" aria-label="Доли АСП по дилерским группам">
            {pieSlices.map(row => <path key={row.id} d={pieArcPath(row.start, row.end)} fill={row.color} className={focusedGroupName === row.id ? "is-selected" : ""} role="button" tabIndex={0} aria-label={`${row.name}: ${chartView === "share" ? `${decimal(row.value)}%` : `${number(row.value)} авто`}`} onClick={() => selectGroup(row.name)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") selectGroup(row.name); }}><title>{`${row.name} · ${chartView === "share" ? `${decimal(row.value)}%` : `${number(row.value)} авто`}`}</title></path>)}
            <text x="120" y="108" textAnchor="middle" className="aba-pie-center-label">{selectedPieRow?.name ?? "Все группы"}</text>
            <text x="120" y="128" textAnchor="middle" className="aba-pie-center-value">{selectedPieRow ? chartView === "share" ? `${decimal(selectedPieRow.value)}%` : number(selectedPieRow.value) : "100%"}</text>
            <text x="120" y="143" textAnchor="middle" className="aba-pie-center-unit">{chartView === "share" ? "доля АСП" : "авто"}</text>
          </svg>
          <div className="aba-market-pie-legend">{pieRows.map(row => <button type="button" key={row.id} className={focusedGroupName === row.id ? "is-selected" : ""} onClick={() => selectGroup(row.name)}><i style={{ background: row.color }} /><span>{row.name}</span><strong>{chartView === "share" ? `${decimal(row.value)}%` : number(row.value)}</strong></button>)}</div>
        </div>
      </section>
      <div className="aba-market-legend" role="group" aria-label="Показать группы на графике">{groups.map((group, index) => <button type="button" key={group.name} className={activeIds.includes(group.name) ? "is-active" : "is-muted"} aria-pressed={activeIds.includes(group.name)} onClick={() => toggleVisible(group.name)}><i style={{ background: colors[index % colors.length] }} />{group.name}</button>)}</div>
      <div className="aba-market-chart-scroll">
        <svg className="aba-market-chart" viewBox="0 0 900 420" role="img" aria-label={`Динамика ${chartView === "share" ? "доли АСП" : "объёма продаж АСП"} по месяцам`}>
          {[0, 1, 2, 3].map(tick => { const value = chartMax / 3 * (3 - tick); return <g key={tick}><line x1="58" x2="884" y1={52 + tick * 90} y2={52 + tick * 90} className="aba-grid-line" /><text x="0" y={56 + tick * 90} className="aba-axis-label">{chartView === "share" ? `${Math.round(value)}%` : number(value)}</text></g>; })}
          {monthLabels.map((month, index) => <text key={month} x={x(index)} y="398" textAnchor="middle" className="aba-axis-label">{month.slice(0, 3)}</text>)}
          {activeGroups.map(group => { const color = colors[groups.indexOf(group) % colors.length]; const values = group.values.map((value, month) => chartView === "share" ? shareAt(group, month) : value); let start = true; const path = values.map((value, month) => { if (value === null) { start = true; return null; } const command = start ? "M" : "L"; start = false; return `${command} ${x(month)} ${y(value)}`; }).filter((point): point is string => point !== null).join(" "); const selected = focusedGroupName === group.name; return <g key={group.name} className={focusedGroupName && !selected ? "is-unfocused" : ""}><path d={path} className={`aba-market-line ${selected ? "is-focused" : ""}`} stroke={color} />{values.map((value, month) => value === null ? null : <g key={month}><circle cx={x(month)} cy={y(value)} r="4" fill={color} />{selected && <text x={x(month)} y={y(value) - 13} textAnchor="middle" className="aba-market-point-label">{chartView === "share" ? decimal(value) : number(value)}</text>}<circle cx={x(month)} cy={y(value)} r="10" className="aba-market-hit" role="button" tabIndex={0} aria-label={`${group.name}, ${monthLabels[month]}: ${chartView === "share" ? `${decimal(value)}%` : `${number(value)} авто`}`} onClick={() => setActivePoint({ group: group.name, month })} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setActivePoint({ group: group.name, month }); }} /></g>)}</g>; })}
        </svg>
      </div>
      <div className="aba-market-chart-foot"><span><i /> {monthLabels[0]} — {monthLabels[monthLabels.length - 1]} 2026</span><span>Нажмите на точку, чтобы увидеть значение</span></div>
    </div>
    {active && activePoint && activePointValue !== null && activePointValue !== undefined && <div className="aba-sales-tooltip"><strong>{active.name}</strong><span>{monthLabels[activePoint.month]} 2026</span><b>{chartView === "share" ? `${decimal(activePointValue)}%` : `${number(activePointValue)} авто`}</b><button type="button" onClick={() => setActivePoint(null)} aria-label="Закрыть подсказку">×</button></div>}
    <div className="aba-sales-table-wrap">
      <table className="aba-sales-table">
        <thead><tr><th scope="col">ГРУППА</th>{monthLabels.map(month => <th key={month} scope="col">{month.slice(0, 3).toUpperCase()}</th>)}<th scope="col">ИТОГО</th></tr></thead>
        <tbody>{groups.map(group => <tr key={group.name} className={`${activeIds.includes(group.name) ? "" : "is-muted"} ${focusedGroupName === group.name ? "is-focus-row" : ""}`}>
          <th scope="row"><button type="button" className="aba-sales-group-select" onClick={() => selectGroup(group.name)}><i style={{ background: colors[groups.indexOf(group) % colors.length] }} />{group.name}</button></th>
          {group.values.map((value, month) => <td key={month}>{value === null ? "—" : number(value)}</td>)}
          <td className="aba-sales-total">{number(total(group))}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <section className="aba-share-heatmap aba-group-share-heatmap" aria-labelledby="asp-share-heat-title">
      <div className="aba-share-heatmap-heading"><div><h3 id="asp-share-heat-title">Доля АСП по группам</h3><p>Продажи группы ÷ сумма продаж групп АСП в таблице за тот же месяц</p></div><span>ЯНВ—СЕН · 2026</span></div>
      <ShareChangeLegend />
      <div className="aba-share-heatmap-scroll"><table className="aba-share-heatmap-table" data-testid="asp-share-heatmap"><thead><tr><th scope="col">ГРУППА</th>{monthLabels.map(month => <th key={month} scope="col">{month.slice(0, 3).toUpperCase()}</th>)}<th scope="col" className="aba-annual-share-head">ИТОГО<br />ЗА ПЕРИОД</th></tr></thead>
        <tbody>{groups.map(group => { const shares = monthLabels.map((_, month) => shareAt(group, month)); const extremes = strongestShareChanges(shares); const annualShare = periodTotal ? total(group) / periodTotal * 100 : null; return <tr key={group.name} className={focusedGroupName === group.name ? "is-focus-row" : ""}><th scope="row"><span className="aba-share-heatmap-name"><i style={{ background: colors[groups.indexOf(group) % colors.length] }} />{group.name}</span></th>
          {shares.map((value, month) => { if (value === null) return <td key={month} className="tone-empty aba-unavailable">—</td>; const previous = month ? shares[month - 1] : null; const delta = previous === null ? null : value - previous; return <ShareHeatmapCell key={month} id={`asp-${group.name}-${month}`} activeId={activeShareCell} onActiveChange={setActiveShareCell} rowName={group.name} period={monthLabels[month]} value={value} delta={delta} previousMonth={previous === null ? null : monthLabels[month - 1]} highlight={extremes.increase?.month === month ? "increase" : extremes.decrease?.month === month ? "decrease" : null} tone={shareHeatTone(value, shareHeatMax)} shareLabel="доля среди указанных групп АСП" annualNote="Продажи группы за заполненные месяцы ÷ сумма продаж АСП всех групп в таблице за тот же период." />; })}
          {annualShare === null ? <td className="tone-empty aba-unavailable aba-annual-share-cell">—</td> : <ShareHeatmapCell id={`asp-${group.name}-period`} activeId={activeShareCell} onActiveChange={setActiveShareCell} rowName={group.name} period="Итого за период · 2026" value={annualShare} delta={null} previousMonth={null} highlight={null} annual tone="tone-3" shareLabel="доля среди указанных групп АСП" annualNote="Продажи группы за заполненные месяцы ÷ сумма продаж АСП всех групп в таблице за тот же период." />}
        </tr>; })}</tbody>
      </table></div>
    </section>
    <p className="aba-sales-source">Источник: Google Sheets, вкладка «2026». Период охватывает месяцы, заполненные в таблице.</p>
  </section>;
}

function ShareChangeLegend() {
  return <div className="aba-share-heatmap-legend" aria-label="Обозначения изменения доли">
    <span><ArrowUpRight aria-hidden="true" /> Самый сильный рост к прошлому месяцу</span>
    <span><ArrowDownRight aria-hidden="true" /> Самое сильное снижение</span>
    <span className="aba-share-heatmap-click-hint"><Info aria-hidden="true" /> Нажмите на ячейку для подробностей</span>
  </div>;
}

type ShareHeatmapCellProps = {
  id: string;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  rowName: string;
  period: string;
  value: number;
  delta: number | null;
  previousMonth: string | null;
  highlight: "increase" | "decrease" | null;
  tone?: string;
  annual?: boolean;
  shareLabel?: string;
  annualNote?: string;
};

function ShareHeatmapCell({
  id, activeId, onActiveChange, rowName, period, value, delta, previousMonth,
  highlight, tone, annual = false, shareLabel = "доля рынка новых авто",
  annualNote = "Продажи за январь—сентябрь ÷ объём рынка за тот же период.",
}: ShareHeatmapCellProps) {
  const isOpen = activeId === id;
  const highlightLabel = highlight === "increase" ? "Самый сильный рост за период" : highlight === "decrease" ? "Самое сильное снижение за период" : null;
  const description = annual
    ? `${rowName} · итого за год: ${decimal(value)}%, по данным за январь—сентябрь 2026`
    : `${rowName} · ${period}: ${decimal(value)}% ${shareLabel}${delta !== null && previousMonth ? `; изменение к ${previousMonth}: ${signedDecimal(delta)} п.п.` : ""}${highlightLabel ? `; ${highlightLabel.toLowerCase()}` : ""}`;

  return <td className={`${tone ?? ""} ${annual ? "aba-annual-share-cell" : ""} ${highlight === "increase" ? "is-max-share-increase" : ""} ${highlight === "decrease" ? "is-max-share-decrease" : ""}`}>
    <Popover open={isOpen} onOpenChange={open => onActiveChange(open ? id : null)}>
      <PopoverTrigger asChild>
        <button type="button" className="aba-share-heatmap-cell-trigger" aria-label={description} aria-expanded={isOpen} data-testid={`share-cell-${id}`}>
          <span className="aba-share-heatmap-cell-content">
            {decimal(value)}%
            {!annual && highlight === "increase" && <ArrowUpRight className="aba-share-heatmap-marker is-increase" aria-hidden="true" />}
            {!annual && highlight === "decrease" && <ArrowDownRight className="aba-share-heatmap-marker is-decrease" aria-hidden="true" />}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="aba-share-cell-popover" side="top" align="center" sideOffset={8}>
        <div className="aba-share-cell-popover-heading"><strong>{rowName}</strong><span>{period}</span></div>
        <div className="aba-share-cell-popover-value"><strong>{decimal(value)}%</strong><span>{shareLabel}</span></div>
        {annual
          ? <p className="aba-share-cell-popover-note">{annualNote}</p>
          : delta !== null && previousMonth
            ? <div className="aba-share-cell-popover-change"><span>К {previousMonth}</span><strong className={delta >= 0 ? "is-positive" : "is-negative"}>{signedDecimal(delta)} п.п.</strong></div>
            : <p className="aba-share-cell-popover-note">Первый месяц периода — без сравнения.</p>}
        {highlightLabel && <div className={`aba-share-cell-popover-highlight is-${highlight}`}>
          {highlight === "increase" ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}
          {highlightLabel}
        </div>}
      </PopoverContent>
    </Popover>
  </td>;
}

function pieArcPath(start: number, end: number) {
  const point = (radius: number, angle: number) => [120 + radius * Math.cos(angle), 112 + radius * Math.sin(angle)];
  const [sx, sy] = point(88, start);
  const [ex, ey] = point(88, end);
  const [ix, iy] = point(53, end);
  const [isx, isy] = point(53, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${sx} ${sy} A 88 88 0 ${large} 1 ${ex} ${ey} L ${ix} ${iy} A 53 53 0 ${large} 0 ${isx} ${isy} Z`;
}

function Chart({
  metric, selectedMonth, onMonth, data, visibleBrandIds, onVisibleBrandIdsChange,
}: {
  metric: Metric; selectedMonth: number | null; onMonth: (month: number) => void;
  data: LiveSeries;
  visibleBrandIds: string[];
  onVisibleBrandIdsChange: (ids: string[]) => void;
}) {
  const [showTotal, setShowTotal] = useState(true);
  const [activePoint, setActivePoint] = useState<{ id: string; month: number } | null>(null);
  const series = useMemo(() => {
    const totals = months.map((_, month) => month <= data.latestMonth
      ? visibleBrandIds.reduce((sum, id) => sum + data.monthly[id][month][metric], 0)
      : null);
    const brandValues = brands.filter(brand => visibleBrandIds.includes(brand.id)).map(brand => ({
      id: brand.id,
      values: months.slice(0, data.latestMonth + 1).map((_, month) => data.monthly[brand.id][month][metric]),
    }));
    const visibleValues = brandValues.flatMap(brand => brand.values);
    const max = Math.max(...visibleValues, ...(showTotal ? totals.slice(0, data.latestMonth + 1).map(Number) : []), 1) * 1.16;
    const x = (month: number) => 47 + month * 60;
    const y = (value: number) => 188 - (value / max) * 154;
    const line = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"} ${x(index)} ${y(value)}`).join(" ");
    return { totals, brandValues, max, x, y, line };
  }, [data, metric, visibleBrandIds, showTotal]);
  const toggleBrand = (id: string) => {
    if (visibleBrandIds.includes(id) && visibleBrandIds.length > 1) {
      if (activePoint?.id === id) setActivePoint(null);
      onVisibleBrandIdsChange(visibleBrandIds.filter(item => item !== id));
      return;
    }
    if (!visibleBrandIds.includes(id)) onVisibleBrandIdsChange([...visibleBrandIds, id]);
  };
  const totalName = visibleBrandIds.length === brands.length ? "Итого по группе · с АСП" : "Итого выбранных брендов";
  const activeBrand = activePoint ? brands.find(brand => brand.id === activePoint.id) : undefined;
  const activeValue = activePoint
    ? activePoint.id === "total"
      ? series.totals[activePoint.month]
      : data.monthly[activePoint.id]?.[activePoint.month]?.[metric]
    : null;
  const tooltipX = activePoint ? Math.max(8, Math.min(series.x(activePoint.month) + 9, 566)) : 0;
  const tooltipY = activePoint ? Math.max(8, series.y(activeValue ?? 0) - 39) : 0;
  const handleChartClick = (event: MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = (event.clientX - bounds.left) * 760 / bounds.width;
    const clickY = (event.clientY - bounds.top) * 230 / bounds.height;
    const candidates = [
      ...(showTotal ? series.totals.slice(0, data.latestMonth + 1).map((value, month) => ({ id: "total", month, value: value ?? 0 })) : []),
      ...series.brandValues.flatMap(brand => brand.values.map((value, month) => ({ id: brand.id, month, value }))),
    ];
    const nearest = candidates.map(point => ({
      ...point,
      distance: Math.hypot(series.x(point.month) - clickX, series.y(point.value) - clickY),
    })).sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance < 24) {
      setActivePoint({ id: nearest.id, month: nearest.month });
      onMonth(nearest.month);
    } else setActivePoint(null);
  };

  return <div className="aba-chart-wrap">
    <div className="aba-legend">
      <button type="button" className={`aba-legend-item ${showTotal ? "is-active" : "is-muted"}`} onClick={() => { setShowTotal(current => !current); if (activePoint?.id === "total") setActivePoint(null); }} aria-pressed={showTotal} data-testid="toggle-brand-total">
        <i className="aba-total-dot" />{totalName}
      </button>
      {brands.map(brand => <button type="button" key={brand.id} className={`aba-legend-item ${visibleBrandIds.includes(brand.id) ? "is-active" : "is-muted"}`} onClick={() => toggleBrand(brand.id)} aria-pressed={visibleBrandIds.includes(brand.id)} data-testid={`filter-brand-${brand.id}`}>
        <i style={{ background: brand.color }} />{brand.name}
      </button>)}
    </div>
    <div className="aba-chart-scroll">
      <svg className="aba-chart" viewBox="0 0 760 230" role="img" aria-label={`Нажмите на точку графика, чтобы увидеть значение показателя «${metricInfo[metric].label}»`} onClick={handleChartClick}>
        {[0,1,2,3].map(tick => {
          const value = (series.max / 3) * (3 - tick);
          return <g key={tick}><line x1="45" x2="740" y1={34 + tick * 51} y2={34 + tick * 51} className="aba-grid-line" /><text x="0" y={38 + tick * 51} className="aba-axis-label">{displayMetric(value, metric)}</text></g>;
        })}
        {months.map((month, index) => <g key={month}>
          <text x={series.x(index)} y="218" textAnchor="middle" className={`aba-axis-label ${index > data.latestMonth ? "aba-future-label" : ""}`}>{month}</text>
          {index > data.latestMonth && <rect x={series.x(index)-27} y="25" width="54" height="175" className="aba-future-column" />}
        </g>)}
        {showTotal && <path d={series.line(series.totals.slice(0, data.latestMonth + 1).map(Number))} className="aba-total-line" />}
        {showTotal && series.totals.slice(0, data.latestMonth + 1).map((value, index) => <g key={`total-${index}`}>
          <circle cx={series.x(index)} cy={series.y(value ?? 0)} r="10" className="aba-point-hit" onClick={event => { event.stopPropagation(); setActivePoint({ id: "total", month: index }); onMonth(index); }} role="button" tabIndex={0} aria-label={`${totalName}, ${months[index]}: ${displayMetric(value ?? 0, metric)}`} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { setActivePoint({ id: "total", month: index }); onMonth(index); } }} />
          <circle cx={series.x(index)} cy={series.y(value ?? 0)} r={selectedMonth === index ? 6 : 3.5} className={`aba-total-point ${selectedMonth === index ? "is-selected" : ""}`} pointerEvents="none" />
        </g>)}
        {series.brandValues.map(item => {
          const brand = brands.find(entry => entry.id === item.id)!;
          const values = item.values;
          return <g key={brand.id} className="aba-brand-series">
            <path d={series.line(values)} stroke={brand.color} className="aba-brand-line" />
            {values.map((value, index) => <g key={index}>
              <circle cx={series.x(index)} cy={series.y(value)} r="10" className="aba-point-hit" onClick={event => { event.stopPropagation(); setActivePoint({ id: brand.id, month: index }); onMonth(index); }} role="button" tabIndex={0} aria-label={`${brand.name}, ${months[index]}: ${displayMetric(value, metric)}`} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { setActivePoint({ id: brand.id, month: index }); onMonth(index); } }} />
              <circle cx={series.x(index)} cy={series.y(value)} r="3" fill={brand.color} pointerEvents="none" />
            </g>)}
          </g>;
        })}
        {selectedMonth !== null && <line x1={series.x(selectedMonth)} x2={series.x(selectedMonth)} y1="24" y2="198" className="aba-selected-marker" />}
        {activePoint && activeValue !== null && activeValue !== undefined && <g className="aba-chart-tooltip" role="status" aria-live="polite" transform={`translate(${tooltipX} ${tooltipY})`} pointerEvents="none">
          <rect width="178" height="34" rx="5" />
          <text x="8" y="13">{`${months[activePoint.month]} · ${activeBrand?.name ?? totalName}`}</text>
          <text x="8" y="27" className="aba-chart-tooltip-value">{`${displayMetric(activeValue, metric)} ${metricInfo[metric].unit}`}</text>
        </g>}
      </svg>
    </div>
  </div>;
}

function MarketPanel() {
  const [view, setView] = useState<"sales" | "share">("share");
  const [visible, setVisible] = useState<string[]>(dealerGroups.map(group => group.id));
  const [showMarketTotal, setShowMarketTotal] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>("ours");
  const [activeMarketPoint, setActiveMarketPoint] = useState<{ groupId: string; month: number } | null>(null);
  const [brandShareMonth, setBrandShareMonth] = useState(8);
  const [selectedMarketBrand, setSelectedMarketBrand] = useState<MarketBrandId | null>(null);
  const [activeHeatmapCell, setActiveHeatmapCell] = useState<string | null>(null);
  const activeGroups = dealerGroups.filter(group => visible.includes(group.id));
  const marketYtd = marketTotals.reduce((sum, value) => sum + value, 0);
  const salesYtd = (index: number) => dealerGroups[index].values.reduce((sum, value) => sum + value, 0);
  const share = (index: number, month: number) => dealerGroups[index].values[month] / marketTotals[month] * 100;
  const ytdShare = (index: number) => salesYtd(index) / marketYtd * 100;
  const monthDelta = (index: number) => share(index, 8) - share(index, 7);
  const yearDelta = (index: number) => share(index, 8) - share(index, 0);
  const selectedGroup = dealerGroups.find(group => group.id === selectedGroupId) ?? null;
  const selectedGroupBrands = useMemo(() => {
    if (!selectedGroupId) return [];
    const groupSales = dealerGroups.find(group => group.id === selectedGroupId)?.values.reduce((sum, value) => sum + value, 0) ?? 0;
    return marketBrands.map(brand => {
      const sales = dealerBrandSales
        .filter(item => item.groupId === selectedGroupId && item.brandId === brand.id)
        .reduce((sum, item) => sum + item.values.reduce((itemSum, value) => itemSum + value, 0), 0);
      return { ...brand, sales, groupShare: groupSales ? sales / groupSales * 100 : 0 };
    }).filter(brand => brand.sales > 0).sort((a, b) => b.sales - a.sales);
  }, [selectedGroupId]);
  const brandShareRows = useMemo(() => marketBrands.map(brand => {
    const values = Array.from({ length: 9 }, (_, month) =>
      dealerBrandSales
        .filter(item => item.brandId === brand.id)
        .reduce((sum, item) => sum + (item.values[month] ?? 0), 0),
    );
    const sales = values.reduce((sum, value) => sum + value, 0);
    const previousMonth = Math.max(0, brandShareMonth - 1);
    return {
      ...brand,
      values,
      sales,
      ytdShare: sales / marketYtd * 100,
      monthShare: values[brandShareMonth] / marketTotals[brandShareMonth] * 100,
      delta: brandShareMonth === 0 ? 0 : values[brandShareMonth] / marketTotals[brandShareMonth] * 100 - values[previousMonth] / marketTotals[previousMonth] * 100,
    };
  }).sort((a, b) => b.sales - a.sales), [brandShareMonth, marketYtd]);
  const groupShareHeatMax = Math.max(...dealerGroups.flatMap((_, index) => dealerGroups[index].values.map((__, month) => share(index, month))), 1);
  const brandShareHeatMax = Math.max(...brandShareRows.flatMap(brand => brand.values.map((sales, month) => sales / marketTotals[month] * 100)), 1);
  const chartMax = view === "sales"
    ? Math.max(...activeGroups.flatMap(group => group.values), ...(showMarketTotal ? marketTotals : [])) * 1.12
    : Math.max(...activeGroups.flatMap(group => group.values.map((_, month) => share(dealerGroups.indexOf(group), month)))) * 1.16;
  const x = (month: number) => 62 + month * 94;
  const shortMarket = (value: number) => view === "share" ? `${value.toFixed(0)}%` : number(value);
  const toggleSeries = (id: string) => {
    if (visible.includes(id)) {
      if (visible.length > 1) {
        if (activeMarketPoint?.groupId === id) setActiveMarketPoint(null);
        setVisible(current => current.filter(item => item !== id));
      }
      return;
    }
    setVisible(current => [...current, id]);
  };
  const marketTooltipGroup = activeMarketPoint && activeMarketPoint.groupId !== "market-total"
    ? dealerGroups.find(group => group.id === activeMarketPoint.groupId)
    : undefined;
  const marketTooltipValue = activeMarketPoint
    ? activeMarketPoint.groupId === "market-total"
      ? view === "sales" ? marketTotals[activeMarketPoint.month] : null
      : marketTooltipGroup
        ? view === "share"
          ? share(dealerGroups.indexOf(marketTooltipGroup), activeMarketPoint.month)
          : marketTooltipGroup.values[activeMarketPoint.month]
        : null
    : null;
  const marketTooltipX = activeMarketPoint ? Math.max(8, Math.min(x(activeMarketPoint.month) + 9, 714)) : 0;
  const marketTooltipY = activeMarketPoint && marketTooltipGroup && marketTooltipValue !== null
    ? Math.max(8, Math.min(315 - marketTooltipValue / (chartMax || 1) * 250 - 39, 378))
    : 0;
  const handleMarketChartClick = (event: MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = (event.clientX - bounds.left) * 900 / bounds.width;
    const clickY = (event.clientY - bounds.top) * 420 / bounds.height;
    const groupCandidates = activeGroups.flatMap(group => {
      const groupIndex = dealerGroups.indexOf(group);
      return group.values.map((rawValue, month) => {
        const value = view === "share" ? share(groupIndex, month) : rawValue;
        return {
          groupId: group.id,
          month,
          distance: Math.hypot(x(month) - clickX, 315 - value / (chartMax || 1) * 250 - clickY),
        };
      });
    });
    const marketCandidates = view === "sales" && showMarketTotal
      ? marketTotals.map((value, month) => ({
        groupId: "market-total",
        month,
        distance: Math.hypot(x(month) - clickX, 315 - value / (chartMax || 1) * 250 - clickY),
      }))
      : [];
    const candidates = [...groupCandidates, ...marketCandidates].sort((a, b) => a.distance - b.distance);
    const nearest = candidates[0];
    if (nearest && nearest.distance < 24) setActiveMarketPoint({ groupId: nearest.groupId, month: nearest.month });
    else setActiveMarketPoint(null);
  };
  const ownIndex = dealerGroups.findIndex(group => group.id === "ours");
  const pieRows = dealerGroups.map((group, index) => ({
    ...group,
    value: view === "share" ? ytdShare(index) : salesYtd(index),
  }));
  const pieTotal = pieRows.reduce((sum, row) => sum + row.value, 0);
  let pieAngle = -Math.PI / 2;
  const pieSlices = pieRows.map(row => {
    const start = pieAngle;
    pieAngle += pieTotal ? row.value / pieTotal * Math.PI * 2 : 0;
    return { ...row, start, end: pieAngle };
  });
  const selectedPieRow = pieRows.find(row => row.id === selectedGroupId);

  return <section className="aba-panel aba-market-panel" aria-labelledby="market-title">
    <div className="aba-section-heading aba-market-heading">
      <div><h2 id="market-title">Дилерские группы и доля рынка</h2><p>Продажи и доли за январь—сентябрь 2026</p></div>
      <span className="aba-demo-pill"><i />ДАННЫЕ ИЗ ФАЙЛА · 2026</span>
    </div>
    <div className="aba-demo-notice"><Info size={15} /><span>Файл «2026», январь—сентябрь: {number(marketYtd)} новых авто в строке «Итого». Сумма шести групп совпадает с ней. АСП (авто с пробегом) не входит в долю рынка новых авто. Файл не отражает весь региональный рынок.</span></div>
    <div className="aba-market-overview">
      <div className="aba-market-summary"><span className="aba-market-label">Рынок в файле</span><strong>{number(marketYtd)} <small>авто</small></strong><span className="aba-market-sub">январь—сентябрь 2026</span></div>
      <div className="aba-market-summary aba-market-summary-own"><span className="aba-market-label">Дебрянск Авто · продажи</span><strong>{number(salesYtd(ownIndex))} <small>авто</small></strong><span className="aba-market-sub">с начала года · по сентябрь</span></div>
      <div className="aba-market-summary aba-market-summary-share"><span className="aba-market-label">Доля Дебрянск Авто</span><strong>{decimal(ytdShare(ownIndex))}<small>%</small></strong><span className={`aba-market-change ${yearDelta(ownIndex) >= 0 ? "is-positive" : "is-negative"}`}>{yearDelta(ownIndex) >= 0 ? "+" : "−"}{decimal(Math.abs(yearDelta(ownIndex)))} п.п. <em>январь → сентябрь</em></span></div>
      <div className="aba-market-summary aba-market-summary-note"><span className="aba-market-label">Как считается доля</span><strong>Продажи новых авто</strong><span className="aba-market-sub">÷ общий объём новых авто по строке «Итого»</span></div>
    </div>
    <div className="aba-competitor-body">
      <div className="aba-market-chart-block">
        <div className="aba-market-chart-head">
          <div><h3>{view === "share" ? "Доля рынка новых авто" : "Объём продаж"}</h3><p>{view === "share" ? "Доля от объёма новых авто в файле, %" : "Продажи новых автомобилей по месяцам, шт."}</p></div>
          <div className="aba-mode-switch aba-market-switch" role="group" aria-label="Показатель сравнения">
            <button type="button" className={view === "share" ? "is-active" : ""} aria-pressed={view === "share"} onClick={() => { setView("share"); setActiveMarketPoint(null); }} data-testid="market-view-share">Доля рынка</button>
            <button type="button" className={view === "sales" ? "is-active" : ""} aria-pressed={view === "sales"} onClick={() => { setView("sales"); setActiveMarketPoint(null); }} data-testid="market-view-sales">Объём</button>
          </div>
        </div>
        <section className="aba-market-pie" aria-label="Структура рынка по дилерским группам">
          <div className="aba-market-pie-head"><div><h3>{view === "share" ? "Доли групп · январь—сентябрь" : "Объём по группам · январь—сентябрь"}</h3><p>{view === "share" ? "Нажмите на сектор, чтобы выбрать группу" : "Новые автомобили, январь—сентябрь"}</p></div><strong>{view === "share" ? "100%" : `${number(marketYtd)} авто`}</strong></div>
          <div className="aba-market-pie-body">
            <svg className="aba-market-pie-svg" viewBox="0 0 240 224" role="img" aria-label={view === "share" ? "Доли рынка дилерских групп" : "Объём продаж по дилерским группам"}>
              {pieSlices.map(row => <path key={row.id} d={pieArcPath(row.start, row.end)} fill={row.color} className={selectedGroupId === row.id ? "is-selected" : ""} role="button" tabIndex={0} aria-pressed={selectedGroupId === row.id} aria-label={`${row.name}: ${view === "share" ? `${decimal(row.value)} процентов` : `${number(row.value)} автомобилей`}`} onClick={() => setSelectedGroupId(row.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelectedGroupId(row.id); }}><title>{`${row.name} · ${view === "share" ? `${decimal(row.value)}%` : `${number(row.value)} авто`}`}</title></path>)}
              <text x="120" y="108" textAnchor="middle" className="aba-pie-center-label">{selectedPieRow?.name ?? "Все группы"}</text>
              <text x="120" y="128" textAnchor="middle" className="aba-pie-center-value">{selectedPieRow ? (view === "share" ? `${decimal(selectedPieRow.value)}%` : number(selectedPieRow.value)) : (view === "share" ? "100%" : number(pieTotal))}</text>
              {selectedPieRow && <text x="120" y="143" textAnchor="middle" className="aba-pie-center-unit">{view === "share" ? "доля рынка" : "авто"}</text>}
            </svg>
            <div className="aba-market-pie-legend">{pieRows.map(row => <button type="button" key={row.id} className={selectedGroupId === row.id ? "is-selected" : ""} onClick={() => setSelectedGroupId(row.id)}><i style={{ background: row.color }} /><span>{row.name}</span><strong>{view === "share" ? `${decimal(row.value)}%` : number(row.value)}</strong></button>)}</div>
          </div>
        </section>
        <div className="aba-market-legend" aria-label="Показатели графика">
          {dealerGroups.map(group => {
            const active = visible.includes(group.id);
            return <button type="button" key={group.id} className={active ? "is-active" : "is-muted"} onClick={() => toggleSeries(group.id)} aria-pressed={active} data-testid={`filter-group-${group.id}`}><i style={{ background: group.color }} />{group.name}</button>;
          })}
          {view === "sales" && <button type="button" className={showMarketTotal ? "is-active" : "is-muted"} onClick={() => {
            setShowMarketTotal(current => !current);
            if (activeMarketPoint?.groupId === "market-total") setActiveMarketPoint(null);
          }} aria-pressed={showMarketTotal} data-testid="toggle-market-total">
            <i className="aba-market-total-swatch" />Общий рынок
          </button>}
        </div>
        <div className="aba-market-chart-scroll">
            <svg className="aba-market-chart" viewBox="0 0 900 420" role="img" aria-label={`Нажмите на точку графика, чтобы увидеть ${view === "share" ? "долю рынка" : "объём продаж"} дилерской группы`} onClick={handleMarketChartClick}>
            {[0,1,2,3].map(tick => {
              const value = chartMax / 3 * (3 - tick);
               return <g key={tick}><line x1="58" x2="884" y1={52 + tick * 90} y2={52 + tick * 90} className="aba-grid-line" /><text x="0" y={56 + tick * 90} className="aba-axis-label">{shortMarket(value)}</text></g>;
            })}
             {months.slice(0, 9).map((month, index) => <text key={month} x={x(index)} y="398" textAnchor="middle" className="aba-axis-label">{month}</text>)}
            {activeGroups.map(group => {
              const index = dealerGroups.indexOf(group);
              const values = group.values.map((value, month) => view === "share" ? share(index, month) : value);
              const y = (value: number) => 315 - value / (chartMax || 1) * 250;
              const isSelectedSeries = selectedGroupId === group.id;
              const path = values.map((value, month) => `${month ? "L" : "M"} ${x(month)} ${y(value)}`).join(" ");
              return <g key={group.id} className={selectedGroupId && selectedGroupId !== group.id ? "is-unfocused" : ""}>
                <path d={path} className={`aba-market-line ${group.id === "ours" ? "is-own" : ""} ${selectedGroupId === group.id ? "is-focused" : ""}`} stroke={group.color} />
                  {values.map((value, month) => <g key={month}>
                    <circle cx={x(month)} cy={y(value)} r="10" className="aba-market-hit" role="button" tabIndex={0} aria-label={`${group.name}, ${months[month]}: ${view === "share" ? `${decimal(value)}%` : `${number(value)} авто`}`} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setActiveMarketPoint({ groupId: group.id, month }); }} />
                    <circle cx={x(month)} cy={y(value)} r={group.id === "ours" ? 4 : 3} fill={group.color} pointerEvents="none">
                  <title>{`${group.name} · ${months[month]}: ${view === "share" ? `${decimal(value)}%` : `${number(value)} авто`}`}</title>
                    </circle>
                    {isSelectedSeries && <text x={x(month)} y={y(value) - 13} textAnchor="middle" className="aba-market-point-label" aria-hidden="true">{view === "share" ? decimal(value) : number(value)}</text>}
                  </g>)}
              </g>;
            })}
             {view === "sales" && showMarketTotal && (() => {
               const path = marketTotals.map((value, month) => `${month ? "L" : "M"} ${x(month)} ${315 - value / (chartMax || 1) * 250}`).join(" ");
               return <g className="aba-market-total-series" key="market-total">
                 <path d={path} className="aba-market-total-line" />
                 {marketTotals.map((value, month) => <g key={month}>
                   <circle cx={x(month)} cy={315 - value / (chartMax || 1) * 250} r="10" className="aba-market-hit" role="button" tabIndex={0} aria-label={`Общий рынок, ${months[month]}: ${number(value)} авто`} onClick={event => { event.stopPropagation(); setActiveMarketPoint({ groupId: "market-total", month }); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setActiveMarketPoint({ groupId: "market-total", month }); }} />
                   <circle cx={x(month)} cy={315 - value / (chartMax || 1) * 250} r="4" className="aba-market-total-point" pointerEvents="none"><title>{`Общий рынок · ${months[month]}: ${number(value)} авто`}</title></circle>
                 </g>)}
               </g>;
             })()}
             {activeMarketPoint && marketTooltipGroup && marketTooltipValue !== null && <g className="aba-chart-tooltip" role="status" aria-live="polite" transform={`translate(${marketTooltipX} ${marketTooltipY})`} pointerEvents="none">
               <rect width="178" height="34" rx="5" />
               <text x="8" y="13">{`${months[activeMarketPoint.month]} · ${marketTooltipGroup.name}`}</text>
               <text x="8" y="27" className="aba-chart-tooltip-value">{view === "share" ? `${decimal(marketTooltipValue)}%` : `${number(marketTooltipValue)} авто`}</text>
             </g>}
             {activeMarketPoint?.groupId === "market-total" && marketTooltipValue !== null && <g className="aba-chart-tooltip" role="status" aria-live="polite" transform={`translate(${marketTooltipX} ${marketTooltipY})`} pointerEvents="none">
               <rect width="178" height="34" rx="5" />
               <text x="8" y="13">{`${months[activeMarketPoint.month]} · Общий рынок`}</text>
               <text x="8" y="27" className="aba-chart-tooltip-value">{`${number(marketTooltipValue)} авто`}</text>
             </g>}
          </svg>
        </div>
        <div className="aba-market-chart-foot"><span><i /> Январь — сентябрь 2026</span><span>Нажмите на график, чтобы увидеть значение</span></div>
      </div>
      <aside className="aba-competitor-ranking">
        <div className="aba-ranking-heading"><div><h3>Сравнение групп</h3><p>Январь—сентябрь · доля в файле</p></div><span>ЯНВ—СЕН</span></div>
        <div className="aba-ranking-columns"><span>ГРУППА</span><span>ПРОДАЖИ</span><span>ДОЛЯ</span><span>АВГ → СЕН</span></div>
        {activeGroups.map(group => {
          const index = dealerGroups.indexOf(group);
          const delta = monthDelta(index);
          return <button type="button" className={`aba-ranking-row ${group.id === "ours" ? "is-own" : ""} ${selectedGroupId === group.id ? "is-selected" : ""}`} key={group.id} data-testid={`ranking-${group.id}`} aria-pressed={selectedGroupId === group.id} onClick={() => setSelectedGroupId(group.id)} title={`Показать бренды группы «${group.name}»`}>
            <span className="aba-ranking-name"><i style={{ background: group.color }} />{group.name}</span>
            <strong>{number(salesYtd(index))}</strong>
            <strong>{decimal(ytdShare(index))}%</strong>
            <span className={`aba-ranking-delta ${delta >= 0 ? "is-positive" : "is-negative"}`}>{delta >= 0 ? "+" : "−"}{decimal(Math.abs(delta))} п.п.</span>
          </button>;
        })}
        <div className="aba-ranking-total"><span>Общий объём в файле</span><strong>{number(marketYtd)} авто</strong></div>
        <p className="aba-ranking-footnote">Изменение доли — сентябрь к августу, в п.п. В карточке Дебрянск Авто показано изменение январь → сентябрь.</p>
        {selectedGroup && <div className="aba-group-brand-detail" data-testid="group-brand-detail">
          <div className="aba-group-brand-heading"><h4>{selectedGroup.name} · бренды</h4><span>ЯНВ—СЕН · 2026</span></div>
          <div className="aba-group-brand-columns"><span>БРЕНД</span><span>ПРОДАЖИ</span><span>ДОЛЯ ГРУППЫ</span></div>
          {selectedGroupBrands.map(brand => <div className={`aba-group-brand-row ${selectedMarketBrand === brand.id ? "is-brand-focus" : ""}`} key={brand.id} data-testid={`group-brand-${selectedGroup.id}-${brand.id}`}>
            <span><i style={{ background: brand.color }} />{brand.name}</span><strong>{number(brand.sales)}</strong><strong>{decimal(brand.groupShare)}%</strong>
          </div>)}
        </div>}
      </aside>
    </div>
    <section className="aba-share-heatmap aba-group-share-heatmap" aria-labelledby="group-share-heat-title">
      <div className="aba-share-heatmap-heading"><div><h3 id="group-share-heat-title">Доля рынка по группам</h3><p>Продажи группы по месяцам ÷ объём рынка новых авто в файле</p></div><span>ЯНВ—СЕН · 2026</span></div>
      <ShareChangeLegend />
      <div className="aba-share-heatmap-scroll">
        <table className="aba-share-heatmap-table" data-testid="group-share-heatmap">
          <thead><tr><th scope="col">ГРУППА</th>{months.slice(0, 9).map(month => <th scope="col" key={month}>{month.toUpperCase()}</th>)}<th scope="col" className="aba-annual-share-head" title="Доля рассчитана по доступным данным за январь—сентябрь 2026">ИТОГО<br />ЗА ГОД</th></tr></thead>
          <tbody>{dealerGroups.map((group, index) => <tr key={group.id} className={selectedGroupId === group.id ? "is-focus-row" : ""}>
            <th scope="row"><span className="aba-share-heatmap-name"><i style={{ background: group.color }} />{group.name}</span></th>
            {(() => {
              const rowShares = months.slice(0, 9).map((_, monthIndex) => share(index, monthIndex));
              const extremes = strongestShareChanges(rowShares);
              return months.slice(0, 9).map((month, monthIndex) => {
              const value = share(index, monthIndex);
              const delta = monthIndex ? value - rowShares[monthIndex - 1] : null;
              const isIncrease = extremes.increase?.month === monthIndex;
              const isDecrease = extremes.decrease?.month === monthIndex;
              return <ShareHeatmapCell
                key={month}
                id={`group-${group.id}-${monthIndex}`}
                activeId={activeHeatmapCell}
                onActiveChange={setActiveHeatmapCell}
                rowName={group.name}
                period={month}
                value={value}
                delta={delta}
                previousMonth={monthIndex ? months[monthIndex - 1] : null}
                highlight={isIncrease ? "increase" : isDecrease ? "decrease" : null}
                tone={shareHeatTone(value, groupShareHeatMax)}
              />;
              });
            })()}
            <ShareHeatmapCell
              id={`group-${group.id}-annual`}
              activeId={activeHeatmapCell}
              onActiveChange={setActiveHeatmapCell}
              rowName={group.name}
              period="Итого за год · январь—сентябрь 2026"
              value={ytdShare(index)}
              delta={null}
              previousMonth={null}
              highlight={null}
              annual
            />
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="aba-brand-share-section" aria-labelledby="brand-share-title">
      <div className="aba-brand-share-heading">
        <div><h3 id="brand-share-title">Доля рынка по брендам</h3><p>Продажи каждого бренда объединены по всем группам</p></div>
        <label className="aba-brand-share-month"><span>Месяц</span><select value={brandShareMonth} onChange={event => setBrandShareMonth(Number(event.target.value))} data-testid="brand-share-month">
          {months.slice(0, 9).map((month, index) => <option key={month} value={index}>{month} 2026</option>)}
        </select></label>
      </div>
      <div className="aba-brand-share-scroll">
        <table className="aba-brand-share-table">
          <thead><tr><th>БРЕНД</th><th>ПРОДАЖИ · ЯНВ—СЕН</th><th>ДОЛЯ · ЯНВ—СЕН</th><th>ДОЛЯ · {months[brandShareMonth].toUpperCase()}</th><th>ИЗМЕНЕНИЕ ЗА МЕСЯЦ</th></tr></thead>
          <tbody>{brandShareRows.map(brand => <tr key={brand.id} className={selectedMarketBrand === brand.id ? "is-brand-focus" : ""} data-testid={`brand-share-${brand.id}`}>
            <th scope="row"><button type="button" className="aba-brand-share-select" aria-pressed={selectedMarketBrand === brand.id} onClick={() => setSelectedMarketBrand(current => current === brand.id ? null : brand.id)}><i style={{ background: brand.color }} />{brand.name}</button></th>
            <td>{number(brand.sales)}</td>
            <td>{decimal(brand.ytdShare)}%</td>
            <td>{decimal(brand.monthShare)}%</td>
            <td className={brand.delta >= 0 ? "is-positive" : "is-negative"}>{brandShareMonth === 0 ? "—" : `${brand.delta >= 0 ? "+" : "−"}${decimal(Math.abs(brand.delta))} п.п.`}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <section className="aba-share-heatmap aba-brand-share-heatmap" aria-labelledby="brand-share-heat-title">
        <div className="aba-share-heatmap-heading"><div><h4 id="brand-share-heat-title">Доля брендов по месяцам</h4><p>Продажи бренда по всем группам ÷ объём рынка новых авто</p></div><span>ЯНВ—СЕН · 2026</span></div>
        <ShareChangeLegend />
        <div className="aba-share-heatmap-scroll">
          <table className="aba-share-heatmap-table" data-testid="brand-share-heatmap">
            <thead><tr><th scope="col">БРЕНД</th>{months.slice(0, 9).map(month => <th scope="col" key={month}>{month.toUpperCase()}</th>)}<th scope="col" className="aba-annual-share-head" title="Доля рассчитана по доступным данным за январь—сентябрь 2026">ИТОГО<br />ЗА ГОД</th></tr></thead>
            <tbody>{brandShareRows.map(brand => <tr key={brand.id} className={selectedMarketBrand === brand.id ? "is-focus-row" : ""}>
              <th scope="row"><span className="aba-share-heatmap-name"><i style={{ background: brand.color }} />{brand.name}</span></th>
              {(() => {
                const rowShares = brand.values.map((sales, month) => sales / marketTotals[month] * 100);
                const extremes = strongestShareChanges(rowShares);
                return rowShares.map((value, month) => {
                  const delta = month ? value - rowShares[month - 1] : null;
                  const isIncrease = extremes.increase?.month === month;
                  const isDecrease = extremes.decrease?.month === month;
                  return <ShareHeatmapCell
                    key={months[month]}
                    id={`brand-${brand.id}-${month}`}
                    activeId={activeHeatmapCell}
                    onActiveChange={setActiveHeatmapCell}
                    rowName={brand.name}
                    period={months[month]}
                    value={value}
                    delta={delta}
                    previousMonth={month ? months[month - 1] : null}
                    highlight={isIncrease ? "increase" : isDecrease ? "decrease" : null}
                    tone={shareHeatTone(value, brandShareHeatMax)}
                  />;
                });
              })()}
              <ShareHeatmapCell
                id={`brand-${brand.id}-annual`}
                activeId={activeHeatmapCell}
                onActiveChange={setActiveHeatmapCell}
                rowName={brand.name}
                period="Итого за год · январь—сентябрь 2026"
                value={brand.ytdShare}
                delta={null}
                previousMonth={null}
                highlight={null}
                annual
              />
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <p className="aba-brand-share-note"><Info size={13} />Тенет объединяет строки Chery; Хавейл Сити — строку Haval. Варианты LADA объединены в Ладу. Доля за январь—сентябрь = продажи бренда ÷ рынок за тот же период.</p>
    </section>
  </section>;
}

export function AnnualBrandDashboard() {
  const query = useQuery({ queryKey: ["annual-daily-facts"], queryFn: fetchDailyFacts, staleTime: 5 * 60 * 1000 });
  const data = useMemo(() => query.data ? buildLiveSeries(query.data) : null, [query.data]);
  const [metric, setMetric] = useState<Metric>("sales");
  const [heatMode, setHeatMode] = useState<"plan" | "fact">("plan");
  const [visibleBrandIds, setVisibleBrandIds] = useState<string[]>(() => brands.map(brand => brand.id));
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [monthControl, setMonthControl] = useState("all");
  if (query.isError) return <main className="aba-shell"><section className="aba-panel"><h1>Не удалось загрузить данные</h1><p>Проверьте доступность источника JSON и попробуйте ещё раз.</p><button type="button" onClick={() => query.refetch()}>Повторить загрузку</button></section></main>;
  if (query.isLoading || !data) return <main className="aba-shell"><p>Загружаем фактические данные брендов из JSON…</p></main>;
  const factTotal = allActual(data, metric);
  const chartBrandsTotal = visibleBrandIds.reduce((sum, id) => sum + actualForBrand(data, id, metric), 0);
  const chartBrandsLabel = visibleBrandIds.length === brands.length
    ? "Все бренды · факт с начала года"
    : "Выбранные бренды · факт с начала года";
  const planTotal = allPlan(data, metric);
  const attainment = planTotal > 0 ? Math.round(factTotal / planTotal * 100) : 0;
  const activeBrands = brands.filter(brand => !selectedBrand || brand.id === selectedBrand);

  const tone = (value: number | null) => {
    if (value === null) return "tone-empty";
    if (heatMode === "plan") return value < 70 ? "tone-1" : value < 85 ? "tone-2" : value < 95 ? "tone-3" : value < 105 ? "tone-4" : "tone-5";
    const max = Math.max(...brands.flatMap(brand => data.monthly[brand.id].slice(0, data.latestMonth + 1).map(month => month[metric])), 1);
    const ratio = value / max;
    return ratio < .18 ? "tone-1" : ratio < .38 ? "tone-2" : ratio < .62 ? "tone-3" : ratio < .82 ? "tone-4" : "tone-5";
  };
  const cellValue = (id: string, month: number) => {
    const fact = monthActual(data, id, month, metric);
    if (fact === null || heatMode === "fact") return fact;
    const plan = data.planSeries[id][metric][month];
    return plan > 0 ? Math.round(fact / plan * 100) : null;
  };
  const ytdValue = (id: string) => {
    const actual = actualForBrand(data, id, metric);
    if (heatMode === "fact") return actual;
    const plan = planForBrand(data, id, metric);
    return plan > 0 ? Math.round(actual / plan * 100) : null;
  };
  const groupCellValue = (month: number) => {
    const actual = actualForMonth(data, month, metric);
    if (heatMode === "fact") return actual;
    const plan = planForMonth(data, month, metric);
    return plan > 0 ? Math.round(actual / plan * 100) : null;
  };
  const displayCell = (value: number | null) => value === null ? "—" : heatMode === "plan" ? `${value}%` : displayMetric(value, metric);
  const selectCell = (id: string, month: number) => {
    setSelectedBrand(id);
    setSelectedMonth(month);
    setMonthControl(String(month));
  };
  const setMonth = (value: string) => {
    setMonthControl(value);
    setSelectedMonth(value === "all" ? null : Number(value));
  };
  const brandLabel = brands.find(brand => brand.id === selectedBrand)?.name;

  return <main className="aba-shell">
    <header className="aba-header">
      <img className="aba-logo" src={brandLogo} alt="Авто Прайм" />
      <div className="aba-heading"><h1>Продажи по брендам · {data.year}</h1></div>
       <div className="aba-header-meta"><span className="aba-live"><i />Источник: JSON</span><strong>Бренды · {formatDate(data.latestDate)}</strong><small>Рынок · по сентябрь 2026</small></div>
    </header>
    <section className="aba-controls" aria-label="Параметры отчёта">
      <div className="aba-period-label"><CalendarDays size={16} /><span>Период</span></div>
       <label className="aba-select-wrap"><span className="sr-only">Год</span><select defaultValue={data.year} aria-label="Год" data-testid="select-year"><option>{data.year}</option></select><ChevronDown size={14} /></label>
      <div className="aba-control-divider" />
      <div className="aba-period-label"><SlidersHorizontal size={16} /><span>Показатель</span></div>
      <label className="aba-select-wrap metric-select"><span className="sr-only">Показатель</span><select value={metric} onChange={event => setMetric(event.target.value as Metric)} aria-label="Показатель" data-testid="select-metric">
        <option value="sales">Продажи</option><option value="traffic">Трафик</option><option value="contracts">Договоры</option><option value="revenue">Выручка</option><option value="trading">Трейд-ин</option>
      </select><ChevronDown size={14} /></label>
      <label className="aba-period-label" htmlFor="month-select">Месяц</label>
      <label className="aba-select-wrap"><span className="sr-only">Выбрать месяц</span><select id="month-select" value={monthControl} onChange={event => setMonth(event.target.value)} aria-label="Месяц" data-testid="select-month">
         <option value="all">Все месяцы</option>{months.slice(0, data.latestMonth + 1).map((month, index) => <option key={month} value={index}>{month}{index === data.latestMonth ? ` · по ${data.latestDate.slice(8, 10)}` : ""}</option>)}
      </select><ChevronDown size={14} /></label>
        <div className="aba-ytd"><span className="aba-ytd-dot" />С начала года <b>01.01 — {formatDate(data.latestDate)}</b></div>
    </section>
    <section className="aba-kpis" aria-label="Итоги с начала года">
        <div className="aba-kpi-intro"><span>ИТОГО · ВСЕ АВТО</span><strong>С начала года</strong><small>Включая АСП<br />с пробегом</small></div>
      {(["sales","traffic","contracts","revenue","trading"] as Metric[]).map(key => {
          const actual = allVehiclesActual(data, key);
          const plan = allVehiclesPlan(data, key);
        const pct = plan > 0 ? Math.round(actual / plan * 100) : 0;
        const active = metric === key;
        return <button key={key} type="button" className={`aba-kpi ${active ? "is-current" : ""}`} onClick={() => setMetric(key)} aria-pressed={active} data-testid={`kpi-${key}`}>
          <span className="aba-kpi-label">{metricInfo[key].label}</span><strong>{displayMetric(actual, key)}</strong>
          <span className="aba-kpi-foot"><span className="aba-attain">{pct}%</span><span>план {pct >= 90 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}</span><em>{displayMetric(plan, key)}</em></span>
          <span className="aba-progress"><i style={{ width: `${Math.min(pct, 100)}%` }} /></span>
        </button>;
      })}
    </section>
    <section className="aba-panel aba-trend" aria-labelledby="trend-title">
       <div className="aba-section-heading"><div><h2 id="trend-title">Месячный тренд</h2><p>Выбранные бренды, включая АСП</p></div><div className="aba-chart-caption"><span className="aba-caption-value">{displayMetric(chartBrandsTotal, metric)}</span><span>{chartBrandsLabel}</span></div></div>
       <Chart data={data} metric={metric} selectedMonth={selectedMonth} visibleBrandIds={visibleBrandIds} onVisibleBrandIdsChange={setVisibleBrandIds} onMonth={month => { setSelectedMonth(month); setMonthControl(String(month)); }} />
    </section>
    <section className="aba-panel aba-heat-panel" aria-labelledby="matrix-title">
      <div className="aba-section-heading aba-matrix-heading">
          <div><h2 id="matrix-title">Бренд × месяц</h2><p>{heatMode === "plan" ? "Факт за месяц ÷ полный месячный план" : `Факт: ${metricInfo[metric].label.toLowerCase()} за месяц`}</p></div>
        <div className="aba-matrix-tools">
          <div className="aba-mode-switch" role="group" aria-label="Режим тепловой карты">
            <button type="button" className={heatMode === "plan" ? "is-active" : ""} aria-pressed={heatMode === "plan"} onClick={() => setHeatMode("plan")} data-testid="matrix-mode-plan">Выполнение плана</button>
            <button type="button" className={heatMode === "fact" ? "is-active" : ""} aria-pressed={heatMode === "fact"} onClick={() => setHeatMode("fact")} data-testid="matrix-mode-fact">Факт</button>
          </div>
          <div className="aba-scale"><span>{heatMode === "plan" ? "ниже плана" : "меньше"}</span><i className="tone-1" /><i className="tone-2" /><i className="tone-3" /><i className="tone-4" /><i className="tone-5" /><span>{heatMode === "plan" ? "выше плана" : "больше"}</span></div>
        </div>
      </div>
      <div className="aba-matrix-scroll"><div className="aba-matrix">
         <div className="aba-matrix-row aba-matrix-head"><div className="aba-brand-cell">БРЕНД</div>{months.map((month, index) => <div className={`aba-month-cell ${index === data.latestMonth ? "is-partial" : ""} ${index > data.latestMonth ? "is-future" : ""}`} key={month}>{month}{index === data.latestMonth && <small>{data.latestDate.slice(8, 10)} дн.</small>}</div>)}<div className="aba-total-head">ИТОГО</div></div>
        {activeBrands.map(brand => {
          const total = ytdValue(brand.id);
          const selected = selectedBrand === brand.id;
          return <div key={brand.id} className={`aba-matrix-row ${selected ? "is-focused" : ""}`} data-testid={`row-brand-${brand.id}`}>
            <button type="button" className="aba-brand-cell aba-brand-button" onClick={() => setSelectedBrand(selected ? null : brand.id)} data-testid={`focus-brand-${brand.id}`}><i style={{ background: brand.color }} />{brand.name}</button>
            {months.map((month, index) => {
              const future = index > data.latestMonth;
              const value = future ? null : cellValue(brand.id, index);
              const detail = value === null ? "нет плана" : heatMode === "plan" ? `${value}% плана` : displayMetric(value, metric);
              return future
                ? <div className="aba-month-cell aba-unavailable" key={month} aria-label={`${brand.name}, ${month}: данные ещё недоступны`}><span>·</span></div>
                 : <button type="button" key={month} className={`aba-month-cell aba-heat-cell ${tone(value)} ${index === data.latestMonth ? "is-partial" : ""} ${selectedMonth === index && selected ? "is-selected" : ""}`} onClick={() => selectCell(brand.id, index)} aria-label={`${brand.name}, ${month}: ${detail}`} title={`${brand.name} · ${month}: ${detail}`} data-testid={`cell-${brand.id}-${index}`}>{displayCell(value)}</button>;
            })}
            <div className="aba-total-cell">{displayCell(total)}</div>
          </div>;
        })}
        <div className="aba-matrix-row aba-group-row"><div className="aba-brand-cell">Новые авто</div>{months.map((month, index) => {
          const value = index <= data.latestMonth ? groupCellValue(index) : null;
          return <div key={month} className={`aba-month-cell ${index > data.latestMonth ? "aba-unavailable" : `aba-group-value ${index === data.latestMonth ? "is-partial" : ""}`}`}>{value === null ? "·" : displayCell(value)}</div>;
        })}<div className="aba-total-cell">{heatMode === "plan" ? `${attainment}%` : displayMetric(factTotal, metric)}</div></div>
      </div></div>
      {selectedBrand && <div className="aba-selection-note"><i style={{ background: brands.find(brand => brand.id === selectedBrand)?.color }} />В фокусе: <b>{brandLabel}</b>{selectedMonth !== null && <span> · {months[selectedMonth]} 2026</span>}<button type="button" onClick={() => { setSelectedBrand(null); setSelectedMonth(null); setMonthControl("all"); }} data-testid="button-clear-focus">Сбросить фокус</button></div>}
       <div className="aba-footnote"><Info size={14} /><span>Факты и планы из JSON по {formatDate(data.latestDate)}. АСП не входит в строку «Новые авто» и долю рынка. Будущих фактических данных нет.</span><span className="aba-footnote-right">{heatMode === "plan" ? "% выполнения" : metricInfo[metric].unit}</span></div>
    </section>
    <MarketPanel />
     <CompetitorSalesPanel />
    <footer className="aba-footer"><span>Внутренний отчёт · Авто Прайм</span><span>Бренды: JSON · до {formatDate(data.latestDate)} · рынок: Excel · январь—сентябрь 2026</span></footer>
  </main>;
}

export default AnnualBrandDashboard;
