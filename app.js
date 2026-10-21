'use strict';

const TX_KEY = 'dompetku.transactions.v1';
const CAT_KEY = 'dompetku.categories.v1';
const BACKUP_VERSION = 2;

const DEFAULT_CATEGORIES = {
  expense: [
    ['Makan & Minum', '🍜'], ['Transportasi', '🚗'], ['Belanja', '🛒'],
    ['Tagihan', '💡'], ['Pulsa & Internet', '📱'], ['Kesehatan', '💊'],
    ['Hiburan', '🎬'], ['Pendidikan', '📚'], ['Rumah', '🏠'],
    ['Sedekah', '🤲'], ['Investasi & Tabungan', '📈', true], ['Lainnya', '📦'],
  ],
  income: [
    ['Gaji', '💼'], ['Bonus', '🎁'], ['Usaha', '🏪'],
    ['Investasi', '📈'], ['Hadiah', '🎉'], ['Lainnya', '💰'],
  ],
};

const ICON_CHOICES = [
  '🍜', '☕', '🍔', '🛒', '🚗', '🛵', '⛽', '🚌',
  '💡', '💧', '📱', '🌐', '💊', '🏥', '🎬', '🎮',
  '📚', '🎓', '🏠', '🧹', '👕', '💇', '🎁', '🤲',
  '🕌', '👶', '🐱', '✈️', '💳', '🧾', '📦', '🔧',
  '💼', '🏪', '📈', '🎉', '💰', '🪙', '🏦', '💵',
];

const $ = (sel) => document.querySelector(sel);

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// investment: kategori pengeluaran yang uangnya dipindah ke investasi/tabungan, bukan dibelanjakan
function defaultCategories() {
  return Object.entries(DEFAULT_CATEGORIES).flatMap(([type, list]) =>
    list.map(([name, icon, investment = false]) => ({ id: newId(), type, name, icon, investment })));
}

// ---------- State ----------

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

let categories = readJSON(CAT_KEY);
if (!Array.isArray(categories) || !categories.length) categories = defaultCategories();
let transactions = readJSON(TX_KEY);
if (!Array.isArray(transactions)) transactions = [];
normalize(categories, transactions);
save();

let current = new Date();
current.setDate(1);
let editingId = null;

function save() {
  localStorage.setItem(CAT_KEY, JSON.stringify(categories));
  localStorage.setItem(TX_KEY, JSON.stringify(transactions));
}

// Pastikan setiap transaksi menunjuk ke kategori yang ada. Sekaligus memindahkan
// data versi lama yang menyimpan nama kategori (bukan id) di setiap transaksi.
function normalize(cats, txs) {
  // Data dari sebelum ada fitur investasi: tandai semua kategori, lalu tambahkan kategori investasi bawaan
  if (!cats.some((c) => 'investment' in c)) {
    cats.forEach((c) => { c.investment = false; });
    if (!cats.some((c) => c.type === 'expense' && c.name.toLowerCase() === 'investasi & tabungan')) {
      const others = cats.findIndex((c) => c.type === 'expense' && c.name === 'Lainnya');
      cats.splice(others >= 0 ? others : cats.length, 0,
        { id: newId(), type: 'expense', name: 'Investasi & Tabungan', icon: '📈', investment: true });
    }
  }
  for (const type of ['expense', 'income']) {
    if (!cats.some((c) => c.type === type)) cats.push({ id: newId(), type, name: 'Lainnya', icon: '📦', investment: false });
  }
  for (const t of txs) {
    if (!cats.some((c) => c.id === t.categoryId && c.type === t.type)) {
      let cat = t.category && cats.find((c) => c.type === t.type && c.name === t.category);
      if (!cat && t.category) {
        cat = { id: newId(), type: t.type, name: t.category, icon: '📦' };
        cats.push(cat);
      }
      t.categoryId = (cat || cats.find((c) => c.type === t.type)).id;
    }
    delete t.category;
  }
}

// ---------- Helpers ----------

const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const UNKNOWN_CATEGORY = { name: 'Tanpa kategori', icon: '•' };
const getCategory = (id) => categories.find((c) => c.id === id) || UNKNOWN_CATEGORY;
const categoriesOf = (type) => categories.filter((c) => c.type === type);
const usageCount = (id) => transactions.filter((t) => t.categoryId === id).length;

function formatDateHeading(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function monthTransactions() {
  const key = monthKey(current);
  return transactions.filter((t) => t.date.startsWith(key));
}

function totals(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

const isInvestment = (t) => t.type === 'expense' && !!getCategory(t.categoryId).investment;

// Pengeluaran dipisah: belanja biasa (spending) vs uang yang diinvestasikan/ditabung (investment)
function summarize(list) {
  let income = 0, spending = 0, investment = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (isInvestment(t)) investment += t.amount;
    else spending += t.amount;
  }
  return { income, spending, investment };
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- Render ----------

function render() {
  $('#monthLabel').textContent = current.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const list = monthTransactions();
  const t = totals(list);
  $('#balance').textContent = rupiah(t.balance);
  $('#totalIncome').textContent = rupiah(t.income);
  $('#totalExpense').textContent = rupiah(t.expense);
  $('#allTimeBalance').textContent = rupiah(totals(transactions).balance);

  renderList(list);
  renderReport(list);
}

function renderList(list) {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const ul = $('#txList');
  ul.innerHTML = '';
  $('#emptyMsg').hidden = sorted.length > 0;

  let lastDate = null;
  for (const t of sorted) {
    if (t.date !== lastDate) {
      lastDate = t.date;
      const li = document.createElement('li');
      li.className = 'tx-date';
      li.textContent = formatDateHeading(t.date);
      ul.appendChild(li);
    }
    const cat = getCategory(t.categoryId);
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.innerHTML = `
      <div class="tx-icon">${escapeHtml(cat.icon)}</div>
      <div class="tx-main">
        <div class="tx-cat">${escapeHtml(cat.name)}</div>
        ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ''}
      </div>
      <div class="tx-amt ${t.type}">${t.type === 'income' ? '+' : '−'}${rupiah(t.amount)}</div>`;
    li.addEventListener('click', () => openForm(t));
    ul.appendChild(li);
  }
}

// Bagian-bagian pemasukan pada grafik donat; warna mengikuti entitas (slot palet tetap), bukan urutan
const ALLOCATION = [
  ['spending', 'Pengeluaran', 'var(--series-2)'],
  ['investment', 'Investasi', 'var(--series-1)'],
  ['rest', 'Sisa', 'var(--series-3)'],
];

function renderReport(list) {
  const s = summarize(list);
  $('#kpiIncome').textContent = rupiah(s.income);
  $('#kpiSpending').textContent = rupiah(s.spending);
  $('#kpiInvestment').textContent = rupiah(s.investment);
  renderAllocation(s);
  renderBreakdown('#expenseBreakdown', list.filter((t) => t.type === 'expense' && !isInvestment(t)));
  const invested = list.filter(isInvestment);
  $('#investmentSection').hidden = !invested.length;
  renderBreakdown('#investmentBreakdown', invested);
  renderBreakdown('#incomeBreakdown', list.filter((t) => t.type === 'income'));
}

function renderAllocation({ income, spending, investment }) {
  const box = $('#allocation');
  const out = spending + investment;
  if (!income && !out) {
    box.innerHTML = '<p class="empty">Belum ada data bulan ini.</p>';
    return;
  }
  // Jika keluar > masuk, keseluruhan donat = total uang keluar (tidak ada "sisa")
  const deficit = out > income;
  const whole = deficit ? out : income;
  const values = { spending, investment, rest: Math.max(0, income - out) };
  const segments = ALLOCATION.map(([key, label, color]) => ({ key, label, color, value: values[key] })).filter((g) => g.value > 0);

  // Bagian yang sangat kecil tetap digambar minimal 3px agar terlihat (nilai pastinya ada di legenda)
  const R = 72, L = 2 * Math.PI * R, GAP = segments.length > 1 ? 2 : 0, MIN_ARC = 3;
  let offset = 0;
  const arcs = segments.map((g) => {
    const len = (g.value / whole) * L;
    const arc = `<circle data-key="${g.key}" cx="100" cy="100" r="${R}" stroke="${g.color}" stroke-dasharray="${Math.max(len - GAP, MIN_ARC)} ${L}" stroke-dashoffset="${-offset}"><title>${g.label}: ${rupiah(g.value)}</title></circle>`;
    offset += len;
    return arc;
  }).join('');
  // Jangan membulatkan nilai kecil menjadi 0% atau hampir penuh menjadi 100%
  const pct = (v) => {
    const p = (v / whole) * 100;
    if (p > 0 && p < 1) return '<1%';
    if (p > 99 && p < 100) return '>99%';
    return `${Math.round(p)}%`;
  };
  const centerLabel = deficit ? 'Total keluar' : 'Pemasukan';

  box.innerHTML = `
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 200 200" role="img" aria-label="Grafik alokasi pemasukan">
        <g transform="rotate(-90 100 100)">${arcs}</g>
      </svg>
      <div class="donut-center"><span id="donutLabel">${centerLabel}</span><strong id="donutValue">${rupiah(whole)}</strong></div>
    </div>
    <ul class="legend">
      ${segments.map((g) => `
        <li data-key="${g.key}">
          <span class="swatch" style="background:${g.color}"></span>
          <span class="legend-label">${g.label}</span>
          <span class="legend-value">${rupiah(g.value)}</span>
          <span class="legend-pct">${pct(g.value)}</span>
        </li>`).join('')}
    </ul>
    <p class="allocation-status ${deficit ? 'is-deficit' : ''}">${deficit
      ? `⚠️ Pengeluaran dan investasi melebihi pemasukan sebesar <strong>${rupiah(out - income)}</strong>.`
      : `✅ Tersisa <strong>${pct(values.rest)}</strong> dari pemasukan bulan ini.`}</p>`;

  // Ketuk/arahkan ke bagian donat atau legenda untuk melihat nilainya di tengah
  const activate = (key) => {
    const g = segments.find((x) => x.key === key);
    box.querySelector('.donut').classList.toggle('has-active', !!g);
    box.querySelectorAll('[data-key]').forEach((el) => el.classList.toggle('active', el.dataset.key === key));
    $('#donutLabel').textContent = g ? `${g.label} · ${pct(g.value)}` : centerLabel;
    $('#donutValue').textContent = rupiah(g ? g.value : whole);
  };
  // Mouse: sorot saat diarahkan. Sentuhan: ketuk untuk menyorot, ketuk lagi untuk melepas
  box.querySelectorAll('[data-key]').forEach((el) => {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') activate(el.dataset.key); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') activate(null); });
    el.addEventListener('click', (e) => {
      if (e.pointerType !== 'mouse') activate(el.classList.contains('active') ? null : el.dataset.key);
    });
  });
}

function renderBreakdown(sel, list) {
  const box = $(sel);
  const sums = {};
  for (const t of list) sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
  const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!entries.length) {
    box.innerHTML = '<p class="empty">Tidak ada data.</p>';
    return;
  }
  // Satu warna untuk semua batang: yang dibandingkan adalah besarnya, bukan identitas kategori
  box.innerHTML = entries.map(([id, val]) => {
    const cat = getCategory(id);
    const pct = (val / total) * 100;
    return `
      <div class="row">
        <div class="row-head">
          <span>${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
          <span>${rupiah(val)} · ${pct.toFixed(0)}%</span>
        </div>
        <div class="bar"><div style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

// ---------- Form transaksi ----------

const dialog = $('#txDialog');
const amountInput = $('#amount');

function categoryOptions(list, selectedId) {
  return list
    .map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.icon + ' ' + c.name)}</option>`)
    .join('');
}

function fillCategories(type, selectedId) {
  $('#category').innerHTML = categoryOptions(categoriesOf(type), selectedId);
}

// tx: transaksi yang diubah; draft: isian awal (mis. hasil pindai struk) untuk transaksi baru
function openForm(tx = null, draft = null) {
  editingId = tx ? tx.id : null;
  const src = tx || draft;
  const type = src ? src.type : 'expense';
  $('#formTitle').textContent = tx ? 'Ubah transaksi' : draft ? 'Periksa hasil pindai' : 'Tambah transaksi';
  $(type === 'income' ? '#typeIncome' : '#typeExpense').checked = true;
  fillCategories(type, src && src.categoryId);
  amountInput.value = src ? src.amount.toLocaleString('id-ID') : '';
  $('#date').value = src ? src.date : (monthKey(current) === monthKey(new Date()) ? todayISO() : `${monthKey(current)}-01`);
  $('#note').value = src ? src.note : '';
  $('#scanHint').hidden = !draft;
  $('#deleteTx').hidden = !tx;
  dialog.showModal();
  if (!src) amountInput.focus();
}

document.querySelectorAll('input[name="type"]').forEach((r) =>
  r.addEventListener('change', () => fillCategories(r.value)));

// Format angka dengan titik ribuan saat mengetik
amountInput.addEventListener('input', () => {
  const digits = amountInput.value.replace(/\D/g, '').replace(/^0+/, '');
  amountInput.value = digits ? Number(digits).toLocaleString('id-ID') : '';
});

$('#txForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = Number(amountInput.value.replace(/\D/g, ''));
  if (!amount) {
    amountInput.focus();
    return;
  }
  const data = {
    type: document.querySelector('input[name="type"]:checked').value,
    amount,
    categoryId: $('#category').value,
    date: $('#date').value,
    note: $('#note').value.trim(),
  };
  if (editingId) {
    Object.assign(transactions.find((t) => t.id === editingId), data);
  } else {
    transactions.push({ id: newId(), createdAt: Date.now(), ...data });
  }
  save();
  // Pindah ke bulan transaksi yang disimpan
  const [y, m] = data.date.split('-').map(Number);
  current = new Date(y, m - 1, 1);
  dialog.close();
  render();
});

$('#cancelTx').addEventListener('click', () => dialog.close());

$('#deleteTx').addEventListener('click', () => {
  if (!confirm('Hapus transaksi ini?')) return;
  transactions = transactions.filter((t) => t.id !== editingId);
  save();
  dialog.close();
  render();
});

// ---------- Kelola kategori ----------

const catDialog = $('#catDialog');
const catEditDialog = $('#catEditDialog');
let catType = 'expense';
let editingCatId = null;
let selectedIcon = ICON_CHOICES[0];

function renderCatList() {
  const list = categoriesOf(catType);
  $('#catList').innerHTML = list.map((c, i) => `
    <li class="cat-row" data-id="${c.id}">
      <div class="tx-icon">${escapeHtml(c.icon)}</div>
      <button type="button" class="cat-name">${escapeHtml(c.name)}<small>${c.investment ? '📈 investasi · ' : ''}${usageCount(c.id)} transaksi · ketuk untuk ubah</small></button>
      <button type="button" class="icon-btn" data-move="-1" aria-label="Naikkan" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button type="button" class="icon-btn" data-move="1" aria-label="Turunkan" ${i === list.length - 1 ? 'disabled' : ''}>▼</button>
    </li>`).join('');
}

function moveCategory(id, dir) {
  const list = categoriesOf(catType);
  const i = list.findIndex((c) => c.id === id);
  if (!list[i + dir]) return;
  const a = categories.indexOf(list[i]);
  const b = categories.indexOf(list[i + dir]);
  [categories[a], categories[b]] = [categories[b], categories[a]];
  save();
  renderCatList();
}

function selectIcon(icon) {
  selectedIcon = icon;
  document.querySelectorAll('#iconGrid button').forEach((b) => b.classList.toggle('selected', b.textContent === icon));
}

function showCatError(message) {
  $('#catError').textContent = message;
  $('#catError').hidden = false;
}

function openCatEdit(cat = null) {
  editingCatId = cat ? cat.id : null;
  $('#catFormTitle').textContent = cat ? 'Ubah kategori' : 'Tambah kategori';
  $('#catName').value = cat ? cat.name : '';
  $('#catIconCustom').value = cat && !ICON_CHOICES.includes(cat.icon) ? cat.icon : '';
  selectIcon(cat ? cat.icon : ICON_CHOICES[0]);
  $('#catInvest').checked = !!(cat && cat.investment);
  $('#catInvestRow').hidden = catType !== 'expense';
  $('#catError').hidden = true;
  $('#catDeleteBox').hidden = true;
  $('#deleteCat').hidden = !cat;
  catEditDialog.showModal();
  // Keyboard hanya langsung muncul saat menambah kategori, agar pilihan ikon tidak tertutup saat mengubah
  if (!cat) $('#catName').focus();
}

$('#iconGrid').innerHTML = ICON_CHOICES.map((icon) => `<button type="button">${icon}</button>`).join('');

$('#iconGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $('#catIconCustom').value = '';
  selectIcon(btn.textContent);
});

$('#catIconCustom').addEventListener('input', (e) => selectIcon(e.target.value.trim() || ICON_CHOICES[0]));

$('#openCategories').addEventListener('click', () => {
  renderCatList();
  catDialog.showModal();
});

$('#closeCat').addEventListener('click', () => catDialog.close());

document.querySelectorAll('input[name="catType"]').forEach((r) =>
  r.addEventListener('change', () => {
    catType = r.value;
    renderCatList();
  }));

$('#catList').addEventListener('click', (e) => {
  const row = e.target.closest('.cat-row');
  if (!row) return;
  const move = e.target.closest('[data-move]');
  if (move) moveCategory(row.dataset.id, Number(move.dataset.move));
  else openCatEdit(categories.find((c) => c.id === row.dataset.id));
});

$('#addCat').addEventListener('click', () => openCatEdit());

$('#catForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#catName').value.trim().replace(/\s+/g, ' ');
  if (!name) return showCatError('Nama kategori wajib diisi.');
  const duplicate = categoriesOf(catType).some((c) => c.id !== editingCatId && c.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return showCatError(`Kategori "${name}" sudah ada.`);

  const investment = catType === 'expense' && $('#catInvest').checked;
  if (editingCatId) Object.assign(categories.find((c) => c.id === editingCatId), { name, icon: selectedIcon, investment });
  else categories.push({ id: newId(), type: catType, name, icon: selectedIcon, investment });
  save();
  catEditDialog.close();
  renderCatList();
  render();
});

$('#cancelCat').addEventListener('click', () => catEditDialog.close());

$('#deleteCat').addEventListener('click', () => {
  const others = categoriesOf(catType).filter((c) => c.id !== editingCatId);
  if (!others.length) return showCatError('Minimal harus ada satu kategori.');
  const cat = getCategory(editingCatId);
  const used = usageCount(editingCatId);
  $('#catDeleteMsg').textContent = used
    ? `Kategori "${cat.name}" dipakai ${used} transaksi. Pilih kategori pengganti untuk transaksi tersebut.`
    : `Hapus kategori "${cat.name}"?`;
  $('#catMoveLabel').hidden = !used;
  $('#catMoveTo').innerHTML = categoryOptions(others);
  $('#catError').hidden = true;
  $('#catDeleteBox').hidden = false;
  $('#catDeleteBox').scrollIntoView({ block: 'nearest' });
});

$('#confirmDeleteCat').addEventListener('click', () => {
  const replacement = $('#catMoveTo').value;
  for (const t of transactions) if (t.categoryId === editingCatId) t.categoryId = replacement;
  categories = categories.filter((c) => c.id !== editingCatId);
  save();
  catEditDialog.close();
  renderCatList();
  render();
});

// ---------- Pindai struk (Google Gemini) ----------

const AI_KEY = 'dompetku.ai.v1';
const AI_MODELS = [
  ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite (cepat, disarankan)'],
  ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite'],
  ['gemini-3-flash-preview', 'Gemini 3 Flash Preview (lebih teliti)'],
];
const NOTE_MAX = 300;

let aiSettings = { apiKey: '', model: AI_MODELS[0][0], ...readJSON(AI_KEY) };
if (!AI_MODELS.some(([id]) => id === aiSettings.model)) aiSettings.model = AI_MODELS[0][0];

const scanDialog = $('#scanDialog');
let scanAbort = null;

// Error yang pesannya aman ditampilkan ke pengguna; needsSettings = arahkan ke Pengaturan
const appError = (message, needsSettings = false) => Object.assign(new Error(message), { needsSettings });

// body: isi permintaan generateContent (contents, generationConfig, system_instruction)
async function callGemini(body, signal) {
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiSettings.model)}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': aiSettings.apiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw appError('Tidak bisa terhubung ke Gemini. Periksa koneksi internet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || '';
    if ((res.status === 400 && /api key/i.test(msg)) || res.status === 401 || res.status === 403) {
      throw appError('API key Gemini tidak valid atau tidak punya akses. Periksa lagi di Pengaturan.', true);
    }
    if (res.status === 404) throw appError(`Model "${aiSettings.model}" tidak tersedia untuk API key ini. Pilih model lain di Pengaturan.`, true);
    if (res.status === 429) throw appError('Batas pemakaian gratis Gemini sedang tercapai. Tunggu sebentar lalu coba lagi.');
    throw appError(`Gemini mengembalikan error (${res.status})${msg ? ': ' + msg : ''}`);
  }
  const reply = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const text = reply.filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!text) throw appError('Gemini tidak memberikan jawaban. Coba lagi.');
  return text;
}

// Perkecil foto agar cepat dikirim; tulisan struk tetap terbaca di 2000 px
async function prepareImage(file) {
  const MAX = 2000;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw appError('Format foto tidak didukung. Gunakan foto JPG atau PNG.');
  }
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

function receiptRequest(imageBase64) {
  const names = categoriesOf('expense').map((c) => c.name);
  const prompt = [
    'Baca foto struk belanja ini (umumnya struk dari Indonesia) dan isi datanya.',
    '- store: nama toko atau merchant.',
    `- date: tanggal transaksi dengan format YYYY-MM-DD. Hari ini ${todayISO()}. Kosongkan jika tidak terbaca.`,
    '- total: jumlah akhir yang dibayar dalam rupiah (TOTAL / GRAND TOTAL / TOTAL BAYAR), sudah termasuk pajak dan diskon. ' +
      'Bukan nilai TUNAI/CASH, KEMBALI, atau subtotal. Titik adalah pemisah ribuan: "25.500" berarti 25500.',
    '- items: barang yang dibeli, dengan nama yang mudah dipahami (bukan singkatan kasir), jumlah (qty), dan harga total per baris.',
    `- category: satu kategori yang paling cocok untuk keseluruhan belanja ini, pilih dari: ${names.join(', ')}.`,
    '- is_receipt: false jika foto ini bukan struk atau nota pembelian.',
  ].join('\n');
  return {
    parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }],
    config: {
      response_mime_type: 'application/json',
      response_schema: {
        type: 'OBJECT',
        properties: {
          is_receipt: { type: 'BOOLEAN' },
          store: { type: 'STRING' },
          date: { type: 'STRING' },
          total: { type: 'NUMBER' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { name: { type: 'STRING' }, qty: { type: 'NUMBER' }, price: { type: 'NUMBER' } },
              required: ['name', 'price'],
            },
          },
          category: { type: 'STRING', enum: names },
        },
        required: ['is_receipt', 'store', 'date', 'total', 'items', 'category'],
      },
    },
  };
}

function receiptToDraft(r) {
  const cats = categoriesOf('expense');
  const cat = cats.find((c) => c.name === r.category) || cats.find((c) => c.name === 'Belanja') || cats[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date <= todayISO() ? r.date : todayISO();
  const items = (r.items || []).filter((i) => i && i.name).map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name));
  const store = String(r.store || '').trim();
  const note = [store, items.join(', ')].filter(Boolean).join(': ').slice(0, NOTE_MAX);
  return { type: 'expense', amount: Math.round(r.total), categoryId: cat.id, date, note };
}

function showScanStep(step) {
  for (const s of ['Choose', 'Loading', 'Error']) $('#scan' + s).hidden = s !== step;
}

function showScanError(message, needsSettings = false) {
  $('#scanErrorMsg').textContent = message;
  $('#scanRetry').hidden = needsSettings;
  $('#scanOpenSettings').hidden = !needsSettings;
  showScanStep('Error');
}

async function scanReceipt(file) {
  const preview = $('#scanPreview');
  preview.src = URL.createObjectURL(file);
  showScanStep('Loading');
  scanAbort = new AbortController();
  try {
    const req = receiptRequest(await prepareImage(file));
    let result;
    try {
      result = JSON.parse(await callGemini({ contents: [{ parts: req.parts }], generationConfig: req.config }, scanAbort.signal));
    } catch (e) {
      if (e instanceof SyntaxError) throw appError('Jawaban Gemini tidak bisa dibaca. Coba lagi.');
      throw e;
    }
    if (!result.is_receipt) throw appError('Foto ini tidak terlihat seperti struk belanja. Coba foto ulang dengan lebih jelas.');
    if (!(result.total > 0)) throw appError('Total belanja tidak terbaca. Coba foto ulang dengan lebih jelas, terutama bagian total.');
    scanAbort = null;
    scanDialog.close();
    openForm(null, receiptToDraft(result));
  } catch (e) {
    scanAbort = null;
    if (e.name !== 'AbortError') showScanError(e.message, e.needsSettings);
  } finally {
    URL.revokeObjectURL(preview.src);
  }
}

$('#scanFab').addEventListener('click', () => {
  if (aiSettings.apiKey) showScanStep('Choose');
  else showScanError('API key Gemini belum diisi. Isi dulu di Pengaturan → Pindai struk (AI).', true);
  scanDialog.showModal();
});

['#scanCamera', '#scanGallery'].forEach((sel) =>
  $(sel).addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) scanReceipt(file);
  }));

$('#scanRetry').addEventListener('click', () => showScanStep('Choose'));
$('#closeScan').addEventListener('click', () => scanDialog.close());
scanDialog.addEventListener('close', () => {
  if (scanAbort) scanAbort.abort();
});
$('#scanOpenSettings').addEventListener('click', () => {
  scanDialog.close();
  showView('settings');
  $('#aiKey').scrollIntoView({ block: 'center' });
});

// Pengaturan AI
$('#aiModel').innerHTML = AI_MODELS.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
$('#aiKey').value = aiSettings.apiKey;
$('#aiModel').value = aiSettings.model;

function saveAiSettings() {
  aiSettings = { apiKey: $('#aiKey').value.trim(), model: $('#aiModel').value };
  localStorage.setItem(AI_KEY, JSON.stringify(aiSettings));
}

function showAiStatus(message, ok = true) {
  const el = $('#aiStatus');
  el.textContent = message;
  el.className = 'note ' + (ok ? 'status-ok' : 'status-error');
  el.hidden = false;
}

$('#saveAi').addEventListener('click', () => {
  saveAiSettings();
  showAiStatus(aiSettings.apiKey ? 'Tersimpan.' : 'API key dihapus.');
});

$('#testAi').addEventListener('click', async () => {
  saveAiSettings();
  if (!aiSettings.apiKey) return showAiStatus('Isi API key terlebih dahulu.', false);
  showAiStatus('Menghubungi Gemini…');
  try {
    await callGemini({ contents: [{ parts: [{ text: 'Balas hanya dengan kata: OK' }] }] });
    showAiStatus('✅ Terhubung. Fitur pindai struk siap dipakai.');
  } catch (e) {
    showAiStatus('❌ ' + e.message, false);
  }
});

$('#toggleKey').addEventListener('click', () => {
  const input = $('#aiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// ---------- Asisten keuangan (chat Gemini) ----------

const CHAT_KEY = 'dompetku.chat.v1';
const CHAT_MAX = 40; // pesan yang disimpan di HP
const CHAT_CONTEXT = 20; // pesan terakhir yang dikirim ke Gemini sebagai riwayat
const CHAT_SUGGESTIONS = [
  'Bagaimana kondisi keuanganku bulan ini?',
  'Kategori mana yang paling boros?',
  'Beri tips menabung dari pola pengeluaranku',
  'Berapa idealnya porsi investasi dari pemasukanku?',
];

let chat = readJSON(CHAT_KEY);
if (!Array.isArray(chat)) chat = [];
let chatBusy = false;

function saveChat() {
  chat = chat.slice(-CHAT_MAX);
  localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
}

// Ringkasan angka untuk Gemini. Catatan transaksi sengaja tidak dikirim (bisa berisi data pribadi)
function financeContext() {
  const lines = [`DATA KEUANGAN PENGGUNA (per ${todayISO()}, dalam rupiah)`];
  if (!transactions.length) return lines.concat('Belum ada transaksi yang dicatat.').join('\n');

  lines.push(`Saldo total semua waktu: ${rupiah(totals(transactions).balance)} dari ${transactions.length} transaksi.`);
  lines.push('', 'Ringkasan 6 bulan terakhir (pemasukan | pengeluaran | investasi/tabungan | sisa):');
  const d = new Date();
  d.setDate(1);
  const thisMonth = monthKey(d);
  for (let i = 0; i < 6; i++) {
    const key = monthKey(d);
    const s = summarize(transactions.filter((t) => t.date.startsWith(key)));
    lines.push(`- ${key}: ${rupiah(s.income)} | ${rupiah(s.spending)} | ${rupiah(s.investment)} | ${rupiah(s.income - s.spending - s.investment)}`);
    d.setMonth(d.getMonth() - 1);
  }

  const current = transactions.filter((t) => t.date.startsWith(thisMonth));
  const byCategory = (list) => {
    const sums = {};
    for (const t of list) sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
    const parts = Object.entries(sums).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${getCategory(id).name} ${rupiah(v)}`);
    return parts.length ? parts.join(', ') : 'tidak ada';
  };
  lines.push('', `Rincian bulan ini (${thisMonth}):`);
  lines.push(`- Pengeluaran per kategori: ${byCategory(current.filter((t) => t.type === 'expense' && !isInvestment(t)))}`);
  lines.push(`- Investasi/tabungan per kategori: ${byCategory(current.filter(isInvestment))}`);
  lines.push(`- Pemasukan per kategori: ${byCategory(current.filter((t) => t.type === 'income'))}`);
  return lines.join('\n');
}

function chatSystemPrompt() {
  return [
    'Kamu adalah asisten keuangan pribadi di aplikasi pencatat keuangan "Dompetku".',
    'Gunakan Bahasa Indonesia yang ramah, jelas, dan ringkas (sekitar 200 kata kecuali pengguna meminta rincian).',
    'Dasarkan analisis pada data keuangan pengguna di bawah. Jangan mengarang angka; jika datanya kurang, katakan terus terang dan sarankan apa yang perlu dicatat.',
    'Beri saran yang praktis dan sesuai konteks Indonesia. Kamu bukan penasihat keuangan berlisensi: untuk keputusan besar (investasi besar, utang, pajak) sarankan berkonsultasi dengan profesional.',
    'Format: paragraf pendek dan daftar berpoin bila perlu; gunakan **tebal** untuk angka atau poin penting; tulis nominal seperti Rp1.234.567.',
    '',
    financeContext(),
  ].join('\n');
}

// Markdown sederhana dari jawaban AI -> HTML aman (teks di-escape dulu)
function renderMarkdown(text) {
  const inline = (s) => escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const openList = (tag) => {
    if (list !== tag) {
      closeList();
      out.push(`<${tag}>`);
      list = tag;
    }
  };
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^[-*•]\s+(.*)/))) {
      openList('ul');
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\d+[.)]\s+(.*)/))) {
      openList('ol');
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      if (!line) continue;
      m = line.match(/^#{1,6}\s+(.*)/);
      out.push(m ? `<p><strong>${inline(m[1])}</strong></p>` : `<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('');
}

function renderChat(extra = '') {
  $('#chatNoKey').hidden = !!aiSettings.apiKey;
  $('#chatSuggestions').hidden = chat.length > 0 || !aiSettings.apiKey;
  $('#chatClear').hidden = !chat.length;
  $('#chatLog').innerHTML = chat.map((m) => (m.role === 'model'
    ? `<div class="msg model">${renderMarkdown(m.text)}</div>`
    : `<div class="msg user">${escapeHtml(m.text)}</div>`)).join('') + extra;
  if ($('#view-chat').classList.contains('active')) window.scrollTo(0, document.body.scrollHeight);
}

// text kosong = kirim ulang (pesan terakhir pengguna belum terjawab)
async function sendChat(text = '') {
  if (chatBusy || !aiSettings.apiKey) return renderChat();
  if (text) {
    chat.push({ role: 'user', text });
    saveChat();
  }
  if (!chat.length || chat[chat.length - 1].role !== 'user') return renderChat();
  chatBusy = true;
  $('#chatSend').disabled = true;
  renderChat('<div class="msg model typing" aria-label="Asisten sedang mengetik"><span></span><span></span><span></span></div>');
  try {
    const history = chat.slice(-CHAT_CONTEXT);
    while (history.length && history[0].role !== 'user') history.shift();
    const reply = await callGemini({
      system_instruction: { parts: [{ text: chatSystemPrompt() }] },
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    });
    chat.push({ role: 'model', text: reply.trim() });
    saveChat();
    renderChat();
  } catch (e) {
    renderChat(`<div class="msg error">${escapeHtml(e.message)}
      <span class="msg-actions">
        <button type="button" class="link-btn" data-chat="retry">Kirim ulang</button>
        ${e.needsSettings ? '<button type="button" class="link-btn" data-chat="settings">Buka Pengaturan</button>' : ''}
      </span></div>`);
  } finally {
    chatBusy = false;
    $('#chatSend').disabled = false;
  }
}

$('#chatSuggestions').innerHTML = CHAT_SUGGESTIONS.map((s) => `<button type="button" class="chip">${s}</button>`).join('');
$('#chatSuggestions').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) sendChat(chip.textContent);
});

$('#chatLog').addEventListener('click', (e) => {
  const action = e.target.closest('[data-chat]');
  if (!action) return;
  if (action.dataset.chat === 'retry') sendChat();
  else showView('settings');
});

$('#chatOpenSettings').addEventListener('click', () => {
  showView('settings');
  $('#aiKey').scrollIntoView({ block: 'center' });
});

const chatText = $('#chatText');
function resizeChatInput() {
  chatText.style.height = 'auto';
  chatText.style.height = Math.min(chatText.scrollHeight, 120) + 'px';
}
chatText.addEventListener('input', resizeChatInput);
// Enter mengirim, Shift+Enter membuat baris baru
chatText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $('#chatForm').requestSubmit();
  }
});

$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatText.value.trim();
  if (!text || chatBusy) return;
  chatText.value = '';
  resizeChatInput();
  sendChat(text);
});

$('#chatClear').addEventListener('click', () => {
  if (!confirm('Hapus seluruh percakapan dengan asisten?')) return;
  chat = [];
  saveChat();
  renderChat();
});

// ---------- Navigation ----------

$('#fab').addEventListener('click', () => openForm());

$('#prevMonth').addEventListener('click', () => { current.setMonth(current.getMonth() - 1); render(); });
$('#nextMonth').addEventListener('click', () => { current.setMonth(current.getMonth() + 1); render(); });

function showView(name) {
  document.querySelectorAll('.bottombar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  // Tombol tambah & pindai hanya di Beranda, agar tidak menutupi isi halaman lain
  $('#fab').hidden = $('#scanFab').hidden = name !== 'home';
  $('#chatForm').hidden = name !== 'chat' || !aiSettings.apiKey;
  document.body.classList.toggle('chat-mode', name === 'chat');
  if (name === 'chat') renderChat();
  else window.scrollTo(0, 0);
}

document.querySelectorAll('.bottombar button').forEach((btn) =>
  btn.addEventListener('click', () => showView(btn.dataset.view)));

// ---------- Ekspor, cadangan, pulihkan ----------

// Menu "Bagikan" HP (Gmail, WhatsApp, Drive, dll.) hanya tersedia di perangkat yang mendukung
const canShareFiles = (() => {
  try {
    return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'tes.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
})();
document.querySelectorAll('.share-btn').forEach((b) => { b.hidden = !canShareFiles; });

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Tersimpan di folder Download: ${filename}`);
}

async function shareFile(blob, filename, text) {
  // Chrome Android menolak berbagi file .json (meski canShare() bilang boleh), jadi dikirim sebagai .txt
  const file = /\.(csv|txt)$/.test(filename)
    ? new File([blob], filename, { type: blob.type })
    : new File([blob], filename.replace(/\.\w+$/, '.txt'), { type: 'text/plain' });
  try {
    await navigator.share({ files: [file], title: filename, text });
  } catch (e) {
    if (e.name !== 'AbortError') saveFile(blob, filename);
  }
}

function csvBlob() {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Tanggal', 'Jenis', 'Kategori', 'Jumlah', 'Catatan']];
  [...transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) =>
    rows.push([t.date, t.type === 'income' ? 'Pemasukan' : 'Pengeluaran', getCategory(t.categoryId).name, t.amount, t.note]));
  // Pemisah ';' agar langsung terbaca rapi di Excel versi Indonesia
  return new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n')], { type: 'text/csv' });
}

function backupBlob() {
  const data = { app: 'dompetku', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), categories, transactions };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

const csvName = () => `dompetku-laporan-${todayISO()}.csv`;
const backupName = () => `dompetku-cadangan-${todayISO()}.json`;

const ACTIONS = {
  'csv-share': () => shareFile(csvBlob(), csvName(), `Laporan transaksi Dompetku per ${todayISO()}`),
  'csv-save': () => saveFile(csvBlob(), csvName()),
  'backup-share': () => shareFile(backupBlob(), backupName(),
    `Cadangan data Dompetku per ${todayISO()}. Simpan file ini untuk memulihkan data lewat menu Pengaturan → Pulihkan.`),
  'backup-save': () => saveFile(backupBlob(), backupName()),
};

document.querySelectorAll('[data-action]').forEach((btn) =>
  btn.addEventListener('click', () => ACTIONS[btn.dataset.action]()));

function parseBackup(text) {
  const data = JSON.parse(text);
  // Format lama (versi pertama) hanya berisi daftar transaksi
  const legacy = Array.isArray(data);
  const cats = legacy ? defaultCategories() : data && data.app === 'dompetku' && data.categories;
  const txs = legacy ? data : data && data.transactions;
  const validCats = Array.isArray(cats) && cats.every((c) =>
    c && typeof c.id === 'string' && (c.type === 'income' || c.type === 'expense') &&
    typeof c.name === 'string' && c.name.trim() && typeof c.icon === 'string');
  const validTxs = Array.isArray(txs) && txs.every((t) =>
    t && t.id && (t.type === 'income' || t.type === 'expense') &&
    Number.isFinite(t.amount) && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
  if (!validCats || !validTxs) throw new Error('format');
  const restored = txs.map((t) => ({ note: '', createdAt: 0, ...t }));
  normalize(cats, restored);
  return { cats, txs: restored };
}

$('#importJson').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let backup;
  try {
    backup = parseBackup(await file.text());
  } catch {
    toast('File cadangan tidak valid.');
    return;
  }
  if (!confirm(`Pulihkan ${backup.txs.length} transaksi dan ${backup.cats.length} kategori? Data saat ini akan diganti.`)) return;
  categories = backup.cats;
  transactions = backup.txs;
  save();
  render();
  toast('Data berhasil dipulihkan.');
});

$('#clearAll').addEventListener('click', () => {
  if (!confirm('Hapus SEMUA transaksi? Kategori tetap disimpan. Tindakan ini tidak bisa dibatalkan.')) return;
  transactions = [];
  save();
  render();
});

// ---------- PWA ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('#installBox').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installBox').hidden = true;
});

render();
