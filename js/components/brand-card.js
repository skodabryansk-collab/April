// js/components/brand-card.js
import { createProgressBar } from './progress-bar.js';
import { formatNumber, formatDecimal, formatRevenue, renderStars } from '../utils/formatters.js';

export const createBrandCard = (item, day, daysInMonth, showForecast = true) => {
    const { brand, data, salesPercent, salesForecastPercent, trafficPercent, trafficForecastPercent,
            revenuePercent, revenueForecastPercent, contractsPercent, contractsForecastPercent,
            tradingPercent, tradingForecastPercent, salesConversionPercent, tradingCoveragePercent,
            radarScore, salesForecast, trafficForecast, revenueForecast, contractsForecast, tradingForecast } = item;
    
    const salesLevel = getLevelByPercent(salesForecastPercent);
    const trafficLevel = getLevelByPercent(trafficForecastPercent);
    const revenueLevel = getLevelByPercent(revenueForecastPercent);
    const contractsLevel = getLevelByPercent(contractsForecastPercent);
    const tradingLevel = getLevelByPercent(tradingForecastPercent);
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <h2>${brand.name} ${renderStars(radarScore)}</h2>
        
        <div class="metric-section">
            <div class="metric-header">
                <div class="metric-title">
                    <span>ПРОДАЖИ</span>
                    ${showForecast ? `<span class="forecast-badge ${salesLevel.level}">${salesLevel.text}</span>` : ''}
                </div>
                <div class="fact-percent">${salesPercent}%</div>
            </div>
            ${createProgressBar('sales', data.sales.fact, data.sales.plan, salesForecast, salesPercent, salesForecastPercent)}
            <div class="metric-details">
                <div class="detail-item">
                    <span class="detail-label">Конверсия:</span>
                    <span class="detail-value">${formatDecimal(salesConversionPercent, 1)}%</span>
                </div>
                ${showForecast ? `
                <div class="detail-item">
                    <span class="detail-label">Темп в день:</span>
                    <span class="detail-value">${formatDecimal(data.sales.fact / day, 1)}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="metric-section">
            <div class="metric-header">
                <div class="metric-title">
                    <span>БАНК КОНТРАКТОВ</span>
                    ${showForecast ? `<span class="forecast-badge ${contractsLevel.level}">${contractsLevel.text}</span>` : ''}
                </div>
                <div class="fact-percent">${contractsPercent}%</div>
            </div>
            ${createProgressBar('contracts', data.contracts.fact, data.contracts.plan, contractsForecast, contractsPercent, contractsForecastPercent)}
            <div class="metric-details">
                <div class="detail-item">
                    <span class="detail-label">% контракт:</span>
                    <span class="detail-value">${data.traffic.fact > 0 ? formatDecimal((data.contracts.fact / data.traffic.fact * 100), 1) : 0}%</span>
                </div>
                ${showForecast ? `
                <div class="detail-item">
                    <span class="detail-label">Темп в день:</span>
                    <span class="detail-value">${formatDecimal(data.contracts.fact / day, 1)}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="metric-section">
            <div class="metric-header">
                <div class="metric-title">
                    <span>КОЛ-ВО ТРЕЙДИН</span>
                    ${showForecast ? `<span class="forecast-badge ${tradingLevel.level}">${tradingLevel.text}</span>` : ''}
                </div>
                <div class="fact-percent">${tradingPercent}%</div>
            </div>
            ${createProgressBar('trading', data.trading.fact, data.trading.plan, tradingForecast, tradingPercent, tradingForecastPercent)}
            <div class="metric-details">
                <div class="detail-item">
                    <span class="detail-label">%Трейдин (охват):</span>
                    <span class="detail-value">${formatDecimal(tradingCoveragePercent, 1)}%</span>
                </div>
                ${showForecast ? `
                <div class="detail-item">
                    <span class="detail-label">Темп в день:</span>
                    <span class="detail-value">${formatDecimal(data.trading.fact / day, 1)}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="metric-section">
            <div class="metric-header">
                <div class="metric-title">
                    <span>ТРАФИК</span>
                    ${showForecast ? `<span class="forecast-badge ${trafficLevel.level}">${trafficLevel.text}</span>` : ''}
                </div>
                <div class="fact-percent">${trafficPercent}%</div>
            </div>
            ${createProgressBar('traffic', data.traffic.fact, data.traffic.plan, trafficForecast, trafficPercent, trafficForecastPercent)}
            ${showForecast ? `
            <div class="metric-details">
                <div class="detail-item">
                    <span class="detail-label">Темп в день:</span>
                    <span class="detail-value">${formatDecimal(data.traffic.fact / day, 1)}</span>
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="metric-section">
            <div class="metric-header">
                <div class="metric-title">
                    <span>ДОХОД, МЛН.</span>
                    ${showForecast ? `<span class="forecast-badge ${revenueLevel.level}">${revenueLevel.text}</span>` : ''}
                </div>
                <div class="fact-percent">${revenuePercent}%</div>
            </div>
            ${createProgressBar('revenue', data.revenue.fact, data.revenue.plan, revenueForecast, revenuePercent, revenueForecastPercent)}
            ${showForecast ? `
            <div class="metric-details">
                <div class="detail-item">
                    <span class="detail-label">Темп в день:</span>
                    <span class="detail-value">${formatRevenue(data.revenue.fact / day)}</span>
                </div>
            </div>
            ` : ''}
        </div>
        
        <div style="margin-top:15px; padding-top:15px; border-top:1px solid #e9ecef;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:12px; color:#666;">Оценка динамики:</div>
                <div style="font-size:16px; font-weight:bold; color:${radarScore >= 4 ? '#2e7d32' : radarScore >= 3 ? '#ff9800' : '#d32f2f'}">
                    ${formatDecimal(radarScore, 1)}/5.0
                </div>
            </div>
            <div style="font-size:11px; color:#666; margin-top:5px;">
                ${showForecast ? `На основе темпа выполнения на ${day}/${daysInMonth} день` : `На основе данных за выбранный период`}
            </div>
        </div>
    `;
    
    return card;
};

function getLevelByPercent(percent) {
    if (percent >= 100) return { level: 'high', text: 'Высокий' };
    if (percent >= 70) return { level: 'medium', text: 'Средний' };
    return { level: 'low', text: 'Низкий' };
}
