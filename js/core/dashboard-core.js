// js/core/dashboard-core.js
import { DashboardCalculations } from './dashboard-calculations.js';
import { AuthManager } from '../managers/auth-manager.js';
import { DataManager } from '../managers/data-manager.js';
import { UIManager } from '../managers/ui-manager.js';
import { createProgressBar } from '../components/progress-bar.js';
import { createRadarChart, renderRadarCharts } from '../components/radar-chart.js';
import { formatNumber, formatRevenue, formatDecimal, getMonthName, calculatePercentage } from '../utils/formatters.js';

export class DashboardCore {
    constructor() {
        // Инициализация сервисов
        this.authService = new AuthService();
        this.dataService = new DataService();
        
        // Инициализация менеджеров
        this.authManager = new AuthManager(this.authService);
        this.dataManager = new DataManager(this.dataService);
        this.uiManager = new UIManager(this.authManager);
        
        // Инициализация модуля расчетов
        this.calculator = new DashboardCalculations();
        
        // Данные
        this.brands = [
            {key: 'hc', name: 'Хавейл Сити', sales: [85, 160], traffic: [491, 900], revenue: [19509665, 40800000], contracts: [120, 180], trading: [90, 140]},
            {key: 'hp', name: 'Хавейл Про', sales: [48, 45], traffic: [236, 350], revenue: [5752000, 10834626], contracts: [55, 70], trading: [40, 50]},
            {key: 'jt', name: 'Джетур', sales: [28, 33], traffic: [194, 350], revenue: [2371000, 7559483], contracts: [35, 45], trading: [25, 30]},
            {key: 'ch', name: 'Чери', sales: [42, 85], traffic: [325, 450], revenue: [7719000, 13959079], contracts: [60, 90], trading: [45, 65]},
            {key: 'om', name: 'Омода', sales: [35, 15], traffic: [100, 170], revenue: [1552000, 3132995], contracts: [18, 25], trading: [12, 15]},
            {key: 'jk', name: 'Джейку', sales: [12, 14], traffic: [92, 170], revenue: [1456000, 2568387], contracts: [15, 20], trading: [10, 12]},
            {key: 'asp', name: 'АСП', sales: [110, 250], traffic: [488, 900], revenue: [21279000, 45000000], contracts: [150, 220], trading: [120, 180]}
        ];
        
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
        
        // Параметры диапазона дат
        this.rangeParams = {
            startDate: null,
            endDate: null,
            month: null,
            daysCount: 0,
            totalDaysInMonth: 0,
            planAdjustmentFactor: 1.0,
            allDaysSelected: false,
            availableDatesInMonth: [],
            availableDates: []
        };
        
        this.brandInputs = {};
        this.filteredBrand = 'all';
        
        // Кэширование DOM элементов
        this.elements = {};
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.updateBrandInputs();
        
        this.authManager.onLogin((user) => this.onUserLogin(user));
        this.authManager.onLogout(() => this.onUserLogout());
        
        this.dataManager.onDataLoaded((data) => this.onDataLoaded(data));
        this.dataManager.onDataCleared(() => this.onDataCleared());
        
        if (this.authManager.currentUser) {
            this.onUserLogin(this.authManager.currentUser);
        } else {
            this.uiManager.disableInterface();
        }
        
        this.setupEventListeners();
        this.setupRangeEventListeners();
        this.renderInputs();
        this.renderBrandFilter();
        
        setTimeout(() => {
            const jsonData = this.dataManager.getJsonData();
            if (jsonData) {
                this.jsonData = jsonData;
                this.jsonBrands = this.dataManager.getJsonBrands();
                this.jsonBrandMapping = this.dataManager.getJsonBrandMapping();
                this.jsonStats = this.dataManager.getJsonStats();
                this.updateAvailableDates();
                this.updateBrandsFromJson();
                this.setDefaultRange();
                this.loadDataForRange();
            }
        }, 500);
    }
    
    cacheElements() {
        const ids = [
            'notification', 'brandFilter', 'inputs', 'calcBtn', 
            'dashboard', 'forecastContainer',
            'summaryContainer',
            'radarContainer', 'radarGrid', 'gkRadarContainer',
            'totalGKContainer', 'summaryTableContainer',
            'loadJsonBtn', 'importJsonBtn', 'updatePlansBtn', 'clearJsonBtn', 'jsonStatusIndicator',
            'jsonStatusText', 'jsonStats', 'jsonRecordCount', 'jsonDateRange',
            'jsonBrandsCount', 'jsonTotalDays', 'jsonDataPreview',
            'loadJsonUrlBtn', 'saveJsonUrlBtn', 'clearJsonUrlBtn', 'testJsonUrlBtn',
            'jsonUrlInput', 'jsonUrlHistory', 'urlHistoryList', 'clearUrlHistoryBtn',
            'rangeStart', 'rangeEnd', 'loadDataForRangeBtn',
            'rangeDaysInfo', 'rangePlanInfo', 'forecastStatus', 'monthSelector',
            'refreshDataBtn'
        ];
        
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    updateBrandInputs() {
        this.brandInputs = {};
        this.brands.forEach(brand => {
            this.brandInputs[brand.key] = {
                sf: `${brand.key}_sf`, sp: `${brand.key}_sp`,
                tf: `${brand.key}_tf`, tp: `${brand.key}_tp`,
                rf: `${brand.key}_rf`, rp: `${brand.key}_rp`,
                cf: `${brand.key}_cf`, cp: `${brand.key}_cp`,
                trf: `${brand.key}_trf`, trp: `${brand.key}_trp`
            };
        });
    }
    
    getBrandInputValue(brandKey, field) {
        const inputId = this.brandInputs[brandKey]?.[field];
        if (!inputId) return 0;
        const element = document.getElementById(inputId);
        if (!element) return 0;
        const value = parseInt(element.value);
        return isNaN(value) ? 0 : Math.abs(value);
    }
    
    getAvailableMonths() {
        if (!this.jsonData || !this.jsonData.dailyFacts) return [];
        
        const months = new Set();
        this.jsonData.dailyFacts.forEach(record => {
            if (record.date && record.date !== '2026-01-01' && !record.month) {
                const month = record.date.substring(0, 7);
                months.add(month);
            }
        });
        
        return Array.from(months).sort();
    }
    
    renderMonthSelector() {
        const monthSelector = document.getElementById('monthSelector');
        if (!monthSelector) return;
        
        const availableMonths = this.getAvailableMonths();
        
        if (availableMonths.length === 0) {
            monthSelector.innerHTML = '<option value="">Нет данных</option>';
            return;
        }
        
        let options = '';
        availableMonths.forEach(month => {
            const [year, monthNum] = month.split('-');
            const monthName = getMonthName(parseInt(monthNum));
            const selected = (month === this.rangeParams.month) ? 'selected' : '';
            options += `<option value="${month}" ${selected}>${monthName} ${year}</option>`;
        });
        
        monthSelector.innerHTML = options;
    }
    
    getDatesInMonth(month) {
        return this.rangeParams.availableDates.filter(date => 
            date.substring(0, 7) === month
        );
    }
    
    setRangeByMonth(month) {
        const datesInMonth = this.getDatesInMonth(month);
        
        if (datesInMonth.length === 0) return;
        
        const startDate = datesInMonth[0];
        const endDate = datesInMonth[datesInMonth.length - 1];
        
        if (this.elements.rangeStart) this.elements.rangeStart.value = startDate;
        if (this.elements.rangeEnd) this.elements.rangeEnd.value = endDate;
        
        this.rangeParams.startDate = startDate;
        this.rangeParams.endDate = endDate;
        this.rangeParams.month = month;
        
        this.updateRangeParams();
        this.loadDataForRange();
    }
    
    updateAvailableDates() {
        if (!this.jsonData || !this.jsonData.dailyFacts) return;
        
        const dates = new Set();
        this.jsonData.dailyFacts.forEach(record => {
            if (record.date && record.date !== '2026-01-01' && !record.month) {
                const hasData = Object.values(record).some(value => 
                    typeof value === 'object' && (
                        value.sales > 0 || 
                        value.traffic > 0 || 
                        value.contracts > 0 || 
                        value.trading > 0 ||
                        value.revenue !== 0
                    )
                );
                if (hasData) {
                    dates.add(record.date);
                }
            }
        });
        
        this.rangeParams.availableDates = Array.from(dates).sort();
        console.log('📅 Доступные даты:', this.rangeParams.availableDates.length);
        
        this.renderMonthSelector();
        
        if (this.rangeParams.availableDates.length > 0) {
            const minDate = this.rangeParams.availableDates[0];
            const maxDate = this.rangeParams.availableDates[this.rangeParams.availableDates.length - 1];
            
            if (this.elements.rangeStart) {
                this.elements.rangeStart.min = minDate;
                this.elements.rangeStart.max = maxDate;
            }
            if (this.elements.rangeEnd) {
                this.elements.rangeEnd.min = minDate;
                this.elements.rangeEnd.max = maxDate;
            }
        }
    }
    
    setDefaultRange() {
        if (this.rangeParams.availableDates.length === 0) {
            console.log('⚠️ Нет доступных дат для установки диапазона');
            return;
        }
        
        const availableMonths = this.getAvailableMonths();
        if (availableMonths.length === 0) {
            console.log('⚠️ Нет доступных месяцев');
            return;
        }
        
        const lastMonth = availableMonths[availableMonths.length - 1];
        const datesInMonth = this.getDatesInMonth(lastMonth);
        
        if (datesInMonth.length === 0) {
            console.log(`⚠️ Нет дат в месяце ${lastMonth}`);
            return;
        }
        
        const startDate = datesInMonth[0];
        const endDate = datesInMonth[datesInMonth.length - 1];
        
        if (this.elements.rangeStart) this.elements.rangeStart.value = startDate;
        if (this.elements.rangeEnd) this.elements.rangeEnd.value = endDate;
        
        this.rangeParams.startDate = startDate;
        this.rangeParams.endDate = endDate;
        this.rangeParams.month = lastMonth;
        
        if (this.elements.monthSelector) {
            this.elements.monthSelector.value = lastMonth;
        }
        
        console.log(`📅 Установлен последний доступный месяц: ${lastMonth}, даты: ${startDate} - ${endDate}`);
        
        this.updateRangeParams();
    }
    
    updateRangeParams() {
        const startDate = this.rangeParams.startDate;
        const endDate = this.rangeParams.endDate;
        
        if (!startDate || !endDate) return;
        
        const startMonth = startDate.substring(0, 7);
        const endMonth = endDate.substring(0, 7);
        
        if (startMonth !== endMonth) {
            this.uiManager.showNotification('Даты должны быть в пределах одного месяца', 'error');
            this.setDefaultRange();
            return;
        }
        
        this.rangeParams.month = startMonth;
        
        const year = parseInt(startMonth.substring(0, 4));
        const month = parseInt(startMonth.substring(5));
        this.rangeParams.totalDaysInMonth = new Date(year, month, 0).getDate();
        
        const startDay = parseInt(startDate.substring(8));
        const endDay = parseInt(endDate.substring(8));
        this.rangeParams.daysCount = endDay - startDay + 1;
        
        this.rangeParams.availableDatesInMonth = this.rangeParams.availableDates.filter(date => 
            date.substring(0, 7) === this.rangeParams.month
        );
        
        if (this.rangeParams.availableDatesInMonth.length > 0) {
            const firstAvailable = this.rangeParams.availableDatesInMonth[0];
            const lastAvailable = this.rangeParams.availableDatesInMonth[this.rangeParams.availableDatesInMonth.length - 1];
            this.rangeParams.allDaysSelected = (startDate === firstAvailable && endDate === lastAvailable);
        } else {
            this.rangeParams.allDaysSelected = false;
        }
        
        if (this.rangeParams.allDaysSelected) {
            this.rangeParams.planAdjustmentFactor = 1.0;
        } else {
            this.rangeParams.planAdjustmentFactor = this.rangeParams.daysCount / this.rangeParams.totalDaysInMonth;
        }
        
        this.updateRangeInfo();
    }
    
    updateRangeInfo() {
        if (!this.elements.rangeDaysInfo) return;
        
        const daysCount = this.rangeParams.daysCount;
        const planPercent = Math.round(this.rangeParams.planAdjustmentFactor * 100);
        const monthName = getMonthName(parseInt(this.rangeParams.month?.substring(5) || '1'));
        
        this.elements.rangeDaysInfo.textContent = `📆 ${daysCount} ${this.getDaysWord(daysCount)} (${this.rangeParams.startDate?.substring(8)}-${this.rangeParams.endDate?.substring(8)} ${monthName})`;
        
        if (this.rangeParams.allDaysSelected) {
            this.elements.rangePlanInfo.textContent = `📊 План: полный`;
        } else {
            this.elements.rangePlanInfo.textContent = `📊 План: ${planPercent}% от месячного (${daysCount} из ${this.rangeParams.totalDaysInMonth} дней)`;
        }
        
        const forecastStatus = this.elements.forecastStatus;
        if (forecastStatus) {
            if (this.rangeParams.allDaysSelected) {
                forecastStatus.className = 'forecast-indicator active';
                forecastStatus.innerHTML = '🔮 Прогноз: доступен (выбран полный диапазон данных)';
            } else {
                forecastStatus.className = 'forecast-indicator inactive';
                forecastStatus.innerHTML = '🔮 Прогноз: недоступен (выбран неполный диапазон)';
            }
        }
    }
    
    getDaysWord(days) {
        if (days % 10 === 1 && days % 100 !== 11) return 'день';
        if ([2,3,4].includes(days % 10) && ![12,13,14].includes(days % 100)) return 'дня';
        return 'дней';
    }
    
    setupRangeEventListeners() {
        const monthSelector = document.getElementById('monthSelector');
        if (monthSelector) {
            monthSelector.addEventListener('change', (e) => {
                const selectedMonth = e.target.value;
                if (selectedMonth) {
                    this.setRangeByMonth(selectedMonth);
                }
            });
        }
        
        if (this.elements.rangeStart) {
            this.elements.rangeStart.addEventListener('change', () => {
                const startDate = this.elements.rangeStart.value;
                if (startDate && this.rangeParams.availableDates.includes(startDate)) {
                    this.rangeParams.startDate = startDate;
                    this.updateRangeParams();
                    this.loadDataForRange();
                } else {
                    this.uiManager.showNotification('Выбранная дата не содержит данных', 'warning');
                    this.setRangeByMonth(this.rangeParams.month);
                }
            });
        }
        
        if (this.elements.rangeEnd) {
            this.elements.rangeEnd.addEventListener('change', () => {
                const endDate = this.elements.rangeEnd.value;
                if (endDate && this.rangeParams.availableDates.includes(endDate)) {
                    this.rangeParams.endDate = endDate;
                    this.updateRangeParams();
                    this.loadDataForRange();
                } else {
                    this.uiManager.showNotification('Выбранная дата не содержит данных', 'warning');
                    this.setRangeByMonth(this.rangeParams.month);
                }
            });
        }
        
        if (this.elements.loadDataForRangeBtn) {
            this.elements.loadDataForRangeBtn.addEventListener('click', () => {
                this.loadDataForRange();
            });
        }
    }
    
    filterRecordsByRange(records) {
        const startDate = this.rangeParams.startDate;
        const endDate = this.rangeParams.endDate;
        
        return records.filter(record => 
            record.date >= startDate && record.date <= endDate
        );
    }
    
    aggregateRecords(records) {
        const aggregated = {};
        
        records.forEach(record => {
            Object.keys(record).forEach(key => {
                if (key !== 'date' && key !== 'month' && typeof record[key] === 'object') {
                    if (!aggregated[key]) {
                        aggregated[key] = { sales: 0, traffic: 0, revenue: 0, contracts: 0, trading: 0 };
                    }
                    aggregated[key].sales += record[key].sales || 0;
                    aggregated[key].traffic += record[key].traffic || 0;
                    aggregated[key].revenue += record[key].revenue || 0;
                    aggregated[key].contracts += record[key].contracts || 0;
                    aggregated[key].trading += record[key].trading || 0;
                }
            });
        });
        
        return aggregated;
    }
    
    adjustPlans(monthlyPlans) {
        const factor = this.rangeParams.planAdjustmentFactor;
        const adjusted = {};
        
        Object.keys(monthlyPlans).forEach(brandKey => {
            const plan = monthlyPlans[brandKey];
            if (plan) {
                adjusted[brandKey] = {
                    sales: Math.round(plan.sales * factor),
                    traffic: Math.round(plan.traffic * factor),
                    revenue: Math.round(plan.revenue * factor),
                    contracts: Math.round(plan.contracts * factor),
                    trading: Math.round(plan.trading * factor)
                };
            }
        });
        
        return adjusted;
    }
    
    getMonthlyPlans(month) {
        if (!this.jsonData || !this.jsonData.monthlyPlans) return {};
        
        const monthPlan = this.jsonData.monthlyPlans.find(plan => plan.month === month);
        if (!monthPlan) return {};
        
        return monthPlan;
    }
    
    loadDataForRange() {
        const jsonData = this.dataManager.getJsonData();
        if (!jsonData || !jsonData.dailyFacts) {
            this.uiManager.showNotification('Сначала загрузите JSON данные', 'warning');
            return;
        }
        
        this.jsonData = jsonData;
        
        const filteredRecords = this.filterRecordsByRange(jsonData.dailyFacts);
        
        if (filteredRecords.length === 0) {
            this.uiManager.showNotification('Нет данных за выбранный период', 'warning');
            return;
        }
        
        const aggregatedData = this.aggregateRecords(filteredRecords);
        const monthlyPlans = this.getMonthlyPlans(this.rangeParams.month);
        const adjustedPlans = this.adjustPlans(monthlyPlans);
        
        this.updateInputsWithAggregatedData(aggregatedData);
        this.updateInputsWithPlans(adjustedPlans);
        
        this.currentRangeInfo = {
            aggregatedData,
            adjustedPlans,
            daysCount: this.rangeParams.daysCount,
            totalDaysInMonth: this.rangeParams.totalDaysInMonth,
            allDaysSelected: this.rangeParams.allDaysSelected,
            month: this.rangeParams.month,
            startDate: this.rangeParams.startDate,
            endDate: this.rangeParams.endDate
        };
        
        this.calculate();
        
        this.uiManager.showNotification(`Данные за ${this.rangeParams.daysCount} ${this.getDaysWord(this.rangeParams.daysCount)} загружены`, 'success');
    }
    
    updateInputsWithAggregatedData(aggregatedData) {
        this.brands.forEach(brand => {
            const brandData = aggregatedData[brand.key];
            if (!brandData) return;
            
            const inputId = this.brandInputs[brand.key];
            if (!inputId) return;
            
            const salesInput = document.getElementById(inputId.sf);
            const trafficInput = document.getElementById(inputId.tf);
            const revenueInput = document.getElementById(inputId.rf);
            const contractsInput = document.getElementById(inputId.cf);
            const tradingInput = document.getElementById(inputId.trf);
            
            if (salesInput) salesInput.value = Math.round(brandData.sales) || 0;
            if (trafficInput) trafficInput.value = Math.round(brandData.traffic) || 0;
            if (revenueInput) revenueInput.value = Math.round(brandData.revenue) || 0;
            if (contractsInput) contractsInput.value = Math.round(brandData.contracts) || 0;
            if (tradingInput) tradingInput.value = Math.round(brandData.trading) || 0;
        });
    }
    
    updateInputsWithPlans(adjustedPlans) {
        this.brands.forEach(brand => {
            const planData = adjustedPlans[brand.key];
            if (!planData) return;
            
            const inputId = this.brandInputs[brand.key];
            if (!inputId) return;
            
            const salesPlanInput = document.getElementById(inputId.sp);
            const trafficPlanInput = document.getElementById(inputId.tp);
            const revenuePlanInput = document.getElementById(inputId.rp);
            const contractsPlanInput = document.getElementById(inputId.cp);
            const tradingPlanInput = document.getElementById(inputId.trp);
            
            if (salesPlanInput && planData.sales) salesPlanInput.value = planData.sales;
            if (trafficPlanInput && planData.traffic) trafficPlanInput.value = planData.traffic;
            if (revenuePlanInput && planData.revenue) revenuePlanInput.value = planData.revenue;
            if (contractsPlanInput && planData.contracts) contractsPlanInput.value = planData.contracts;
            if (tradingPlanInput && planData.trading) tradingPlanInput.value = planData.trading;
        });
    }
    
    onUserLogin(user) {
        console.log('👤 Пользователь авторизован:', user.name);
        this.uiManager.enableInterface();
        this.authManager.showUserPanel();
        
        if (this.authManager.isAdmin()) {
            this.uiManager.showAdminMode();
            this.enableAdminFeatures();
            this.loadUsersTable();
        } else {
            this.uiManager.showViewerMode();
        }
        
        this.renderJsonStats();
        this.renderJsonPreview();
        
        const lastDate = this.dataManager.getLastDataDate();
        if (lastDate && this.elements.rangeStart && this.elements.rangeEnd) {
            this.elements.rangeStart.value = lastDate;
            this.elements.rangeEnd.value = lastDate;
            this.rangeParams.startDate = lastDate;
            this.rangeParams.endDate = lastDate;
            this.updateRangeParams();
            console.log('✅ Установлена последняя дата:', lastDate);
        }
    }
    
    onUserLogout() {
        console.log('👤 Пользователь вышел');
        this.uiManager.disableInterface();
        this.authManager.hideUserPanel();
    }
    
    onDataLoaded(data) {
        console.log('📊 Данные загружены:', data);
        this.jsonData = data.jsonData;
        this.jsonBrands = data.jsonBrands;
        this.jsonBrandMapping = data.jsonBrandMapping;
        this.jsonStats = data.jsonStats;
        
        this.updateJsonStatus(true);
        this.renderJsonStats();
        this.renderJsonPreview();
        
        this.updateAvailableDates();
        this.updateBrandsFromJson();
        this.renderMonthSelector();
        
        setTimeout(() => {
            this.setDefaultRange();
            this.loadDataForRange();
        }, 500);
    }
    
    onDataCleared() {
        console.log('🗑️ Данные очищены');
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
        this.updateJsonStatus(false);
        if (this.elements.jsonStats) this.elements.jsonStats.style.display = 'none';
        if (this.elements.jsonDataPreview) this.elements.jsonDataPreview.style.display = 'none';
    }
    
    updateBrandsFromJson() {
        if (!this.jsonBrands || this.jsonBrands.length === 0) return;
        
        console.log('🔄 Обновление брендов из JSON:', this.jsonBrands);
        
        const newBrands = this.jsonBrands.map(brandKey => {
            const brandName = this.jsonBrandMapping[brandKey] || brandKey.toUpperCase();
            const existingBrand = this.brands.find(b => b.key === brandKey);
            
            if (existingBrand) {
                return {
                    ...existingBrand,
                    name: brandName
                };
            }
            
            return {
                key: brandKey,
                name: brandName,
                sales: [0, 0],
                traffic: [0, 0],
                revenue: [0, 0],
                contracts: [0, 0],
                trading: [0, 0]
            };
        });
        
        this.brands = newBrands;
        this.updateBrandInputs();
        this.renderInputs();
        this.renderBrandFilter();
        
        console.log('✅ Бренды обновлены:', this.brands.map(b => ({ key: b.key, name: b.name })));
    }
    
    enableAdminFeatures() {
        const adminButtons = [
            'loadJsonBtn', 'importJsonBtn', 'updatePlansBtn', 'clearJsonBtn',
            'loadJsonUrlBtn', 'saveJsonUrlBtn', 'clearJsonUrlBtn', 'testJsonUrlBtn',
            'refreshDataBtn'
        ];
        
        adminButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.style.display = 'flex';
        });
        
        const jsonSection = document.querySelector('.json-section');
        if (jsonSection) jsonSection.style.display = 'block';
    }
    
    setupEventListeners() {
        if (this.elements.loadJsonBtn) {
            this.elements.loadJsonBtn.addEventListener('click', () => this.loadJsonFromFile());
        }
        
        if (this.elements.clearJsonBtn) {
            this.elements.clearJsonBtn.addEventListener('click', () => this.clearJsonData());
        }
        
        if (this.elements.calcBtn) {
            this.elements.calcBtn.addEventListener('click', () => this.calculate());
        }
        
        if (this.elements.brandFilter) {
            this.elements.brandFilter.addEventListener('change', (e) => {
                this.filteredBrand = e.target.value;
                this.calculate();
            });
        }
        
        const refreshDataBtn = document.getElementById('refreshDataBtn');
        if (refreshDataBtn) {
            refreshDataBtn.addEventListener('click', () => this.refreshDataFromServer());
        }
        
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.addNewUser());
        }
        
        const debouncedCalculate = this.debounce(() => this.calculate(), 300);
        if (this.elements.inputs) {
            this.elements.inputs.addEventListener('input', debouncedCalculate);
        }
    }
    
    async refreshDataFromServer() {
        console.log('🔄 Принудительное обновление данных с сервера...');
        
        this.uiManager.showNotification('Обновление данных...', 'info');
        
        try {
            const refreshResponse = await fetch('/api/refresh-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const refreshResult = await refreshResponse.json();
            
            if (!refreshResult.success) {
                throw new Error(refreshResult.error || 'Ошибка обновления');
            }
            
            console.log('✅ Данные на сервере обновлены:', refreshResult);
            
            const dataResponse = await fetch('/api/data?refresh=true');
            const freshData = await dataResponse.json();
            
            if (this.dataService && this.dataService.processJsonData) {
                this.dataService.processJsonData(freshData);
            }
            
            this.jsonData = freshData;
            this.jsonBrands = freshData.metadata?.brandsIncluded || [];
            this.jsonBrandMapping = this.dataManager.getJsonBrandMapping();
            this.jsonStats = this.dataManager.getJsonStats();
            
            this.updateAvailableDates();
            this.updateBrandsFromJson();
            this.loadDataForRange();
            
            this.renderJsonStats();
            this.renderJsonPreview();
            this.updateJsonStatus(true);
            
            this.uiManager.showNotification(
                `Данные обновлены! Загружено ${refreshResult.records || 0} записей`, 
                'success'
            );
            
        } catch (error) {
            console.error('❌ Ошибка обновления данных:', error);
            this.uiManager.showNotification('Ошибка обновления данных: ' + error.message, 'error');
        }
    }
    
    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    renderInputs() {
        const inputsTbody = this.elements.inputs;
        if (!inputsTbody) return;
        
        inputsTbody.innerHTML = this.brands.map(brand => `
            <tr>
                <td style="text-align: left; padding-left: 10px; font-weight: 600;">${brand.name}</td>
                <td><input id="${brand.key}_sf" value="${brand.sales[0]}" type="number" min="0"></td>
                <td><input id="${brand.key}_sp" value="${brand.sales[1]}" type="number" min="0"></td>
                <td><input id="${brand.key}_tf" value="${brand.traffic[0]}" type="number" min="0"></td>
                <td><input id="${brand.key}_tp" value="${brand.traffic[1]}" type="number" min="0"></td>
                <td><input id="${brand.key}_rf" value="${brand.revenue[0]}" type="number"></td>
                <td><input id="${brand.key}_rp" value="${brand.revenue[1]}" type="number"></td>
                <td style="background: #f9f0fa;"><input id="${brand.key}_cf" value="${brand.contracts[0]}" type="number" min="0"></td>
                <td style="background: #f3e5f5;"><input id="${brand.key}_cp" value="${brand.contracts[1]}" type="number" min="0"></td>
                <td style="background: #e8f5f1;"><input id="${brand.key}_trf" value="${brand.trading[0]}" type="number" min="0"></td>
                <td style="background: #d0ece7;"><input id="${brand.key}_trp" value="${brand.trading[1]}" type="number" min="0"></td>
             </tr>
        `).join('');
        
        this.updateBrandInputs();
    }
    
    renderBrandFilter() {
        const filterSelect = this.elements.brandFilter;
        if (!filterSelect) return;
        filterSelect.innerHTML = '<option value="all">Все бренды</option>' +
            this.brands.map(brand => `<option value="${brand.key}">${brand.name}</option>`).join('');
    }
    
    loadJsonFromFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.txt';
        fileInput.style.display = 'none';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonData = JSON.parse(event.target.result);
                    this.dataManager.processJsonData(jsonData);
                    this.uiManager.showNotification('JSON данные загружены', 'success');
                } catch (error) {
                    this.uiManager.showNotification('Ошибка чтения JSON', 'error');
                }
            };
            reader.readAsText(file);
        };
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    }
    
    clearJsonData() {
        this.dataManager.clearJsonData();
        this.uiManager.showNotification('JSON данные очищены', 'success');
        this.calculate();
    }
    
    updateJsonStatus(loaded = false) {
        if (!this.elements.jsonStatusIndicator || !this.elements.jsonStatusText) return;
        
        const stats = this.dataManager.getJsonStats();
        if (loaded && this.dataManager.getJsonData()) {
            this.elements.jsonStatusIndicator.className = 'json-status-indicator loaded';
            const monthsCount = stats.availableMonths?.length || 0;
            this.elements.jsonStatusText.textContent = `Данные загружены: ${stats.totalRecords} записей, ${stats.brandsCount} брендов, ${monthsCount} мес.`;
        } else {
            this.elements.jsonStatusIndicator.className = 'json-status-indicator not-loaded';
            this.elements.jsonStatusText.textContent = 'Данные из JSON не загружены';
        }
    }
    
    renderJsonStats() {
        if (!this.elements.jsonStats) return;
        
        const stats = this.dataManager.getJsonStats();
        
        if (this.elements.jsonRecordCount) {
            this.elements.jsonRecordCount.textContent = stats.totalRecords;
        }
        if (this.elements.jsonDateRange) {
            this.elements.jsonDateRange.textContent = stats.dateRange;
        }
        if (this.elements.jsonBrandsCount) {
            this.elements.jsonBrandsCount.textContent = stats.brandsCount;
        }
        if (this.elements.jsonTotalDays) {
            this.elements.jsonTotalDays.textContent = stats.totalDays;
        }
        
        const monthsInfo = stats.availableMonths?.length ? stats.availableMonths.join(', ') : 'Нет данных';
        
        let monthsElement = document.getElementById('jsonMonths');
        if (!monthsElement) {
            const statsContainer = this.elements.jsonStats;
            const newStat = document.createElement('div');
            newStat.className = 'json-stat';
            newStat.innerHTML = `
                <div class="json-stat-label">Доступные месяцы</div>
                <div class="json-stat-value" id="jsonMonths">${monthsInfo}</div>
            `;
            statsContainer.appendChild(newStat);
        } else {
            monthsElement.textContent = monthsInfo;
        }
        
        this.elements.jsonStats.style.display = 'grid';
    }
    
    renderJsonPreview() {
        if (!this.elements.jsonDataPreview) return;
        
        const jsonData = this.dataManager.getJsonData();
        if (!jsonData) {
            this.elements.jsonDataPreview.style.display = 'none';
            return;
        }
        
        const stats = this.dataManager.getJsonStats();
        const availableMonths = stats.availableMonths || [];
        const jsonBrands = this.dataManager.getJsonBrands();
        const jsonBrandMapping = this.dataManager.getJsonBrandMapping();
        
        const preview = document.createElement('div');
        preview.innerHTML = `
            <div><strong>Версия:</strong> ${jsonData.version || '1.0'}</div>
            <div><strong>Тип данных:</strong> ${jsonData.dataType || 'daily_facts'}</div>
            <div><strong>Дата экспорта:</strong> ${jsonData.exportDate || 'Не указана'}</div>
            <div><strong>Бренды:</strong> ${jsonBrands.join(', ')}</div>
            <div><strong>Доступные месяцы:</strong> ${availableMonths.join(', ') || 'Нет данных'}</div>
        `;
        
        this.elements.jsonDataPreview.innerHTML = '';
        this.elements.jsonDataPreview.appendChild(preview);
        this.elements.jsonDataPreview.style.display = 'block';
    }
    
    calculate() {
        console.log('🔄 Начало расчета...');
        try {
            const dashboard = this.elements.dashboard;
            if (!dashboard) return;
            dashboard.innerHTML = '';
            
            const brandDataList = [];
            const filteredBrands = this.filteredBrand === 'all' ? this.brands : this.brands.filter(b => b.key === this.filteredBrand);
            
            const day = parseInt(this.rangeParams.endDate?.substring(8) || '15');
            const daysInMonth = this.rangeParams.totalDaysInMonth;
            const showForecast = this.rangeParams.allDaysSelected;
            
            filteredBrands.forEach(brand => {
                const data = {
                    sales: { fact: this.getBrandInputValue(brand.key, 'sf'), plan: this.getBrandInputValue(brand.key, 'sp') },
                    traffic: { fact: this.getBrandInputValue(brand.key, 'tf'), plan: this.getBrandInputValue(brand.key, 'tp') },
                    revenue: { fact: this.getBrandInputValue(brand.key, 'rf'), plan: this.getBrandInputValue(brand.key, 'rp') },
                    contracts: { fact: this.getBrandInputValue(brand.key, 'cf'), plan: this.getBrandInputValue(brand.key, 'cp') },
                    trading: { fact: this.getBrandInputValue(brand.key, 'trf'), plan: this.getBrandInputValue(brand.key, 'trp') }
                };
                
                let salesForecast = data.sales.fact;
                let trafficForecast = data.traffic.fact;
                let revenueForecast = data.revenue.fact;
                let contractsForecast = data.contracts.fact;
                let tradingForecast = data.trading.fact;
                let salesForecastPercent = calculatePercentage(salesForecast, data.sales.plan);
                let trafficForecastPercent = calculatePercentage(trafficForecast, data.traffic.plan);
                let revenueForecastPercent = calculatePercentage(revenueForecast, data.revenue.plan);
                let contractsForecastPercent = calculatePercentage(contractsForecast, data.contracts.plan);
                let tradingForecastPercent = calculatePercentage(tradingForecast, data.trading.plan);
                
                if (showForecast) {
                    salesForecast = this.calculator.calculateForecast(data.sales.fact, data.sales.plan, 'sales', day, daysInMonth, brand.key);
                    trafficForecast = this.calculator.calculateForecast(data.traffic.fact, data.traffic.plan, 'traffic', day, daysInMonth, brand.key);
                    revenueForecast = this.calculator.calculateRevenueForecast(data.sales.fact, data.sales.plan, data.revenue.fact, data.revenue.plan, day, daysInMonth, brand.key);
                    contractsForecast = this.calculator.calculateForecast(data.contracts.fact, data.contracts.plan, 'contracts', day, daysInMonth, brand.key);
                    tradingForecast = this.calculator.calculateForecast(data.trading.fact, data.trading.plan, 'trading', day, daysInMonth, brand.key);
                    
                    salesForecastPercent = calculatePercentage(salesForecast, data.sales.plan);
                    trafficForecastPercent = calculatePercentage(trafficForecast, data.traffic.plan);
                    revenueForecastPercent = calculatePercentage(revenueForecast, data.revenue.plan);
                    contractsForecastPercent = calculatePercentage(contractsForecast, data.contracts.plan);
                    tradingForecastPercent = calculatePercentage(tradingForecast, data.trading.plan);
                }
                
                const salesPercent = calculatePercentage(data.sales.fact, data.sales.plan);
                const trafficPercent = calculatePercentage(data.traffic.fact, data.traffic.plan);
                const revenuePercent = calculatePercentage(data.revenue.fact, data.revenue.plan);
                const contractsPercent = calculatePercentage(data.contracts.fact, data.contracts.plan);
                const tradingPercent = calculatePercentage(data.trading.fact, data.trading.plan);
                
                const salesConversionPercent = data.traffic.fact > 0 ? parseFloat(((data.sales.fact / data.traffic.fact) * 100).toFixed(1)) : 0;
                const tradingCoveragePercent = data.sales.fact > 0 ? parseFloat(((data.trading.fact / data.sales.fact) * 100).toFixed(1)) : 0;
                
                const salesDynamicsScore = this.calculator.getDynamicsScore(data.sales.fact, data.sales.plan, day, daysInMonth);
                const trafficDynamicsScore = this.calculator.getDynamicsScore(data.traffic.fact, data.traffic.plan, day, daysInMonth);
                const revenueDynamicsScore = this.calculator.getDynamicsScore(data.revenue.fact, data.revenue.plan, day, daysInMonth);
                const contractsDynamicsScore = this.calculator.getDynamicsScore(data.contracts.fact, data.contracts.plan, day, daysInMonth);
                const tradingDynamicsScore = this.calculator.getDynamicsScore(data.trading.fact, data.trading.plan, day, daysInMonth);
                const conversionScore = this.calculator.getConversionScore(data.sales.plan, data.traffic.plan, data.sales.fact, data.traffic.fact);
                
                const radarMetrics = {
                    sales_dynamics: salesDynamicsScore,
                    traffic_dynamics: trafficDynamicsScore,
                    revenue_dynamics: revenueDynamicsScore,
                    conversion: conversionScore,
                    contracts_dynamics: contractsDynamicsScore,
                    trading_dynamics: tradingDynamicsScore
                };
                
                const radarScore = Object.values(radarMetrics).reduce((a, b) => a + b, 0) / 6;
                
                brandDataList.push({
                    brand,
                    data,
                    salesPercent,
                    trafficPercent,
                    revenuePercent,
                    contractsPercent,
                    tradingPercent,
                    salesConversionPercent,
                    tradingCoveragePercent,
                    salesForecast,
                    trafficForecast,
                    revenueForecast,
                    contractsForecast,
                    tradingForecast,
                    salesForecastPercent,
                    trafficForecastPercent,
                    revenueForecastPercent,
                    contractsForecastPercent,
                    tradingForecastPercent,
                    radarScore,
                    radarMetrics
                });
            });
            
            const fragment = document.createDocumentFragment();
            brandDataList.forEach(item => {
                fragment.appendChild(this.createBrandCard(item, day, daysInMonth, showForecast));
            });
            dashboard.appendChild(fragment);
            
            const totals = this.calculateTotals(brandDataList);
            
            let forecastTotals = null;
            if (showForecast) {
                forecastTotals = this.calculateForecastTotals(brandDataList, day, daysInMonth);
                this.renderForecastAnalysis(forecastTotals);
                this.renderSummaryCards(totals, forecastTotals);
            } else {
                this.renderSummaryCardsNoForecast(totals);
                this.renderForecastUnavailable();
            }
            
            this.renderTotalGKCard(totals, forecastTotals, showForecast, day, daysInMonth);
            this.renderSummaryTable(brandDataList);
            this.renderRadarChartsForBrands(brandDataList, day, daysInMonth);
            
            console.log('✅ Расчет завершен успешно');
        } catch (error) {
            console.error('❌ Ошибка расчета:', error);
            this.uiManager.showNotification(`Ошибка расчета: ${error.message}`, 'error');
        }
    }
    
    createBrandCard(item, day, daysInMonth, showForecast) {
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
            <h2>${brand.name} ${this.renderStars(radarScore)}</h2>
            
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
                        <span class="detail-value">${this.formatRevenueForDisplay(data.revenue.fact / day)}</span>
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
    }
    
    renderStars(score) {
        const fullStars = Math.floor(score);
        const emptyStars = 5 - fullStars;
        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '<span class="star">★</span>';
        for (let i = 0; i < emptyStars; i++) stars += '<span class="star empty">★</span>';
        return `<div class="stars">${stars}</div>`;
    }
    
    formatRevenueForDisplay(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        
        const absValue = Math.abs(value);
        
        if (absValue >= 1000000) {
            return (value / 1000000).toFixed(1) + ' млн';
        } else if (absValue >= 1000) {
            return (value / 1000).toFixed(0) + ' тыс';
        } else {
            return Math.round(value).toString();
        }
    }
    
    calculateTotals(brandDataList) {
        const totals = {
            sales: { fact: 0, plan: 0, percent: 0 },
            traffic: { fact: 0, plan: 0, percent: 0 },
            revenue: { fact: 0, plan: 0, percent: 0 },
            contracts: { fact: 0, plan: 0, percent: 0 },
            trading: { fact: 0, plan: 0, percent: 0 }
        };
        
        brandDataList.forEach(item => {
            totals.sales.fact += item.data.sales.fact;
            totals.sales.plan += item.data.sales.plan;
            totals.traffic.fact += item.data.traffic.fact;
            totals.traffic.plan += item.data.traffic.plan;
            totals.revenue.fact += item.data.revenue.fact;
            totals.revenue.plan += item.data.revenue.plan;
            totals.contracts.fact += item.data.contracts.fact;
            totals.contracts.plan += item.data.contracts.plan;
            totals.trading.fact += item.data.trading.fact;
            totals.trading.plan += item.data.trading.plan;
        });
        
        totals.sales.percent = calculatePercentage(totals.sales.fact, totals.sales.plan);
        totals.traffic.percent = calculatePercentage(totals.traffic.fact, totals.traffic.plan);
        totals.revenue.percent = calculatePercentage(totals.revenue.fact, totals.revenue.plan);
        totals.contracts.percent = calculatePercentage(totals.contracts.fact, totals.contracts.plan);
        totals.trading.percent = calculatePercentage(totals.trading.fact, totals.trading.plan);
        
        return totals;
    }
    
    calculateForecastTotals(brandDataList, day, daysInMonth) {
        const totals = {
            sales: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            traffic: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            revenue: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            contracts: { totalFact: 0, totalPlan: 0, totalForecast: 0 },
            trading: { totalFact: 0, totalPlan: 0, totalForecast: 0 }
        };
        
        brandDataList.forEach(item => {
            const { brand, data } = item;
            
            const salesForecast = this.calculator.calculateForecast(data.sales.fact, data.sales.plan, 'sales', day, daysInMonth, brand.key);
            const trafficForecast = this.calculator.calculateForecast(data.traffic.fact, data.traffic.plan, 'traffic', day, daysInMonth, brand.key);
            const revenueForecast = this.calculator.calculateRevenueForecast(data.sales.fact, data.sales.plan, data.revenue.fact, data.revenue.plan, day, daysInMonth, brand.key);
            const contractsForecast = this.calculator.calculateForecast(data.contracts.fact, data.contracts.plan, 'contracts', day, daysInMonth, brand.key);
            const tradingForecast = this.calculator.calculateForecast(data.trading.fact, data.trading.plan, 'trading', day, daysInMonth, brand.key);
            
            totals.sales.totalFact += data.sales.fact;
            totals.sales.totalPlan += data.sales.plan;
            totals.sales.totalForecast += salesForecast;
            
            totals.traffic.totalFact += data.traffic.fact;
            totals.traffic.totalPlan += data.traffic.plan;
            totals.traffic.totalForecast += trafficForecast;
            
            totals.revenue.totalFact += data.revenue.fact;
            totals.revenue.totalPlan += data.revenue.plan;
            totals.revenue.totalForecast += revenueForecast;
            
            totals.contracts.totalFact += data.contracts.fact;
            totals.contracts.totalPlan += data.contracts.plan;
            totals.contracts.totalForecast += contractsForecast;
            
            totals.trading.totalFact += data.trading.fact;
            totals.trading.totalPlan += data.trading.plan;
            totals.trading.totalForecast += tradingForecast;
        });
        
        return totals;
    }
    
    renderForecastAnalysis(forecastData) {
        const forecastContainer = this.elements.forecastContainer;
        if (!forecastContainer) return;
        
        const salesPercent = Math.round((forecastData.sales.totalForecast / forecastData.sales.totalPlan) * 100);
        const contractsPercent = Math.round((forecastData.contracts.totalForecast / forecastData.contracts.totalPlan) * 100);
        const revenuePercent = Math.round((forecastData.revenue.totalForecast / forecastData.revenue.totalPlan) * 100);
        
        forecastContainer.innerHTML = `
            <div class="forecast-card">
                <h3 style="margin:0 0 15px 0; color:#2196f3;">📈 Прогноз на конец месяца</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:15px;">
                    <div>
                        <div style="font-size:12px; color:#666;">Продажи</div>
                        <div style="font-size:18px; font-weight:bold;">
                            ${formatNumber(forecastData.sales.totalForecast)}/${formatNumber(forecastData.sales.totalPlan)}
                            <span style="font-size:14px; color:${salesPercent >= 100 ? '#2e7d32' : salesPercent >= 80 ? '#ff9800' : '#d32f2f'}">(${salesPercent}%)</span>
                        </div>
                    </div>
                    <div>
                        <div style="font-size:12px; color:#666;">Контракты</div>
                        <div style="font-size:18px; font-weight:bold;">
                            ${formatNumber(forecastData.contracts.totalForecast)}/${formatNumber(forecastData.contracts.totalPlan)}
                            <span style="font-size:14px; color:${contractsPercent >= 100 ? '#2e7d32' : contractsPercent >= 80 ? '#ff9800' : '#d32f2f'}">(${contractsPercent}%)</span>
                        </div>
                    </div>
                    <div>
                        <div style="font-size:12px; color:#666;">Доход</div>
                        <div style="font-size:18px; font-weight:bold;">
                            ${formatRevenue(forecastData.revenue.totalForecast)}/${formatRevenue(forecastData.revenue.totalPlan)}
                            <span style="font-size:14px; color:${revenuePercent >= 100 ? '#2e7d32' : revenuePercent >= 80 ? '#ff9800' : '#d32f2f'}">(${revenuePercent}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderForecastUnavailable() {
        const forecastContainer = this.elements.forecastContainer;
        if (!forecastContainer) return;
        
        forecastContainer.innerHTML = `
            <div class="forecast-card" style="background: #fff3e0; border-left-color: #ff9800;">
                <h3 style="margin:0 0 10px 0; color:#ff9800;">🔮 Прогноз недоступен</h3>
                <div style="font-size:13px; color:#666;">
                    Для отображения прогноза необходимо выбрать полный диапазон доступных дат в месяце.<br>
                    Текущий диапазон: ${this.rangeParams.startDate?.substring(8)}-${this.rangeParams.endDate?.substring(8)} ${getMonthName(parseInt(this.rangeParams.month?.substring(5) || '1'))} (${this.rangeParams.daysCount} из ${this.rangeParams.availableDatesInMonth.length} доступных дней)
                </div>
            </div>
        `;
    }
    
    renderSummaryCards(totals, forecastData) {
        const summaryContainer = this.elements.summaryContainer;
        if (!summaryContainer) return;
        
        const salesForecastPercent = Math.round((forecastData.sales.totalForecast / forecastData.sales.totalPlan) * 100);
        const contractsForecastPercent = Math.round((forecastData.contracts.totalForecast / forecastData.contracts.totalPlan) * 100);
        
        summaryContainer.innerHTML = `
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Выполнение плана продаж</div>
                <div style="font-size:24px; font-weight:bold; color:${totals.sales.percent >= 100 ? '#2e7d32' : '#d32f2f'}">${totals.sales.percent}%</div>
                <div style="font-size:11px; color:#666;">${formatNumber(totals.sales.fact)}/${formatNumber(totals.sales.plan)}</div>
            </div>
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Прогноз продаж</div>
                <div style="font-size:24px; font-weight:bold; color:${salesForecastPercent >= 100 ? '#2e7d32' : '#d32f2f'}">${salesForecastPercent}%</div>
                <div style="font-size:11px; color:#666;">${formatNumber(forecastData.sales.totalForecast)}/${formatNumber(forecastData.sales.totalPlan)}</div>
            </div>
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Выполнение плана контрактов</div>
                <div style="font-size:24px; font-weight:bold; color:${totals.contracts.percent >= 100 ? '#2e7d32' : '#d32f2f'}">${totals.contracts.percent}%</div>
                <div style="font-size:11px; color:#666;">${formatNumber(totals.contracts.fact)}/${formatNumber(totals.contracts.plan)}</div>
            </div>
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Прогноз контрактов</div>
                <div style="font-size:24px; font-weight:bold; color:${contractsForecastPercent >= 100 ? '#2e7d32' : '#d32f2f'}">${contractsForecastPercent}%</div>
                <div style="font-size:11px; color:#666;">${formatNumber(forecastData.contracts.totalForecast)}/${formatNumber(forecastData.contracts.totalPlan)}</div>
            </div>
        `;
    }
    
    renderSummaryCardsNoForecast(totals) {
        const summaryContainer = this.elements.summaryContainer;
        if (!summaryContainer) return;
        
        summaryContainer.innerHTML = `
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Выполнение плана продаж</div>
                <div style="font-size:24px; font-weight:bold; color:${totals.sales.percent >= 100 ? '#2e7d32' : '#d32f2f'}">${totals.sales.percent}%</div>
                <div style="font-size:11px; color:#666;">${formatNumber(totals.sales.fact)}/${formatNumber(totals.sales.plan)}</div>
            </div>
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Период анализа</div>
                <div style="font-size:24px; font-weight:bold; color:#2196f3;">${this.rangeParams.daysCount} ${this.getDaysWord(this.rangeParams.daysCount)}</div>
                <div style="font-size:11px; color:#666;">${this.rangeParams.startDate?.substring(8)}-${this.rangeParams.endDate?.substring(8)} ${getMonthName(parseInt(this.rangeParams.month?.substring(5) || '1'))}</div>
            </div>
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Выполнение плана контрактов</div>
                <div style="font-size:24px; font-weight:bold; color:${totals.contracts.percent >= 100 ? '#2e7d32' : '#d32f2f'}">${totals.contracts.percent}%</div>
                <div style="font-size:11px; color:#666;">${formatNumber(totals.contracts.fact)}/${formatNumber(totals.contracts.plan)}</div>
            </div>
            <div class="summary-card">
                <div style="font-size:12px; color:#666;">Корректировка плана</div>
                <div style="font-size:24px; font-weight:bold; color:#ff9800;">${Math.round(this.rangeParams.planAdjustmentFactor * 100)}%</div>
                <div style="font-size:11px; color:#666;">от месячного плана</div>
            </div>
        `;
    }
    
    renderTotalGKCard(totals, forecastTotals, showForecast, day, daysInMonth) {
        const container = this.elements.totalGKContainer;
        if (!container) return;
        
        const monthName = getMonthName(parseInt(this.rangeParams.month?.substring(5) || '1'));
        const year = this.rangeParams.month?.substring(0, 4) || '2026';
        
        let forecastHtml = '';
        if (showForecast && forecastTotals) {
            const salesForecastPercent = Math.round((forecastTotals.sales.totalForecast / forecastTotals.sales.totalPlan) * 100);
            const contractsForecastPercent = Math.round((forecastTotals.contracts.totalForecast / forecastTotals.contracts.totalPlan) * 100);
            forecastHtml = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                    <div class="metric-header">
                        <div class="metric-title">🔮 ПРОГНОЗ НА КОНЕЦ МЕСЯЦА</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 10px;">
                        <div class="detail-item">
                            <span class="detail-label">Продажи:</span>
                            <span class="detail-value">${formatNumber(forecastTotals.sales.totalForecast)} (${salesForecastPercent}%)</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Темп в день:</span>
                            <span class="detail-value">${formatDecimal(totals.sales.fact / day, 1)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Контракты:</span>
                            <span class="detail-value">${formatNumber(forecastTotals.contracts.totalForecast)} (${contractsForecastPercent}%)</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Темп в день:</span>
                            <span class="detail-value">${formatDecimal(totals.contracts.fact / day, 1)}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const planAdjustmentText = this.rangeParams.allDaysSelected ? 
            'полный' : 
            `${Math.round(this.rangeParams.planAdjustmentFactor * 100)}% от месячного (${this.rangeParams.daysCount} из ${this.rangeParams.totalDaysInMonth} дней)`;
        
        const html = `
            <div class="total-gk-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0; color:#2c3e50;">🏢 ИТОГО ПО ГК (ГРУППА КОМПАНИЙ)</h2>
                    <div>
                        <span style="background: #e3f2fd; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${monthName} ${year}</span>
                        <span style="margin-left:10px; font-size:12px; color:#666;">${this.rangeParams.startDate?.substring(8)}-${this.rangeParams.endDate?.substring(8)} ${monthName}</span>
                    </div>
                </div>
                
                <div class="gk-progress-container">
                    <div>
                        <div class="metric-header">
                            <div class="metric-title">ПРОДАЖИ</div>
                            <div class="fact-percent">${totals.sales.percent}%</div>
                        </div>
                        ${createProgressBar('sales', totals.sales.fact, totals.sales.plan, showForecast ? forecastTotals.sales.totalForecast : totals.sales.fact, totals.sales.percent, showForecast ? Math.round((forecastTotals.sales.totalForecast / totals.sales.plan) * 100) : totals.sales.percent)}
                        <div class="metric-details">
                            <div class="detail-item"><span class="detail-label">Факт / План:</span><span class="detail-value">${formatNumber(totals.sales.fact)}/${formatNumber(totals.sales.plan)}</span></div>
                            <div class="detail-item"><span class="detail-label">Корректировка плана:</span><span class="detail-value">${planAdjustmentText}</span></div>
                            ${showForecast ? `
                            <div class="detail-item"><span class="detail-label">Темп в день:</span><span class="detail-value">${formatDecimal(totals.sales.fact / day, 1)}</span></div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <div class="metric-header">
                            <div class="metric-title">БАНК КОНТРАКТОВ</div>
                            <div class="fact-percent">${totals.contracts.percent}%</div>
                        </div>
                        ${createProgressBar('contracts', totals.contracts.fact, totals.contracts.plan, showForecast ? forecastTotals.contracts.totalForecast : totals.contracts.fact, totals.contracts.percent, showForecast ? Math.round((forecastTotals.contracts.totalForecast / totals.contracts.plan) * 100) : totals.contracts.percent)}
                        <div class="metric-details">
                            <div class="detail-item"><span class="detail-label">Факт / План:</span><span class="detail-value">${formatNumber(totals.contracts.fact)}/${formatNumber(totals.contracts.plan)}</span></div>
                            <div class="detail-item"><span class="detail-label">% в контракт:</span><span class="detail-value">${totals.traffic.fact > 0 ? formatDecimal((totals.contracts.fact / totals.traffic.fact * 100), 1) : 0}%</span></div>
                            ${showForecast ? `
                            <div class="detail-item"><span class="detail-label">Темп в день:</span><span class="detail-value">${formatDecimal(totals.contracts.fact / day, 1)}</span></div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <div class="metric-header">
                            <div class="metric-title">КОЛ-ВО ТРЕЙДИН</div>
                            <div class="fact-percent">${totals.trading.percent}%</div>
                        </div>
                        ${createProgressBar('trading', totals.trading.fact, totals.trading.plan, showForecast ? forecastTotals.trading.totalForecast : totals.trading.fact, totals.trading.percent, showForecast ? Math.round((forecastTotals.trading.totalForecast / totals.trading.plan) * 100) : totals.trading.percent)}
                        <div class="metric-details">
                            <div class="detail-item"><span class="detail-label">Факт / План:</span><span class="detail-value">${formatNumber(totals.trading.fact)}/${formatNumber(totals.trading.plan)}</span></div>
                            <div class="detail-item"><span class="detail-label">%Трейдин (охват):</span><span class="detail-value">${totals.sales.fact > 0 ? formatDecimal((totals.trading.fact / totals.sales.fact * 100), 1) : 0}%</span></div>
                            ${showForecast ? `
                            <div class="detail-item"><span class="detail-label">Темп в день:</span><span class="detail-value">${formatDecimal(totals.trading.fact / day, 1)}</span></div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div>
                        <div class="metric-header">
                            <div class="metric-title">ТРАФИК</div>
                            <div class="fact-percent">${totals.traffic.percent}%</div>
                        </div>
                        ${createProgressBar('traffic', totals.traffic.fact, totals.traffic.plan, showForecast ? forecastTotals.traffic.totalForecast : totals.traffic.fact, totals.traffic.percent, showForecast ? Math.round((forecastTotals.traffic.totalForecast / totals.traffic.plan) * 100) : totals.traffic.percent)}
                        ${showForecast ? `
                        <div class="metric-details">
                            <div class="detail-item"><span class="detail-label">Темп в день:</span><span class="detail-value">${formatDecimal(totals.traffic.fact / day, 1)}</span></div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div>
                        <div class="metric-header">
                            <div class="metric-title">ДОХОД, МЛН.</div>
                            <div class="fact-percent">${totals.revenue.percent}%</div>
                        </div>
                        ${createProgressBar('revenue', totals.revenue.fact, totals.revenue.plan, showForecast ? forecastTotals.revenue.totalForecast : totals.revenue.fact, totals.revenue.percent, showForecast ? Math.round((forecastTotals.revenue.totalForecast / totals.revenue.plan) * 100) : totals.revenue.percent)}
                        ${showForecast ? `
                        <div class="metric-details">
                            <div class="detail-item"><span class="detail-label">Темп в день:</span><span class="detail-value">${this.formatRevenueForDisplay(totals.revenue.fact / day)}</span></div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                ${forecastHtml}
                
                <div style="margin-top:25px; padding-top:20px; border-top:2px solid #e9ecef; text-align:center;">
                    <div style="font-size:14px; color:#666;">📅 Период: ${this.rangeParams.startDate?.substring(8)}-${this.rangeParams.endDate?.substring(8)} ${monthName} ${year} (${this.rangeParams.daysCount} ${this.getDaysWord(this.rangeParams.daysCount)})</div>
                    <div style="font-size:12px; color:#999; margin-top:5px;">
                        ${showForecast ? '📈 Прогноз рассчитан на основе данных за полный диапазон' : '🔮 Для отображения прогноза выберите полный диапазон доступных дат в месяце'}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }
    
    renderSummaryTable(brandDataList) {
        const container = this.elements.summaryTableContainer;
        if (!container) return;
        
        const monthName = getMonthName(parseInt(this.rangeParams.month?.substring(5) || '1'));
        const year = this.rangeParams.month?.substring(0, 4) || '2026';
        
        const html = `
            <div class="summary-table-container">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; color:#2c3e50;">📊 СВОДНАЯ ТАБЛИЦА ПО БРЕНДАМ</h3>
                    <span style="background: #e3f2fd; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${monthName} ${year} (${this.rangeParams.startDate?.substring(8)}-${this.rangeParams.endDate?.substring(8)})</span>
                </div>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>БРЕНД</th>
                            <th>ПРОДАЖИ</th>
                            <th>БАНК КОНТРАКТОВ</th>
                            <th>КОЛ-ВО ТРЕЙДИН</th>
                            <th>ТРАФИК</th>
                            <th>ДОХОД</th>
                            <th>КОНВЕРСИЯ</th>
                            <th>%ТРЕЙДИН</th>
                            <th>СТАТУС</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${brandDataList.map(item => {
                            const { brand, data, salesPercent, contractsPercent, tradingPercent, trafficPercent, revenuePercent, salesConversionPercent, tradingCoveragePercent } = item;
                            const status = salesPercent >= 100 ? 'success' : salesPercent >= 80 ? 'warning' : 'danger';
                            const statusText = salesPercent >= 100 ? 'Выполнен' : salesPercent >= 80 ? 'На пути' : 'Отставание';
                            return `
                                <tr>
                                    <td style="font-weight:600; text-align:left;">${brand.name}</td>
                                    <td><div style="font-weight:bold;">${data.sales.fact}/${data.sales.plan}</div><div style="font-size:11px; color:${this.getColorByPercent(salesPercent)};">${salesPercent}%</div></td>
                                    <td><div style="font-weight:bold;">${data.contracts.fact}/${data.contracts.plan}</div><div style="font-size:11px; color:${this.getColorByPercent(contractsPercent)};">${contractsPercent}%</div></td>
                                    <td><div style="font-weight:bold;">${data.trading.fact}/${data.trading.plan}</div><div style="font-size:11px; color:${this.getColorByPercent(tradingPercent)};">${tradingPercent}%</div></td>
                                    <td><div style="font-weight:bold;">${data.traffic.fact}/${data.traffic.plan}</div><div style="font-size:11px; color:${this.getColorByPercent(trafficPercent)};">${trafficPercent}%</div></td>
                                    <td><div style="font-weight:bold;">${formatRevenue(data.revenue.fact)}/${formatRevenue(data.revenue.plan)}</div><div style="font-size:11px; color:${this.getColorByPercent(revenuePercent)};">${revenuePercent}%</div></td>
                                    <td style="color:#7b1fa2; font-weight:bold;">${salesConversionPercent}%</td>
                                    <td style="color:#00695c; font-weight:bold;">${tradingCoveragePercent}%</td>
                                    <td><span class="status-badge ${status}">${statusText}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    }
    
    renderRadarChartsForBrands(brandDataList, day, daysInMonth) {
        const radarGrid = this.elements.radarGrid;
        if (!radarGrid) return;
        radarGrid.innerHTML = '';
        
        const radarData = brandDataList.map(item => {
            const { brand, radarMetrics, radarScore } = item;
            return {
                brand: brand.name,
                brandKey: brand.key,
                metrics: radarMetrics,
                score: radarScore
            };
        });
        
        const fragment = renderRadarCharts(radarData);
        radarGrid.appendChild(fragment);
        
        if (brandDataList.length > 0) {
            const totals = this.calculateTotals(brandDataList);
            
            const salesDynamicsScore = this.calculator.getDynamicsScore(totals.sales.fact, totals.sales.plan, day, daysInMonth);
            const trafficDynamicsScore = this.calculator.getDynamicsScore(totals.traffic.fact, totals.traffic.plan, day, daysInMonth);
            const revenueDynamicsScore = this.calculator.getDynamicsScore(totals.revenue.fact, totals.revenue.plan, day, daysInMonth);
            const contractsDynamicsScore = this.calculator.getDynamicsScore(totals.contracts.fact, totals.contracts.plan, day, daysInMonth);
            const tradingDynamicsScore = this.calculator.getDynamicsScore(totals.trading.fact, totals.trading.plan, day, daysInMonth);
            const conversionScore = this.calculator.getConversionScore(totals.sales.plan, totals.traffic.plan, totals.sales.fact, totals.traffic.fact);
            
            const gkMetrics = {
                sales_dynamics: salesDynamicsScore,
                traffic_dynamics: trafficDynamicsScore,
                revenue_dynamics: revenueDynamicsScore,
                conversion: conversionScore,
                contracts_dynamics: contractsDynamicsScore,
                trading_dynamics: tradingDynamicsScore
            };
            
            const gkScore = Object.values(gkMetrics).reduce((a, b) => a + b, 0) / 6;
            
            const monthDisplay = this.rangeParams?.month ? ' (' + this.rangeParams.month + ')' : '';
            const gkRadarItem = {
                brand: 'ГРУППА КОМПАНИЙ' + monthDisplay,
                brandKey: 'gk',
                metrics: gkMetrics,
                score: gkScore
            };
            
            const gkContainer = this.elements.gkRadarContainer;
            if (gkContainer) {
                // Очищаем контейнер
                while (gkContainer.firstChild) {
                    gkContainer.removeChild(gkContainer.firstChild);
                }
                
                // Создаем заголовок
                const title = document.createElement('h3');
                title.style.cssText = 'margin:20px 0 10px 0; text-align:center; color:#2c3e50;';
                title.textContent = '📡 Радар-график ГК (ГРУППА КОМПАНИЙ)';
                gkContainer.appendChild(title);
                
                // Добавляем график
                gkContainer.appendChild(createRadarChart(gkRadarItem));
            }
        }
    }
    
    getColorByPercent(percent) {
        if (percent >= 100) return '#2e7d32';
        if (percent >= 80) return '#ff9800';
        return '#d32f2f';
    }
    
    // ==================== МЕТОДЫ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ====================
    
    async loadUsersTable() {
        console.log('📋 Загрузка таблицы пользователей...');
        
        try {
            const users = await this.authService.getAllUsers();
            const tbody = document.getElementById('usersTableBody');
            
            if (!tbody) {
                console.warn('⚠️ Элемент usersTableBody не найден');
                return;
            }
            
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет пользователей</td></tr>';
                return;
            }
            
            // Очищаем tbody
            tbody.innerHTML = '';
            
            // Добавляем каждую строку через createElement для безопасности
            users.forEach(user => {
                const row = document.createElement('tr');
                
                const idCell = document.createElement('td');
                idCell.textContent = user.id;
                row.appendChild(idCell);
                
                const nameCell = document.createElement('td');
                nameCell.textContent = this.escapeHtml(user.name);
                row.appendChild(nameCell);
                
                const loginCell = document.createElement('td');
                loginCell.textContent = this.escapeHtml(user.login);
                row.appendChild(loginCell);
                
                const roleCell = document.createElement('td');
                const roleSpan = document.createElement('span');
                roleSpan.className = `role-badge ${user.role}`;
                roleSpan.textContent = user.role === 'admin' ? 'Администратор' : 'Наблюдатель';
                roleCell.appendChild(roleSpan);
                row.appendChild(roleCell);
                
                const actionsCell = document.createElement('td');
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.style.cssText = 'background: #f44336; padding: 5px 10px; font-size: 12px; min-width: auto; cursor: pointer; border: none; border-radius: 6px; color: white;';
                deleteBtn.textContent = '🗑️';
                deleteBtn.onclick = () => this.deleteUser(user.id);
                actionsCell.appendChild(deleteBtn);
                row.appendChild(actionsCell);
                
                tbody.appendChild(row);
            });
            
            console.log(`✅ Загружено ${users.length} пользователей`);
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this.uiManager.showNotification('Ошибка загрузки пользователей', 'error');
        }
    }
    
    async addNewUser() {
        console.log('📝 Добавление нового пользователя...');
        
        const nameInput = document.getElementById('newUserName');
        const loginInput = document.getElementById('newUserLogin');
        const passwordInput = document.getElementById('newUserPassword');
        const roleSelect = document.getElementById('newUserRole');
        
        const name = nameInput?.value;
        const login = loginInput?.value;
        const password = passwordInput?.value;
        const role = roleSelect?.value;
        
        if (!name || !login || !password || !role) {
            this.uiManager.showNotification('Заполните все поля', 'warning');
            return;
        }
        
        const result = await this.authService.addUser({ name, login, password, role });
        
        if (result.success) {
            this.uiManager.showNotification('Пользователь добавлен', 'success');
            
            if (nameInput) nameInput.value = '';
            if (loginInput) loginInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (roleSelect) roleSelect.value = 'viewer';
            
            this.loadUsersTable();
        } else {
            this.uiManager.showNotification(result.error || 'Ошибка добавления', 'error');
        }
    }
    
    async deleteUser(userId) {
        if (userId === this.authService.currentUser?.id) {
            this.uiManager.showNotification('Нельзя удалить самого себя', 'warning');
            return;
        }
        
        if (confirm('Удалить пользователя?')) {
            const success = await this.authService.removeUser(userId);
            if (success) {
                this.uiManager.showNotification('Пользователь удален', 'success');
                this.loadUsersTable();
            } else {
                this.uiManager.showNotification('Ошибка удаления', 'error');
            }
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

function getLevelByPercent(percent) {
    if (percent >= 100) return { level: 'high', text: 'Высокий' };
    if (percent >= 70) return { level: 'medium', text: 'Средний' };
    return { level: 'low', text: 'Низкий' };
}

window.DashboardCore = DashboardCore;
