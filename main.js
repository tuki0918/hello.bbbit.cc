(() => {
  const card = document.getElementById("card");
  const tilt = document.getElementById("tilt");
  const front = document.getElementById("front");
  const back = document.getElementById("back");
  const flipLabel = document.getElementById("flip-label");
  const hint = document.getElementById("hint");
  const root = document.documentElement;

  // The URL the QR code points at: <meta name="card-url">, or this page itself.
  const configured = document.querySelector('meta[name="card-url"]').content.trim();
  const cardUrl = configured || location.origin + location.pathname;

  /* ---------- Flip ---------- */
  let flipped = false;
  function setFlipped(next) {
    flipped = next;
    card.classList.toggle("flipped", flipped);
    card.setAttribute("aria-pressed", String(flipped));
    // Keep links on the hidden face out of the tab order.
    front.inert = flipped;
    back.inert = !flipped;
    flipLabel.textContent = flipped ? "オモテを見る" : "ウラを見る";
    hint.style.visibility = "hidden";
  }
  card.addEventListener("click", (event) => {
    if (event.target.closest("a")) return; // links on the back stay clickable
    setFlipped(!flipped);
  });
  card.addEventListener("keydown", (event) => {
    if (event.target !== card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFlipped(!flipped);
    }
  });
  document.getElementById("flip").addEventListener("click", () => setFlipped(!flipped));

  /* ---------- Tilt + glare (mouse / pen only) ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    const scene = tilt.parentElement;
    scene.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const box = scene.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      tilt.classList.add("tracking");
      root.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
      root.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
      // The back face is mirrored, so mirror the highlight too.
      root.style.setProperty("--gx", `${(flipped ? 1 - x : x) * 100}%`);
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

  document.getElementById("qr-save").addEventListener("click", () => {
    const scale = Math.ceil(1024 / size);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = NAVY;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col))
          ctx.fillRect((col + QUIET) * scale, (row + QUIET) * scale, scale, scale);
      }
    }
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "meishi-qr.png";
    link.click();
  });

  /* ---------- Share ---------- */
  const shareLabel = document.getElementById("share-label");
  document.getElementById("share").addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: cardUrl });
        return;
      }
      await navigator.clipboard.writeText(cardUrl);
      shareLabel.textContent = "URLをコピーしました";
      setTimeout(() => (shareLabel.textContent = "共有"), 1800);
    } catch (error) {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  });
})();
