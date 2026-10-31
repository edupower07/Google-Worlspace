(() => {
  "use strict";

  const SERIES_TOTAL = 60; // がんばり表のマスの数

  // アプリ名 → 色(CSS変数)。この順でしぼりこみのボタンを並べる
  const APPS = [
    ["ドキュメント", "--app-doc"],
    ["スプレッドシート", "--app-sheet"],
    ["スライド", "--app-slide"],
    ["フォーム", "--app-form"],
    ["Classroom", "--app-classroom"],
    ["ドライブ", "--app-drive"],
    ["カレンダー", "--app-calendar"],
    ["サイト", "--app-sites"],
    ["マイマップ", "--app-mymaps"],
    ["Vids", "--app-vids"],
    ["Gemini", "--app-gemini"],
    ["Gemini Notebook", "--app-notebook"],
    ["GAS", "--app-gas"],
  ];
  const APP_COLOR = Object.fromEntries(APPS.map(([n, v]) => [n, `var(${v})`]));
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
      renderChart();
      renderFilters();
      renderSections();
      bindViewer();
      openFromHash();
    })
    .catch(() => {
      $("#sections").innerHTML = `<p class="empty">動画の一覧を読みこめませんでした。ページを再読みこみしてください。</p>`;
    });

  // ===== がんばり表 =====
  function renderChart() {
    const byNo = new Map(data.episodes.filter((e) => e.no).map((e) => [e.no, e]));
    const usedApps = new Set();
    let html = "";
    for (let n = 1; n <= SERIES_TOTAL; n++) {
      const ep = byNo.get(n);
      const num = `<span class="num">${n}</span>`;
      if (ep && ep.status === "ready" && !ep.hidden) {
        const app = ep.apps[0];
        usedApps.add(app);
        html += `<li><button class="cell is-ready" type="button" data-id="${ep.id}" title="${esc(label(ep) + " " + ep.title)}" aria-label="${esc(label(ep) + " " + ep.title)}">
          <span class="sticker" style="--sticker:${colorOf(app)};--delay:${n * 14}ms"></span>${num}</button></li>`;
      } else {
        const why = ep ? "制作中" : "制作予定";
        html += `<li><span class="cell is-making" title="第${n}回 ${why}" aria-label="第${n}回 ${why}">${num}</span></li>`;
      }
    }
    $("#chart").innerHTML = html;
    $("#chart").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-id]");
      if (b) openEpisode(b.dataset.id);
    });
    $("#chart-legend").innerHTML = APPS.filter(([n]) => usedApps.has(n))
      .map(([n]) => `<li style="--c:${colorOf(n)}"><i></i>${esc(n)}</li>`)
      .join("") + `<li style="--c:transparent"><i style="border:1.5px dashed var(--on-surface-var)"></i>制作中</li>`;
  }

  // ===== しぼりこみ =====
  function renderFilters() {
    const counts = {};
    ready.forEach((e) => e.apps.forEach((a) => (counts[a] = (counts[a] || 0) + 1)));
    const chips = [`<button class="chip" type="button" data-app="" aria-pressed="true">${CHECK}すべて <small>${ready.length}</small></button>`]
      .concat(APPS.filter(([n]) => counts[n]).map(([n]) =>
        `<button class="chip" type="button" data-app="${esc(n)}" aria-pressed="false" style="--c:${colorOf(n)}">${CHECK}<i></i>${esc(n)} <small>${counts[n]}</small></button>`));
    $("#filters").innerHTML = chips.join("");
    $("#filters").addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      state.app = b.dataset.app || null;
      document.querySelectorAll("#filters .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      renderSections();
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
