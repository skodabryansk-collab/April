// utils.js
class DashboardUtils {
    static formatNumber(num) {
        return num ? num.toLocaleString('ru-RU') : '0';
    }
    
    static calculatePercentage(value, total) {
        return total > 0 ? Math.round((value / total) * 100) : 0;
    }
    
    static debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    static showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.style.background = type === 'success' ? '#4caf50' : 
                                       type === 'error' ? '#f44336' : 
                                       type === 'warning' ? '#ff9800' : '#2196f3';
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    static getMonthName(monthNumber) {
        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        return months[monthNumber - 1] || '';
    }
    
    static getMonthGenitive(monthNumber) {
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        return months[monthNumber - 1] || '';
    }
    
    static getPeriodBadgeClass(monthNumber) {
        const classes = {
            1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr', 5: 'may', 6: 'jun',
            7: 'jul', 8: 'aug', 9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
        };
        return classes[monthNumber] || '';
    }
    
    static extractMonthFromDate(dateStr) {
        if (!dateStr) return null;
        return dateStr.substring(0, 7);
    }
    
    static extractMonthNumber(dateStr) {
        if (!dateStr) return null;
        return parseInt(dateStr.substring(5, 7));
    }
    
    static extractYear(dateStr) {
        if (!dateStr) return null;
        return parseInt(dateStr.substring(0, 4));
    }
    
    static getFirstDayOfMonth(dateStr) {
        if (!dateStr) return null;
        return dateStr.substring(0, 8) + '01';
    }
    
    static getMonthPlanFromJson(jsonData, monthStr) {
        if (!jsonData || !jsonData.monthlyPlans || !monthStr) return null;
        return jsonData.monthlyPlans.find(plan => plan.month === monthStr) || null;
    }
    
    static aggregateJsonDataByMonth(jsonData, targetDateStr) {
        if (!jsonData || !jsonData.dailyFacts || !targetDateStr) return null;

        const targetDate = new Date(targetDateStr);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1;

        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const startDateStr = startOfMonth.toISOString().split('T')[0];

        const dailyMap = new Map();

        jsonData.dailyFacts.forEach(record => {
            if (!record.date || record.date === '2026-01-01') return;

            const recordDate = new Date(record.date);
            const recordYear = recordDate.getFullYear();
            const recordMonth = recordDate.getMonth() + 1;

            if (recordYear === targetYear && recordMonth === targetMonth && recordDate <= targetDate) {
                if (!dailyMap.has(record.date)) {
                    dailyMap.set(record.date, {});
                }
                const dayAcc = dailyMap.get(record.date);

                Object.keys(record).forEach(key => {
                    if (key !== 'date' && key !== 'month' && typeof record[key] === 'object') {
                        if (!dayAcc[key]) {
                            dayAcc[key] = { sales:0, traffic:0, revenue:0, contracts:0, trading:0 };
                        }
                        const brandData = record[key];
                        ['sales','traffic','revenue','contracts','trading'].forEach(field => {
                            dayAcc[key][field] += Number(brandData[field]) || 0;
                        });
                    }
                });
            }
        });

        const aggregatedRecords = Array.from(dailyMap.values());

        if (aggregatedRecords.length === 0) return null;

        const allBrands = new Set();
        aggregatedRecords.forEach(day => {
            Object.keys(day).forEach(brand => allBrands.add(brand));
        });

        const aggregatedData = {};
        allBrands.forEach(brandKey => {
            aggregatedData[brandKey] = { sales:0, traffic:0, revenue:0, contracts:0, trading:0, records:0 };
        });

        aggregatedRecords.forEach(day => {
            allBrands.forEach(brandKey => {
                const brandData = day[brandKey];
                if (!brandData) return;
                aggregatedData[brandKey].sales += brandData.sales;
                aggregatedData[brandKey].traffic += brandData.traffic;
                aggregatedData[brandKey].revenue += brandData.revenue;
                aggregatedData[brandKey].contracts += brandData.contracts;
                aggregatedData[brandKey].trading += brandData.trading;
                aggregatedData[brandKey].records++;
            });
        });

        return {
            aggregatedData,
            month: `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
            daysCount: aggregatedRecords.length,
            startDate: startDateStr,
            endDate: targetDateStr
        };
    }
    
    static getAvailableMonthsFromJson(jsonData) {
        if (!jsonData || !jsonData.dailyFacts) return [];
        const months = new Set();
        jsonData.dailyFacts.forEach(record => {
            if (record.date && record.date !== '2026-01-01') {
                const month = record.date.substring(0, 7);
                months.add(month);
            }
        });
        if (jsonData.monthlyPlans) {
            jsonData.monthlyPlans.forEach(plan => {
                if (plan.month) months.add(plan.month);
            });
        }
        return Array.from(months).sort();
    }
    
    static getLastDataDate(jsonData) {
        if (!jsonData || !jsonData.dailyFacts) return null;
        for (let i = jsonData.dailyFacts.length - 1; i >= 0; i--) {
            const record = jsonData.dailyFacts[i];
            if (record.date && record.date !== '2026-01-01' && !record.month) {
                const hasData = Object.values(record).some(val => 
                    typeof val === 'object' && (
                        (val.sales && val.sales > 0) || 
                        (val.traffic && val.traffic > 0) || 
                        (val.contracts && val.contracts > 0) ||
                        (val.revenue && val.revenue !== 0)
                    )
                );
                if (hasData) {
                    return record.date;
                }
            }
        }
        return null;
    }
    
    static getBrandPlanForMonth(jsonData, monthStr, brandKey) {
        if (!jsonData || !jsonData.monthlyPlans || !monthStr || !brandKey) return null;
        const monthPlan = jsonData.monthlyPlans.find(plan => plan.month === monthStr);
        return monthPlan?.[brandKey] || null;
    }
    
    static isDateInMonth(dateStr, targetDateStr) {
        if (!dateStr || !targetDateStr) return false;
        return dateStr.substring(0, 7) === targetDateStr.substring(0, 7);
    }
    
    static formatPeriodDisplay(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthName = this.getMonthGenitive(month);
        return `${day} ${monthName} ${year}`;
    }
    
    static validateJsonStructure(jsonData) {
        if (!jsonData || typeof jsonData !== 'object') return { valid: false, error: 'JSON не является объектом' };
        if (!jsonData.dailyFacts || !Array.isArray(jsonData.dailyFacts)) return { valid: false, error: 'Отсутствует dailyFacts или это не массив' };
        return { valid: true };
    }
    
    static extractBrandsFromJson(jsonData) {
        if (!jsonData.dailyFacts || !jsonData.dailyFacts.length) return [];
        if (jsonData.metadata?.brandsIncluded) return jsonData.metadata.brandsIncluded;
        const brandSet = new Set();
        jsonData.dailyFacts.forEach(record => {
            if (record.date && record.date !== '2026-01-01' && !record.month) {
                Object.keys(record).forEach(key => {
                    if (key !== 'date' && key !== 'month' && typeof record[key] === 'object') {
                        brandSet.add(key);
                    }
                });
            }
        });
        return Array.from(brandSet);
    }
    
    static generateBrandMapping(jsonBrands) {
        const defaultMapping = {
            'hc': 'Хавейл Сити',
            'hp': 'Хавейл Про', 
            'jt': 'Джетур',
            'ch': 'Чери',
            'om': 'Омода',
            'jk': 'Джейку',
            'asp': 'АСП'
        };
        const mapping = {};
        jsonBrands.forEach(brand => {
            mapping[brand] = defaultMapping[brand] || brand.toUpperCase();
        });
        return mapping;
    }
    
    static formatDecimal(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        return parseFloat(value).toFixed(decimals);
    }
    
    static formatRevenue(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + ' млн';
        }
        return value ? value.toLocaleString('ru-RU') : '0';
    }
    
    static formatRevenueForProgressBar(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1);
        }
        return value ? value.toLocaleString('ru-RU') : '0';
    }
    
    static renderStars(score) {
        if (typeof score === 'undefined' || score === null) return '';
        const fullStars = Math.floor(score);
        const hasHalfStar = score % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '<span class="star">★</span>';
        if (hasHalfStar) stars += '<span class="star">★</span>';
        for (let i = 0; i < emptyStars; i++) stars += '<span class="star empty">★</span>';
        return `<div class="stars">${stars}</div>`;
    }
    
    static generateMonthOptions() {
        const currentDate = new Date();
        let options = '';
        for (let i = 0; i < 36; i++) {
            const date = new Date(currentDate);
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthName = this.getMonthName(month);
            const value = `${year}-${month.toString().padStart(2, '0')}`;
            const display = `${monthName} ${year}`;
            options += `<option value="${value}">${display}</option>`;
        }
        return options;
    }
}

// Добавляем глобальную переменную
window.DashboardUtils = DashboardUtils;
