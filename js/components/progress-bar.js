// js/components/progress-bar.js
import { formatNumber, formatRevenueForProgressBar, formatRevenue } from '../utils/formatters.js';

export const createProgressBar = (type, fact, plan, forecast, factPercent, forecastPercent) => {
    let factValue, forecastValue;
    
    if (type === 'revenue') {
        factValue = `${formatRevenueForProgressBar(fact)}/${formatRevenueForProgressBar(plan)}`;
        forecastValue = `${formatRevenueForProgressBar(forecast)}`;
    } else {
        factValue = `${formatNumber(fact)}/${formatNumber(plan)}`;
        forecastValue = formatNumber(forecast);
    }
    
    const forecastPercentValue = Math.min(forecastPercent, 150);
    const factPercentValue = Math.min(factPercent, 100);
    
    // Для переполнения (более 85%) текст остается видимым слева
    const isOverflow = factPercent > 85;
    const factStyle = isOverflow 
        ? 'width: 100%; justify-content: flex-start; padding-left: 8px; padding-right: 0;' 
        : `width: ${factPercentValue}%; justify-content: flex-end; padding-right: 12px;`;
    
    return `
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-forecast ${type}-forecast" style="width: ${forecastPercentValue}%"></div>
                <div class="progress-fact ${type}" style="${factStyle}">
                    ${factValue}
                </div>
                <div class="forecast-percent-badge">${forecastPercent}%</div>
            </div>
            <div class="progress-labels">
                <span class="progress-label-left">
                    Прогноз: ${type === 'revenue' ? formatRevenue(forecast) : forecastValue} (${forecastPercent}%)
                </span>
            </div>
        </div>
    `;
};
