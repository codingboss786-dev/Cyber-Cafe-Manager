/* ==================================================================
   CYBER CAFE MANAGER — Server v4.4 (Fast + Reliable)
   MongoDB Atlas: cluster0.io9awoj.mongodb.net
   FIXES: Better DB retry, Trust proxy for Cloud Shell, Fast sync
   ================================================================== */

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_DIR = __dirname;

const app = express();
const PORT = process.env.PORT || 5000;

/* ⭐ Trust proxy — important for Cloud Shell / reverse proxies */
app.set('trust proxy', 1);

/* ============================ MONGODB ============================ */
const MONGO_URI = process.env.MONGO_URI ||
  'mongodb+srv://codingboss786_db_user:94YJq2T7bgLtRVL1@cluster0.io9awoj.mongodb.net/cybercafe?retryWrites=true&w=majority&appName=Cluster0';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

/* Lightweight logger (only non-static) */
app.use((req, _res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const t = Date.now();
  _res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${_res.statusCode} (${Date.now() - t}ms)`);
  });
  next();
});

/* ⭐ SECURITY: Block sensitive server files */
const BLOCKED_PATHS = ['/server', '/node_modules', '/package.json', '/package-lock.json', '/.env', '/.git', '/.gitignore'];
app.use((req, res, next) => {
  if (BLOCKED_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return res.status(403).send('Forbidden');
  }
  next();
});

/* ============================ DB CONNECT ============================ */
let dbConnected = false;
let dbState = 'connecting'; // 'connected' | 'connecting' | 'offline'

async function connectDB() {
  try {
    dbState = 'connecting';
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 8000,
      maxPoolSize: 10,
      retryWrites: true
    });
    dbConnected = true;
    dbState = 'connected';
    console.log('✅ MongoDB Atlas connected');
    console.log(`📦 DB: ${mongoose.connection.name} · Host: ${mongoose.connection.host}`);
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
  console.warn('⚠️  MongoDB disconnected');
  dbConnected = false;
  dbState = 'offline';
  setTimeout(connectDB, 5000);
});
mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
  dbConnected = true;
  dbState = 'connected';
});

/* ============================ MIDDLEWARE ============================ */
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

/* ============================ HEALTH (fast) ============================ */
app.get('/api/health', (_req, res) => {
  res.json({
    server: 'ok',
    db: dbState,                                    // 'connected' | 'connecting' | 'offline'
    dbConnected,
    dbName: dbConnected ? mongoose.connection.name : null,
    host: dbConnected ? mongoose.connection.host : null,
    ts: new Date().toISOString()
  });
});

app.get('/api/test-connection', async (_req, res) => {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: states[state] || 'unknown',
    dbConnected,
    host: mongoose.connection.host || null,
    dbName: mongoose.connection.name || null,
    models: mongoose.modelNames(),
    ts: new Date().toISOString()
  });
});

app.get('/api/debug', async (_req, res) => {
  if (!dbConnected) return res.json({ dbConnected: false, counts: null });
  try {
    const counts = {
      services: await Service.countDocuments(),
      udhaar: await Udhaar.countDocuments(),
      expenses: await Expense.countDocuments(),
      loans: await Loan.countDocuments(),
      inventory: await Inventory.countDocuments(),
      rates: await Rate.countDocuments(),
    };
    res.json({ dbConnected: true, counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ CRUD ============================ */
function crudRoutes(router, Model, sortField = 'date') {
  router.get('/', async (_req, res) => {
    if (!dbConnected) return res.json([]);
    try { res.json(await Model.find().sort({ [sortField]: -1 }).lean()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.post('/', guard, async (req, res) => {
    try { res.status(201).json(await Model.create(req.body)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.put('/:id', guard, async (req, res) => {
    try { res.json(await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  router.delete('/:id', guard, async (req, res) => {
    try { await Model.deleteOne({ id: req.params.id }); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}
function makeRouter(Model, sortField) {
  const r = express.Router();
  crudRoutes(r, Model, sortField);
  return r;
}

app.use('/api/services',   makeRouter(Service, 'date'));
app.use('/api/udhaar',     makeRouter(Udhaar, 'date'));
app.use('/api/expenses',   makeRouter(Expense, 'date'));
app.use('/api/loans',      makeRouter(Loan, 'date'));
app.use('/api/inventory',  makeRouter(Inventory, 'createdAt'));
app.use('/api/rates',      makeRouter(Rate, 'category'));

/* ============================ SETTINGS ============================ */
app.get('/api/settings', async (_req, res) => {
  if (!dbConnected) return res.json(null);
  try {
    const s = await Settings.findOne({ _key: 'main' }).lean();
    res.json(s ? { ...s, _key: undefined } : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/settings', guard, async (req, res) => {
  try {
    const s = await Settings.findOneAndUpdate(
      { _key: 'main' }, { ...req.body, _key: 'main' }, { new: true, upsert: true }
    );
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ COMMISSIONS ============================ */
app.get('/api/commissions', async (_req, res) => {
  if (!dbConnected) return res.json({});
  try {
    const all = await Commission.find().lean();
    const grouped = {};
    all.forEach(c => {
      if (!grouped[c.year]) grouped[c.year] = {};
      grouped[c.year][c.month] = c.amount;
    });
    res.json(grouped);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/commissions', guard, async (req, res) => {
  try {
    const data = req.body;
    for (const [year, months] of Object.entries(data)) {
      for (const [month, amount] of Object.entries(months)) {
        await Commission.findOneAndUpdate(
          { year: Number(year), month: Number(month) },
          { year: Number(year), month: Number(month), amount: Number(amount) || 0 },
          { upsert: true }
        );
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ KV (NOTES / TARGET) ============================ */
app.get('/api/kv/:key', async (req, res) => {
  if (!dbConnected) return res.json(null);
  try {
    const doc = await KV.findOne({ _key: req.params.key }).lean();
    res.json(doc ? doc.value : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/kv/:key', guard, async (req, res) => {
  try {
    const doc = await KV.findOneAndUpdate(
      { _key: req.params.key },
      { _key: req.params.key, value: req.body.value },
      { new: true, upsert: true }
    );
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ BULK SYNC (with DELETE) ============================ */
app.post('/api/sync', guard, async (req, res) => {
  const t0 = Date.now();
  try {
    const data = req.body || {};
    const deleted = data.deleted || {};
    const result = { synced: 0, deleted: 0, errors: [] };

    /* STEP 1: DELETE */
    const deleteMany = async (Model, ids) => {
      if (!Array.isArray(ids) || !ids.length) return;
      try {
        const r = await Model.deleteMany({ id: { $in: ids } });
        result.deleted += r.deletedCount || 0;
      } catch (e) { result.errors.push(`${Model.modelName} delete: ${e.message}`); }
    };
    await Promise.all([
      deleteMany(Service,   deleted.services),
      deleteMany(Udhaar,    deleted.udhaar),
      deleteMany(Expense,   deleted.expenses),
      deleteMany(Loan,      deleted.loans),
      deleteMany(Inventory, deleted.inventory),
      deleteMany(Rate,      deleted.rates)
    ]);

    /* STEP 2: UPSERT — using bulkWrite for speed */
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
      bulkUpsert(Service,   data.services),
      bulkUpsert(Udhaar,    data.udhaar),
      bulkUpsert(Expense,   data.expenses),
      bulkUpsert(Loan,      data.loans),
      bulkUpsert(Inventory, data.inventory),
      bulkUpsert(Rate,      data.rates)
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

/* ============================ BACKUP ============================ */
app.get('/api/backup', async (_req, res) => {
  if (!dbConnected) return res.status(503).json({ error: 'DB offline', offline: true });
  try {
    const [services, udhaar, expenses, loans, inventory, rates, settings, commissions] = await Promise.all([
      Service.find().lean(), Udhaar.find().lean(), Expense.find().lean(),
      Loan.find().lean(), Inventory.find().lean(), Rate.find().lean(),
      Settings.findOne({ _key: 'main' }).lean(), Commission.find().lean()
    ]);
    res.json({
      exportedAt: new Date().toISOString(), version: 3,
      data: { services, udhaar, expenses, loans, inventory, rates,
        settings: settings ? { ...settings, _key: undefined } : null, commissions }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ STATS ============================ */
app.get('/api/stats', async (_req, res) => {
  if (!dbConnected) return res.json({ offline: true });
  try {
    const [services, udhaar, expenses, loans, inventory] = await Promise.all([
      Service.countDocuments(), Udhaar.countDocuments(), Expense.countDocuments(),
      Loan.countDocuments(), Inventory.countDocuments()
    ]);
    const revenue = (await Service.find().lean()).reduce((a, s) => a + ((s.collected || 0) - (s.portalFees || 0)), 0);
    const due = (await Udhaar.find({ status: 'pending' }).lean()).reduce((a, u) => a + Math.max(0, u.total - u.paid), 0);
    res.json({ services, udhaar, expenses, loans, inventory, revenue, due, ts: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================ SERVE FRONTEND ============================ */
app.use(express.static(STATIC_DIR, {
  index: 'index.html',
  dotfiles: 'deny',
  maxAge: '1h',
  etag: true
}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(STATIC_DIR, 'index.html'), (err) => { if (err) next(); });
});

/* ============================ 404 & ERROR ============================ */
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

/* ============================ START ============================ */
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CYBER CAFE MANAGER — Server v4.4 (Fast + Reliable)');
  console.log('='.repeat(60));
  console.log(`🌐 App:      http://localhost:${PORT}`);
  console.log(`📊 Health:   http://localhost:${PORT}/api/health`);
  console.log(`🐛 Debug:    http://localhost:${PORT}/api/debug`);
  console.log(`🏢 Cluster:  cluster0.io9awoj.mongodb.net`);
  console.log('='.repeat(60));
  console.log('💡 Web Preview → port 5000');
  console.log('='.repeat(60) + '\n');
});