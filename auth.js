// auth.js
class AuthService {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.apiUrl = '/api';
    }
    
    async login(login, password) {
        try {
            const response = await fetch(`${this.apiUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ login, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                this.token = data.token;
                
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    }
    
    async checkSession() {
        const token = localStorage.getItem('authToken');
        const savedUser = localStorage.getItem('currentUser');
        
        if (!token || !savedUser) return null;
        
        try {
            const response = await fetch(`${this.apiUrl}/check-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            
            if (data.valid) {
                this.currentUser = JSON.parse(savedUser);
                this.token = token;
                return this.currentUser;
            } else {
                this.logout();
                return null;
            }
        } catch (error) {
            console.error('Ошибка проверки сессии:', error);
            this.currentUser = JSON.parse(savedUser);
            this.token = token;
            return this.currentUser;
        }
    }
    
    logout() {
        this.currentUser = null;
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }
    
    async getAllUsers() {
        try {
            const response = await fetch(`${this.apiUrl}/users`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('Ошибка получения пользователей:', error);
            return [];
        }
    }
    
    async addUser(userData) {
        try {
            const response = await fetch(`${this.apiUrl}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                return { success: true, user: await response.json() };
            } else {
                const error = await response.json();
                return { success: false, error: error.error };
            }
        } catch (error) {
            console.error('Ошибка добавления пользователя:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    }
    
    async removeUser(userId) {
        try {
            const response = await fetch(`${this.apiUrl}/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('Ошибка удаления пользователя:', error);
            return false;
        }
    }
    
    isAdmin() {
        return this.currentUser?.role === 'admin';
    }
    
    isViewer() {
        return this.currentUser?.role === 'viewer';
    }
    
    hasEditRights() {
        return this.isAdmin();
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
}

// Добавляем глобальную переменную
window.AuthService = AuthService;
