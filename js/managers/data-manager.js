// js/managers/data-manager.js

export class DataManager {
    constructor(dataService) {
        this.dataService = dataService;
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
        
        this.onDataLoadedCallbacks = [];
        this.onDataClearedCallbacks = [];
        
        this.init();
    }
    
    init() {
        // Немедленно загружаем данные из dataService
        this.loadDataFromService();
    }
    
    loadDataFromService() {
        this.jsonData = this.dataService.getJsonData();
        this.jsonBrands = this.dataService.getJsonBrands();
        this.jsonBrandMapping = this.dataService.getJsonBrandMapping();
        this.jsonStats = this.dataService.getJsonStats();
        
        console.log('📦 DataManager загрузил данные:', {
            hasData: !!this.jsonData,
            dailyFactsCount: this.jsonData?.dailyFacts?.length,
            brandsCount: this.jsonBrands.length,
            availableMonths: this.jsonStats.availableMonths
        });
        
        if (this.jsonData) {
            this.triggerDataLoaded();
        }
    }
    
    onDataLoaded(callback) {
        this.onDataLoadedCallbacks.push(callback);
        // Если данные уже есть, вызываем сразу
        if (this.jsonData) {
            callback({
                jsonData: this.jsonData,
                jsonBrands: this.jsonBrands,
                jsonBrandMapping: this.jsonBrandMapping,
                jsonStats: this.jsonStats
            });
        }
    }
    
    onDataCleared(callback) {
        this.onDataClearedCallbacks.push(callback);
    }
    
    triggerDataLoaded() {
        this.onDataLoadedCallbacks.forEach(cb => cb({
            jsonData: this.jsonData,
            jsonBrands: this.jsonBrands,
            jsonBrandMapping: this.jsonBrandMapping,
            jsonStats: this.jsonStats
        }));
    }
    
    triggerDataCleared() {
        this.onDataClearedCallbacks.forEach(cb => cb());
    }
    
    async loadJsonDataFromServer() {
        await this.dataService.loadJsonDataFromServer();
        this.loadDataFromService();
        return this.jsonData;
    }
    
    async refreshJsonData() {
        await this.dataService.refreshJsonData();
        this.loadDataFromService();
        return this.jsonData;
    }
    
    processJsonData(jsonData) {
        this.dataService.processJsonData(jsonData);
        this.loadDataFromService();
        return this.jsonData;
    }
    
    clearJsonData() {
        this.dataService.clearJsonData();
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
        this.triggerDataCleared();
    }
    
    getJsonData() {
        // Всегда получаем актуальные данные из dataService
        return this.dataService.getJsonData();
    }
    
    getJsonBrands() {
        return this.dataService.getJsonBrands();
    }
    
    getJsonBrandMapping() {
        return this.dataService.getJsonBrandMapping();
    }
    
    getJsonStats() {
        return this.dataService.getJsonStats();
    }
    
    getLastDataDate() {
        return this.dataService.getLastDataDate();
    }
    
    getAvailableMonths() {
        return this.dataService.getAvailableMonths();
    }
    
    aggregateDataForDate(targetDateStr) {
        return this.dataService.aggregateDataForDate(targetDateStr);
    }
    
    getHistory() {
        return this.dataService.getHistory();
    }
    
    addHistorySnapshot(date, brandsData) {
        return this.dataService.addHistorySnapshot(date, brandsData);
    }
    
    clearHistory() {
        this.dataService.clearHistory();
    }
    
    getMonthlyTotals() {
        return this.dataService.getMonthlyTotals();
    }
    
    addMonthlyTotal(monthlyData) {
        this.dataService.addMonthlyTotal(monthlyData);
    }
    
    deleteMonthlyTotal(month) {
        return this.dataService.deleteMonthlyTotal(month);
    }
    
    getHistoricalData(monthsCount, excludeMonth) {
        return this.dataService.getHistoricalData(monthsCount, excludeMonth);
    }
    
    updateJsonStats() {
        this.dataService.updateJsonStats();
        this.jsonStats = this.dataService.getJsonStats();
    }
}