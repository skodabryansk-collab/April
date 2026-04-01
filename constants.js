// constants.js
const CONFIG = {
    THRESHOLDS: {
        SALES_FORECAST: { LOW: 70, MEDIUM: 90, HIGH: 100 },
        COVERAGE: { LOW: 80, HIGH: 100 },
        PERFORMANCE: { LOW: 60, MEDIUM: 80, HIGH: 90 },
        RADAR: { LOW: 2, MEDIUM: 3, HIGH: 4 }
    },
    COLORS: {
        SUCCESS: '#2e7d32',
        WARNING: '#ff9800',
        DANGER: '#d32f2f',
        INFO: '#2196f3',
        CONTRACTS: '#7b1fa2',
        TRADING: '#00695c',
        PLANNING: '#9c27b0',
        MONTHLY: '#00796b',
        JSON: '#ff9800'
    },
    ANIMATION: {
        HIGHLIGHT_DURATION: 500,
        DEBOUNCE_DELAY: 300
    },
    RADAR_METRICS: [
        { key: 'sales_dynamics', name: 'Динамика продаж', color: '#2e7d32' },
        { key: 'traffic_dynamics', name: 'Динамика трафика', color: '#1565c0' },
        { key: 'revenue_dynamics', name: 'Динамика дохода', color: '#ef6c00' },
        { key: 'conversion', name: 'Конверсия', color: '#7b1fa2' },
        { key: 'contracts_dynamics', name: 'Динамика контрактов', color: '#9c27b0' },
        { key: 'trading_dynamics', name: 'Динамика трейдин', color: '#00695c' }
    ],
    SEASONALITY_FACTORS: {
        1: 0.85, 2: 0.90, 3: 1.05, 4: 1.10,
        5: 1.15, 6: 1.10, 7: 0.95, 8: 0.90,
        9: 1.20, 10: 1.25, 11: 1.15, 12: 1.30
    },
    GROWTH_TARGETS: {
        sales: 1.08,
        traffic: 1.05,
        contracts: 1.10,
        trading: 1.07
    }
};

// Добавляем глобальную переменную
window.CONFIG = CONFIG;
