const API = '/api';
let adminToken = sessionStorage.getItem('admin_token') || '';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Auth': adminToken
  };
}

function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

function showSection(name) {
  $$('.section').forEach(s => s.classList.remove('active'));
  $$('.sidebar a').forEach(a => a.classList.remove('active'));
  const sec = $(`#sec-${name}`);
  if (sec) sec.classList.add('active');
  const link = $(`.sidebar a[data-section="${name}"]`);
  if (link) link.classList.add('active');
}

function showModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
}
function closeModal() {
  $('#modal-overlay').classList.add('hidden');
}

// Login
$('#admin-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
  });
  const json = await res.json();
  if (json.success) {
    adminToken = json.token;
    sessionStorage.setItem('admin_token', adminToken);
    $('#login-screen').classList.add('hidden');
    $('#admin-app').classList.remove('hidden');
    loadDashboard();
  } else {
    $('#login-err').innerHTML = `<div class="alert alert-error">${json.message}</div>`;
  }
});

if (adminToken) {
  $('#login-screen').classList.add('hidden');
  $('#admin-app').classList.remove('hidden');
  loadDashboard();
}

// Nav
$$('.sidebar a[data-section]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const sec = a.dataset.section;
    showSection(sec);
    if (sec === 'products') loadProducts();
    if (sec === 'faqs') loadFaqs();
    if (sec === 'settings') loadSettings();
    if (sec === 'fees') loadFees();
    if (sec === 'cms') loadCMS();
    if (sec === 'tnc') loadTNC();
    if (sec === 'transactions') loadTransactions();
    if (sec === 'reports') loadReports();
    if (sec === 'users') loadUsers();
    if (sec === 'dashboard') loadDashboard();
  });
});

$('#admin-logout')?.addEventListener('click', (e) => {
  e.preventDefault();
  sessionStorage.removeItem('admin_token');
  location.reload();
});

$('#modal-close')?.addEventListener('click', closeModal);

// Dashboard
async function loadDashboard() {
  const [p, u, t, f] = await Promise.all([
    fetch(`${API}/admin/products`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API}/admin/users`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API}/admin/transactions`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API}/admin/faqs`, { headers: authHeaders() }).then(r => r.json())
  ]);
  $('#stat-products').textContent = p.data?.length || 0;
  $('#stat-users').textContent = u.data?.length || 0;
  $('#stat-tx').textContent = t.data?.length || 0;
  $('#stat-faqs').textContent = f.data?.length || 0;
}

// Products
async function loadProducts() {
  const res = await fetch(`${API}/admin/products`, { headers: authHeaders() });
  const json = await res.json();
  const rows = (json.data || []).map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.sku}</td>
      <td><span class="badge ${p.category === 'prabayar' ? 'badge-success' : 'badge-warning'}">${p.category}</span></td>
      <td>Rp ${Number(p.price).toLocaleString('id-ID')}</td>
      <td>${p.active ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Nonaktif</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Hapus</button>
      </td>
    </tr>
  `).join('');
  $('#products-table').innerHTML = `
    <table>
      <thead><tr><th>Nama</th><th>SKU</th><th>Kategori</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Belum ada produk</td></tr>'}</tbody>
    </table>
  `;
}

$('#btn-add-product')?.addEventListener('click', () => {
  showProductForm();
});

function showProductForm(prod = null) {
  showModal(`
    <h2>${prod ? 'Edit' : 'Tambah'} Produk</h2>
    <form id="prod-form">
      <div class="form-group"><label>Nama</label><input name="name" value="${prod?.name || ''}" required></div>
      <div class="form-group"><label>SKU</label><input name="sku" value="${prod?.sku || ''}" required></div>
      <div class="form-group">
        <label>Kategori</label>
        <select name="category">
          <option value="prabayar" ${prod?.category === 'prabayar' ? 'selected' : ''}>Prabayar</option>
          <option value="pascabayar" ${prod?.category === 'pascabayar' ? 'selected' : ''}>Pascabayar</option>
        </select>
      </div>
      <div class="form-group"><label>Provider</label><input name="provider" value="${prod?.provider || ''}"></div>
      <div class="form-group"><label>Harga</label><input type="number" name="price" value="${prod?.price || 0}"></div>
      <div class="form-group"><label>Admin Fee</label><input type="number" name="admin_fee" value="${prod?.admin_fee || 0}"></div>
      <div class="form-group"><label>Deskripsi</label><input name="description" value="${prod?.description || ''}"></div>
      <div class="form-group">
        <label>Provider API</label>
        <select name="provider_api">
          <option value="digiflazz">Digiflazz</option>
          <option value="iak">IAK</option>
          <option value="raja-biller">Raja-Biller</option>
        </select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="active" ${prod?.active !== false ? 'checked' : ''}> Aktif</label>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Simpan</button>
    </form>
  `);
  $('#prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get('name'),
      sku: fd.get('sku'),
      category: fd.get('category'),
      provider: fd.get('provider'),
      price: Number(fd.get('price')),
      admin_fee: Number(fd.get('admin_fee')),
      description: fd.get('description'),
      provider_api: fd.get('provider_api'),
      active: !!fd.get('active')
    };
    const url = prod ? `${API}/admin/products/${prod.id}` : `${API}/admin/products`;
    const method = prod ? 'PUT' : 'POST';
    await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    closeModal();
    loadProducts();
  });
}

window.editProduct = async (id) => {
  const res = await fetch(`${API}/admin/products`, { headers: authHeaders() });
  const json = await res.json();
  const prod = json.data.find(p => p.id === id);
  if (prod) showProductForm(prod);
};

window.deleteProduct = async (id) => {
  if (!confirm('Hapus produk ini?')) return;
  await fetch(`${API}/admin/products/${id}`, { method: 'DELETE', headers: authHeaders() });
  loadProducts();
};

// FAQs
async function loadFaqs() {
  const res = await fetch(`${API}/admin/faqs`, { headers: authHeaders() });
  const json = await res.json();
  const rows = (json.data || []).map(f => `
    <tr>
      <td>${f.question}</td>
      <td>${f.order}</td>
      <td>${f.active ? 'Aktif' : 'Nonaktif'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editFaq('${f.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFaq('${f.id}')">Hapus</button>
      </td>
    </tr>
  `).join('');
  $('#faqs-table').innerHTML = `<table><thead><tr><th>Pertanyaan</th><th>Order</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

$('#btn-add-faq')?.addEventListener('click', () => showFaqForm());

function showFaqForm(faq = null) {
  showModal(`
    <h2>${faq ? 'Edit' : 'Tambah'} FAQ</h2>
    <form id="faq-form">
      <div class="form-group"><label>Pertanyaan</label><input name="question" value="${faq?.question || ''}" required></div>
      <div class="form-group"><label>Jawaban</label><textarea name="answer" rows="4" required>${faq?.answer || ''}</textarea></div>
      <div class="form-group"><label>Order</label><input type="number" name="order" value="${faq?.order || 1}"></div>
      <div class="form-group"><label><input type="checkbox" name="active" ${faq?.active !== false ? 'checked' : ''}> Aktif</label></div>
      <button type="submit" class="btn btn-primary btn-block">Simpan</button>
    </form>
  `);
  $('#faq-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      question: fd.get('question'),
      answer: fd.get('answer'),
      order: Number(fd.get('order')),
      active: !!fd.get('active')
    };
    const url = faq ? `${API}/admin/faqs/${faq.id}` : `${API}/admin/faqs`;
    const method = faq ? 'PUT' : 'POST';
    await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    closeModal();
    loadFaqs();
  });
}

window.editFaq = async (id) => {
  const res = await fetch(`${API}/admin/faqs`, { headers: authHeaders() });
  const json = await res.json();
  const faq = json.data.find(f => f.id === id);
  if (faq) showFaqForm(faq);
};

window.deleteFaq = async (id) => {
  if (!confirm('Hapus?')) return;
  await fetch(`${API}/admin/faqs/${id}`, { method: 'DELETE', headers: authHeaders() });
  loadFaqs();
};

// Settings
async function loadSettings() {
  const res = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const json = await res.json();
  const s = json.data;
  $('#ppob_priority').value = (s.api_ppob?.priority || []).join(',');
  $('#digiflazz_user').value = s.api_ppob?.digiflazz?.username || '';
  $('#digiflazz_key').value = s.api_ppob?.digiflazz?.api_key || '';
  $('#digiflazz_active').checked = !!s.api_ppob?.digiflazz?.active;
  $('#iak_user').value = s.api_ppob?.iak?.username || '';
  $('#iak_key').value = s.api_ppob?.iak?.api_key || '';
  $('#iak_active').checked = !!s.api_ppob?.iak?.active;
  $('#pay_priority').value = (s.api_payment?.priority || []).join(',');
  $('#bdpay_merchant').value = s.api_payment?.bdpay?.merchant_code || '';
  $('#bdpay_key').value = s.api_payment?.bdpay?.api_key || '';
  $('#bdpay_active').checked = !!s.api_payment?.bdpay?.active;
  $('#midtrans_server').value = s.api_payment?.midtrans?.server_key || '';
  $('#midtrans_client').value = s.api_payment?.midtrans?.client_key || '';
  $('#midtrans_active').checked = !!s.api_payment?.midtrans?.active;
}

$('#form-settings')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const current = (await res.json()).data;
  current.api_ppob.priority = $('#ppob_priority').value.split(',').map(s => s.trim()).filter(Boolean);
  current.api_ppob.digiflazz.username = $('#digiflazz_user').value;
  current.api_ppob.digiflazz.api_key = $('#digiflazz_key').value;
  current.api_ppob.digiflazz.active = $('#digiflazz_active').checked;
  current.api_ppob.iak.username = $('#iak_user').value;
  current.api_ppob.iak.api_key = $('#iak_key').value;
  current.api_ppob.iak.active = $('#iak_active').checked;
  current.api_payment.priority = $('#pay_priority').value.split(',').map(s => s.trim()).filter(Boolean);
  current.api_payment.bdpay.merchant_code = $('#bdpay_merchant').value;
  current.api_payment.bdpay.api_key = $('#bdpay_key').value;
  current.api_payment.bdpay.active = $('#bdpay_active').checked;
  current.api_payment.midtrans.server_key = $('#midtrans_server').value;
  current.api_payment.midtrans.client_key = $('#midtrans_client').value;
  current.api_payment.midtrans.active = $('#midtrans_active').checked;

  await fetch(`${API}/admin/settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(current)
  });
  $('#settings-msg').innerHTML = '<div class="alert alert-success">Settings disimpan</div>';
});

// Fees
async function loadFees() {
  const res = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const s = (await res.json()).data;
  $('#fee_percent').value = s.fees?.global_percent || 0;
  $('#fee_fixed').value = s.fees?.global_fixed || 0;
}

$('#form-fees')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const current = (await res.json()).data;
  current.fees.global_percent = Number($('#fee_percent').value);
  current.fees.global_fixed = Number($('#fee_fixed').value);
  await fetch(`${API}/admin/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(current) });
  $('#fees-msg').innerHTML = '<div class="alert alert-success">Biaya disimpan</div>';
});

// CMS
async function loadCMS() {
  const [setRes, cmsRes] = await Promise.all([
    fetch(`${API}/admin/settings`, { headers: authHeaders() }).then(r => r.json()),
    fetch(`${API}/admin/cms`, { headers: authHeaders() }).then(r => r.json())
  ]);
  const s = setRes.data;
  const c = cmsRes.data;
  $('#site_name').value = s.site?.name || '';
  $('#site_copyright').value = s.site?.copyright || '';
  $('#seo_title').value = s.seo?.title || '';
  $('#seo_desc').value = s.seo?.description || '';
  $('#seo_keywords').value = s.seo?.keywords || '';
  $('#hero_title').value = c.pages?.home?.hero_title || '';
  $('#hero_subtitle').value = c.pages?.home?.hero_subtitle || '';
}

$('#form-cms')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const setRes = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const current = (await setRes.json()).data;
  current.site.name = $('#site_name').value;
  current.site.copyright = $('#site_copyright').value;
  current.seo.title = $('#seo_title').value;
  current.seo.description = $('#seo_desc').value;
  current.seo.keywords = $('#seo_keywords').value;
  await fetch(`${API}/admin/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(current) });

  const cmsRes = await fetch(`${API}/admin/cms`, { headers: authHeaders() });
  const cms = (await cmsRes.json()).data;
  if (!cms.pages) cms.pages = {};
  if (!cms.pages.home) cms.pages.home = {};
  cms.pages.home.hero_title = $('#hero_title').value;
  cms.pages.home.hero_subtitle = $('#hero_subtitle').value;
  await fetch(`${API}/admin/cms`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(cms) });
  $('#cms-msg').innerHTML = '<div class="alert alert-success">CMS disimpan</div>';
});

// T&C
async function loadTNC() {
  const res = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const s = (await res.json()).data;
  $('#tnc_reg').value = s.tnc?.registration || '';
  $('#tnc_purchase').value = s.tnc?.purchase || '';
}

$('#form-tnc')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(`${API}/admin/settings`, { headers: authHeaders() });
  const current = (await res.json()).data;
  current.tnc.registration = $('#tnc_reg').value;
  current.tnc.purchase = $('#tnc_purchase').value;
  await fetch(`${API}/admin/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(current) });
  $('#tnc-msg').innerHTML = '<div class="alert alert-success">T&C disimpan</div>';
});

// Transactions
async function loadTransactions() {
  const res = await fetch(`${API}/admin/transactions`, { headers: authHeaders() });
  const json = await res.json();
  const rows = (json.data || []).slice().reverse().map(t => `
    <tr>
      <td>${t.ref_id}</td>
      <td>${t.product_name}</td>
      <td>${t.customer_no}</td>
      <td>Rp ${Number(t.total).toLocaleString('id-ID')}</td>
      <td><span class="badge ${t.status === 'success' ? 'badge-success' : 'badge-danger'}">${t.status}</span></td>
      <td>${t.provider_ppob}${t.provider_ppob_tried?.length > 1 ? ' <small>(switched)</small>' : ''} / ${t.provider_payment}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="window.open('/api/receipt/${t.ref_id}?format=html','_blank')">Struk</button>
        ${t.status === 'failed' && !t.refunded ? `<button class="btn btn-sm btn-success" onclick="doRefund('${t.id}')">Refund</button>` : (t.refunded ? 'Refunded' : '')}
      </td>
    </tr>
  `).join('');
  $('#tx-table').innerHTML = `<table><thead><tr><th>Ref</th><th>Produk</th><th>Tujuan</th><th>Total</th><th>Status</th><th>Provider</th><th>Aksi</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Belum ada transaksi</td></tr>'}</tbody></table>`;
}

window.doRefund = async (id) => {
  if (!confirm('Proses refund ke rekening pengguna?')) return;
  await fetch(`${API}/admin/refund/${id}`, { method: 'POST', headers: authHeaders() });
  loadTransactions();
};

// Sales Reports
async function loadReports() {
  const from = $('#report-from')?.value || '';
  const to = $('#report-to')?.value || '';
  const group = $('#report-group')?.value || 'day';
  let url = `${API}/admin/reports/sales?group_by=${group}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json();
  if (!json.success) return;

  const s = json.data.summary;
  $('#report-summary').innerHTML = `
    <div class="feature-card"><h3>${s.total_transactions}</h3><p>Total Transaksi</p></div>
    <div class="feature-card"><h3>${s.success_count}</h3><p>Berhasil</p></div>
    <div class="feature-card"><h3>${s.failed_count}</h3><p>Gagal</p></div>
    <div class="feature-card"><h3>${s.success_rate}%</h3><p>Success Rate</p></div>
    <div class="feature-card"><h3>Rp ${Number(s.total_revenue).toLocaleString('id-ID')}</h3><p>Pendapatan</p></div>
    <div class="feature-card"><h3>Rp ${Number(s.total_fee).toLocaleString('id-ID')}</h3><p>Total Fee</p></div>
  `;

  const rows = (json.data.groups || []).map(g => `
    <tr>
      <td>${g.key}</td>
      <td>${g.count}</td>
      <td>${g.success}</td>
      <td>${g.failed}</td>
      <td>Rp ${Number(g.revenue).toLocaleString('id-ID')}</td>
      <td>Rp ${Number(g.fee).toLocaleString('id-ID')}</td>
    </tr>
  `).join('');
  $('#report-table').innerHTML = `
    <table>
      <thead><tr><th>${json.data.group_by === 'day' ? 'Tanggal' : json.data.group_by === 'month' ? 'Bulan' : json.data.group_by === 'product' ? 'Produk' : 'Provider'}</th><th>Total</th><th>Sukses</th><th>Gagal</th><th>Pendapatan</th><th>Fee</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Tidak ada data</td></tr>'}</tbody>
    </table>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  $('#btn-load-report')?.addEventListener('click', loadReports);
});

// Users
async function loadUsers() {
  const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
  const json = await res.json();
  const rows = (json.data || []).map(u => `
    <tr>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td>${u.bank_account || '-'} (${u.bank_name || '-'})</td>
      <td>${new Date(u.created_at).toLocaleString('id-ID')}</td>
    </tr>
  `).join('');
  $('#users-table').innerHTML = `<table><thead><tr><th>Username</th><th>Email</th><th>Rekening</th><th>Daftar</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Belum ada pengguna</td></tr>'}</tbody></table>`;
}
