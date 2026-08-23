// api/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const JSON_DATA_PATH = path.join(__dirname, '..', 'data', 'daily_facts.json');
const EXTERNAL_JSON_URL = process.env.DATA_SOURCE_URL || 'https://xml.krona-auto.ru/Dashboard/daily_facts.json';
const DATA_CACHE_TTL_MS = Number(process.env.DATA_CACHE_TTL_MS || 5 * 60 * 1000);
let externalDataCache = { data: null, fetchedAt: 0 };

async function fetchExternalData(force = false) {
  const cacheIsFresh = externalDataCache.data && Date.now() - externalDataCache.fetchedAt < DATA_CACHE_TTL_MS;
  if (!force && cacheIsFresh) return externalDataCache.data;
  const response = await fetch(EXTERNAL_JSON_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Источник данных вернул HTTP ' + response.status);
  const data = await response.json();
  if (!data || !Array.isArray(data.dailyFacts)) throw new Error('Источник вернул JSON без массива dailyFacts');
  externalDataCache = { data, fetchedAt: Date.now() };
  return data;
}

function addSourceMetadata(data, source, fallbackAt = null) {
  return { ...data, source, fallbackAt };
}

function readLocalFallback() {
  if (!fs.existsSync(JSON_DATA_PATH)) return null;
  const data = JSON.parse(fs.readFileSync(JSON_DATA_PATH, 'utf8'));
  if (!data || !Array.isArray(data.dailyFacts)) throw new Error('Fallback-файл не содержит массив dailyFacts');
  return data;
}

// Подключение к PostgreSQL
let pool = null;
let dbConnected = false;
let wakeupInterval = null;

async function initDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL не установлен!');
      return;
    }
    
    console.log('🔌 Подключение к PostgreSQL...');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    
    // Тестовый запрос
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Подключено к PostgreSQL, время:', result.rows[0].now);
    dbConnected = true;
    
    // Создаем таблицу users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        login VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица users создана');
    
    // Проверяем администратора
    const adminCheck = await pool.query('SELECT * FROM users WHERE login = $1', ['admin']);
    
    if (adminCheck.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (id, login, password, role, name) VALUES ($1, $2, $3, $4, $5)',
        [Date.now(), 'admin', 'Admin123!', 'admin', 'Главный администратор']
      );
      console.log('👑 Создан администратор');
    }
    
    // Запускаем keep-alive интервал (каждые 4 минуты будим базу)
    if (wakeupInterval) clearInterval(wakeupInterval);
    wakeupInterval = setInterval(async () => {
      try {
        if (pool) {
          const client = await pool.connect();
          await client.query('SELECT 1');
          client.release();
          console.log('💓 Keep-alive запрос выполнен');
        }
      } catch (err) {
        console.error('⚠️ Keep-alive ошибка:', err.message);
        // Пробуем переподключиться
        try {
          await pool.query('SELECT 1');
        } catch (e) {
          console.log('🔄 Попытка переподключения...');
          dbConnected = false;
          setTimeout(() => reconnectDatabase(), 1000);
        }
      }
    }, 240000); // 4 минуты
    
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err.message);
    dbConnected = false;
    pool = null;
  }
}

async function reconnectDatabase() {
  try {
    if (pool) {
      await pool.end();
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pool.query('SELECT 1');
    dbConnected = true;
    console.log('✅ Переподключение успешно');
  } catch (err) {
    console.error('❌ Ошибка переподключения:', err.message);
    dbConnected = false;
  }
}

// Запускаем инициализацию
initDatabase();

// ===== API ЭНДПОИНТЫ =====

// Эндпоинт для принудительного пробуждения базы
app.get('/api/wakeup', async (req, res) => {
  console.log('📥 GET /api/wakeup - пробуждение базы данных');
  try {
    if (!pool) {
      await initDatabase();
    }
    
    if (pool) {
      const result = await pool.query('SELECT NOW()');
      dbConnected = true;
      res.json({ 
        success: true, 
        time: result.rows[0].now,
        message: 'База данных разбужена'
      });
    } else {
      res.json({ success: false, error: 'Не удалось подключиться' });
    }
  } catch (err) {
    console.error('Ошибка пробуждения:', err);
    res.json({ success: false, error: err.message });
  }
});

// Получить данные
app.get('/api/data', async (req, res) => {
  console.log('📥 GET /api/data');
  try {
    const data = await fetchExternalData(req.query.refresh === 'true');
    res.json(addSourceMetadata(data, 'external'));
  } catch (externalError) {
    console.error('❌ Ошибка внешнего источника:', externalError.message);
    try {
      const fallback = readLocalFallback();
      if (fallback) return res.json(addSourceMetadata(fallback, 'fallback', new Date().toISOString()));
    } catch (fallbackError) {
      console.error('❌ Ошибка fallback-файла:', fallbackError.message);
    }
    res.status(502).json({ error: 'Не удалось получить данные из внешнего источника' });
  }
});

// Авторизация с автоматическим пробуждением
app.post('/api/login', async (req, res) => {
  console.log('📥 POST /api/login');
  console.log('  Login:', req.body.login);
  
  try {
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'Укажите логин и пароль' });
    }
    
    // Если база не подключена, пробуем подключиться
    if (!dbConnected || !pool) {
      console.log('⚠️ База данных спит, пробуждение...');
      try {
        await initDatabase();
        // Даем время на подключение
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.log('Ошибка пробуждения:', err.message);
      }
    }
    
    // Если база все еще не подключена, используем fallback
    if (!dbConnected || !pool) {
      console.log('⚠️ Используем fallback авторизацию');
      
      // Fallback для admin
      if (login === 'admin' && password === 'Admin123!') {
        return res.json({
          success: true,
          user: { id: 1, login: 'admin', name: 'Администратор', role: 'admin' },
          token: Buffer.from(`1-${Date.now()}`).toString('base64')
        });
      }
      
      return res.status(503).json({ 
        success: false, 
        error: 'База данных засыпает, попробуйте еще раз через 2-3 секунды' 
      });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Пользователь ${login} не найден`);
      return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    }
    
    const user = result.rows[0];
    
    if (user.password !== password) {
      console.log(`❌ Неверный пароль для ${login}`);
      return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    }
    
    console.log(`✅ Успешный вход: ${login}`);
    
    res.json({
      success: true,
      user: { id: user.id, login: user.login, name: user.name, role: user.role },
      token: Buffer.from(`${user.id}-${Date.now()}`).toString('base64')
    });
    
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
  console.log('📥 GET /api/users');
  try {
    if (!dbConnected || !pool) {
      // Возвращаем fallback пользователей
      const fallbackUsers = [
        { id: 1, login: 'admin', name: 'Администратор', role: 'admin' }
      ];
      return res.json(fallbackUsers);
    }
    
    const result = await pool.query('SELECT id, login, name, role FROM users ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавить пользователя
app.post('/api/users', async (req, res) => {
  console.log('📥 POST /api/users');
  try {
    const { name, login, password, role } = req.body;
    
    if (!name || !login || !password || !role) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    if (!dbConnected || !pool) {
      return res.status(503).json({ error: 'База данных недоступна, попробуйте позже' });
    }
    
    const checkResult = await pool.query('SELECT id FROM users WHERE login = $1', [login]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Логин уже существует' });
    }
    
    const newId = Date.now();
    const result = await pool.query(
      'INSERT INTO users (id, login, password, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING id, login, name, role',
      [newId, login, password, role, name]
    );
    
    console.log(`✅ Добавлен пользователь: ${login}`);
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('❌ Ошибка добавления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  console.log(`📥 DELETE /api/users/${req.params.id}`);
  try {
    const userId = parseInt(req.params.id);
    
    if (!dbConnected || !pool) {
      return res.status(503).json({ error: 'База данных недоступна' });
    }
    
    const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    
    if (parseInt(adminCount.rows[0].count) === 1) {
      const userToDelete = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (userToDelete.rows.length > 0 && userToDelete.rows[0].role === 'admin') {
        return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
      }
    }
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    console.log(`✅ Удален пользователь id: ${userId}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Ошибка удаления:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/check-token', (req, res) => {
  res.json({ valid: !!req.body.token });
});

app.post('/api/refresh-data', async (req, res) => {
  console.log('📥 POST /api/refresh-data');
  try {
    const data = await fetchExternalData(true);
    res.json({ success: true, records: data.dailyFacts?.length || 0, exportDate: data.exportDate || null, source: EXTERNAL_JSON_URL, message: 'Данные обновлены из внешнего источника' });
  } catch (error) {
    console.error('❌ Ошибка обновления данных:', error);
    res.status(502).json({ success: false, error: 'Внешний источник недоступен' });
  }
});


app.get('/health', async (req, res) => {
  let dbStatus = false;
  let userCount = 0;
  
  if (pool) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      dbStatus = true;
      
      const countResult = await pool.query('SELECT COUNT(*) FROM users');
      userCount = parseInt(countResult.rows[0].count);
    } catch (e) {
      dbStatus = false;
    }
  }

  
  res.json({ 
    status: 'OK', 
    time: new Date().toISOString(),
    databaseConnected: dbStatus,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    dataExists: fs.existsSync(JSON_DATA_PATH),
    userCount: userCount
  });
});

module.exports = app;
