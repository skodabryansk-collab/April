// api/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const webpush = require('web-push');

const app = express();

app.use(cors());
app.use(express.json());

const JSON_DATA_PATH = process.env.FALLBACK_DATA_PATH || path.join(__dirname, '..', 'data', 'daily_facts.json');
const EXTERNAL_JSON_URL = process.env.DATA_SOURCE_URL || 'https://xml.krona-auto.ru/Dashboard/daily_facts.json';
const DATA_CACHE_TTL_MS = Number(process.env.DATA_CACHE_TTL_MS || 5 * 60 * 1000);
const FALLBACK_LOCK_PATH = `${JSON_DATA_PATH}.lock`;
const configuredFallbackLockTimeout = Number(process.env.FALLBACK_LOCK_TIMEOUT_MS);
const FALLBACK_LOCK_TIMEOUT_MS = Number.isFinite(configuredFallbackLockTimeout) && configuredFallbackLockTimeout >= 0
  ? configuredFallbackLockTimeout
  : 5000;
const FALLBACK_LOCK_RETRY_MS = 10;
let externalDataCache = { data: null, fetchedAt: 0, requestSequence: 0 };
let externalDataRequestSequence = 0;
let fallbackWriteSequence = 0;
const memoryPushSubscriptions = new Map();
let memoryDataState = null;

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function subscriptionKey(subscription) {
  return typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
}

function dataFingerprint(data) {
  const facts = Array.isArray(data?.dailyFacts) ? data.dailyFacts : [];
  const records = facts
    .filter(record => record && record.date && !record.month)
    .map(record => JSON.stringify(record))
    .sort();
  return crypto.createHash('sha256').update(records.join('\n')).digest('hex');
}

function getDataUpdateDetails(previousState, data) {
  const facts = Array.isArray(data?.dailyFacts) ? data.dailyFacts : [];
  const datedFacts = facts.filter(record => record && record.date && !record.month);
  const previousRecords = Number(previousState?.record_count || 0);
  const currentRecords = datedFacts.length;
  const dates = [...new Set(datedFacts.map(record => record.date))].sort();
  const latestDate = dates.at(-1) || null;
  const addedRecords = Math.max(0, currentRecords - previousRecords);
  return { currentRecords, latestDate, addedRecords, signature: dataFingerprint(data) };
}

async function getDataUpdateState() {
  if (pool && dbConnected) {
    const result = await pool.query('SELECT signature, record_count, latest_date FROM data_update_state WHERE id = 1');
    return result.rows[0] || null;
  }
  return memoryDataState;
}

async function saveDataUpdateState(details) {
  if (pool && dbConnected) {
    await pool.query(`
      INSERT INTO data_update_state (id, signature, record_count, latest_date, updated_at)
      VALUES (1, $1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET signature = EXCLUDED.signature,
        record_count = EXCLUDED.record_count, latest_date = EXCLUDED.latest_date,
        updated_at = CURRENT_TIMESTAMP
    `, [details.signature, details.currentRecords, details.latestDate]);
  }
  memoryDataState = { signature: details.signature, record_count: details.currentRecords, latest_date: details.latestDate };
}

async function listPushSubscriptions() {
  if (pool && dbConnected) {
    const result = await pool.query('SELECT endpoint, subscription FROM push_subscriptions ORDER BY created_at');
    return result.rows;
  }
  return [...memoryPushSubscriptions.values()];
}

async function removePushSubscription(endpoint) {
  memoryPushSubscriptions.delete(endpoint);
  if (pool && dbConnected) await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

async function sendPushToSubscriptions(payload) {
  if (!configureWebPush()) return { notified: 0, configured: false };
  let notified = 0;
  for (const row of await listPushSubscriptions()) {
    try {
      await webpush.sendNotification(row.subscription || row, JSON.stringify(payload));
      notified++;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await removePushSubscription(row.endpoint);
      else console.error('⚠️ Ошибка отправки push:', error.statusCode || error.message);
    }
  }
  return { notified, configured: true };
}

async function checkForDataUpdates({ notify = true } = {}) {
  const data = await fetchExternalData(true);
  const previousState = await getDataUpdateState();
  const details = getDataUpdateDetails(previousState, data);
  const changed = Boolean(previousState && previousState.signature !== details.signature);
  await saveDataUpdateState(details);
  if (!changed || !notify || !configureWebPush()) {
    return { changed, notified: 0, records: details.currentRecords, addedRecords: details.addedRecords, latestDate: details.latestDate };
  }

  const payload = JSON.stringify({
    title: 'Данные обновлены',
    body: details.addedRecords > 0
      ? `Добавлено записей: ${details.addedRecords}. Последняя дата: ${details.latestDate || 'не указана'}.`
      : `Источник обновлён. Последняя дата: ${details.latestDate || 'не указана'}.`,
    url: '/',
    tag: 'daily-facts-update'
  });
  const delivery = await sendPushToSubscriptions(JSON.parse(payload));
  return { changed, notified: delivery.notified, records: details.currentRecords, addedRecords: details.addedRecords, latestDate: details.latestDate };
}

async function fetchExternalData(force = false) {
  const cacheIsFresh = externalDataCache.data && Date.now() - externalDataCache.fetchedAt < DATA_CACHE_TTL_MS;
  if (!force && cacheIsFresh) return externalDataCache.data;
  const requestSequence = ++externalDataRequestSequence;
  const response = await fetch(EXTERNAL_JSON_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Источник данных вернул HTTP ' + response.status);
  const data = await response.json();
  if (!data || !Array.isArray(data.dailyFacts)) throw new Error('Источник вернул JSON без массива dailyFacts');
  try {
    writeLocalFallback(data, requestSequence);
  } catch (error) {
    console.error('⚠️ Не удалось обновить локальный fallback:', error.message);
  }
  if (requestSequence >= externalDataCache.requestSequence) {
    externalDataCache = { data, fetchedAt: Date.now(), requestSequence };
  }
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

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireFallbackLock() {
  const deadline = Date.now() + FALLBACK_LOCK_TIMEOUT_MS;

  while (true) {
    let lockDescriptor;
    try {
      lockDescriptor = fs.openSync(FALLBACK_LOCK_PATH, 'wx');
      fs.writeFileSync(lockDescriptor, `${process.pid}\n`, 'utf8');
      return lockDescriptor;
    } catch (error) {
      if (lockDescriptor !== undefined) fs.closeSync(lockDescriptor);
      if (error.code !== 'EEXIST' || Date.now() >= deadline) {
        throw new Error(`Не удалось получить блокировку fallback: ${error.message}`);
      }
      sleepSync(Math.min(FALLBACK_LOCK_RETRY_MS, Math.max(1, deadline - Date.now())));
    }
  }
}

function releaseFallbackLock(lockDescriptor) {
  try {
    fs.closeSync(lockDescriptor);
  } finally {
    try {
      fs.unlinkSync(FALLBACK_LOCK_PATH);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('⚠️ Не удалось снять блокировку fallback:', error.message);
      }
    }
  }
}

function writeLocalFallback(data, requestSequence) {
  if (requestSequence < fallbackWriteSequence) return;

  const lockDescriptor = acquireFallbackLock();

  try {
    if (requestSequence < fallbackWriteSequence) return;

    const temporaryPath = `${JSON_DATA_PATH}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let temporaryFileExists = true;

    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2) + '\n', {
        encoding: 'utf8',
        flag: 'wx',
      });
      fs.renameSync(temporaryPath, JSON_DATA_PATH);
      temporaryFileExists = false;
      fallbackWriteSequence = requestSequence;
    } finally {
      if (temporaryFileExists) {
        try {
          fs.unlinkSync(temporaryPath);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            console.error('⚠️ Не удалось удалить временный fallback-файл:', cleanupError.message);
          }
        }
      }
    }
  } finally {
    releaseFallbackLock(lockDescriptor);
  }
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        subscription JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS data_update_state (
        id INTEGER PRIMARY KEY,
        signature TEXT NOT NULL,
        record_count INTEGER NOT NULL DEFAULT 0,
        latest_date TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблицы push и состояния источника готовы');
    
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

app.get('/api/push/public-key', (req, res) => {
  if (!configureWebPush() || !process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ success: false, error: 'Push-уведомления пока не настроены' });
  }
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    const endpoint = subscriptionKey(subscription);
    if (!endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ success: false, error: 'Некорректная push-подписка' });
    }
    const row = { endpoint, subscription };
    memoryPushSubscriptions.set(endpoint, row);
    if (pool && dbConnected) {
      await pool.query(`
        INSERT INTO push_subscriptions (endpoint, subscription, updated_at)
        VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription,
          updated_at = CURRENT_TIMESTAMP
      `, [endpoint, JSON.stringify(subscription)]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка сохранения push-подписки:', error.message);
    res.status(500).json({ success: false, error: 'Не удалось сохранить подписку' });
  }
});

app.delete('/api/push/subscribe', async (req, res) => {
  try {
    const endpoint = subscriptionKey(req.body);
    if (!endpoint) return res.status(400).json({ success: false, error: 'Не указан endpoint подписки' });
    await removePushSubscription(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка удаления push-подписки:', error.message);
    res.status(500).json({ success: false, error: 'Не удалось удалить подписку' });
  }
});

async function handleDataUpdateCheck(req, res) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = req.get('x-cron-secret') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Недействительный ключ проверки' });
  }
  try {
    const result = await checkForDataUpdates();
    console.log('🔔 Проверка обновления данных:', result);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Ошибка проверки обновления данных:', error.message);
    res.status(502).json({ success: false, error: 'Источник данных недоступен' });
  }
}

app.get('/api/check-data-updates', handleDataUpdateCheck);
app.post('/api/check-data-updates', handleDataUpdateCheck);

app.post('/api/test-push', async (req, res) => {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = req.get('x-cron-secret') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Недействительный ключ проверки' });
  }
  try {
    const delivery = await sendPushToSubscriptions({
      title: 'Тестовое уведомление',
      body: 'Push-уведомления работают. Данные дашборда будут проверяться автоматически.',
      url: '/',
      tag: `push-test-${Date.now()}`
    });
    res.json({ success: true, ...delivery });
  } catch (error) {
    console.error('❌ Ошибка тестовой отправки push:', error.message);
    res.status(502).json({ success: false, error: 'Не удалось отправить тестовое уведомление' });
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
