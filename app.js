/* ==================================================================
   DIGITAL SEVA — ULTIMATE EDITION (v2.3)
   NEW in v2.3:
   - ⭐ Rate Card: Portal Fees + Service Charge (2 fields each)
   - ⭐ Daily Service modal: auto-fill Portal + Collected on service select
   - ⭐ Both fields remain editable
   - ⭐ FIXED: escJs() for safe JS escaping (O'Brien names work)
   - ⭐ FIXED: pullAll(force) — empty server no longer wipes local
   - ⭐ FIXED: Manual reload uses force=true
   ================================================================== */

const API_BASE = 'https://cyber-cafe-manager.onrender.com/api';
let apiOnline = false;
let soundEnabled = localStorage.getItem('ccm_sound') !== 'off';
let selectedRows = new Set();
let periodRev = '7d';
let periodExp = '1m';

/* ============================ STORE ============================ */
const Store = {
  keys: {
    services: 'ccm_services', udhaar: 'ccm_udhaar', expenses: 'ccm_expenses',
    loans: 'ccm_loans', inventory: 'ccm_inventory', settings: 'ccm_settings',
    commissions: 'ccm_commissions', target: 'ccm_target', recent: 'ccm_recent',
    theme: 'ccm_theme', pin: 'ccm_pin', rates: 'ccm_rates',
    notes: 'ccm_notes', lastBackup: 'ccm_lastBackup',
    themeMode: 'ccm_themeMode'
  },
  get(k, fb) { try { return JSON.parse(localStorage.getItem(this.keys[k])) ?? fb; } catch { return fb; } },
  set(k, v) { localStorage.setItem(this.keys[k], JSON.stringify(v)); },
  raw(k) { return localStorage.getItem(this.keys[k]); },
  rawSet(k, v) { localStorage.setItem(this.keys[k], v); }
};

const DEFAULT_SETTINGS = {
  shopName: 'CYBER CAFE & DIGITAL SEVA KENDRA',
  ownerName: 'Proprietor', phone: '9876543210',
  address: 'Main Market, Near Bus Stand, India',
  gst: 'CSC-REG-12345',
  whatsappTemplate: 'Hello {name},\n\nYour pending balance at {shop} is Rs. {amount} for {work}.\nPlease clear it soon.\n\nThank you!\n- {owner}'
};

const SERVICE_TYPES = [
  'PAN Card Apply','Aadhaar Print','Aadhaar Update','Income Certificate','Caste Certificate',
  'Domicile Certificate','Passport Form','Ayushman Card','Ration Card Update','Voter ID Print',
  'Resume Typing','Train Ticket','Bus Ticket','Flight Booking','Bill Payment','Mobile Recharge',
  'Money Transfer','Lamination','Photocopy','Color Print','B&W Print','Scanning',
  'Online Form Fill','Cyber Browsing','Email Create','Bank KYC','Insurance Policy',
  'Photo Print','PVC Card Print','Marriage Certificate'
];

const EXPENSE_CATEGORIES = [
  'Shop Rent','Electricity Bill','Internet & WiFi','Paper & Stationery','Food & Tea',
  'Travel & Fuel','Household','Medical','Mobile & Utility','Personal Misc','Other Shop Expense','Salary'
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEAR_RANGE = [2026, 2027, 2028, 2029, 2030];

const DEFAULT_RATES = [
  { id: 'rc-1',  name: 'PAN Card Apply',            portalFees: 107, serviceCharge: 43,  category: 'CSC' },
  { id: 'rc-2',  name: 'Aadhaar Print',             portalFees: 0,   serviceCharge: 30,  category: 'CSC' },
  { id: 'rc-3',  name: 'Aadhaar Update',            portalFees: 50,  serviceCharge: 50,  category: 'CSC' },
  { id: 'rc-4',  name: 'Income Certificate',        portalFees: 30,  serviceCharge: 70,  category: 'CSC' },
  { id: 'rc-5',  name: 'Caste Certificate',         portalFees: 30,  serviceCharge: 70,  category: 'CSC' },
  { id: 'rc-6',  name: 'Domicile Certificate',      portalFees: 30,  serviceCharge: 70,  category: 'CSC' },
  { id: 'rc-7',  name: 'Passport Form',             portalFees: 50,  serviceCharge: 100, category: 'CSC' },
  { id: 'rc-8',  name: 'Ayushman Card',             portalFees: 0,   serviceCharge: 50,  category: 'CSC' },
  { id: 'rc-9',  name: 'Ration Card Update',        portalFees: 20,  serviceCharge: 40,  category: 'CSC' },
  { id: 'rc-10', name: 'Voter ID Print',            portalFees: 0,   serviceCharge: 20,  category: 'CSC' },
  { id: 'rc-11', name: 'PVC Card Print',            portalFees: 0,   serviceCharge: 100, category: 'CSC' },
  { id: 'rc-12', name: 'Resume Typing (per page)',  portalFees: 0,   serviceCharge: 30,  category: 'Typing' },
  { id: 'rc-13', name: 'Application Typing',        portalFees: 0,   serviceCharge: 50,  category: 'Typing' },
  { id: 'rc-14', name: 'Train Ticket (base)',       portalFees: 20,  serviceCharge: 20,  category: 'Online' },
  { id: 'rc-15', name: 'Bus Ticket (base)',         portalFees: 15,  serviceCharge: 15,  category: 'Online' },
  { id: 'rc-16', name: 'Flight Booking',            portalFees: 100, serviceCharge: 50,  category: 'Online' },
  { id: 'rc-17', name: 'Bill Payment',              portalFees: 0,   serviceCharge: 30,  category: 'Online' },
  { id: 'rc-18', name: 'Money Transfer (per Rs.1000)', portalFees: 10, serviceCharge: 10, category: 'Online' },
  { id: 'rc-19', name: 'Online Form Fill',          portalFees: 20,  serviceCharge: 30,  category: 'Online' },
  { id: 'rc-20', name: 'B&W Print A4',              portalFees: 0,   serviceCharge: 5,   category: 'Printing' },
  { id: 'rc-21', name: 'Color Print A4',            portalFees: 0,   serviceCharge: 15,  category: 'Printing' },
  { id: 'rc-22', name: 'Photocopy A4',              portalFees: 0,   serviceCharge: 2,   category: 'Printing' },
  { id: 'rc-23', name: 'Scanning (per page)',       portalFees: 0,   serviceCharge: 10,  category: 'Printing' },
  { id: 'rc-24', name: 'Lamination (ID)',           portalFees: 0,   serviceCharge: 20,  category: 'Printing' },
  { id: 'rc-25', name: 'Lamination (A4)',           portalFees: 0,   serviceCharge: 40,  category: 'Printing' },
  { id: 'rc-26', name: 'Passport Photo (8 pcs)',    portalFees: 0,   serviceCharge: 50,  category: 'Photo' },
  { id: 'rc-27', name: 'Photo Print (4x6)',         portalFees: 0,   serviceCharge: 15,  category: 'Photo' },
  { id: 'rc-28', name: 'Cyber Browsing (per hour)', portalFees: 0,   serviceCharge: 30,  category: 'Cyber' }
];

function migrateRatesArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(r => {
    if (r.portalFees === undefined || r.serviceCharge === undefined) {
      return {
        id: r.id,
        name: r.name,
        portalFees: 0,
        serviceCharge: Number(r.price) || 0,
        category: r.category
      };
    }
    return r;
  });
}
function migrateLocalRates() {
  const rates = Store.get('rates', null);
  if (!rates) return;
  const migrated = migrateRatesArray(rates);
  Store.set('rates', migrated);
}

/* ============================ HELPERS ============================ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function todayISO() { return new Date().toISOString(); }
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function formatINR(n) { n = Number(n) || 0; return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); }
function formatNum(n) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n) || 0); }
function formatDate(iso) { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatDateTime(iso) { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }
function isThisMonth(iso) { const d = new Date(iso), t = new Date(); return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear(); }
function mKey(iso) { return new Date(iso).getMonth(); }
function yKey(iso) { return new Date(iso).getFullYear(); }
function dateKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
/* ⭐ FIX: Safe JS string escape for onclick attributes (names with ' like O'Brien) */
function escJs(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function daysBetween(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

/* ============================ SOUND ============================ */
const Sound = {
  ctx: null,
  ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return this.ctx; },
  beep(f = 660, d = 0.08, v = 0.06) {
    if (!soundEnabled) return;
    const ctx = this.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(v, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
    o.start(); o.stop(ctx.currentTime + d);
  },
  click() { this.beep(880, 0.04, 0.04); },
  success() { this.beep(660, 0.08, 0.07); setTimeout(() => this.beep(880, 0.1, 0.07), 80); setTimeout(() => this.beep(1100, 0.15, 0.07), 180); },
  error() { this.beep(240, 0.14, 0.08); },
  pay() { this.beep(523, 0.07, 0.07); setTimeout(() => this.beep(659, 0.07, 0.07), 70); setTimeout(() => this.beep(784, 0.14, 0.07), 140); }
};

/* ============================ TOAST ============================ */
function toast(msg, type = 'violet') {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { emerald: '✅', rose: '❌', amber: '⚠️', violet: '💜', cyan: 'ℹ️' };
  el.innerHTML = `<span style="font-size:15px;">${icons[type] || '💜'}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = 'all 0.3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

/* ============================ CONFETTI ============================ */
const Confetti = {
  canvas: null, particles: [], raf: null,
  init() { this.canvas = document.getElementById('confettiCanvas'); this.resize(); window.addEventListener('resize', () => this.resize()); },
  resize() { if (this.canvas) { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; } },
  burst(x, y) {
    if (!this.canvas) return;
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: x || window.innerWidth / 2, y: y || window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.9) * 14,
        size: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)],
        life: 1, decay: 0.012 + Math.random() * 0.01,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3
      });
    }
    if (!this.raf) this.loop();
  },
  loop() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.vx *= 0.99;
      p.life -= p.decay; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (this.particles.length) this.raf = requestAnimationFrame(() => this.loop());
    else { this.raf = null; ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  }
};

/* ============================ SEED DEMO ============================ */
function seedDemoData() {
  if (!Store.get('settings', null)) Store.set('settings', DEFAULT_SETTINGS);
  if (!Store.get('target', null)) Store.set('target', { amount: 2000, date: new Date().toDateString() });
  if (!Store.get('rates', null)) Store.set('rates', DEFAULT_RATES);
  if (!Store.get('notes', null)) Store.set('notes', '');
  if (!Store.get('services', null)) Store.set('services', []);
  if (!Store.get('udhaar', null)) Store.set('udhaar', []);
  if (!Store.get('expenses', null)) Store.set('expenses', []);
  if (!Store.get('loans', null)) Store.set('loans', []);
  if (!Store.get('inventory', null)) Store.set('inventory', []);
  if (!Store.get('commissions', null)) Store.set('commissions', { [new Date().getFullYear()]: {} });
  if (!Store.get('recent', null)) Store.set('recent', []);
}

function getSettings() { return Store.get('settings', DEFAULT_SETTINGS); }

/* ============================ SYNC SYSTEM ============================ */
const Sync = {
  pending: {},
  deleted: { services: [], udhaar: [], expenses: [], loans: [], inventory: [], rates: [] },
  syncing: false,
  timer: null,
  lastSync: null,

  init() {
    try { this.pending = JSON.parse(localStorage.getItem('ccm_pending') || '{}'); } catch { this.pending = {}; }
    try {
      const d = JSON.parse(localStorage.getItem('ccm_deleted') || '{}');
      this.deleted = {
        services: d.services || [], udhaar: d.udhaar || [],
        expenses: d.expenses || [], loans: d.loans || [],
        inventory: d.inventory || [], rates: d.rates || []
      };
    } catch { /* keep defaults */ }
  },

  markDirty(module) {
    this.pending[module] = Date.now();
    localStorage.setItem('ccm_pending', JSON.stringify(this.pending));
    this.updatePill();
    this.scheduleSync();
  },

  markDeleted(module, id) {
    if (!id) return;
    if (!this.deleted[module]) this.deleted[module] = [];
    if (!this.deleted[module].includes(id)) this.deleted[module].push(id);
    localStorage.setItem('ccm_deleted', JSON.stringify(this.deleted));
    this.markDirty(module);
  },

  hasChanges() {
    return Object.keys(this.pending).length > 0 ||
           Object.values(this.deleted).some(a => a.length > 0);
  },

  scheduleSync() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 2500);
  },

  async push() {
    if (!apiOnline || this.syncing) return false;
    if (!this.hasChanges()) return false;

    this.syncing = true;
    this.updatePill();

    try {
      const payload = {
        services: Store.get('services', []),
        udhaar: Store.get('udhaar', []),
        expenses: Store.get('expenses', []),
        loans: Store.get('loans', []),
        inventory: Store.get('inventory', []),
        rates: Store.get('rates', DEFAULT_RATES),
        settings: Store.get('settings', DEFAULT_SETTINGS),
        commissions: Store.get('commissions', {}),
        notes: Store.get('notes', ''),
        target: Store.get('target', null),
        deleted: this.deleted
      };
      const r = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      if (r.ok) {
        this.pending = {};
        this.deleted = { services: [], udhaar: [], expenses: [], loans: [], inventory: [], rates: [] };
        localStorage.setItem('ccm_pending', '{}');
        localStorage.setItem('ccm_deleted', '{}');
        this.lastSync = Date.now();
        this.syncing = false;
        this.updatePill();
        return true;
      }
    } catch (e) { /* silent */ }

    this.syncing = false;
    this.updatePill();
    return false;
  },

  /* ⭐ FIX v3.1: Server is SOURCE OF TRUTH — always overwrite local
     - If server returns empty array → local becomes empty (server truth)
     - If fetch fails (null) → keep local cache (offline mode)
     - Rates: if server has no rates, keep DEFAULT_RATES (so rate card works) */
  async pullAll(force = false) {
    if (!apiOnline) return false;
    try {
      const safe = async (url) => {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          return r.ok ? await r.json() : null;
        } catch { return null; }
      };

      const [s, u, e, l, i, r, settings, comm, notes, target] = await Promise.all([
        safe(`${API_BASE}/services`), safe(`${API_BASE}/udhaar`), safe(`${API_BASE}/expenses`),
        safe(`${API_BASE}/loans`), safe(`${API_BASE}/inventory`), safe(`${API_BASE}/rates`),
        safe(`${API_BASE}/settings`), safe(`${API_BASE}/commissions`),
        safe(`${API_BASE}/kv/notes`), safe(`${API_BASE}/kv/target`)
      ]);

      /* ⭐ Server = truth. Always overwrite.
         null = fetch failed → skip (keep local as offline cache)
         [] = server empty → wipe local (show empty) */
      const safeSet = (key, arr, fallbackEmpty = null) => {
        if (!Array.isArray(arr)) return;  // null (error) — don't touch
        if (arr.length === 0 && fallbackEmpty !== null) {
          Store.set(key, fallbackEmpty);  // rates → use defaults
          return;
        }
        Store.set(key, key === 'rates' ? migrateRatesArray(arr) : arr);
      };
      safeSet('services',  s);
      safeSet('udhaar',    u);
      safeSet('expenses',  e);
      safeSet('loans',     l);
      safeSet('inventory', i);
      safeSet('rates',     r, DEFAULT_RATES);   // ⭐ rate card always works

      /* Settings: only overwrite if server has actual settings */
      if (settings && typeof settings === 'object' && Object.keys(settings).length) {
        Store.set('settings', settings);
      }

      /* Commissions: overwrite (server truth), even if empty {} */
      if (comm && typeof comm === 'object') Store.set('commissions', comm);

      /* Notes: overwrite (server truth) — null means fetch failed */
      if (notes !== null && notes !== undefined) Store.set('notes', notes);

      /* Target: overwrite if exists */
      if (target && typeof target === 'object') Store.set('target', target);

      this.pending = {};
      this.deleted = { services: [], udhaar: [], expenses: [], loans: [], inventory: [], rates: [] };
      localStorage.setItem('ccm_pending', '{}');
      localStorage.setItem('ccm_deleted', '{}');
      this.updatePill();
      return true;
    } catch (e) { return false; }
  },
  updatePill() {
    const pill = document.getElementById('statusPill');
    const txt = document.getElementById('statusText');
    if (!pill || !txt) return;
    const count = Object.keys(this.pending).length;
    const delCount = Object.values(this.deleted).reduce((a, arr) => a + arr.length, 0);
    const total = count + (delCount > 0 ? 1 : 0);
    pill.classList.remove('online', 'offline', 'syncing');
    if (this.syncing) {
      pill.classList.add('syncing');
      txt.innerHTML = `Syncing... <span class="pending-badge">${total}</span>`;
    } else if (apiOnline) {
      pill.classList.add('online');
      txt.innerHTML = total ? `Connected <span class="pending-badge">${total}</span>` : 'Connected · MongoDB';
    } else {
      pill.classList.add('offline');
      txt.textContent = 'Offline · Local Storage';
    }
  }
};


/* ============================ 🔐 AUTH (Password System) ============================ */
const Auth = {
  STORAGE_KEY: 'ccm_auth',
  ATTEMPTS_KEY: 'ccm_authAttempts',
  SESSION_KEY: 'ccm_authSession',
  MAX_ATTEMPTS: 5,
  LOCK_BASE_SECONDS: 30,
  SESSION_TIMEOUT_MS: 15 * 60 * 1000,

  async hashPassword(password, salt) {
    const str = salt + '::' + password + '::cybercafe_v3';
    if (window.crypto && window.crypto.subtle) {
      try {
        const enc = new TextEncoder();
        const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {}
    }
    return this._fallbackHash(str);
  },

  _fallbackHash(str) {
    let h1 = 0x811c9dc5 >>> 0, h2 = 0x811c9dc5 >>> 0, h3 = 0x811c9dc5 >>> 0, h4 = 0x811c9dc5 >>> 0;
    for (let round = 0; round < 500; round++) {
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i) + round;
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ (c ^ 0x9e3779b9), 0x85ebca6b) >>> 0;
        h3 = Math.imul(h3 ^ (c + 0xc2b2ae35), 0x27d4eb2f) >>> 0;
        h4 = Math.imul(h4 ^ (c ^ 0x165667b1), 0x9e3779b1) >>> 0;
      }
    }
    return [h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
  },

  genSalt() {
    const arr = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr);
    else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  getAuth() { try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null'); } catch { return null; } },
  hasPassword() { return !!this.getAuth(); },

  async setPassword(password) {
    const salt = this.genSalt();
    const hash = await this.hashPassword(password, salt);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ hash, salt, createdAt: Date.now(), version: 1 }));
    this.clearAttempts();
    localStorage.removeItem('ccm_pin');
    return true;
  },

  async verify(password) {
    const auth = this.getAuth();
    if (!auth) return false;
    const hash = await this.hashPassword(password, auth.salt);
    if (hash.length !== auth.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ auth.hash.charCodeAt(i);
    return diff === 0;
  },

  removePassword() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ATTEMPTS_KEY);
    localStorage.removeItem('ccm_pin');
  },

  getAttempts() { try { return JSON.parse(localStorage.getItem(this.ATTEMPTS_KEY) || '{"count":0,"lockUntil":0}'); } catch { return { count: 0, lockUntil: 0 }; } },

  recordFail() {
    const a = this.getAttempts();
    a.count = (a.count || 0) + 1;
    if (a.count >= this.MAX_ATTEMPTS) {
      const mult = Math.pow(2, Math.min(6, Math.floor((a.count - this.MAX_ATTEMPTS) / 1)));
      a.lockUntil = Date.now() + Math.min(this.LOCK_BASE_SECONDS * mult, 3600) * 1000;
      a.count = 0;
    }
    localStorage.setItem(this.ATTEMPTS_KEY, JSON.stringify(a));
    return a;
  },

  clearAttempts() { localStorage.removeItem(this.ATTEMPTS_KEY); },

  getRemainingLockMs() {
    const a = this.getAttempts();
    if (!a.lockUntil) return 0;
    const rem = a.lockUntil - Date.now();
    return rem > 0 ? rem : 0;
  },

  markSession() { try { sessionStorage.setItem(this.SESSION_KEY, Date.now().toString()); } catch {} },
  hasActiveSession() {
    try {
      const t = sessionStorage.getItem(this.SESSION_KEY);
      if (!t) return false;
      return Date.now() - Number(t) < this.SESSION_TIMEOUT_MS;
    } catch { return false; }
  },
  refreshSession() { try { if (sessionStorage.getItem(this.SESSION_KEY)) sessionStorage.setItem(this.SESSION_KEY, Date.now().toString()); } catch {} },
  endSession() { try { sessionStorage.removeItem(this.SESSION_KEY); } catch {} },

  scorePassword(pwd) {
    if (!pwd) return { score: 0, label: 'Enter password', color: '#5e6482', pct: 0 };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (pwd.length >= 14) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score, label: 'Weak', color: '#ef4444', pct: 25 };
    if (score === 2) return { score, label: 'Fair', color: '#f59e0b', pct: 45 };
    if (score === 3) return { score, label: 'Good', color: '#0ea5e9', pct: 65 };
    if (score === 4) return { score, label: 'Strong', color: '#10b981', pct: 85 };
    return { score, label: 'Very Strong 💪', color: '#10b981', pct: 100 };
  }
};

/* ============================ 🔐 AUTO-LOCK (Inactivity) ============================ */
const AutoLock = {
  timer: null,
  ACTIVITY_EVENTS: ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'],
  init() {
    if (!Auth.hasPassword()) return;
    this.ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, () => this.refresh(), { passive: true }));
    this.schedule();
  },
  refresh() {
    if (!Auth.hasActiveSession()) return;
    Auth.refreshSession();
    this.schedule();
  },
  schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!Auth.hasPassword() || !Auth.hasActiveSession()) return;
    this.timer = setTimeout(() => {
      Auth.endSession();
      showLockScreen('unlock');
      toast('Locked due to inactivity', 'amber');
    }, Auth.SESSION_TIMEOUT_MS);
  }
};

/* ============================ VOICE SEARCH ============================ */
const Voice = {
  recognition: null, listening: false,
  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-IN';
    this.recognition.onresult = e => {
      const text = e.results[0][0].transcript;
      const input = document.getElementById('cmdkInput');
      if (input) { input.value = text; renderCmdk(text); }
    };
    this.recognition.onend = () => {
      this.listening = false;
      const btn = document.getElementById('voiceBtn');
      if (btn) btn.classList.remove('listening');
    };
    const btn = document.getElementById('voiceBtn');
    if (btn) {
      btn.style.display = 'grid';
      btn.onclick = () => {
        if (this.listening) { this.recognition.stop(); return; }
        this.listening = true;
        btn.classList.add('listening');
        try { this.recognition.start(); } catch {}
      };
    }
  }
};

/* ============================ CALCULATOR ============================ */
const Calculator = {
  expr: '',
  update() { const d = document.getElementById('calcDisplay'); if (d) d.textContent = this.expr || '0'; },
  press(key) {
    if (key === 'C') this.expr = '';
    else if (key === '⌫') this.expr = this.expr.slice(0, -1);
    else if (key === '=') {
      try {
        const safe = this.expr.replace(/[^0-9+\-*/.%()]/g, '');
        const val = Function('"use strict";return (' + safe + ')')();
        this.expr = String(Math.round(val * 100) / 100);
      } catch { this.expr = 'Error'; }
    } else this.expr += key;
    this.update();
    Sound.click();
  },
  open() { document.getElementById('calcPanel')?.classList.add('show'); },
  close() { document.getElementById('calcPanel')?.classList.remove('show'); },
  init() {
    document.querySelectorAll('[data-calc]').forEach(b => {
      b.onclick = () => this.press(b.dataset.calc);
    });
    const closeBtn = document.getElementById('calcClose');
    if (closeBtn) closeBtn.onclick = () => this.close();
    const openBtn = document.getElementById('calcBtn');
    if (openBtn) openBtn.onclick = () => {
      const p = document.getElementById('calcPanel');
      if (p) p.classList.contains('show') ? this.close() : this.open();
    };
  }
};

/* ============================ SHORTCUTS ============================ */
function showShortcuts() { document.getElementById('shortcutsBackdrop')?.classList.add('show'); }
function hideShortcuts() { document.getElementById('shortcutsBackdrop')?.classList.remove('show'); }

/* ============================ ACHIEVEMENTS ============================ */
const Achievements = {
  shown: {},
  init() { try { this.shown = JSON.parse(localStorage.getItem('ccm_achievements') || '{}'); } catch { this.shown = {}; } },
  check() {
    const total = Store.get('services', []).length;
    const cleared = Store.get('udhaar', []).filter(u => u.status === 'cleared').length;
    const todayProfit = Calc.todayProfit();
    const target = Store.get('target', { amount: 2000 }).amount;

    const list = [
      { key: 'first_service', cond: total >= 1, emoji: '🎉', title: 'First Service!', sub: 'Your journey begins' },
      { key: 'ten_services', cond: total >= 10, emoji: '🌟', title: '10 Services Done', sub: 'Keep it up!' },
      { key: 'fifty_services', cond: total >= 50, emoji: '🏆', title: '50 Services', sub: 'Business is growing!' },
      { key: 'hundred_services', cond: total >= 100, emoji: '👑', title: '100 Services!', sub: 'You are a pro!' },
      { key: 'five_cleared', cond: cleared >= 5, emoji: '💎', title: '5 Udhaar Cleared', sub: 'Great recovery!' },
      { key: 'target_hit', cond: target > 0 && todayProfit >= target, emoji: '🎯', title: 'Target Achieved!', sub: `₹${target} net profit today` }
    ];

    list.forEach(a => {
      if (a.cond && !this.shown[a.key]) {
        this.shown[a.key] = true;
        localStorage.setItem('ccm_achievements', JSON.stringify(this.shown));
        setTimeout(() => this.show(a), 800);
      }
    });
  },
  show(a) {
    const el = document.createElement('div');
    el.className = 'achievement';
    el.innerHTML = `<span class="emoji">${a.emoji}</span><div class="title">${a.title}</div><div class="sub">${a.sub}</div>`;
    document.body.appendChild(el);
    Confetti.burst(window.innerWidth / 2, window.innerHeight / 2);
    Sound.success();
    setTimeout(() => el.remove(), 2600);
  }
};

/* ============================ THEME MODE SYSTEM ============================ */
function getThemeMode() { return Store.raw('ccm_themeMode') || 'manual-dark'; }

function applyThemeMode() {
  const mode = getThemeMode();
  let theme = 'dark';
  if (mode === 'manual-dark') theme = 'dark';
  else if (mode === 'manual-light') theme = 'light';
  else if (mode === 'auto') {
    const h = new Date().getHours();
    theme = (h >= 7 && h < 19) ? 'light' : 'dark';
  }
  const cur = document.documentElement.dataset.theme;
  if (cur !== theme) document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  return theme;
}

function setThemeMode(mode) {
  Store.rawSet('ccm_themeMode', mode);
  applyThemeMode();
  const labels = { 'manual-dark': 'Dark mode locked', 'manual-light': 'Light mode locked', 'auto': 'Auto by time (7AM-7PM light)' };
  toast(labels[mode] || 'Theme updated', 'cyan');
}

function autoThemeCheck() { if (getThemeMode() !== 'auto') return; applyThemeMode(); }

function toggleTheme() {
  const cur = document.documentElement.dataset.theme || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  Store.rawSet('ccm_themeMode', next === 'dark' ? 'manual-dark' : 'manual-light');
  document.documentElement.dataset.theme = next;
  document.getElementById('themeBtn').textContent = next === 'dark' ? '🌙' : '☀️';
  toast(`${next === 'dark' ? 'Dark' : 'Light'} mode locked`, 'violet');
}

/* ============================ CALC ============================ */
const Calc = {
  serviceNet(s) { return (s.collected || 0) - (s.portalFees || 0); },
  todayProfit() { return Store.get('services', []).filter(s => isToday(s.date)).reduce((a, s) => a + this.serviceNet(s), 0); },
  todayCount() { return Store.get('services', []).filter(s => isToday(s.date)).length; },
  todayCollected() { return Store.get('services', []).filter(s => isToday(s.date)).reduce((a, s) => a + (s.collected || 0), 0); },
  totalUdhaarDue() { return Store.get('udhaar', []).filter(u => u.status === 'pending').reduce((a, u) => a + Math.max(0, u.total - u.paid), 0); },
  monthExpenses() { return Store.get('expenses', []).filter(e => isThisMonth(e.date)).reduce((a, e) => a + e.amount, 0); },
  netSavings() {
    const sp = Store.get('services', []).reduce((a, s) => a + this.serviceNet(s), 0);
    const comm = this.allCommTotal();
    const exp = Store.get('expenses', []).reduce((a, e) => a + e.amount, 0);
    return sp + comm - exp;
  },
  allCommTotal() { const c = Store.get('commissions', {}); let t = 0; Object.values(c).forEach(y => Object.values(y).forEach(v => t += Number(v) || 0)); return t; },
  monthServiceProfit(y, m) { return Store.get('services', []).filter(s => yKey(s.date) === y && mKey(s.date) === m).reduce((a, s) => a + this.serviceNet(s), 0); },
  monthUdhaarCollected(y, m) { return Store.get('udhaar', []).filter(u => yKey(u.date) === y && mKey(u.date) === m).reduce((a, u) => a + u.paid, 0); },
  monthExpenses(y, m) { return Store.get('expenses', []).filter(e => yKey(e.date) === y && mKey(e.date) === m).reduce((a, e) => a + e.amount, 0); }
};

Calc.getRevenueData = function(period) {
  const services = Store.get('services', []);
  if (period === '7d') {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const nx = new Date(d); nx.setDate(nx.getDate() + 1);
      const svcs = services.filter(s => { const t = new Date(s.date); return t >= d && t < nx; });
      out.push({
        label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        revenue: svcs.reduce((a, s) => a + (s.collected || 0), 0),
        profit: svcs.reduce((a, s) => a + this.serviceNet(s), 0)
      });
    }
    return out;
  }
  if (period === '1m') {
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const nx = new Date(d); nx.setDate(nx.getDate() + 1);
      const svcs = services.filter(s => { const t = new Date(s.date); return t >= d && t < nx; });
      out.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: svcs.reduce((a, s) => a + (s.collected || 0), 0),
        profit: svcs.reduce((a, s) => a + this.serviceNet(s), 0)
      });
    }
    return out;
  }
  const year = new Date().getFullYear();
  return SHORT_MONTHS.map((m, i) => {
    const svcs = services.filter(s => yKey(s.date) === year && mKey(s.date) === i);
    return {
      label: m,
      revenue: svcs.reduce((a, s) => a + (s.collected || 0), 0),
      profit: svcs.reduce((a, s) => a + this.serviceNet(s), 0)
    };
  });
};

Calc.getExpenseData = function(period) {
  const expenses = Store.get('expenses', []);
  const now = new Date();
  let filtered;
  if (period === '7d') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0);
    filtered = expenses.filter(e => new Date(e.date) >= cutoff);
  } else if (period === '1m') {
    filtered = expenses.filter(e => isThisMonth(e.date));
  } else {
    filtered = expenses.filter(e => yKey(e.date) === now.getFullYear());
  }
  const map = {};
  filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
  const total = Object.values(map).reduce((a, b) => a + b, 0);
  return { labels: Object.keys(map), data: Object.values(map), total };
};

/* ============================ CUSTOMER TAGS ============================ */
function getCustomerTag(phone) {
  if (!phone) return null;
  const services = Store.get('services', []).filter(s => s.phone === phone);
  const visits = services.length;
  const netProfit = services.reduce((a, s) => a + ((s.collected || 0) - (s.portalFees || 0)), 0);
  if (netProfit >= 200) return 'vip';
  if (visits >= 3) return 'regular';
  return 'new';
}

function renderTag(phone) {
  const tag = getCustomerTag(phone);
  if (!tag) return '';
  const labels = { vip: '⭐ VIP', regular: 'Regular', new: 'New' };
  let title = '';
  if (tag === 'vip') {
    const services = Store.get('services', []).filter(s => s.phone === phone);
    const np = services.reduce((a, s) => a + ((s.collected || 0) - (s.portalFees || 0)), 0);
    title = `title="VIP Customer — Net Profit ₹${Math.round(np)}"`;
  } else if (tag === 'regular') {
    const visits = Store.get('services', []).filter(s => s.phone === phone).length;
    title = `title="${visits} visits"`;
  }
  return `<span class="tag ${tag}" ${title} style="margin-left:6px;">${labels[tag]}</span>`;
}

/* ============================ API HEALTH CHECK ============================ */
async function checkApi(silent = false) {
  const wasOnline = apiOnline;
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    apiOnline = j.db === 'connected';
    if (apiOnline && !wasOnline && !silent) {
      if (Sync.hasChanges()) {
        await Sync.push();
      } else {
        await Sync.pullAll();
      }
      render();
    }
  } catch { apiOnline = false; }
  Sync.updatePill();
}

/* ============================ MODAL ============================ */
function openModal({ title, bodyHTML, footerHTML, onSubmit, size }) {
  const back = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalFooter').innerHTML = footerHTML || '';
  modal.style.maxWidth = size === 'lg' ? '760px' : '';
  back.classList.add('show');
  Sound.click();
  const form = document.getElementById('modalBody').querySelector('form');
  if (form) {
    form.addEventListener('submit', e => { e.preventDefault(); if (onSubmit) onSubmit(form); });
    const first = form.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 150);
  }
}
function closeModal() { document.getElementById('modalBackdrop')?.classList.remove('show'); }
function confirmDialog(title, message, onYes) {
  openModal({
    title,
    bodyHTML: `<p style="color:var(--text-dim); font-size:14px; line-height:1.6;">${esc(message)}</p>`,
    footerHTML: `<button class="btn ghost" id="cancelBtn">Cancel</button><button class="btn danger" id="confirmBtn">Confirm</button>`
  });
  document.getElementById('cancelBtn').onclick = closeModal;
  document.getElementById('confirmBtn').onclick = () => { closeModal(); Sound.click(); onYes(); };
}

/* ============================ ROUTER ============================ */
let currentPage = 'dashboard';
const PAGE_META = {
  dashboard: { title: 'Dashboard', sub: 'Business overview' },
  services: { title: 'Daily Services', sub: 'Walk-in customer jobs' },
  udhaar: { title: 'Udhaar / Khata', sub: 'Credit customers & reminders' },
  expenses: { title: 'Expenses', sub: 'Shop & personal expenses' },
  insights: { title: 'Insights', sub: 'Customer & service analytics' },
  summary: { title: 'Business Summary', sub: 'Yearly P&L statement' },
  loans: { title: 'Loans & Borrowings', sub: 'Debt tracking' },
  inventory: { title: 'Inventory & Assets', sub: 'Shop equipment & machines' },
  ratecard: { title: 'Rate Card', sub: 'Editable service price list' },
  settings: { title: 'Settings', sub: 'Shop profile & preferences' }
};

function navigate(page) {
  currentPage = page;
  selectedRows.clear();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const meta = PAGE_META[page] || PAGE_META.dashboard;
  document.getElementById('pageTitle').textContent = meta.title;
  document.getElementById('pageSub').textContent = meta.sub;
  render();
  closeSidebarDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  Sound.click();
}

function render() {
  const content = document.getElementById('content');
  if (!content) return;
  content.style.animation = 'none'; void content.offsetWidth;
  content.style.animation = 'pageEnter 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)';
  content.innerHTML = renderPage(currentPage);
  if (currentPage === 'dashboard') initDashboardCharts();
  attachPageEvents();
  updateTargetRing();
  updateNavBadges();
  animateKPIs();
  Achievements.check();
  Sync.updatePill();
}

function renderPage(p) {
  switch (p) {
    case 'dashboard': return PageDashboard();
    case 'services': return PageServices();
    case 'udhaar': return PageUdhaar();
    case 'expenses': return PageExpenses();
    case 'insights': return PageInsights();
    case 'summary': return PageSummary();
    case 'loans': return PageLoans();
    case 'inventory': return PageInventory();
    case 'ratecard': return PageRateCard();
    case 'settings': return PageSettings();
    default: return '<div class="empty"><div class="icon">🤔</div><p>Page not found</p></div>';
  }
}

function updateNavBadges() {
  const pending = Store.get('udhaar', []).filter(u => u.status === 'pending').length;
  document.querySelectorAll('[data-badge="udhaar"]').forEach(el => {
    el.textContent = pending;
    el.classList.toggle('show', pending > 0);
  });
}

function animateKPIs() {
  document.querySelectorAll('.kpi-value[data-target]').forEach(el => {
    const target = parseFloat(el.getAttribute('data-target')) || 0;
    const isCurrency = el.getAttribute('data-currency') === 'true';
    const dur = 900, start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = isCurrency ? formatINR(val) : Math.round(val).toString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function updateTargetRing() {
  const target = Store.get('target', { amount: 2000 });
  const profit = Calc.todayProfit();
  const pct = target.amount > 0 ? Math.min(100, (profit / target.amount) * 100) : 0;
  const ring = document.getElementById('targetRing');
  if (ring) ring.style.strokeDashoffset = 157 - (157 * pct) / 100;
  const pctEl = document.getElementById('targetPct'); if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  const cur = document.getElementById('targetCur'); if (cur) cur.textContent = formatINR(profit);
  const goal = document.getElementById('targetGoal'); if (goal) goal.textContent = formatINR(target.amount);
}

/* ============================ PAGE: DASHBOARD ============================ */
function PageDashboard() {
  const profit = Calc.todayProfit(), due = Calc.totalUdhaarDue(), exp = Calc.monthExpenses();
  const net = Calc.netSavings(), count = Calc.todayCount();
  const recent = Store.get('services', []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  const overdue = Store.get('udhaar', []).filter(u => u.status === 'pending').sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);
  const pendingCount = Store.get('udhaar', []).filter(u => u.status === 'pending').length;
  const notes = Store.get('notes', '');

  return `
    ${pendingCount > 0 ? `
      <div class="notice">
        <span style="font-size:18px;">⚠️</span>
        <span style="flex:1;"><strong>${pendingCount}</strong> customer${pendingCount !== 1 ? 's' : ''} have pending udhaar</span>
        <button class="btn primary sm" id="bulkWaBtn">💬 Remind All</button>
      </div>
    ` : ''}

    <div class="grid grid-4">
      ${kpiCard('emerald', '💵', "Today's Net Profit", profit, `From ${count} service${count !== 1 ? 's' : ''}`, true)}
      ${kpiCard('amber', '⏳', 'Total Udhaar Due', due, `${pendingCount} pending customers`, true)}
      ${kpiCard('rose', '💸', "This Month's Expenses", exp, 'Shop + personal', true)}
      ${kpiCard('violet', '💎', 'Net Business Savings', net, 'Gross − expenses', true)}
    </div>

    <div class="grid grid-4 mt-16">
      ${kpiCard('cyan', '👥', "Today's Customers", count, 'Services today', false)}
      ${kpiCard('violet', '💼', 'Total Transactions', Store.get('services', []).length, 'All-time records', false)}
      ${kpiCard('amber', '🏦', 'Active Loans', Store.get('loans', []).filter(l => l.status === 'active').reduce((a, l) => a + (l.total - l.paid), 0), 'Outstanding', true)}
      ${kpiCard('emerald', '📦', 'Inventory Items', Store.get('inventory', []).length, 'Tracked assets', false)}
    </div>

    <div class="grid grid-2 mt-22" style="grid-template-columns: 2fr 1fr;">
      <div class="card chart-card">
        <div class="chart-header">
          <div><h3>📈 Revenue & Profit</h3><p>Daily collection vs net profit</p></div>
          <div class="period-toggle" id="revToggle">
            <button data-period="7d" class="${periodRev === '7d' ? 'active' : ''}">7 Days</button>
            <button data-period="1m" class="${periodRev === '1m' ? 'active' : ''}">1 Month</button>
            <button data-period="1y" class="${periodRev === '1y' ? 'active' : ''}">1 Year</button>
          </div>
        </div>
        <div class="chart-body"><canvas id="chartArea"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="chart-header">
          <div><h3>🍩 Expenses</h3><p id="expSub">Total: ${formatINR(Calc.getExpenseData(periodExp).total)}</p></div>
          <div class="period-toggle" id="expToggle">
            <button data-period="7d" class="${periodExp === '7d' ? 'active' : ''}">7D</button>
            <button data-period="1m" class="${periodExp === '1m' ? 'active' : ''}">1M</button>
            <button data-period="1y" class="${periodExp === '1y' ? 'active' : ''}">1Y</button>
          </div>
        </div>
        <div class="chart-body"><canvas id="chartDonut"></canvas></div>
      </div>
    </div>

    <div class="card chart-card mt-22">
      <div class="chart-header"><div><h3>📊 12-Month Profit vs Expenses</h3><p>Year ${new Date().getFullYear()}</p></div></div>
      <div class="chart-body"><canvas id="chartBar"></canvas></div>
    </div>

    <div class="grid grid-2 mt-22" style="grid-template-columns: 2fr 1fr;">
      <div class="card">
        <div class="section-title" style="margin:0 0 14px;">
          <h3>🕒 Recent Transactions</h3>
          <button class="btn ghost sm" data-nav="services">View all →</button>
        </div>
        ${recent.length ? `
          <div class="table-wrap">
            <table style="min-width:auto;">
              <thead><tr><th>Customer</th><th>Service</th><th class="num">Net</th></tr></thead>
              <tbody>${recent.map(s => `
                <tr>
                  <td><strong>${esc(s.name)}</strong>${renderTag(s.phone)}<br><span style="font-size:11px;color:var(--text-mute);">${esc(s.phone)}</span></td>
                  <td>${esc(s.service)}</td>
                  <td class="num" style="color:#34d399;font-weight:700;">${formatINR(Calc.serviceNet(s))}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty"><div class="icon">📭</div><p>No transactions yet</p></div>`}
      </div>

      <div class="card">
        <div class="section-title" style="margin:0 0 14px;">
          <h3>📝 Quick Notes</h3>
          <span style="font-size:11px;color:var(--text-mute);">Auto-saved</span>
        </div>
        <div class="notes-widget">
          <textarea id="notesArea" placeholder="Remember something?&#10;&#10;• Order A4 paper&#10;• SBI slip pending&#10;• Call Ramesh for udhaar">${esc(notes)}</textarea>
        </div>
      </div>
    </div>

    <div class="card mt-22">
      <div class="section-title" style="margin:0 0 14px;">
        <h3>⚠️ Pending Udhaar — Aging Report</h3>
        <button class="btn ghost sm" data-nav="udhaar">View all →</button>
      </div>
      ${overdue.length ? `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${overdue.map(u => {
            const bal = u.total - u.paid;
            const days = daysBetween(u.date);
            const aging = days < 15 ? 'emerald' : days < 30 ? 'amber' : 'rose';
            const agingLabel = days < 15 ? 'Recent' : days < 30 ? 'Overdue' : 'Critical';
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:11px;background:var(--bg-2);border-radius:10px;border:1px solid var(--border);">
                <div style="flex:1;cursor:pointer;" onclick="openCustomerDrawer('${escJs(u.name)}','${escJs(u.phone)}')">
                  <div style="font-weight:700;">${esc(u.name)}${renderTag(u.phone)}</div>
                  <div style="font-size:11.5px;color:var(--text-mute);">${esc(u.work)} · ${formatDate(u.date)} · <span class="badge ${aging}" style="padding:2px 6px;font-size:9px;">${days}d ${agingLabel}</span></div>
                </div>
                <div class="mono" style="color:#fbbf24;font-weight:800;">${formatINR(bal)}</div>
                <button class="btn wa sm" data-wa="${u.id}">💬</button>
              </div>
            `;
          }).join('')}
        </div>
      ` : `<div class="empty"><div class="icon">✨</div><p>All payments cleared!</p></div>`}
    </div>
  `;
}

function kpiCard(color, icon, label, value, sub, isCurrency) {
  return `
    <div class="card kpi card-hover ${color}">
      <div class="kpi-icon">${icon}</div>
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value" data-target="${Number(value) || 0}" data-currency="${isCurrency ? 'true' : 'false'}">${isCurrency ? formatINR(0) : '0'}</div>
      <div class="kpi-sub">${esc(sub)}</div>
    </div>
  `;
}

/* ============================ CHARTS ============================ */
const charts = {};
function initDashboardCharts() {
  const ctxA = document.getElementById('chartArea');
  if (ctxA) {
    const data = Calc.getRevenueData(periodRev);
    const g = ctxA.getContext('2d').createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, 'rgba(99,102,241,0.4)'); g.addColorStop(1, 'rgba(99,102,241,0)');
    const gp = ctxA.getContext('2d').createLinearGradient(0, 0, 0, 260);
    gp.addColorStop(0, 'rgba(16,185,129,0.4)'); gp.addColorStop(1, 'rgba(16,185,129,0)');
    if (charts.area) charts.area.destroy();
    charts.area = new Chart(ctxA, {
      type: 'line',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          { label: 'Revenue', data: data.map(d => d.revenue), borderColor: '#818cf8', backgroundColor: g, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: periodRev === '1m' ? 2 : 4, pointBackgroundColor: '#818cf8', pointBorderColor: '#0c0e16', pointBorderWidth: 2 },
          { label: 'Profit', data: data.map(d => d.profit), borderColor: '#34d399', backgroundColor: gp, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: periodRev === '1m' ? 2 : 4, pointBackgroundColor: '#34d399', pointBorderColor: '#0c0e16', pointBorderWidth: 2 }
        ]
      },
      options: chartOpts()
    });
  }

  const ctxD = document.getElementById('chartDonut');
  if (ctxD) {
    const expData = Calc.getExpenseData(periodExp);
    const palette = ['#6366f1','#8b5cf6','#a855f7','#0ea5e9','#10b981','#f59e0b','#ef4444','#14b8a6','#84cc16','#ec4899','#f97316','#fbbf24'];
    if (!expData.labels.length) {
      ctxD.parentElement.innerHTML = '<div class="empty" style="padding:40px 0;"><div class="icon">💸</div><p>No expenses for this period</p></div>';
    } else {
      if (charts.donut) charts.donut.destroy();
      charts.donut = new Chart(ctxD, {
        type: 'doughnut',
        data: { labels: expData.labels, datasets: [{ data: expData.data, backgroundColor: palette.slice(0, expData.labels.length), borderColor: '#0c0e16', borderWidth: 3, hoverOffset: 10 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#9498b0', font: { size: 11, family: 'Plus Jakarta Sans' }, padding: 12, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
            tooltip: { backgroundColor: '#12141f', borderColor: '#2f3348', borderWidth: 1, padding: 12, cornerRadius: 8, callbacks: { label: c => ` ${c.label}: ${formatINR(c.parsed)}` } }
          }
        }
      });
    }
  }

  const ctxB = document.getElementById('chartBar');
  if (ctxB) {
    const year = new Date().getFullYear();
    const data = SHORT_MONTHS.map((m, i) => {
      const profit = Calc.monthServiceProfit(year, i) + Calc.monthUdhaarCollected(year, i);
      const expenses = Calc.monthExpenses(year, i);
      return { month: m, profit, expenses, net: profit - expenses };
    });
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctxB, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          { label: 'Profit', data: data.map(d => d.profit), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 6, barPercentage: 0.7 },
          { label: 'Expenses', data: data.map(d => d.expenses), backgroundColor: 'rgba(239,68,68,0.75)', borderRadius: 6, barPercentage: 0.7 }
        ]
      },
      options: { ...chartOpts(), animation: { duration: 1200, easing: 'easeOutQuart' } }
    });
  }
}

function chartOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeOutQuart' },
    plugins: {
      legend: { labels: { color: '#9498b0', font: { size: 11, family: 'Plus Jakarta Sans' }, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      tooltip: { backgroundColor: '#12141f', borderColor: '#2f3348', borderWidth: 1, titleColor: '#edeff6', bodyColor: '#9498b0', padding: 12, cornerRadius: 8, callbacks: { label: c => ` ${c.dataset.label}: ${formatINR(c.parsed.y ?? c.parsed)}` } }
    },
    scales: {
      x: { grid: { color: 'rgba(99,102,241,0.05)' }, ticks: { color: '#5e6482', font: { size: 11, family: 'Plus Jakarta Sans' } } },
      y: { grid: { color: 'rgba(99,102,241,0.05)' }, ticks: { color: '#5e6482', font: { size: 11, family: 'Plus Jakarta Sans' }, callback: v => '₹' + v } }
    }
  };
}

/* ============================ PAGE: INSIGHTS ============================ */
function PageInsights() {
  const custMap = {};
  Store.get('services', []).forEach(s => {
    const key = s.phone || s.name;
    if (!custMap[key]) custMap[key] = { name: s.name, phone: s.phone, spent: 0, visits: 0, netProfit: 0 };
    custMap[key].spent += s.collected || 0;
    custMap[key].netProfit += (s.collected || 0) - (s.portalFees || 0);
    custMap[key].visits += 1;
  });
  const topCustomers = Object.values(custMap).sort((a, b) => b.spent - a.spent).slice(0, 10);

  const svcMap = {};
  Store.get('services', []).forEach(s => {
    if (!svcMap[s.service]) svcMap[s.service] = { name: s.service, count: 0, revenue: 0, profit: 0 };
    svcMap[s.service].count += 1;
    svcMap[s.service].revenue += s.collected || 0;
    svcMap[s.service].profit += Calc.serviceNet(s);
  });
  const topServices = Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const maxSvcRevenue = topServices[0]?.revenue || 1;

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayStats = weekdays.map(d => ({ day: d, revenue: 0, count: 0 }));
  Store.get('services', []).forEach(s => {
    const day = new Date(s.date).getDay();
    dayStats[day].revenue += s.collected || 0;
    dayStats[day].count += 1;
  });
  const maxDayRev = Math.max(...dayStats.map(d => d.revenue), 1);

  const hourStats = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, revenue: 0 }));
  Store.get('services', []).forEach(s => {
    const h = new Date(s.date).getHours();
    hourStats[h].count += 1;
    hourStats[h].revenue += s.collected || 0;
  });
  const activeHours = hourStats.filter(h => h.count > 0);
  const maxHourCount = Math.max(...activeHours.map(h => h.count), 1);

  const totalCustomers = Object.keys(custMap).length;
  const totalServices = Store.get('services', []).length;
  const totalRevenue = Store.get('services', []).reduce((a, s) => a + (s.collected || 0), 0);
  const vipCount = Object.values(custMap).filter(c => c.netProfit >= 200).length;

  return `
    <div class="grid grid-4" style="margin-bottom:18px;">
      ${kpiCard('violet', '👥', 'Unique Customers', totalCustomers, 'All time', false)}
      ${kpiCard('emerald', '💼', 'Services Delivered', totalServices, 'Total jobs', false)}
      ${kpiCard('cyan', '⭐', 'VIP Customers', vipCount, 'Net profit ₹200+', false)}
      ${kpiCard('amber', '📊', 'Avg. Ticket Size', totalServices > 0 ? Math.round(totalRevenue / totalServices) : 0, 'Per customer visit', true)}
    </div>

    <div class="insights-grid">
      <div class="card">
        <div class="chart-header" style="margin-bottom:16px;">
          <div><h3>🏆 Top 10 Customers</h3><p>By total spending</p></div>
        </div>
        ${topCustomers.length ? `
          <div class="leader-list">
            ${topCustomers.map((c, i) => `
              <div class="leader-item" onclick="openCustomerDrawer('${escJs(c.name)}','${escJs(c.phone)}')" style="cursor:pointer;">
                <div class="leader-rank">${i + 1}</div>
                <div class="leader-info">
                  <div class="leader-name">${esc(c.name)}${renderTag(c.phone)}</div>
                  <div class="leader-sub">${esc(c.phone)} · ${c.visits} visit${c.visits !== 1 ? 's' : ''} · NP ₹${Math.round(c.netProfit)}</div>
                </div>
                <div class="leader-value">${formatINR(c.spent)}</div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="empty"><div class="icon">👥</div><p>No customer data yet</p></div>`}
      </div>

      <div class="card">
        <div class="chart-header" style="margin-bottom:16px;">
          <div><h3>🔥 Top 10 Services</h3><p>By revenue generated</p></div>
        </div>
        ${topServices.length ? `
          <div class="bar-list">
            ${topServices.map(s => `
              <div class="bar-row">
                <div class="bar-label" title="${esc(s.name)}">${esc(s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${(s.revenue / maxSvcRevenue) * 100}%;"></div></div>
                <div class="bar-value">${formatINR(s.revenue)}</div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="empty"><div class="icon">🔥</div><p>No service data yet</p></div>`}
      </div>

      <div class="card">
        <div class="chart-header" style="margin-bottom:16px;">
          <div><h3>📅 Best Days of Week</h3><p>Revenue by weekday</p></div>
        </div>
        <div class="bar-list">
          ${dayStats.sort((a, b) => b.revenue - a.revenue).map(d => `
            <div class="bar-row">
              <div class="bar-label">${d.day}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${(d.revenue / maxDayRev) * 100}%;"></div></div>
              <div class="bar-value">${formatINR(d.revenue)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="chart-header" style="margin-bottom:16px;">
          <div><h3>⏰ Peak Business Hours</h3><p>Customer footfall by hour</p></div>
        </div>
        ${activeHours.length ? `
          <div class="hour-grid">
            ${activeHours.sort((a, b) => a.hour - b.hour).map(h => {
              const isPeak = h.count === maxHourCount;
              const label = h.hour === 0 ? '12A' : h.hour < 12 ? h.hour + 'A' : h.hour === 12 ? '12P' : (h.hour - 12) + 'P';
              return `
                <div class="hour-cell ${isPeak ? 'peak' : ''}" title="${h.count} customers · ${formatINR(h.revenue)}">
                  <div class="h">${label}</div>
                  <div class="c">${h.count}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `<div class="empty"><div class="icon">⏰</div><p>No data yet</p></div>`}
      </div>
    </div>

    <div class="card mt-22">
      <div class="chart-header" style="margin-bottom:16px;">
        <div><h3>🎯 Quick Insights</h3><p>Auto-generated business tips</p></div>
      </div>
      <div style="display:grid;gap:10px;">
        ${(() => {
          const tips = [];
          const bestDay = dayStats.reduce((a, b) => a.revenue > b.revenue ? a : b);
          const worstDay = dayStats.reduce((a, b) => a.revenue < b.revenue ? a : b);
          const topSvc = topServices[0];
          const topCust = topCustomers[0];
          const pendingCount = Store.get('udhaar', []).filter(u => u.status === 'pending').length;
          const pendingAmt = Calc.totalUdhaarDue();

          if (bestDay.revenue > 0) tips.push({ icon: '📈', text: `<strong>${bestDay.day}</strong> is your best day — earn more by running offers other days.` });
          if (worstDay.revenue < bestDay.revenue * 0.3 && worstDay.revenue > 0) tips.push({ icon: '⚠️', text: `<strong>${worstDay.day}</strong> has low footfall — consider a special discount.` });
          if (topSvc) tips.push({ icon: '🔥', text: `<strong>${topSvc.name}</strong> is your top earner — ${formatINR(topSvc.revenue)} from ${topSvc.count} jobs.` });
          if (topCust) tips.push({ icon: '⭐', text: `<strong>${topCust.name}</strong> is your VIP — ${formatINR(topCust.netProfit)} net profit!` });
          if (pendingCount > 0) tips.push({ icon: '💰', text: `<strong>${pendingCount} customers</strong> owe you ${formatINR(pendingAmt)} — send WhatsApp reminders.` });
          if (activeHours.length && maxHourCount > 0) {
            const peakH = activeHours.find(h => h.count === maxHourCount);
            const peakLabel = peakH.hour === 0 ? '12 AM' : peakH.hour < 12 ? peakH.hour + ' AM' : peakH.hour === 12 ? '12 PM' : (peakH.hour - 12) + ' PM';
            tips.push({ icon: '⏰', text: `Peak hour is <strong>${peakLabel}</strong> — make sure counter is well-staffed.` });
          }
          if (!tips.length) tips.push({ icon: '📊', text: 'Add more services to unlock business insights.' });
          return tips.map(t => `
            <div style="display:flex;gap:12px;padding:12px 14px;background:var(--bg-2);border-radius:10px;border:1px solid var(--border);font-size:13px;">
              <span style="font-size:18px;">${t.icon}</span>
              <span style="flex:1;line-height:1.6;">${t.text}</span>
            </div>
          `).join('');
        })()}
      </div>
    </div>
  `;
}

/* ============================ PAGE: SERVICES ============================ */
function PageServices() {
  const list = Store.get('services', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  return `
    <div class="toolbar">
      <input type="search" id="svcSearch" placeholder="🔍 Search name, phone, service..." />
      <select id="svcFilter">
        <option value="all">All Time</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month" selected>This Month</option>
      </select>
      <button class="btn ghost" id="exportSvcCsv">📥 CSV</button>
      <button class="btn primary" id="addServiceBtn">＋ Add Service</button>
    </div>
    <div class="bulk-bar" id="svcBulkBar">
      <span class="count" id="svcBulkCount">0 selected</span>
      <span class="spacer"></span>
      <button class="btn danger sm" id="svcBulkDelete">🗑️ Delete Selected</button>
      <button class="btn ghost sm" id="svcBulkClear">Clear</button>
    </div>
    <div id="svcTableWrap">${renderServicesTable(list)}</div>
  `;
}

function renderServicesTable(list) {
  if (!list.length) return `<div class="empty card"><div class="icon">🧾</div><p>No service records found</p></div>`;
  const totalNet = list.reduce((a, s) => a + Calc.serviceNet(s), 0);
  const totalCol = list.reduce((a, s) => a + (s.collected || 0), 0);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:32px;"><input type="checkbox" class="checkbox" id="svcSelectAll" /></th>
          <th>Date</th><th>Customer</th><th>Service</th>
          <th class="num">Portal Fees</th><th class="num">Collected</th><th class="num">Net Profit</th>
          <th>Mode</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${list.map(s => `
            <tr data-row-id="${s.id}">
              <td><input type="checkbox" class="checkbox row-check" data-check-id="${s.id}" /></td>
              <td style="font-size:12px;color:var(--text-mute);">${formatDateTime(s.date)}</td>
              <td><strong style="cursor:pointer;color:#a78bfa;" onclick="openCustomerDrawer('${escJs(s.name)}','${escJs(s.phone)}')">${esc(s.name)}</strong>${renderTag(s.phone)}<br><span style="font-size:11px;color:var(--text-mute);">${esc(s.phone)}</span></td>
              <td>${esc(s.service)}${s.remarks ? `<br><span style="font-size:11px;color:var(--text-mute);">${esc(s.remarks)}</span>` : ''}</td>
              <td class="num" style="color:#f87171;">${formatINR(s.portalFees)}</td>
              <td class="num">${formatINR(s.collected)}</td>
              <td class="num" style="color:#34d399;font-weight:700;">${formatINR(Calc.serviceNet(s))}</td>
              <td><span class="badge ${modeBadge(s.mode)}">${esc(s.mode)}</span></td>
              <td class="actions">
                <button class="btn ghost sm" title="Print Receipt" data-receipt="${s.id}">🧾</button>
                <button class="btn ghost sm" title="Duplicate" data-dup-svc="${s.id}">📋</button>
                <button class="btn ghost sm" title="Edit" data-edit-svc="${s.id}">✏️</button>
                <button class="btn danger sm" title="Delete" data-del-svc="${s.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg-2);">
            <td colspan="5" style="text-align:right;font-weight:700;">TOTAL (${list.length} records)</td>
            <td class="num" style="font-weight:800;">${formatINR(totalCol)}</td>
            <td class="num" style="color:#34d399;font-weight:800;font-size:15px;">${formatINR(totalNet)}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
function modeBadge(m) { return { Cash: 'emerald', UPI: 'cyan', Card: 'violet', 'Credit / Udhaar': 'amber' }[m] || 'violet'; }

function openServiceModal(existing, duplicate = false) {
  const isEdit = !!existing && !duplicate;
  const s = existing ? { ...existing } : { name: '', phone: '', service: '', portalFees: 0, collected: 0, mode: 'Cash', remarks: '' };
  if (duplicate) s.remarks = (s.remarks || '') + ' (copy)';
  openModal({
    title: isEdit ? '✏️ Edit Service' : duplicate ? '📋 Duplicate Service' : '＋ Add Daily Service',
    bodyHTML: `
      <form id="svcForm">
        <div class="form-grid">
          <div class="field"><label>Customer Name *</label><input name="name" required value="${esc(s.name)}" list="customerNames" /><datalist id="customerNames">${allCustomers().map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
          <div class="field"><label>Mobile Number *</label><input name="phone" required pattern="\\d{10}" maxlength="10" value="${esc(s.phone)}" inputmode="numeric" /></div>
          <div class="field full">
            <label>Service Type * <span style="color:var(--brand-3);font-size:11px;font-weight:600;margin-left:4px;">— select karo → fees auto-fill ho jayengi</span></label>
            <input name="service" required value="${esc(s.service)}" list="serviceList" autocomplete="off" />
            <datalist id="serviceList">${SERVICE_TYPES.map(x => `<option value="${x}">`).join('')}</datalist>
          </div>
          <div class="field">
            <label>Portal / Govt Fees (Dr) ₹ <span style="color:#f87171;font-size:11px;font-weight:600;">⬇ auto</span></label>
            <input name="portalFees" type="number" min="0" step="0.01" value="${s.portalFees}" />
          </div>
          <div class="field">
            <label>Total Collected (Cr) ₹ <span style="color:#34d399;font-size:11px;font-weight:600;">⬇ auto</span></label>
            <input name="collected" type="number" min="0" step="0.01" value="${s.collected}" />
          </div>
          <div class="field"><label>Payment Mode</label><select name="mode">${['Cash','UPI','Card','Credit / Udhaar'].map(m => `<option ${m === s.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          <div class="field"><label>Remarks / Slip No.</label><input name="remarks" value="${esc(s.remarks || '')}" /></div>
        </div>
        <div id="autoFillHint" style="display:none;margin-top:12px;padding:9px 12px;background:var(--success-soft);border:1px solid rgba(16,185,129,0.3);border-radius:9px;font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px;">
          <span>✨</span>
          <span style="flex:1;">Rate Card se auto-fill ho gaya! Aap change bhi kar sakte ho.</span>
        </div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit" form="svcForm">${isEdit ? 'Update' : 'Save'} Service</button>`,
    onSubmit: form => {
      const data = Object.fromEntries(new FormData(form));
      data.portalFees = Number(data.portalFees) || 0;
      data.collected = Number(data.collected) || 0;
      if (isEdit) {
        Store.set('services', Store.get('services', []).map(x => x.id === existing.id ? { ...x, ...data } : x));
        toast('Service updated', 'emerald');
      } else {
        const list = Store.get('services', []);
        list.unshift({ id: uid(), date: todayISO(), ...data });
        Store.set('services', list);
        toast(duplicate ? 'Duplicated' : 'Service added', 'emerald');
        if (data.mode !== 'Credit / Udhaar') Sound.pay();
      }
      Sync.markDirty('services');
      closeModal(); render();
      const todayKey = new Date().toDateString();
      const targetVal = Store.get('target', { amount: 2000 }).amount;
      if (Calc.todayProfit() >= targetVal) {
        const lastCelebrated = localStorage.getItem('ccm_targetCelebrated');
        if (lastCelebrated !== todayKey) {
          localStorage.setItem('ccm_targetCelebrated', todayKey);
          setTimeout(() => Confetti.burst(window.innerWidth / 2, window.innerHeight / 3), 300);
        }
      }
    }
  });

  setTimeout(() => {
    const form = document.getElementById('svcForm');
    if (!form) return;
    const svcInput = form.querySelector('[name="service"]');
    const portalInput = form.querySelector('[name="portalFees"]');
    const collectedInput = form.querySelector('[name="collected"]');
    const hint = document.getElementById('autoFillHint');

    const tryAutoFill = () => {
      const typed = (svcInput.value || '').trim().toLowerCase();
      if (!typed) return;
      const rates = Store.get('rates', DEFAULT_RATES);
      const match = rates.find(r => r.name.toLowerCase().trim() === typed);
      if (match) {
        portalInput.value = match.portalFees || 0;
        collectedInput.value = (match.portalFees || 0) + (match.serviceCharge || 0);
        if (hint) {
          hint.style.display = 'flex';
          setTimeout(() => { if (hint) hint.style.display = 'none'; }, 3500);
        }
        Sound.click();
      }
    };

    svcInput.addEventListener('input', tryAutoFill);
    svcInput.addEventListener('change', tryAutoFill);
  }, 200);
}

function allCustomers() {
  const seen = new Set(), out = [];
  Store.get('services', []).concat(Store.get('udhaar', [])).forEach(c => {
    if (c.phone && !seen.has(c.phone)) { seen.add(c.phone); out.push({ name: c.name, phone: c.phone }); }
  });
  return out;
}

/* ============================ RECEIPT ============================ */
function printReceipt(id) {
  const s = Store.get('services', []).find(x => x.id === id);
  if (!s) return;
  const st = getSettings();
  const w = window.open('', '_blank', 'width=440,height=680');
  w.document.write(`
    <!DOCTYPE html><html><head><title>Receipt - ${esc(s.name)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; background: #fff; color: #000; padding: 20px; }
      .receipt { max-width: 320px; margin: 0 auto; border: 2px solid #000; padding: 18px 16px; position: relative; }
      .head { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 12px; }
      .head h1 { font-size: 15px; letter-spacing: 1.5px; font-weight: 900; margin-bottom: 4px; }
      .head .sub { font-size: 10px; line-height: 1.5; }
      .head .gst { font-size: 10px; font-weight: 700; margin-top: 4px; }
      .badge { display: inline-block; background: #000; color: #fff; padding: 3px 10px; font-size: 10px; letter-spacing: 1px; margin-top: 8px; }
      .meta { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 8px; color: #333; }
      .section { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11.5px; }
      .row .lbl { color: #444; }
      .row .val { font-weight: 700; text-align: right; max-width: 60%; word-break: break-word; }
      .item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px dotted #ccc; }
      .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-top: 10px; }
      .paid-stamp { position: absolute; top: 45%; right: 10px; transform: rotate(-18deg); border: 3px solid #10b981; color: #10b981; padding: 6px 14px; font-size: 16px; font-weight: 900; letter-spacing: 2px; border-radius: 6px; opacity: 0.85; }
      .foot { text-align: center; margin-top: 14px; padding-top: 12px; border-top: 2px dashed #000; font-size: 10px; line-height: 1.6; }
      .foot .thanks { font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="receipt">
        <div class="head">
          <h1>${esc(st.shopName).toUpperCase()}</h1>
          <div class="sub">${esc(st.address)}<br>Ph: ${esc(st.phone)}</div>
          <div class="gst">GST/CSC: ${esc(st.gst)}</div>
          <div class="badge">RECEIPT</div>
        </div>
        <div class="meta">
          <span>No: #${esc(s.id.slice(-6).toUpperCase())}</span>
          <span>${formatDateTime(s.date)}</span>
        </div>
        <div class="row"><span class="lbl">Customer:</span><span class="val">${esc(s.name)}</span></div>
        <div class="row"><span class="lbl">Mobile:</span><span class="val">${esc(s.phone)}</span></div>
        <div class="section">
          <div class="item"><span>${esc(s.service)}</span><span style="font-weight:700;">Rs.${formatNum(s.collected)}</span></div>
          ${s.remarks ? `<div style="font-size:10px;color:#666;padding:4px 0;">Ref: ${esc(s.remarks)}</div>` : ''}
          <div class="total-row"><span>TOTAL PAID</span><span>Rs.${formatNum(s.collected)}</span></div>
          <div class="row" style="margin-top:8px;"><span class="lbl">Payment Mode:</span><span class="val">${esc(s.mode)}</span></div>
        </div>
        ${s.mode !== 'Credit / Udhaar' ? '<div class="paid-stamp">PAID</div>' : '<div class="paid-stamp" style="border-color:#f59e0b;color:#f59e0b;">DUE</div>'}
        <div class="foot">
          <div class="thanks">THANK YOU</div>
          <div>Visit Again! Keep this receipt safe.</div>
          <div style="margin-top:6px;font-size:9px;color:#666;">Generated: ${new Date().toLocaleString('en-IN')}</div>
        </div>
      </div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
    </body></html>
  `);
  w.document.close();
}

/* ============================ PAGE: UDHAAR ============================ */
function PageUdhaar() {
  const list = Store.get('udhaar', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const pending = list.filter(u => u.status === 'pending');
  const totalDue = pending.reduce((a, u) => a + (u.total - u.paid), 0);
  const critical = pending.filter(u => daysBetween(u.date) >= 30).length;
  return `
    <div class="grid grid-4" style="margin-bottom:18px;">
      ${kpiCard('amber', '⏳', 'Pending Udhaar', totalDue, `${pending.length} customers`, true)}
      ${kpiCard('rose', '🚨', 'Critical (30+ days)', critical, 'Overdue accounts', false)}
      ${kpiCard('emerald', '✅', 'Cleared Accounts', list.filter(u => u.status === 'cleared').length, 'Total settled', false)}
      ${kpiCard('violet', '💰', 'Total Billed', list.reduce((a, u) => a + u.total, 0), 'All-time credit', true)}
    </div>
    <div class="toolbar">
      <input type="search" id="udSearch" placeholder="🔍 Search customer..." />
      <select id="udFilter">
        <option value="all">All</option>
        <option value="pending" selected>Pending Only</option>
        <option value="cleared">Cleared Only</option>
        <option value="critical">Critical 30+ days</option>
      </select>
      ${pending.length ? `<button class="btn wa" id="bulkWaBtn2">💬 Remind All (${pending.length})</button>` : ''}
      <button class="btn ghost" id="exportUdCsv">📥 CSV</button>
      <button class="btn primary" id="addUdhaarBtn">＋ Add Udhaar</button>
    </div>
    <div class="bulk-bar" id="udBulkBar">
      <span class="count" id="udBulkCount">0 selected</span>
      <span class="spacer"></span>
      <button class="btn danger sm" id="udBulkDelete">🗑️ Delete Selected</button>
      <button class="btn ghost sm" id="udBulkClear">Clear</button>
    </div>
    <div id="udTableWrap">${renderUdhaarTable(list)}</div>
  `;
}

function renderUdhaarTable(list) {
  if (!list.length) return `<div class="empty card"><div class="icon">💰</div><p>No udhaar records</p></div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:32px;"><input type="checkbox" class="checkbox" id="udSelectAll" /></th>
          <th>Date</th><th>Aging</th><th>Customer</th><th>Work</th>
          <th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th>
          <th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${list.map(u => {
            const bal = u.total - u.paid;
            const days = daysBetween(u.date);
            const aging = u.status === 'cleared' ? 'emerald' : days < 15 ? 'emerald' : days < 30 ? 'amber' : 'rose';
            return `
              <tr data-row-id="${u.id}">
                <td><input type="checkbox" class="checkbox row-check" data-check-id="${u.id}" /></td>
                <td style="font-size:12px;color:var(--text-mute);">${formatDate(u.date)}</td>
                <td><span class="badge ${aging}" style="font-size:10px;">${days}d</span></td>
                <td><strong style="cursor:pointer;color:#a78bfa;" onclick="openCustomerDrawer('${escJs(u.name)}','${escJs(u.phone)}')">${esc(u.name)}</strong>${renderTag(u.phone)}<br><span style="font-size:11px;color:var(--text-mute);">${esc(u.phone)}</span></td>
                <td>${esc(u.work)}</td>
                <td class="num">${formatINR(u.total)}</td>
                <td class="num" style="color:#34d399;">${formatINR(u.paid)}</td>
                <td class="num" style="color:${bal > 0 ? '#fbbf24' : '#34d399'};font-weight:700;">${formatINR(bal)}</td>
                <td><span class="badge ${u.status === 'pending' ? 'amber' : 'emerald'}">${u.status === 'pending' ? '⏳ Pending' : '✅ Cleared'}</span></td>
                <td class="actions">
                  ${u.status === 'pending' ? `<button class="btn wa sm" data-wa="${u.id}" title="WhatsApp">💬</button><button class="btn success sm" data-settle="${u.id}" title="Settle">💵</button>` : ''}
                  <button class="btn ghost sm" data-dup-ud="${u.id}" title="Duplicate">📋</button>
                  <button class="btn ghost sm" data-edit-ud="${u.id}" title="Edit">✏️</button>
                  <button class="btn ghost sm" data-copy="${u.id}" title="Copy message">📄</button>
                  <button class="btn danger sm" data-del-ud="${u.id}" title="Delete">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openUdhaarModal(existing, duplicate = false) {
  const isEdit = !!existing && !duplicate;
  const u = existing ? { ...existing } : { name: '', phone: '', work: '', total: 0, paid: 0 };
  if (duplicate) u.paid = 0;
  openModal({
    title: isEdit ? '✏️ Edit Udhaar' : duplicate ? '📋 Duplicate Udhaar' : '＋ Add Udhaar Entry',
    bodyHTML: `
      <form id="udForm">
        <div class="form-grid">
          <div class="field"><label>Customer Name *</label><input name="name" required value="${esc(u.name)}" list="customerNames2" /><datalist id="customerNames2">${allCustomers().map(c => `<option value="${esc(c.name)}">`).join('')}</datalist></div>
          <div class="field"><label>Mobile Number *</label><input name="phone" required pattern="\\d{10}" maxlength="10" value="${esc(u.phone)}" inputmode="numeric" /></div>
          <div class="field full"><label>Work / Service Description *</label><input name="work" required value="${esc(u.work)}" /></div>
          <div class="field"><label>Total Bill Amount ₹ *</label><input name="total" type="number" min="0" required value="${u.total}" /></div>
          <div class="field"><label>Amount Paid / Advance ₹</label><input name="paid" type="number" min="0" value="${u.paid}" /></div>
        </div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit" form="udForm">${isEdit ? 'Update' : 'Save'}</button>`,
    onSubmit: form => {
      const data = Object.fromEntries(new FormData(form));
      data.total = Number(data.total) || 0;
      data.paid = Number(data.paid) || 0;
      data.status = data.paid >= data.total ? 'cleared' : 'pending';
      if (isEdit) {
        Store.set('udhaar', Store.get('udhaar', []).map(x => x.id === existing.id ? { ...x, ...data } : x));
        toast('Udhaar updated', 'emerald');
      } else {
        const list = Store.get('udhaar', []);
        list.unshift({ id: uid(), date: todayISO(), ...data });
        Store.set('udhaar', list);
        toast(duplicate ? 'Duplicated' : 'Udhaar added', 'amber');
      }
      Sync.markDirty('udhaar');
      closeModal(); render();
    }
  });
}

function settleUdhaar(id) {
  const u = Store.get('udhaar', []).find(x => x.id === id);
  if (!u) return;
  const bal = u.total - u.paid;
  openModal({
    title: '💰 Settle Payment',
    bodyHTML: `
      <form id="settleForm">
        <p style="margin-bottom:16px;color:var(--text-dim);font-size:13.5px;"><strong style="color:var(--text);">${esc(u.name)}</strong> — Balance: <strong style="color:#fbbf24;font-family:'JetBrains Mono',monospace;font-size:15px;">${formatINR(bal)}</strong></p>
        <div class="field"><label>Amount Receiving ₹</label><input name="amount" type="number" min="0" max="${bal}" step="0.01" value="${bal}" required /></div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn success" type="submit" form="settleForm">💵 Receive Payment</button>`,
    onSubmit: form => {
      const amt = Number(new FormData(form).get('amount')) || 0;
      Store.set('udhaar', Store.get('udhaar', []).map(x => {
        if (x.id !== id) return x;
        const np = x.paid + amt;
        return { ...x, paid: np, status: np >= x.total ? 'cleared' : 'pending' };
      }));
      toast(`${formatINR(amt)} received 🎉`, 'emerald');
      Sync.markDirty('udhaar');
      closeModal(); render(); Sound.pay();
      Confetti.burst(window.innerWidth - 100, window.innerHeight - 100);
    }
  });
}

function sendWhatsApp(id) {
  const u = Store.get('udhaar', []).find(x => x.id === id);
  if (!u) return;
  const st = getSettings(), bal = u.total - u.paid;
  const msg = st.whatsappTemplate.replace(/{name}/g, u.name).replace(/{shop}/g, st.shopName).replace(/{work}/g, u.work).replace(/{amount}/g, formatNum(bal)).replace(/{owner}/g, st.ownerName);
  const phone = u.phone.replace(/\D/g, '');
  window.open(`https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`, '_blank');
  toast('WhatsApp opening...', 'emerald');
}

function copyReminder(id) {
  const u = Store.get('udhaar', []).find(x => x.id === id);
  if (!u) return;
  const st = getSettings(), bal = u.total - u.paid;
  const msg = st.whatsappTemplate.replace(/{name}/g, u.name).replace(/{shop}/g, st.shopName).replace(/{work}/g, u.work).replace(/{amount}/g, formatNum(bal)).replace(/{owner}/g, st.ownerName);
  navigator.clipboard.writeText(msg).then(() => toast('Message copied! 📋', 'cyan'));
}

function bulkWhatsApp() {
  const pending = Store.get('udhaar', []).filter(u => u.status === 'pending');
  if (!pending.length) return toast('No pending customers', 'amber');
  confirmDialog('💬 Send Bulk Reminders?', `This will open ${pending.length} WhatsApp tabs. Allow pop-ups.`, () => {
    pending.forEach((u, i) => setTimeout(() => sendWhatsApp(u.id), i * 400));
  });
}

/* ============================ PAGE: EXPENSES ============================ */
function PageExpenses() {
  const list = Store.get('expenses', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const monthList = list.filter(e => isThisMonth(e.date));
  const shopTotal = monthList.filter(e => e.type === 'shop').reduce((a, e) => a + e.amount, 0);
  const personalTotal = monthList.filter(e => e.type === 'personal').reduce((a, e) => a + e.amount, 0);
  return `
    <div class="grid grid-3" style="margin-bottom:18px;">
      ${kpiCard('cyan', '🏪', 'Shop Expenses (Month)', shopTotal, `${monthList.filter(e => e.type === 'shop').length} entries`, true)}
      ${kpiCard('amber', '👤', 'Personal (Month)', personalTotal, `${monthList.filter(e => e.type === 'personal').length} entries`, true)}
      ${kpiCard('rose', '💸', 'Total Month', shopTotal + personalTotal, 'Shop + Personal', true)}
    </div>
    <div class="toolbar">
      <input type="search" id="exSearch" placeholder="🔍 Search expenses..." />
      <select id="exFilter">
        <option value="month" selected>This Month</option>
        <option value="all">All Time</option>
        <option value="shop">Shop Only</option>
        <option value="personal">Personal Only</option>
      </select>
      <button class="btn ghost" id="exportExCsv">📥 CSV</button>
      <button class="btn primary" id="addExpenseBtn">＋ Add Expense</button>
    </div>
    <div class="bulk-bar" id="exBulkBar">
      <span class="count" id="exBulkCount">0 selected</span>
      <span class="spacer"></span>
      <button class="btn danger sm" id="exBulkDelete">🗑️ Delete Selected</button>
      <button class="btn ghost sm" id="exBulkClear">Clear</button>
    </div>
    <div id="exTableWrap">${renderExpensesTable(list)}</div>
  `;
}

function renderExpensesTable(list) {
  if (!list.length) return `<div class="empty card"><div class="icon">💸</div><p>No expenses recorded</p></div>`;
  const total = list.reduce((a, e) => a + e.amount, 0);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:32px;"><input type="checkbox" class="checkbox" id="exSelectAll" /></th>
          <th>Date</th><th>Category</th><th>Description</th><th>Type</th><th>Mode</th><th class="num">Amount</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${list.map(e => `
            <tr data-row-id="${e.id}">
              <td><input type="checkbox" class="checkbox row-check" data-check-id="${e.id}" /></td>
              <td style="font-size:12px;color:var(--text-mute);">${formatDate(e.date)}</td>
              <td><span class="badge violet">${esc(e.category)}</span></td>
              <td>${esc(e.desc)}</td>
              <td><span class="badge ${e.type === 'shop' ? 'cyan' : 'amber'}">${e.type === 'shop' ? '🏪 Shop' : '👤 Personal'}</span></td>
              <td>${esc(e.mode)}</td>
              <td class="num" style="color:#f87171;font-weight:700;">${formatINR(e.amount)}</td>
              <td class="actions">
                <button class="btn ghost sm" data-dup-ex="${e.id}" title="Duplicate">📋</button>
                <button class="btn ghost sm" data-edit-ex="${e.id}" title="Edit">✏️</button>
                <button class="btn danger sm" data-del-ex="${e.id}" title="Delete">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg-2);">
            <td colspan="6" style="text-align:right;font-weight:700;">TOTAL (${list.length} entries)</td>
            <td class="num" style="color:#f87171;font-weight:800;font-size:15px;">${formatINR(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function openExpenseModal(existing, duplicate = false) {
  const isEdit = !!existing && !duplicate;
  const e = existing ? { ...existing } : { category: 'Food & Tea', type: 'shop', desc: '', amount: 0, mode: 'Cash' };
  openModal({
    title: isEdit ? '✏️ Edit Expense' : duplicate ? '📋 Duplicate Expense' : '＋ Add Expense',
    bodyHTML: `
      <form id="exForm">
        <div class="form-grid">
          <div class="field"><label>Category *</label><select name="category" required>${EXPENSE_CATEGORIES.map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field"><label>Type *</label><select name="type" required><option value="shop" ${e.type === 'shop' ? 'selected' : ''}>Shop Expense</option><option value="personal" ${e.type === 'personal' ? 'selected' : ''}>Personal</option></select></div>
          <div class="field full"><label>Description *</label><input name="desc" required value="${esc(e.desc)}" placeholder="e.g. A4 Ream 500 sheets" /></div>
          <div class="field"><label>Amount ₹ *</label><input name="amount" type="number" min="0" step="0.01" required value="${e.amount}" /></div>
          <div class="field"><label>Payment Mode</label><select name="mode">${['Cash','UPI','Card'].map(m => `<option ${m === e.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        </div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit" form="exForm">${isEdit ? 'Update' : 'Save'} Expense</button>`,
    onSubmit: form => {
      const data = Object.fromEntries(new FormData(form));
      data.amount = Number(data.amount) || 0;
      if (isEdit) {
        Store.set('expenses', Store.get('expenses', []).map(x => x.id === existing.id ? { ...x, ...data } : x));
        toast('Expense updated', 'emerald');
      } else {
        const list = Store.get('expenses', []);
        list.unshift({ id: uid(), date: todayISO(), ...data });
        Store.set('expenses', list);
        toast(duplicate ? 'Duplicated' : 'Expense added', 'rose');
      }
      Sync.markDirty('expenses');
      closeModal(); render();
    }
  });
}

/* ============================ PAGE: SUMMARY ============================ */
function PageSummary() {
  let year = Number(localStorage.getItem('ccm_summaryYear') || 2026);
  if (!YEAR_RANGE.includes(year)) year = 2026;
  const commissions = Store.get('commissions', {});
  const yearComm = commissions[year] || {};
  let grand = { serviceNet: 0, udhaarCol: 0, gross: 0, comm: 0, exp: 0, net: 0 };
  const rows = MONTHS.map((m, i) => {
    const serviceNet = Calc.monthServiceProfit(year, i);
    const udhaarCol = Calc.monthUdhaarCollected(year, i);
    const gross = serviceNet + udhaarCol;
    const comm = Number(yearComm[i]) || 0;
    const exp = Calc.monthExpenses(year, i);
    const net = gross + comm - exp;
    grand.serviceNet += serviceNet; grand.udhaarCol += udhaarCol;
    grand.gross += gross; grand.comm += comm; grand.exp += exp; grand.net += net;
    return { m, i, serviceNet, udhaarCol, gross, comm, exp, net };
  });

  return `
    <div class="toolbar" style="justify-content:space-between;">
      <div style="display:flex;gap:10px;align-items:center;">
        <label style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Year:</label>
        <select id="summaryYear">${YEAR_RANGE.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </div>
      <button class="btn primary" id="printSummaryBtn">🖨️ Print P&L Statement</button>
    </div>

    <div class="table-wrap">
      <table style="min-width:1100px;">
        <thead>
          <tr>
            <th>Month</th><th class="num">Service Net</th><th class="num">Udhaar Collected</th>
            <th class="num">Gross Profit</th><th class="num">Commission</th>
            <th class="num">Expenses</th><th class="num">Net Savings</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${r.m}</strong></td>
              <td class="num" style="color:#a78bfa;">${formatINR(r.serviceNet)}</td>
              <td class="num" style="color:#34d399;">${formatINR(r.udhaarCol)}</td>
              <td class="num" style="font-weight:700;">${formatINR(r.gross)}</td>
              <td class="num">
                <input type="number" min="0" step="100" value="${r.comm}" data-comm-month="${r.i}" data-comm-year="${year}"
                  style="width:100%;background:var(--bg-0);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:12.5px;text-align:right;" />
              </td>
              <td class="num" style="color:#f87171;">${formatINR(r.exp)}</td>
              <td class="num" style="color:${r.net >= 0 ? '#34d399' : '#f87171'};font-weight:800;">${formatINR(r.net)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td style="font-weight:800;">GRAND TOTAL</td>
            <td class="num">${formatINR(grand.serviceNet)}</td>
            <td class="num">${formatINR(grand.udhaarCol)}</td>
            <td class="num">${formatINR(grand.gross)}</td>
            <td class="num">${formatINR(grand.comm)}</td>
            <td class="num">${formatINR(grand.exp)}</td>
            <td class="num" style="color:${grand.net >= 0 ? '#34d399' : '#f87171'};font-weight:800;">${formatINR(grand.net)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="grid grid-3 mt-22">
      ${kpiCard('violet', '💼', `Gross Profit ${year}`, grand.gross, 'Services + Udhaar', true)}
      ${kpiCard('rose', '💸', `Total Expenses ${year}`, grand.exp, 'All categories', true)}
      ${kpiCard(grand.net >= 0 ? 'emerald' : 'rose', '📈', `Net Savings ${year}`, grand.net, grand.net >= 0 ? 'Profitable year 🎉' : 'Loss year', true)}
    </div>
  `;
}

function printPL() {
  let year = Number(localStorage.getItem('ccm_summaryYear') || 2026);
  if (!YEAR_RANGE.includes(year)) year = 2026;
  const commissions = Store.get('commissions', {});
  const yearComm = commissions[year] || {};
  let grand = { serviceNet: 0, udhaarCol: 0, gross: 0, comm: 0, exp: 0, net: 0 };
  const rows = MONTHS.map((m, i) => {
    const serviceNet = Calc.monthServiceProfit(year, i);
    const udhaarCol = Calc.monthUdhaarCollected(year, i);
    const gross = serviceNet + udhaarCol;
    const comm = Number(yearComm[i]) || 0;
    const exp = Calc.monthExpenses(year, i);
    const net = gross + comm - exp;
    grand.serviceNet += serviceNet; grand.udhaarCol += udhaarCol;
    grand.gross += gross; grand.comm += comm; grand.exp += exp; grand.net += net;
    return { m, serviceNet, udhaarCol, gross, comm, exp, net };
  });
  const st = getSettings();
  const w = window.open('', '_blank', 'width=900,height=1000');
  w.document.write(`
    <!DOCTYPE html><html><head><title>P&L Statement ${year}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 24px; font-size: 12px; }
      .header { text-align: center; padding-bottom: 16px; border-bottom: 3px double #333; margin-bottom: 20px; }
      .header h1 { font-size: 20px; letter-spacing: 3px; font-weight: 900; margin-bottom: 6px; }
      .header p { font-size: 11.5px; color: #555; margin: 2px 0; }
      .header .doc-title { display: inline-block; background: #111; color: #fff; padding: 5px 16px; font-size: 12px; letter-spacing: 2px; font-weight: 700; margin-top: 12px; border-radius: 3px; }
      .info-bar { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 14px; padding: 10px 14px; background: #f5f5f7; border-radius: 5px; }
      table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      th { background: #1a1a2e; color: #fff; text-align: left; padding: 10px 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      th.num { text-align: right; }
      td { padding: 9px 8px; border-bottom: 1px solid #e0e0e6; }
      td.num { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
      tr:nth-child(even) td { background: #fafafc; }
      tr.total td { background: #1a1a2e !important; color: #fff !important; font-weight: 900; padding: 12px 8px; font-size: 12.5px; border: none; }
      .positive { color: #059669; }
      .negative { color: #dc2626; }
      .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; }
      .sign-box { text-align: center; }
      .sign-line { border-top: 1px solid #333; width: 180px; padding-top: 6px; margin-top: 50px; font-weight: 600; }
      .stamp { text-align: right; font-size: 10.5px; color: #666; }
      .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 100px; font-weight: 900; color: rgba(0,0,0,0.03); z-index: -1; letter-spacing: 10px; }
      @media print { body { padding: 12px; } @page { size: A4; margin: 12mm; } }
    </style></head><body>
      <div class="watermark">${esc(st.shopName.split(' ')[0] || 'SEVA')}</div>
      <div class="header">
        <h1>${esc(st.shopName).toUpperCase()}</h1>
        <p>${esc(st.address)}</p>
        <p>Ph: ${esc(st.phone)} &nbsp;·&nbsp; GST/CSC: ${esc(st.gst)}</p>
        <div class="doc-title">PROFIT & LOSS STATEMENT — ${year}</div>
      </div>
      <div class="info-bar">
        <span><strong>Statement Period:</strong> Jan ${year} – Dec ${year}</span>
        <span><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</span>
      </div>
      <table>
        <thead><tr>
          <th>Month</th><th class="num">Service Net</th><th class="num">Udhaar Collected</th>
          <th class="num">Gross Profit</th><th class="num">Commission</th>
          <th class="num">Expenses</th><th class="num">Net Savings</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${r.m}</strong></td>
              <td class="num">Rs.${formatNum(r.serviceNet)}</td>
              <td class="num">Rs.${formatNum(r.udhaarCol)}</td>
              <td class="num">Rs.${formatNum(r.gross)}</td>
              <td class="num">Rs.${formatNum(r.comm)}</td>
              <td class="num negative">Rs.${formatNum(r.exp)}</td>
              <td class="num ${r.net >= 0 ? 'positive' : 'negative'}"><strong>Rs.${formatNum(r.net)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total">
            <td>GRAND TOTAL</td>
            <td class="num">Rs.${formatNum(grand.serviceNet)}</td>
            <td class="num">Rs.${formatNum(grand.udhaarCol)}</td>
            <td class="num">Rs.${formatNum(grand.gross)}</td>
            <td class="num">Rs.${formatNum(grand.comm)}</td>
            <td class="num">Rs.${formatNum(grand.exp)}</td>
            <td class="num">Rs.${formatNum(grand.net)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer">
        <div class="sign-box"><div class="sign-line">Accountant / Auditor</div></div>
        <div class="sign-box"><div class="sign-line">${esc(st.ownerName)} — Proprietor</div></div>
      </div>
      <div class="stamp">Generated by Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
    </body></html>
  `);
  w.document.close();
}

/* ============================ PAGE: LOANS ============================ */
function PageLoans() {
  const list = Store.get('loans', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const outstanding = list.filter(l => l.status === 'active').reduce((a, l) => a + (l.total - l.paid), 0);
  const taken = list.reduce((a, l) => a + l.total, 0);
  const paid = list.reduce((a, l) => a + l.paid, 0);
  return `
    <div class="grid grid-3" style="margin-bottom:18px;">
      ${kpiCard('violet', '🏦', 'Total Borrowed', taken, 'All-time loans', true)}
      ${kpiCard('emerald', '✅', 'Total Repaid', paid, 'Paid back', true)}
      ${kpiCard('amber', '⏳', 'Outstanding', outstanding, 'Still to pay', true)}
    </div>
    <div class="toolbar">
      <input type="search" id="loanSearch" placeholder="🔍 Search lender..." />
      <button class="btn ghost" id="exportLoanCsv">📥 CSV</button>
      <button class="btn primary" id="addLoanBtn">＋ Add Loan</button>
    </div>
    <div class="bulk-bar" id="loanBulkBar">
      <span class="count" id="loanBulkCount">0 selected</span>
      <span class="spacer"></span>
      <button class="btn danger sm" id="loanBulkDelete">🗑️ Delete Selected</button>
      <button class="btn ghost sm" id="loanBulkClear">Clear</button>
    </div>
    <div id="loanTableWrap">${renderLoansTable(list)}</div>
  `;
}

function renderLoansTable(list) {
  if (!list.length) return `<div class="empty card"><div class="icon">🏦</div><p>No loans tracked</p></div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th style="width:32px;"><input type="checkbox" class="checkbox" id="loanSelectAll" /></th>
          <th>Date</th><th>Person / Bank</th><th>Description</th>
          <th class="num">Taken</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${list.map(l => {
            const bal = l.total - l.paid;
            return `
              <tr data-row-id="${l.id}">
                <td><input type="checkbox" class="checkbox row-check" data-check-id="${l.id}" /></td>
                <td style="font-size:12px;color:var(--text-mute);">${formatDate(l.date)}</td>
                <td><strong>${esc(l.name)}</strong>${l.remarks ? `<br><span style="font-size:11px;color:var(--text-mute);">${esc(l.remarks)}</span>` : ''}</td>
                <td>${esc(l.desc)}</td>
                <td class="num">${formatINR(l.total)}</td>
                <td class="num" style="color:#34d399;">${formatINR(l.paid)}</td>
                <td class="num" style="color:${bal > 0 ? '#fbbf24' : '#34d399'};font-weight:700;">${formatINR(bal)}</td>
                <td><span class="badge ${l.status === 'active' ? 'amber' : 'emerald'}">${l.status === 'active' ? '⏳ Active' : '✅ Settled'}</span></td>
                <td class="actions">
                  ${l.status === 'active' ? `<button class="btn success sm" data-pay-loan="${l.id}" title="Pay">💵</button>` : ''}
                  <button class="btn ghost sm" data-edit-loan="${l.id}" title="Edit">✏️</button>
                  <button class="btn danger sm" data-del-loan="${l.id}" title="Delete">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openLoanModal(existing) {
  const isEdit = !!existing;
  const l = existing || { name: '', desc: '', total: 0, paid: 0, remarks: '' };
  openModal({
    title: isEdit ? '✏️ Edit Loan' : '＋ Add Loan',
    bodyHTML: `
      <form id="loanForm">
        <div class="form-grid">
          <div class="field"><label>Person / Bank Name *</label><input name="name" required value="${esc(l.name)}" /></div>
          <div class="field"><label>Description *</label><input name="desc" required value="${esc(l.desc)}" /></div>
          <div class="field"><label>Amount Taken ₹ *</label><input name="total" type="number" min="0" required value="${l.total}" /></div>
          <div class="field"><label>Amount Already Paid ₹</label><input name="paid" type="number" min="0" value="${l.paid}" /></div>
          <div class="field full"><label>Remarks</label><input name="remarks" value="${esc(l.remarks || '')}" /></div>
        </div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit" form="loanForm">${isEdit ? 'Update' : 'Save'} Loan</button>`,
    onSubmit: form => {
      const data = Object.fromEntries(new FormData(form));
      data.total = Number(data.total) || 0;
      data.paid = Number(data.paid) || 0;
      data.status = data.paid >= data.total ? 'settled' : 'active';
      if (isEdit) {
        Store.set('loans', Store.get('loans', []).map(x => x.id === existing.id ? { ...x, ...data } : x));
        toast('Loan updated', 'emerald');
      } else {
        const list = Store.get('loans', []);
        list.unshift({ id: uid(), date: todayISO(), ...data });
        Store.set('loans', list);
        toast('Loan added', 'emerald');
      }
      Sync.markDirty('loans');
      closeModal(); render();
    }
  });
}

function payLoan(id) {
  const l = Store.get('loans', []).find(x => x.id === id);
  if (!l) return;
  const bal = l.total - l.paid;
  openModal({
    title: '💵 Pay Loan Installment',
    bodyHTML: `
      <form id="payLoanForm">
        <p style="margin-bottom:16px;color:var(--text-dim);font-size:13.5px;"><strong style="color:var(--text);">${esc(l.name)}</strong> — Remaining: <strong style="color:#fbbf24;font-family:'JetBrains Mono',monospace;font-size:15px;">${formatINR(bal)}</strong></p>
        <div class="field"><label>Amount Paying ₹</label><input name="amount" type="number" min="0" max="${bal}" step="0.01" value="${bal}" required /></div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn success" type="submit" form="payLoanForm">Confirm Payment</button>`,
    onSubmit: form => {
      const amt = Number(new FormData(form).get('amount')) || 0;
      Store.set('loans', Store.get('loans', []).map(x => {
        if (x.id !== id) return x;
        const np = x.paid + amt;
        return { ...x, paid: np, status: np >= x.total ? 'settled' : 'active' };
      }));
      toast(`Paid ${formatINR(amt)}`, 'emerald');
      Sync.markDirty('loans');
      closeModal(); render(); Sound.pay();
    }
  });
}

/* ============================ PAGE: INVENTORY ============================ */
function PageInventory() {
  const list = Store.get('inventory', []);
  const totalValue = list.reduce((a, i) => a + (i.cost || 0), 0);
  const active = list.filter(i => i.status === 'Active').length;
  const repair = list.filter(i => i.status === 'Under Repair').length;
  return `
    <div class="grid grid-4" style="margin-bottom:18px;">
      ${kpiCard('violet', '📦', 'Total Items', list.length, 'All inventory', false)}
      ${kpiCard('emerald', '✅', 'Active', active, 'Working fine', false)}
      ${kpiCard('amber', '🔧', 'Under Repair', repair, 'Needs attention', false)}
      ${kpiCard('cyan', '💎', 'Total Value', totalValue, 'Purchase cost', true)}
    </div>
    <div class="toolbar">
      <input type="search" id="invSearch" placeholder="🔍 Search item, serial..." />
      <button class="btn primary" id="addInvBtn">＋ Add Asset</button>
    </div>
    <div id="invTableWrap">${renderInventoryTable(list)}</div>
  `;
}

function renderInventoryTable(list) {
  if (!list.length) return `<div class="empty card"><div class="icon">📦</div><p>No inventory items</p></div>`;
  const badge = s => ({ 'Active': 'emerald', 'Under Repair': 'amber', 'Damaged': 'rose', 'Disposed': 'violet' }[s] || 'violet');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>S.No</th><th>Item Name</th><th>Category</th><th>Serial No.</th><th>Purchase</th><th>Warranty</th><th class="num">Cost</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${list.map((i, idx) => `
            <tr>
              <td style="color:var(--text-mute);">${idx + 1}</td>
              <td><strong>${esc(i.name)}</strong></td>
              <td><span class="badge cyan">${esc(i.category)}</span></td>
              <td class="mono" style="font-size:12px;">${esc(i.serial || '—')}</td>
              <td style="font-size:12px;color:var(--text-mute);">${formatDate(i.purchase)}</td>
              <td style="font-size:12px;color:var(--text-mute);">${i.warranty ? formatDate(i.warranty) : '—'}</td>
              <td class="num">${formatINR(i.cost)}</td>
              <td><span class="badge ${badge(i.status)}">${esc(i.status)}</span></td>
              <td class="actions">
                <button class="btn ghost sm" data-edit-inv="${i.id}">✏️</button>
                <button class="btn danger sm" data-del-inv="${i.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openInventoryModal(existing) {
  const isEdit = !!existing;
  const i = existing || { name: '', category: 'Printer', serial: '', purchase: todayISO(), warranty: '', cost: 0, status: 'Active' };
  const dv = iso => iso ? new Date(iso).toISOString().split('T')[0] : '';
  openModal({
    title: isEdit ? '✏️ Edit Asset' : '＋ Add Inventory Item',
    bodyHTML: `
      <form id="invForm">
        <div class="form-grid">
          <div class="field full"><label>Item Name *</label><input name="name" required value="${esc(i.name)}" /></div>
          <div class="field"><label>Category *</label><select name="category" required>${['Printer','Desktop PC','Laptop','Lamination','Biometric','Power Backup','Furniture','Scanner','Webcam','Router','Other'].map(c => `<option ${c === i.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field"><label>Serial Number</label><input name="serial" value="${esc(i.serial || '')}" /></div>
          <div class="field"><label>Purchase Date</label><input name="purchase" type="date" value="${dv(i.purchase)}" /></div>
          <div class="field"><label>Warranty Expiry</label><input name="warranty" type="date" value="${dv(i.warranty)}" /></div>
          <div class="field"><label>Cost Price ₹</label><input name="cost" type="number" min="0" step="0.01" value="${i.cost}" /></div>
          <div class="field"><label>Status</label><select name="status">${['Active','Under Repair','Damaged','Disposed'].map(s => `<option ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        </div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit" form="invForm">${isEdit ? 'Update' : 'Save'}</button>`,
    onSubmit: form => {
      const data = Object.fromEntries(new FormData(form));
      data.cost = Number(data.cost) || 0;
      if (!data.purchase) data.purchase = todayISO();
      if (isEdit) {
        Store.set('inventory', Store.get('inventory', []).map(x => x.id === existing.id ? { ...x, ...data } : x));
        toast('Asset updated', 'emerald');
      } else {
        const list = Store.get('inventory', []);
        list.push({ id: uid(), ...data });
        Store.set('inventory', list);
        toast('Asset added', 'emerald');
      }
      Sync.markDirty('inventory');
      closeModal(); render();
    }
  });
}

/* ============================ PAGE: RATE CARD ============================ */
function PageRateCard() {
  const rates = Store.get('rates', DEFAULT_RATES);
  const grouped = {};
  rates.forEach(r => { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r); });
  const catColors = { CSC: 'violet', Printing: 'cyan', Online: 'emerald', Photo: 'rose', Cyber: 'amber', Typing: 'violet' };

  return `
    <div class="notice info">
      <span style="font-size:18px;">🏷️</span>
      <span style="flex:1;"><strong>Portal Fees</strong> aur <strong>Service Charge</strong> dono edit kar sakte ho. Total automatic calculate hoga.</span>
      <button class="btn ghost sm" id="addRateBtn">＋ Add Item</button>
      <button class="btn ghost sm" id="resetRatesBtn">↺ Reset Defaults</button>
    </div>
    <div class="grid grid-2">
      ${Object.entries(grouped).map(([cat, items]) => `
        <div class="card">
          <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:10px;">
            <span class="badge ${catColors[cat] || 'violet'}" style="font-size:12px;padding:5px 13px;">${esc(cat)}</span>
            <span style="font-size:12px;color:var(--text-mute);font-weight:500;">${items.length} services</span>
          </h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${items.map(it => {
              const portal = Number(it.portalFees) || 0;
              const charge = Number(it.serviceCharge) || 0;
              const total = portal + charge;
              return `
                <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg-2);border-radius:9px;border:1px solid var(--border);flex-wrap:wrap;">
                  <span style="font-size:13px;flex:1;min-width:120px;line-height:1.3;">${esc(it.name)}</span>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                    <span style="font-size:9px;color:#f87171;text-transform:uppercase;font-weight:800;letter-spacing:.05em;">PORTAL ₹</span>
                    <input type="number" min="0" step="1" value="${portal}" data-rate-portal="${it.id}" title="Portal / Govt Fees"
                      style="width:62px;background:var(--bg-0);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:#f87171;font-family:'JetBrains Mono',monospace;font-size:12.5px;font-weight:700;text-align:right;" />
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                    <span style="font-size:9px;color:#34d399;text-transform:uppercase;font-weight:800;letter-spacing:.05em;">CHARGE ₹</span>
                    <input type="number" min="0" step="1" value="${charge}" data-rate-charge="${it.id}" title="Service Charge"
                      style="width:62px;background:var(--bg-0);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:#34d399;font-family:'JetBrains Mono',monospace;font-size:12.5px;font-weight:700;text-align:right;" />
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                    <span style="font-size:9px;color:#a78bfa;text-transform:uppercase;font-weight:800;letter-spacing:.05em;">TOTAL</span>
                    <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;padding:5px 8px;color:#a78bfa;min-width:58px;text-align:right;background:var(--bg-0);border-radius:6px;border:1px dashed rgba(168,85,247,0.4);">₹${total}</span>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:4px;">
                    <button class="btn ghost sm" data-rate-edit="${it.id}" style="padding:4px 8px;" title="Edit">✏️</button>
                    <button class="btn danger sm" data-rate-del="${it.id}" style="padding:4px 8px;" title="Delete">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openRateEditModal(existing) {
  const isEdit = !!existing;
  const r = existing ? { ...existing } : { name: '', portalFees: 0, serviceCharge: 0, category: 'CSC' };
  const cats = ['CSC', 'Printing', 'Online', 'Photo', 'Cyber', 'Typing', 'Other'];
  openModal({
    title: isEdit ? '✏️ Edit Rate Item' : '＋ Add Rate Item',
    bodyHTML: `
      <form id="rateForm">
        <div class="form-grid">
          <div class="field full"><label>Service Name *</label><input name="name" required value="${esc(r.name)}" /></div>
          <div class="field"><label>Portal / Govt Fees ₹ *</label><input name="portalFees" type="number" min="0" step="1" required value="${r.portalFees || 0}" /></div>
          <div class="field"><label>Service Charge ₹ *</label><input name="serviceCharge" type="number" min="0" step="1" required value="${r.serviceCharge || 0}" /></div>
          <div class="field full"><label>Category *</label><select name="category">${cats.map(c => `<option ${c === r.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field full" style="padding:12px;background:var(--bg-2);border-radius:9px;border:1px dashed rgba(168,85,247,0.4);text-align:center;">
            <span style="font-size:10px;color:var(--text-mute);text-transform:uppercase;font-weight:800;letter-spacing:.08em;">Customer Total (auto)</span>
            <div class="mono" style="font-size:22px;font-weight:800;color:#a78bfa;margin-top:4px;" id="rateTotalDisplay">₹${(Number(r.portalFees) || 0) + (Number(r.serviceCharge) || 0)}</div>
          </div>
        </div>
      </form>
    `,
    footerHTML: `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit" form="rateForm">${isEdit ? 'Update' : 'Add'}</button>`,
    onSubmit: form => {
      const data = Object.fromEntries(new FormData(form));
      data.portalFees = Number(data.portalFees) || 0;
      data.serviceCharge = Number(data.serviceCharge) || 0;
      const rates = Store.get('rates', DEFAULT_RATES);
      if (isEdit) {
        Store.set('rates', rates.map(x => x.id === existing.id ? { ...x, ...data } : x));
        toast('Rate updated', 'emerald');
      } else {
        rates.push({ id: uid(), ...data });
        Store.set('rates', rates);
        toast('Rate added', 'emerald');
      }
      Sync.markDirty('rates');
      closeModal(); render();
    }
  });

  setTimeout(() => {
    const f = document.getElementById('rateForm');
    if (!f) return;
    const pf = f.querySelector('[name="portalFees"]');
    const sc = f.querySelector('[name="serviceCharge"]');
    const disp = document.getElementById('rateTotalDisplay');
    const update = () => {
      const total = (Number(pf.value) || 0) + (Number(sc.value) || 0);
      if (disp) disp.textContent = '₹' + total;
    };
    if (pf) pf.oninput = update;
    if (sc) sc.oninput = update;
  }, 100);
}

/* ============================ PAGE: SETTINGS ============================ */
function PageSettings() {
  const s = getSettings();
  const target = Store.get('target', { amount: 2000 });
    const hasPassword = Auth.hasPassword();
  const lastBackup = Store.raw('lastBackup');
  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - Number(lastBackup)) / 86400000) : null;
  const themeMode = getThemeMode();

  return `
    <div class="grid grid-2">
      <div class="card">
        <h3 style="margin-bottom:16px;font-size:16px;font-weight:700;">⚙️ Shop Profile</h3>
        <form id="settingsForm">
          <div class="form-grid">
            <div class="field full"><label>Shop Name</label><input name="shopName" value="${esc(s.shopName)}" /></div>
            <div class="field"><label>Owner Name</label><input name="ownerName" value="${esc(s.ownerName)}" /></div>
            <div class="field"><label>Contact Phone</label><input name="phone" value="${esc(s.phone)}" maxlength="10" inputmode="numeric" /></div>
            <div class="field full"><label>Address</label><input name="address" value="${esc(s.address)}" /></div>
            <div class="field"><label>GST / CSC ID</label><input name="gst" value="${esc(s.gst)}" /></div>
            <div class="field full">
              <label>WhatsApp Reminder Template</label>
              <textarea name="whatsappTemplate" rows="5">${esc(s.whatsappTemplate)}</textarea>
              <small style="color:var(--text-mute);font-size:11px;margin-top:4px;">Placeholders: <code>{name}</code> <code>{shop}</code> <code>{work}</code> <code>{amount}</code> <code>{owner}</code></small>
            </div>
          </div>
          <div style="margin-top:20px;">
            <button class="btn primary" type="submit">💾 Save Settings</button>
          </div>
        </form>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card" style="border-color:rgba(99,102,241,0.5);background:linear-gradient(135deg,rgba(99,102,241,0.08),transparent);">
          <h3 style="margin-bottom:14px;font-size:16px;font-weight:700;">🔄 Sync with Server</h3>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">Force reload ALL data from MongoDB Atlas — overwrites local cache.</p>
          <button class="btn primary" id="forceSyncBtn">🔄 Reload from Server</button>
          <div id="syncResult" style="margin-top:12px;font-size:12px;color:var(--text-mute);"></div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:14px;font-size:16px;font-weight:700;">🎯 Daily Net Profit Target</h3>
          <div class="field"><label>Today's Net Profit Target ₹</label><input type="number" id="targetInput" min="0" step="100" value="${target.amount}" /></div>
          <button class="btn primary" id="saveTargetBtn" style="margin-top:12px;">Set Target</button>
        </div>

        <div class="card">
          <h3 style="margin-bottom:14px;font-size:16px;font-weight:700;">🌓 Theme Mode</h3>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">Choose how the app looks. Auto switches between light and dark by time.</p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn ${themeMode === 'manual-dark' ? 'primary' : 'ghost'}" data-theme-mode="manual-dark" style="justify-content:flex-start;gap:12px;padding:12px 16px;">
              <span style="font-size:18px;">🌙</span>
              <span style="flex:1;text-align:left;">
                <span style="display:block;font-weight:700;">Manual — Always Dark</span>
                <span style="display:block;font-size:11px;opacity:.7;margin-top:2px;">Lock dark theme</span>
              </span>
              ${themeMode === 'manual-dark' ? '<span style="font-size:14px;">✓</span>' : ''}
            </button>
            <button class="btn ${themeMode === 'manual-light' ? 'primary' : 'ghost'}" data-theme-mode="manual-light" style="justify-content:flex-start;gap:12px;padding:12px 16px;">
              <span style="font-size:18px;">☀️</span>
              <span style="flex:1;text-align:left;">
                <span style="display:block;font-weight:700;">Manual — Always Light</span>
                <span style="display:block;font-size:11px;opacity:.7;margin-top:2px;">Lock light theme</span>
              </span>
              ${themeMode === 'manual-light' ? '<span style="font-size:14px;">✓</span>' : ''}
            </button>
            <button class="btn ${themeMode === 'auto' ? 'primary' : 'ghost'}" data-theme-mode="auto" style="justify-content:flex-start;gap:12px;padding:12px 16px;">
              <span style="font-size:18px;">🌓</span>
              <span style="flex:1;text-align:left;">
                <span style="display:block;font-weight:700;">Auto — By Time</span>
                <span style="display:block;font-size:11px;opacity:.7;margin-top:2px;">Light 7AM–7PM · Dark otherwise</span>
              </span>
              ${themeMode === 'auto' ? '<span style="font-size:14px;">✓</span>' : ''}
            </button>
          </div>
        </div>

                <div class="card" style="border-color:${hasPassword ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'};">
          <h3 style="margin-bottom:14px;font-size:16px;font-weight:700;">🔐 Password Security</h3>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">
            ${hasPassword
              ? '✅ Password protection is <strong style="color:#34d399;">active</strong>. Auto-locks after 15 min of inactivity.'
              : '⚠️ No password set. Anyone can open this app. Set a strong password to protect your business data.'}
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${hasPassword
              ? `<button class="btn primary" id="changePwdBtn">🔑 Change Password</button>
                 <button class="btn danger" id="removePwdBtn">🔓 Remove Password</button>
                 <button class="btn ghost" id="lockNowBtn">🔒 Lock Now</button>`
              : `<button class="btn primary" id="setPwdBtn">🔒 Set Password</button>`}
          </div>
        </div>

        <div class="card" style="${daysSinceBackup !== null && daysSinceBackup >= 7 ? 'border-color:rgba(239,68,68,0.4);' : daysSinceBackup !== null && daysSinceBackup < 7 ? 'border-color:rgba(16,185,129,0.4);' : ''}">
          <h3 style="margin-bottom:14px;font-size:16px;font-weight:700;">💾 Backup & Restore</h3>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">
            ${daysSinceBackup === null ? '⚠️ <strong>No backup yet!</strong> Download now.' : daysSinceBackup === 0 ? '✅ Last backup: Today' : `Last backup: ${daysSinceBackup} day${daysSinceBackup !== 1 ? 's' : ''} ago${daysSinceBackup >= 7 ? ' — <strong style="color:#f87171;">Backup recommended!</strong>' : ''}`}
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn primary" id="backupBtn">📥 Download Backup</button>
            <button class="btn ghost" id="restoreBtn">📤 Restore</button>
            <input type="file" id="restoreFile" accept=".json" style="display:none;" />
          </div>
        </div>

        <div class="card" style="border-color:rgba(239,68,68,0.3);">
          <h3 style="margin-bottom:14px;font-size:16px;font-weight:700;color:#f87171;">⚠️ Danger Zone</h3>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">Reset all local data. Server data is NOT affected — reload after to get server data.</p>
          <button class="btn danger" id="resetDataBtn">🗑️ Clear Local Cache</button>
        </div>
      </div>
    </div>
  `;
}

function downloadBackup() {
  const backup = {
    version: 6, exportedAt: new Date().toISOString(),
    data: {
      services: Store.get('services', []), udhaar: Store.get('udhaar', []),
      expenses: Store.get('expenses', []), loans: Store.get('loans', []),
      inventory: Store.get('inventory', []), settings: Store.get('settings', DEFAULT_SETTINGS),
      commissions: Store.get('commissions', {}), target: Store.get('target', null),
      rates: Store.get('rates', DEFAULT_RATES), notes: Store.get('notes', '')
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cybercafe-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
  URL.revokeObjectURL(url);
  Store.rawSet('lastBackup', Date.now().toString());
  toast('Backup downloaded ✅', 'emerald');
  Confetti.burst(window.innerWidth / 2, window.innerHeight / 2);
}

function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const b = JSON.parse(e.target.result);
      if (!b.data) throw new Error('Invalid');
      Object.entries(b.data).forEach(([k, v]) => { if (v != null && Store.keys[k]) Store.set(k, v); });
      migrateLocalRates();
      toast('Backup restored! 🎉', 'emerald');
      Sync.markDirty('services'); Sync.markDirty('udhaar'); Sync.markDirty('expenses');
      Sync.markDirty('loans'); Sync.markDirty('inventory'); Sync.markDirty('rates');
      Sync.markDirty('settings'); Sync.markDirty('commissions');
      Confetti.burst(window.innerWidth / 2, window.innerHeight / 2);
      render();
    } catch { toast('Invalid backup file', 'rose'); }
  };
  reader.readAsText(file);
}

/* ============================ CUSTOMER DRAWER ============================ */
function openCustomerDrawer(name, phone) {
  const services = Store.get('services', []).filter(s => s.phone === phone || s.name.toLowerCase() === name.toLowerCase());
  const udhaar = Store.get('udhaar', []).filter(u => u.phone === phone || u.name.toLowerCase() === name.toLowerCase());
  const totalSpent = services.reduce((a, s) => a + (s.collected || 0), 0);
  const totalNetProfit = services.reduce((a, s) => a + ((s.collected || 0) - (s.portalFees || 0)), 0);
  const balance = udhaar.reduce((a, u) => a + Math.max(0, u.total - u.paid), 0);

  document.getElementById('drawerTitle').innerHTML = `${esc(name)} ${renderTag(phone)}`;
  document.getElementById('drawerBody').innerHTML = `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:16px;padding:18px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:14px;">
        <div style="width:58px;height:58px;border-radius:50%;background:var(--grad-brand);display:grid;place-items:center;font-size:22px;font-weight:800;color:#fff;box-shadow:var(--glow-brand);">${esc(name.charAt(0).toUpperCase())}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:800;">${esc(name)}</div>
          <div style="font-size:13px;color:var(--text-dim);margin-top:3px;">📱 ${esc(phone)}</div>
        </div>
        <button class="btn wa sm" onclick="sendWhatsAppByPhone('${escJs(phone)}','${escJs(name)}')">💬</button>
      </div>
    </div>
    <div class="grid grid-3" style="gap:10px;margin-bottom:20px;">
      <div class="card" style="padding:14px;">
        <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;font-weight:700;letter-spacing:.08em;">Net Profit</div>
        <div class="mono" style="font-size:17px;font-weight:800;color:#34d399;margin-top:6px;">${formatINR(totalNetProfit)}</div>
      </div>
      <div class="card" style="padding:14px;">
        <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;font-weight:700;letter-spacing:.08em;">Visits</div>
        <div class="mono" style="font-size:17px;font-weight:800;color:#38bdf8;margin-top:6px;">${services.length}</div>
      </div>
      <div class="card" style="padding:14px;">
        <div style="font-size:10px;color:var(--text-mute);text-transform:uppercase;font-weight:700;letter-spacing:.08em;">Udhaar</div>
        <div class="mono" style="font-size:17px;font-weight:800;color:${balance > 0 ? '#fbbf24' : '#34d399'};margin-top:6px;">${formatINR(balance)}</div>
      </div>
    </div>
    <div style="font-size:12.5px;color:var(--text-dim);padding:10px 12px;background:var(--bg-2);border-radius:9px;margin-bottom:20px;">
      <strong>Total Spent:</strong> ${formatINR(totalSpent)} &nbsp;·&nbsp; <strong>Tag:</strong> ${getCustomerTag(phone) === 'vip' ? '⭐ VIP (Net Profit ≥ ₹200)' : getCustomerTag(phone) === 'regular' ? '📘 Regular' : '🆕 New'}
    </div>
    <h4 style="font-size:14px;font-weight:700;margin-bottom:10px;">🧾 Recent Services</h4>
    ${services.length ? `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        ${services.slice(0, 10).map(s => `
          <div style="padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:9px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:13px;font-weight:600;">${esc(s.service)}</div>
                <div style="font-size:11px;color:var(--text-mute);margin-top:2px;">${formatDateTime(s.date)} · ${esc(s.mode)}</div>
              </div>
              <div class="mono" style="color:#34d399;font-weight:700;">${formatINR((s.collected || 0) - (s.portalFees || 0))}</div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<p style="color:var(--text-mute);font-size:13px;margin-bottom:20px;">No service records</p>'}
    <h4 style="font-size:14px;font-weight:700;margin-bottom:10px;">💰 Udhaar Entries</h4>
    ${udhaar.length ? `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${udhaar.map(u => {
          const bal = u.total - u.paid;
          const days = daysBetween(u.date);
          return `
            <div style="padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:9px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-size:13px;font-weight:600;">${esc(u.work)}</div>
                  <div style="font-size:11px;color:var(--text-mute);margin-top:2px;">${formatDate(u.date)} · ${days}d ago</div>
                </div>
                <div style="text-align:right;">
                  <div class="mono" style="color:${bal > 0 ? '#fbbf24' : '#34d399'};font-weight:700;">${formatINR(bal)}</div>
                  <span class="badge ${u.status === 'pending' ? 'amber' : 'emerald'}" style="font-size:9px;margin-top:3px;">${u.status}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '<p style="color:var(--text-mute);font-size:13px;">No udhaar entries</p>'}
  `;
  document.getElementById('drawerBackdrop').classList.add('show');
  Sound.click();
}

function sendWhatsAppByPhone(phone, name) {
  const st = getSettings();
  const pending = Store.get('udhaar', []).filter(u => u.phone === phone && u.status === 'pending');
  const bal = pending.reduce((a, u) => a + (u.total - u.paid), 0);
  if (bal <= 0) { toast('No pending balance', 'amber'); return; }
  const msg = st.whatsappTemplate.replace(/{name}/g, name).replace(/{shop}/g, st.shopName).replace(/{work}/g, 'services').replace(/{amount}/g, formatNum(bal)).replace(/{owner}/g, st.ownerName);
  const cc = phone.length === 10 ? '91' + phone : phone;
  window.open(`https://wa.me/${cc}?text=${encodeURIComponent(msg)}`, '_blank');
}
function closeDrawer() { document.getElementById('drawerBackdrop')?.classList.remove('show'); }

/* ============================ COMMAND PALETTE ============================ */
function openCommandPalette() {
  document.getElementById('cmdkBackdrop').classList.add('show');
  const input = document.getElementById('cmdkInput');
  input.value = ''; input.focus();
  renderCmdk('');
}
function closeCommandPalette() { document.getElementById('cmdkBackdrop')?.classList.remove('show'); }
function renderCmdk(query) {
  const q = query.toLowerCase().trim();
  const results = document.getElementById('cmdkResults');
  const commands = [
    { title: 'Dashboard', sub: 'Overview', icon: '✨', action: () => navigate('dashboard') },
    { title: 'Daily Services', sub: 'Walk-in jobs', icon: '🧾', action: () => navigate('services') },
    { title: 'Udhaar / Khata', sub: 'Credit customers', icon: '💰', action: () => navigate('udhaar') },
    { title: 'Expenses', sub: 'Shop & personal', icon: '💸', action: () => navigate('expenses') },
    { title: 'Insights', sub: 'Customer analytics', icon: '📊', action: () => navigate('insights') },
    { title: 'Business Summary', sub: 'Yearly P&L', icon: '📈', action: () => navigate('summary') },
    { title: 'Loans', sub: 'Borrowings tracker', icon: '🏦', action: () => navigate('loans') },
    { title: 'Inventory', sub: 'Assets', icon: '📦', action: () => navigate('inventory') },
    { title: 'Rate Card', sub: 'Service prices', icon: '🏷️', action: () => navigate('ratecard') },
    { title: 'Settings', sub: 'Shop profile', icon: '⚙️', action: () => navigate('settings') },
    { title: 'Add Service', sub: 'New walk-in', icon: '➕', action: () => { closeCommandPalette(); openServiceModal(); } },
    { title: 'Add Udhaar', sub: 'Credit entry', icon: '➕', action: () => { closeCommandPalette(); openUdhaarModal(); } },
    { title: 'Add Expense', sub: 'New expense', icon: '➕', action: () => { closeCommandPalette(); openExpenseModal(); } },
    { title: 'Add Loan', sub: 'Borrowing', icon: '➕', action: () => { closeCommandPalette(); openLoanModal(); } },
    { title: 'Open Calculator', sub: 'Quick math', icon: '🧮', action: () => { closeCommandPalette(); Calculator.open(); } },
    { title: 'Reload from Server', sub: 'Force sync from MongoDB', icon: '🔄', action: () => { closeCommandPalette(); forceSyncFromServer(); } },
    { title: 'Print P&L', sub: 'Business statement', icon: '🖨️', action: () => { closeCommandPalette(); setTimeout(printPL, 150); } },
    { title: 'Toggle Theme', sub: 'Dark / Light', icon: '🌓', action: () => { toggleTheme(); closeCommandPalette(); } },
    { title: 'Download Backup', sub: 'Export all data', icon: '📥', action: () => { downloadBackup(); closeCommandPalette(); } },
    { title: 'Sync Now', sub: 'Push to MongoDB', icon: '☁️', action: () => { closeCommandPalette(); Sync.push().then(() => toast('Synced!', 'emerald')); } },
    { title: 'Bulk WhatsApp', sub: 'Remind all pending', icon: '💬', action: () => { bulkWhatsApp(); closeCommandPalette(); } },
    { title: 'Keyboard Shortcuts', sub: 'See all shortcuts', icon: '⌨️', action: () => { closeCommandPalette(); showShortcuts(); } },
    { title: 'Toggle Sound', sub: 'On / Off', icon: '🔊', action: () => { toggleSound(); closeCommandPalette(); } }
  ];
  const customers = [];
  const seen = new Set();
  Store.get('services', []).concat(Store.get('udhaar', [])).forEach(c => {
    if (c.phone && !seen.has(c.phone)) {
      seen.add(c.phone);
      customers.push({ title: c.name, sub: c.phone, icon: '👤', action: () => { closeCommandPalette(); openCustomerDrawer(c.name, c.phone); } });
    }
  });
  const all = [...commands, ...customers];
  const filtered = q ? all.filter(c => c.title.toLowerCase().includes(q) || (c.sub || '').toLowerCase().includes(q)) : commands;

  if (!filtered.length) { results.innerHTML = `<div class="cmdk-empty"><div style="font-size:32px;margin-bottom:8px;">🔍</div>No results for "<strong>${esc(query)}</strong>"</div>`; return; }
  results.innerHTML = filtered.slice(0, 12).map((c, i) => `
    <div class="cmdk-item" data-cmdk-idx="${i}">
      <div class="ci-icon">${c.icon}</div>
      <div class="ci-text"><div class="ci-title">${esc(c.title)}</div>${c.sub ? `<div class="ci-sub">${esc(c.sub)}</div>` : ''}</div>
    </div>
  `).join('');
  results.querySelectorAll('.cmdk-item').forEach((el, i) => { el.onclick = () => filtered[i].action(); });
}

/* ============================ FORCE SYNC ============================ */
async function forceSyncFromServer() {
  const resultEl = document.getElementById('syncResult');
  if (resultEl) resultEl.textContent = '⏳ Fetching from MongoDB...';
  toast('Fetching from MongoDB...', 'cyan');

  if (!apiOnline) {
    await checkApi(true);
  }
  if (!apiOnline) {
    if (resultEl) resultEl.textContent = '❌ Server offline — check connection';
    toast('Server is offline', 'rose');
    return;
  }

  if (Sync.hasChanges()) {
    await Sync.push();
  }

  /* ⭐ FIX: force=true — user explicitly wants to overwrite from server */
  const ok = await Sync.pullAll(true);
  if (ok) {
    if (resultEl) resultEl.textContent = `✅ Loaded from server (${new Date().toLocaleTimeString('en-IN')})`;
    toast('Data reloaded from MongoDB ✅', 'emerald');
    render();
  } else {
    if (resultEl) resultEl.textContent = '❌ Failed to fetch';
    toast('Failed to fetch from server', 'rose');
  }
}

/* ============================ SOUND TOGGLE ============================ */
function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('ccm_sound', soundEnabled ? 'on' : 'off');
  document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) Sound.success();
  toast(soundEnabled ? 'Sound ON 🔊' : 'Sound OFF 🔇', 'cyan');
}

/* ============================ 🔐 LOCK SCREEN (Password) ============================ */
let lockMode = 'unlock';
let lockCallback = null;
let lockCountdownTimer = null;

function showLockScreen(mode = 'unlock', onSuccess = null) {
  lockMode = mode;
  lockCallback = onSuccess;

  const back = document.getElementById('lockBackdrop');
  if (!back) return;

  const title = document.getElementById('lockTitle');
  const sub = document.getElementById('lockSub');
  const hint = document.getElementById('lockHint');
  const attempts = document.getElementById('lockAttempts');
  const strength = document.getElementById('lockStrength');
  const input = document.getElementById('lockPassword');
  const submit = document.getElementById('lockSubmit');
  const icon = document.getElementById('lockIcon');

  hint.textContent = '';
  attempts.textContent = '';
  input.value = '';
  input.type = 'password';
  input.disabled = false;
  submit.disabled = false;
  const eye = document.getElementById('lockEye');
  if (eye) eye.textContent = '👁️';

  const oldConfirm = document.getElementById('lockConfirmWrap');
  if (oldConfirm) oldConfirm.remove();

  if (mode === 'unlock') {
    icon.textContent = '🔐';
    title.textContent = 'Enter Password';
    sub.textContent = 'Protected by your security password';
    input.placeholder = 'Enter password';
    input.setAttribute('autocomplete', 'current-password');
    submit.textContent = '🔓 Unlock';
    strength.style.display = 'none';
    checkLockTimer();
  } else if (mode === 'set') {
    icon.textContent = '🔑';
    title.textContent = 'Create Password';
    sub.textContent = 'Set a strong password (minimum 6 characters)';
    input.placeholder = 'New password';
    input.setAttribute('autocomplete', 'new-password');
    submit.textContent = '🔐 Set Password';
    strength.style.display = 'block';
    updateStrength('');
  } else if (mode === 'change') {
    icon.textContent = '🔑';
    title.textContent = 'Change Password';
    sub.textContent = 'Enter your new password';
    input.placeholder = 'New password';
    input.setAttribute('autocomplete', 'new-password');
    submit.textContent = '🔐 Update Password';
    strength.style.display = 'block';
    updateStrength('');
  }

  back.classList.add('show');
  setTimeout(() => input.focus(), 150);
}

function hideLockScreen() {
  document.getElementById('lockBackdrop')?.classList.remove('show');
  if (lockCountdownTimer) { clearInterval(lockCountdownTimer); lockCountdownTimer = null; }
}

function updateStrength(pwd) {
  const s = Auth.scorePassword(pwd);
  const fill = document.getElementById('lockStrengthFill');
  const text = document.getElementById('lockStrengthText');
  if (fill) { fill.style.width = (s.pct || 0) + '%'; fill.style.background = s.color; }
  if (text) { text.textContent = s.label; text.style.color = s.color; }
}

function checkLockTimer() {
  const rem = Auth.getRemainingLockMs();
  const attempts = document.getElementById('lockAttempts');
  const input = document.getElementById('lockPassword');
  const submit = document.getElementById('lockSubmit');

  if (lockCountdownTimer) { clearInterval(lockCountdownTimer); lockCountdownTimer = null; }

  if (rem <= 0) {
    if (attempts) attempts.textContent = '';
    if (input) input.disabled = false;
    if (submit) submit.disabled = false;
    return;
  }

  if (input) input.disabled = true;
  if (submit) submit.disabled = true;

  const tick = () => {
    const r = Auth.getRemainingLockMs();
    if (r <= 0) {
      if (attempts) attempts.textContent = '';
      if (input) input.disabled = false;
      if (submit) submit.disabled = false;
      clearInterval(lockCountdownTimer);
      lockCountdownTimer = null;
      return;
    }
    const sec = Math.ceil(r / 1000);
    if (attempts) {
      attempts.innerHTML = `🔒 Too many failed attempts. Try again in <strong>${sec}s</strong>`;
      attempts.style.color = '#f87171';
    }
  };
  tick();
  lockCountdownTimer = setInterval(tick, 500);
}

async function handleLockSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('lockPassword');
  const hint = document.getElementById('lockHint');
  const pwd = input.value || '';

  if (!pwd) { hint.style.color = '#f87171'; hint.textContent = 'Please enter password'; return; }

  if (lockMode === 'unlock') {
    if (Auth.getRemainingLockMs() > 0) { hint.textContent = 'Locked out. Please wait.'; return; }
    const ok = await Auth.verify(pwd);
    if (ok) {
      Auth.clearAttempts();
      Auth.markSession();
      hideLockScreen();
      Sound.success();
      toast('Welcome back! 💜', 'emerald');
      AutoLock.schedule();
      if (lockCallback) { try { lockCallback(); } catch (err) { console.warn(err); } }
    } else {
      const a = Auth.recordFail();
      const remLock = Auth.getRemainingLockMs();
      if (remLock > 0) { hint.textContent = ''; checkLockTimer(); }
      else {
        const remaining = Auth.MAX_ATTEMPTS - (a.count || 0);
        hint.style.color = '#f87171';
        hint.textContent = `❌ Wrong password${remaining > 0 ? ' · ' + remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' left' : ''}`;
      }
      input.value = '';
      input.focus();
      Sound.error();
    }
    return;
  }

  if (lockMode === 'set' || lockMode === 'change') {
    if (pwd.length < 6) { hint.style.color = '#f87171'; hint.textContent = '❌ Password must be at least 6 characters'; return; }
    if (pwd.length > 128) { hint.style.color = '#f87171'; hint.textContent = '❌ Password too long (max 128)'; return; }
    const confirmEl = document.getElementById('lockConfirm');
    if (!confirmEl) {
      const wrap = document.createElement('div');
      wrap.id = 'lockConfirmWrap';
      wrap.className = 'lock-input-wrap';
      wrap.style.marginTop = '10px';
      wrap.innerHTML = '<span class="lock-input-icon">🔒</span><input type="password" id="lockConfirm" placeholder="Confirm password" autocomplete="new-password" />';
      const firstWrap = document.getElementById('lockInputWrap');
      firstWrap.parentElement.insertBefore(wrap, firstWrap.nextSibling);
      document.getElementById('lockConfirm').focus();
      hint.style.color = '#0ea5e9';
      hint.textContent = '✓ Now confirm your password';
      return;
    }
    if (confirmEl.value !== pwd) {
      hint.style.color = '#f87171';
      hint.textContent = '❌ Passwords do not match';
      confirmEl.value = '';
      confirmEl.focus();
      return;
    }
    await Auth.setPassword(pwd);
    Auth.markSession();
    hint.style.color = '#34d399';
    hint.textContent = '✅ Password saved successfully!';
    Sound.success();
    toast(lockMode === 'change' ? 'Password changed 🔐' : 'Password set 🔐', 'emerald');
    setTimeout(() => {
      hideLockScreen();
      if (lockCallback) { try { lockCallback(); } catch (err) { console.warn(err); } }
      if (typeof currentPage !== 'undefined' && currentPage === 'settings') render();
    }, 700);
    return;
  }
}

/* ============================ CSV EXPORT ============================ */
function exportCSV(key, filename) {
  const data = Store.get(key, []);
  if (!data.length) { toast('No data to export', 'amber'); return; }
  const headers = Object.keys(data[0]).filter(k => k !== 'id');
  const rows = data.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported 📥', 'emerald');
}

/* ============================ PRINT STATEMENTS ============================ */
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 24px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 14px; }
  th { background: #1a1a2e; color: #fff; text-align: left; padding: 10px 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  th.num { text-align: right; }
  td { padding: 9px 8px; border-bottom: 1px solid #e0e0e6; }
  td.num { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafc; }
  tfoot td { background: #1a1a2e !important; color: #fff !important; font-weight: 900; padding: 12px 8px; border: none; }
  .info-bar { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 14px; padding: 10px 14px; background: #f5f5f7; border-radius: 5px; flex-wrap: wrap; gap: 8px; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1px solid #333; width: 180px; padding-top: 6px; margin-top: 50px; font-weight: 600; }
  .stamp { margin-top: 20px; text-align: right; font-size: 10.5px; color: #666; }
  .positive { color: #059669; }
  .negative { color: #dc2626; }
  @media print { body { padding: 12px; } @page { size: A4; margin: 12mm; } }
`;

function buildPrintHeader(title) {
  const st = getSettings();
  return `
    <div style="text-align:center;padding-bottom:16px;border-bottom:3px double #333;margin-bottom:18px;">
      <h1 style="font-size:20px;letter-spacing:3px;font-weight:900;margin-bottom:6px;">${esc(st.shopName).toUpperCase()}</h1>
      <p style="font-size:11.5px;color:#555;margin:2px 0;">${esc(st.address)}</p>
      <p style="font-size:11.5px;color:#555;margin:2px 0;">Ph: ${esc(st.phone)} &nbsp;·&nbsp; GST/CSC: ${esc(st.gst)}</p>
      <div style="display:inline-block;background:#111;color:#fff;padding:5px 16px;font-size:12px;letter-spacing:2px;font-weight:700;margin-top:12px;border-radius:3px;">${title}</div>
    </div>`;
}

function openPrintWindow(title, bodyHTML) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyHTML}<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script></body></html>`);
  w.document.close();
}

function printServices() {
  const list = Store.get('services', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalCol = list.reduce((a, s) => a + (s.collected || 0), 0);
  const totalNet = list.reduce((a, s) => a + Calc.serviceNet(s), 0);
  const body = `
    ${buildPrintHeader('DAILY SERVICES REGISTER')}
    <div class="info-bar">
      <span><strong>Total Records:</strong> ${list.length}</span>
      <span><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</span>
    </div>
    <table><thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Service</th><th class="num">Portal</th><th class="num">Collected</th><th class="num">Net</th><th>Mode</th></tr></thead>
    <tbody>${list.map(s => `
      <tr><td>${formatDate(s.date)}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.phone)}</td><td>${esc(s.service)}</td>
      <td class="num">Rs.${formatNum(s.portalFees)}</td><td class="num">Rs.${formatNum(s.collected)}</td>
      <td class="num positive">Rs.${formatNum(Calc.serviceNet(s))}</td><td>${esc(s.mode)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right;">TOTAL</td><td class="num">Rs.${formatNum(totalCol)}</td><td class="num">Rs.${formatNum(totalNet)}</td><td></td></tr></tfoot></table>
    <div class="footer"><div class="sign-box"><div class="sign-line">Prepared By</div></div><div class="sign-box"><div class="sign-line">${esc(getSettings().ownerName)} — Proprietor</div></div></div>
    <div class="stamp">Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>`;
  openPrintWindow('Daily Services Register', body);
}

function printUdhaar() {
  const list = Store.get('udhaar', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalDue = list.filter(u => u.status === 'pending').reduce((a, u) => a + (u.total - u.paid), 0);
  const totalBilled = list.reduce((a, u) => a + u.total, 0);
  const totalPaid = list.reduce((a, u) => a + u.paid, 0);
  const body = `
    ${buildPrintHeader('UDHAAR / KHATA STATEMENT')}
    <div class="info-bar">
      <span><strong>Total:</strong> ${list.length}</span>
      <span><strong>Billed:</strong> Rs.${formatNum(totalBilled)}</span>
      <span><strong>Received:</strong> Rs.${formatNum(totalPaid)}</span>
      <span><strong>Pending:</strong> Rs.${formatNum(totalDue)}</span>
    </div>
    <table><thead><tr><th>Date</th><th>Customer</th><th>Phone</th><th>Work</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead>
    <tbody>${list.map(u => {
      const bal = u.total - u.paid;
      return `<tr><td>${formatDate(u.date)}</td><td><strong>${esc(u.name)}</strong></td><td>${esc(u.phone)}</td><td>${esc(u.work)}</td>
        <td class="num">Rs.${formatNum(u.total)}</td><td class="num positive">Rs.${formatNum(u.paid)}</td>
        <td class="num ${bal > 0 ? 'negative' : 'positive'}">Rs.${formatNum(bal)}</td>
        <td>${u.status === 'pending' ? 'Pending' : 'Cleared'}</td></tr>`;
    }).join('')}</tbody>
    <tfoot><tr><td colspan="4" style="text-align:right;">TOTAL</td><td class="num">Rs.${formatNum(totalBilled)}</td><td class="num">Rs.${formatNum(totalPaid)}</td><td class="num">Rs.${formatNum(totalDue)}</td><td></td></tr></tfoot></table>
    <div class="footer"><div class="sign-box"><div class="sign-line">Prepared By</div></div><div class="sign-box"><div class="sign-line">${esc(getSettings().ownerName)} — Proprietor</div></div></div>
    <div class="stamp">Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>`;
  openPrintWindow('Udhaar Statement', body);
}

function printExpenses() {
  const list = Store.get('expenses', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = list.reduce((a, e) => a + e.amount, 0);
  const shopTotal = list.filter(e => e.type === 'shop').reduce((a, e) => a + e.amount, 0);
  const personalTotal = list.filter(e => e.type === 'personal').reduce((a, e) => a + e.amount, 0);
  const body = `
    ${buildPrintHeader('EXPENSES STATEMENT')}
    <div class="info-bar">
      <span><strong>Shop:</strong> Rs.${formatNum(shopTotal)}</span>
      <span><strong>Personal:</strong> Rs.${formatNum(personalTotal)}</span>
      <span><strong>Total:</strong> Rs.${formatNum(total)}</span>
    </div>
    <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Type</th><th>Mode</th><th class="num">Amount</th></tr></thead>
    <tbody>${list.map(e => `
      <tr><td>${formatDate(e.date)}</td><td>${esc(e.category)}</td><td>${esc(e.desc)}</td>
      <td>${e.type === 'shop' ? 'Shop' : 'Personal'}</td><td>${esc(e.mode)}</td>
      <td class="num negative">Rs.${formatNum(e.amount)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right;">TOTAL</td><td class="num">Rs.${formatNum(total)}</td></tr></tfoot></table>
    <div class="footer"><div class="sign-box"><div class="sign-line">Prepared By</div></div><div class="sign-box"><div class="sign-line">${esc(getSettings().ownerName)} — Proprietor</div></div></div>
    <div class="stamp">Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>`;
  openPrintWindow('Expenses Statement', body);
}

function printLoans() {
  const list = Store.get('loans', []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = list.reduce((a, l) => a + l.total, 0);
  const paid = list.reduce((a, l) => a + l.paid, 0);
  const body = `
    ${buildPrintHeader('LOANS & BORROWINGS')}
    <div class="info-bar">
      <span><strong>Borrowed:</strong> Rs.${formatNum(total)}</span>
      <span><strong>Repaid:</strong> Rs.${formatNum(paid)}</span>
      <span><strong>Outstanding:</strong> Rs.${formatNum(total - paid)}</span>
    </div>
    <table><thead><tr><th>Date</th><th>Person/Bank</th><th>Description</th><th class="num">Taken</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead>
    <tbody>${list.map(l => {
      const bal = l.total - l.paid;
      return `<tr><td>${formatDate(l.date)}</td><td><strong>${esc(l.name)}</strong></td><td>${esc(l.desc)}</td>
        <td class="num">Rs.${formatNum(l.total)}</td><td class="num positive">Rs.${formatNum(l.paid)}</td>
        <td class="num ${bal > 0 ? 'negative' : 'positive'}">Rs.${formatNum(bal)}</td>
        <td>${l.status === 'active' ? 'Active' : 'Settled'}</td></tr>`;
    }).join('')}</tbody>
    <tfoot><tr><td colspan="3" style="text-align:right;">TOTAL</td><td class="num">Rs.${formatNum(total)}</td><td class="num">Rs.${formatNum(paid)}</td><td class="num">Rs.${formatNum(total - paid)}</td><td></td></tr></tfoot></table>
    <div class="footer"><div class="sign-box"><div class="sign-line">Prepared By</div></div><div class="sign-box"><div class="sign-line">${esc(getSettings().ownerName)} — Proprietor</div></div></div>
    <div class="stamp">Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>`;
  openPrintWindow('Loans Statement', body);
}

function printInventory() {
  const list = Store.get('inventory', []);
  const totalValue = list.reduce((a, i) => a + (i.cost || 0), 0);
  const body = `
    ${buildPrintHeader('INVENTORY & ASSETS')}
    <div class="info-bar">
      <span><strong>Total Items:</strong> ${list.length}</span>
      <span><strong>Total Value:</strong> Rs.${formatNum(totalValue)}</span>
    </div>
    <table><thead><tr><th>S.No</th><th>Item</th><th>Category</th><th>Serial</th><th>Purchase</th><th>Warranty</th><th class="num">Cost</th><th>Status</th></tr></thead>
    <tbody>${list.map((i, idx) => `
      <tr><td>${idx + 1}</td><td><strong>${esc(i.name)}</strong></td><td>${esc(i.category)}</td>
      <td style="font-family:'Courier New',monospace;">${esc(i.serial || '—')}</td>
      <td>${formatDate(i.purchase)}</td><td>${i.warranty ? formatDate(i.warranty) : '—'}</td>
      <td class="num">Rs.${formatNum(i.cost)}</td><td>${esc(i.status)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="6" style="text-align:right;">TOTAL VALUE</td><td class="num">Rs.${formatNum(totalValue)}</td><td></td></tr></tfoot></table>
    <div class="footer"><div class="sign-box"><div class="sign-line">Prepared By</div></div><div class="sign-box"><div class="sign-line">${esc(getSettings().ownerName)} — Proprietor</div></div></div>
    <div class="stamp">Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>`;
  openPrintWindow('Inventory Statement', body);
}

function printRateCard() {
  const rates = Store.get('rates', DEFAULT_RATES);
  const grouped = {};
  rates.forEach(r => { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r); });
  const body = `
    ${buildPrintHeader('RATE CARD')}
    <div class="info-bar">
      <span><strong>Total Services:</strong> ${rates.length}</span>
      <span><strong>Effective From:</strong> ${new Date().toLocaleDateString('en-IN')}</span>
    </div>
    ${Object.entries(grouped).map(([cat, items]) => `
      <h3 style="margin:16px 0 8px;font-size:13px;background:#1a1a2e;color:#fff;padding:6px 12px;border-radius:4px;letter-spacing:1px;">${esc(cat).toUpperCase()}</h3>
      <table><thead><tr><th>Service</th><th class="num">Portal Fees</th><th class="num">Service Charge</th><th class="num">Total</th></tr></thead>
      <tbody>${items.map(it => {
        const portal = Number(it.portalFees) || 0;
        const charge = Number(it.serviceCharge) || 0;
        return `<tr><td>${esc(it.name)}</td><td class="num">Rs.${formatNum(portal)}</td><td class="num">Rs.${formatNum(charge)}</td><td class="num"><strong>Rs.${formatNum(portal + charge)}</strong></td></tr>`;
      }).join('')}</tbody></table>
    `).join('')}
    <div class="footer"><div class="sign-box"><div class="sign-line">${esc(getSettings().ownerName)} — Proprietor</div></div></div>
    <div class="stamp">Digital Seva Manager · ${new Date().toLocaleDateString('en-IN')}</div>`;
  openPrintWindow('Rate Card', body);
}

function printCurrentPage() {
  if (currentPage === 'summary') return printPL();
  if (currentPage === 'ratecard') return printRateCard();
  if (currentPage === 'udhaar') return printUdhaar();
  if (currentPage === 'services') return printServices();
  if (currentPage === 'expenses') return printExpenses();
  if (currentPage === 'loans') return printLoans();
  if (currentPage === 'inventory') return printInventory();
  window.print();
}

/* ============================ BULK SELECTION ============================ */
function initBulkSelection(prefix, key) {
  const selectAll = document.getElementById(`${prefix}SelectAll`);
  const bulkBar = document.getElementById(`${prefix}BulkBar`);
  const bulkCount = document.getElementById(`${prefix}BulkCount`);
  const checkboxes = document.querySelectorAll(`.row-check[data-check-id]`);
  if (!bulkBar) return;

  const updateBar = () => {
    if (selectedRows.size > 0) { bulkBar.classList.add('show'); bulkCount.textContent = `${selectedRows.size} selected`; }
    else { bulkBar.classList.remove('show'); }
  };

  if (selectAll) {
    selectAll.onchange = () => {
      checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        const id = cb.dataset.checkId;
        if (selectAll.checked) selectedRows.add(id); else selectedRows.delete(id);
        cb.closest('tr').classList.toggle('selected', selectAll.checked);
      });
      updateBar();
    };
  }

  checkboxes.forEach(cb => {
    cb.onchange = () => {
      const id = cb.dataset.checkId;
      if (cb.checked) selectedRows.add(id); else selectedRows.delete(id);
      cb.closest('tr').classList.toggle('selected', cb.checked);
      updateBar();
    };
  });

  const bulkDeleteBtn = document.getElementById(`${prefix}BulkDelete`);
  if (bulkDeleteBtn) bulkDeleteBtn.onclick = () => {
    if (!selectedRows.size) return;
    const count = selectedRows.size;
    const idsToDelete = Array.from(selectedRows);
    confirmDialog('Delete Selected?', `${count} item(s) will be deleted permanently.`, () => {
      const remaining = Store.get(key, []).filter(x => !selectedRows.has(x.id));
      Store.set(key, remaining);
      idsToDelete.forEach(id => Sync.markDeleted(key, id));
      selectedRows.clear();
      toast(`${count} items deleted`, 'rose');
      render();
    });
  };
  const clearBtn = document.getElementById(`${prefix}BulkClear`);
  if (clearBtn) clearBtn.onclick = () => { selectedRows.clear(); render(); };
}

/* ============================ PAGE EVENTS ============================ */
function attachPageEvents() {
  document.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => navigate(el.dataset.nav));
  document.querySelectorAll('[data-wa]').forEach(el => el.onclick = e => { e.stopPropagation(); sendWhatsApp(el.dataset.wa); });
  document.querySelectorAll('[data-copy]').forEach(el => el.onclick = e => { e.stopPropagation(); copyReminder(el.dataset.copy); });

  const bulkBtn = document.getElementById('bulkWaBtn'); if (bulkBtn) bulkBtn.onclick = bulkWhatsApp;
  const bulkBtn2 = document.getElementById('bulkWaBtn2'); if (bulkBtn2) bulkBtn2.onclick = bulkWhatsApp;

  const notesArea = document.getElementById('notesArea');
  if (notesArea) {
    const save = debounce(v => { Store.set('notes', v); Sync.markDirty('notes'); }, 500);
    notesArea.oninput = () => save(notesArea.value);
  }

  document.querySelectorAll('#revToggle button').forEach(btn => {
    btn.onclick = () => {
      periodRev = btn.dataset.period;
      document.querySelectorAll('#revToggle button').forEach(b => b.classList.toggle('active', b === btn));
      initDashboardCharts();
      Sound.click();
    };
  });
  document.querySelectorAll('#expToggle button').forEach(btn => {
    btn.onclick = () => {
      periodExp = btn.dataset.period;
      document.querySelectorAll('#expToggle button').forEach(b => b.classList.toggle('active', b === btn));
      const expData = Calc.getExpenseData(periodExp);
      const sub = document.getElementById('expSub');
      if (sub) sub.textContent = `Total: ${formatINR(expData.total)}`;
      initDashboardCharts();
      Sound.click();
    };
  });

  const svcSearch = document.getElementById('svcSearch');
  const svcFilter = document.getElementById('svcFilter');
  if (svcSearch) svcSearch.oninput = debounce(updateServicesTable, 200);
  if (svcFilter) svcFilter.onchange = updateServicesTable;
  const addSvc = document.getElementById('addServiceBtn'); if (addSvc) addSvc.onclick = () => openServiceModal();
  const expSvcCsv = document.getElementById('exportSvcCsv'); if (expSvcCsv) expSvcCsv.onclick = () => exportCSV('services', 'services');
  document.querySelectorAll('[data-edit-svc]').forEach(el => el.onclick = () => {
    const s = Store.get('services', []).find(x => x.id === el.dataset.editSvc);
    if (s) openServiceModal(s);
  });
  document.querySelectorAll('[data-dup-svc]').forEach(el => el.onclick = () => {
    const s = Store.get('services', []).find(x => x.id === el.dataset.dupSvc);
    if (s) openServiceModal(s, true);
  });
  document.querySelectorAll('[data-receipt]').forEach(el => el.onclick = () => printReceipt(el.dataset.receipt));
  document.querySelectorAll('[data-del-svc]').forEach(el => el.onclick = () => {
    const item = Store.get('services', []).find(x => x.id === el.dataset.delSvc);
    if (item) confirmDialog('Delete Service?', `Delete "${item.service}" for ${item.name}?`, () => {
      Store.set('services', Store.get('services', []).filter(x => x.id !== item.id));
      Sync.markDeleted('services', item.id);
      toast('Deleted', 'rose'); render();
    });
  });
  if (currentPage === 'services') initBulkSelection('svc', 'services');

  const udSearch = document.getElementById('udSearch');
  const udFilter = document.getElementById('udFilter');
  if (udSearch) udSearch.oninput = debounce(updateUdhaarTable, 200);
  if (udFilter) udFilter.onchange = updateUdhaarTable;
  const addUd = document.getElementById('addUdhaarBtn'); if (addUd) addUd.onclick = () => openUdhaarModal();
  const expUdCsv = document.getElementById('exportUdCsv'); if (expUdCsv) expUdCsv.onclick = () => exportCSV('udhaar', 'udhaar');
  document.querySelectorAll('[data-settle]').forEach(el => el.onclick = () => settleUdhaar(el.dataset.settle));
  document.querySelectorAll('[data-edit-ud]').forEach(el => el.onclick = () => {
    const u = Store.get('udhaar', []).find(x => x.id === el.dataset.editUd);
    if (u) openUdhaarModal(u);
  });
  document.querySelectorAll('[data-dup-ud]').forEach(el => el.onclick = () => {
    const u = Store.get('udhaar', []).find(x => x.id === el.dataset.dupUd);
    if (u) openUdhaarModal(u, true);
  });
  document.querySelectorAll('[data-del-ud]').forEach(el => el.onclick = () => {
    const item = Store.get('udhaar', []).find(x => x.id === el.dataset.delUd);
    if (item) confirmDialog('Delete Udhaar?', `Delete "${item.work}" for ${item.name}?`, () => {
      Store.set('udhaar', Store.get('udhaar', []).filter(x => x.id !== item.id));
      Sync.markDeleted('udhaar', item.id);
      toast('Deleted', 'rose'); render();
    });
  });
  if (currentPage === 'udhaar') initBulkSelection('ud', 'udhaar');

  const exSearch = document.getElementById('exSearch');
  const exFilter = document.getElementById('exFilter');
  if (exSearch) exSearch.oninput = debounce(updateExpensesTable, 200);
  if (exFilter) exFilter.onchange = updateExpensesTable;
  const addEx = document.getElementById('addExpenseBtn'); if (addEx) addEx.onclick = () => openExpenseModal();
  const expExCsv = document.getElementById('exportExCsv'); if (expExCsv) expExCsv.onclick = () => exportCSV('expenses', 'expenses');
  document.querySelectorAll('[data-edit-ex]').forEach(el => el.onclick = () => {
    const e = Store.get('expenses', []).find(x => x.id === el.dataset.editEx);
    if (e) openExpenseModal(e);
  });
  document.querySelectorAll('[data-dup-ex]').forEach(el => el.onclick = () => {
    const e = Store.get('expenses', []).find(x => x.id === el.dataset.dupEx);
    if (e) openExpenseModal(e, true);
  });
  document.querySelectorAll('[data-del-ex]').forEach(el => el.onclick = () => {
    const item = Store.get('expenses', []).find(x => x.id === el.dataset.delEx);
    if (item) confirmDialog('Delete Expense?', `Delete "${item.desc}"?`, () => {
      Store.set('expenses', Store.get('expenses', []).filter(x => x.id !== item.id));
      Sync.markDeleted('expenses', item.id);
      toast('Deleted', 'rose'); render();
    });
  });
  if (currentPage === 'expenses') initBulkSelection('ex', 'expenses');

  const sumYear = document.getElementById('summaryYear');
  if (sumYear) sumYear.onchange = () => { localStorage.setItem('ccm_summaryYear', sumYear.value); render(); };
  document.querySelectorAll('[data-comm-month]').forEach(input => {
    input.onchange = () => {
      const year = Number(input.dataset.commYear);
      const month = Number(input.dataset.commMonth);
      const all = Store.get('commissions', {});
      if (!all[year]) all[year] = {};
      all[year][month] = Number(input.value) || 0;
      Store.set('commissions', all);
      Sync.markDirty('commissions');
      toast('Commission saved', 'emerald');
      render();
    };
  });
  const printSum = document.getElementById('printSummaryBtn'); if (printSum) printSum.onclick = printPL;

  const loanSearch = document.getElementById('loanSearch');
  if (loanSearch) loanSearch.oninput = debounce(updateLoansTable, 200);
  const addLoan = document.getElementById('addLoanBtn'); if (addLoan) addLoan.onclick = () => openLoanModal();
  const expLoanCsv = document.getElementById('exportLoanCsv'); if (expLoanCsv) expLoanCsv.onclick = () => exportCSV('loans', 'loans');
  document.querySelectorAll('[data-pay-loan]').forEach(el => el.onclick = () => payLoan(el.dataset.payLoan));
  document.querySelectorAll('[data-edit-loan]').forEach(el => el.onclick = () => {
    const l = Store.get('loans', []).find(x => x.id === el.dataset.editLoan);
    if (l) openLoanModal(l);
  });
  document.querySelectorAll('[data-del-loan]').forEach(el => el.onclick = () => {
    const item = Store.get('loans', []).find(x => x.id === el.dataset.delLoan);
    if (item) confirmDialog('Delete Loan?', `Delete loan from "${item.name}"?`, () => {
      Store.set('loans', Store.get('loans', []).filter(x => x.id !== item.id));
      Sync.markDeleted('loans', item.id);
      toast('Deleted', 'rose'); render();
    });
  });
  if (currentPage === 'loans') initBulkSelection('loan', 'loans');

  const invSearch = document.getElementById('invSearch');
  if (invSearch) invSearch.oninput = debounce(updateInventoryTable, 200);
  const addInv = document.getElementById('addInvBtn'); if (addInv) addInv.onclick = () => openInventoryModal();
  document.querySelectorAll('[data-edit-inv]').forEach(el => el.onclick = () => {
    const i = Store.get('inventory', []).find(x => x.id === el.dataset.editInv);
    if (i) openInventoryModal(i);
  });
  document.querySelectorAll('[data-del-inv]').forEach(el => el.onclick = () => {
    const item = Store.get('inventory', []).find(x => x.id === el.dataset.delInv);
    if (item) confirmDialog('Delete Asset?', `Delete "${item.name}"?`, () => {
      Store.set('inventory', Store.get('inventory', []).filter(x => x.id !== item.id));
      Sync.markDeleted('inventory', item.id);
      toast('Deleted', 'rose'); render();
    });
  });

  document.querySelectorAll('[data-rate-portal]').forEach(input => {
    input.onchange = () => {
      const id = input.dataset.ratePortal;
      const portalFees = Number(input.value) || 0;
      Store.set('rates', Store.get('rates', DEFAULT_RATES).map(x => x.id === id ? { ...x, portalFees } : x));
      Sync.markDirty('rates');
      toast('Portal fees updated', 'emerald');
      render();
    };
  });
  document.querySelectorAll('[data-rate-charge]').forEach(input => {
    input.onchange = () => {
      const id = input.dataset.rateCharge;
      const serviceCharge = Number(input.value) || 0;
      Store.set('rates', Store.get('rates', DEFAULT_RATES).map(x => x.id === id ? { ...x, serviceCharge } : x));
      Sync.markDirty('rates');
      toast('Service charge updated', 'emerald');
      render();
    };
  });
  document.querySelectorAll('[data-rate-edit]').forEach(el => el.onclick = () => {
    const r = Store.get('rates', DEFAULT_RATES).find(x => x.id === el.dataset.rateEdit);
    if (r) openRateEditModal(r);
  });
  document.querySelectorAll('[data-rate-del]').forEach(el => el.onclick = () => {
    const r = Store.get('rates', DEFAULT_RATES).find(x => x.id === el.dataset.rateDel);
    if (r) confirmDialog('Delete Rate Item?', `Delete "${r.name}"?`, () => {
      Store.set('rates', Store.get('rates', DEFAULT_RATES).filter(x => x.id !== r.id));
      Sync.markDeleted('rates', r.id);
      toast('Deleted', 'rose'); render();
    });
  });
  const addRateBtn = document.getElementById('addRateBtn'); if (addRateBtn) addRateBtn.onclick = () => openRateEditModal();
  const resetRatesBtn = document.getElementById('resetRatesBtn');
  if (resetRatesBtn) resetRatesBtn.onclick = () => confirmDialog('Reset Rate Card?', 'Restore default price list?', () => {
    Store.set('rates', DEFAULT_RATES);
    Sync.markDirty('rates');
    toast('Rates reset', 'amber'); render();
  });

  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.onsubmit = e => {
      e.preventDefault();
      Store.set('settings', { ...getSettings(), ...Object.fromEntries(new FormData(settingsForm)) });
      Sync.markDirty('settings');
      toast('Settings saved ✅', 'emerald'); render();
    };
    const saveTargetBtn = document.getElementById('saveTargetBtn');
    if (saveTargetBtn) saveTargetBtn.onclick = () => {
      const amt = Number(document.getElementById('targetInput').value) || 0;
      Store.set('target', { amount: amt, date: new Date().toDateString() });
      Sync.markDirty('target');
      toast('Target updated 🎯', 'emerald'); updateTargetRing();
    };
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    if (forceSyncBtn) forceSyncBtn.onclick = forceSyncFromServer;
    document.querySelectorAll('[data-theme-mode]').forEach(btn => {
      btn.onclick = () => {
        setThemeMode(btn.dataset.themeMode);
        render();
      };
    });
        /* ⭐ Password buttons */
    const setPwdBtn = document.getElementById('setPwdBtn');
    if (setPwdBtn) setPwdBtn.onclick = () => showLockScreen('set', () => { toast('You are now protected 🔐', 'emerald'); });
    const changePwdBtn = document.getElementById('changePwdBtn');
    if (changePwdBtn) changePwdBtn.onclick = () => showLockScreen('change', () => {});
    const removePwdBtn = document.getElementById('removePwdBtn');
    if (removePwdBtn) removePwdBtn.onclick = () => {
      showLockScreen('unlock', () => {
        confirmDialog('Remove Password?', 'App will no longer be locked. You can set a new password anytime.', () => {
          Auth.removePassword();
          Auth.endSession();
          if (AutoLock.timer) clearTimeout(AutoLock.timer);
          toast('Password removed', 'amber');
          render();
        });
      });
    };
    const lockNowBtn = document.getElementById('lockNowBtn');
    if (lockNowBtn) lockNowBtn.onclick = () => {
      Auth.endSession();
      showLockScreen('unlock');
      toast('App locked 🔒', 'cyan');
    };
    const backupBtn = document.getElementById('backupBtn'); if (backupBtn) backupBtn.onclick = downloadBackup;
    const restoreBtn = document.getElementById('restoreBtn');
    const restoreFile = document.getElementById('restoreFile');
    if (restoreBtn) restoreBtn.onclick = () => restoreFile.click();
    if (restoreFile) restoreFile.onchange = e => { if (e.target.files[0]) restoreBackup(e.target.files[0]); };
    const resetBtn = document.getElementById('resetDataBtn');
    if (resetBtn) resetBtn.onclick = () => confirmDialog('Clear Local Cache?', 'Local data will be wiped. If server is online, data will reload from server.', async () => {
      Object.values(Store.keys).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('ccm_themeMode');
      localStorage.removeItem('ccm_autoTheme');
      localStorage.removeItem('ccm_achievements');
      localStorage.removeItem('ccm_pending');
      localStorage.removeItem('ccm_deleted');
      localStorage.removeItem('ccm_targetCelebrated');

      Sync.pending = {};
      Sync.deleted = { services: [], udhaar: [], expenses: [], loans: [], inventory: [], rates: [] };

      if (apiOnline) {
        const ok = await Sync.pullAll(true);
        toast(ok ? 'Cache cleared — loaded from server ✅' : 'Cache cleared', ok ? 'emerald' : 'amber');
      } else {
        seedDemoData();
        toast('Cache cleared', 'amber');
      }
      applyThemeMode();
      render();
    });
  }
}

function updateServicesTable() {
  const q = (document.getElementById('svcSearch')?.value || '').toLowerCase();
  const filter = document.getElementById('svcFilter')?.value || 'all';
  let list = Store.get('services', []);
  if (filter === 'today') list = list.filter(s => isToday(s.date));
  else if (filter === 'week') { const w = Date.now() - 7 * 864e5; list = list.filter(s => new Date(s.date).getTime() >= w); }
  else if (filter === 'month') list = list.filter(s => isThisMonth(s.date));
  if (q) list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.service || '').toLowerCase().includes(q));
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('svcTableWrap').innerHTML = renderServicesTable(list);
  attachPageEvents();
}
function updateUdhaarTable() {
  const q = (document.getElementById('udSearch')?.value || '').toLowerCase();
  const filter = document.getElementById('udFilter')?.value || 'all';
  let list = Store.get('udhaar', []);
  if (filter === 'pending' || filter === 'cleared') list = list.filter(u => u.status === filter);
  else if (filter === 'critical') list = list.filter(u => u.status === 'pending' && daysBetween(u.date) >= 30);
  if (q) list = list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(q));
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('udTableWrap').innerHTML = renderUdhaarTable(list);
  attachPageEvents();
}
function updateExpensesTable() {
  const q = (document.getElementById('exSearch')?.value || '').toLowerCase();
  const filter = (document.getElementById('exFilter')?.value || 'month');
  let list = Store.get('expenses', []);
  if (filter === 'month') list = list.filter(e => isThisMonth(e.date));
  else if (filter === 'shop') list = list.filter(e => e.type === 'shop');
  else if (filter === 'personal') list = list.filter(e => e.type === 'personal');
  if (q) list = list.filter(e => (e.desc || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q));
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('exTableWrap').innerHTML = renderExpensesTable(list);
  attachPageEvents();
}
function updateLoansTable() {
  const q = (document.getElementById('loanSearch')?.value || '').toLowerCase();
  let list = Store.get('loans', []);
  if (q) list = list.filter(l => (l.name || '').toLowerCase().includes(q) || (l.desc || '').toLowerCase().includes(q));
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('loanTableWrap').innerHTML = renderLoansTable(list);
  attachPageEvents();
}
function updateInventoryTable() {
  const q = (document.getElementById('invSearch')?.value || '').toLowerCase();
  let list = Store.get('inventory', []);
  if (q) list = list.filter(i => (i.name || '').toLowerCase().includes(q) || (i.serial || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  document.getElementById('invTableWrap').innerHTML = renderInventoryTable(list);
  attachPageEvents();
}

/* ============================ CLOCK / SIDEBAR ============================ */
function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  el.textContent = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function openSidebar() { document.getElementById('sidebar')?.classList.add('open'); document.getElementById('overlay')?.classList.add('show'); }
function closeSidebarDrawer() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('show'); }

/* ============================ BOOT ============================ */
document.addEventListener('DOMContentLoaded', async () => {
  applyThemeMode();
  document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';

  Confetti.init();
  Sync.init();
  Achievements.init();

  tickClock(); setInterval(tickClock, 1000);
  Voice.init();
  Calculator.init();
  setInterval(autoThemeCheck, 60000);

  if (!Store.get('services', null)) seedDemoData();
  if (!Store.get('settings', null)) Store.set('settings', DEFAULT_SETTINGS);
  if (!Store.get('rates', null)) Store.set('rates', DEFAULT_RATES);
  else migrateLocalRates();
  if (!Store.get('target', null)) Store.set('target', { amount: 2000, date: new Date().toDateString() });

  document.querySelectorAll('.nav-item').forEach(el => el.onclick = () => navigate(el.dataset.page));
  document.getElementById('menuBtn').onclick = openSidebar;
  document.getElementById('overlay').onclick = closeSidebarDrawer;
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('soundBtn').onclick = toggleSound;
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalBackdrop').onclick = e => { if (e.target.id === 'modalBackdrop') closeModal(); };
  document.getElementById('drawerClose').onclick = closeDrawer;
  document.getElementById('drawerBackdrop').onclick = e => { if (e.target.id === 'drawerBackdrop') closeDrawer(); };
  document.getElementById('printBtn').onclick = printCurrentPage;

  const helpBtn = document.getElementById('helpBtn'); if (helpBtn) helpBtn.onclick = showShortcuts;
  const scClose = document.getElementById('shortcutsClose'); if (scClose) scClose.onclick = hideShortcuts;
  const scBack = document.getElementById('shortcutsBackdrop');
  if (scBack) scBack.onclick = e => { if (e.target.id === 'shortcutsBackdrop') hideShortcuts(); };

  const fab = document.getElementById('fab');
  const fabActions = document.getElementById('fabActions');
  fab.onclick = () => { fab.classList.toggle('open'); fabActions.classList.toggle('open'); Sound.click(); };
  document.querySelectorAll('.fab-action').forEach(a => {
    a.onclick = () => {
      fab.classList.remove('open'); fabActions.classList.remove('open');
      const action = a.dataset.action;
      if (action === 'add-service') openServiceModal();
      else if (action === 'add-udhaar') openUdhaarModal();
      else if (action === 'add-expense') openExpenseModal();
      else if (action === 'add-loan') openLoanModal();
      else if (action === 'add-note') {
        if (currentPage !== 'dashboard') navigate('dashboard');
        setTimeout(() => {
          const area = document.getElementById('notesArea');
          if (area) { area.focus(); area.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }, 400);
      }
    };
  });

  document.getElementById('searchBtn').onclick = openCommandPalette;
  document.getElementById('cmdkBackdrop').onclick = e => { if (e.target.id === 'cmdkBackdrop') closeCommandPalette(); };
  document.getElementById('cmdkInput').oninput = e => renderCmdk(e.target.value);
  document.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => handlePinInput(b.dataset.pin));

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('cmdkBackdrop').classList.contains('show') ? closeCommandPalette() : openCommandPalette();
    }
    if (e.key === 'Escape') { closeModal(); closeCommandPalette(); closeDrawer(); closeSidebarDrawer(); hideShortcuts(); Calculator.close(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.target.matches('input, textarea')) { e.preventDefault(); openServiceModal(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u' && !e.target.matches('input, textarea')) { e.preventDefault(); openUdhaarModal(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !e.target.matches('input, textarea')) { e.preventDefault(); openExpenseModal(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      if (Auth.hasPassword()) {
        Auth.endSession();
        showLockScreen('unlock');
        toast('App locked 🔒', 'cyan');
      } else {
        openLoanModal();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleTheme(); }
    if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); Calculator.open(); }
    if (e.key === '?' && e.shiftKey) { e.preventDefault(); showShortcuts(); }
  });

  /* ⭐ Initialize password lock */
  const lockForm = document.getElementById('lockForm');
  if (lockForm) lockForm.addEventListener('submit', handleLockSubmit);
  const lockEye = document.getElementById('lockEye');
  if (lockEye) lockEye.onclick = () => {
    const input = document.getElementById('lockPassword');
    if (!input) return;
    if (input.type === 'password') { input.type = 'text'; lockEye.textContent = '🙈'; }
    else { input.type = 'password'; lockEye.textContent = '👁️'; }
    input.focus();
  };
  const lockPasswordInput = document.getElementById('lockPassword');
  if (lockPasswordInput) {
    lockPasswordInput.addEventListener('input', e => {
      if (lockMode === 'set' || lockMode === 'change') updateStrength(e.target.value);
    });
  }

  /* ⭐ Topbar Lock button */
  const lockBtn = document.getElementById('lockBtn');
  if (lockBtn) {
    if (!Auth.hasPassword()) {
      lockBtn.style.display = 'none';
    } else {
      lockBtn.style.display = 'grid';
      lockBtn.onclick = () => {
        Auth.endSession();
        showLockScreen('unlock');
        toast('App locked 🔒', 'cyan');
        Sound.click();
      };
    }
  }

  /* ⭐ Migrate old PIN → Password */
  if (Store.raw('pin') && !Auth.hasPassword()) {
    localStorage.removeItem('ccm_pin');
    setTimeout(() => toast('🔐 Security upgraded! Old PIN retired — set a new password in Settings.', 'cyan'), 2000);
  }

  /* ⭐ Show lock screen if password set & no active session */
  if (Auth.hasPassword() && !Auth.hasActiveSession()) {
    showLockScreen('unlock');
  } else if (Auth.hasPassword()) {
    AutoLock.init();
  }

  render();

  (async () => {
    await checkApi(true);
    if (!apiOnline) {
      console.log('⚠️  Offline mode — using local cache');
      return;
    }

    if (Sync.hasChanges()) {
      const ok = await Sync.push();
      if (ok) console.log('✅ Pushed local changes to MongoDB');
    } else {
      const ok = await Sync.pullAll();
      if (ok) {
        console.log('✅ Loaded fresh data from MongoDB');
        render();
      }
    }
  })();

  setInterval(checkApi, 30000);

  const lastBackup = Store.raw('lastBackup');
  const daysSince = lastBackup ? Math.floor((Date.now() - Number(lastBackup)) / 86400000) : null;
  if (daysSince === null || daysSince >= 7) {
    setTimeout(() => {
      const wrap = document.getElementById('toastWrap');
      if (!wrap) return;
      const el = document.createElement('div');
      el.className = 'toast amber';
      el.innerHTML = `<span style="font-size:16px;">💾</span><div style="flex:1;"><div style="font-weight:700;">Backup reminder</div><div style="font-size:11.5px;opacity:.85;">${daysSince === null ? 'No backup yet — download one now' : `Last backup ${daysSince} days ago`}</div></div><button class="btn ghost sm" id="bkupNow" style="margin-left:8px;">Backup</button>`;
      wrap.appendChild(el);
      const b = el.querySelector('#bkupNow');
      if (b) b.onclick = () => { downloadBackup(); el.remove(); };
      setTimeout(() => { if (el.parentNode) el.remove(); }, 12000);
    }, 3000);
  }

  setInterval(() => {
    if (Sync.hasChanges() && apiOnline && !Sync.syncing) {
      Sync.push();
    }
  }, 60000);
});

/* ============================ GLOBAL EXPORTS ============================ */
window.closeModal = closeModal;
window.openCustomerDrawer = openCustomerDrawer;
window.sendWhatsAppByPhone = sendWhatsAppByPhone;
window.printReceipt = printReceipt;