// data-service.js
class DataService {
    constructor() {
        this.history = [];
        this.monthlyTotals = [];
        this.jsonData = null;
        this.jsonBrands = [];
        this.jsonBrandMapping = {};
        this.jsonStats = {
            totalRecords: 0,
            dateRange: '',
            brandsCount: 0,
            totalDays: 0,
            availableMonths: []
        };
        
        this.loadHistory();
        this.loadMonthlyTotals();
        this.loadJsonDataFromServer();
    }
    
    async loadJsonDataFromServer() {
        try {
            console.log('🔄 Загрузка JSON данных с сервера...');
            const response = await fetch('/api/data');
            
            if (response.ok) {
                this.jsonData = await response.json();
                this.processJsonData(this.jsonData);
                console.log('✅ JSON-данные успешно загружены с сервера');
            } else {
                console.warn('⚠️ Не удалось загрузить JSON-данные, статус:', response.status);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки JSON с сервера:', error);
        }
    }
    
    async refreshJsonData() {
        await this.loadJsonDataFromServer();
        return this.jsonData;
    }
    
    processJsonData(jsonData) {
        const validation = DashboardUtils.validateJsonStructure ? 
            DashboardUtils.validateJsonStructure(jsonData) : 
            { valid: true };
            
        if (!validation.valid) {
            console.error('Ошибка JSON:', validation.error);
            return;
        }
        
        this.jsonData = jsonData;
        
        this.jsonBrands = jsonData.metadata?.brandsIncluded || 
                         DashboardUtils.extractBrandsFromJson?.(jsonData) || 
                         [];
        
        this.jsonBrandMapping = DashboardUtils.generateBrandMapping(this.jsonBrands);
        
        console.log('📋 Бренды из JSON:', this.jsonBrands);
        console.log('📋 Маппинг брендов:', this.jsonBrandMapping);
        
        this.jsonStats.availableMonths = DashboardUtils.getAvailableMonthsFromJson(jsonData);
        
        this.updateJsonStats();
    }
    
    getJsonData() {
        return this.jsonData;
    }
    
    getJsonBrands() {
        return this.jsonBrands;
    }
    
    getJsonBrandMapping() {
        return this.jsonBrandMapping;
    }
    
    getJsonStats() {
        return this.jsonStats;
    }
    
    updateJsonStats() {
        if (!this.jsonData) return;
        
        const dailyFacts = this.jsonData.dailyFacts || [];
        const metadata = this.jsonData.metadata || {};
        
        const uniqueDates = new Set();
        dailyFacts.forEach(record => {
            if (record.date && record.date !== '2026-01-01' && !record.month) {
                uniqueDates.add(record.date);
            }
        });
        
        this.jsonStats = {
            totalRecords: uniqueDates.size,
            dateRange: metadata.dateRange || 'Не указан',
            brandsCount: this.jsonBrands.length,
            totalDays: metadata.totalDays || uniqueDates.size,
            availableMonths: DashboardUtils.getAvailableMonthsFromJson(this.jsonData)
        };
    }
    
    getLastDataDate() {
        return DashboardUtils.getLastDataDate(this.jsonData);
    }
    
    getAvailableMonths() {
        return DashboardUtils.getAvailableMonthsFromJson(this.jsonData);
    }
    
    aggregateDataForDate(targetDateStr) {
        return DashboardUtils.aggregateJsonDataByMonth(this.jsonData, targetDateStr);
    }
    
    clearJsonData() {
        this.jsonData = null;
        this.jsonBrands = [];
        this.jsonBrandMapping = {};
        this.jsonStats = {
            totalRecords: 0,
            dateRange: '',
            brandsCount: 0,
            totalDays: 0,
            availableMonths: []
        };
        localStorage.removeItem('jsonData');
        console.log('✅ JSON данные очищены');
    }
    
    loadHistory() {
        try {
            const saved = localStorage.getItem('dashboardHistory');
            this.history = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Ошибка загрузки истории:', e);
            this.history = [];
        }
    }
    
    saveHistory() {
        try {
            localStorage.setItem('dashboardHistory', JSON.stringify(this.history));
        } catch (e) {
            console.error('Ошибка сохранения истории:', e);
        }
    }
    
    addHistorySnapshot(date, brandsData) {
        const snapshot = { 
            date, 
            month: date.substring(0, 7),
            timestamp: new Date().toISOString(),
            data: brandsData 
        };
        
        const existingIndex = this.history.findIndex(item => item.date === date);
        if (existingIndex >= 0) {
            this.history[existingIndex] = snapshot;
        } else {
            this.history.unshift(snapshot);
        }
        
        this.saveHistory();
        return snapshot;
    }
    
    getHistory() {
        return this.history;
    }
    
    clearHistory() {
        this.history = [];
        this.saveHistory();
    }
    
    loadMonthlyTotals() {
        try {
            const saved = localStorage.getItem('monthlyTotals');
            this.monthlyTotals = saved ? JSON.parse(saved) : [];
            
            this.monthlyTotals = this.monthlyTotals.map(monthly => {
                if (!monthly.totals) {
                    monthly.totals = {
                        sales: { fact: 0, plan: 0 },
                        traffic: { fact: 0, plan: 0 },
                        revenue: { fact: 0, plan: 0 },
                        contracts: { fact: 0, plan: 0 },
                        trading: { fact: 0, plan: 0 }
                    };
                }
                return monthly;
            });
        } catch (e) {
            console.error('Ошибка загрузки месячных итогов:', e);
            this.monthlyTotals = [];
        }
    }
    
    saveMonthlyTotals() {
        try {
            localStorage.setItem('monthlyTotals', JSON.stringify(this.monthlyTotals));
        } catch (e) {
            console.error('Ошибка сохранения месячных итогов:', e);
        }
    }
    
    addMonthlyTotal(monthlyData) {
        const existingIndex = this.monthlyTotals.findIndex(item => item.month === monthlyData.month);
        if (existingIndex >= 0) {
            this.monthlyTotals[existingIndex] = monthlyData;
        } else {
            this.monthlyTotals.push(monthlyData);
        }
        this.saveMonthlyTotals();
    }
    
    deleteMonthlyTotal(month) {
        const index = this.monthlyTotals.findIndex(item => item.month === month);
        if (index >= 0) {
            this.monthlyTotals.splice(index, 1);
            this.saveMonthlyTotals();
            return true;
        }
        return false;
    }
    
    getMonthlyTotals() {
        return this.monthlyTotals;
    }
    
    getHistoricalData(monthsCount, excludeMonth) {
        const excludedDate = new Date(excludeMonth + '-01');
        
        const relevantHistory = this.monthlyTotals
            .filter(item => {
                const itemDate = new Date(item.month + '-01');
                return itemDate < excludedDate;
            })
            .sort((a, b) => new Date(b.month) - new Date(a.month))
            .slice(0, monthsCount);
        
        return relevantHistory;
    }
}

// Добавляем глобальную переменную
window.DataService = DataService;
