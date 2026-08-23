// js/core/dashboard-calculations.js
import { calculatePercentage } from '../utils/formatters.js';

export class DashboardCalculations {
    constructor() {
        // Факторы брендов для корректировки прогнозов
        this.brandFactors = {
            'hc': { sales: 1.05, traffic: 1.02, contracts: 1.08, trading: 1.06 },
            'hp': { sales: 0.95, traffic: 0.98, contracts: 1.05, trading: 1.04 },
            'jt': { sales: 0.90, traffic: 0.95, contracts: 1.10, trading: 1.08 },
            'ch': { sales: 1.00, traffic: 1.00, contracts: 1.07, trading: 1.05 },
            'om': { sales: 1.10, traffic: 1.05, contracts: 1.12, trading: 1.10 },
            'jk': { sales: 0.85, traffic: 0.90, contracts: 1.15, trading: 1.12 },
            'asp': { sales: 1.08, traffic: 1.03, contracts: 1.06, trading: 1.04 },
            'se':  { sales: 1.00, traffic: 1.00, contracts: 1.00, trading: 1.00 }  // Соуист
        };
        
        // Сезонные коэффициенты по месяцам
        this.seasonalityFactors = {
            1: 0.85, 2: 0.90, 3: 1.05, 4: 1.10,
            5: 1.15, 6: 1.10, 7: 0.95, 8: 0.90,
            9: 1.20, 10: 1.25, 11: 1.15, 12: 1.30
        };
    }
    
    /**
     * Рассчитывает прогноз на конец месяца
     */
    calculateForecast(fact, plan, type, day, daysInMonth, brandKey = '') {
        // Нет данных — базовый прогноз от плана
        if (fact === 0) return Math.round(plan * 0.3);
        
        const daysLeft = daysInMonth - day;
        if (daysLeft <= 0) return fact;
        
        // Защита от деления на ноль
        if (day <= 0) return fact;
        
        // Отрицательный факт (возвраты, сторно) — проецируем текущий темп
        if (fact < 0) {
            const dailyRate = fact / day;
            return Math.round(fact + dailyRate * daysLeft);
        }
        
        const dailyRate = fact / day;
        const typeFactor = this.getTypeFactor(type);
        const planCompletion = plan > 0 ? fact / plan : 0;
        const completionFactor = this.getCompletionFactor(planCompletion);
        const seasonalityFactor = this.getSeasonalityFactor(day, daysInMonth);
        const brandFactor = this.brandFactors[brandKey] ? this.brandFactors[brandKey][type] || 1.0 : 1.0;
        
        const remainingForecast = dailyRate * typeFactor * completionFactor * seasonalityFactor * brandFactor * daysLeft;
        let forecast = fact + remainingForecast;
        
        const maxForecast = plan > 0 ? plan * 1.5 : fact * 2.0;
        forecast = Math.min(forecast, maxForecast);
        forecast = Math.max(forecast, fact);
        
        return Math.round(forecast);
    }
    
    /**
     * Рассчитывает прогноз дохода
     */
    calculateRevenueForecast(salesFact, salesPlan, revenueFact, revenuePlan, day, daysInMonth, brandKey) {
        // Отрицательная выручка (возвраты превышают продажи) — проецируем по дневному темпу
        if (revenueFact < 0 && day > 0) {
            const daysLeft = daysInMonth - day;
            if (daysLeft <= 0) return revenueFact;
            const dailyRevRate = revenueFact / day;
            const forecast = Math.round(revenueFact + dailyRevRate * daysLeft);
            // Прогноз не может быть лучше текущего факта (уже понесённые потери)
            return Math.min(forecast, revenueFact);
        }
        
        const salesForecast = this.calculateForecast(salesFact, salesPlan, 'sales', day, daysInMonth, brandKey);
        const currentAvgPrice = salesFact > 0 ? revenueFact / salesFact : 0;
        const planAvgPrice = salesPlan > 0 ? revenuePlan / salesPlan : currentAvgPrice;
        // Используем реальную среднюю цену без искусственного минимума
        const forecastAvgPrice = currentAvgPrice > 0
            ? Math.max(currentAvgPrice, planAvgPrice * 0.25)
            : planAvgPrice * 0.25;
        const revenueForecast = salesForecast * forecastAvgPrice;
        const finalForecast = Math.max(Math.round(revenueForecast), Math.round(revenueFact));
        
        return finalForecast;
    }
    
    /**
     * Возвращает коэффициент типа метрики
     */
    getTypeFactor(type) {
        const factors = { sales: 1.05, traffic: 1.02, contracts: 1.10, trading: 1.08, revenue: 1.07 };
        return factors[type] || 1.0;
    }
    
    /**
     * Возвращает коэффициент выполнения плана
     */
    getCompletionFactor(planCompletion) {
        if (planCompletion > 1.0) return 1.02;
        if (planCompletion > 0.8) return 1.05;
        if (planCompletion > 0.6) return 1.0;
        return 1.1;
    }
    
    /**
     * Возвращает сезонный коэффициент
     */
    getSeasonalityFactor(day, daysInMonth) {
        const progress = day / daysInMonth;
        if (progress <= 0.3) return 0.9;
        if (progress <= 0.6) return 1.0;
        if (progress <= 0.8) return 1.1;
        return 1.2;
    }
    
    /**
     * Динамический прогноз по признакам из дневного JSON.
     * План намеренно не используется в основной формуле.
     */
    calculateFeatureForecast(fact, type, day, daysInMonth, brandKey, dailyFacts, targetMonth) {
            if (!Array.isArray(dailyFacts) || !targetMonth || day <= 0 || daysInMonth <= day) return Math.round(Number(fact) || 0);
            const metrics = ['sales', 'traffic', 'contracts', 'trading', 'revenue'];
            if (!metrics.includes(type)) return Math.round(Number(fact) || 0);

            const rows = dailyFacts.filter(row => row && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
            const monthOf = row => row.date.substring(0, 7);
            const dayOf = row => parseInt(row.date.substring(8, 10), 10);
            const isWeekend = row => { const weekday = new Date(row.date + 'T12:00:00').getDay(); return weekday === 0 || weekday === 6; };
            const seasonOf = month => {
                const monthNumber = parseInt(month.substring(5, 7), 10);
                if (monthNumber === 12 || monthNumber <= 2) return 'winter';
                if (monthNumber <= 4) return 'spring';
                if (monthNumber <= 8) return 'summer';
                return 'autumn';
            };
            const value = row => Number(row[brandKey]?.[type]) || 0;
            const groupValue = row => Object.keys(row)
                .filter(key => key !== 'date' && key !== 'month' && row[key] && typeof row[key] === 'object')
                .reduce((total, key) => total + (Number(row[key]?.[type]) || 0), 0);
            const sum = values => values.reduce((total, item) => total + item, 0);
            const average = values => values.length ? sum(values) / values.length : 0;
            const median = values => {
                if (!values.length) return 0;
                const sorted = [...values].sort((a, b) => a - b);
                const middle = Math.floor(sorted.length / 2);
                return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
            };
            const smooth = values => {
                if (values.length < 4) return values;
                const center = median(values);
                const deviation = median(values.map(item => Math.abs(item - center))) || Math.max(1, Math.abs(center) * 0.1);
                return values.map(item => Math.max(center - 3 * deviation, Math.min(center + 3 * deviation, item)));
            };
            const clamp = (number, min, max) => Math.max(min, Math.min(max, Number.isFinite(number) ? number : 1));
            const targetRows = rows.filter(row => monthOf(row) === targetMonth && dayOf(row) <= day);
            const priorMonths = [...new Set(rows.map(monthOf))].filter(month => month < targetMonth).sort();
            const seasonalMonths = priorMonths.filter(month => seasonOf(month) === seasonOf(targetMonth));
            const historyMonths = (seasonalMonths.length ? seasonalMonths : priorMonths).slice(-3);
            const historyRows = rows.filter(row => historyMonths.includes(monthOf(row)));
            const futureRows = Array.from({ length: Math.max(0, daysInMonth - day) }, (_, index) => ({ date: targetMonth + '-' + String(day + index + 1).padStart(2, '0') }));
            const currentValues = smooth(targetRows.map(value));
            const currentFact = Number.isFinite(Number(fact)) ? Number(fact) : sum(currentValues);
            const fallbackRate = day > 0 ? currentFact / day : 0;
            const rates = { weekday: [], weekend: [] };
            const historicalRates = { weekday: [], weekend: [] };
            targetRows.forEach(row => rates[isWeekend(row) ? 'weekend' : 'weekday'].push(value(row)));
            historyRows.forEach(row => historicalRates[isWeekend(row) ? 'weekend' : 'weekday'].push(value(row)));
            const expectedRate = kind => {
                const current = average(smooth(rates[kind]));
                const historical = average(smooth(historicalRates[kind]));
                if (current && historical) return current * 0.75 + historical * 0.25;
                return current || historical || fallbackRate;
            };
            // Прогноз строится только по бренду. ГК не имеет собственной модели:
            // итог ГК формируется суммированием результатов брендов в dashboard-core.
            const brandRemaining = sum(futureRows.map(row => expectedRate(isWeekend(row) ? 'weekend' : 'weekday')));

            const period = monthRows => {
                const early = monthRows.filter(row => dayOf(row) <= day).map(value);
                const late = monthRows.filter(row => dayOf(row) > day).map(value);
                return { early: average(smooth(early)), late: average(smooth(late)) };
            };
            const brandPeriod = period(historyRows);
            const brandFactor = brandPeriod.early > 0 && brandPeriod.late > 0 ? brandPeriod.late / brandPeriod.early : 1;
            const seasonalCorrection = historyMonths.length >= 2 ? clamp(brandFactor, 0.9, 1.1) : 1;
            const recent = smooth(currentValues.slice(-Math.min(7, currentValues.length)));
            const previous = smooth(currentValues.slice(-Math.min(14, currentValues.length), -Math.min(7, currentValues.length)));
            const trendRatio = previous.length && average(previous) > 0 ? average(recent) / average(previous) : 1;
            const trendCorrection = type === 'traffic'
                ? clamp(1 + 0.15 * (clamp(trendRatio, 0.85, 1.15) - 1), 0.95, 1.05)
                : clamp(1 + 0.1 * (clamp(trendRatio, 0.9, 1.1) - 1), 0.97, 1.03);

            // Трафик — самостоятельная модель: календарный темп важнее истории и не зависит от конверсии.
            if (type === 'traffic') {
                return Math.max(Math.round(currentFact), Math.round(currentFact + brandRemaining * seasonalCorrection * trendCorrection));
            }
            // Контракты и трейдинг — консервативный baseline без конверсии и без планов.
            if (type === 'contracts' || type === 'trading') {
                return Math.max(Math.round(currentFact), Math.round(currentFact + brandRemaining * clamp(seasonalCorrection, 0.95, 1.05) * trendCorrection));
            }
            // Продажи используют сезонный профиль, но не конверсию.
            if (type === 'sales') {
                return Math.max(Math.round(currentFact), Math.round(currentFact + brandRemaining * seasonalCorrection * trendCorrection));
            }
            // Выручка прогнозируется напрямую по revenue, включая отрицательные дневные значения.
            return Math.round(currentFact + brandRemaining * seasonalCorrection * trendCorrection);
        }
        /**
     * Рассчитывает оценку динамики (1-5 баллов)
     */
    getDynamicsScore(current, plan, daysPassed, totalDays) {
        if (plan <= 0) return 0;
        
        const targetForPeriod = (plan / totalDays) * daysPassed;
        const completionPercent = (current / targetForPeriod) * 100;
        
        if (completionPercent >= 120) return 5.0;
        if (completionPercent >= 110) return 4.5;
        if (completionPercent >= 100) return 4.0;
        if (completionPercent >= 90) return 3.5;
        if (completionPercent >= 80) return 3.0;
        if (completionPercent >= 70) return 2.5;
        if (completionPercent >= 60) return 2.0;
        if (completionPercent >= 50) return 1.5;
        if (completionPercent >= 40) return 1.0;
        return 0.5;
    }
    
    /**
     * Рассчитывает оценку конверсии (1-5 баллов)
     */
    getConversionScore(plannedSales, plannedTraffic, actualSales, actualTraffic) {
        if (plannedTraffic <= 0 || actualTraffic <= 0) return 1.0;
        
        const plannedConversion = (plannedSales / plannedTraffic) * 100;
        const actualConversion = (actualSales / actualTraffic) * 100;
        
        if (plannedConversion === 0) return 1.0;
        
        const deviationPercent = (actualConversion / plannedConversion) * 100;
        
        if (deviationPercent >= 120) return 5.0;
        if (deviationPercent >= 110) return 4.5;
        if (deviationPercent >= 100) return 4.0;
        if (deviationPercent >= 90) return 3.5;
        if (deviationPercent >= 80) return 3.0;
        if (deviationPercent >= 70) return 2.5;
        if (deviationPercent >= 60) return 2.0;
        if (deviationPercent >= 50) return 1.5;
        if (deviationPercent >= 40) return 1.0;
        return 0.5;
    }
    
    /**
     * Рассчитывает данные для одного бренда
     */
    calculateBrandData(brand, getInputValue, day, daysInMonth) {
        const data = {
            sales: { fact: getInputValue(brand.key, 'sf'), plan: getInputValue(brand.key, 'sp') },
            traffic: { fact: getInputValue(brand.key, 'tf'), plan: getInputValue(brand.key, 'tp') },
            revenue: { fact: getInputValue(brand.key, 'rf'), plan: getInputValue(brand.key, 'rp') },
            contracts: { fact: getInputValue(brand.key, 'cf'), plan: getInputValue(brand.key, 'cp') },
            trading: { fact: getInputValue(brand.key, 'trf'), plan: getInputValue(brand.key, 'trp') }
        };
        
        const salesForecast = this.calculateForecast(data.sales.fact, data.sales.plan, 'sales', day, daysInMonth, brand.key);
        const trafficForecast = this.calculateForecast(data.traffic.fact, data.traffic.plan, 'traffic', day, daysInMonth, brand.key);
        const revenueForecast = this.calculateRevenueForecast(data.sales.fact, data.sales.plan, data.revenue.fact, data.revenue.plan, day, daysInMonth, brand.key);
        const contractsForecast = this.calculateForecast(data.contracts.fact, data.contracts.plan, 'contracts', day, daysInMonth, brand.key);
        const tradingForecast = this.calculateForecast(data.trading.fact, data.trading.plan, 'trading', day, daysInMonth, brand.key);
        
        const salesPercent = calculatePercentage(data.sales.fact, data.sales.plan);
        const salesForecastPercent = calculatePercentage(salesForecast, data.sales.plan);
        const trafficPercent = calculatePercentage(data.traffic.fact, data.traffic.plan);
        const trafficForecastPercent = calculatePercentage(trafficForecast, data.traffic.plan);
        const revenuePercent = calculatePercentage(data.revenue.fact, data.revenue.plan);
        const revenueForecastPercent = calculatePercentage(revenueForecast, data.revenue.plan);
        const contractsPercent = calculatePercentage(data.contracts.fact, data.contracts.plan);
        const contractsForecastPercent = calculatePercentage(contractsForecast, data.contracts.plan);
        const tradingPercent = calculatePercentage(data.trading.fact, data.trading.plan);
        const tradingForecastPercent = calculatePercentage(tradingForecast, data.trading.plan);
        
        const salesConversionPercent = data.traffic.fact > 0 ? parseFloat(((data.sales.fact / data.traffic.fact) * 100).toFixed(1)) : 0;
        const tradingCoveragePercent = data.sales.fact > 0 ? parseFloat(((data.trading.fact / data.sales.fact) * 100).toFixed(1)) : 0;
        
        const salesDynamicsScore = this.getDynamicsScore(data.sales.fact, data.sales.plan, day, daysInMonth);
        const trafficDynamicsScore = this.getDynamicsScore(data.traffic.fact, data.traffic.plan, day, daysInMonth);
        const revenueDynamicsScore = this.getDynamicsScore(data.revenue.fact, data.revenue.plan, day, daysInMonth);
        const contractsDynamicsScore = this.getDynamicsScore(data.contracts.fact, data.contracts.plan, day, daysInMonth);
        const tradingDynamicsScore = this.getDynamicsScore(data.trading.fact, data.trading.plan, day, daysInMonth);
        const conversionScore = this.getConversionScore(data.sales.plan, data.traffic.plan, data.sales.fact, data.traffic.fact);
        
        const radarMetrics = {
            sales_dynamics: salesDynamicsScore,
            traffic_dynamics: trafficDynamicsScore,
            revenue_dynamics: revenueDynamicsScore,
            conversion: conversionScore,
            contracts_dynamics: contractsDynamicsScore,
            trading_dynamics: tradingDynamicsScore
        };
        
        const radarScore = Object.values(radarMetrics).reduce((a, b) => a + b, 0) / Object.keys(radarMetrics).length;
        
        return {
            brand, data,
            salesForecast, trafficForecast, revenueForecast, contractsForecast, tradingForecast,
            salesPercent, salesForecastPercent, trafficPercent, trafficForecastPercent,
            revenuePercent, revenueForecastPercent, contractsPercent, contractsForecastPercent,
            tradingPercent, tradingForecastPercent, salesConversionPercent, tradingCoveragePercent,
            radarMetrics, radarScore
        };
    }
    
    /**
     * Рассчитывает общие итоги по всем брендам
     */
    calculateTotals(brandForecasts) {
        const totals = {
            sales: { fact: 0, plan: 0 },
            traffic: { fact: 0, plan: 0 },
            revenue: { fact: 0, plan: 0 },
            contracts: { fact: 0, plan: 0 },
            trading: { fact: 0, plan: 0 }
        };
        
        const forecastTotals = {
            sales: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            traffic: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            revenue: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            contracts: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            trading: { totalFact: 0, totalPlan: 0, totalForecast: 0 }
        };
        
        brandForecasts.forEach(item => {
            const { data, salesForecast, trafficForecast, revenueForecast, contractsForecast, tradingForecast } = item;
            
            forecastTotals.sales.totalFact += data.sales.fact;
            forecastTotals.sales.totalPlan += data.sales.plan;
            forecastTotals.sales.totalForecast += salesForecast;
            
            forecastTotals.traffic.totalFact += data.traffic.fact;
            forecastTotals.traffic.totalPlan += data.traffic.plan;
            forecastTotals.traffic.totalForecast += trafficForecast;
            
            forecastTotals.revenue.totalFact += data.revenue.fact;
            forecastTotals.revenue.totalPlan += data.revenue.plan;
            forecastTotals.revenue.totalForecast += revenueForecast;
            
            forecastTotals.contracts.totalFact += data.contracts.fact;
            forecastTotals.contracts.totalPlan += data.contracts.plan;
            forecastTotals.contracts.totalForecast += contractsForecast;
            
            forecastTotals.trading.totalFact += data.trading.fact;
            forecastTotals.trading.totalPlan += data.trading.plan;
            forecastTotals.trading.totalForecast += tradingForecast;
            
            totals.sales.fact += data.sales.fact;
            totals.sales.plan += data.sales.plan;
            totals.traffic.fact += data.traffic.fact;
            totals.traffic.plan += data.traffic.plan;
            totals.revenue.fact += data.revenue.fact;
            totals.revenue.plan += data.revenue.plan;
            totals.contracts.fact += data.contracts.fact;
            totals.contracts.plan += data.contracts.plan;
            totals.trading.fact += data.trading.fact;
            totals.trading.plan += data.trading.plan;
        });
        
        return { totals, forecastTotals };
    }
}