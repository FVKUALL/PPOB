/**
 * PPOB Mobile Site Frontend
 * LocalStorage for session + fetch to JSON-backed API
 * W3C compliant, mobile-first, PWA-ready
 */

const API = '/api';
const STORAGE_KEY = 'ppob_user';

// ========== Utils ==========
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch { return null; }
}

function setUser(user) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
  updateHeader();
}

function updateHeader() {
  const user = getUser();
  const btnLogin = $('#btn-login');
  const btnRegister = $('#btn-register');
  const userMenu = $('#user-menu');
  if (user) {
    btnLogin.classList.add('hidden');
    btnRegister.classList.add('hidden');
    userMenu.classList.remove('hidden');
    $('#user-name').textContent = user.username;
    // Ensure history button exists
    if (!$('#btn-history')) {
      const btn = document.createElement('button');
      btn.id = 'btn-history';
      btn.className = 'btn btn-sm btn-outline';
      btn.textContent = 'Riwayat';
      btn.onclick = openHistoryModal;
      userMenu.insertBefore(btn, $('#btn-logout'));
    }
  } else {
    btnLogin.classList.remove('hidden');
    btnRegister.classList.remove('hidden');
    userMenu.classList.add('hidden');
    const bh = $('#btn-history');
    if (bh) bh.remove();
  }
}

function showModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
}

function closeModal() {
  $('#modal-overlay').classList.add('hidden');
  $('#modal-content').innerHTML = '';
}

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

// ========== Load Config & CMS ==========
async function loadConfig() {
  try {
    const res = await fetch(`${API}/public/config`);
    const json = await res.json();
    if (!json.success) return;
    const { site, seo, cms, tnc } = json.data;

    document.title = seo.title || 'PPOB Mobile';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = seo.description || '';

    $('#site-logo').textContent = site.name || 'PPOB Mobile';
    $('#hero-title').textContent = cms.pages?.home?.hero_title || 'Pembayaran Digital Mudah & Aman';
    $('#hero-subtitle').textContent = cms.pages?.home?.hero_subtitle || '';
    $('#copyright').textContent = '© ' + (site.copyright || 'PT AREK ATUR AMANAH @2026');

    // Features
    const grid = $('#features-grid');
    grid.innerHTML = (cms.pages?.home?.features || []).map(f => `
      <div class="feature-card">
        <div class="icon">${f.icon}</div>
        <h3>${f.title}</h3>
        <p>${f.desc}</p>
      </div>
    `).join('');

    // Store T&C & Google config
    window.__tnc = tnc;
    window.__google = json.data.google || { client_id: '', enabled: true };
  } catch (e) {
    console.error('Config load error', e);
  }
}

// ========== Products ==========
let allProducts = [];

async function loadProducts() {
  try {
    const res = await fetch(`${API}/products`);
    const json = await res.json();
    if (json.success) {
      allProducts = json.data;
      renderProducts('all');
    }
  } catch (e) {
    console.error(e);
  }
}

function renderProducts(cat) {
  const grid = $('#products-grid');
  let list = allProducts;
  if (cat !== 'all') list = allProducts.filter(p => p.category === cat);

  if (list.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:#6c757d">Tidak ada produk aktif.</p>';
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="product-card">
      <span class="category-badge ${p.category}">${p.category === 'prabayar' ? 'Prabayar' : 'Pascabayar'}</span>
      <h3>${p.name}</h3>
      <div class="provider">${p.provider}</div>
      <div class="price">${p.price > 0 ? formatRupiah(p.price) : 'Inquiry'}</div>
      <button class="btn btn-primary btn-block" onclick="openBuyModal('${p.id}')">Beli Sekarang</button>
    </div>
  `).join('');
}

// ========== FAQ ==========
async function loadFaqs() {
  try {
    const res = await fetch(`${API}/faqs`);
    const json = await res.json();
    if (!json.success) return;
    const list = $('#faq-list');
    list.innerHTML = json.data.map(f => `
      <div class="faq-item">
        <div class="faq-question">${f.question}</div>
        <div class="faq-answer">${f.answer}</div>
      </div>
    `).join('');

    $$('.faq-question').forEach(q => {
      q.addEventListener('click', () => {
        q.parentElement.classList.toggle('open');
      });
    });
  } catch (e) {
    console.error(e);
  }
}

// ========== Auth Modals ==========
function googleAuthButtonsHtml(containerId) {
  return `
    <div id="${containerId}" style="margin:12px 0;text-align:center"></div>
    <div style="text-align:center;margin:8px 0;color:#6c757d;font-size:0.85rem">— atau —</div>
  `;
}

function renderGoogleButton(containerId) {
  const g = window.__google || {};
  const el = document.getElementById(containerId);
  if (!el) return;

  if (g.enabled && g.client_id) {
    // Real Google Identity Services
    if (!window.google?.accounts) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => initGoogleBtn(containerId, g.client_id);
      document.head.appendChild(s);
    } else {
      initGoogleBtn(containerId, g.client_id);
    }
  } else {
    // Demo Google button (simulasi)
    el.innerHTML = `
      <button type="button" class="btn btn-block" id="btn-google-demo" style="background:#fff;border:1px solid #dadce0;color:#3c4043;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Lanjutkan dengan Google (Demo)
      </button>
    `;
    $('#btn-google-demo')?.addEventListener('click', () => doGoogleDemoLogin());
  }
}

function initGoogleBtn(containerId, clientId) {
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response) => {
      try {
        const res = await fetch(`${API}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential })
        });
        const json = await res.json();
        if (json.success) {
          setUser(json.data);
          closeModal();
        } else {
          alert(json.message || 'Google login gagal');
        }
      } catch {
        alert('Gagal terhubung ke server');
      }
    }
  });
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    width: el.offsetWidth || 320,
    text: 'continue_with',
    locale: 'id'
  });
}

async function doGoogleDemoLogin() {
  const demoPayload = {
    email: 'google.demo@gmail.com',
    name: 'Google Demo User',
    sub: 'google-demo-sub-001',
    picture: ''
  };
  try {
    const res = await fetch(`${API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo_payload: demoPayload })
    });
    const json = await res.json();
    if (json.success) {
      setUser(json.data);
      closeModal();
    } else {
      alert(json.message || 'Gagal');
    }
  } catch {
    alert('Gagal terhubung');
  }
}

async function loginAsDemo() {
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'demo' })
    });
    const json = await res.json();
    if (json.success) {
      setUser(json.data);
      closeModal();
    } else {
      alert(json.message || 'Demo login gagal');
    }
  } catch {
    alert('Gagal terhubung');
  }
}

function openRegisterModal() {
  const tncText = window.__tnc?.registration || 'Dengan mendaftar Anda menyetujui Syarat & Ketentuan.';
  showModal(`
    <h2>Daftar Akun</h2>
    ${googleAuthButtonsHtml('google-btn-reg')}
    <form id="form-register">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required placeholder="email@contoh.com">
      </div>
      <div class="form-group">
        <label>Nama Pengguna</label>
        <input type="text" name="username" required placeholder="username" minlength="3">
      </div>
      <div class="form-group">
        <label>No. Rekening (untuk refund)</label>
        <input type="text" name="bank_account" placeholder="1234567890">
      </div>
      <div class="form-group">
        <label>Bank</label>
        <input type="text" name="bank_name" placeholder="BCA / BRI / Mandiri">
      </div>
      <div class="form-group">
        <label>Nama Pemilik Rekening</label>
        <input type="text" name="account_holder" placeholder="Nama sesuai rekening">
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="tnc-reg" required>
        <label for="tnc-reg">Saya menyetujui <a href="#" onclick="alert(window.__tnc.registration);return false;">Syarat & Ketentuan</a> sesuai hukum Indonesia.</label>
      </div>
      <div id="reg-alert"></div>
      <button type="submit" class="btn btn-primary btn-block">Daftar</button>
    </form>
    <p style="text-align:center;margin-top:12px;font-size:0.9rem">
      Sudah punya akun? <a href="#" id="switch-to-login">Masuk</a>
    </p>
  `);
  renderGoogleButton('google-btn-reg');

  $('#form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const alertBox = $('#reg-alert');
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        alertBox.innerHTML = `<div class="alert alert-success">${json.message}. Silakan masuk.</div>`;
        setTimeout(() => { closeModal(); openLoginModal(); }, 1500);
      } else {
        alertBox.innerHTML = `<div class="alert alert-error">${json.message}</div>`;
      }
    } catch (err) {
      alertBox.innerHTML = `<div class="alert alert-error">Gagal terhubung ke server</div>`;
    }
  });

  $('#switch-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    openLoginModal();
  });
}

function openLoginModal() {
  showModal(`
    <h2>Masuk</h2>
    ${googleAuthButtonsHtml('google-btn-login')}
    <form id="form-login">
      <div class="form-group">
        <label>Email atau Username</label>
        <input type="text" name="identifier" id="login-identifier" required placeholder="email atau username">
      </div>
      <div id="login-alert"></div>
      <button type="submit" class="btn btn-primary btn-block">Masuk</button>
    </form>
    <div style="margin-top:16px;padding:12px;background:#f0f7ff;border-radius:8px;border:1px dashed #0d6efd">
      <div style="font-size:0.85rem;font-weight:600;margin-bottom:6px;color:#0d6efd">Akun Demo (klik untuk isi & login)</div>
      <button type="button" class="btn btn-outline btn-block" id="btn-demo-login" style="justify-content:flex-start;text-align:left">
        <span>
          <strong>demo</strong> / demo@ppob.local<br>
          <small style="color:#6c757d">Klik → langsung masuk sebagai demo user</small>
        </span>
      </button>
    </div>
    <p style="text-align:center;margin-top:12px;font-size:0.9rem">
      Belum punya akun? <a href="#" id="switch-to-reg">Daftar</a>
    </p>
  `);
  renderGoogleButton('google-btn-login');

  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = e.target.identifier.value;
    const alertBox = $('#login-alert');
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const json = await res.json();
      if (json.success) {
        setUser(json.data);
        alertBox.innerHTML = `<div class="alert alert-success">Berhasil masuk!</div>`;
        setTimeout(closeModal, 800);
      } else {
        alertBox.innerHTML = `<div class="alert alert-error">${json.message}</div>`;
      }
    } catch {
      alertBox.innerHTML = `<div class="alert alert-error">Gagal terhubung</div>`;
    }
  });

  $('#btn-demo-login')?.addEventListener('click', () => {
    const input = $('#login-identifier');
    if (input) input.value = 'demo';
    loginAsDemo();
  });

  $('#switch-to-reg')?.addEventListener('click', (e) => {
    e.preventDefault();
    openRegisterModal();
  });
}

// ========== Buy Modal ==========
function openBuyModal(productId) {
  const user = getUser();
  if (!user) {
    openLoginModal();
    return;
  }
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const agreement = window.__tnc?.purchase || 'Dengan membeli Anda menyetujui Agreement.';

  showModal(`
    <h2>Beli ${product.name}</h2>
    <p style="color:#6c757d;font-size:0.9rem;margin-bottom:12px">${product.description || ''}</p>
    <form id="form-buy">
      <div class="form-group">
        <label>Nomor Tujuan / ID Pelanggan</label>
        <input type="text" name="customer_no" required placeholder="08xxxxxxxxxx atau ID">
      </div>
      <div class="form-group">
        <label>Metode Pembayaran</label>
        <select name="payment_method">
          <option value="qris">QRIS</option>
          <option value="va_bca">Virtual Account BCA</option>
          <option value="va_bri">Virtual Account BRI</option>
          <option value="va_mandiri">Virtual Account Mandiri</option>
          <option value="ewallet">E-Wallet</option>
        </select>
      </div>
      <div class="alert alert-info">
        Harga: ${product.price > 0 ? formatRupiah(product.price) : 'Sesuai inquiry'} + biaya layanan
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="agree-buy" required>
        <label for="agree-buy">Saya menyetujui <a href="#" onclick="alert(\`${agreement.replace(/`/g,"'")}\`);return false;">Agreement Pembelian</a> sesuai hukum Indonesia.</label>
      </div>
      <div id="buy-alert"></div>
      <button type="submit" class="btn btn-primary btn-block">Proses Pembelian</button>
    </form>
  `);

  $('#form-buy').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      user_id: user.id,
      product_id: productId,
      customer_no: fd.get('customer_no'),
      payment_method: fd.get('payment_method'),
      agreement_accepted: true
    };
    const alertBox = $('#buy-alert');
    try {
      const res = await fetch(`${API}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        const tried = (d.provider_ppob_tried || []).join(' → ') || d.provider_ppob;
        const payTried = (d.provider_payment_tried || []).join(' → ') || d.provider_payment;
        const simNote = (d.simulated?.ppob || d.simulated?.payment)
          ? '<br><small style="opacity:0.8">Mode simulasi (isi API key di Admin untuk live)</small>'
          : '';
        let payInfo = '';
        if (d.va_number) payInfo += `VA ${d.va_bank || ''}: <strong>${d.va_number}</strong><br>`;
        if (d.payment_url) payInfo += `<a href="${d.payment_url}" target="_blank" rel="noopener">Buka halaman pembayaran</a><br>`;
        if (d.qr_string) payInfo += `<small>QRIS: ${String(d.qr_string).slice(0, 40)}…</small><br>`;
        alertBox.innerHTML = `
          <div class="alert ${d.status === 'success' || d.status === 'pending' ? 'alert-success' : 'alert-error'}">
            <strong>Ref: ${d.ref_id}</strong><br>
            Status: ${d.status.toUpperCase()}<br>
            Total: ${formatRupiah(d.total)} (Fee: ${formatRupiah(d.fee)})<br>
            ${d.sn ? 'SN/Token: <strong>' + d.sn + '</strong><br>' : ''}
            PPOB: ${d.provider_ppob} <small>(${tried})</small><br>
            Payment: ${d.provider_payment} <small>(${payTried})</small><br>
            ${payInfo}
            ${d.message}${simNote}
          </div>
          <button type="button" class="btn btn-outline btn-block" style="margin-top:8px" onclick="window.open('/api/receipt/${d.ref_id}?format=html','_blank')">Cetak Struk</button>
        `;
        e.target.querySelector('button[type="submit"]').disabled = true;
      } else {
        alertBox.innerHTML = `<div class="alert alert-error">${json.message}</div>`;
      }
    } catch {
      alertBox.innerHTML = `<div class="alert alert-error">Gagal terhubung ke server</div>`;
    }
  });
}

// ========== Transaction History ==========
async function openHistoryModal() {
  const user = getUser();
  if (!user) { openLoginModal(); return; }
  showModal(`<h2>Riwayat Transaksi</h2><div id="history-list"><p style="color:#6c757d">Memuat...</p></div>`);
  try {
    const res = await fetch(`${API}/user/${user.id}/transactions`);
    const json = await res.json();
    const list = json.data || [];
    if (list.length === 0) {
      $('#history-list').innerHTML = '<p style="color:#6c757d;text-align:center">Belum ada transaksi</p>';
      return;
    }
    $('#history-list').innerHTML = list.map(t => `
      <div style="border:1px solid #dee2e6;border-radius:8px;padding:12px;margin-bottom:10px;font-size:0.9rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <strong>${t.ref_id}</strong>
          <span class="badge ${t.status === 'success' ? 'badge-success' : 'badge-danger'}" style="padding:2px 8px;border-radius:4px;font-size:0.75rem;background:${t.status==='success'?'#d1e7dd':'#f8d7da'};color:${t.status==='success'?'#0f5132':'#842029'}">${t.status}</span>
        </div>
        <div>${t.product_name} → ${t.customer_no}</div>
        <div style="color:#6c757d">${formatRupiah(t.total)} · ${new Date(t.created_at).toLocaleString('id-ID')}</div>
        ${t.sn ? `<div style="font-size:0.8rem;margin-top:4px">SN: ${t.sn}</div>` : ''}
        <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="window.open('/api/receipt/${t.ref_id}?format=html','_blank')">Cetak Struk</button>
      </div>
    `).join('');
  } catch {
    $('#history-list').innerHTML = '<p class="alert alert-error">Gagal memuat riwayat</p>';
  }
}

// ========== Events ==========
document.addEventListener('DOMContentLoaded', () => {
  updateHeader();
  loadConfig();
  loadProducts();
  loadFaqs();

  $('#btn-login')?.addEventListener('click', openLoginModal);
  $('#btn-register')?.addEventListener('click', openRegisterModal);
  $('#btn-logout')?.addEventListener('click', () => {
    setUser(null);
  });
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === $('#modal-overlay')) closeModal();
  });

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderProducts(tab.dataset.cat);
    });
  });

  $('#menu-toggle')?.addEventListener('click', () => {
    $('#main-nav').classList.toggle('open');
  });

  $('#link-tnc')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert(window.__tnc?.registration || 'Syarat & Ketentuan');
  });
});

// Expose for onclick
window.openBuyModal = openBuyModal;
window.openHistoryModal = openHistoryModal;
