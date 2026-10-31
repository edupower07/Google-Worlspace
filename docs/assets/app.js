(() => {
  "use strict";

  // アプリ名・色(CSS変数)・アイコン(公式ロゴではない、ふつうの記号)。この順で並べる
  const APPS = [
    ["ドキュメント", "--app-doc", '<path d="M7 3h7l4 4v14H7z"/><path d="M10 11h5M10 14h5M10 17h3"/>'],
    ["スプレッドシート", "--app-sheet", '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M5 10h14M5 15h14M11 4v16"/>'],
    ["スライド", "--app-slide", '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M8 10.5h8M8 13.5h5"/>'],
    ["フォーム", "--app-form", '<rect x="5" y="4" width="14" height="16" rx="1.5"/><circle cx="9" cy="9.5" r="1"/><circle cx="9" cy="14.5" r="1"/><path d="M12 9.5h4M12 14.5h4"/>'],
    ["Classroom", "--app-classroom", '<rect x="3.5" y="5" width="17" height="12" rx="1.5"/><circle cx="12" cy="10" r="2"/><path d="M8.5 17c.6-1.9 2-3 3.5-3s2.9 1.1 3.5 3"/>'],
    ["ドライブ", "--app-drive", '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>'],
    ["カレンダー", "--app-calendar", '<rect x="4" y="5.5" width="16" height="14" rx="1.5"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>'],
    ["サイト", "--app-sites", '<rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M4 9h16M9 9v10.5"/>'],
    ["マイマップ", "--app-mymaps", '<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>'],
    ["Vids", "--app-vids", '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor"/>'],
    ["Gemini", "--app-gemini", '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" fill="currentColor" stroke="none"/>'],
    ["Gemini Notebook", "--app-notebook", '<path d="M5 19.5V5.5A1.5 1.5 0 0 1 6.5 4H18v14H6.5A1.5 1.5 0 0 0 5 19.5 1.5 1.5 0 0 0 6.5 21H18"/><path d="M9 8h5"/>'],
    ["GAS", "--app-gas", '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>'],
  ];
  const APP_COLOR = Object.fromEntries(APPS.map(([n, v]) => [n, `var(${v})`]));
  const APP_ICON = Object.fromEntries(APPS.map(([n, , icon]) => [n, icon]));
  const colorOf = (app) => APP_COLOR[app] || "var(--on-surface-var)";

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const label = (ep) => (ep.no ? `第${String(ep.no).padStart(2, "0")}回` : "番外編");
  const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");
  const CHECK = `<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const tagsHTML = (apps) => apps.map((a) => `<li class="tag" style="--c:${colorOf(a)}"><i></i>${esc(a)}</li>`).join("");

  let data, ready = [], state = { app: null, q: "" };

  fetch("data/episodes.json")
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((json) => {
      data = json;
      ready = json.episodes.filter((e) => e.status === "ready" && !e.hidden);
      $("#count-ready").textContent = ready.length;
      renderLauncher();
      renderFilters();
      renderSections();
      bindViewer();
      openFromHash();
    })
    .catch(() => {
      $("#sections").innerHTML = `<p class="empty">動画の一覧を読みこめませんでした。ページを再読みこみしてください。</p>`;
    });

  // ===== アプリから探す =====
  function appCounts() {
    const counts = {};
    ready.forEach((e) => e.apps.forEach((a) => (counts[a] = (counts[a] || 0) + 1)));
    return counts;
  }

  function renderLauncher() {
    const counts = appCounts();
    $("#launcher").innerHTML = APPS.filter(([n]) => counts[n]).map(([n]) =>
      `<li><button type="button" class="app" data-app="${esc(n)}">
        <span class="app-icon" style="--c:${colorOf(n)}"><svg viewBox="0 0 24 24" aria-hidden="true">${APP_ICON[n]}</svg></span>
        <span class="app-name">${esc(n)}</span>
        <span class="app-count">${counts[n]}本</span>
      </button></li>`).join("");
    $("#launcher").addEventListener("click", (e) => {
      const b = e.target.closest(".app");
      if (!b) return;
      setApp(b.dataset.app);
      $("#library").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }

  // ===== しぼりこみ =====
  function renderFilters() {
    const counts = appCounts();
    const chips = [`<button class="chip" type="button" data-app="" aria-pressed="true">${CHECK}すべて <small>${ready.length}</small></button>`]
      .concat(APPS.filter(([n]) => counts[n]).map(([n]) =>
        `<button class="chip" type="button" data-app="${esc(n)}" aria-pressed="false" style="--c:${colorOf(n)}">${CHECK}<i></i>${esc(n)} <small>${counts[n]}</small></button>`));
    $("#filters").innerHTML = chips.join("");
    $("#filters").addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (b) setApp(b.dataset.app);
    });
    let t;
    $("#q").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = e.target.value.trim();
        renderSections();
      }, 120);
    });
  }

  function setApp(app) {
    state.app = app || null;
    document.querySelectorAll("#filters .chip").forEach((c) => c.setAttribute("aria-pressed", String((c.dataset.app || null) === state.app)));
    renderSections();
  }

  function matches(ep) {
    if (state.app && !ep.apps.includes(state.app)) return false;
    if (!state.q) return true;
    const hay = [label(ep), ep.title, ep.slug, ep.description, ep.apps.join(" ")].join(" ").toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }

  // ===== 一覧 =====
  function renderSections() {
    const shown = ready.filter(matches);
    const filtering = state.app || state.q;
    $("#result-note").textContent = filtering ? `${shown.length}本 見つかりました` : "";

    if (!shown.length) {
      $("#sections").innerHTML = `<div class="empty"><p>条件に合う動画はありません。ことばを変えるか、しぼりこみを外してください。</p>
        <button type="button" id="reset">しぼりこみを外す</button></div>`;
      $("#reset").addEventListener("click", resetFilters);
      return;
    }

    $("#sections").innerHTML = data.parts.map((p) => {
      const eps = shown.filter((e) => e.part === p.id);
      if (!eps.length) return "";
      return `<section class="part" aria-labelledby="part-${p.id}">
        <div class="part-head">
          <span class="series">${esc(p.series)}</span>
          <h2 id="part-${p.id}">${esc(p.name)}</h2>
          <span class="count">${eps.length}本</span>
        </div>
        <ul class="cards">${eps.map(cardHTML).join("")}</ul>
      </section>`;
    }).join("");
  }

  function cardHTML(ep) {
    return `<li><button class="ep" type="button" data-id="${ep.id}">
      <div class="ep-thumb">
        ${ep.cover ? `<img src="${esc(ep.cover)}" alt="" loading="lazy" width="640" height="360">` : ""}
        ${ep.duration_sec ? `<span class="ep-dur">${fmtDur(ep.duration_sec)}</span>` : ""}
      </div>
      <div class="ep-body">
        <span class="ep-no">${label(ep)}</span>
        <h3 class="ep-title">${esc(ep.title)}</h3>
        <ul class="tags">${tagsHTML(ep.apps)}</ul>
      </div>
    </button></li>`;
  }

  function resetFilters() {
    state = { app: null, q: "" };
    $("#q").value = "";
    document.querySelectorAll("#filters .chip").forEach((c) => c.setAttribute("aria-pressed", String(!c.dataset.app)));
    renderSections();
  }

  // ===== 動画を見る =====
  function bindViewer() {
    const dlg = $("#viewer");
    $("#sections").addEventListener("click", (e) => {
      const b = e.target.closest(".ep[data-id]");
      if (b) openEpisode(b.dataset.id);
    });
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
    });
    dlg.addEventListener("close", () => {
      $("#player").innerHTML = ""; // 再生を止める
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    });
    $("#prev").addEventListener("click", () => step(-1));
    $("#next").addEventListener("click", () => step(1));
    window.addEventListener("hashchange", openFromHash);
  }

  let current = null;
  function step(d) {
    const i = ready.findIndex((e) => e.id === current);
    const next = ready[i + d];
    if (next) openEpisode(next.id);
  }

  function openFromHash() {
    const m = location.hash.match(/^#ep-(.+)$/);
    if (m) openEpisode(decodeURIComponent(m[1]));
  }

  function openEpisode(id) {
    const ep = ready.find((e) => e.id === id);
    if (!ep) return;
    current = id;
    const part = data.parts.find((p) => p.id === ep.part);

    $("#player").innerHTML = ep.youtube_id
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ep.youtube_id)}?rel=0&modestbranding=1&playsinline=1"
           title="${esc(ep.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      : `<div class="pending">${ep.cover ? `<img src="${esc(ep.cover)}" alt="">` : ""}
           <p>この回の動画は、YouTube にアップロードしたあと、ここで再生できるようになります。</p></div>`;

    $("#viewer-meta").textContent = [label(ep), part && part.name, fmtDur(ep.duration_sec)].filter(Boolean).join(" ・ ");
    $("#viewer-title").textContent = ep.title;
    $("#viewer-tags").innerHTML = tagsHTML(ep.apps);
    $("#viewer-desc").innerHTML = (ep.description || "")
      .split(/\n{2,}/)
      .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
      .join("");

    const i = ready.findIndex((e) => e.id === id);
    $("#prev").disabled = i <= 0;
    $("#next").disabled = i >= ready.length - 1;

    const hash = `#ep-${encodeURIComponent(id)}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    const dlg = $("#viewer");
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }
})();
