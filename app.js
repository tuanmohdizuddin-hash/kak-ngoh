/* Bil Harian Kak Ngoh — semua data disimpan dalam localStorage peranti ini. */
(() => {
  "use strict";

  const STORE_KEY = "kakngoh.bills.v1";
  const FALLBACK_RATE = 3.3; // anggaran 1 SGD = RM, guna bila tiada internet & tiada kadar tersimpan

  const CATS = [
    { id: "bus",      name: "Bas",        icon: "🚌", color: "#8fd9c0" },
    { id: "mrt",      name: "MRT",        icon: "🚇", color: "#8fbdf2" },
    { id: "grab",     name: "Grab/Teksi", icon: "🚕", color: "#b9e27a" },
    { id: "makan",    name: "Makan",      icon: "🍛", color: "#f4a7b9" },
    { id: "minum",    name: "Minum",      icon: "🧋", color: "#d9a7f4" },
    { id: "barang",   name: "Barang",     icon: "🛒", color: "#e8c48a" },
    { id: "sewa",     name: "Sewa",       icon: "🏠", color: "#f2b48f" },
    { id: "bil",      name: "Bil/Topup",  icon: "📱", color: "#9fd3f5" },
    { id: "kirim",    name: "Kirim Duit", icon: "💸", color: "#f7d774" },
    { id: "shopping", name: "Shopping",   icon: "🛍️", color: "#f59fc6" },
    { id: "kesihatan",name: "Kesihatan",  icon: "💊", color: "#a7f4d9" },
    { id: "lain",     name: "Lain-lain",  icon: "✨", color: "#cfc3c6" },
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

  // ---------- State ----------
  const defaults = {
    expenses: [],
    settings: { budget: 30, busFare: 1.3, mrtFare: 1.3, manualRate: null },
    rate: { value: null, time: null, source: null },
  };
  let state = load();
  let period = "day";
  let editingId = null;
  let formCur = "SGD";
  let formCat = "makan";

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY));
      if (raw && typeof raw === "object") {
        return {
          expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
          settings: { ...defaults.settings, ...(raw.settings || {}) },
          rate: { ...defaults.rate, ...(raw.rate || {}) },
        };
      }
    } catch (_) {}
    return structuredClone(defaults);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  // ---------- Helpers ----------
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const rate = () => state.settings.manualRate || state.rate.value || FALLBACK_RATE;
  const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; };
  const fmt = (n, cur) => (cur === "MYR" ? "RM" : "S$") + (Math.round(n * 100) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pad = n => String(n).padStart(2, "0");
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const toSgd = e => e.cur === "SGD" ? e.amt : e.amt / (e.rate || rate());
  const toMyr = e => e.cur === "MYR" ? e.amt : e.amt * (e.rate || rate());

  const HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  const prettyDate = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const today = isoDate(new Date());
    const yest = isoDate(new Date(Date.now() - 864e5));
    if (iso === today) return "Hari ini";
    if (iso === yest) return "Semalam";
    return `${HARI[dt.getDay()]}, ${d} ${BULAN[m - 1]}`;
  };

  function periodRange(p) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let end = new Date(start), days = 1;
    if (p === "week") {
      const dow = (start.getDay() + 6) % 7; // Isnin = 0
      start.setDate(start.getDate() - dow);
      end = new Date(start); end.setDate(start.getDate() + 6); days = 7;
    } else if (p === "month") {
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      days = end.getDate();
    }
    return { from: isoDate(start), to: isoDate(end), days };
  }
  const inPeriod = p => {
    const { from, to } = periodRange(p);
    return state.expenses.filter(e => e.date >= from && e.date <= to);
  };

  // ---------- Render ----------
  function render() {
    const now = new Date();
    $("#todayLabel").textContent = `${HARI[now.getDay()]} · ${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;

    const items = inPeriod(period);
    const totalSgd = items.reduce((s, e) => s + toSgd(e), 0);
    const totalMyr = items.reduce((s, e) => s + toMyr(e), 0);
    const lbl = { day: "Belanja hari ini", week: "Belanja minggu ini", month: "Belanja bulan ini" }[period];
    $("#periodLabel").textContent = lbl;
    $("#heroSgd").textContent = fmt(totalSgd, "SGD");
    $("#heroMyr").textContent = "≈ " + fmt(totalMyr, "MYR");
    $("#breakdownPeriod").textContent = { day: "Hari ini", week: "Minggu ini", month: "Bulan ini" }[period];

    // Budget ring
    const { days } = periodRange(period);
    const budget = (state.settings.budget || 0) * days;
    const pct = budget > 0 ? (totalSgd / budget) * 100 : 0;
    const ring = $("#budgetRing");
    ring.style.setProperty("--p", Math.min(100, pct).toFixed(1));
    ring.classList.toggle("warn", pct >= 75 && pct < 100);
    ring.classList.toggle("over", pct >= 100);
    $("#ringPct").textContent = budget > 0 ? Math.round(pct) + "%" : "—";
    if (budget > 0) {
      const left = budget - totalSgd;
      $("#budgetNote").textContent = left >= 0
        ? `Baki bajet ${fmt(left, "SGD")} (≈ ${fmt(left * rate(), "MYR")}) daripada ${fmt(budget, "SGD")}`
        : `Melebihi bajet sebanyak ${fmt(-left, "SGD")} 😅`;
    } else $("#budgetNote").textContent = "Tetapkan bajet harian dalam ⚙︎ Tetapan.";

    // Transport
    const today = isoDate(now);
    const trips = state.expenses.filter(e => e.date === today && (e.cat === "bus" || e.cat === "mrt")).length;
    $("#transportToday").textContent = `${trips} trip hari ini`;
    $("#busFareLbl").textContent = fmt(state.settings.busFare, "SGD");
    $("#mrtFareLbl").textContent = fmt(state.settings.mrtFare, "SGD");

    renderRate();
    renderBreakdown(items, totalSgd);
    renderList(items);
  }

  function renderBreakdown(items, total) {
    const by = {};
    items.forEach(e => { (by[e.cat] ||= { sgd: 0, n: 0 }); by[e.cat].sgd += toSgd(e); by[e.cat].n++; });
    const rows = Object.entries(by).sort((a, b) => b[1].sgd - a[1].sgd);
    const el = $("#breakdown");
    if (!rows.length) { el.innerHTML = `<div class="empty">Belum ada belanja untuk tempoh ini.</div>`; return; }
    el.innerHTML = rows.map(([id, v]) => {
      const c = CAT[id] || CAT.lain;
      const p = total ? (v.sgd / total) * 100 : 0;
      return `<div class="brow">
        <div class="bico" style="background:${c.color}33">${c.icon}</div>
        <div><div class="bname">${c.name} <small>${v.n}× · ${Math.round(p)}%</small></div>
          <div class="bar"><i style="width:${p.toFixed(1)}%;background:${c.color}"></i></div></div>
        <div class="bamt">${fmt(v.sgd, "SGD")}<small>${fmt(v.sgd * rate(), "MYR")}</small></div>
      </div>`;
    }).join("");
  }

  function renderList(items) {
    const el = $("#list");
    if (!items.length) {
      el.innerHTML = `<div class="empty"><b>🌸</b>Tiada rekod lagi. Tekan <strong>+</strong> untuk tambah, atau tekan Bas / MRT.</div>`;
      return;
    }
    const sorted = [...items].sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")) || b.created - a.created);
    let html = "", cur = null;
    const dayTotals = {};
    sorted.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + toSgd(e); });
    for (const e of sorted) {
      if (e.date !== cur) {
        cur = e.date;
        html += `<div class="day-head"><span>${prettyDate(cur)}</span><span>${fmt(dayTotals[cur], "SGD")}</span></div>`;
      }
      const c = CAT[e.cat] || CAT.lain;
      const other = e.cur === "SGD" ? fmt(toMyr(e), "MYR") : fmt(toSgd(e), "SGD");
      html += `<div class="item">
        <div class="iico" style="background:${c.color}33">${c.icon}</div>
        <div><div class="ititle">${c.name}</div><div class="isub">${e.time ? e.time + " · " : ""}${esc(e.note || "—")}</div></div>
        <div class="iamt">${fmt(e.amt, e.cur)}<small>≈ ${other}</small>
          <div class="item-actions"><button class="mini" data-edit="${e.id}">Ubah</button><button class="mini del" data-del="${e.id}">Padam</button></div>
        </div>
      </div>`;
    }
    el.innerHTML = html;
  }

  function renderRate() {
    const r = rate();
    $("#rateSgdMyr").textContent = "RM " + r.toFixed(4);
    $("#rateMyrSgd").textContent = "S$ " + (1 / r).toFixed(4);
    let meta;
    if (state.settings.manualRate) meta = "Menggunakan kadar manual (Tetapan).";
    else if (state.rate.time) {
      const d = new Date(state.rate.time);
      meta = `Kadar pasaran · dikemas kini ${d.getDate()} ${BULAN[d.getMonth()]}, ${isoTime(d)}`;
    } else meta = "Kadar anggaran — sambung internet untuk kadar terkini.";
    $("#rateMeta").textContent = meta + " Kadar pengirim wang mungkin berbeza sedikit.";
  }

  // ---------- Exchange rate ----------
  async function fetchRate(manual) {
    const btn = $("#refreshRate");
    btn.classList.add("spin");
    const sources = [
      ["open.er-api.com", async () => (await (await fetch("https://open.er-api.com/v6/latest/SGD")).json()).rates.MYR],
      ["frankfurter", async () => (await (await fetch("https://api.frankfurter.app/latest?from=SGD&to=MYR")).json()).rates.MYR],
    ];
    let ok = false;
    for (const [name, get] of sources) {
      try {
        const v = await get();
        if (v && isFinite(v) && v > 1 && v < 10) {
          state.rate = { value: v, time: Date.now(), source: name };
          save(); ok = true; break;
        }
      } catch (_) {}
    }
    btn.classList.remove("spin");
    if (manual) toast(ok ? "Kadar terkini dikemas kini ✓" : "Tak dapat sambung — guna kadar tersimpan");
    render(); syncConverter("sgd");
  }

  // ---------- Converter ----------
  function syncConverter(from) {
    const s = $("#convSgd"), m = $("#convMyr");
    if (from === "sgd") { const v = num(s.value); m.value = isNaN(v) ? "" : (v * rate()).toFixed(2); }
    else { const v = num(m.value); s.value = isNaN(v) ? "" : (v / rate()).toFixed(2); }
  }

  // ---------- Sheets ----------
  function openSheet(id) { const w = $(id); w.classList.add("open"); w.setAttribute("aria-hidden", "false"); }
  function closeSheet(w) { w.classList.remove("open"); w.setAttribute("aria-hidden", "true"); }

  function buildCats() {
    $("#cats").innerHTML = CATS.map(c => `<button type="button" class="cat" data-cat="${c.id}"><span>${c.icon}</span>${c.name}</button>`).join("");
  }
  function setCat(id) { formCat = id; $$(".cat").forEach(b => b.classList.toggle("active", b.dataset.cat === id)); }
  function setCur(c) {
    formCur = c;
    $$("#curToggle button").forEach(b => b.classList.toggle("active", b.dataset.cur === c));
    updateAmountConv();
  }
  function updateAmountConv() {
    const v = num($("#amount").value) || 0;
    $("#amountConv").textContent = formCur === "SGD" ? "≈ " + fmt(v * rate(), "MYR") : "≈ " + fmt(v / rate(), "SGD");
  }

  function openAdd(e) {
    editingId = e ? e.id : null;
    const now = new Date();
    $("#sheetTitle").textContent = e ? "Ubah belanja" : "Tambah belanja";
    $("#saveBtn").textContent = e ? "Kemas kini" : "Simpan";
    $("#amount").value = e ? e.amt : "";
    $("#date").value = e ? e.date : isoDate(now);
    $("#time").value = e ? (e.time || "") : isoTime(now);
    $("#note").value = e ? (e.note || "") : "";
    setCur(e ? e.cur : formCur);
    setCat(e ? e.cat : formCat);
    openSheet("#addSheet");
    if (!e) setTimeout(() => $("#amount").focus(), 300);
  }

  function addQuick(kind, ev) {
    const now = new Date();
    const amt = kind === "bus" ? state.settings.busFare : state.settings.mrtFare;
    state.expenses.push({ id: uid(), amt, cur: "SGD", cat: kind, note: kind === "bus" ? "Tambang bas" : "Tambang MRT", date: isoDate(now), time: isoTime(now), rate: rate(), created: Date.now() });
    save(); render();
    if (navigator.vibrate) navigator.vibrate(15);
    const btn = ev.currentTarget, r = btn.getBoundingClientRect(), sp = document.createElement("span");
    const size = Math.max(r.width, r.height);
    sp.className = "ripple";
    Object.assign(sp.style, { width: size + "px", height: size + "px", left: (ev.clientX - r.left - size / 2) + "px", top: (ev.clientY - r.top - size / 2) + "px" });
    btn.appendChild(sp); setTimeout(() => sp.remove(), 650);
    toast(`${kind === "bus" ? "🚌 Bas" : "🚇 MRT"} ${fmt(amt, "SGD")} ditambah`);
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function exportCsv() {
    if (!state.expenses.length) return toast("Tiada data untuk dieksport");
    const rows = [["Tarikh", "Masa", "Kategori", "Nota", "Amaun", "Mata wang", "SGD", "MYR", "Kadar SGD-MYR"]];
    [...state.expenses].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach(e => {
      rows.push([e.date, e.time || "", (CAT[e.cat] || CAT.lain).name, e.note || "", e.amt, e.cur, toSgd(e).toFixed(2), toMyr(e).toFixed(2), (e.rate || rate()).toFixed(4)]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `bil-kak-ngoh-${isoDate(new Date())}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Events ----------
  function bind() {
    $("#openAdd").addEventListener("click", () => openAdd());
    $("#openSettings").addEventListener("click", () => {
      const s = state.settings;
      $("#setBudget").value = s.budget || "";
      $("#setRate").value = s.manualRate || "";
      $("#setBus").value = s.busFare;
      $("#setMrt").value = s.mrtFare;
      openSheet("#settingsSheet");
    });
    $$(".sheet-wrap").forEach(w => w.addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(w); }));
    document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".sheet-wrap.open").forEach(closeSheet); });

    $("#periodSeg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      period = b.dataset.period;
      $$("#periodSeg button").forEach(x => x.classList.toggle("active", x === b));
      render();
    });

    $$("[data-quick]").forEach(b => b.addEventListener("click", ev => addQuick(b.dataset.quick, ev)));
    $("#refreshRate").addEventListener("click", () => fetchRate(true));
    $("#convSgd").addEventListener("input", () => syncConverter("sgd"));
    $("#convMyr").addEventListener("input", () => syncConverter("myr"));

    $("#curToggle").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setCur(b.dataset.cur); });
    $("#cats").addEventListener("click", e => { const b = e.target.closest(".cat"); if (b) setCat(b.dataset.cat); });
    $("#amount").addEventListener("input", updateAmountConv);

    $("#addForm").addEventListener("submit", e => {
      e.preventDefault();
      const amt = num($("#amount").value);
      if (!(amt > 0)) { toast("Masukkan amaun yang betul"); return; }
      const data = { amt: Math.round(amt * 100) / 100, cur: formCur, cat: formCat, note: $("#note").value.trim(), date: $("#date").value, time: $("#time").value };
      if (editingId) {
        const ex = state.expenses.find(x => x.id === editingId);
        Object.assign(ex, data);
        toast("Rekod dikemas kini ✓");
      } else {
        state.expenses.push({ id: uid(), ...data, rate: rate(), created: Date.now() });
        toast(`${CAT[formCat].icon} ${fmt(data.amt, data.cur)} disimpan`);
      }
      save(); closeSheet($("#addSheet")); render();
    });

    $("#list").addEventListener("click", e => {
      const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) openAdd(state.expenses.find(x => x.id === ed.dataset.edit));
      if (del && confirm("Padam rekod ini?")) {
        state.expenses = state.expenses.filter(x => x.id !== del.dataset.del);
        save(); render(); toast("Rekod dipadam");
      }
    });

    $("#settingsForm").addEventListener("submit", e => {
      e.preventDefault();
      const s = state.settings;
      const b = num($("#setBudget").value), r = num($("#setRate").value), bus = num($("#setBus").value), mrt = num($("#setMrt").value);
      s.budget = b > 0 ? b : 0;
      s.manualRate = r > 0 ? r : null;
      if (bus > 0) s.busFare = bus;
      if (mrt > 0) s.mrtFare = mrt;
      save(); closeSheet($("#settingsSheet")); render(); syncConverter("sgd");
      toast("Tetapan disimpan ✓");
    });
    $("#wipeAll").addEventListener("click", () => {
      if (confirm("Padam SEMUA rekod belanja? Tindakan ini tidak boleh diundur.")) {
        state.expenses = []; save(); render(); closeSheet($("#settingsSheet")); toast("Semua rekod dipadam");
      }
    });
    $("#exportCsv").addEventListener("click", exportCsv);
  }

  // ---------- Init ----------
  buildCats();
  bind();
  $("#convSgd").value = "1.00";
  render(); syncConverter("sgd");
  // Kemas kini kadar jika lebih 3 jam
  if (!state.rate.time || Date.now() - state.rate.time > 3 * 3600e3) fetchRate(false);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
