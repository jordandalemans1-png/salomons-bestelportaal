// Beheer: bestellingen, klanten goedkeuren, productlijst.

let orders = [], customers = [], productRows = [], filter = "alle", search = "", catalogDirty = false;
const PANES = ["bestellingen", "klanten", "producten"];

function setPane() {
  const pane = PANES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "bestellingen";
  for (const p of PANES) {
    const sec = $("p-" + p), on = p === pane;
    if (on && sec.hidden) { sec.hidden = false; sec.animate?.([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: REDUCED ? 0 : 380, easing: "cubic-bezier(.22,1,.36,1)" }); }
    sec.hidden = !on;
    $("st-" + p).setAttribute("aria-current", String(on));
  }
  moveBar();
}
function moveBar() {
  const a = document.querySelector('.subtabs a[aria-current="true"]'), bar = $("st-bar");
  if (!a) return;
  bar.style.left = a.offsetLeft + 8 + "px"; bar.style.width = a.offsetWidth - 16 + "px";
}
window.addEventListener("hashchange", setPane);
window.addEventListener("resize", moveBar);

/* ---------- Bestellingen ---------- */
function loadOrders() {
  orders = [...DB.data.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 1000)
    .map(o => ({ ...o, status: normStatus(o.status) }));
  renderOrders();
}

function visibleOrders() {
  return orders.filter(o =>
    (filter === "alle" || o.status === filter) &&
    (!search || [o.company, o.contact, o.number, o.email].some(x => (x || "").toLowerCase().includes(search))));
}

function setStatus(o, status) {
  if (o.status === status) return;
  $("orders-msg").textContent = "";
  const real = DB.data.orders.find(x => x.id === o.id);
  if (!real) { $("orders-msg").textContent = "Status wijzigen is niet gelukt. Probeer het opnieuw."; return; }
  real.status = status;
  DB.save();
  if (status === "klaar" && wantsWhatsApp(o) && waNumber(o.phone))
    $("orders-msg").textContent = `${o.company} wil een WhatsApp-bericht: klik bij de bestelling op "WhatsApp: klaar-melding".`;
  toast(`${o.number}: ${STATUS_LABEL[status].toLowerCase()}`);
  setupNav(currentProfile());
  loadOrders();
}

function deleteButton(o, card) {
  let timer = null;
  const btn = h("button", { type: "button", class: "link-btn", style: "color:var(--danger)" }, "Verwijderen");
  btn.addEventListener("click", () => {
    if (!btn.classList.contains("armed")) {
      btn.classList.add("armed"); btn.textContent = "Zeker weten? Klik nogmaals";
      btn.animate?.([{ transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 250 });
      timer = setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "Verwijderen"; }, 4000);
      return;
    }
    clearTimeout(timer);
    const done = () => {
      DB.data.orders = DB.data.orders.filter(x => x.id !== o.id);
      DB.save(); setupNav(currentProfile()); loadOrders(); toast(`Bestelling ${o.number} verwijderd`);
    };
    if (REDUCED || !card.animate) return done();
    card.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.94) translateY(10px)" }], { duration: 300, easing: "ease-in" }).finished.then(done);
  });
  return btn;
}

const countEls = {};
function renderOrders() {
  const n = k => orders.filter(o => o.status === k).length;
  const colors = { alle: "var(--navy)", nieuw: "var(--blue)", inbehandeling: "var(--yolk)", klaar: "var(--green)", geleverd: "var(--muted)" };
  const items = [["alle", "Alle bestellingen", orders.length], ...STATUSES.map(s => [s.key, s.label, n(s.key)])];
  if (!$("counts").children.length) {
    $("counts").replaceChildren(...items.map(([key, label]) => {
      const b = h("b", null, "0");
      countEls[key] = b;
      return h("button", { type: "button", class: "stat", style: `--c:${colors[key]};cursor:pointer;text-align:left;font:inherit`, "data-key": key, onclick: () => { filter = key; renderOrders(); } }, b, h("span", null, label));
    }));
  }
  for (const [key, , num] of items) {
    countUp(countEls[key], num);
    const btn = countEls[key].parentElement;
    btn.setAttribute("aria-pressed", String(filter === key));
    btn.style.outline = filter === key ? "2px solid var(--navy)" : "";
  }

  const list = visibleOrders();
  if (!list.length) {
    $("slips").replaceChildren(h("div", { class: "card small" }, orders.length
      ? "Geen bestellingen die passen bij dit filter."
      : "Nog geen bestellingen. Zodra een klant bestelt, verschijnt de bestelling hier."));
    return;
  }
  flip($("slips"), ".slip", () => $("slips").replaceChildren(...list.map((o, i) => {
    const idx = STATUS_IDX[o.status];
    const card = h("article", { class: "card slip", "data-key": o.id, style: `animation-delay:${Math.min(i, 10) * 40}ms` },
      h("div", { class: "slip-top" },
        h("div", null, h("strong", { style: "font-size:1.05rem" }, o.company), h("div", { class: "mono small" }, o.number)),
        pill(o.status)),
      h("dl", null,
        h("dt", null, "Levering"), h("dd", null, h("b", null, fmtDay(o.delivery_date))),
        h("dt", null, "Besteld"), h("dd", null, fmtStamp(o.created_at)),
        h("dt", null, "Contact"), h("dd", null, o.contact, o.phone ? " · " + o.phone : ""),
        h("dt", null, "E-mail"), h("dd", null, o.email),
        h("dt", null, "Melding"), h("dd", null, NOTIFY_LABEL[o.notify] || "E-mail"),
        o.address ? [h("dt", null, "Afleveradres"), h("dd", null, h("b", null, o.address))] : null),
      h("ul", null, (o.lines || []).map(l => h("li", null, h("b", null, l.qty), " × ", l.unit, " ", l.product))),
      o.notes ? h("div", { class: "small", style: "background:var(--yolk-soft);padding:8px 10px;border-radius:8px;color:#6b4a00" }, o.notes) : null,
      h("div", { class: "steps", role: "group", "aria-label": "Status" },
        STATUSES.map((s, i) => h("button", { type: "button", class: i === idx ? "on" : i < idx ? "done" : "", "aria-pressed": String(o.status === s.key), onclick: () => setStatus(o, s.key) }, s.label))),
      whatsappButtons(o));
    card.append(h("div", null, deleteButton(o, card)));
    return card;
  })));
}

$("search").addEventListener("input", e => { search = e.target.value.trim().toLowerCase(); renderOrders(); });

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
$("export-btn").addEventListener("click", () => {
  const list = visibleOrders();
  if (!list.length) { $("orders-msg").textContent = "Er zijn geen bestellingen om te exporteren."; return; }
  const rows = [["Bestelnummer", "Besteld op", "Bedrijf", "Contactpersoon", "E-mail", "Telefoon", "Afleveradres", "Leverdatum", "Product", "Verpakking", "Aantal", "Opmerkingen", "Status"]];
  for (const o of list) for (const l of o.lines || [])
    rows.push([o.number, fmtStamp(o.created_at), o.company, o.contact, o.email, o.phone, o.address, o.delivery_date, l.product, l.unit, l.qty, o.notes, STATUS_LABEL[o.status]]);
  // Puntkomma en BOM zodat Nederlandse Excel het direct goed opent.
  const csv = "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = h("a", { href: url, download: `bestellingen-${isoDay(new Date())}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${list.length} bestellingen geëxporteerd`);
});

/* ---------- Klanten ---------- */
function loadCustomers() {
  customers = [...DB.data.profiles].sort((a, b) => b.created_at.localeCompare(a.created_at));
  renderCustomers();
}
function setApproved(c, approved) {
  const real = DB.data.profiles.find(p => p.id === c.id);
  if (!real) { $("cust-msg").textContent = "Opslaan is niet gelukt."; return; }
  real.approved = approved;
  DB.save();
  toast(approved ? `${c.company} kan nu bestellen` : `${c.company} is geblokkeerd`);
  loadCustomers();
}
function renderCustomers() {
  const pending = customers.filter(c => !c.approved && !c.is_admin);
  $("pending-badge").textContent = pending.length; $("pending-badge").hidden = !pending.length;
  const sorted = [...pending, ...customers.filter(c => c.approved || c.is_admin)];
  if (!sorted.length) {
    $("customers").replaceChildren(h("tr", null, h("td", { colspan: "5", class: "small" }, "Nog geen klanten aangemeld.")));
    return;
  }
  $("customers").replaceChildren(...sorted.map((c, i) => h("tr", { style: `animation-delay:${i * 40}ms` },
    h("td", null, h("strong", null, c.company || "(geen naam)")),
    h("td", null, c.contact, h("br"), h("span", { class: "small" }, c.email, c.phone ? " · " + c.phone : "")),
    h("td", { class: "small" }, fmtStamp(c.created_at)),
    h("td", null, c.is_admin ? h("span", { class: "pill s-inbehandeling" }, "Beheerder")
      : c.approved ? h("span", { class: "pill s-klaar" }, "Goedgekeurd")
      : h("span", { class: "pill s-nieuw" }, "Wacht op goedkeuring")),
    h("td", null, c.is_admin ? null : c.approved
      ? h("button", { type: "button", class: "btn btn-sm", onclick: () => setApproved(c, false) }, "Blokkeren")
      : h("button", { type: "button", class: "btn btn-sm btn-primary", onclick: () => setApproved(c, true) }, "Goedkeuren")))));
}

/* ---------- Producten ---------- */
let catSeq = 0;
function catRow(p = { name: "", units: [], active: true }) {
  const n = ++catSeq;
  const row = h("div", { class: "cat-row" },
    h("input", { id: "c-n-" + n, class: "name", value: p.name, "aria-label": "Productnaam", placeholder: "Productnaam" }),
    h("input", { id: "c-u-" + n, class: "units", value: (p.units || []).join(", "), "aria-label": "Verpakkingen", placeholder: "Bijv. Trays, Dozen, Pallets" }),
    h("label", { class: "switch", title: "Zichtbaar voor klanten" }, h("input", { id: "c-a-" + n, type: "checkbox", checked: p.active !== false, "aria-label": "Zichtbaar" }), h("span")),
    h("button", { type: "button", class: "icon-btn remove", "aria-label": "Product verwijderen", title: "Product verwijderen", onclick: () => {
      row.classList.add("line", "out"); catalogDirty = true; setTimeout(() => row.remove(), REDUCED ? 0 : 280);
    } }, "×"));
  row.dataset.id = p.id || "";
  row.addEventListener("input", () => { catalogDirty = true; $("cat-msg").textContent = ""; });
  return row;
}
function loadProducts() {
  productRows = [...DB.data.products].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  catalogDirty = false;
  $("cat-rows").replaceChildren(...productRows.map(catRow));
}
$("cat-add").addEventListener("click", () => { const r = catRow(); $("cat-rows").append(r); catalogDirty = true; r.querySelector("input").focus(); });
$("cat-save").addEventListener("click", () => {
  const msg = $("cat-msg");
  const rows = [...$("cat-rows").children].filter(r => !r.classList.contains("out")).map((r, i) => ({
    id: r.dataset.id ? Number(r.dataset.id) : null,
    name: r.querySelector(".name").value.trim(),
    units: r.querySelector(".units").value.split(",").map(s => s.trim()).filter(Boolean),
    active: r.querySelector("input[type=checkbox]").checked,
    sort: (i + 1) * 10,
  })).filter(p => p.id || p.name || p.units.length);
  if (!rows.length) { msg.textContent = "Voeg minstens één product toe."; return; }
  if (rows.some(p => !p.name)) { msg.textContent = "Elk product heeft een naam nodig."; return; }
  if (rows.some(p => !p.units.length)) { msg.textContent = "Geef elk product minstens één verpakking."; return; }
  if (new Set(rows.map(p => p.name.toLowerCase())).size < rows.length) { msg.textContent = "Twee producten hebben dezelfde naam."; return; }
  let next = Math.max(0, ...DB.data.products.map(p => p.id)) + 1;
  DB.data.products = rows.map(p => ({ ...p, id: p.id || next++ }));
  DB.save();
  loadProducts();
  msg.textContent = "Opgeslagen. Klanten zien de nieuwe lijst direct.";
  toast("Productlijst opgeslagen");
});
window.addEventListener("beforeunload", e => { if (catalogDirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- Opstarten ---------- */
(() => {
  const profile = requireAdmin($("gate"));
  if (!profile) return;
  $("gate").hidden = true;
  $("admin").hidden = false;
  setPane();
  loadOrders(); loadCustomers(); loadProducts();
  requestAnimationFrame(moveBar);
  document.fonts?.ready.then(moveBar);
  DB.onChange(() => {
    const before = new Set(orders.map(o => o.id)), beforeC = new Set(customers.map(c => c.id));
    setupNav(currentProfile());
    loadOrders(); loadCustomers();
    const fresh = orders.find(o => !before.has(o.id));
    if (fresh) toast(`Nieuwe bestelling van ${fresh.company}`);
    const newC = customers.find(c => !beforeC.has(c.id));
    if (newC) toast(`${newC.company} vraagt een account aan`);
    if (!catalogDirty) loadProducts();
  });
})();
