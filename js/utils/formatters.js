// js/utils/formatters.js

export const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Math.round(num).toLocaleString('ru-RU');
};

export const formatDecimal = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return parseFloat(value).toFixed(decimals);
};

export const formatRevenue = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    
    const absValue = Math.abs(value);
    
    if (absValue >= 1000000) {
        return (value / 1000000).toFixed(1);
    } else if (absValue >= 1000) {
        return (value / 1000).toFixed(0);
    } else {
        return Math.round(value).toString();
    }
};

export const formatRevenueForProgressBar = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    
    const absValue = Math.abs(value);
    
    if (absValue >= 1000000) {
        return (value / 1000000).toFixed(1);
    } else if (absValue >= 1000) {
        return (value / 1000).toFixed(0);
    } else {
        return Math.round(value).toString();
    }
};

export const calculatePercentage = (value, total) => {
    if (total === null || total === undefined || total === 0) return 0;
    return Math.round((value / total) * 100);
};

export const getMonthName = (monthNumber) => {
    const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[monthNumber - 1] || '';
};

export const renderStars = (score) => {
    if (typeof score === 'undefined' || score === null || isNaN(score)) return '';
    const fullStars = Math.floor(score);
    const emptyStars = 5 - fullStars;
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<span class="star">★</span>';
    for (let i = 0; i < emptyStars; i++) stars += '<span class="star empty">★</span>';
    return `<div class="stars">${stars}</div>`;
};

export const generateMonthOptions = () => {
    const currentDate = new Date();
    let options = '';
    for (let i = 0; i < 36; i++) {
        const date = new Date(currentDate);
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthName = getMonthName(month);
        const value = `${year}-${month.toString().padStart(2, '0')}`;
        options += `<option value="${value}">${monthName} ${year}</option>`;
    }
    return options;
};