// Uitleg om het bestelportaal op het beginscherm te zetten. Openen via ?opslaan=1 of de link in de voettekst.
(() => {
  const el = id => document.getElementById(id);
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvent = null;

  function open() {
    el("install-ios").hidden = !isIOS;
    el("install-android").hidden = !isAndroid;
    el("install-desktop").hidden = isIOS || isAndroid;
    el("install-url").textContent = location.host + location.pathname.replace(/index\.html$/, "") + "?opslaan=1";
    el("main").hidden = false;
    el("install").hidden = false;
    el("install").scrollIntoView({ block: "start", behavior: "smooth" });
  }

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    installEvent = e;
    el("install-direct").hidden = false;
    el("install-android-steps").hidden = true;
  });
  window.addEventListener("appinstalled", () => { el("install").hidden = true; el("install-open").hidden = true; });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  document.addEventListener("DOMContentLoaded", () => {
    if (standalone) return;
    el("install-open").hidden = false;
    el("install-open").addEventListener("click", open);
    el("install-close").addEventListener("click", () => { el("install").hidden = true; if (!el("view-auth").hidden) el("main").hidden = true; });
    el("install-btn").addEventListener("click", async () => {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      el("install-direct").hidden = true;
      el("install-android-steps").hidden = false;
    });
    const url = new URL(location.href);
    if (url.searchParams.has("opslaan")) {
      url.searchParams.delete("opslaan");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      setTimeout(open, 50);
    }
  });
})();
