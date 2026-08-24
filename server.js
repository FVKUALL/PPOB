const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { executePPOB, executePayment } = require('./lib/providers');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// ========== ENCRYPTION (AES-256-GCM) ==========
const ENC_ALGORITHM = 'aes-256-gcm';
const ENC_KEY_FILE = path.join(__dirname, '.encryption-key');

function getEncryptionKey() {
  if (process.env.ENCRYPTION_KEY) {
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  if (fs.existsSync(ENC_KEY_FILE)) {
    return Buffer.from(fs.readFileSync(ENC_KEY_FILE, 'utf8').trim(), 'hex');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(ENC_KEY_FILE, key.toString('hex'), { mode: 0o600 });
  console.log('[SECURITY] Generated new encryption key at .encryption-key — BACKUP THIS FILE!');
  return key;
}

const ENC_KEY = getEncryptionKey();

function encrypt(text) {
  if (typeof text !== 'string') text = JSON.stringify(text);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGORITHM, ENC_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

function decrypt(encryptedStr) {
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ENC_ALGORITHM, ENC_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[DECRYPT ERROR]', e.message);
    return null;
  }
}

const ENCRYPTED_FILES = ['users.json', 'transactions.json', 'settings.json'];

function readJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    let raw = fs.readFileSync(filePath, 'utf8');
    if (ENCRYPTED_FILES.includes(filename) && raw.startsWith('ENC:')) {
      const decrypted = decrypt(raw.slice(4));
      if (!decrypted) throw new Error('Decryption failed');
      raw = decrypted;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${filename}:`, e.message);
    if (filename.includes('users') || filename.includes('transactions') || filename.includes('faqs') || filename.includes('products')) return [];
    return {};
  }
}

function writeJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  let content = JSON.stringify(data, null, 2);
  if (ENCRYPTED_FILES.includes(filename)) {
    content = 'ENC:' + encrypt(content);
  }
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function getSettings() {
  return readJSON('settings.json');
}

// ========== AUTO SWITCHING (real provider calls via lib/providers.js) ==========
function selectPaymentProvider(settings) {
  const priority = settings.api_payment?.priority || ['bdpay', 'midtrans', 'doku', 'xendit'];
  const providers = settings.api_payment || {};
  for (const name of priority) {
    const p = providers[name];
    if (p && p.active) return name;
  }
  return priority[0] || 'bdpay';
}

async function executePPOBWithSwitching(product, customerNo, refId, settings) {
  const priority = settings.api_ppob?.priority || ['digiflazz', 'iak', 'raja-biller'];
  const tried = [];
  let lastError = null;

  let ordered = [...priority];
  if (product.provider_api) {
    ordered = [product.provider_api, ...priority.filter(p => p !== product.provider_api)];
  }

  for (const providerName of ordered) {
    const key = providerName.replace('-', '_');
    const conf = settings.api_ppob?.[key] || settings.api_ppob?.[providerName];
    if (!conf || !conf.active) continue;

    tried.push(providerName);
    try {
      const result = await executePPOB(providerName, conf, {
        sku: product.sku,
        customerNo,
        refId
      });
      if (result.success) {
        return { ...result, provider: providerName, tried };
      }
      lastError = result.message;
    } catch (err) {
      lastError = err.message;
    }
  }

  return {
    success: false,
    provider: tried[tried.length - 1] || null,
    tried,
    message: lastError || 'Semua provider gagal',
    sn: null
  };
}

async function executePaymentWithSwitching(settings, paymentParams) {
  const priority = settings.api_payment?.priority || ['bdpay', 'midtrans', 'doku', 'xendit'];
  const tried = [];
  let lastError = null;

  for (const name of priority) {
    const conf = settings.api_payment?.[name];
    if (!conf || !conf.active) continue;
    tried.push(name);
    try {
      const result = await executePayment(name, conf, paymentParams);
      if (result.success) {
        return { ...result, provider: name, tried };
      }
      lastError = result.message;
    } catch (err) {
      lastError = err.message;
    }
  }
  return {
    success: false,
    provider: tried[tried.length - 1] || null,
    tried,
    message: lastError || 'Semua payment gateway gagal'
  };
}

// ========== CALLBACK VERIFICATION ==========
function verifyDigiflazzCallback(body, settings) {
  const secret = settings.api_ppob?.digiflazz?.api_key || '';
  if (!body || !body.ref_id) return false;
  if (body.signature && secret) {
    const expected = crypto.createHmac('sha256', secret)
      .update(JSON.stringify({ ref_id: body.ref_id, status: body.status || body.buyer_last_status }))
      .digest('hex');
    return body.signature === expected || body.signature === secret;
  }
  return true;
}

function verifyBdPayCallback(body, settings) {
  if (!body || !body.orderNum) return false;
  return true;
}

function verifyMidtransCallback(body, settings) {
  const serverKey = settings.api_payment?.midtrans?.server_key || '';
  if (!body || !body.order_id) return false;
  if (body.signature_key && serverKey) {
    const str = body.order_id + body.status_code + body.gross_amount + serverKey;
    const expected = crypto.createHash('sha512').update(str).digest('hex');
    return body.signature_key === expected;
  }
  return true;
}

function updateTransactionFromCallback(refId, status, sn, source, rawBody) {
  if (!refId) return;
  const transactions = readJSON('transactions.json');
  const idx = transactions.findIndex(t => t.ref_id === refId || t.id === refId);
  if (idx === -1) {
    console.warn('[CALLBACK] Transaction not found:', refId);
    return;
  }
  transactions[idx].status = status;
  transactions[idx].callback_received = true;
  transactions[idx].callback_source = source;
  transactions[idx].callback_at = new Date().toISOString();
  if (sn) transactions[idx].sn = sn;
  transactions[idx].callback_raw = rawBody;
  if (status === 'failed' && !transactions[idx].refunded) {
    transactions[idx].refund_status = transactions[idx].refund_status || 'pending';
  }
  if (status === 'success') {
    delete transactions[idx].refund_status;
  }
  writeJSON('transactions.json', transactions);
  console.log(`[CALLBACK] Updated ${refId} → ${status} via ${source}`);
}

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function checkAdmin(req, res, next) {
  const auth = req.headers['x-admin-auth'];
  const settings = getSettings();
  if (auth === Buffer.from(`${settings.admin.username}:${settings.admin.password}`).toString('base64')) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

// ========== PUBLIC API ==========
app.get('/api/public/config', (req, res) => {
  const settings = getSettings();
  const cms = readJSON('cms.json');
  res.json({
    success: true,
    data: {
      site: settings.site,
      seo: settings.seo,
      tnc: settings.tnc,
      cms: cms,
      fees: settings.fees,
      google: {
        client_id: settings.google?.client_id || '',
        enabled: settings.google?.enabled !== false
      }
    }
  });
});

app.get('/api/products', (req, res) => {
  const products = readJSON('products.json');
  const category = req.query.category;
  let filtered = products.filter(p => p.active);
  if (category) filtered = filtered.filter(p => p.category === category);
  res.json({ success: true, data: filtered });
});

app.get('/api/faqs', (req, res) => {
  const faqs = readJSON('faqs.json');
  const active = faqs.filter(f => f.active).sort((a, b) => a.order - b.order);
  res.json({ success: true, data: active });
});

app.post('/api/register', (req, res) => {
  const { email, username, bank_account, bank_name, account_holder } = req.body;
  if (!email || !username) {
    return res.status(400).json({ success: false, message: 'Email dan username wajib diisi' });
  }
  const users = readJSON('users.json');
  if (users.find(u => u.email === email || u.username === username)) {
    return res.status(400).json({ success: false, message: 'Email atau username sudah terdaftar' });
  }
  const newUser = {
    id: uuidv4(),
    email,
    username,
    bank_account: bank_account || '',
    bank_name: bank_name || '',
    account_holder: account_holder || '',
    created_at: new Date().toISOString(),
    balance: 0,
    tnc_accepted: true
  };
  users.push(newUser);
  writeJSON('users.json', users);
  res.json({ success: true, message: 'Registrasi berhasil', data: { id: newUser.id, email, username } });
});

app.post('/api/login', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ success: false, message: 'Identifier wajib' });
  const users = readJSON('users.json');
  const user = users.find(u => u.email === identifier || u.username === identifier);
  if (!user) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      bank_account: user.bank_account,
      bank_name: user.bank_name,
      account_holder: user.account_holder,
      balance: user.balance,
      auth_provider: user.auth_provider || 'local'
    }
  });
});

// Google Sign-In / Register (credential = JWT dari Google Identity Services)
// Mode demo: jika client_id kosong atau token demo, terima payload langsung
app.post('/api/auth/google', (req, res) => {
  const { credential, demo_payload } = req.body;
  const settings = getSettings();
  const googleCfg = settings.google || {};

  let email, name, googleId, picture;

  if (demo_payload && (!googleCfg.client_id || googleCfg.client_id === '')) {
    // Demo mode tanpa Google Client ID
    email = demo_payload.email;
    name = demo_payload.name || email.split('@')[0];
    googleId = demo_payload.sub || 'demo-google-' + Date.now();
    picture = demo_payload.picture || '';
  } else if (credential) {
    // Decode JWT payload (tanpa verifikasi signature di demo;
    // production: verifikasi dengan google-auth-library / jwks)
    try {
      const parts = credential.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      email = payload.email;
      name = payload.name || payload.given_name || email.split('@')[0];
      googleId = payload.sub;
      picture = payload.picture || '';
      if (googleCfg.client_id && payload.aud !== googleCfg.client_id) {
        return res.status(401).json({ success: false, message: 'Invalid Google audience' });
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid Google credential: ' + e.message });
    }
  } else {
    return res.status(400).json({ success: false, message: 'Credential atau demo_payload wajib' });
  }

  if (!email) return res.status(400).json({ success: false, message: 'Email Google tidak ditemukan' });

  const users = readJSON('users.json');
  let user = users.find(u => u.email === email || u.google_id === googleId);

  if (!user) {
    // Auto-register
    const baseUsername = (name || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
    let username = baseUsername;
    let i = 1;
    while (users.find(u => u.username === username)) {
      username = baseUsername + i;
      i++;
    }
    user = {
      id: uuidv4(),
      email,
      username,
      google_id: googleId,
      picture,
      bank_account: '',
      bank_name: '',
      account_holder: '',
      created_at: new Date().toISOString(),
      balance: 0,
      tnc_accepted: true,
      auth_provider: 'google'
    };
    users.push(user);
    writeJSON('users.json', users);
  } else {
    // Update google info
    user.google_id = googleId;
    user.picture = picture || user.picture;
    user.auth_provider = user.auth_provider || 'google';
    const idx = users.findIndex(u => u.id === user.id);
    users[idx] = user;
    writeJSON('users.json', users);
  }

  res.json({
    success: true,
    message: user.created_at === user.updated_at ? 'Registrasi Google berhasil' : 'Login Google berhasil',
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      bank_account: user.bank_account,
      bank_name: user.bank_name,
      account_holder: user.account_holder,
      balance: user.balance,
      picture: user.picture,
      auth_provider: 'google'
    }
  });
});

// Public demo account info
app.get('/api/public/demo-account', (req, res) => {
  res.json({
    success: true,
    data: {
      identifier: 'demo',
      email: 'demo@ppob.local',
      username: 'demo',
      note: 'Klik untuk login cepat sebagai demo (tanpa password)'
    }
  });
});

app.post('/api/order', async (req, res) => {
  const { user_id, product_id, customer_no, payment_method, agreement_accepted } = req.body;
  if (!agreement_accepted) {
    return res.status(400).json({ success: false, message: 'Anda harus menyetujui Agreement pembelian' });
  }

  const products = readJSON('products.json');
  const product = products.find(p => p.id === product_id && p.active);
  if (!product) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau nonaktif' });

  const users = readJSON('users.json');
  const user = users.find(u => u.id === user_id);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

  const settings = getSettings();
  let fee = settings.fees.global_fixed || 0;
  if (settings.fees.global_percent) fee += Math.round(product.price * (settings.fees.global_percent / 100));
  if (settings.fees.per_product?.[product_id]) {
    const pf = settings.fees.per_product[product_id];
    fee = (pf.fixed || 0) + Math.round(product.price * ((pf.percent || 0) / 100));
  }
  fee += product.admin_fee || 0;
  const total = product.price + fee;
  const ref_id = 'TRX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  // 1) Buat pembayaran via payment gateway (auto-switch)
  const host = req.protocol + '://' + req.get('host');
  const payResult = await executePaymentWithSwitching(settings, {
    orderId: ref_id,
    amount: total,
    method: payment_method || 'qris',
    name: user.account_holder || user.username,
    email: user.email,
    phone: customer_no,
    customer: { name: user.account_holder || user.username, email: user.email, phone: customer_no },
    notifyUrl: host + '/api/callback/bdpay',
    callbackUrl: host + '/api/callback/doku',
    successUrl: host + '/?paid=1',
    failureUrl: host + '/?paid=0'
  });

  // 2) Proses PPOB via provider (auto-switch) — di production bisa ditunda sampai payment settled via callback
  const ppobResult = await executePPOBWithSwitching(product, customer_no, ref_id, settings);

  const status = ppobResult.success ? (ppobResult.pending ? 'pending' : 'success') : 'failed';
  const transaction = {
    id: uuidv4(),
    ref_id,
    user_id,
    product_id,
    product_name: product.name,
    product_sku: product.sku,
    customer_no,
    amount: product.price,
    fee,
    total,
    payment_method: payment_method || 'qris',
    provider_ppob: ppobResult.provider,
    provider_ppob_tried: ppobResult.tried || [],
    provider_payment: payResult.provider,
    provider_payment_tried: payResult.tried || [],
    status,
    sn: ppobResult.sn || null,
    message: ppobResult.message,
    payment_url: payResult.payment_url || null,
    va_number: payResult.va_number || null,
    va_bank: payResult.va_bank || null,
    qr_string: payResult.qr_string || null,
    payment_simulated: !!payResult.simulated,
    ppob_simulated: !!ppobResult.simulated,
    created_at: new Date().toISOString(),
    refunded: false,
    callback_received: false
  };

  if (!ppobResult.success) {
    transaction.refund_status = 'pending';
    transaction.refund_to = {
      bank: user.bank_name,
      account: user.bank_account,
      holder: user.account_holder
    };
  }

  const transactions = readJSON('transactions.json');
  transactions.push(transaction);
  writeJSON('transactions.json', transactions);

  res.json({
    success: true,
    data: {
      ref_id,
      transaction_id: transaction.id,
      status,
      total,
      fee,
      sn: transaction.sn,
      provider_ppob: ppobResult.provider,
      provider_ppob_tried: ppobResult.tried,
      provider_payment: payResult.provider,
      provider_payment_tried: payResult.tried,
      message: ppobResult.message,
      payment_url: payResult.payment_url,
      va_number: payResult.va_number,
      va_bank: payResult.va_bank,
      qr_string: payResult.qr_string || (payment_method === 'qris' ? '00020101021226DEMO' + ref_id : null),
      simulated: {
        payment: !!payResult.simulated,
        ppob: !!ppobResult.simulated
      }
    }
  });
});

// ========== RECEIPT ==========
app.get('/api/receipt/:ref_id', (req, res) => {
  const transactions = readJSON('transactions.json');
  const tx = transactions.find(t => t.ref_id === req.params.ref_id || t.id === req.params.ref_id);
  if (!tx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

  const settings = getSettings();
  const users = readJSON('users.json');
  const user = users.find(u => u.id === tx.user_id);

  const receipt = {
    company: settings.site?.name || 'PPOB Mobile',
    copyright: settings.site?.copyright || 'PT AREK ATUR AMANAH @2026',
    ref_id: tx.ref_id,
    date: tx.created_at,
    product: tx.product_name,
    sku: tx.product_sku,
    customer_no: tx.customer_no,
    amount: tx.amount,
    fee: tx.fee,
    total: tx.total,
    status: tx.status,
    sn: tx.sn,
    provider: tx.provider_ppob,
    payment_method: tx.payment_method,
    payment_provider: tx.provider_payment,
    customer: user ? { username: user.username, email: user.email } : null,
    message: tx.message
  };

  if (req.query.format === 'html' || (req.headers.accept && req.headers.accept.includes('text/html'))) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(generateReceiptHTML(receipt));
  }
  res.json({ success: true, data: receipt });
});

function generateReceiptHTML(r) {
  const statusColor = r.status === 'success' ? '#198754' : '#dc3545';
  const statusText = r.status === 'success' ? 'BERHASIL' : 'GAGAL';
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Struk ${r.ref_id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', monospace; background: #f5f5f5; padding: 20px; }
    .receipt { max-width: 320px; margin: 0 auto; background: #fff; padding: 24px; border: 1px dashed #ccc; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-top: 1px dashed #999; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
    .status { color: ${statusColor}; font-size: 18px; font-weight: bold; margin: 8px 0; }
    .sn { background: #f0f0f0; padding: 8px; margin: 8px 0; word-break: break-all; font-size: 12px; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none; }
      .receipt { border: none; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold" style="font-size:16px">${r.company}</div>
    <div class="center" style="font-size:11px;color:#666">${r.copyright}</div>
    <div class="line"></div>
    <div class="center status">${statusText}</div>
    <div class="row"><span>No. Ref</span><span class="bold">${r.ref_id}</span></div>
    <div class="row"><span>Tanggal</span><span>${new Date(r.date).toLocaleString('id-ID')}</span></div>
    <div class="line"></div>
    <div class="row"><span>Produk</span><span>${r.product}</span></div>
    <div class="row"><span>SKU</span><span>${r.sku || '-'}</span></div>
    <div class="row"><span>No. Tujuan</span><span class="bold">${r.customer_no}</span></div>
    <div class="line"></div>
    <div class="row"><span>Harga</span><span>Rp ${Number(r.amount).toLocaleString('id-ID')}</span></div>
    <div class="row"><span>Biaya Layanan</span><span>Rp ${Number(r.fee).toLocaleString('id-ID')}</span></div>
    <div class="row bold"><span>TOTAL</span><span>Rp ${Number(r.total).toLocaleString('id-ID')}</span></div>
    <div class="line"></div>
    <div class="row"><span>Pembayaran</span><span>${r.payment_method} (${r.payment_provider})</span></div>
    <div class="row"><span>Provider</span><span>${r.provider || '-'}</span></div>
    ${r.sn ? `<div class="sn"><strong>SN / Token:</strong><br>${r.sn}</div>` : ''}
    <div class="line"></div>
    <div class="center" style="font-size:11px;color:#666">Terima kasih atas transaksi Anda<br>Simpan struk ini sebagai bukti</div>
  </div>
  <div class="center no-print" style="margin-top:16px">
    <button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;background:#0d6efd;color:#fff;border:none;border-radius:6px">Cetak Struk</button>
  </div>
</body>
</html>`;
}

// ========== SALES REPORT ==========
app.get('/api/admin/reports/sales', checkAdmin, (req, res) => {
  const { from, to, group_by } = req.query;
  let transactions = readJSON('transactions.json');

  if (from) {
    const fromDate = new Date(from);
    transactions = transactions.filter(t => new Date(t.created_at) >= fromDate);
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    transactions = transactions.filter(t => new Date(t.created_at) <= toDate);
  }

  const successTx = transactions.filter(t => t.status === 'success');
  const failedTx = transactions.filter(t => t.status === 'failed');

  const summary = {
    total_transactions: transactions.length,
    success_count: successTx.length,
    failed_count: failedTx.length,
    success_rate: transactions.length ? Math.round((successTx.length / transactions.length) * 100) : 0,
    total_revenue: successTx.reduce((s, t) => s + (t.total || 0), 0),
    total_product_amount: successTx.reduce((s, t) => s + (t.amount || 0), 0),
    total_fee: successTx.reduce((s, t) => s + (t.fee || 0), 0),
    refunded_count: transactions.filter(t => t.refunded).length
  };

  let grouped = {};
  const gb = group_by || 'day';

  transactions.forEach(t => {
    let key;
    if (gb === 'month') key = t.created_at.slice(0, 7);
    else if (gb === 'product') key = t.product_name || t.product_id;
    else if (gb === 'provider') key = t.provider_ppob || 'unknown';
    else key = t.created_at.slice(0, 10);

    if (!grouped[key]) {
      grouped[key] = { key, count: 0, success: 0, failed: 0, revenue: 0, fee: 0 };
    }
    grouped[key].count++;
    if (t.status === 'success') {
      grouped[key].success++;
      grouped[key].revenue += t.total || 0;
      grouped[key].fee += t.fee || 0;
    } else {
      grouped[key].failed++;
    }
  });

  const groups = Object.values(grouped).sort((a, b) => {
    if (gb === 'day' || gb === 'month') return a.key.localeCompare(b.key);
    return b.revenue - a.revenue;
  });

  res.json({
    success: true,
    data: { period: { from: from || null, to: to || null }, summary, groups, group_by: gb }
  });
});

// ========== CALLBACKS ==========
app.post('/api/callback/digiflazz', (req, res) => {
  const settings = getSettings();
  const body = req.body;
  console.log('[CALLBACK Digiflazz]', JSON.stringify(body).slice(0, 300));
  if (!verifyDigiflazzCallback(body, settings)) {
    return res.status(403).json({ success: false, message: 'Invalid signature' });
  }
  const refId = body.ref_id || body.data?.ref_id;
  const statusRaw = body.buyer_last_status || body.status || body.data?.status || '';
  const isSuccess = ['Sukses', 'success', 'SUCCESS', '1'].includes(String(statusRaw));
  const sn = body.sn || body.data?.sn || null;
  updateTransactionFromCallback(refId, isSuccess ? 'success' : 'failed', sn, 'digiflazz', body);
  res.json({ data: { status: true } });
});

app.post('/api/callback/bdpay', (req, res) => {
  const settings = getSettings();
  const body = req.body;
  console.log('[CALLBACK bdPay]', JSON.stringify(body).slice(0, 300));
  if (!verifyBdPayCallback(body, settings)) {
    return res.status(403).json({ success: false, message: 'Invalid signature' });
  }
  const refId = body.orderNum || body.merchantOrderId;
  const isSuccess = body.platRespCode === 'SUCCESS' || body.status === 'PAID' || body.status === 'success';
  updateTransactionFromCallback(refId, isSuccess ? 'success' : 'failed', null, 'bdpay', body);
  res.json({ success: true });
});

app.post('/api/callback/midtrans', (req, res) => {
  const settings = getSettings();
  const body = req.body;
  console.log('[CALLBACK Midtrans]', JSON.stringify(body).slice(0, 300));
  if (!verifyMidtransCallback(body, settings)) {
    return res.status(403).json({ success: false, message: 'Invalid signature' });
  }
  const refId = body.order_id;
  const isSuccess = body.transaction_status === 'settlement' || body.transaction_status === 'capture';
  updateTransactionFromCallback(refId, isSuccess ? 'success' : 'failed', null, 'midtrans', body);
  res.json({ success: true });
});

app.post('/api/callback/iak', (req, res) => {
  const body = req.body;
  console.log('[CALLBACK IAK]', JSON.stringify(body).slice(0, 300));
  const refId = body.ref_id || body.data?.ref_id;
  const status = body.status || body.data?.status;
  const isSuccess = status == 1 || status === 'success' || status === 'SUCCESS';
  const sn = body.sn || body.data?.sn;
  updateTransactionFromCallback(refId, isSuccess ? 'success' : 'failed', sn, 'iak', body);
  res.json({ success: true });
});

app.get('/api/user/:id/transactions', (req, res) => {
  const transactions = readJSON('transactions.json');
  const userTx = transactions.filter(t => t.user_id === req.params.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, data: userTx });
});

// ========== ADMIN ==========
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const settings = getSettings();
  if (username === settings.admin.username && password === settings.admin.password) {
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'Login gagal' });
});

app.get('/api/admin/products', checkAdmin, (req, res) => {
  res.json({ success: true, data: readJSON('products.json') });
});

app.post('/api/admin/products', checkAdmin, (req, res) => {
  const products = readJSON('products.json');
  const newProd = { id: 'prod-' + uuidv4().slice(0, 8), ...req.body, active: req.body.active !== false };
  products.push(newProd);
  writeJSON('products.json', products);
  res.json({ success: true, data: newProd });
});

app.put('/api/admin/products/:id', checkAdmin, (req, res) => {
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Not found' });
  products[idx] = { ...products[idx], ...req.body };
  writeJSON('products.json', products);
  res.json({ success: true, data: products[idx] });
});

app.delete('/api/admin/products/:id', checkAdmin, (req, res) => {
  let products = readJSON('products.json');
  products = products.filter(p => p.id !== req.params.id);
  writeJSON('products.json', products);
  res.json({ success: true });
});

app.get('/api/admin/faqs', checkAdmin, (req, res) => {
  res.json({ success: true, data: readJSON('faqs.json') });
});

app.post('/api/admin/faqs', checkAdmin, (req, res) => {
  const faqs = readJSON('faqs.json');
  const newFaq = { id: 'faq-' + uuidv4().slice(0, 8), ...req.body, active: true };
  faqs.push(newFaq);
  writeJSON('faqs.json', faqs);
  res.json({ success: true, data: newFaq });
});

app.put('/api/admin/faqs/:id', checkAdmin, (req, res) => {
  const faqs = readJSON('faqs.json');
  const idx = faqs.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  faqs[idx] = { ...faqs[idx], ...req.body };
  writeJSON('faqs.json', faqs);
  res.json({ success: true, data: faqs[idx] });
});

app.delete('/api/admin/faqs/:id', checkAdmin, (req, res) => {
  let faqs = readJSON('faqs.json');
  faqs = faqs.filter(f => f.id !== req.params.id);
  writeJSON('faqs.json', faqs);
  res.json({ success: true });
});

app.get('/api/admin/settings', checkAdmin, (req, res) => {
  res.json({ success: true, data: getSettings() });
});

app.put('/api/admin/settings', checkAdmin, (req, res) => {
  const current = getSettings();
  const updated = { ...current, ...req.body };
  writeJSON('settings.json', updated);
  res.json({ success: true, data: updated });
});

app.get('/api/admin/cms', checkAdmin, (req, res) => {
  res.json({ success: true, data: readJSON('cms.json') });
});

app.put('/api/admin/cms', checkAdmin, (req, res) => {
  writeJSON('cms.json', req.body);
  res.json({ success: true });
});

app.get('/api/admin/transactions', checkAdmin, (req, res) => {
  res.json({ success: true, data: readJSON('transactions.json') });
});

app.post('/api/admin/refund/:id', checkAdmin, (req, res) => {
  const transactions = readJSON('transactions.json');
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  if (transactions[idx].status !== 'failed' || transactions[idx].refunded) {
    return res.status(400).json({ success: false, message: 'Tidak bisa refund' });
  }
  transactions[idx].refunded = true;
  transactions[idx].refund_status = 'completed';
  transactions[idx].refunded_at = new Date().toISOString();
  writeJSON('transactions.json', transactions);
  res.json({ success: true, message: 'Refund diproses (simulasi ke rekening pengguna)', data: transactions[idx] });
});

app.get('/api/admin/users', checkAdmin, (req, res) => {
  const users = readJSON('users.json');
  res.json({
    success: true,
    data: users.map(u => ({
      id: u.id, email: u.email, username: u.username,
      created_at: u.created_at, bank_account: u.bank_account, bank_name: u.bank_name
    }))
  });
});

function migrateToEncrypted() {
  ENCRYPTED_FILES.forEach(filename => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (raw.startsWith('ENC:')) return;
    try {
      const data = JSON.parse(raw);
      writeJSON(filename, data);
      console.log(`[SECURITY] Encrypted ${filename}`);
    } catch (e) { /* ignore */ }
  });
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

migrateToEncrypted();

app.listen(PORT, () => {
  console.log(`PPOB Mobile Site running at http://localhost:${PORT}`);
  console.log(`Admin default: admin / admin123`);
  console.log(`[SECURITY] AES-256-GCM encryption active for: ${ENCRYPTED_FILES.join(', ')}`);
  console.log(`[CALLBACK] Digiflazz: POST /api/callback/digiflazz`);
  console.log(`[CALLBACK] bdPay:     POST /api/callback/bdpay`);
  console.log(`[CALLBACK] Midtrans:  POST /api/callback/midtrans`);
  console.log(`[CALLBACK] IAK:       POST /api/callback/iak`);
});
