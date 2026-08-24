/**
 * PPOB & Payment Provider Integrations
 * Digiflazz, IAK, Raja-Biller | bdPay, Midtrans, DOKU, Xendit
 * Menggunakan native fetch (Node 18+). Fallback mock jika kredensial kosong.
 */
const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function sha512(str) {
  return crypto.createHash('sha512').update(str).digest('hex');
}

async function httpJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function hasCreds(obj, keys) {
  return keys.every(k => obj && obj[k] && String(obj[k]).trim() !== '');
}

// ===================== PPOB: DIGIFLAZZ =====================
async function digiflazzTopup({ username, apiKey, baseUrl, mode }, { sku, customerNo, refId }) {
  const url = (baseUrl || 'https://api.digiflazz.com/v1').replace(/\/$/, '') + '/transaction';
  const sign = md5(username + apiKey + refId);
  const body = {
    username,
    buyer_sku_code: sku,
    customer_no: customerNo,
    ref_id: refId,
    sign
  };
  if (mode === 'sandbox' || mode === 'development') body.testing = true;

  const { ok, data } = await httpJson(url, { method: 'POST', body: JSON.stringify(body) });
  const d = data?.data || data || {};
  const statusRaw = (d.status || '').toString().toLowerCase();
  const success = statusRaw === 'sukses' || statusRaw === 'success';
  const pending = statusRaw === 'pending' || statusRaw === '0';
  return {
    success: success || pending,
    pending,
    message: d.message || (success ? 'Sukses via Digiflazz' : pending ? 'Pending Digiflazz' : (d.message || 'Gagal Digiflazz')),
    sn: d.sn || null,
    rc: d.rc,
    price: d.price,
    raw: d,
    provider: 'digiflazz'
  };
}

// ===================== PPOB: IAK =====================
async function iakTopup({ username, apiKey, baseUrlPrepaid, mode }, { sku, customerNo, refId }) {
  const base = (baseUrlPrepaid || (mode === 'production' ? 'https://prepaid.iak.id' : 'https://prepaid.iak.dev')).replace(/\/$/, '');
  const url = base + '/api/top-up';
  const sign = md5(username + apiKey + refId);
  const body = {
    username,
    ref_id: refId,
    customer_id: customerNo,
    product_code: sku,
    sign
  };

  const { ok, data } = await httpJson(url, { method: 'POST', body: JSON.stringify(body) });
  const d = data?.data || data || {};
  // IAK: status 1 = success, 0/2 = process/failed depending on docs
  const code = d.status ?? d.response_code ?? data?.status;
  const success = code == 1 || code === '1' || String(d.message || '').toLowerCase().includes('success');
  const pending = code == 0 || code === '0' || code == 2;
  return {
    success: success || pending,
    pending: !success && pending,
    message: d.message || data?.message || (success ? 'Sukses via IAK' : 'Response IAK'),
    sn: d.sn || d.serial_number || null,
    rc: code,
    raw: d,
    provider: 'iak'
  };
}

// ===================== PPOB: RAJA-BILLER =====================
// Generic REST shape umum dipakai aggregator Indonesia (sesuaikan base_url & path di settings)
async function rajaBillerTopup({ username, apiKey, baseUrl }, { sku, customerNo, refId }) {
  if (!baseUrl) {
    return { success: false, message: 'Raja-Biller base_url belum di-set', provider: 'raja-biller' };
  }
  const url = baseUrl.replace(/\/$/, '') + '/transaction';
  const sign = md5(username + apiKey + refId);
  const body = {
    username,
    product_code: sku,
    customer_no: customerNo,
    ref_id: refId,
    sign
  };
  const { ok, data } = await httpJson(url, { method: 'POST', body: JSON.stringify(body) });
  const d = data?.data || data || {};
  const statusRaw = String(d.status || d.rc || '').toLowerCase();
  const success = ['sukses', 'success', '1', '00'].includes(statusRaw);
  return {
    success,
    message: d.message || (success ? 'Sukses via Raja-Biller' : 'Gagal Raja-Biller'),
    sn: d.sn || null,
    raw: d,
    provider: 'raja-biller'
  };
}

// ===================== PAYMENT: bdPay =====================
async function bdpayCreatePayment({ merchantCode, apiKey, baseUrl, mode }, { orderId, amount, method, name, email, phone, notifyUrl }) {
  const base = (baseUrl || (mode === 'production' ? 'https://openapi.bdpay.co.id' : 'https://dev-openapi.bdpay.co.id')).replace(/\/$/, '');
  const url = base + '/gateway/prepaidOrder';
  // Mapping metode internal → kode bdPay
  const methodMap = {
    qris: 'QRIS',
    va_bca: 'VA_BCA',
    va_bri: 'VA_BRI',
    va_mandiri: 'VA_MANDIRI',
    va_bni: 'VA_BNI',
    ewallet: 'QRIS'
  };
  const body = {
    merchantCode,
    method: methodMap[method] || method || 'QRIS',
    orderNum: orderId,
    payMoney: String(amount),
    productDetail: 'PPOB Payment',
    name: name || 'Customer',
    email: email || 'customer@ppob.local',
    phone: phone || '081234567890',
    notifyUrl: notifyUrl || '',
    expiryPeriod: '30',
    dateTime: new Date().toISOString()
  };
  // Sign: production biasanya RSA; di sini kirim apiKey sebagai placeholder field jika diminta
  if (apiKey) body.sign = apiKey;

  const { ok, data } = await httpJson(url, { method: 'POST', body: JSON.stringify(body) });
  const success = data?.platRespCode === 'SUCCESS' || ok;
  return {
    success,
    message: data?.platRespMessage || (success ? 'Payment created' : 'bdPay error'),
    payment_url: data?.url || null,
    plat_order: data?.platOrderNum || null,
    va_number: data?.vaNumber || data?.payCode || null,
    qr_string: data?.qrContent || data?.qrString || null,
    raw: data,
    provider: 'bdpay'
  };
}

// ===================== PAYMENT: MIDTRANS =====================
async function midtransCharge({ serverKey, baseUrl, mode }, { orderId, amount, method, customer }) {
  const isProd = mode === 'production';
  const base = (baseUrl || (isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com')).replace(/\/$/, '');
  const url = base + '/v2/charge';
  const auth = Buffer.from(serverKey + ':').toString('base64');

  let body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(amount)
    },
    customer_details: {
      first_name: customer?.name || 'Customer',
      email: customer?.email || 'customer@ppob.local',
      phone: customer?.phone || '081234567890'
    }
  };

  if (method === 'qris' || method === 'ewallet') {
    body.payment_type = 'qris';
    body.qris = { acquirer: 'gopay' };
  } else if (method?.startsWith('va_')) {
    const bank = method.replace('va_', ''); // bca, bri, mandiri, bni
    body.payment_type = 'bank_transfer';
    body.bank_transfer = { bank };
  } else {
    body.payment_type = 'qris';
  }

  const { ok, data } = await httpJson(url, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth },
    body: JSON.stringify(body)
  });

  const success = ['201', '200'].includes(String(data?.status_code)) || ok;
  const va = data?.va_numbers?.[0];
  const qrAction = (data?.actions || []).find(a => a.name === 'generate-qr-code');

  return {
    success,
    message: data?.status_message || (success ? 'Midtrans charge OK' : 'Midtrans error'),
    payment_url: qrAction?.url || null,
    va_number: va?.va_number || data?.permata_va_number || null,
    va_bank: va?.bank || null,
    qr_string: null,
    transaction_id: data?.transaction_id,
    raw: data,
    provider: 'midtrans'
  };
}

// ===================== PAYMENT: DOKU (Checkout-style simplified) =====================
async function dokuCreatePayment({ clientId, sharedKey, baseUrl, mode }, { orderId, amount, method, customer, callbackUrl, returnUrl }) {
  // DOKU Checkout / payment request — struktur disederhanakan; production sesuaikan SNAP headers
  const base = (baseUrl || (mode === 'production' ? 'https://api.doku.com' : 'https://api-sandbox.doku.com')).replace(/\/$/, '');
  const url = base + '/checkout/v1/payment';
  const requestId = orderId;
  const requestTimestamp = new Date().toISOString();
  // Signature sederhana (production DOKU memakai HMAC SHA256 dengan komponen tertentu)
  const digest = crypto.createHmac('sha256', sharedKey || '')
    .update(clientId + requestId + requestTimestamp + amount)
    .digest('base64');

  const body = {
    order: {
      invoice_number: orderId,
      amount: Math.round(amount),
      currency: 'IDR',
      callback_url: callbackUrl || '',
      callback_url_cancel: returnUrl || ''
    },
    payment: {
      payment_due_date: 60
    },
    customer: {
      name: customer?.name || 'Customer',
      email: customer?.email || 'customer@ppob.local',
      phone: customer?.phone || '081234567890'
    }
  };

  const { ok, data } = await httpJson(url, {
    method: 'POST',
    headers: {
      'Client-Id': clientId || '',
      'Request-Id': requestId,
      'Request-Timestamp': requestTimestamp,
      Signature: 'HMACSHA256=' + digest
    },
    body: JSON.stringify(body)
  });

  return {
    success: ok && !data?.error,
    message: data?.message || (ok ? 'DOKU payment created' : 'DOKU error'),
    payment_url: data?.response?.payment?.url || data?.payment?.url || data?.url || null,
    raw: data,
    provider: 'doku'
  };
}

// ===================== PAYMENT: XENDIT =====================
async function xenditCreateInvoice({ secretKey, baseUrl, mode }, { orderId, amount, method, customer, successUrl, failureUrl }) {
  const base = (baseUrl || 'https://api.xendit.co').replace(/\/$/, '');
  const url = base + '/v2/invoices';
  const auth = Buffer.from(secretKey + ':').toString('base64');

  const paymentMethods = [];
  if (method === 'qris' || method === 'ewallet') {
    paymentMethods.push('QRIS', 'OVO', 'DANA', 'LINKAJA', 'SHOPEEPAY');
  } else if (method?.startsWith('va_')) {
    paymentMethods.push('BANK_TRANSFER');
  } else {
    paymentMethods.push('QRIS', 'BANK_TRANSFER', 'OVO', 'DANA');
  }

  const body = {
    external_id: orderId,
    amount: Math.round(amount),
    description: 'PPOB Payment ' + orderId,
    invoice_duration: 3600,
    currency: 'IDR',
    payer_email: customer?.email || 'customer@ppob.local',
    customer: {
      given_names: customer?.name || 'Customer',
      email: customer?.email || 'customer@ppob.local',
      mobile_number: customer?.phone || '+6281234567890'
    },
    success_redirect_url: successUrl || '',
    failure_redirect_url: failureUrl || '',
    payment_methods: paymentMethods
  };

  const { ok, data } = await httpJson(url, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth },
    body: JSON.stringify(body)
  });

  return {
    success: ok && data?.id,
    message: data?.message || (ok ? 'Xendit invoice created' : 'Xendit error'),
    payment_url: data?.invoice_url || null,
    invoice_id: data?.id,
    raw: data,
    provider: 'xendit'
  };
}

// ===================== ORCHESTRATORS =====================

async function executePPOB(providerName, conf, params) {
  // Tanpa kredensial → mock agar demo tetap jalan
  const need = {
    digiflazz: ['username', 'api_key'],
    iak: ['username', 'api_key'],
    'raja-biller': ['username', 'api_key']
  };
  const keys = need[providerName] || ['username', 'api_key'];
  const confNorm = {
    username: conf.username,
    apiKey: conf.api_key || conf.apiKey,
    baseUrl: conf.base_url,
    baseUrlPrepaid: conf.base_url_prepaid,
    mode: conf.mode || 'sandbox'
  };

  if (!hasCreds(confNorm, providerName === 'digiflazz' || providerName === 'iak' ? ['username', 'apiKey'] : ['username', 'apiKey'])) {
    // Mock
    await new Promise(r => setTimeout(r, 100));
    const ok = Math.random() < 0.85;
    return {
      success: ok,
      pending: false,
      message: ok ? `Berhasil via ${providerName} (simulasi — isi API key untuk live)` : `${providerName} temporary unavailable (simulasi)`,
      sn: ok ? 'SN' + Date.now().toString().slice(-10) : null,
      provider: providerName,
      simulated: true
    };
  }

  try {
    if (providerName === 'digiflazz') return await digiflazzTopup(confNorm, params);
    if (providerName === 'iak') return await iakTopup(confNorm, params);
    if (providerName === 'raja-biller') return await rajaBillerTopup(confNorm, params);
    return { success: false, message: 'Provider tidak dikenal: ' + providerName, provider: providerName };
  } catch (err) {
    return { success: false, message: err.message || String(err), provider: providerName };
  }
}

async function executePayment(providerName, conf, params) {
  const confNorm = {
    merchantCode: conf.merchant_code,
    apiKey: conf.api_key,
    serverKey: conf.server_key,
    clientKey: conf.client_key,
    clientId: conf.client_id,
    sharedKey: conf.shared_key,
    secretKey: conf.secret_key,
    baseUrl: conf.base_url,
    mode: conf.mode || 'sandbox'
  };

  const hasReal = {
    bdpay: hasCreds(confNorm, ['merchantCode']),
    midtrans: hasCreds(confNorm, ['serverKey']),
    doku: hasCreds(confNorm, ['clientId', 'sharedKey']),
    xendit: hasCreds(confNorm, ['secretKey'])
  };

  if (!hasReal[providerName]) {
    await new Promise(r => setTimeout(r, 80));
    return {
      success: true,
      message: `Payment ${providerName} (simulasi — isi kredensial untuk live)`,
      payment_url: null,
      va_number: providerName === 'midtrans' || providerName === 'bdpay' ? '8808' + Date.now().toString().slice(-10) : null,
      qr_string: params.method === 'qris' ? '00020101021226DEMO' + params.orderId : null,
      provider: providerName,
      simulated: true
    };
  }

  try {
    if (providerName === 'bdpay') return await bdpayCreatePayment(confNorm, params);
    if (providerName === 'midtrans') return await midtransCharge(confNorm, params);
    if (providerName === 'doku') return await dokuCreatePayment(confNorm, params);
    if (providerName === 'xendit') return await xenditCreateInvoice(confNorm, params);
    return { success: false, message: 'Payment provider tidak dikenal', provider: providerName };
  } catch (err) {
    return { success: false, message: err.message || String(err), provider: providerName };
  }
}

module.exports = {
  executePPOB,
  executePayment,
  digiflazzTopup,
  iakTopup,
  rajaBillerTopup,
  bdpayCreatePayment,
  midtransCharge,
  dokuCreatePayment,
  xenditCreateInvoice,
  md5,
  sha512
};
