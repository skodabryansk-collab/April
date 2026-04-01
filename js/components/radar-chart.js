// js/components/radar-chart.js
import { formatDecimal, renderStars } from '../utils/formatters.js';

const RADAR_METRICS = [
    { key: 'sales_dynamics', name: 'Динамика продаж', color: '#2e7d32' },
    { key: 'traffic_dynamics', name: 'Динамика трафика', color: '#1565c0' },
    { key: 'revenue_dynamics', name: 'Динамика дохода', color: '#ef6c00' },
    { key: 'conversion', name: 'Конверсия', color: '#7b1fa2' },
    { key: 'contracts_dynamics', name: 'Динамика контрактов', color: '#9c27b0' },
    { key: 'trading_dynamics', name: 'Динамика трейдин', color: '#00695c' }
];

export const createRadarChart = (item) => {
    const { brand, metrics, score } = item;
    const container = document.createElement('div');
    container.className = 'radar-item';
    
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "radar-chart");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    
    const centerX = 100, centerY = 100, maxRadius = 80;
    const metricCount = RADAR_METRICS.length;
    
    for (let i = 1; i <= 5; i++) {
        const radius = (maxRadius / 5) * i;
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", centerX.toString());
        circle.setAttribute("cy", centerY.toString());
        circle.setAttribute("r", radius.toString());
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", "#f0f0f0");
        circle.setAttribute("stroke-width", "1");
        svg.appendChild(circle);
    }
    
    const points = [];
    
    for (let i = 0; i < metricCount; i++) {
        const metric = RADAR_METRICS[i];
        const angle = (i * 2 * Math.PI) / metricCount - Math.PI / 2;
        const value = metrics[metric.key] || 0;
        const radius = (value / 5) * maxRadius;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        const axisX = centerX + maxRadius * Math.cos(angle);
        const axisY = centerY + maxRadius * Math.sin(angle);
        
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", centerX.toString());
        line.setAttribute("y1", centerY.toString());
        line.setAttribute("x2", axisX.toString());
        line.setAttribute("y2", axisY.toString());
        line.setAttribute("stroke", "#e0e0e0");
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
        
        const point = document.createElementNS(svgNS, "circle");
        point.setAttribute("cx", x.toString());
        point.setAttribute("cy", y.toString());
        point.setAttribute("r", "3");
        point.setAttribute("fill", metric.color);
        point.setAttribute("stroke", "white");
        point.setAttribute("stroke-width", "1");
        svg.appendChild(point);
        
        const labelX = centerX + (maxRadius + 15) * Math.cos(angle);
        const labelY = centerY + (maxRadius + 15) * Math.sin(angle);
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", labelX.toString());
        text.setAttribute("y", labelY.toString());
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", "10");
        text.setAttribute("fill", "#666");
        text.textContent = metric.name;
        svg.appendChild(text);
        
        points.push(`${x},${y}`);
    }
    
    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("points", points.join(" "));
    polygon.setAttribute("fill", "rgba(33, 150, 243, 0.2)");
    polygon.setAttribute("stroke", "#2196f3");
    polygon.setAttribute("stroke-width", "1");
    svg.insertBefore(polygon, svg.firstChild);
    
    const scoreElement = document.createElement('div');
    scoreElement.className = 'radar-score';
    scoreElement.textContent = formatDecimal(score, 1);
    
    const radarContainer = document.createElement('div');
    radarContainer.className = 'radar-container';
    radarContainer.appendChild(svg);
    radarContainer.appendChild(scoreElement);
    
    const radarInfo = document.createElement('div');
    radarInfo.className = 'radar-info';
    radarInfo.innerHTML = renderStars(score);
    
    container.innerHTML = `<h4 style="margin:0 0 10px 0; text-align:center;">${brand}</h4>`;
    container.appendChild(radarContainer);
    container.appendChild(radarInfo);
    
    return container;
};

export const renderRadarCharts = (radarData) => {
    const fragment = document.createDocumentFragment();
    radarData.forEach(item => {
        fragment.appendChild(createRadarChart(item));
    });
    return fragment;
};