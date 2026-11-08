// Klantpagina: inloggen, account aanvragen, bestellen en eigen bestellingen.

const VIEWS = ["auth", "recover", "pending", "order"];
const LS_SEEN = "salomons-klaar-gezien";
let profile = null, products = [], mine = [], lineSeq = 0, recovering = false, current = null;

function show(view) {
  $("loading").hidden = true;
  for (const v of VIEWS) $("view-" + v).hidden = v !== view;
  $("main").hidden = view === "auth" && $("install").hidden;
  if (current !== view) window.scrollTo(0, 0);
  current = view;
}

/* ---------- Inloggen ---------- */
function authTab(which) {
  $("t-login").setAttribute("aria-selected", String(which === "login"));
  $("t-register").setAttribute("aria-selected", String(which === "register"));
  $("seg").dataset.tab = which === "register" ? "register" : "login";
  for (const [id, w] of [["f-login", "login"], ["f-register", "register"], ["f-forgot", "forgot"]]) {
    const f = $(id), on = which === w;
    f.hidden = !on;
    if (on) { f.classList.remove("swap-in"); void f.offsetWidth; f.classList.add("swap-in"); }
  }
}
$("t-login").onclick = () => authTab("login");
$("t-register").onclick = () => authTab("register");
$("to-forgot").onclick = () => { $("fg-email").value = $("l-email").value; authTab("forgot"); };
$("back-login").onclick = () => authTab("login");
$("demo-klant").onclick = () => { signIn("p-1"); route(); };
$("demo-admin").onclick = () => { signIn("p-admin"); location.href = "beheer.html"; };

const findByEmail = e => DB.data.profiles.find(p => p.email.toLowerCase() === e.toLowerCase());

$("f-login").addEventListener("submit", e => {
  e.preventDefault();
  const msg = $("l-msg");
  showMsg(msg, "");
  const email = $("l-email").value.trim(), password = $("l-pass").value;
  if (!email || !password) { showMsg(msg, "Vul uw e-mailadres en wachtwoord in."); return; }
  const p = findByEmail(email);
  // Demo: elk wachtwoord is goed voor een bekend e-mailadres.
  if (!p) { showMsg(msg, "E-mailadres of wachtwoord klopt niet."); return; }
  signIn(p.id); route();
});

$("f-register").addEventListener("submit", e => {
  e.preventDefault();
  const msg = $("r-msg");
  showMsg(msg, "");
  const v = id => $(id).value.trim();
  const company = v("r-company"), contact = v("r-contact"), phone = v("r-phone"), email = v("r-email"), password = $("r-pass").value;
  if (!company || !contact || !email) { showMsg(msg, "Vul bedrijfsnaam, contactpersoon en e-mailadres in."); return; }
  if (password.length < 8) { showMsg(msg, "Kies een wachtwoord van minstens 8 tekens."); return; }
  if (findByEmail(email)) { showMsg(msg, "Er bestaat al een account met dit e-mailadres. Log in of kies 'Wachtwoord vergeten'."); return; }
  const p = { id: "p-" + Date.now(), email, company, contact, phone, notify: "email", address: "", approved: false, is_admin: false, created_at: new Date().toISOString() };
  DB.data.profiles.push(p);
  DB.data.session = p.id;
  DB.save();
  toast("Account aangevraagd. De beheerder krijgt hiervan een e-mail.");
  route();
});

$("f-forgot").addEventListener("submit", e => {
  e.preventDefault();
  const msg = $("fg-msg");
  const email = $("fg-email").value.trim();
  if (!email) { showMsg(msg, "Vul uw e-mailadres in."); return; }
  showMsg(msg, "Als dit adres bij ons bekend is, ontvangt u binnen een paar minuten een e-mail.", "ok");
});

$("f-recover").addEventListener("submit", e => {
  e.preventDefault();
  const msg = $("rc-msg");
  if ($("rc-pass").value.length < 8) { showMsg(msg, "Kies een wachtwoord van minstens 8 tekens."); return; }
  recovering = false;
  showMsg(msg, "Uw nieuwe wachtwoord is opgeslagen.", "ok");
  setTimeout(route, 1200);
});

/* ---------- Bestelformulier ---------- */
const unitsFor = name => (products.find(p => p.name === name) || products[0] || { units: [] }).units;
function fillOptions(select, values, selected) {
  select.replaceChildren(...values.map(v => h("option", { selected: v === selected }, v)));
}
function addLine(product, unit, qty = "") {
  const n = ++lineSeq;
  const p = h("select", { id: "l-p-" + n, "aria-label": "Product" });
  const u = h("select", { id: "l-u-" + n, "aria-label": "Verpakking" });
  const syncUnits = keep => fillOptions(u, unitsFor(p.value), keep);
  fillOptions(p, products.map(c => c.name), product);
  syncUnits(unit);
  p.addEventListener("change", () => { syncUnits(u.value); updateTotal(); });
  u.addEventListener("change", updateTotal);
  const q = h("input", { id: "l-q-" + n, class: "qty", type: "number", min: "1", step: "1", inputmode: "numeric", value: qty, "aria-label": "Aantal", placeholder: "0", oninput: updateTotal });
  const row = h("div", { class: "line" }, p, u, q,
    h("button", { type: "button", class: "icon-btn remove", "aria-label": "Regel verwijderen", title: "Regel verwijderen", onclick: () => {
      row.classList.add("out");
      setTimeout(() => { row.remove(); if (!$("lines").children.length) addLine(); updateTotal(); }, REDUCED ? 0 : 280);
    } }, "×"));
  $("lines").append(row);
  return row;
}
function readLines() {
  return [...$("lines").children].filter(r => !r.classList.contains("out")).map(row => {
    const [p, u, q] = row.querySelectorAll("select, input");
    return { product: p.value, unit: u.value, qty: Number(q.value) };
  });
}
$("add-line").onclick = () => addLine().querySelector("input").focus();

// Teller onder de regels: aantal verpakkingen en (waar af te leiden) aantal eieren.
function eggsPer(l) {
  if (/pulp/i.test(l.product)) return 0;
  const st = /\(([\d.]+)\s*st\.\)/i.exec(l.unit), doos = /\((\d+)\s*doosjes\)/i.exec(l.unit), inDoos = /\((\d+)\s*st\.\)/i.exec(l.product);
  if (st) return Number(st[1].replace(/\./g, ""));
  if (doos && inDoos) return Number(doos[1]) * Number(inDoos[1]);
  return 0;
}
function updateTotal() {
  const good = readLines().filter(l => Number.isInteger(l.qty) && l.qty > 0);
  const packs = good.reduce((s, l) => s + l.qty, 0), eggs = good.reduce((s, l) => s + l.qty * eggsPer(l), 0);
  $("total-label").textContent = packs ? `${packs} ${packs === 1 ? "verpakking" : "verpakkingen"} in ${good.length} ${good.length === 1 ? "regel" : "regels"}${eggs ? " · ongeveer" : ""}` : "Nog geen aantallen";
  const b = $("total-eggs");
  if (Number(b.dataset.v || 0) !== eggs) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  countUp(b, eggs);
  b.hidden = !eggs;
  $("total-unit").textContent = eggs ? "eieren" : "";
}

// Snelkeuze voor de leverdatum: de komende 12 dagen.
function renderDays() {
  const days = [];
  for (let i = 0; i < 12; i++) {
    const d = addDays(i), iso = isoDay(d);
    days.push(h("button", { type: "button", class: "day", "data-d": iso, "aria-pressed": String($("o-date").value === iso), onclick: () => { $("o-date").value = iso; syncDays(); } },
      h("small", null, i === 0 ? "Vandaag" : i === 1 ? "Morgen" : d.toLocaleDateString("nl-NL", { weekday: "short" })),
      h("b", null, d.getDate()),
      h("small", null, d.toLocaleDateString("nl-NL", { month: "short" }))));
  }
  $("days").replaceChildren(...days);
}
function syncDays() { $("days").querySelectorAll(".day").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.d === $("o-date").value))); }
$("o-date").addEventListener("change", syncDays);

function fillProfileFields() {
  $("o-company").value = profile.company || "";
  $("o-email").value = profile.email || "";
  $("o-contact").value = profile.contact || "";
  $("o-phone").value = profile.phone || "";
  $("o-address").value = profile.address || "";
  $("o-notify").value = NOTIFY_LABEL[profile.notify] ? profile.notify : "email";
  $("hello").textContent = `Ingelogd als ${profile.contact || profile.email} · ${profile.company}`;
}

$("order-form").addEventListener("submit", e => {
  e.preventDefault();
  const msg = $("o-msg");
  showMsg(msg, "");
  const v = id => $(id).value.trim();
  const contact = v("o-contact"), phone = v("o-phone"), address = v("o-address"), notify = $("o-notify").value;
  const delivery_date = $("o-date").value, notes = v("o-notes");
  const lines = readLines();
  const good = lines.filter(l => Number.isInteger(l.qty) && l.qty > 0);
  const missing = [];
  if (!contact) missing.push("contactpersoon");
  if (notify !== "email" && !waNumber(phone)) missing.push("een telefoonnummer voor WhatsApp (bijv. 06 12345678)");
  if (!delivery_date) missing.push("leverdatum");
  if (!good.length) missing.push("minstens één product met een aantal");
  if (missing.length) { showMsg(msg, "Vul nog in: " + missing.join(", ") + "."); return; }
  if (good.length < lines.length) { showMsg(msg, "Controleer de aantallen: gebruik hele getallen groter dan 0, of verwijder lege regels."); return; }
  if (delivery_date < isoDay(new Date())) { showMsg(msg, "De leverdatum ligt in het verleden. Kies een datum vanaf vandaag."); return; }

  const btn = $("o-submit");
  btn.disabled = true; btn.textContent = "Bezig met versturen…";
  setTimeout(() => {
    DB.load();
    const me = DB.data.profiles.find(p => p.id === profile.id);
    if (!me || (!me.approved && !me.is_admin)) {
      btn.disabled = false; btn.textContent = "Bestelling plaatsen";
      showMsg(msg, "Uw account is nog niet goedgekeurd om te bestellen. Neem contact met ons op.");
      return;
    }
    const number = `${new Date().getFullYear()}-${String(DB.data.nextNum++).padStart(4, "0")}`;
    const order = { id: DB.data.nextId++, number, customer_id: profile.id, company: profile.company, email: profile.email, contact, phone, address, notify, delivery_date, notes, lines: good, status: "nieuw", created_at: new Date().toISOString() };
    DB.data.orders.unshift(order);
    // Gewijzigde contactgegevens onthouden voor de volgende keer.
    Object.assign(me, { contact, phone, address, notify });
    profile = me;
    DB.save();
    btn.disabled = false; btn.textContent = "Bestelling plaatsen";
    $("confirm-num").textContent = number;
    $("confirm-summary").textContent = `${linesText(order)} · levering ${fmtDay(delivery_date)}`;
    $("confirm-check").replaceChildren(checkSvg());
    $("order-form").hidden = true;
    $("confirm").hidden = false;
    $("confirm").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
    eggRain();
    loadMine();
  }, REDUCED ? 0 : 650);
});

$("new-order").onclick = () => {
  $("lines").replaceChildren(); addLine();
  $("o-notes").value = ""; $("o-date").value = ""; syncDays(); updateTotal();
  $("confirm").hidden = true; $("order-form").hidden = false;
};

/* ---------- Eigen bestellingen en melding "klaargemaakt" ---------- */
function seenReady() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || "[]")); } catch (e) { return new Set(); }
}
function renderReadyBanner() {
  const seen = seenReady();
  const ready = mine.filter(o => o.status === "klaar" && !seen.has(o.number));
  const box = $("ready-banner");
  const was = box.hidden;
  box.hidden = !ready.length;
  if (!ready.length) return;
  box.replaceChildren(
    checkSvg(),
    h("div", { class: "ready-text" },
      h("strong", null, ready.length === 1 ? "Uw bestelling is klaargemaakt" : `${ready.length} bestellingen zijn klaargemaakt`),
      ready.map(o => h("span", null, h("span", { class: "mono" }, o.number), " · ", linesText(o), " · levering ", fmtDay(o.delivery_date)))),
    h("button", { type: "button", class: "btn btn-sm", onclick: () => {
      const s = seenReady(); ready.forEach(o => s.add(o.number));
      try { localStorage.setItem(LS_SEEN, JSON.stringify([...s])); } catch (e) {}
      box.animate?.([{ opacity: 1 }, { opacity: 0, transform: "translateY(-10px)" }], { duration: 250 }).finished.then(() => box.hidden = true);
      if (!box.animate) box.hidden = true;
    } }, "Gezien"));
  if (was) { box.style.animation = "none"; void box.offsetWidth; box.style.animation = ""; }
}
let lastStatus = {};
function renderMine() {
  renderReadyBanner();
  $("mine").replaceChildren(...mine.slice(0, 15).map(o => {
    const idx = STATUS_IDX[o.status];
    const changed = lastStatus[o.number] && lastStatus[o.number] !== o.status;
    return h("li", { style: changed ? "box-shadow:0 0 0 3px rgba(184,204,10,.6)" : null },
      h("div", { class: "row1" }, h("span", { class: "mono" }, o.number), pill(o.status)),
      h("span", null, linesText(o)),
      h("span", { class: "small" }, "Levering " + fmtDay(o.delivery_date)),
      h("div", { class: "track", "aria-hidden": "true" }, STATUSES.map((s, i) => h("i", { class: i <= idx ? "on" : "" }))));
  }));
  for (const o of mine) {
    if (lastStatus[o.number] && lastStatus[o.number] !== o.status) toast(`Bestelling ${o.number}: ${STATUS_LABEL[o.status].toLowerCase()}`);
    lastStatus[o.number] = o.status;
  }
  $("mine-empty").hidden = mine.length > 0;
}
function loadMine() {
  mine = DB.data.orders.filter(o => o.customer_id === profile.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50)
    .map(o => ({ ...o, status: normStatus(o.status) }));
  renderMine();
}

/* ---------- Opstarten ---------- */
function route() {
  if (recovering) { show("recover"); return; }
  profile = currentProfile();
  setupNav(profile);
  if (!profile) { show("auth"); authTab("login"); return; }
  if (!profile.approved && !profile.is_admin) { show("pending"); return; }

  products = DB.data.products.filter(p => p.active && p.units && p.units.length).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  fillProfileFields();
  if (!$("lines").children.length) { addLine(); }
  renderDays(); updateTotal();
  show("order");
  loadMine();
}

// Live: wijzigingen uit een ander tabblad (beheer, orderscherm) komen direct binnen.
DB.onChange(() => {
  const before = profile;
  const now = currentProfile();
  if (!now || !before || now.id !== before.id || (!before.approved && now.approved) || current === "pending") { route(); return; }
  profile = now;
  products = DB.data.products.filter(p => p.active && p.units && p.units.length).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  setupNav(profile);
  if (current === "order") loadMine();
});

$("o-date").min = isoDay(new Date());
if (new URLSearchParams(location.search).has("herstel")) recovering = true;
route();
