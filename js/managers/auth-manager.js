// js/managers/auth-manager.js

export class AuthManager {
    constructor(authService) {
        this.authService = authService;
        this.currentUser = null;
        this.onLoginCallbacks = [];
        this.onLogoutCallbacks = [];
        
        this.init();
    }
    
    init() {
        this.setupLoginModal();
        this.setupLogoutButton();
        this.checkSession();
    }
    
    setupLoginModal() {
        const loginModal = document.getElementById('loginModal');
        const loginBtn = document.getElementById('loginBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const login = document.getElementById('loginUsername').value;
                const password = document.getElementById('loginPassword').value;
                
                const result = await this.authService.login(login, password);
                
                if (result.success) {
                    this.currentUser = result.user;
                    loginModal.style.display = 'none';
                    this.triggerLoginCallbacks();
                    this.showNotification(`Добро пожаловать, ${result.user.name}!`, 'success');
                } else {
                    const errorDiv = document.getElementById('loginError');
                    errorDiv.textContent = result.error;
                    errorDiv.style.display = 'block';
                }
            });
        }
    }
    
    setupLogoutButton() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.authService.logout();
                this.currentUser = null;
                document.getElementById('loginModal').style.display = 'flex';
                this.triggerLogoutCallbacks();
                this.showNotification('Вы вышли из системы', 'info');
            });
        }
    }
    
    async checkSession() {
        this.currentUser = await this.authService.checkSession();
        
        if (this.currentUser) {
            document.getElementById('loginModal').style.display = 'none';
            this.triggerLoginCallbacks();
        }
    }
    
    onLogin(callback) {
        this.onLoginCallbacks.push(callback);
    }
    
    onLogout(callback) {
        this.onLogoutCallbacks.push(callback);
    }
    
    triggerLoginCallbacks() {
        this.onLoginCallbacks.forEach(cb => cb(this.currentUser));
    }
    
    triggerLogoutCallbacks() {
        this.onLogoutCallbacks.forEach(cb => cb());
    }
    
    showUserPanel() {
        const userPanel = document.getElementById('userPanel');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const userRoleDisplay = document.getElementById('userRoleDisplay');
        
        if (userPanel && this.currentUser) {
            userNameDisplay.textContent = this.currentUser.name;
            userRoleDisplay.textContent = this.currentUser.role === 'admin' ? 'Администратор' : 'Наблюдатель';
            userRoleDisplay.style.background = this.currentUser.role === 'admin' ? '#ffebee' : '#e8f5e9';
            userRoleDisplay.style.color = this.currentUser.role === 'admin' ? '#c62828' : '#2e7d32';
            userPanel.style.display = 'flex';
        }
    }
    
    hideUserPanel() {
        const userPanel = document.getElementById('userPanel');
        if (userPanel) {
            userPanel.style.display = 'none';
        }
    }
    
    isAdmin() {
        return this.currentUser?.role === 'admin';
    }
    
    showNotification(message, type) {
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
}