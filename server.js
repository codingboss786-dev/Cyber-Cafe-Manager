/* ==================================================================
   CYBER CAFE MANAGER — Server v5.0
   - Server-side password auth (MongoDB में)
   - Session tokens
   - All data in MongoDB
   ================================================================== */

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

const MONGO_URI = process.env.MONGO_URI ||
  'mongodb+srv://codingboss786_db_user:94YJq2T7bgLtRVL1@cluster0.io9awoj.mongodb.net/cybercafe?retryWrites=true&w=majority&appName=Cluster0';

// ✅ CORS — allow all origins (Netlify, localhost, etc.)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Logger
app.use((req, _res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const t = Date.now();
  _res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - t}ms)`);
  });
  next();
});

// Block sensitive paths
const BLOCKED = ['/server', '/node_modules', '/package.json', '/package-lock.json', '/.env', '/.git'];
app.use((req, res, next) => {
  if (BLOCKED.some(p => req.path === p || req.path.startsWith(p + '/'))) return res.status(403).send('Forbidden');
  next();
});

/* ============================ DATABASE ============================ */
let dbConnected = false;
let dbState = 'connecting';

async function connectDB() {
  try {
    dbState = 'connecting';
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 8000,
      maxPoolSize: 10,
    });
    dbConnected = true;
    dbState = 'connected';
    console.log('✅ MongoDB Atlas connected');
    console.log(`📦 DB: ${mongoose.connection.name} · ${mongoose.connection.host}`);
  } catch (err) {
    dbConnected = false;
    dbState = 'offline';
    console.error('❌ MongoDB failed:', err.message);
    console.warn('⚠️  Retrying in 15s...');
    setTimeout(connectDB, 15000);
  }
}
connectDB();

mongoose.connection.on('disconnected', () => {
  dbConnected = false; dbState = 'offline';
  setTimeout(connectDB, 5000);
});
mongoose.connection.on('reconnected', () => {
  dbConnected = true; dbState = 'connected';
});

const guard = (_req, res, next) => {
  if (!dbConnected) return res.status(503).json({ error: 'Database offline', offline: true });
  next();
};

/* ============================ SCHEMAS ============================ */
const gen = (name, fields) =>
  mongoose.models[name] ||
  mongoose.model(name, new mongoose.Schema(fields, { timestamps: true, strict: false }));

const Service    = gen('Service',    { id: { type: String, unique: true, index: true } });
const Udhaar     = gen('Udhaar',     { id: { type: String, unique: true, index: true } });
const Expense    = gen('Expense',    { id: { type: String, unique: true, index: true } });
const Loan       = gen('Loan',       { id: { type: String, unique: true, index: true } });
const Inventory  = gen('Inventory',  { id: { type: String, unique: true, index: true } });
const Rate       = gen('Rate',       { id: { type: String, unique: true, index: true } });
const Settings   = gen('Settings',   { _key: { type: String, unique: true, default: 'main' } });
const Commission = gen('Commission', { year: Number, month: Number, amount: Number });
const KV         = gen('KV',         { _key: { type: String, unique: true, index: true }, value: mongoose.Schema.Types.Mixed });
const Session    = gen('Session',    { token: { type: String, unique: true, index: true }, expiresAt: Date });

/* ============================ AUTH (Server-side) ============================ */
const SESSION_TTL_MS = 15 * 60 * 1000;   // 15 min sliding
const MAX_ATTEMPTS = 5;
const LOCK_BASE_SECONDS = 30;
const loginAttempts = new Map();          // in-memory per-IP tracker

function hashPassword(password, salt) {
  const str = salt + '::' + password + '::cybercafe_v3';
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ token, expiresAt });
  Session.deleteMany({ expiresAt: { $lt: new Date() } }).catch(() => {});
  return { token, expiresAt: expiresAt.getTime() };
}

async function validateSession(token) {
  if (!token) return false;
  const s = await Session.findOne({ token }).lean();
  if (!s) return false;
  if (new Date(s.expiresAt) < new Date()) {
    await Session.deleteOne({ token });
    return false;
  }
  // sliding expiry
  await Session.updateOne({ token }, { expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return true;
}

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!await validateSession(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/* --- AUTH ENDPOINTS --- */
app.get('/api/auth/status', async (req, res) => {
  if (!dbConnected) return res.json({ hasPassword: false, sessionValid: false, offline: true });
  try {
    const authDoc = await KV.findOne({ _key: 'auth' }).lean();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const sessionValid = token ? await validateSession(token) : false;
    res.json({ hasPassword: !!authDoc, sessionValid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/setup', guard, async (req, res) => {
  try {
    const existing = await KV.findOne({ _key: 'auth' }).lean();
    if (existing) return res.status(400).json({ error: 'Password already set' });
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (password.length > 128) return res.status(400).json({ error: 'Password too long' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    await KV.create({ _key: 'auth', value: { hash, salt, createdAt: Date.now() } });
    const session = await createSession();
    res.json({ ok: true, ...session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', guard, async (req, res) => {
  const ip = req.ip || 'unknown';
  try {
    const attempt = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
    if (attempt.lockUntil > Date.now()) {
      const sec = Math.ceil((attempt.lockUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${sec}s` });
    }
    const authDoc = await KV.findOne({ _key: 'auth' }).lean();
    if (!authDoc || !authDoc.value) return res.status(400).json({ error: 'No password set on server. Please set up first.' });

    const { password } = req.body;
    const hash = hashPassword(password || '', authDoc.value.salt);
    if (hash !== authDoc.value.hash) {
      attempt.count = (attempt.count || 0) + 1;
      if (attempt.count >= MAX_ATTEMPTS) {
        const mult = Math.pow(2, Math.floor(attempt.count / MAX_ATTEMPTS) - 1);
        attempt.lockUntil = Date.now() + LOCK_BASE_SECONDS * mult * 1000;
        attempt.count = 0;
      }
      loginAttempts.set(ip, attempt);
      return res.status(401).json({ error: 'Wrong password' });
    }
    loginAttempts.delete(ip);
    const session = await createSession();
    res.json({ ok: true, ...session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) await Session.deleteOne({ token }).catch(() => {});
  res.json({ ok: true });
});

app.post('/api/auth/change', requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password too short' });
    if (newPassword.length > 128) return res.status(400).json({ error: 'Password too long' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword, salt);
    await KV.updateOne({ _key: 'auth' }, { value: { hash, salt, createdAt: Date.now() } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/remove', requireAuth, async (req, res) => {
  try {
    const authDoc = await KV.findOne({ _key: 'auth' }).lean();
    if (!authDoc) return res.status(400).json({ error: 'No password set' });
    const { password } = req.body;
    const hash = hashPassword(password || '', authDoc.value.salt);
    if (hash !== authDoc.value.hash) return res.status(401).json({ error: 'Wrong password' });
    await KV.deleteOne({ _key: 'auth' });
    await Session.deleteMany({});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ HEALTH ============================ */
app.get('/api/health', (_req, res) => {
  res.json({
    server: 'ok', db: dbState, dbConnected,
    dbName: dbConnected ? mongoose.connection.name : null,
    ts: new Date().toISOString()
  });
});

/* ============================ ALL DATA (single fetch) ============================ */
function stripMongo(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const { _id, __v, createdAt, updatedAt, _key, ...rest } = obj;
  return rest;
}

app.get('/api/all', requireAuth, async (_req, res) => {
  if (!dbConnected) return res.json({
    services: [], udhaar: [], expenses: [], loans: [], inventory: [],
    rates: [], settings: null, commissions: {}, notes: '', target: null
  });
  try {
    const [services, udhaar, expenses, loans, inventory, rates, settings, commissions, notesKV, targetKV] = await Promise.all([
      Service.find().sort({ date: -1 }).lean(),
      Udhaar.find().sort({ date: -1 }).lean(),
      Expense.find().sort({ date: -1 }).lean(),
      Loan.find().sort({ date: -1 }).lean(),
      Inventory.find().lean(),
      Rate.find().lean(),
      Settings.findOne({ _key: 'main' }).lean(),
      Commission.find().lean(),
      KV.findOne({ _key: 'notes' }).lean(),
      KV.findOne({ _key: 'target' }).lean()
    ]);
    const commissionsGrouped = {};
    commissions.forEach(c => {
      if (!commissionsGrouped[c.year]) commissionsGrouped[c.year] = {};
      commissionsGrouped[c.year][c.month] = c.amount;
    });
    res.json({
      services: services.map(stripMongo),
      udhaar: udhaar.map(stripMongo),
      expenses: expenses.map(stripMongo),
      loans: loans.map(stripMongo),
      inventory: inventory.map(stripMongo),
      rates: rates.map(stripMongo),
      settings: settings ? stripMongo(settings) : null,
      commissions: commissionsGrouped,
      notes: (notesKV && notesKV.value) || '',
      target: (targetKV && targetKV.value) || null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ CRUD (compatibility) ============================ */
function crudRoutes(router, Model, sortField = 'date') {
  router.get('/', requireAuth, async (_req, res) => {
    if (!dbConnected) return res.json([]);
    try { res.json(await Model.find().sort({ [sortField]: -1 }).lean()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.post('/', requireAuth, guard, async (req, res) => {
    try { res.status(201).json(await Model.create(req.body)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.put('/:id', requireAuth, guard, async (req, res) => {
    try { res.json(await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.delete('/:id', requireAuth, guard, async (req, res) => {
    try { await Model.deleteOne({ id: req.params.id }); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}
function makeRouter(Model, sortField) {
  const r = express.Router();
  crudRoutes(r, Model, sortField);
  return r;
}
app.use('/api/services',  makeRouter(Service, 'date'));
app.use('/api/udhaar',    makeRouter(Udhaar, 'date'));
app.use('/api/expenses',  makeRouter(Expense, 'date'));
app.use('/api/loans',     makeRouter(Loan, 'date'));
app.use('/api/inventory', makeRouter(Inventory, 'createdAt'));
app.use('/api/rates',     makeRouter(Rate, 'category'));

/* ============================ SYNC (bulk upsert + delete) ============================ */
app.post('/api/sync', requireAuth, guard, async (req, res) => {
  const t0 = Date.now();
  try {
    const data = req.body || {};
    const deleted = data.deleted || {};
    const result = { synced: 0, deleted: 0, errors: [] };

    const deleteMany = async (Model, ids) => {
      if (!Array.isArray(ids) || !ids.length) return;
      try {
        const r = await Model.deleteMany({ id: { $in: ids } });
        result.deleted += r.deletedCount || 0;
      } catch (e) { result.errors.push(`${Model.modelName} delete: ${e.message}`); }
    };
    await Promise.all([
      deleteMany(Service, deleted.services),
      deleteMany(Udhaar, deleted.udhaar),
      deleteMany(Expense, deleted.expenses),
      deleteMany(Loan, deleted.loans),
      deleteMany(Inventory, deleted.inventory),
      deleteMany(Rate, deleted.rates)
    ]);

    const bulkUpsert = async (Model, items) => {
      if (!Array.isArray(items) || !items.length) return;
      try {
        const ops = items.filter(x => x && x.id).map(item => ({
          updateOne: { filter: { id: item.id }, update: { $set: item }, upsert: true }
        }));
        if (ops.length) {
          const r = await Model.bulkWrite(ops, { ordered: false });
          result.synced += (r.upsertedCount || 0) + (r.modifiedCount || 0) + (r.matchedCount || 0);
        }
      } catch (e) { result.errors.push(`${Model.modelName} bulk: ${e.message}`); }
    };

    await Promise.all([
      bulkUpsert(Service, data.services),
      bulkUpsert(Udhaar, data.udhaar),
      bulkUpsert(Expense, data.expenses),
      bulkUpsert(Loan, data.loans),
      bulkUpsert(Inventory, data.inventory),
      bulkUpsert(Rate, data.rates)
    ]);

    if (data.settings) {
      await Settings.findOneAndUpdate({ _key: 'main' }, { ...data.settings, _key: 'main' }, { upsert: true });
    }
    if (data.commissions) {
      const ops = [];
      for (const [year, months] of Object.entries(data.commissions)) {
        for (const [month, amount] of Object.entries(months)) {
          ops.push({
            updateOne: {
              filter: { year: Number(year), month: Number(month) },
              update: { year: Number(year), month: Number(month), amount: Number(amount) || 0 },
              upsert: true
            }
          });
        }
      }
      if (ops.length) await Commission.bulkWrite(ops, { ordered: false });
    }
    if (data.notes !== undefined) {
      await KV.findOneAndUpdate({ _key: 'notes' }, { _key: 'notes', value: data.notes }, { upsert: true });
    }
    if (data.target !== undefined) {
      await KV.findOneAndUpdate({ _key: 'target' }, { _key: 'target', value: data.target }, { upsert: true });
    }

    console.log(`✅ Sync — upserted: ${result.synced}, deleted: ${result.deleted} (${Date.now() - t0}ms)`);
    res.json({ ok: true, ...result, ms: Date.now() - t0 });
  } catch (e) {
    console.error('Sync error:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ============================ STATIC & 404 ============================ */
app.use(express.static(STATIC_DIR, { index: 'index.html', dotfiles: 'deny' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(STATIC_DIR, 'index.html'), (err) => { if (err) next(); });
});
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CYBER CAFE MANAGER — Server v5.0 (Server-side Auth)');
  console.log('='.repeat(60));
  console.log(`🌐 App:      http://localhost:${PORT}`);
  console.log(`📊 Health:   http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60) + '\n');
});