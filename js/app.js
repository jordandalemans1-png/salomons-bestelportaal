// Gedeeld door alle pagina's: demo-database, kopbalk, hulpfuncties en animaties.
// DEMO: alles staat in de browser (localStorage). Twee tabbladen praten live met elkaar,
// precies zoals het echte portaal via de database doet.

const DB_KEY = "salomons-portaal-demo-v1";
const STATUSES = [
  { key: "nieuw", label: "Nieuw" },
  { key: "inbehandeling", label: "In behandeling" },
  { key: "klaar", label: "Klaargemaakt" },
  { key: "geleverd", label: "Geleverd" },
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));
const STATUS_IDX = Object.fromEntries(STATUSES.map((s, i) => [s.key, i]));
const NOTIFY_LABEL = { email: "E-mail", whatsapp: "WhatsApp", beide: "E-mail en WhatsApp" };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- kleine hulpjes ---------- */
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const pad = n => String(n).padStart(2, "0");
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
function fmtDay(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
const fmtStamp = iso => iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const pill = st => h("span", { class: "pill s-" + st }, STATUS_LABEL[st] || st);
const linesText = o => (o.lines || []).map(l => `${l.qty} × ${String(l.unit).toLowerCase()} ${String(l.product).toLowerCase()}`).join(", ");
const normStatus = s => STATUS_LABEL[s] ? s : "nieuw";
function showMsg(el, text, kind = "err") {
  el.className = "notice " + kind;
  el.textContent = text || "";
  el.hidden = !text;
  if (text) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
}

/* ---------- demo-database ---------- */
function seed() {
  const now = Date.now(), ago = h => new Date(now - h * 3600e3).toISOString();
  const day = n => isoDay(addDays(n));
  const products = [
    { id: 1, name: "Scharreleieren", units: ["Trays (30 st.)", "Dozen (180 st.)", "Pallets (10.800 st.)"], active: true, sort: 10 },
    { id: 2, name: "Vrije-uitloopeieren", units: ["Trays (30 st.)", "Dozen (180 st.)", "Pallets (10.800 st.)"], active: true, sort: 20 },
    { id: 3, name: "Losse doosjes scharrel (10 st.)", units: ["Omdozen (12 doosjes)", "Kratten (24 doosjes)"], active: true, sort: 30 },
    { id: 4, name: "Pulptrays 30-gats", units: ["Bundels (140 st.)", "Pallets (8.400 st.)"], active: true, sort: 40 },
    { id: 5, name: "Eieren klasse B (industrie)", units: ["Containers"], active: false, sort: 50 },
  ];
  const profiles = [
    { id: "p-admin", email: "beheer@salomons-dronten.nl", company: "Pluimveebedrijf Salomons B.V.", contact: "Beheerder", phone: "", approved: true, is_admin: true, created_at: ago(2400) },
    { id: "p-1", email: "inkoop@eierhandeldepolder.nl", company: "Eierhandel De Polder", contact: "Marieke de Vries", phone: "06 12345678", address: "", notify: "beide", approved: true, is_admin: false, created_at: ago(900) },
    { id: "p-2", email: "info@bakkerijzonneveld.nl", company: "Bakkerij Zonneveld", contact: "Pieter Zonneveld", phone: "06 23456789", notify: "whatsapp", approved: true, is_admin: false, created_at: ago(700) },
    { id: "p-3", email: "keuken@hetoldeveer.nl", company: "Restaurant Het Oude Veer", contact: "Sanne Bakker", phone: "", notify: "email", approved: true, is_admin: false, created_at: ago(500) },
    { id: "p-4", email: "winkel@boerderijwinkeldeakker.nl", company: "Boerderijwinkel De Akker", contact: "Joost Hendriks", phone: "06 34567890", notify: "email", approved: false, is_admin: false, created_at: ago(5) },
  ];
  const o = (id, num, p, status, delivery, created, lines, extra = {}) => {
    const pr = profiles.find(x => x.id === p);
    return { id, number: num, customer_id: p, company: pr.company, email: pr.email, contact: pr.contact, phone: pr.phone, notify: pr.notify, address: "", notes: "", status, delivery_date: delivery, created_at: created, lines, ...extra };
  };
  const orders = [
    o(1, "2026-0141", "p-1", "nieuw", day(1), ago(1.2), [{ product: "Scharreleieren", unit: "Dozen (180 st.)", qty: 24 }, { product: "Pulptrays 30-gats", unit: "Bundels (140 st.)", qty: 6 }], { notes: "Graag losadres achterom, dock 2." }),
    o(2, "2026-0140", "p-2", "nieuw", day(2), ago(3), [{ product: "Vrije-uitloopeieren", unit: "Trays (30 st.)", qty: 40 }]),
    o(3, "2026-0139", "p-3", "inbehandeling", day(0), ago(20), [{ product: "Losse doosjes scharrel (10 st.)", unit: "Omdozen (12 doosjes)", qty: 8 }]),
    o(4, "2026-0138", "p-1", "klaar", day(0), ago(30), [{ product: "Scharreleieren", unit: "Pallets (10.800 st.)", qty: 1 }]),
    o(5, "2026-0137", "p-2", "klaar", day(1), ago(44), [{ product: "Scharreleieren", unit: "Trays (30 st.)", qty: 25 }]),
    o(6, "2026-0136", "p-3", "geleverd", day(-2), ago(96), [{ product: "Vrije-uitloopeieren", unit: "Trays (30 st.)", qty: 12 }]),
    o(7, "2026-0135", "p-1", "geleverd", day(-4), ago(140), [{ product: "Scharreleieren", unit: "Dozen (180 st.)", qty: 30 }]),
  ];
  return { v: 1, products, profiles, orders, session: null, nextNum: 142, nextId: 8 };
}
const DB = {
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DB_KEY) || "null"); } catch (e) {}
    if (!d || d.v !== 1) { d = seed(); DB.data = d; DB.save(true); }
    DB.data = d;
    return d;
  },
  save(silent) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(DB.data)); } catch (e) {}
    if (!silent) try { DB.bc && DB.bc.postMessage("change"); } catch (e) {}
  },
  reset() { try { localStorage.removeItem(DB_KEY); } catch (e) {} DB.data = seed(); DB.save(); },
  listeners: [],
  onChange(fn) { DB.listeners.push(fn); },
};
DB.load();
try { DB.bc = new BroadcastChannel("salomons-demo"); DB.bc.onmessage = () => { DB.load(); DB.listeners.forEach(f => f()); }; } catch (e) {}
window.addEventListener("storage", e => { if (e.key === DB_KEY) { DB.load(); DB.listeners.forEach(f => f()); } });

// Huidige gebruiker met profiel, of null.
function currentProfile() {
  const id = DB.data.session;
  return id ? DB.data.profiles.find(p => p.id === id) || null : null;
}
function signIn(id) { DB.data.session = id; DB.save(); }
function signOut() { DB.data.session = null; DB.save(); }

/* ---------- kopbalk ---------- */
function setupNav(profile) {
  document.querySelectorAll("[data-admin]").forEach(el => { el.hidden = !profile?.is_admin; });
  const out = $("nav-logout");
  if (out) {
    out.hidden = !profile;
    out.onclick = () => { signOut(); location.href = "index.html"; };
  }
  const who = $("nav-who");
  if (who) { who.textContent = profile ? (profile.is_admin ? "Beheerder" : profile.company) : ""; }
  const badge = $("new-badge");
  if (badge && profile?.is_admin) {
    const n = DB.data.orders.filter(o => o.status === "nieuw").length;
    badge.textContent = n; badge.hidden = n === 0;
  }
}

// Voor beheer en orderscherm: alleen voor beheerders.
function requireAdmin(container) {
  const profile = currentProfile();
  setupNav(profile);
  if (!profile) {
    container.replaceChildren(h("div", { class: "notice info" }, "Log eerst in. ", h("a", { href: "index.html" }, "Naar inloggen"),
      h("div", { style: "margin-top:12px" }, h("button", { type: "button", class: "btn btn-primary btn-sm", onclick: () => { signIn("p-admin"); location.reload(); } }, "Demo: inloggen als beheerder"))));
    return null;
  }
  if (!profile.is_admin) {
    container.replaceChildren(h("div", { class: "notice err" }, "Deze pagina is alleen voor de beheerder. ", h("a", { href: "index.html" }, "Terug naar bestellen")));
    return null;
  }
  return profile;
}

/* ---------- WhatsApp ---------- */
const wantsWhatsApp = o => o.notify === "whatsapp" || o.notify === "beide";
// Telefoonnummer in het formaat dat wa.me verwacht (alleen cijfers, met landcode).
function waNumber(phone) {
  let d = String(phone || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "31" + d.slice(1);
  d = d.replace(/\D/g, "");
  return d.length >= 10 ? d : "";
}
const waLink = (phone, text) => `https://wa.me/${phone ? waNumber(phone) : ""}?text=${encodeURIComponent(text)}`;
const readyText = o => `Beste ${o.contact || "klant"}, uw bestelling ${o.number} (${linesText(o)}) is klaargemaakt voor levering op ${fmtDay(o.delivery_date)}. Met vriendelijke groet, Pluimveebedrijf Salomons B.V.`;
const receivedText = o => `Beste ${o.contact || "klant"}, wij hebben uw bestelling ${o.number} (${linesText(o)}) ontvangen voor levering op ${fmtDay(o.delivery_date)}. Met vriendelijke groet, Pluimveebedrijf Salomons B.V.`;
function shareText(o) {
  const lines = (o.lines || []).map(l => `- ${l.qty} × ${l.unit} ${l.product}`).join("\n");
  return `Bestelling ${o.number} van ${o.company}\nLevering: ${fmtDay(o.delivery_date)}\n${lines}` +
    (o.address ? `\nAfleveradres: ${o.address}` : "") + (o.notes ? `\nOpmerking: ${o.notes}` : "") +
    `\nContact: ${o.contact}${o.phone ? " · " + o.phone : ""}`;
}
function whatsappButtons(o) {
  const btns = [];
  if (waNumber(o.phone)) {
    const ready = o.status === "klaar" || o.status === "geleverd";
    btns.push(h("a", { class: "btn btn-sm wa" + (ready && wantsWhatsApp(o) ? " wa-hot" : ""), href: waLink(o.phone, ready ? readyText(o) : receivedText(o)), target: "_blank", rel: "noopener" },
      ready ? "WhatsApp: klaar-melding" : "WhatsApp: ontvangen"));
  }
  btns.push(h("a", { class: "btn btn-sm wa", href: waLink("", shareText(o)), target: "_blank", rel: "noopener" }, "Delen via WhatsApp"));
  return h("div", { class: "wa-row" }, btns);
}

/* ---------- animaties ---------- */
// Rimpel op elke knop.
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(".btn");
  if (!b || REDUCED) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const dot = h("span", { class: "ripple", style: `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px` });
  b.append(dot); setTimeout(() => dot.remove(), 650);
});
// Getal laten optellen.
function countUp(el, to, ms = 700) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (REDUCED || from === to) { el.textContent = to.toLocaleString("nl-NL"); return; }
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString("nl-NL");
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// FLIP: elementen glijden naar hun nieuwe plek na opnieuw tekenen.
function flip(container, selector, render) {
  const first = new Map();
  container.querySelectorAll(selector).forEach(el => first.set(el.dataset.key, el.getBoundingClientRect()));
  render();
  if (REDUCED) return;
  container.querySelectorAll(selector).forEach(el => {
    const f = first.get(el.dataset.key);
    if (!f) { el.classList.add(first.size ? "fresh" : "enter"); return; }
    const l = el.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
    if (!dx && !dy) return;
    el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 550, easing: "cubic-bezier(.22,1,.36,1)" });
  });
}
function toast(text) {
  let box = document.querySelector(".toasts");
  if (!box) { box = h("div", { class: "toasts", "aria-live": "polite" }); document.body.append(box); }
  const t = h("div", { class: "toast" }, text);
  box.append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 3200);
}
function eggRain(n = 36) {
  if (REDUCED) return;
  const box = h("div", { class: "egg-rain", "aria-hidden": "true" });
  for (let i = 0; i < n; i++) {
    const s = 0.7 + Math.random() * 0.8;
    box.append(h("i", { style: `left:${Math.random() * 100}%;transform:scale(${s});--rot:${(Math.random() * 720 - 360) | 0}deg;animation-duration:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * .6}s` }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4000);
}
const checkSvg = () => {
  const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 52 52"); s.setAttribute("class", "check"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = '<circle cx="26" cy="26" r="23" fill="none" stroke="#00673d" stroke-width="3" pathLength="1"/><path d="M15 27l7 7 15-16" fill="none" stroke="#00673d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>';
  return s;
};
// Scroll-reveal.
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 }) : null;
function reveal(root = document) { root.querySelectorAll(".reveal:not(.in)").forEach(el => io ? io.observe(el) : el.classList.add("in")); }

/* ---------- demo-strook en voettekst ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const r = $("demo-reset");
  if (r) r.onclick = () => { DB.reset(); location.href = "index.html"; };
  reveal();
});
