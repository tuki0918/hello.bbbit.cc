(() => {
  const scene = document.getElementById("scene");
  const book = document.getElementById("book");
  const tilt = document.getElementById("tilt");
  const root = document.documentElement;

  // The URL the QR code points at: <meta name="card-url">, or this page itself.
  const configured = document.querySelector('meta[name="card-url"]').content.trim();
  const cardUrl = configured || location.origin + location.pathname;

  /* ---------- Views: cover -> open (inside spread) -> back ---------- */
  const ORDER = ["cover", "open", "back"];
  // Which faces can be seen (and so focused) in each view.
  const VISIBLE = {
    cover: ["cover"],
    open: ["inner-top", "inner-bottom"],
    back: ["back-cover"],
  };
  const faces = [...document.querySelectorAll(".face")];
  let view = "cover";

  /* ---------- First-open reveal ---------- */
  // Cover the inside with grid cells and uncover them in a zigzag the first time
  // the card opens (same idea as the laser-reveal-effect library, without React).
  const REVEAL = { cols: 10, rows: 6, start: 0.15, sweep: 0.7, cell: 0.12 };
  const revealLayers = [];
  let revealState = "ready"; // ready -> running -> done

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealState = "done";
  } else {
    // The sweep runs from the top edge down. The top panel is the back of the flap, so
    // it only comes into view once the flap swings past halfway (about 0.15s in);
    // the sweep waits just that long.
    ["inner-top", "inner-bottom"].forEach((id, panel) => {
      const layer = document.createElement("div");
      layer.className = "reveal";
      layer.setAttribute("aria-hidden", "true");
      const total = REVEAL.cols * REVEAL.rows * 2;
      for (let r = 0; r < REVEAL.rows; r++) {
        // Rows counted from the top of the opened spread.
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
      revealLayers.push(layer);
    });
  }

  function startReveal() {
    if (revealState !== "ready") return;
    revealState = "running";
    scene.classList.add("revealing");
    const total = (REVEAL.start + REVEAL.sweep + REVEAL.cell) * 1000;
    setTimeout(() => {
      for (const layer of revealLayers) layer.remove();
      scene.classList.remove("revealing");
      revealState = "done";
    }, total + 100);
  }

  function setView(next) {
    if (next === "open") startReveal();
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
      if (event.target.closest(".panel")) scene.classList.add("hinting");
    });
    book.addEventListener("pointerout", (event) => {
      const to = event.relatedTarget;
      if (!(to instanceof Element && to.closest(".panel"))) scene.classList.remove("hinting");
    });
    book.addEventListener("focus", () => scene.classList.add("hinting"));
    book.addEventListener("blur", () => scene.classList.remove("hinting"));
  } else {
    scene.classList.add("hinting");
    book.addEventListener("click", () => scene.classList.remove("hinting"), { once: true });
  }

  /* ---------- Tilt + glare (mouse / pen only) ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  // The label and the horizontal line stay put; the dot and the start of the
  // diagonal are moved each frame onto a marker that tilts with the card.
  const callout = document.getElementById("callout");
  const anchor = document.getElementById("callout-anchor");
  const dot = document.getElementById("callout-dot");
  const diagLine = document.getElementById("callout-diag-line");
  let trackUntil = 0;
  let tracking = false;

  function track(now) {
    // Only on the cover: once the flap starts to open, the start point stays where it was.
    if (view === "cover") {
      const at = anchor.getBoundingClientRect();
      const box = callout.getBoundingClientRect();
      const x = at.left - box.left;
      const y = at.top - box.top;
      diagLine.setAttribute("x1", x.toFixed(2));
      diagLine.setAttribute("y1", y.toFixed(2));
      dot.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%)`;
    }
    tracking = now < trackUntil;
    if (tracking) requestAnimationFrame(track);
  }
  // Keep tracking for a moment after the last movement so the tilt can settle.
  function wakeTracking() {
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
  wakeTracking();

  /* ---------- QR code ---------- */
  const NAVY = "#071428";
  const QUIET = 2; // quiet-zone modules around the code
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
})();
