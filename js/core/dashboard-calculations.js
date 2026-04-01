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
            'asp': { sales: 1.08, traffic: 1.03, contracts: 1.06, trading: 1.04 }
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
        if (fact <= 0) return Math.round(plan * 0.3);
        
        const daysLeft = daysInMonth - day;
        if (daysLeft <= 0) return fact;
        
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
        const salesForecast = this.calculateForecast(salesFact, salesPlan, 'sales', day, daysInMonth, brandKey);
        const currentAvgPrice = salesFact > 0 ? revenueFact / salesFact : 0;
        const planAvgPrice = salesPlan > 0 ? revenuePlan / salesPlan : currentAvgPrice;
        const forecastAvgPrice = Math.max(currentAvgPrice, planAvgPrice * 0.25);
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