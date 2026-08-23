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
        if (!Array.isArray(dailyFacts) || !targetMonth || day <= 0 || daysInMonth <= day) return Math.round(fact);
        const metrics = ['sales', 'traffic', 'contracts', 'trading', 'revenue'];
        if (!metrics.includes(type)) return Math.round(fact);
        const rows = dailyFacts.filter(row => row && row.date);
        const monthKey = row => row.date.substring(0, 7);
        const dayNumber = row => parseInt(row.date.substring(8, 10), 10);
        const isWeekend = row => { const weekday = new Date(row.date + 'T12:00:00').getDay(); return weekday === 0 || weekday === 6; };
        const value = row => Number(row[brandKey]?.[type] || 0);
        const targetRows = rows.filter(row => monthKey(row) === targetMonth && dayNumber(row) <= day);
        const priorMonths = [...new Set(rows.map(monthKey))].filter(month => month < targetMonth).sort().slice(-6);
        const priorRows = rows.filter(row => priorMonths.includes(monthKey(row)));
        const remainingRows = rows.filter(row => monthKey(row) === targetMonth && dayNumber(row) > day);
        const fallbackRate = fact / day;
        const rates = (sourceRows, weekend) => {
            const selected = sourceRows.filter(row => isWeekend(row) === weekend);
            return selected.length ? selected.reduce((total, row) => total + value(row), 0) / selected.length : null;
        };
        const currentWeekday = rates(targetRows, false);
        const currentWeekend = rates(targetRows, true);
        const historyWeekday = rates(priorRows, false);
        const historyWeekend = rates(priorRows, true);
        const blendedRate = weekend => {
            const current = weekend ? currentWeekend : currentWeekday;
            const history = weekend ? historyWeekend : historyWeekday;
            if (current !== null && history !== null) return current * 0.65 + history * 0.35;
            if (current !== null) return current;
            if (history !== null) return history;
            return fallbackRate;
        };
        const periodCoefficient = (brand, metric) => {
            const early = priorRows.filter(row => dayNumber(row) <= day && row[brand]?.[metric] !== undefined);
            const late = priorRows.filter(row => dayNumber(row) > day && row[brand]?.[metric] !== undefined);
            const earlyRate = early.length ? early.reduce((total, row) => total + Number(row[brand]?.[metric] || 0), 0) / early.length : 0;
            const lateRate = late.length ? late.reduce((total, row) => total + Number(row[brand]?.[metric] || 0), 0) / late.length : 0;
            const groupEarly = priorRows.filter(row => dayNumber(row) <= day).reduce((total, row) => total + brandsValue(row, metric), 0);
            const groupLate = priorRows.filter(row => dayNumber(row) > day).reduce((total, row) => total + brandsValue(row, metric), 0);
            const groupEarlyRows = priorRows.filter(row => dayNumber(row) <= day).length;
            const groupLateRows = priorRows.filter(row => dayNumber(row) > day).length;
            const individual = earlyRate > 0 && lateRate > 0 ? lateRate / earlyRate : null;
            const group = groupEarly > 0 && groupLate > 0 ? (groupLate / (groupLateRows || 1)) / (groupEarly / (groupEarlyRows || 1)) : 1;
            let coefficient = individual === null ? group : individual * 0.6 + group * 0.4;
            if (metric === 'revenue' && (individual === null || coefficient <= 0)) coefficient = group;
            return Math.max(0.8, Math.min(2, Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1));
        };
        const brandsValue = (row, metric) => Object.keys(row).filter(key => key !== 'date').reduce((total, key) => total + Number(row[key]?.[metric] || 0), 0);
        const previousRows = targetRows.filter(row => dayNumber(row) >= Math.max(1, day - 13) && dayNumber(row) <= day - 7);
        const recentRows = targetRows.filter(row => dayNumber(row) >= Math.max(1, day - 6) && dayNumber(row) <= day);
        const previousTotal = previousRows.reduce((total, row) => total + value(row), 0);
        const recentTotal = recentRows.reduce((total, row) => total + value(row), 0);
        const rawTrend = previousTotal > 0 ? recentTotal / previousTotal : 1;
        const trend = Math.max(0.7, Math.min(1.3, rawTrend));
        const trendFactor = 1 + 0.2 * (trend - 1);
        const coefficient = periodCoefficient(brandKey, type);
        const projectedRemaining = remainingRows.reduce((total, row) => total + blendedRate(isWeekend(row)) * trendFactor * coefficient, 0);
        return Math.max(Number(fact) || 0, Math.round((Number(fact) || 0) + projectedRemaining));
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