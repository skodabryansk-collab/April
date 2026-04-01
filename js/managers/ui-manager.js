// js/managers/ui-manager.js

export class UIManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.planLocked = localStorage.getItem('planLocked') === 'true';
        this.isInterfaceEnabled = false;
    }
    
    /**
     * Блокирует весь интерфейс (режим просмотра для неавторизованных)
     */
    disableInterface() {
        const formContainer = document.querySelector('.form-container');
        const jsonSection = document.querySelector('.json-section');
        const infoPanel = document.querySelector('.info-panel');
        
        if (formContainer) formContainer.classList.add('blurred');
        if (jsonSection) jsonSection.classList.add('blurred');
        if (infoPanel) infoPanel.classList.add('blurred');
        
        this.isInterfaceEnabled = false;
    }
    
    /**
     * Разблокирует интерфейс после авторизации
     */
    enableInterface() {
        const formContainer = document.querySelector('.form-container');
        const jsonSection = document.querySelector('.json-section');
        const infoPanel = document.querySelector('.info-panel');
        
        if (formContainer) formContainer.classList.remove('blurred');
        if (jsonSection) jsonSection.classList.remove('blurred');
        if (infoPanel) infoPanel.classList.remove('blurred');
        
        this.isInterfaceEnabled = true;
    }
    
    /**
     * Блокирует все поля ввода плана
     */
    lockPlanInputs() {
        const savedPlan = JSON.parse(localStorage.getItem('savedPlan') || '{}');
        
        document.querySelectorAll('.input-table input').forEach(input => {
            const id = input.id;
            if (id && (id.endsWith('_sp') || id.endsWith('_tp') || 
                       id.endsWith('_rp') || id.endsWith('_cp') || 
                       id.endsWith('_trp'))) {
                input.disabled = true;
                input.classList.add('locked');
            }
        });
        
        this.planLocked = true;
        localStorage.setItem('planLocked', 'true');
    }
    
    /**
     * Разблокирует поля ввода плана (требуется пароль)
     */
    unlockPlanInputs() {
        const password = prompt('Введите пароль для редактирования плана:');
        
        if (password === '000') {
            document.querySelectorAll('.input-table input').forEach(input => {
                const id = input.id;
                if (id && (id.endsWith('_sp') || id.endsWith('_tp') || 
                           id.endsWith('_rp') || id.endsWith('_cp') || 
                           id.endsWith('_trp'))) {
                    input.disabled = false;
                    input.classList.remove('locked');
                }
            });
            
            this.planLocked = false;
            localStorage.setItem('planLocked', 'false');
            this.showNotification('План разблокирован', 'success');
            return true;
        } else {
            this.showNotification('Неверный пароль', 'error');
            return false;
        }
    }
    
    /**
     * Блокирует все поля ввода (для наблюдателей)
     */
    disableAllInputs() {
        document.querySelectorAll('.input-table input').forEach(input => {
            input.disabled = true;
            input.classList.add('locked');
        });
    }
    
    /**
     * Разблокирует поля ввода (для админов)
     */
    enableAllInputs() {
        document.querySelectorAll('.input-table input').forEach(input => {
            if (!input.classList.contains('locked')) {
                input.disabled = false;
            }
        });
    }
    
    /**
     * Показывает панель администратора и скрывает/показывает блоки для наблюдателя
     */
    showAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.style.display = 'block';
            adminPanel.classList.remove('viewer-hidden');
        }
        
        // Показываем блоки, скрытые для наблюдателя
        this.showViewerHiddenBlocks();
    }
    
    /**
     * Скрывает панель администратора
     */
    hideAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.style.display = 'none';
        }
    }
    
    /**
     * Показывает режим просмотра (для наблюдателей)
     */
    showViewerMode() {
        this.disableAllInputs();
        
        // Скрываем админские кнопки
        const adminButtons = [
            'loadJsonBtn', 'importJsonBtn', 'updatePlansBtn', 'clearJsonBtn',
            'loadJsonUrlBtn', 'saveJsonUrlBtn', 'clearJsonUrlBtn', 'testJsonUrlBtn',
            'saveBtn', 'lockBtn', 'unlockBtn', 'clearHistoryBtn', 'saveMonthlyBtn',
            'calculatePlanBtn', 'applyPlanBtn'
        ];
        
        adminButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.style.display = 'none';
        });
        
        // Скрываем блоки, недоступные для наблюдателя
        this.hideViewerHiddenBlocks();
        
        // Скрываем JSON секцию
        const jsonSection = document.querySelector('.json-section');
        if (jsonSection) jsonSection.style.display = 'none';
        
        // Добавляем заметку о режиме просмотра
        if (!document.getElementById('viewerNote')) {
            const note = document.createElement('div');
            note.id = 'viewerNote';
            note.style.cssText = `
                background: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 15px;
                border-radius: 8px;
                margin: 10px 0;
                font-size: 13px;
            `;
            note.innerHTML = '👁️ Вы находитесь в режиме просмотра. Только администратор может редактировать данные и загружать файлы.';
            const formContainer = document.querySelector('.form-container');
            if (formContainer) formContainer.insertBefore(note, formContainer.firstChild);
        }
    }
    
    /**
     * Показывает режим администратора
     */
    showAdminMode() {
        this.enableAllInputs();
        
        // Показываем админские кнопки
        const adminButtons = [
            'loadJsonBtn', 'importJsonBtn', 'updatePlansBtn', 'clearJsonBtn',
            'loadJsonUrlBtn', 'saveJsonUrlBtn', 'clearJsonUrlBtn', 'testJsonUrlBtn',
            'saveBtn', 'lockBtn', 'unlockBtn', 'clearHistoryBtn', 'saveMonthlyBtn',
            'calculatePlanBtn', 'applyPlanBtn'
        ];
        
        adminButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.style.display = 'flex';
        });
        
        // Показываем JSON секцию
        const jsonSection = document.querySelector('.json-section');
        if (jsonSection) jsonSection.style.display = 'block';
        
        // Показываем блоки для админа
        this.showViewerHiddenBlocks();
        
        // Удаляем заметку о режиме просмотра
        const viewerNote = document.getElementById('viewerNote');
        if (viewerNote) viewerNote.remove();
        
        this.showAdminPanel();
    }
    
    /**
     * Скрывает блоки, недоступные для наблюдателя
     */
    hideViewerHiddenBlocks() {
        const hiddenBlocks = document.querySelectorAll('.viewer-hidden');
        hiddenBlocks.forEach(block => {
            block.style.display = 'none';
        });
    }
    
    /**
     * Показывает блоки, скрытые для наблюдателя (для админа)
     */
    showViewerHiddenBlocks() {
        const hiddenBlocks = document.querySelectorAll('.viewer-hidden');
        hiddenBlocks.forEach(block => {
            block.style.display = 'block';
        });
        
        // Особые случаи для некоторых блоков
        const planningContainer = document.getElementById('planningContainer');
        if (planningContainer) planningContainer.style.display = 'block';
        
        const totalsContainer = document.getElementById('totalsContainer');
        if (totalsContainer) totalsContainer.style.display = 'block';
        
        const historySection = document.querySelector('.history-section');
        if (historySection) historySection.style.display = 'block';
        
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) adminPanel.style.display = 'block';
    }
    
    /**
     * Показывает модальное окно сохранения месячных итогов
     */
    showMonthlyModal(availableMonths, currentMonth) {
        const modal = document.getElementById('monthlyModal');
        const saveMonthSelect = document.getElementById('saveMonth');
        
        if (!modal || !saveMonthSelect) return;
        
        let options = '';
        if (availableMonths && availableMonths.length > 0) {
            availableMonths.forEach(month => {
                const [year, monthNum] = month.split('-');
                const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                const monthName = monthNames[parseInt(monthNum) - 1];
                options += `<option value="${month}">${monthName} ${year}</option>`;
            });
        } else {
            options = '<option value="2026-01">Январь 2026</option>';
        }
        
        saveMonthSelect.innerHTML = options;
        
        if (currentMonth) {
            const optionExists = Array.from(saveMonthSelect.options).some(option => option.value === currentMonth);
            if (optionExists) saveMonthSelect.value = currentMonth;
        }
        
        modal.style.display = 'flex';
    }
    
    /**
     * Скрывает модальное окно
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    /**
     * Показывает уведомление
     */
    showNotification(message, type = 'info') {
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
    
    /**
     * Проверяет, заблокирован ли план
     */
    isPlanLocked() {
        return this.planLocked;
    }
    
    /**
     * Проверяет, включен ли интерфейс
     */
    isInterfaceEnabled() {
        return this.isInterfaceEnabled;
    }
}
