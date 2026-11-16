(() => {
  const scene = document.getElementById("scene");
  const book = document.getElementById("book");
  const tilt = document.getElementById("tilt");
  const root = document.documentElement;

  const languageToggle = document.querySelector(".language-toggle");
  const languageToggleLabel = languageToggle.querySelector(".language-toggle-label");
  // The toggle shows the language the card is in now; pressing it switches to the other.
  const TOGGLE = {
    ja: { to: "en", label: "日本語", aria: "言語：日本語（English に切り替える）" },
    en: { to: "ja", label: "English", aria: "Language: English (switch to 日本語)" },
  };
  const textTranslations = [...document.querySelectorAll("[data-en]")].map((element) => ({
    element,
    ja: element.textContent,
    en: element.dataset.en,
  }));
  const attributeTranslations = [];
  for (const [attribute, translation] of [["aria-label", "data-en-label"], ["title", "data-en-title"]]) {
    for (const element of document.querySelectorAll(`[${translation}]`)) {
      attributeTranslations.push({
        element,
        attribute,
        ja: element.getAttribute(attribute),
        en: element.getAttribute(translation),
      });
    }
  }

  function setLanguage(language) {
    root.lang = language;
    for (const { element, ...copy } of textTranslations) {
      element.textContent = copy[language];
    }
    for (const { element, attribute, ...copy } of attributeTranslations) {
      element.setAttribute(attribute, copy[language]);
    }
    const toggle = TOGGLE[language];
    languageToggleLabel.textContent = toggle.label;
    languageToggle.setAttribute("aria-label", toggle.aria);
  }

  const languageKey = "bbbit-card-language";
  // The language was picked in <head> before the first paint; apply it to the text.
  setLanguage(root.lang === "en" ? "en" : "ja");
  root.classList.add("lang-ready");
  languageToggle.addEventListener("click", () => {
    const language = TOGGLE[root.lang === "en" ? "en" : "ja"].to;
    setLanguage(language);
    try {
      localStorage.setItem(languageKey, language);
    } catch {
      // The current page is already updated.
    }
  });
  languageToggle.hidden = false;

  /* ---------- Views: cover -> open (inside spread) -> back ---------- */
  const ORDER = ["cover", "open", "back"];
  const VISIBLE = {
    cover: ["cover"],
    open: ["inner-top", "inner-bottom"],
    back: ["back-cover"],
  };
  const faces = [...document.querySelectorAll(".face")];
  let view = "cover";

  /* ---------- First-open reveal ---------- */
  const REVEAL = { cols: 10, rows: 6, start: 0.15, sweep: 0.7, cell: 0.12 };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let revealStarted = false;

  function startReveal() {
    if (reduceMotion || revealStarted) return;
    revealStarted = true;
    // The sweep runs from the top edge down. The top panel is the back of the flap, so
    // it only comes into view once the flap swings past halfway (about 0.15s in);
    // the sweep waits just that long.
    const revealLayers = ["inner-top", "inner-bottom"].map((id, panel) => {
      const layer = document.createElement("div");
      layer.className = "reveal";
      layer.setAttribute("aria-hidden", "true");
      const total = REVEAL.cols * REVEAL.rows * 2;
      for (let r = 0; r < REVEAL.rows; r++) {
        const row = panel * REVEAL.rows + r;
        // The rows either side of the fold carry its shading.
        const atFold = panel === 0 ? r === REVEAL.rows - 1 : r === 0;
        for (let c = 0; c < REVEAL.cols; c++) {
          const cell = document.createElement("span");
          if (atFold) cell.className = "fold";
          const step = row % 2 === 0 ? c : REVEAL.cols - 1 - c; // every other row runs right to left
          const order = row * REVEAL.cols + step;
          const delay = REVEAL.start + (order / total) * REVEAL.sweep;
          cell.style.setProperty("--delay", `${delay.toFixed(3)}s`);
          layer.append(cell);
        }
      }
      document.getElementById(id).append(layer);
      return layer;
    });
    scene.classList.add("revealing");
    const total = (REVEAL.start + REVEAL.sweep + REVEAL.cell) * 1000;
    setTimeout(() => {
      for (const layer of revealLayers) layer.remove();
      scene.classList.remove("revealing");
    }, total + 100);
  }

  function setView(next) {
    if (next === "open") startReveal();
    if (next !== "cover") prepareQr();
    view = next;
    scene.dataset.view = view;
    for (const face of faces) face.inert = !VISIBLE[view].includes(face.id);
  }
  function nextView() {
    setView(ORDER[(ORDER.indexOf(view) + 1) % ORDER.length]);
  }
  book.addEventListener("click", (event) => {
    if (event.target.closest("a")) return; // links inside stay clickable
    if (!event.target.closest(".panel")) return; // empty space around the folded card
    nextView();
  });
  book.addEventListener("keydown", (event) => {
    if (event.target !== book) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      nextView();
    }
  });
  setView("cover");

  /* ---------- Callout (cover only): on hover; on touch screens, until the first tap ---------- */
  if (matchMedia("(hover: hover)").matches) {
    // The book element is as tall as the opened card; only the paper itself counts.
    book.addEventListener("pointerover", (event) => {
      if (event.target.closest(".panel")) showHint();
    });
    book.addEventListener("pointerout", (event) => {
      const to = event.relatedTarget;
      if (!(to instanceof Element && to.closest(".panel"))) scene.classList.remove("hinting");
    });
    book.addEventListener("focus", showHint);
    book.addEventListener("blur", () => scene.classList.remove("hinting"));
  } else {
    scene.classList.add("hinting");
    book.addEventListener("click", () => scene.classList.remove("hinting"), { once: true });
  }

  /* ---------- Tilt + glare (mouse / pen only) ---------- */
  if (!reduceMotion) {
    scene.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const box = scene.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      tilt.classList.add("tracking");
      root.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
      root.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
      // The back face is mirrored, so mirror the highlight too.
      root.style.setProperty("--gx", `${(view === "back" ? 1 - x : x) * 100}%`);
      root.style.setProperty("--gy", `${y * 100}%`);
    });
    scene.addEventListener("pointerleave", () => {
      tilt.classList.remove("tracking");
      root.style.setProperty("--rx", "0deg");
      root.style.setProperty("--ry", "0deg");
      root.style.setProperty("--gx", "50%");
      root.style.setProperty("--gy", "0%");
    });
  }

  /* ---------- Callout start point follows the card ---------- */
  // The label and horizontal line stay put; the dot and the start of the diagonal
  // are moved every frame onto a marker that tilts with the card. Only on the cover,
  // so the start point never rides the flap while it swings open.
  const trackers = [
    { view: "cover", ids: ["callout", "callout-anchor", "callout-dot", "callout-diag-line"] },
  ].map(({ view: forView, ids }) => {
    const [box, anchor, dot, line] = ids.map((id) => document.getElementById(id));
    return { forView, box, anchor, dot, line };
  });
  let trackUntil = 0;
  let tracking = false;

  function showHint() {
    scene.classList.add("hinting");
    wakeTracking();
  }

  function track(now) {
    for (const { forView, box, anchor, dot, line } of trackers) {
      if (view !== forView) continue;
      const at = anchor.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      const x = (at.left - frame.left).toFixed(2);
      const y = (at.top - frame.top).toFixed(2);
      line.setAttribute("x1", x);
      line.setAttribute("y1", y);
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    tracking = now < trackUntil;
    if (tracking) requestAnimationFrame(track);
  }
  // Keep tracking for a moment after the last movement so the tilt (and the flap,
  // after a tap) can settle.
  function wakeTracking() {
    if (view !== "cover" || !scene.classList.contains("hinting")) return;
    trackUntil = performance.now() + 1500;
    if (!tracking) {
      tracking = true;
      requestAnimationFrame(track);
    }
  }
  scene.addEventListener("pointermove", wakeTracking);
  scene.addEventListener("pointerleave", wakeTracking);
  book.addEventListener("click", wakeTracking);
  addEventListener("resize", wakeTracking);
  /* ---------- QR code ---------- */
  let qrRequested = false;
  function prepareQr() {
    if (qrRequested) return;
    qrRequested = true;
    // Start one face early so the code is ready when the back turns into view.
    const script = document.createElement("script");
    script.src = "vendor/qrcode.js";
    script.onload = renderQr;
    script.onerror = () => {
      script.remove();
      qrRequested = false;
    };
    document.head.append(script);
  }

  function renderQr() {
    const configured = document.querySelector('meta[name="card-url"]').content.trim();
    const cardUrl = configured || location.origin + location.pathname;
    const NAVY = "#071428";
    const QUIET = 2;
    const qr = qrcode(0, "M");
    qr.addData(cardUrl);
    qr.make();
    const count = qr.getModuleCount();
    const size = count + QUIET * 2;

    let path = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
      }
    }
    document.getElementById("qr").innerHTML =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
      `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="${NAVY}"/></svg>`;
  }
})();
