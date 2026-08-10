import { SettingsSchema, getAllDefaults } from "../modules/settings/SettingsSchema.js";
import { FeatureDocs } from "../modules/docs/FeatureDocs.js";
import { LuaApiDocs, LuaExampleScript } from "../modules/docs/LuaDocs.js";
import { LuaExamples } from "../modules/docs/LuaExamples.js";
import { helpFor } from "../modules/docs/SettingsHelp.js";
import { listBooks, putBook, deleteBook, setBookStage, getBook, bufferToBase64, base64ToBuffer } from "../modules/books/BookStore.js";
import { socketCatalog, parseSocketList, stringifySocketList, SOCKET_BASES, SOCKET_DOCS, socketUrl } from "../modules/engine/SocketCatalog.js";
import { HUD_THEMES, resolveTheme } from "../modules/ui/HUD.js";
import { Humanizer, SkillPresets } from "../modules/engine/Humanizer.js";
import { BlockEditor } from "../modules/lua/BlockEditor.js";
import { compileWorkspace, emptyWorkspace } from "../modules/lua/BlockCompiler.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const HUM_PRESET_KEYS = {
  "hum.blunderChance": "blunderChance",
  "hum.rank2Chance": "rank2Chance",
  "hum.rank3Chance": "rank3Chance",
  "hum.meanMs": "meanMs",
  "hum.stdMs": "stdMs",
};

const store = {
  async getAll() {
    const sync = await new Promise((res) => chrome.storage.sync.get(null, res));
    return { ...getAllDefaults(), ...sync };
  },
  async set(key, value) {
    await new Promise((res) => chrome.storage.sync.set({ [key]: value }, res));
  },
  async setMany(obj) {
    await new Promise((res) => chrome.storage.sync.set(obj, res));
  },
  async reset() {
    await new Promise((res) => chrome.storage.sync.clear(res));
  },
};

const ENGINEWS = "http://127.0.0.1:8000";
const DISCORD_URL = "https://discord.gg/bettermint";

let engineWsToken = "";

function readEngineWsToken(url) {
  try {
    return url ? new URL(String(url).replace(/^ws/, "http")).searchParams.get("token") || "" : "";
  } catch {
    return "";
  }
}

function wsFetch(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (engineWsToken) headers["x-bm-token"] = engineWsToken;
  return fetch(ENGINEWS + path, { ...init, headers });
}

const SITE_LABELS = {
  chesscom: "Chess.com",
  lichess: "Lichess",
  worldchess: "World Chess",
  both: "Chess.com or Lichess",
};

const SITE_REQUIRES = {
  both: ["chesscom", "lichess"],
};

function siteOf(item) {
  if (item.site) return item.site;
  const k = item.key || "";
  if (/\.chesscom\.|chesscom\./.test(k)) return "chesscom";
  if (/\.lichess\.|lichess\./.test(k)) return "lichess";
  if (/\.worldchess\./.test(k)) return "worldchess";
  return null;
}

const NAV = [
  { section: "Overview" },
  { id: "dashboard", label: "Dashboard", ico: "◉", desc: "Everything at a glance" },
  { section: "Configure" },
  { id: "settings", label: "Settings", ico: "⚙", desc: "Every parameter" },
  { id: "engines", label: "Engines", ico: "⚡", desc: "Multi-engine control" },
  { id: "sockets", label: "Sockets", ico: "◎", desc: "Remote engine links" },
  { section: "Library" },
  { id: "books", label: "Books & TB", ico: "▤", desc: "Opening books & tablebases" },
  { id: "lua", label: "Lua Scripting", ico: "⌘", desc: "Scripts & block builder" },
  { section: "Help" },
  { id: "docs", label: "Docs", ico: "?", desc: "Guides & reference" },
];

function toast(text, err = false) {
  let wrap = $(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = text;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

class OptionsApp {
  constructor() {
    this.page = "dashboard";
    this.settingsTab = "engine";
    this.luaTab = "scripts";
    this.settings = {};
    this.presentSites = [];
    this.scripts = [];
    this.activeScript = null;
    this.editor = null;
    this._binders = [];
  }

  async init() {
    this.settings = await store.getAll();
    this.presentSites = await this._loadPresentSites();
    this.scripts = await this._loadScripts();
    this._applyTheme();
    this._buildShell();
    this._buildTooltip();
    this._buildSearch();
    this.navigate(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", () => this.navigate(location.hash.slice(1) || "dashboard"));
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        this._openSearch();
      }
      if (e.key === "Escape") this._closeSearch();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [key, change] of Object.entries(changes)) {
        this.settings[key] = change.newValue;
      }
      const themeTouched = Object.keys(changes).some(
        (k) => k === "ui.theme" || k === "ui.glass" || k === "ui.accentGlow" || k.startsWith("ui.custom."),
      );
      if (themeTouched) this._applyTheme();
      for (const b of this._binders) {
        if (b.key in changes) {
          try { b.apply(this.settings[b.key]); } catch {}
        }
      }
    });
  }

  async _loadPresentSites() {
    try {
      const res = await chrome.runtime.sendMessage({ a: "site.list", p: {} });
      return Array.isArray(res?.sites) ? res.sites : [];
    } catch {
      return [];
    }
  }

  siteAvailable(site) {
    if (!site) return true;
    const needed = SITE_REQUIRES[site] || [site];
    return needed.some((s) => this.presentSites.includes(s));
  }

  _applyTheme() {

    const t = resolveTheme({ get: (k) => this.settings[k] });
    const r = document.documentElement.style;
    r.setProperty("--primary", t.accent2);
    r.setProperty("--primary-dark", t.surface3);
    r.setProperty("--primary-light", t.accent);
    r.setProperty("--bg", t.surface);
    r.setProperty("--bg-light", t.surface2);
    r.setProperty("--bg-card", t.surface2);
    r.setProperty("--bg-deep", t.deep);
    r.setProperty("--text", t.text);
    r.setProperty("--text-muted", t.dim);
    r.setProperty("--border", t.line);
    r.setProperty("--chip", t.chip);
    r.setProperty("--success", t.success);
    r.setProperty("--warning", t.warning);
    r.setProperty("--danger", t.danger);
    r.setProperty("--info", t.info);
    document.body.classList.toggle("no-glow", !this.settings["ui.accentGlow"]);
  }

  _buildShell() {
    document.body.innerHTML = "";
    const title = document.createElement("div");
    title.className = "title-screen";
    title.innerHTML = `<img src="../img/logo-128.png" alt=""><div class="tt">BetterMint</div><div class="ts">Chess Suite v2.0</div>`;
    document.body.appendChild(title);

    const app = document.createElement("div");
    app.className = "app-container";
    app.innerHTML = `
      <header class="app-header">
        <img src="../img/logo-48.png" alt="">
        <h1>BetterMint</h1>
        <div class="search-shortcut" id="search-shortcut"><span>Search</span><kbd>Ctrl</kbd><kbd>F</kbd></div>
        <button class="discord-btn" id="discord-btn" title="Join the BetterMint Discord">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.6 12.6 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127a12.3 12.3 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418Z"/></svg>
          <span>Discord</span>
        </button>
      </header>
      <div class="settings-container">
        <div class="settings-tabs"></div>
        <div class="settings-content" id="main"></div>
      </div>
      <footer class="app-footer">
        <span class="version">v${chrome.runtime.getManifest().version} · undetectable by design</span>
        <div class="btn-group">
          <button class="btn secondary sm" id="foot-export">Export</button>
          <button class="btn secondary sm" id="foot-import">Import</button>
          <button class="btn danger sm" id="foot-reset">Reset all</button>
        </div>
      </footer>`;
    document.body.appendChild(app);

    const tabs = $(".settings-tabs", app);
    let navIdx = 0;
    for (const n of NAV) {
      if (n.section) {
        const h = document.createElement("div");
        h.className = "tab-section";
        h.textContent = n.section;
        tabs.appendChild(h);
        continue;
      }
      const btn = document.createElement("button");
      btn.className = "tab-btn" + (this.page === n.id ? " active" : "");
      btn.dataset.page = n.id;
      btn.style.animationDelay = `${navIdx++ * 28}ms`;
      btn.innerHTML = `<span class="ico">${n.ico}</span><span class="tab-text"><span class="tab-label">${n.label}</span><span class="tab-desc">${n.desc || ""}</span></span>`;
      btn.onclick = () => (location.hash = n.id);
      tabs.appendChild(btn);
    }

    $("#search-shortcut").onclick = () => this._openSearch();
    $("#discord-btn").onclick = () => window.open(DISCORD_URL, "_blank", "noopener");
    $("#foot-reset").onclick = async () => {
      if (!confirm("Reset ALL settings to defaults?")) return;
      await store.reset();
      this.settings = await store.getAll();
      toast("Settings reset");
      this.navigate(this.page);
    };
    $("#foot-export").onclick = async () => {
      const syncAll = await new Promise((res) => chrome.storage.sync.get(null, res));
      const localAll = await new Promise((res) => chrome.storage.local.get(["luaScripts", "uciOptions"], res));
      const luaScripts = localAll.luaScripts || [];
      const uciOptions = localAll.uciOptions || {};
      const books = [];
      try {
        for (const meta of await listBooks()) {
          const full = await getBook(meta.name);
          if (full?.buffer) books.push({ name: full.name, stage: full.stage || "opening", base64: bufferToBase64(full.buffer) });
        }
      } catch {}
      const exportData = {
        _meta: {
          app: "BetterMint",
          version: 3,
          exportedAt: new Date().toISOString(),
          description: "Full config export — settings (incl. custom colors), Lua scripts, UCI options and opening books",
        },
        settings: { ...getAllDefaults(), ...syncAll },
        luaScripts,
        uciOptions,
        books,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bettermint-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(`Config exported (settings + ${luaScripts.length} scripts + ${books.length} books)`);
    };
    $("#foot-import").onclick = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".json";
      inp.onchange = async () => {
        try {
          const raw = JSON.parse(await inp.files[0].text());
          const settingsObj = raw.settings || raw;
          for (const [k, v] of Object.entries(settingsObj)) {
            if (k === "_meta") continue;
            await store.set(k, v);
          }
          if (Array.isArray(raw.luaScripts)) {
            await new Promise((res) => chrome.storage.local.set({ luaScripts: raw.luaScripts }, res));
            this.scripts = raw.luaScripts;
          }
          if (raw.uciOptions && typeof raw.uciOptions === "object") {
            await new Promise((res) => chrome.storage.local.set({ uciOptions: raw.uciOptions }, res));
          }
          if (Array.isArray(raw.books)) {
            for (const b of raw.books) {
              if (b?.name && b?.base64) {
                try { await putBook(b.name, base64ToBuffer(b.base64), b.stage || "opening"); } catch {}
              }
            }
          }
          this.settings = await store.getAll();
          toast("Config imported");
          this.navigate(this.page);
        } catch { toast("Invalid file", true); }
      };
      inp.click();
    };
  }

  _buildTooltip() {
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.id = "tip";
    document.body.appendChild(tip);
    this._tip = tip;

    let hideTimer = null;
    const hide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => tip.classList.remove("on"), 80);
    };

    document.addEventListener("mouseover", (e) => {
      const host = e.target.closest?.("[data-tip]");
      if (!host) return;
      clearTimeout(hideTimer);
      const title = host.dataset.tipTitle || "";
      const body = host.dataset.tip || "";
      const meta = host.dataset.tipMeta || "";
      tip.innerHTML = "";
      if (title) {
        const h = document.createElement("div");
        h.className = "tip-h";
        h.textContent = title;
        tip.appendChild(h);
      }
      const b = document.createElement("div");
      b.className = "tip-b";
      b.textContent = body;
      tip.appendChild(b);
      if (meta) {
        const m = document.createElement("div");
        m.className = "tip-m";
        m.textContent = meta;
        tip.appendChild(m);
      }
      tip.classList.add("on");
      this._placeTip(host);
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest?.("[data-tip]")) hide();
    });
    window.addEventListener("scroll", () => tip.classList.remove("on"), true);
  }

  _placeTip(host) {
    const tip = this._tip;
    if (!tip) return;
    const r = host.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const pad = 12;
    let left = r.left;
    let top = r.bottom + 8;
    if (left + t.width > window.innerWidth - pad) left = window.innerWidth - t.width - pad;
    if (left < pad) left = pad;
    if (top + t.height > window.innerHeight - pad) top = r.top - t.height - 8;
    if (top < pad) top = pad;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  _attachTip(el, item) {
    const text = helpFor(item);
    if (!text) return el;
    el.dataset.tip = text;
    el.dataset.tipTitle = item.label || item.key;
    const bits = [item.key];
    if (item.def !== undefined) bits.push(`default: ${item.def === "" ? "(empty)" : item.def}`);
    if (item.min !== undefined && item.max !== undefined) bits.push(`range: ${item.min} to ${item.max}`);
    el.dataset.tipMeta = bits.join("  \u00b7  ");
    return el;
  }

  _buildSearch() {
    const overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.id = "search-overlay";
    overlay.innerHTML = `
      <div class="search-container">
        <input type="text" class="search-bar" placeholder="Search settings, docs, scripts…" id="settings-search">
        <div class="search-results" id="search-results"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) this._closeSearch(); });
    $("#settings-search").addEventListener("input", (e) => this._renderSearchResults(e.target.value));
  }

  _openSearch() {
    const overlay = $("#search-overlay");
    overlay.classList.add("active");
    const input = $("#settings-search");
    input.value = "";
    this._renderSearchResults("");
    setTimeout(() => input.focus(), 50);
  }

  _closeSearch() {
    $("#search-overlay")?.classList.remove("active");
  }

  _renderSearchResults(q) {
    const results = $("#search-results");
    q = q.trim().toLowerCase();
    const hits = [];
    for (const cat of SettingsSchema) {
      for (const item of cat.items) {
        if (!q || item.label.toLowerCase().includes(q) || item.key.toLowerCase().includes(q) || (item.desc || "").toLowerCase().includes(q)) {
          hits.push({ type: "setting", label: item.label, category: cat.label, action: () => { this.settingsTab = cat.category; location.hash = "settings"; } });
        }
      }
    }
    for (const d of FeatureDocs) {
      if (q && (d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q))) {
        hits.push({ type: "doc", label: d.title, category: "Documentation", action: () => { location.hash = "docs"; } });
      }
    }
    for (const s of this.scripts) {
      if (q && s.name.toLowerCase().includes(q)) {
        hits.push({ type: "script", label: s.name, category: "Lua Script", action: () => { this.activeScript = s.id; this.luaTab = "scripts"; location.hash = "lua"; } });
      }
    }
    results.innerHTML = "";
    for (const h of hits.slice(0, 24)) {
      const el = document.createElement("div");
      el.className = "search-result";
      el.innerHTML = `<div class="search-result-label">${this._esc(h.label)}</div><div class="search-result-category">${this._esc(h.category)} · ${h.type}</div>`;
      el.onclick = () => { this._closeSearch(); h.action(); };
      results.appendChild(el);
    }
    if (!hits.length) results.innerHTML = `<div class="empty">No matches</div>`;
  }

  async navigate(page) {
    this.page = page;
    $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    const main = $("#main");
    main.innerHTML = "";
    main.scrollTop = 0;
    this._binders = [];
    this.settings = await store.getAll();
    engineWsToken = readEngineWsToken(this.settings["engine.wsUrl"]);
    switch (page) {
      case "dashboard": return this._pageDashboard(main);
      case "settings": return this._pageSettings(main);
      case "engines": return this._pageEngines(main);
      case "sockets": return this._pageSockets(main);
      case "books": return this._pageBooks(main);
      case "lua": return this._pageLua(main);
      case "docs": return this._pageDocs(main);
    }
  }

  async _pageDashboard(main) {
    main.innerHTML = `<div class="page-title">Dashboard</div><div class="page-sub">Everything at a glance</div>`;
    const wsOk = await wsFetch("/api/health").then((r) => r.ok).catch(() => false);
    let engines = [];
    if (wsOk) engines = await wsFetch("/api/engines").then((r) => r.json()).then((d) => d.engines || []).catch(() => []);
    const books = await listBooks();

    const grid = document.createElement("div");
    grid.className = "stat-grid";
    grid.innerHTML = `
      <div class="stat ${wsOk ? "green" : "red"}"><div class="v">${wsOk ? "ONLINE" : "OFFLINE"}</div><div class="k">EngineWS server</div></div>
      <div class="stat blue"><div class="v">${engines.length}</div><div class="k">Remote engines</div></div>
      <div class="stat amber"><div class="v">${books.length}</div><div class="k">Books loaded</div></div>
      <div class="stat purple"><div class="v">${this.scripts.filter((s) => s.enabled).length}</div><div class="k">Active scripts</div></div>`;
    main.appendChild(grid);

    const quick = document.createElement("div");
    quick.className = "section";
    quick.innerHTML = `<div class="section-title">◈ Quick Toggles</div>`;
    for (const [key, label] of [["auto.enabled", "Auto Move"], ["handbrain.enabled", "Hand & Brain"], ["queue.enabled", "Auto Queue"], ["ui.hud", "In-game HUD"], ["ov.externalEnabled", "Stream-Proof Overlay"], ["ex.tts", "Text-to-speech moves"]]) {
      quick.appendChild(this._boolRow({ key, label }));
    }
    main.appendChild(quick);

    const setup = document.createElement("div");
    setup.className = "section";
    setup.innerHTML = `<div class="section-title">◈ Setup</div>
      <div style="color:var(--text-muted);font-size:12.5px;line-height:2">
      1. Run <span class="mono">EngineWS/run.bat</span> for desktop engines & disk-based books (optional — the built-in engine works standalone).<br>
      2. Open <span class="mono">http://127.0.0.1:8000</span> to download engines with one click.<br>
      3. Upload polyglot books in the Books tab, assign each to a game stage.<br>
      4. Play anywhere — the detector finds the board automatically.</div>`;
    main.appendChild(setup);
  }

  _pageSettings(main) {
    main.innerHTML = `<div class="page-title">Settings</div><div class="page-sub">Every parameter is customizable — nothing is hardcoded</div>`;
    const tabs = document.createElement("div");
    tabs.className = "subtabs";
    for (const cat of SettingsSchema) {
      const t = document.createElement("button");
      t.className = "subtab" + (this.settingsTab === cat.category ? " active" : "");
      t.textContent = cat.label;
      t.onclick = () => { this.settingsTab = cat.category; this._pageSettings(main); };
      tabs.appendChild(t);
    }
    main.appendChild(tabs);

    const cat = SettingsSchema.find((c) => c.category === this.settingsTab);
    const groups = new Map();
    const hiddenSites = new Set();
    for (const item of cat.items) {
      if (item.hidden) continue;
      const site = siteOf(item);
      if (!this.siteAvailable(site)) {
        hiddenSites.add(site);
        continue;
      }
      const g = item.group || null;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(item);
    }
    for (const [groupName, items] of groups) {
      const section = document.createElement("div");
      section.className = "section";
      section.innerHTML = `<div class="section-title">◈ ${groupName ? groupName[0].toUpperCase() + groupName.slice(1) : cat.label}</div>`;
      for (const item of items) section.appendChild(this._settingRow(item));

      if (groupName === "mistakes") section.appendChild(this._mistakeSummary());
      main.appendChild(section);
    }
    if (hiddenSites.size) {
      const note = document.createElement("div");
      note.className = "site-note";
      const names = [...hiddenSites].map((s) => SITE_LABELS[s] || s).join(", ");
      note.innerHTML = `Options for <b>${this._esc(names)}</b> are hidden because no matching tab is open. Open that site and reload this page to configure them.`;
      main.appendChild(note);
    }
    if (!groups.size && hiddenSites.size) {
      main.querySelector(".site-note")?.classList.add("solo");
    }
  }

  _mistakeSummary() {
    const wrap = document.createElement("div");
    wrap.className = "dist";
    const render = () => {
      const hum = new Humanizer();
      hum.enabled = true;
      hum.blunderChance = Number(this.settings["hum.blunderChance"]) || 0;
      hum.rank2Chance = Number(this.settings["hum.rank2Chance"]) || 0;
      hum.rank3Chance = Number(this.settings["hum.rank3Chance"]) || 0;
      hum.rankDecay = Number(this.settings["hum.rankDecay"]) || 0;
      const multipv = Math.max(1, Number(this.settings["engine.multipv"]) || 1);
      const requested = Number(this.settings["auto.rankPoolSize"]) || 0;
      const pool = Math.max(1, Math.min(requested || multipv, multipv));
      const d = hum.distribution(pool);
      const pct = (n) => `${(n * 100).toFixed(1)}%`;
      const ordinal = (n) => ["", "Best", "2nd", "3rd"][n] || `${n}th`;

      const parts = [
        { label: "Best move", value: d.best, cls: "good", keep: true },
        ...d.ranks.map((v, i) => ({ label: ordinal(i + 2), value: v, cls: "" })),
        { label: "Blunder", value: d.blunder, cls: "bad" },
      ].filter((p) => p.keep || p.value > 0.0005);
      wrap.innerHTML = `
        <div class="dist-head">Resulting move distribution
          <span class="dist-note">pool of ${pool} line${pool === 1 ? "" : "s"}${requested ? "" : " (from MultiPV)"}</span>
        </div>
        <div class="dist-bar">${parts.map((p) => `<span class="seg ${p.cls}" style="flex:${Math.max(p.value, 0.001)}" title="${this._esc(p.label)} ${pct(p.value)}"></span>`).join("")}</div>
        <div class="dist-keys">${parts.map((p) => `<span class="dist-key ${p.cls}"><i></i>${this._esc(p.label)} <b>${pct(p.value)}</b></span>`).join("")}</div>`;
      if (d.best < 0.005) {
        wrap.innerHTML += `<div class="dist-warn">Your chances add up to everything that is available, so the best move is almost never played. Lower the sliders above if you want it back.</div>`;
      } else if (pool === 1) {
        wrap.innerHTML += `<div class="dist-warn">MultiPV is 1, so there is only one line to choose from and the best move always gets played. Raise MultiPV in Engine settings to let the mistakes happen.</div>`;
      }
    };
    render();
    for (const key of ["hum.blunderChance", "hum.rank2Chance", "hum.rank3Chance", "hum.rankDecay", "engine.multipv", "auto.rankPoolSize"]) {
      this._binders.push({ key, apply: render });
    }
    return wrap;
  }

  _settingRow(item) {
    let row;
    if (item.type === "range" || item.type === "int" || item.type === "float") {
      row = this._sliderRow(item);
    } else if (item.type === "bool") row = this._boolRow(item);
    else if (item.type === "select") row = this._selectRow(item);
    else if (item.type === "color") row = this._colorRow(item);
    else row = this._textRow(item);

    const labelEl = row.querySelector(".set-label") || row.querySelector(".l")?.parentElement;
    if (labelEl && helpFor(item)) {
      this._attachTip(labelEl, item);
      labelEl.classList.add("has-tip");
      const q = document.createElement("span");
      q.className = "tip-mark";
      q.textContent = "?";
      (row.querySelector(".l") || labelEl).appendChild(q);
    }
    return row;
  }

  _boolRow(item) {
    const row = document.createElement("div");
    row.className = "set-row";
    const isWarn = /WARNING/i.test(item.desc || "");
    row.innerHTML = `<div class="set-label"><div class="l">${item.label}</div>${item.desc ? `<div class="d${isWarn ? " warn" : ""}">${item.desc}</div>` : ""}</div>`;
    const ctrl = document.createElement("div");
    ctrl.className = "set-ctrl";
    const label = document.createElement("label");
    label.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!this.settings[item.key];
    const slider = document.createElement("span");
    slider.className = "switch-slider";
    input.onchange = async () => {
      this.settings[item.key] = input.checked;
      await store.set(item.key, input.checked);
      toast(`${item.label} ${input.checked ? "enabled" : "disabled"}`);
    };
    this._binders.push({ key: item.key, apply: (v) => { input.checked = !!v; } });
    label.append(input, slider);
    ctrl.appendChild(label);
    row.appendChild(ctrl);
    return row;
  }

  _sliderRow(item) {
    const wrap = document.createElement("div");
    wrap.className = "set-row slider-row";
    const min = item.min ?? 0;
    const max = item.max ?? 100;
    const step = item.step ?? 1;
    const fmt = (v) => item.float ? Number(v).toFixed(2) : String(v);
    const isWarn = /WARNING/i.test(item.desc || "");

    const block = document.createElement("div");
    block.className = "slider-block";
    block.innerHTML = `
      <div class="slider-head">
        <div><span class="l">${item.label}</span>${item.desc ? `<div class="d${isWarn ? " warn" : ""}">${item.desc}</div>` : ""}</div>
        <span class="value-display">
          <button class="value-btn minus">−</button>
          <span class="value">${fmt(this.settings[item.key])}</span>
          <button class="value-btn plus">+</button>
        </span>
      </div>
      <div class="slider-wrapper">
        <div class="slider-progress"></div>
        <input type="range" class="slider" min="${min}" max="${max}" step="${step}" value="${this.settings[item.key]}">
      </div>`;
    const range = $("input", block);
    const progress = $(".slider-progress", block);
    const valueEl = $(".value", block);

    const sync = () => {
      const v = parseFloat(range.value);
      const pct = ((v - min) / (max - min)) * 100;
      progress.style.width = pct + "%";
      valueEl.textContent = fmt(v);
    };
    const commit = async () => {
      const v = item.float ? parseFloat(range.value) : parseInt(range.value, 10);
      this.settings[item.key] = v;
      await store.set(item.key, v);
      await this._maybeBreakPreset(item.key);
    };
    range.addEventListener("input", sync);
    range.addEventListener("change", commit);
    this._binders.push({
      key: item.key,
      apply: (v) => {
        if (document.activeElement === range || v == null) return;
        range.value = v;
        sync();
      },
    });
    $(".minus", block).onclick = async () => {
      range.value = Math.max(min, parseFloat(range.value) - step);
      sync();
      await commit();
    };
    $(".plus", block).onclick = async () => {
      range.value = Math.min(max, parseFloat(range.value) + step);
      sync();
      await commit();
    };
    wrap.appendChild(block);
    requestAnimationFrame(sync);
    return wrap;
  }

  _selectRow(item) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `<div class="set-label"><div class="l">${item.label}</div>${item.desc ? `<div class="d">${item.desc}</div>` : ""}</div>`;
    const ctrl = document.createElement("div");
    ctrl.className = "set-ctrl";
    const sel = document.createElement("select");
    for (const o of item.options || []) {
      const opt = document.createElement("option");
      opt.value = o.v;
      opt.textContent = o.l;
      sel.appendChild(opt);
    }
    sel.value = this.settings[item.key];
    sel.onchange = async () => {
      this.settings[item.key] = sel.value;
      await store.set(item.key, sel.value);
      if (item.key === "hum.preset") await this._applyPresetToSliders(sel.value);
    };
    this._binders.push({
      key: item.key,
      apply: (v) => { if (document.activeElement !== sel && v != null) sel.value = v; },
    });
    ctrl.appendChild(sel);
    row.appendChild(ctrl);
    return row;
  }

  async _applyPresetToSliders(name) {
    const preset = SkillPresets[name];
    if (!preset) return;
    const write = {};
    for (const [key, prop] of Object.entries(HUM_PRESET_KEYS)) {
      write[key] = preset[prop];
      this.settings[key] = preset[prop];
    }
    await store.setMany(write);
    toast(`${name[0].toUpperCase() + name.slice(1)} preset applied to sliders`);
  }

  async _maybeBreakPreset(changedKey) {
    if (!HUM_PRESET_KEYS[changedKey]) return;
    const preset = SkillPresets[this.settings["hum.preset"]];
    if (!preset) return;
    const matches = Object.entries(HUM_PRESET_KEYS).every(
      ([key, prop]) => Number(this.settings[key]) === Number(preset[prop]),
    );
    if (matches) return;
    this.settings["hum.preset"] = "custom";
    await store.set("hum.preset", "custom");
    toast("Preset switched to Custom");
  }

  _colorRow(item) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `<div class="set-label"><div class="l">${item.label}</div>${item.desc ? `<div class="d">${item.desc}</div>` : ""}</div>`;
    const ctrl = document.createElement("div");
    ctrl.className = "set-ctrl";
    const c = document.createElement("input");
    c.type = "color";
    c.value = this.settings[item.key];
    c.onchange = async () => {
      this.settings[item.key] = c.value;
      await store.set(item.key, c.value);
    };
    this._binders.push({
      key: item.key,
      apply: (v) => { if (document.activeElement !== c && v) c.value = v; },
    });
    ctrl.appendChild(c);
    row.appendChild(ctrl);
    return row;
  }

  _textRow(item) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `<div class="set-label"><div class="l">${item.label}</div>${item.desc ? `<div class="d">${item.desc}</div>` : ""}</div>`;
    const ctrl = document.createElement("div");
    ctrl.className = "set-ctrl";
    const txt = document.createElement("input");
    txt.className = "txt";
    txt.value = this.settings[item.key] ?? "";
    txt.onchange = async () => {
      this.settings[item.key] = txt.value;
      await store.set(item.key, txt.value);
    };
    this._binders.push({
      key: item.key,
      apply: (v) => { if (document.activeElement !== txt) txt.value = v ?? ""; },
    });
    ctrl.appendChild(txt);
    row.appendChild(ctrl);
    return row;
  }

  async _pageEngines(main) {
    main.innerHTML = `<div class="page-title">Engines</div><div class="page-sub">Multi-engine control — priority order decides who gives the #1, #2, #3 moves</div>`;
    const wsOk = await wsFetch("/api/health").then((r) => r.ok).catch(() => false);

    const status = document.createElement("div");
    status.className = "stat-grid";
    status.innerHTML = `
      <div class="stat ${wsOk ? "green" : "red"}"><div class="v">${wsOk ? "ONLINE" : "OFFLINE"}</div><div class="k">EngineWS</div></div>
      <div class="stat purple"><div class="v">Stockfish 18</div><div class="k">Built-in WASM</div></div>`;
    main.appendChild(status);

    if (!wsOk) {
      const c = document.createElement("div");
      c.className = "section";
      c.innerHTML = `<div class="section-title">◈ EngineWS offline</div><div style="color:var(--text-muted);font-size:12.5px;line-height:1.8">Start <span class="mono">EngineWS/run.bat</span> to unlock real engines, disk-based opening books, Syzygy tablebases and one-click engine downloads.<br><br>The built-in Stockfish 18 WASM engine keeps working regardless.</div>`;
      main.appendChild(c);
      await this._renderUciPanels(main);
      return;
    }

    const { engines = [] } = await wsFetch("/api/engines").then((r) => r.json()).catch(() => ({}));
    const card = document.createElement("div");
    card.className = "section";
    card.innerHTML = `<div class="section-title">◈ Remote Engines <span class="tag">PRIORITY ORDER</span></div>`;
    if (!engines.length) card.innerHTML += `<div class="empty">No engines configured. Download one below or in the EngineWS dashboard.</div>`;
    engines.forEach((e, i) => {
      const item = document.createElement("div");
      item.className = "eng-item";
      item.innerHTML = `
        <span class="badge p">P${e.priority}</span>
        <div class="nm">${e.name}<small>${e.path}</small></div>
        <span class="badge ${e.alive ? "g" : "r"}">${e.alive ? "alive" : "dead"}</span>
        ${e.busy ? '<span class="badge b">thinking</span>' : ""}
        <button class="btn secondary sm" data-a="up" ${i === 0 ? "disabled" : ""}>▲</button>
        <button class="btn secondary sm" data-a="down" ${i === engines.length - 1 ? "disabled" : ""}>▼</button>`;
      item.querySelector("[data-a=up]").onclick = async () => {
        const order = engines.map((x) => x.name);
        [order[i], order[i - 1]] = [order[i - 1], order[i]];
        await this._wsSetPriority(order);
        this._pageEngines(main);
      };
      item.querySelector("[data-a=down]").onclick = async () => {
        const order = engines.map((x) => x.name);
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
        await this._wsSetPriority(order);
        this._pageEngines(main);
      };
      card.appendChild(item);
    });
    main.appendChild(card);

    const dl = document.createElement("div");
    dl.className = "section";
    dl.innerHTML = `<div class="section-title">◈ Download Engines <span class="tag">LATEST RELEASES</span></div>`;
    const { engines: downloadable = [] } = await wsFetch("/api/downloadable").then((r) => r.json()).catch(() => ({}));
    for (const d of downloadable) {
      const item = document.createElement("div");
      item.className = "eng-item";
      item.innerHTML = `<div class="nm">${d.choices[0]}<small>${d.repo}</small></div>`;
      const btn = document.createElement("button");
      btn.className = "btn sm";
      btn.textContent = "Download";
      btn.onclick = async () => {
        btn.textContent = "…";
        btn.disabled = true;
        const res = await wsFetch("/api/download/" + d.key, { method: "POST" }).then((r) => r.json()).catch(() => null);
        toast(res?.ok ? `Installed ${res.display}` : "Download failed", !res?.ok);
        this._pageEngines(main);
      };
      item.appendChild(btn);
      dl.appendChild(item);
    }
    main.appendChild(dl);

    const link = document.createElement("button");
    link.className = "btn info";
    link.textContent = "Open EngineWS dashboard";
    link.onclick = () => window.open(ENGINEWS, "_blank");
    main.appendChild(link);

    await this._renderUciPanels(main);
  }

  async _renderUciPanels(main) {
    const stored = await new Promise((res) => chrome.storage.local.get("uciOptions", (o) => res(o?.uciOptions || {})));
    const names = Object.keys(stored);
    const card = document.createElement("div");
    card.className = "section";
    card.innerHTML = `<div class="section-title">◈ Per-Engine UCI Options <span class="tag">DISCOVERED</span></div>`;
    if (!names.length) {
      card.innerHTML += `<div class="empty">Play one position with an engine connected — its full option list is captured automatically and appears here.</div>`;
      main.appendChild(card);
      return;
    }
    for (const engine of names) {
      const entry = stored[engine];
      const det = document.createElement("details");
      det.className = "uci-engine";
      det.innerHTML = `<summary><b>${this._esc(engine)}</b><span class="uci-count">${entry.options.length} options</span><small>${this._esc(entry.uciName || "")}</small></summary>`;
      const body = document.createElement("div");
      body.className = "uci-body";
      for (const opt of entry.options) {
        body.appendChild(this._uciRow(engine, opt));
      }
      const clear = document.createElement("button");
      clear.className = "btn danger sm";
      clear.textContent = "Reset this engine's overrides";
      clear.onclick = async () => {
        const prefix = `engineOpt::${engine}::`;
        const keys = Object.keys(this.settings).filter((k) => k.startsWith(prefix));
        await new Promise((res) => chrome.storage.sync.remove(keys, res));
        this.settings = await store.getAll();
        toast("Overrides cleared for " + engine);
        this.navigate("engines");
      };
      const forget = document.createElement("button");
      forget.className = "btn secondary sm";
      forget.textContent = "Forget engine";
      forget.title = "Remove this engine's captured option list (it reappears next time the engine connects)";
      forget.onclick = async () => {
        delete stored[engine];
        await new Promise((res) => chrome.storage.local.set({ uciOptions: stored }, res));
        toast("Forgot " + engine);
        this.navigate("engines");
      };
      body.append(clear, forget);
      det.appendChild(body);
      card.appendChild(det);
    }
    main.appendChild(card);
  }

  _uciRow(engine, opt) {
    const key = `engineOpt::${engine}::${opt.name}`;
    const row = document.createElement("div");
    row.className = "set-row";
    const meta = [opt.type, opt.min != null ? `min ${opt.min}` : "", opt.max != null ? `max ${opt.max}` : "", opt.def !== undefined ? `default ${opt.def}` : ""].filter(Boolean).join(" · ");
    row.innerHTML = `<div class="set-label"><div class="l">${this._esc(opt.name)}</div><div class="d">${this._esc(meta)}</div></div>`;
    const ctrl = document.createElement("div");
    ctrl.className = "set-ctrl";
    const current = this.settings[key];

    const save = async (value) => {
      this.settings[key] = value;
      await store.set(key, value);
      toast(`${opt.name} = ${value}`);
    };

    if (opt.type === "check") {
      const label = document.createElement("label");
      label.className = "switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = current != null ? current === true || current === "true" : opt.def === true;
      const slider = document.createElement("span");
      slider.className = "switch-slider";
      input.onchange = () => save(input.checked);
      label.append(input, slider);
      ctrl.appendChild(label);
    } else if (opt.type === "spin") {
      const input = document.createElement("input");
      input.type = "number";
      input.className = "text-input sm";
      if (opt.min != null) input.min = opt.min;
      if (opt.max != null) input.max = opt.max;
      input.value = current ?? opt.def ?? 0;
      input.onchange = () => save(Number(input.value));
      ctrl.appendChild(input);
    } else if (opt.type === "combo") {
      const sel = document.createElement("select");
      sel.className = "select-input";
      for (const v of opt.vars || []) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
      }
      sel.value = current ?? opt.def ?? "";
      sel.onchange = () => save(sel.value);
      ctrl.appendChild(sel);
    } else if (opt.type === "button") {
      const note = document.createElement("span");
      note.style.cssText = "color:var(--text-muted);font-size:11px";
      note.textContent = "action only";
      ctrl.appendChild(note);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "text-input";
      input.value = current ?? opt.def ?? "";
      input.onchange = () => save(input.value);
      ctrl.appendChild(input);
    }
    row.appendChild(ctrl);
    return row;
  }

  _socketList() {
    return parseSocketList(this.settings["ws.socketsJson"]);
  }

  async _saveSocketList(list) {
    const json = stringifySocketList(list);
    this.settings["ws.socketsJson"] = json;
    await store.set("ws.socketsJson", json);
  }

  _socketBase() {
    const mode = this.settings["ws.socketBase"];
    if (mode === "custom") {
      return String(this.settings["ws.socketBaseCustom"] || "").replace(/\/+$/, "") || SOCKET_BASES.public;
    }
    return SOCKET_BASES[mode] || SOCKET_BASES.public;
  }

  async _pageSockets(main) {
    main.innerHTML = `<div class="page-title">Socket Engines</div><div class="page-sub">Raw UCI over WebSocket — every Stockfish version, human-like Maia, Rodent personalities and Patricia, with no local CPU cost</div>`;

    const cfg = document.createElement("div");
    cfg.className = "section";
    cfg.innerHTML = `<div class="section-title">◈ Connection</div>`;
    for (const key of ["ws.socketsEnabled", "ws.socketBase", "ws.socketBaseCustom"]) {
      const item = SettingsSchema.flatMap((c) => c.items).find((i) => i.key === key);
      if (item) cfg.appendChild(this._settingRow(item));
    }
    const baseInfo = document.createElement("div");
    baseInfo.style.cssText = "color:var(--text-muted);font-size:12px;margin-top:8px";
    baseInfo.innerHTML = `Resolved base: <span class="mono">${this._esc(this._socketBase())}</span>`;
    cfg.appendChild(baseInfo);
    main.appendChild(cfg);

    const active = this._socketList();
    const activeCard = document.createElement("div");
    activeCard.className = "section";
    activeCard.innerHTML = `<div class="section-title">◈ Active Socket Engines <span class="tag">${active.length}</span></div>`;
    if (!active.length) {
      activeCard.innerHTML += `<div class="empty">None yet — add one from the catalog below.</div>`;
    }
    active.forEach((e, i) => {
      const row = document.createElement("div");
      row.className = "eng-item";
      row.innerHTML = `
        <span class="badge p">P${e.priority}</span>
        <div class="nm">${this._esc(e.label)}<small>${this._esc(e.url || socketUrl(this._socketBase(), e.id))}${e.depth ? ` · depth ≤ ${e.depth}` : ""}</small></div>
        <span class="badge ${e.enabled ? "g" : "r"}">${e.enabled ? "on" : "off"}</span>`;
      const toggle = document.createElement("button");
      toggle.className = "btn secondary sm";
      toggle.textContent = e.enabled ? "Disable" : "Enable";
      toggle.onclick = async () => {
        active[i].enabled = !active[i].enabled;
        await this._saveSocketList(active);
        this._pageSockets(main);
      };
      const up = document.createElement("button");
      up.className = "btn secondary sm";
      up.textContent = "▲";
      up.disabled = i === 0;
      up.onclick = async () => {
        [active[i].priority, active[i - 1].priority] = [active[i - 1].priority, active[i].priority];
        active.sort((a, b) => a.priority - b.priority);
        await this._saveSocketList(active);
        this._pageSockets(main);
      };
      const del = document.createElement("button");
      del.className = "btn danger sm";
      del.textContent = "Remove";
      del.onclick = async () => {
        active.splice(i, 1);
        await this._saveSocketList(active);
        toast("Removed " + e.label);
        this._pageSockets(main);
      };
      row.append(toggle, up, del);
      activeCard.appendChild(row);
    });
    main.appendChild(activeCard);

    for (const group of socketCatalog()) {
      const card = document.createElement("div");
      card.className = "section";
      card.innerHTML = `<div class="section-title">◈ ${this._esc(group.label)}</div>
        <div style="color:var(--text-muted);font-size:12.5px;line-height:1.7;margin-bottom:10px">${this._esc(group.desc)}</div>`;
      const grid = document.createElement("div");
      grid.className = "socket-grid";
      for (const entry of group.entries) {
        const chip = document.createElement("button");
        const added = active.some((a) => a.id === entry.id);
        chip.className = "socket-chip" + (added ? " added" : "");
        chip.innerHTML = `<span class="sc-name">${this._esc(entry.label)}</span><span class="sc-desc">${this._esc(entry.desc)}</span>`;
        chip.title = socketUrl(this._socketBase(), entry.id);
        chip.onclick = async () => {
          const list = this._socketList();
          if (list.some((a) => a.id === entry.id)) {
            toast("Already added");
            return;
          }
          list.push({
            id: entry.id,
            label: entry.label,
            priority: list.length + 2,
            enabled: true,
            depth: entry.maxDepth ?? entry.recommendedDepth ?? null,
            url: null,
          });
          await this._saveSocketList(list);
          toast("Added " + entry.label);
          this._pageSockets(main);
        };
        grid.appendChild(chip);
      }
      card.appendChild(grid);
      main.appendChild(card);
    }

    const host = document.createElement("div");
    host.className = "section";
    host.innerHTML = `<div class="section-title">◈ Self-hosting</div>
      <div style="color:var(--text-muted);font-size:12.5px;line-height:1.9">
      The public host is convenient but shared. To run your own:<br>
      1. Clone <span class="mono">${this._esc(SOCKET_DOCS)}</span><br>
      2. <span class="mono">docker compose up -d</span> (or <span class="mono">python server.py</span>)<br>
      3. Set <b>Socket host</b> above to <b>Self-hosted</b> (<span class="mono">${this._esc(SOCKET_BASES.local)}</span>) or Custom.<br><br>
      Each engine is reachable at <span class="mono">&lt;base&gt;/&lt;engine-id&gt;</span> and speaks plain UCI: send <span class="mono">uci</span>, <span class="mono">position fen …</span>, <span class="mono">go depth N</span>.</div>`;
    const open = document.createElement("button");
    open.className = "btn info";
    open.textContent = "Open self-hosting repo";
    open.onclick = () => window.open(SOCKET_DOCS, "_blank");
    host.appendChild(open);
    main.appendChild(host);
  }

  async _wsSetPriority(order) {
    try {
      const ws = new WebSocket("ws://127.0.0.1:8000/ws");
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "set_priority", order }));
        setTimeout(() => ws.close(), 300);
      };
    } catch {}
  }

  async _pageBooks(main) {
    main.innerHTML = `<div class="page-title">Books & Tablebases</div><div class="page-sub">Stage-aware: opening books fire in the opening, tablebases in the endgame</div>`;

    const card = document.createElement("div");
    card.className = "section";
    card.innerHTML = `<div class="section-title">◈ Local Books <span class="tag">POLYGLOT .BIN — LOADS INSTANTLY</span></div>`;
    const books = await listBooks();
    if (!books.length) card.innerHTML += `<div class="empty">No books yet. Upload a polyglot .bin below. Larger books can also be served from disk by EngineWS.</div>`;
    for (const b of books) {
      const item = document.createElement("div");
      item.className = "book-item";
      const stageSel = document.createElement("select");
      for (const s of ["opening", "middlegame", "endgame", "any"]) {
        const o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        stageSel.appendChild(o);
      }
      stageSel.value = b.stage;
      stageSel.onchange = async () => {
        await setBookStage(b.name, stageSel.value);
        toast(`${b.name} → ${stageSel.value}`);
      };
      const del = document.createElement("button");
      del.className = "btn danger sm";
      del.textContent = "✕";
      del.onclick = async () => {
        await deleteBook(b.name);
        toast("Book removed");
        this._pageBooks(main);
      };
      item.innerHTML = `<div class="nm">${b.name}<small>${(b.size / 1024 / 1024).toFixed(2)} MB</small></div>`;
      item.append(stageSel, del);
      card.appendChild(item);
    }

    const upload = document.createElement("button");
    upload.className = "btn";
    upload.textContent = "+ Upload polyglot book (.bin)";
    upload.style.cursor = "pointer";

    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".bin,application/octet-stream";
    inp.multiple = true;
    inp.style.display = "none";
    upload.addEventListener("click", (e) => { e.preventDefault(); inp.click(); });

    inp.addEventListener("change", async () => {
      const files = [...(inp.files || [])];
      inp.value = "";
      if (!files.length) return;

      let ok = 0;
      const failed = [];
      for (const f of files) {
        try {
          const buf = await f.arrayBuffer();

          if (!buf.byteLength || buf.byteLength % 16 !== 0) {
            failed.push(`${f.name}: not a polyglot .bin (${buf.byteLength} bytes)`);
            continue;
          }
          await putBook(f.name.replace(/\.bin$/i, ""), buf, "opening");
          ok++;
        } catch (err) {
          failed.push(`${f.name}: ${err?.message || err}`);
        }
      }

      if (ok) toast(`${ok} book${ok === 1 ? "" : "s"} added`);
      for (const msg of failed.slice(0, 3)) toast(msg, true);
      if (ok) this._pageBooks(main);
    });

    const dropZone = document.createElement("div");
    dropZone.className = "section";
    dropZone.style.cssText = "border:2px dashed var(--border,#3a3a4a);border-radius:10px;padding:18px;text-align:center;color:var(--text-muted);font-size:12.5px;cursor:pointer;transition:all .2s; margin-top:8px";
    dropZone.textContent = "Drag & drop .bin files here, or click to browse";
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--accent,#4ade80)"; dropZone.style.background = "rgba(74,222,128,0.05)"; });
    dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "var(--border,#3a3a4a)"; dropZone.style.background = ""; });
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--border,#3a3a4a)";
      dropZone.style.background = "";
      const files = [...e.dataTransfer.files].filter(f => /\.bin$/i.test(f.name) || f.type === "application/octet-stream");
      if (!files.length) { toast("No .bin files found", true); return; }
      let ok = 0; const failed = [];
      for (const f of files) {
        try {
          const buf = await f.arrayBuffer();
          if (!buf.byteLength || buf.byteLength % 16 !== 0) { failed.push(`${f.name}: not a polyglot .bin`); continue; }
          await putBook(f.name.replace(/\.bin$/i, ""), buf, "opening");
          ok++;
        } catch (err) { failed.push(`${f.name}: ${err?.message || err}`); }
      }
      if (ok) toast(`${ok} book${ok === 1 ? "" : "s"} added`);
      for (const msg of failed.slice(0, 3)) toast(msg, true);
      if (ok) this._pageBooks(main);
    });
    dropZone.addEventListener("click", () => inp.click());
    card.appendChild(upload);
    card.appendChild(dropZone);
    main.appendChild(card);

    const remote = document.createElement("div");
    remote.className = "section";
    remote.innerHTML = `<div class="section-title">◈ EngineWS Books & Tablebases <span class="tag">POLYGLOT · SYZYGY · GAVIOTA</span></div>
      <div style="color:var(--text-muted);font-size:12.5px;line-height:1.8">
      Polyglot books and Syzygy/Gaviota tablebase files are loaded by EngineWS from disk.<br>
      Add them in <span class="mono">EngineWS/config.json</span> or the dashboard — they activate automatically during games.<br>
      ChessBase CTG books cannot be read directly; convert one to polyglot <span class="mono">.bin</span> first.<br>
      The built-in online 7-piece tablebase fallback works with no setup at all.</div>`;
    main.appendChild(remote);
  }

  async _loadScripts() {
    return (await new Promise((res) => chrome.storage.local.get("luaScripts", (r) => res(r.luaScripts)))) || [];
  }

  async _saveScript(s) {
    const idx = this.scripts.findIndex((x) => x.id === s.id);
    if (idx >= 0) this.scripts[idx] = s;
    else this.scripts.push(s);
    await new Promise((res) => chrome.storage.local.set({ luaScripts: this.scripts }, res));
  }

  async _pageLua(main) {
    main.innerHTML = `<div class="page-title">Lua Scripting</div><div class="page-sub">Full Lua 5.3 runtime — build your own features</div>`;
    const tabs = document.createElement("div");
    tabs.className = "subtabs";
    for (const [id, label] of [["scripts", "Scripts"], ["blocks", "Blocks"], ["examples", "Examples"], ["apidocs", "API Docs"]]) {
      const t = document.createElement("button");
      t.className = "subtab" + (this.luaTab === id ? " active" : "");
      t.textContent = label;
      t.onclick = () => { this.luaTab = id; this._pageLua(main); };
      tabs.appendChild(t);
    }
    main.appendChild(tabs);

    if (this.luaTab === "apidocs") return this._luaApiDocs(main);
    if (this.luaTab === "examples") return this._luaExamples(main);
    if (this.luaTab === "blocks") return this._pageBlocks(main);
    return this._luaScripts(main);
  }

  _pageBlocks(main) {
    const blocksScripts = this.scripts.filter((s) => s.kind === "blocks");
    let s = blocksScripts.find((x) => x.id === this.activeBlockScript) || blocksScripts[0];

    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:9px;margin-bottom:12px;align-items:center;flex-wrap:wrap";

    const picker = document.createElement("select");
    picker.className = "txt";
    picker.style.maxWidth = "200px";
    for (const bs of blocksScripts) {
      const o = document.createElement("option");
      o.value = bs.id;
      o.textContent = bs.name;
      picker.appendChild(o);
    }
    if (s) picker.value = s.id;
    picker.onchange = () => { this.activeBlockScript = picker.value; this._pageBlocks(main); };

    const newBtn = document.createElement("button");
    newBtn.className = "btn sm";
    newBtn.textContent = "+ New blocks script";
    newBtn.onclick = async () => {
      const name = prompt("Script name:", "my-blocks");
      if (!name) return;
      const ns = { id: "lua-" + Date.now().toString(36), name, kind: "blocks", blocks: emptyWorkspace(), code: "", enabled: false, createdAt: Date.now(), updatedAt: Date.now() };
      await this._saveScript(ns);
      this.activeBlockScript = ns.id;
      this._pageBlocks(main);
    };
    bar.append(picker, newBtn);

    if (s) {
      this.activeBlockScript = s.id;
      const nameInput = document.createElement("input");
      nameInput.className = "txt";
      nameInput.value = s.name;
      nameInput.style.maxWidth = "160px";
      nameInput.onchange = async () => { s.name = nameInput.value; await this._saveScript(s); };
      const runBtn = document.createElement("button");
      runBtn.className = "btn sm " + (s.enabled ? "danger" : "success");
      runBtn.textContent = s.enabled ? "Disable" : "Enable";
      runBtn.onclick = async () => {
        s.enabled = !s.enabled;
        await this._saveScript(s);
        toast(s.enabled ? "Script will run on chess pages" : "Script disabled");
        this._pageBlocks(main);
      };
      const delBtn = document.createElement("button");
      delBtn.className = "btn sm danger";
      delBtn.textContent = "Delete";
      delBtn.onclick = async () => {
        if (!confirm("Delete " + s.name + "?")) return;
        this.scripts = this.scripts.filter((x) => x.id !== s.id);
        await new Promise((res) => chrome.storage.local.set({ luaScripts: this.scripts }, res));
        this.activeBlockScript = this.scripts.find((x) => x.kind === "blocks")?.id || null;
        this._pageBlocks(main);
      };
      bar.append(nameInput, runBtn, delBtn);
    }
    main.appendChild(bar);

    const editorHost = document.createElement("div");
    main.appendChild(editorHost);

    if (!s) {
      editorHost.innerHTML = `<div class="empty" style="padding:40px;text-align:center;color:var(--text-muted)">Create a blocks script to get started — no code needed, just snap blocks together.</div>`;
      return;
    }

    this._blockEditor?.destroy?.();
    let saveTimer = null;
    const editor = new BlockEditor(editorHost, {
      workspace: s.blocks && s.blocks.blocks ? s.blocks : emptyWorkspace(),
      onChange: (ws) => {
        const code = compileWorkspace(ws);
        editor.setCode(code);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
          s.blocks = ws;
          s.code = code;
          s.updatedAt = Date.now();
          await this._saveScript(s);
        }, 500);
      },
    });
    this._blockEditor = editor;
    editor.mount();
    editor.setCode(compileWorkspace(editor.ws));
  }

  _luaExamples(main) {
    const intro = document.createElement("div");
    intro.className = "section";
    intro.innerHTML = `<div class="section-title">◈ Example Scripts</div>
      <div style="color:var(--text-muted);font-size:12.5px;line-height:1.75">Working, commented scripts that teach the API. Install one, then open it in the Scripts tab and edit it — they are ordinary scripts once installed.</div>`;
    main.appendChild(intro);

    const hidden = new Set();
    for (const ex of LuaExamples) {
      if (!this.siteAvailable(ex.site)) {
        hidden.add(ex.site);
        continue;
      }
      const card = document.createElement("div");
      card.className = "section example-card";
      const badge = ex.site
        ? `<span class="tag site">${this._esc(SITE_LABELS[ex.site] || ex.site)} only</span>`
        : `<span class="tag">any site</span>`;
      card.innerHTML = `<div class="section-title">${this._esc(ex.name)} ${badge}</div>
        <div style="color:var(--text-muted);font-size:12.5px;line-height:1.7;margin-bottom:10px">${this._esc(ex.blurb)}</div>`;

      const pre = document.createElement("pre");
      pre.className = "example-code";
      pre.textContent = ex.code;
      card.appendChild(pre);

      const row = document.createElement("div");
      row.className = "btn-group";
      const install = document.createElement("button");
      install.className = "btn sm";
      install.textContent = "Install script";
      install.onclick = async () => {
        const s = {
          id: "lua-" + Date.now().toString(36),
          name: ex.name.replace(/^\d+\.\s*/, ""),
          code: ex.code,
          enabled: false,
          site: ex.site || null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await this._saveScript(s);
        this.activeScript = s.id;
        this.luaTab = "scripts";
        toast(`Installed “${s.name}”`);
        this._pageLua(main);
      };
      const copy = document.createElement("button");
      copy.className = "btn secondary sm";
      copy.textContent = "Copy";
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(ex.code);
          toast("Copied to clipboard");
        } catch { toast("Copy failed", true); }
      };
      row.append(install, copy);
      card.appendChild(row);
      main.appendChild(card);
    }

    if (hidden.size) {
      const note = document.createElement("div");
      note.className = "site-note";
      const names = [...hidden].map((s) => SITE_LABELS[s] || s).join(", ");
      note.innerHTML = `Examples for <b>${this._esc(names)}</b> are hidden because no matching tab is open. Open that site and reload this page to see them.`;
      main.appendChild(note);
    }
  }

  async _luaScripts(main) {
    const layout = document.createElement("div");
    layout.className = "lua-layout";

    const left = document.createElement("div");
    const newBtn = document.createElement("button");
    newBtn.className = "btn";
    newBtn.textContent = "+ New script";
    newBtn.style.marginBottom = "12px";
    newBtn.onclick = async () => {
      const name = prompt("Script name:", "my-script");
      if (!name) return;
      const s = { id: "lua-" + Date.now().toString(36), name, code: LuaExampleScript, enabled: false, createdAt: Date.now(), updatedAt: Date.now() };
      await this._saveScript(s);
      this.activeScript = s.id;
      this._pageLua(main);
    };
    left.appendChild(newBtn);

    const list = document.createElement("div");
    list.className = "script-list";
    for (const s of this.scripts) {
      const item = document.createElement("div");
      item.className = "script-item" + (this.activeScript === s.id ? " active" : "");
      const badge = s.kind === "blocks" ? `<span class="tag" style="margin-left:6px;font-size:9px">🧩</span>` : "";
      item.innerHTML = `<span class="dot${s.enabled ? " run" : ""}"></span><span class="nm">${this._esc(s.name)}</span>${badge}`;
      item.onclick = () => { this.activeScript = s.id; this._pageLua(main); };
      list.appendChild(item);
    }
    if (!this.scripts.length) list.innerHTML = `<div class="empty">No scripts yet</div>`;
    left.appendChild(list);
    layout.appendChild(left);

    const right = document.createElement("div");
    const s = this.scripts.find((x) => x.id === this.activeScript) || this.scripts[0];
    if (!s) {
      right.innerHTML = `<div class="empty">Create a script to get started</div>`;
    } else {
      this.activeScript = s.id;
      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;gap:9px;margin-bottom:12px;align-items:center";
      const nameInput = document.createElement("input");
      nameInput.className = "txt";
      nameInput.value = s.name;
      nameInput.style.minWidth = "140px";
      nameInput.onchange = async () => { s.name = nameInput.value; await this._saveScript(s); };
      const runBtn = document.createElement("button");
      runBtn.className = "btn sm " + (s.enabled ? "danger" : "success");
      runBtn.textContent = s.enabled ? "Disable" : "Enable";
      runBtn.onclick = async () => {
        s.enabled = !s.enabled;
        await this._saveScript(s);
        toast(s.enabled ? "Script will run on chess pages" : "Script disabled");
        this._pageLua(main);
      };
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn sm";
      saveBtn.textContent = "Save";
      saveBtn.onclick = async () => {
        s.code = this.editor.value;
        s.updatedAt = Date.now();
        await this._saveScript(s);
        toast("Saved");
      };
      const delBtn = document.createElement("button");
      delBtn.className = "btn sm danger";
      delBtn.textContent = "Delete";
      delBtn.onclick = async () => {
        if (!confirm("Delete " + s.name + "?")) return;
        this.scripts = this.scripts.filter((x) => x.id !== s.id);
        await new Promise((res) => chrome.storage.local.set({ luaScripts: this.scripts }, res));
        this.activeScript = this.scripts[0]?.id || null;
        this._pageLua(main);
      };
      bar.append(nameInput, runBtn, saveBtn, delBtn);
      right.appendChild(bar);

      if (s.kind === "blocks") {
        saveBtn.style.display = "none";
        const note = document.createElement("div");
        note.className = "section";
        note.innerHTML = `<div class="section-title">🧩 Blocks script</div>
          <div style="color:var(--text-muted);font-size:12.5px;line-height:1.7">This script is built with the visual blocks editor. The generated Lua below is read-only — editing it here would be overwritten the next time the blocks are saved.</div>`;
        const row = document.createElement("div");
        row.className = "btn-group";
        row.style.marginTop = "10px";
        const openBtn = document.createElement("button");
        openBtn.className = "btn sm";
        openBtn.textContent = "Open in Blocks editor";
        openBtn.onclick = () => {
          this.activeBlockScript = s.id;
          this.luaTab = "blocks";
          this._pageLua(main);
        };
        const convertBtn = document.createElement("button");
        convertBtn.className = "btn secondary sm";
        convertBtn.textContent = "Convert to code";
        convertBtn.onclick = async () => {
          if (!confirm("Convert to a plain Lua script? The blocks layout is kept in case you convert back by hand, but future edits happen in code.")) return;
          s.kind = "code";
          await this._saveScript(s);
          this._pageLua(main);
        };
        row.append(openBtn, convertBtn);
        note.appendChild(row);
        right.appendChild(note);
        const pre = document.createElement("pre");
        pre.className = "example-code";
        pre.style.marginTop = "10px";
        pre.textContent = s.code || "-- (no blocks yet)";
        right.appendChild(pre);
      } else {
        right.appendChild(this._buildEditor(s.code));
        const hint = document.createElement("div");
        hint.style.cssText = "color:var(--text-muted);font-size:11.5px;margin-top:9px";
        hint.textContent = "Ctrl+S saves. Enabled scripts auto-run on every chess page.";
        right.appendChild(hint);
      }
    }
    layout.appendChild(right);
    main.appendChild(layout);
  }

  _buildEditor(code) {
    const wrap = document.createElement("div");
    wrap.className = "editor-wrap";
    const inner = document.createElement("div");
    inner.className = "editor-inner";
    const gutter = document.createElement("div");
    gutter.className = "gutter";
    const area = document.createElement("div");
    area.className = "code-area";
    const hl = document.createElement("div");
    hl.className = "code-hl";
    const ta = document.createElement("textarea");
    ta.className = "code-in";
    ta.spellcheck = false;
    ta.value = code;
    this.editor = ta;

    const render = () => {
      hl.innerHTML = this._highlightLua(ta.value) + "\n";
      const lines = ta.value.split("\n").length;
      gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
    };
    ta.addEventListener("input", render);
    ta.addEventListener("scroll", () => {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
      gutter.scrollTop = ta.scrollTop;
    });
    ta.addEventListener("keydown", async (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = ta.selectionStart;
        ta.value = ta.value.slice(0, start) + "  " + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = start + 2;
        render();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const s = this.scripts.find((x) => x.id === this.activeScript);
        if (s) {
          s.code = ta.value;
          await this._saveScript(s);
          toast("Saved");
        }
      }
    });
    area.append(hl, ta);
    inner.append(gutter, area);
    wrap.appendChild(inner);
    requestAnimationFrame(render);
    return wrap;
  }

  _highlightLua(src) {
    const KEYWORDS = new Set("local function end if then else elseif for while do repeat until return break in and or not nil true false goto".split(" "));
    const APIS = new Set(["bm", "settings", "game", "engine", "book", "board", "ui", "site", "events", "storage", "http", "panel"]);
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let out = "";
    let i = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (src.startsWith("--[[", i)) {
        const end = src.indexOf("]]", i + 4);
        const j = end < 0 ? n : end + 2;
        out += `<span class="tok-cmt">${esc(src.slice(i, j))}</span>`;
        i = j;
      } else if (src.startsWith("--", i)) {
        const end = src.indexOf("\n", i);
        const j = end < 0 ? n : end;
        out += `<span class="tok-cmt">${esc(src.slice(i, j))}</span>`;
        i = j;
      } else if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < n && src[j] !== ch) { if (src[j] === "\\") j++; j++; }
        j = Math.min(j + 1, n);
        out += `<span class="tok-str">${esc(src.slice(i, j))}</span>`;
        i = j;
      } else if (/[0-9]/.test(ch)) {
        let j = i;
        while (j < n && /[0-9a-fA-FxX._]/.test(src[j])) j++;
        out += `<span class="tok-num">${esc(src.slice(i, j))}</span>`;
        i = j;
      } else if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        const word = src.slice(i, j);
        if (KEYWORDS.has(word)) out += `<span class="tok-kw">${word}</span>`;
        else if (APIS.has(word)) out += `<span class="tok-api">${word}</span>`;
        else if (src[j] === "(" || (src[j] === ":" && /[A-Za-z_]/.test(src[j + 1] || ""))) out += `<span class="tok-fn">${word}</span>`;
        else if (word === "self" || word === "_G") out += `<span class="tok-glob">${word}</span>`;
        else out += esc(word);
        i = j;
      } else if (/[+\-*/%^#=~<>():{}[\].,&|;]/.test(ch)) {
        out += `<span class="tok-op">${esc(ch)}</span>`;
        i++;
      } else {
        out += esc(ch);
        i++;
      }
    }
    return out;
  }

  _luaApiDocs(main) {
    const intro = document.createElement("div");
    intro.className = "section";
    intro.innerHTML = `<div class="section-title">◈ Lua 5.3 API Reference</div><div style="color:var(--text-muted);font-size:12.5px">Every script gets these globals injected. Scripts run in isolated states with full access to the live game, engines, books, board drawing, custom UI, and the site itself.</div>`;
    main.appendChild(intro);
    for (const g of LuaApiDocs) {
      const group = document.createElement("div");
      group.className = "api-group";
      const head = document.createElement("div");
      head.className = "api-ghead";
      head.innerHTML = `<span class="fn-name">${g.group}</span><span style="color:var(--text-muted);font-size:11px">${g.desc}</span><span class="chev">▶</span>`;
      head.onclick = () => group.classList.toggle("open");
      const body = document.createElement("div");
      body.className = "api-gbody";
      for (const f of g.fns) {
        body.innerHTML += `<div class="api-fn"><div class="sig">${this._esc(f.sig)}</div><div class="doc">${this._esc(f.doc)}</div></div>`;
      }
      group.append(head, body);
      main.appendChild(group);
    }
  }

  _pageDocs(main) {
    main.innerHTML = `<div class="page-title">Feature Documentation</div><div class="page-sub">How every feature works, in detail</div>`;
    for (const d of FeatureDocs) {
      const group = document.createElement("div");
      group.className = "doc-group";
      const head = document.createElement("div");
      head.className = "doc-head";
      head.innerHTML = `<span class="ico">◆</span> ${d.title}<span class="chev">▶</span>`;
      head.onclick = () => group.classList.toggle("open");
      const body = document.createElement("div");
      body.className = "doc-body";
      body.textContent = d.body;
      group.append(head, body);
      main.appendChild(group);
    }
  }

  _esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
}

const app = new OptionsApp();
app.init();
