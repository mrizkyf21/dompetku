'use strict';

const TX_KEY = 'dompetku.transactions.v1';
const CAT_KEY = 'dompetku.categories.v1';
const BACKUP_VERSION = 2;

const DEFAULT_CATEGORIES = {
  expense: [
    ['Makan & Minum', '🍜'], ['Transportasi', '🚗'], ['Belanja', '🛒'],
    ['Tagihan', '💡'], ['Pulsa & Internet', '📱'], ['Kesehatan', '💊'],
    ['Hiburan', '🎬'], ['Pendidikan', '📚'], ['Rumah', '🏠'],
    ['Sedekah', '🤲'], ['Lainnya', '📦'],
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

const COLORS = ['#0f9d58', '#4285f4', '#f4b400', '#db4437', '#ab47bc', '#00acc1', '#ff7043', '#9e9d24', '#5c6bc0', '#8d6e63', '#78909c'];

const $ = (sel) => document.querySelector(sel);

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function defaultCategories() {
  return Object.entries(DEFAULT_CATEGORIES).flatMap(([type, list]) =>
    list.map(([name, icon]) => ({ id: newId(), type, name, icon })));
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
  for (const type of ['expense', 'income']) {
    if (!cats.some((c) => c.type === type)) cats.push({ id: newId(), type, name: 'Lainnya', icon: '📦' });
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
  renderBreakdown('#expenseBreakdown', list, 'expense');
  renderBreakdown('#incomeBreakdown', list, 'income');
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

function renderBreakdown(sel, list, type) {
  const box = $(sel);
  const sums = {};
  for (const t of list) if (t.type === type) sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
  const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!entries.length) {
    box.innerHTML = '<p class="empty">Tidak ada data.</p>';
    return;
  }
  box.innerHTML = entries.map(([id, val], i) => {
    const cat = getCategory(id);
    const pct = (val / total) * 100;
    return `
      <div class="row">
        <div class="row-head">
          <span>${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
          <span>${rupiah(val)} · ${pct.toFixed(0)}%</span>
        </div>
        <div class="bar"><div style="width:${pct}%;background:${COLORS[i % COLORS.length]}"></div></div>
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

function openForm(tx = null) {
  editingId = tx ? tx.id : null;
  const type = tx ? tx.type : 'expense';
  $('#formTitle').textContent = tx ? 'Ubah transaksi' : 'Tambah transaksi';
  $(type === 'income' ? '#typeIncome' : '#typeExpense').checked = true;
  fillCategories(type, tx && tx.categoryId);
  amountInput.value = tx ? tx.amount.toLocaleString('id-ID') : '';
  $('#date').value = tx ? tx.date : (monthKey(current) === monthKey(new Date()) ? todayISO() : `${monthKey(current)}-01`);
  $('#note').value = tx ? tx.note : '';
  $('#deleteTx').hidden = !tx;
  dialog.showModal();
  if (!tx) amountInput.focus();
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
      <button type="button" class="cat-name">${escapeHtml(c.name)}<small>${usageCount(c.id)} transaksi · ketuk untuk ubah</small></button>
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

  if (editingCatId) Object.assign(categories.find((c) => c.id === editingCatId), { name, icon: selectedIcon });
  else categories.push({ id: newId(), type: catType, name, icon: selectedIcon });
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

// ---------- Navigation ----------

$('#fab').addEventListener('click', () => openForm());

$('#prevMonth').addEventListener('click', () => { current.setMonth(current.getMonth() - 1); render(); });
$('#nextMonth').addEventListener('click', () => { current.setMonth(current.getMonth() + 1); render(); });

document.querySelectorAll('.bottombar button').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bottombar button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + btn.dataset.view));
    $('#fab').hidden = btn.dataset.view === 'settings';
    window.scrollTo(0, 0);
  }));

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
