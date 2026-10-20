'use strict';

const STORAGE_KEY = 'dompetku.transactions.v1';

const CATEGORIES = {
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

const COLORS = ['#0f9d58', '#4285f4', '#f4b400', '#db4437', '#ab47bc', '#00acc1', '#ff7043', '#9e9d24', '#5c6bc0', '#8d6e63', '#78909c'];

const $ = (sel) => document.querySelector(sel);

// ---------- State ----------

let transactions = load();
let current = new Date();
current.setDate(1);
let editingId = null;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ---------- Helpers ----------

const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function iconFor(type, category) {
  const found = CATEGORIES[type].find(([name]) => name === category);
  return found ? found[1] : '•';
}

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
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.innerHTML = `
      <div class="tx-icon">${iconFor(t.type, t.category)}</div>
      <div class="tx-main">
        <div class="tx-cat">${escapeHtml(t.category)}</div>
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
  for (const t of list) if (t.type === type) sums[t.category] = (sums[t.category] || 0) + t.amount;
  const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!entries.length) {
    box.innerHTML = '<p class="empty">Tidak ada data.</p>';
    return;
  }
  box.innerHTML = entries.map(([cat, val], i) => {
    const pct = (val / total) * 100;
    return `
      <div class="row">
        <div class="row-head">
          <span>${iconFor(type, cat)} ${escapeHtml(cat)}</span>
          <span>${rupiah(val)} · ${pct.toFixed(0)}%</span>
        </div>
        <div class="bar"><div style="width:${pct}%;background:${COLORS[i % COLORS.length]}"></div></div>
      </div>`;
  }).join('');
}

// ---------- Form ----------

const dialog = $('#txDialog');
const amountInput = $('#amount');

function fillCategories(type, selected) {
  $('#category').innerHTML = CATEGORIES[type]
    .map(([name, icon]) => `<option value="${name}" ${name === selected ? 'selected' : ''}>${icon} ${name}</option>`)
    .join('');
}

function openForm(tx = null) {
  editingId = tx ? tx.id : null;
  const type = tx ? tx.type : 'expense';
  $('#formTitle').textContent = tx ? 'Ubah transaksi' : 'Tambah transaksi';
  $(type === 'income' ? '#typeIncome' : '#typeExpense').checked = true;
  fillCategories(type, tx && tx.category);
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
    category: $('#category').value,
    date: $('#date').value,
    note: $('#note').value.trim(),
  };
  if (editingId) {
    Object.assign(transactions.find((t) => t.id === editingId), data);
  } else {
    transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), createdAt: Date.now(), ...data });
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

// ---------- Ekspor / impor ----------

function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#exportCsv').addEventListener('click', () => {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['Tanggal', 'Jenis', 'Kategori', 'Jumlah', 'Catatan']];
  [...transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) =>
    rows.push([t.date, t.type === 'income' ? 'Pemasukan' : 'Pengeluaran', t.category, t.amount, t.note]));
  // Pemisah ';' agar langsung terbaca rapi di Excel versi Indonesia
  download(`dompetku-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n'), 'text/csv');
});

$('#exportJson').addEventListener('click', () => {
  download(`dompetku-cadangan-${todayISO()}.json`, JSON.stringify(transactions, null, 2), 'application/json');
});

$('#importJson').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const valid = Array.isArray(data) && data.every((t) =>
      t && t.id && (t.type === 'income' || t.type === 'expense') && Number.isFinite(t.amount) && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
    if (!valid) throw new Error('format');
    if (!confirm(`Pulihkan ${data.length} transaksi? Data saat ini akan diganti.`)) return;
    transactions = data.map((t) => ({ note: '', category: 'Lainnya', createdAt: 0, ...t }));
    save();
    render();
    alert('Data berhasil dipulihkan.');
  } catch {
    alert('File cadangan tidak valid.');
  }
});

$('#clearAll').addEventListener('click', () => {
  if (!confirm('Hapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan.')) return;
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
