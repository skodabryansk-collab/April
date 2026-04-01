// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Логируем все запросы
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Путь к файлу с пользователями
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
console.log(`📁 Путь к файлу users.json: ${USERS_FILE}`);

// Создаем папку data
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    console.log('📁 Папка data не найдена, создаем...');
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Папка data создана');
}

// Инициализация файла с пользователями
if (!fs.existsSync(USERS_FILE)) {
    console.log('📄 Файл users.json не найден, создаем с администратором...');
    
    const defaultUsers = [
        {
            id: Date.now(),
            login: 'admin',
            password: 'Admin123!', // ← ИЗМЕНИТЕ ЭТОТ ПАРОЛЬ!
            role: 'admin',
            name: 'Главный администратор'
        }
    ];
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    console.log('✅ Файл users.json создан с администратором');
    console.log('👤 Логин: admin');
    console.log('🔑 Пароль: Admin123!');
    console.log('⚠️ После входа СРАЗУ смените пароль в админ-панели!');
} else {
    console.log('📄 Файл users.json существует');
    
    // Проверяем валидность JSON
    try {
        const content = fs.readFileSync(USERS_FILE, 'utf8');
        const users = JSON.parse(content);
        console.log(`✅ Найдено ${users.length} пользователей`);
        
        // Если пользователей нет, создаем админа
        if (users.length === 0) {
            console.log('👤 Пользователей нет, добавляем администратора');
            const adminUser = {
                id: Date.now(),
                login: 'admin',
                password: 'Admin123!',
                role: 'admin',
                name: 'Главный администратор'
            };
            users.push(adminUser);
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            console.log('✅ Администратор добавлен');
        }
    } catch (e) {
        console.error('❌ Ошибка в users.json:', e.message);
        // Создаем резервную копию
        const backupPath = path.join(dataDir, `users.backup.${Date.now()}.json`);
        fs.copyFileSync(USERS_FILE, backupPath);
        console.log(`📄 Резервная копия: ${backupPath}`);
        
        // Создаем новый файл с админом
        const defaultUsers = [
            {
                id: Date.now(),
                login: 'admin',
                password: 'Admin123!',
                role: 'admin',
                name: 'Главный администратор'
            }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        console.log('✅ Файл users.json пересоздан с администратором');
    }
}

// ===== API ЭНДПОИНТЫ =====

app.get('/api/users', (req, res) => {
    console.log('📥 GET /api/users');
    try {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        const usersWithoutPasswords = users.map(u => ({
            id: u.id,
            login: u.login,
            role: u.role,
            name: u.name
        }));
        res.json(usersWithoutPasswords);
    } catch (error) {
        console.error('❌ Ошибка чтения пользователей:', error);
        res.status(500).json({ error: 'Ошибка чтения пользователей' });
    }
});

app.post('/api/login', (req, res) => {
    console.log('📥 POST /api/login');
    try {
        const { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({ success: false, error: 'Укажите логин и пароль' });
        }
        
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        console.log(`🔍 Поиск пользователя: ${login}`);
        
        const user = users.find(u => u.login === login);
        
        if (!user) {
            console.log(`❌ Пользователь ${login} не найден`);
            return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
        }
        
        // Сравниваем пароли (в будущем здесь будет bcrypt)
        if (user.password !== password) {
            console.log(`❌ Неверный пароль для ${login}`);
            console.log(`   Введенный пароль: ${password}`);
            console.log(`   Пароль в базе: ${user.password}`);
            return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
        }
        
        const { password: _, ...userWithoutPassword } = user;
        console.log(`✅ Успешный вход: ${login}`);
        res.json({ 
            success: true, 
            user: userWithoutPassword,
            token: generateToken(user.id)
        });
        
    } catch (error) {
        console.error('❌ Ошибка авторизации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Остальные эндпоинты без изменений...
app.post('/api/users', (req, res) => {
    try {
        const { name, login, password, role } = req.body;
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        
        if (users.find(u => u.login === login)) {
            return res.status(400).json({ error: 'Логин уже существует' });
        }
        
        const newUser = {
            id: Date.now(),
            name,
            login,
            password,
            role
        };
        
        users.push(newUser);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        
        const { password: _, ...userWithoutPassword } = newUser;
        res.json(userWithoutPassword);
        console.log(`✅ Добавлен пользователь: ${login}`);
    } catch (error) {
        console.error('❌ Ошибка добавления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        
        const filteredUsers = users.filter(u => u.id !== userId);
        
        if (filteredUsers.length === users.length) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        fs.writeFileSync(USERS_FILE, JSON.stringify(filteredUsers, null, 2));
        res.json({ success: true });
        console.log(`✅ Удален пользователь id: ${userId}`);
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/check-token', (req, res) => {
    const { token } = req.body;
    if (token) {
        res.json({ valid: true });
    } else {
        res.json({ valid: false });
    }
});

function generateToken(userId) {
    return Buffer.from(`${userId}-${Date.now()}`).toString('base64');
}

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        time: new Date().toISOString(),
        nodeVersion: process.version
    });
});

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📁 Папка с данными: ${dataDir}`);
    console.log(`📄 Файл пользователей: ${USERS_FILE}`);
    console.log('='.repeat(60));
});