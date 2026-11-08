// Orderscherm voor een groot scherm: drie kolommen, ververst vanzelf.

let orders = [];
const COLUMNS = ["nieuw", "inbehandeling", "klaar"];
const NEXT = { nieuw: "inbehandeling", inbehandeling: "klaar", klaar: "geleverd" };
const NEXT_LABEL = { nieuw: "Start behandeling", inbehandeling: "Klaargemaakt", klaar: "Geleverd" };

function dayTag(o) {
  const today = isoDay(new Date()), tomorrow = isoDay(addDays(1));
  if (o.delivery_date < today) return h("span", { class: "pill", style: "background:var(--danger-soft);color:var(--danger)" }, "Te laat");
  if (o.delivery_date === today) return h("span", { class: "pill", style: "background:var(--yolk);color:#3d2a00" }, "Vandaag");
  if (o.delivery_date === tomorrow) return h("span", { class: "pill s-geleverd" }, "Morgen");
  return null;
}

function loadOrders() {
  orders = DB.data.orders.filter(o => COLUMNS.includes(o.status))
    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date) || a.created_at.localeCompare(b.created_at)).slice(0, 500);
  $("board-msg").textContent = "";
  flip($("board"), ".ticket", render);
}

function advance(o) {
  const real = DB.data.orders.find(x => x.id === o.id);
  if (!real) { $("board-msg").textContent = "Status wijzigen is niet gelukt."; return; }
  real.status = NEXT[o.status];
  DB.save();
  toast(`${o.number} · ${o.company}: ${STATUS_LABEL[real.status].toLowerCase()}`);
  setupNav(currentProfile());
  loadOrders();
}

const counters = {};
function render() {
  $("board-clock").textContent = new Date().toLocaleString("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  $("board").replaceChildren(...COLUMNS.map(st => {
    const list = orders.filter(o => o.status === st);
    const n = h("span", { class: "count", "data-v": counters[st] || 0 }, counters[st] || 0);
    counters[st] = list.length;
    setTimeout(() => countUp(n, list.length, 400));
    return h("section", { class: "col", "data-s": st },
      h("header", { class: "col-head" }, h("h2", null, STATUS_LABEL[st]), n),
      list.length ? list.map(o => h("article", { class: "ticket", "data-key": o.id },
        h("div", { class: "row1" }, h("span", { class: "co" }, o.company), dayTag(o)),
        h("div", { class: "small" }, "Levering ", fmtDay(o.delivery_date)),
        h("ul", null, (o.lines || []).map(l => h("li", null, h("b", null, l.qty), " ", String(l.unit).toLowerCase(), " ", String(l.product).toLowerCase()))),
        o.notes ? h("div", { class: "small", style: "background:var(--yolk-soft);padding:6px 8px;border-radius:8px;color:#6b4a00" }, o.notes) : null,
        st === "klaar" && wantsWhatsApp(o) && waNumber(o.phone)
          ? h("div", { class: "wa-row" }, h("a", { class: "btn btn-sm wa wa-hot", href: waLink(o.phone, readyText(o)), target: "_blank", rel: "noopener" }, "WhatsApp: klaar-melding"))
          : null,
        h("div", { class: "meta" }, h("span", { class: "mono" }, o.number),
          h("button", { type: "button", class: "btn btn-sm" + (st === "inbehandeling" ? " btn-primary" : ""), onclick: e => { e.currentTarget.disabled = true; advance(o); } }, NEXT_LABEL[st] + " →"))))
        : h("p", { class: "empty-col" }, st === "nieuw" ? "Geen nieuwe bestellingen" : "Leeg"));
  }));
}

// Volledig scherm verbergt ook kop- en voetbalk.
$("board-full").addEventListener("click", async () => {
  const on = !document.body.classList.contains("tv");
  document.body.classList.toggle("tv", on);
  $("board-full").textContent = on ? "Volledig scherm uit" : "Volledig scherm";
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {}
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) { document.body.classList.remove("tv"); $("board-full").textContent = "Volledig scherm"; }
});

(() => {
  const profile = requireAdmin($("gate"));
  if (!profile) return;
  $("gate").hidden = true;
  $("screen").hidden = false;
  loadOrders();
  DB.onChange(() => {
    const before = new Set(orders.map(o => o.id));
    setupNav(currentProfile());
    loadOrders();
    const fresh = orders.filter(o => !before.has(o.id) && o.status === "nieuw");
    if (fresh.length) toast(`Nieuwe bestelling van ${fresh[0].company}`);
  });
  // Klok en "vandaag"-labels elke minuut bijwerken.
  setInterval(() => { $("board-clock").textContent = new Date().toLocaleString("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); }, 30 * 1000);
  setInterval(loadOrders, 5 * 60 * 1000);
})();
