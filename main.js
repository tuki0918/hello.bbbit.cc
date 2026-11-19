(() => {
  const scene = document.getElementById("scene");
  const book = document.getElementById("book");
  const tilt = document.getElementById("tilt");
  const root = document.documentElement;

  /* ---------- Console achievements ---------- */
  const achievements = {
    cover: { ja: "カードの表紙を見た", en: "Viewed the Cover" },
    open: { ja: "カードを開いた", en: "Opened the Card" },
    works: { ja: "WORKSを開いた", en: "Opened WORKS" },
    portrait: { ja: "中の人の正体をあばいた", en: "Unmasked the Person Behind the Card" },
    likes: { ja: "3つの「いいね」を満タンにした", en: "Filled All Three Like Meters" },
    back: { ja: "カードの裏面を見た", en: "Viewed the Back" },
    contact: { ja: "お問い合わせフォームを開いた", en: "Opened the Contact Form" },
    konami: { ja: "コナミコマンドを入力した", en: "Entered the Konami Code" },
  };
  const achievementTotal = Object.keys(achievements).length;
  const unlockedAchievements = new Set();
  const achievementBadgeStyle = "background:#071428;color:#b1f2f7;padding:3px 7px;border-radius:4px;font-weight:700";

  function unlockAchievement(id) {
    if (unlockedAchievements.has(id)) return;
    unlockedAchievements.add(id);
    const label = achievements[id][root.lang];
    const english = root.lang === "en";
    const title = english ? "Achievement Unlocked" : "実績解除";
    const separator = english ? ": " : "：";
    console.info(
      `%c🏆 ${title} (${unlockedAchievements.size}/${achievementTotal})%c${separator}[${label}]`,
      achievementBadgeStyle,
      "font-weight:700",
    );
    if (unlockedAchievements.size === achievementTotal) {
      const completion = english ? "All Achievements Unlocked!" : "実績コンプリート！";
      const invitation = english
        ? "Leave your GitHub username in the contributor list."
        : "記念に、あなたのGitHubユーザー名を参加者一覧に残しませんか？";
      const instructions = english
        ? "Add your GitHub username on a new line at the end of CONTRIBUTORS.txt and open a pull request."
        : "CONTRIBUTORS.txt の末尾に自分のGitHubユーザー名を1行追加して、プルリクエストを送ってください。";
      const editUrl = `${document.querySelector(".repo-link").href}/edit/main/CONTRIBUTORS.txt`;
      console.info(
        `%c🏆 ${completion}%c ${invitation}\n${instructions}\n${editUrl}`,
        achievementBadgeStyle,
        "",
      );
    }
  }

  if (new URLSearchParams(location.search).get("s") === "x") {
    const baseProfile = document.getElementById("profile-base");
    const baseName = baseProfile.querySelector(".inner-name");
    const upperPanel = baseProfile.parentElement;
    const peelHandle = upperPanel.querySelector(".profile-peel");

    // Copy the print layout. The original WORKS and social controls are shared by both sheets.
    const front = baseProfile.cloneNode(true);
    front.removeAttribute("id");
    front.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    front.querySelector(".inner-name").textContent = "tuki0918";
    front.querySelector(".avatar").src = "avatar-x.svg";
    baseName.setAttribute("aria-label", "tuki0918");

    const sticker = document.createElement("div");
    sticker.className = "profile-sticker";
    sticker.inert = true;
    sticker.setAttribute("aria-hidden", "true");
    sticker.append(front);
    peelHandle.before(sticker);
    peelHandle.hidden = false;

    const worksButton = baseProfile.querySelector(".works-link");
    const footer = worksButton.parentElement;
    const socials = footer.querySelector(".socials");
    function fitStickerOpenings() {
      // Use the untransformed layout so the opening stays aligned as the card tilts.
      const gap = 4;
      const left = footer.offsetLeft + footer.clientLeft - gap;
      const top = footer.offsetTop + footer.clientTop - gap;
      function opening(element, right) {
        const x = left + element.offsetLeft;
        const y = top + element.offsetTop;
        const width = right === undefined ? element.offsetWidth + gap * 2 : right - x;
        const height = element.offsetHeight + gap * 2;
        return `linear-gradient(#000 0 0) ${x}px ${y}px / ${width}px ${height}px no-repeat`;
      }
      upperPanel.style.setProperty("--works-opening", opening(worksButton));
      upperPanel.style.setProperty("--socials-opening", opening(socials, footer.offsetLeft + footer.offsetWidth));
    }
    fitStickerOpenings();
    const openingObserver = new ResizeObserver(fitStickerOpenings);
    for (const element of [baseProfile, baseProfile.querySelector(".id-row"), footer, worksButton, socials]) {
      openingObserver.observe(element);
    }

    let drag = null;
    let suppressClick = false;

    function peelSticker() {
      peelHandle.setAttribute("aria-expanded", "true");
      peelHandle.setAttribute("aria-disabled", "true");
      baseName.removeAttribute("aria-label");
      if (document.activeElement === peelHandle) {
        baseName.tabIndex = -1;
        baseName.focus({ preventScroll: true });
      }
      unlockAchievement("portrait");
    }

    window.addEventListener("pointerdown", (event) => {
      if (event.isPrimary) suppressClick = false;
    }, true);
    peelHandle.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || peelHandle.hasAttribute("aria-disabled")) return;
      const { width, height } = upperPanel.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        width,
        height,
        start: parseFloat(getComputedStyle(upperPanel).getPropertyValue("--sticker-peel")),
        progress: 0,
      };
      peelHandle.setPointerCapture(event.pointerId);
    });
    // The pointer can leave the corner and cross either panel during a peel.
    window.addEventListener("pointermove", (event) => {
      if (drag?.id !== event.pointerId) return;
      const x = event.clientX - drag.x;
      const y = event.clientY - drag.y;
      if (!suppressClick && Math.hypot(x, y) < 5) return;
      suppressClick = true;
      event.stopPropagation();
      drag.progress = Math.min(1, Math.max(0, x / drag.width - y / drag.height));
      upperPanel.classList.add("dragging");
      upperPanel.style.setProperty("--sticker-peel", `${drag.start + drag.progress * (200 - drag.start)}%`);
    }, true);
    function endDrag(event) {
      if (drag?.id !== event.pointerId) return;
      if (event.type === "pointerup" && drag.progress >= 0.3) peelSticker();
      drag = null;
      upperPanel.classList.remove("dragging");
      upperPanel.style.removeProperty("--sticker-peel");
    }
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    window.addEventListener("click", (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    }, true);
    peelHandle.addEventListener("click", () => {
      if (!peelHandle.hasAttribute("aria-disabled")) peelSticker();
    });
  }

  const languageToggle = document.querySelector(".language-toggle");
  const languageToggleLabel = languageToggle.querySelector(".language-toggle-label");
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
  for (const [attribute, translation] of [
    ["aria-label", "data-en-label"],
    ["title", "data-en-title"],
    ["placeholder", "data-en-placeholder"],
  ]) {
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

  // On phones the 120 flashing cells, painted inside the 3D card, flicker; there the
  // inside is simply shown.
  const touchScreen = matchMedia("(pointer: coarse)").matches;

  function startReveal() {
    if (reduceMotion || touchScreen || revealStarted) return;
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

  /* ---------- Pleat: the WORKS panel folded between the top and bottom ---------- */
  const worksToggle = document.getElementById("works-toggle");
  const pleats = [...document.querySelectorAll(".pleat")];
  const FOLD_LABEL = { false: ["WORKS をひらく", "Unfold WORKS"], true: ["WORKS をたたむ", "Fold WORKS away"] };
  let unfolded = false;

  function setFold(open) {
    unfolded = open;
    scene.classList.toggle("unfolded", open);
    fitCard();
    worksToggle.setAttribute("aria-expanded", String(open));
    const label = attributeTranslations.find((each) => each.element === worksToggle);
    [label.ja, label.en] = FOLD_LABEL[open];
    worksToggle.setAttribute("aria-label", label[root.lang === "en" ? "en" : "ja"]);
    for (const pleat of pleats) pleat.inert = !open;
    if (open) unlockAchievement("works");
  }
  worksToggle.addEventListener("click", () => setFold(!unfolded));

  const works = [...document.querySelectorAll("button.work")];
  const workDetail = document.querySelector(".work-detail");
  const workName = workDetail.querySelector(".work-name");
  const workDesc = workDetail.querySelector(".work-desc");
  const workOpen = workDetail.querySelector(".work-open");
  let selectedWork = works[0];

  function renderWork() {
    for (const work of works) work.setAttribute("aria-pressed", String(work === selectedWork));
    const { name, href, desc, descEn } = selectedWork.dataset;
    workName.textContent = name;
    workDesc.textContent = root.lang === "en" ? descEn : desc;
    workOpen.href = href;
  }
  for (const work of works) {
    work.addEventListener("click", () => {
      if (work === selectedWork) return;
      selectedWork = work;
      renderWork();
      if (reduceMotion) return;
      workDetail.animate(
        [
          { opacity: 0, transform: "translateY(0.4em)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260, easing: "ease-out" },
      );
    });
  }
  renderWork();
  languageToggle.addEventListener("click", renderWork); // after setLanguage has run

  /* ---------- Contact form ---------- */
  const stage = document.querySelector(".stage");
  const repoLinks = stage.querySelector(".repo-links");
  const contactTrigger = document.querySelector(".contact-trigger");
  const contactPanel = document.getElementById("contact-panel");
  const contactTitle = document.getElementById("contact-title");
  const contactClose = contactPanel.querySelector(".contact-close");
  const contactForm = document.getElementById("contact-form");
  const contactTopic = document.getElementById("contact-type");
  const contactStatus = contactPanel.querySelector(".contact-status");
  const contactMessages = {
    incomplete: { ja: "お名前とご相談内容を入力してください。", en: "Enter your name and message." },
    mail: { ja: "メールアプリで内容をご確認のうえ、送信してください。", en: "Review and send your message in your email app." },
  };
  const contactMailLabels = {
    ja: { subject: "お問い合わせ", name: "お名前", email: "メールアドレス", company: "会社名・団体名", topic: "お問い合わせの種類" },
    en: { subject: "Inquiry", name: "Name", email: "Email address", company: "Organization", topic: "Topic" },
  };
  let contactMessage = "";

  function showContactMessage(message) {
    contactMessage = message;
    contactStatus.textContent = contactMessages[message]?.[root.lang] ?? "";
    contactStatus.classList.toggle("error", message === "incomplete");
  }
  languageToggle.addEventListener("click", () => showContactMessage(contactMessage));

  function setContactOpen(open) {
    stage.classList.toggle("contact-open", open);
    contactTrigger.setAttribute("aria-expanded", String(open));
    contactPanel.inert = !open;
    if (open) unlockAchievement("contact");
  }
  function closeContact() {
    setContactOpen(false);
    const focusTarget = view === "back" ? contactTrigger : book;
    focusTarget.focus();
  }
  contactTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    setContactOpen(true);
    contactTitle.focus({ preventScroll: true });
  });
  contactClose.addEventListener("click", closeContact);

  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    showContactMessage("");
    if (!contactForm.reportValidity()) return;
    const data = new FormData(contactForm);
    const name = data.get("name").trim();
    const message = data.get("message").trim();
    if (!name || !message) {
      showContactMessage("incomplete");
      return;
    }
    const labels = contactMailLabels[root.lang];
    const topic = contactTopic.value ? contactTopic.selectedOptions[0].textContent.trim() : "";
    const subject = `[bbbit] ${topic || labels.subject} / ${name}`;
    const body = [
      `${labels.name}: ${name}`,
      `${labels.email}: ${data.get("email")}`,
      `${labels.company}: ${data.get("company").trim() || "—"}`,
      `${labels.topic}: ${topic || "—"}`,
      "",
      message,
    ].join("\n");
    const mail = document.createElement("a");
    mail.href = `mailto:${contactTrigger.textContent.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showContactMessage("mail");
    mail.click();
  });
  contactForm.addEventListener("input", () => showContactMessage(""));

  /* ---------- Fit the card to the screen, for each state ---------- */
  // How much of the scene's height the paper covers: folded, opened, opened with
  // WORKS out. It is always centred on the scene.
  const SPAN = { cover: 0.5, open: 1, back: 0.5 };
  const PAGER = 30; // the squares under the card, and their gap
  const cornerControls = [languageToggle, repoLinks];
  let fit = 1;

  function fitCard() {
    const width = scene.offsetWidth;
    const height = scene.offsetHeight;
    const span = (unfolded ? 1.5 : SPAN[view]) * height;
    const em = width / 22;
    // The cover hint's label stands above the folded card. The back keeps the same
    // room, so the card sits in the same place on both sides.
    const above = view !== "open" ? 4 * em : 0;
    const pad = getComputedStyle(stage);
    const padTop = parseFloat(pad.paddingTop);
    // The layout viewport, not innerWidth/innerHeight: on phones those follow pinch
    // zoom and the toolbars coming and going, and refitting on them never settles.
    const viewWidth = root.clientWidth;
    const room = root.clientHeight - padTop - parseFloat(pad.paddingBottom);
    // Right after a reload a phone can report a viewport or card with no size yet.
    // Fitting to that would shrink the card to nothing; wait for a real layout.
    if (!(height > 0) || !(room > 0)) {
      fitSize = "";
      return;
    }
    fitSize = sizeKey();
    const measure = (clear) => Math.min(1, Math.max(0.3, (room - clear) / (span + above + PAGER)));
    // Keep clear of the corner controls (language toggle, GitHub link) if the card
    // would run under them.
    fit = measure(0);
    let clear = 0;
    const half = (width * fit) / 2;
    for (const corner of cornerControls) {
      const box = corner.getBoundingClientRect();
      if (viewWidth / 2 + half > box.left - 4 && viewWidth / 2 - half < box.right + 4) {
        clear = Math.max(clear, box.bottom + 6 - padTop);
      }
    }
    if (clear > 0) fit = measure(clear);
    // The scene keeps its full layout box; these margins trim it to what the paper
    // covers once scaled (about its centre), so the page lays out around the card.
    const trim = ((span * fit) / 2 - height / 2);
    scene.style.setProperty("--fit", fit.toFixed(4));
    scene.style.setProperty("--fit-top", `${(trim + above * fit + clear).toFixed(1)}px`);
    scene.style.setProperty("--fit-bottom", `${(trim + PAGER * fit).toFixed(1)}px`);
  }
  // Refit only when the layout viewport or the card's own size really changes
  // (rotating the phone, resizing the window, the page settling after a reload), at
  // most once a frame. Zooming in and scrolling change neither, so they leave it alone.
  let fitSize = "";
  let fitFrame = 0;
  const sizeKey = () => `${root.clientWidth}x${root.clientHeight}x${scene.offsetWidth}x${repoLinks.offsetWidth}`;
  function requestFit() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      if (sizeKey() !== fitSize) fitCard();
    });
  }
  addEventListener("resize", requestFit);
  // The viewport (the root fills it) and the card, measured after layout. This also
  // runs once as soon as the page is laid out.
  new ResizeObserver(requestFit).observe(root);
  new ResizeObserver(requestFit).observe(scene);
  new ResizeObserver(requestFit).observe(repoLinks);
  addEventListener("pageshow", () => {
    fitSize = "";
    requestFit();
  });

  function setView(next) {
    if (next !== "open" && unfolded) setFold(false);
    if (next === "open") startReveal();
    if (next !== "cover") prepareQr();
    view = next;
    scene.dataset.view = view;
    for (const face of faces) face.inert = !VISIBLE[view].includes(face.id);
    fitCard();
    unlockAchievement(next);
  }
  function nextView() {
    if (unfolded) {
      setFold(false);
      return;
    }
    setView(ORDER[(ORDER.indexOf(view) + 1) % ORDER.length]);
  }
  book.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return; // links and like buttons inside stay clickable
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
  // The first fit lands at once, without the transition.
  scene.style.transition = "none";
  setView("cover");
  scene.offsetWidth;
  scene.style.transition = "";

  async function loadForkCount() {
    const repoPath = new URL(repoLinks.querySelector(".repo-link").href).pathname;
    const response = await fetch(`https://api.github.com/repos${repoPath}`);
    if (!response.ok) return;
    const { forks_count: count } = await response.json();
    if (Number.isSafeInteger(count) && count >= 0) {
      document.getElementById("repo-forks").textContent = count.toLocaleString("en");
    }
  }
  loadForkCount().catch(() => {});

  /* ---------- Konami code ---------- */
  const konamiCode = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  const recentKeys = [];
  const backdrop = document.querySelector(".backdrop");
  const backdropBits = [...backdrop.querySelectorAll(".bit")].sort((a, b) =>
    Number(a.style.getPropertyValue("--x")) - Number(b.style.getPropertyValue("--x")),
  );
  backdropBits.forEach((bit, index) => bit.style.setProperty("--wave-delay", `${index * 35}ms`));
  const messageGlyphs = [
    ["111", "001", "111", "100", "111"], // 2
    ["111", "101", "101", "101", "111"], // 0
    ["111", "101", "101", "101", "111"], // 0
    ["0", "0", "0", "0", "0"], // Space
    ["010", "101", "101", "101", "010"], // O
    ["1001", "1010", "1100", "1010", "1001"], // K
  ];
  const messageColumns = messageGlyphs.reduce((width, glyph) => width + glyph[0].length + 1, -1);
  const messageRows = messageGlyphs[0].length;
  let messageTimeout;

  function fitBackdropMessage(message) {
    // The backdrop grid crosses the centre of the screen along both axes.
    const { width, height } = backdrop.getBoundingClientRect();
    const centerX = width / 2;
    const centerY = height / 2;
    const baseCell = backdropBits[0].getBoundingClientRect().width + 1;
    const visible = faces.filter((face) => !face.inert);
    if (!contactPanel.inert) visible.push(contactPanel);
    const boxes = visible.map((element) => element.getBoundingClientRect());
    const spaces = [
      { left: 0, right: width, top: 0, bottom: Math.min(height, ...boxes.map((box) => box.top)) },
      { left: 0, right: width, top: Math.max(0, ...boxes.map((box) => box.bottom)), bottom: height },
      { left: 0, right: Math.min(width, ...boxes.map((box) => box.left)), top: 0, bottom: height },
      { left: Math.max(0, ...boxes.map((box) => box.right)), right: width, top: 0, bottom: height },
    ];
    function gridStart(min, max, center, cell, length) {
      const first = Math.ceil((min + 8 - center) / cell);
      const last = Math.floor((max - 8 - center) / cell) - length;
      if (first > last) return null;
      const ideal = Math.round(((min + max) / 2 - center) / cell - length / 2);
      return Math.max(first, Math.min(last, ideal));
    }
    function position(division, x, y) {
      backdrop.style.setProperty("--message-division", division);
      message.style.setProperty("--message-x", x);
      message.style.setProperty("--message-y", y);
    }

    // Keep the original squares when they fit. Subdivisions share the same grid lines.
    const maxDivision = Math.max(1, Math.ceil(baseCell / 3));
    for (let division = 1; division <= maxDivision; division++) {
      const cell = baseCell / division;
      for (const space of spaces) {
        const x = gridStart(space.left, space.right, centerX, cell, messageColumns);
        const y = gridStart(space.top, space.bottom, centerY, cell, messageRows);
        if (x === null || y === null) continue;
        position(division, x, y);
        return;
      }
    }
    position(maxDivision, -Math.floor(messageColumns / 2), Math.ceil((8 - centerY) / (baseCell / maxDivision)));
  }

  function showBackdropMessage() {
    const message = document.createElement("div");
    message.className = "backdrop-message";
    message.style.gridTemplateColumns = `repeat(${messageColumns}, var(--grid-cell))`;
    let startColumn = 0;
    for (const glyph of messageGlyphs) {
      glyph.forEach((row, y) => {
        [...row].forEach((filled, x) => {
          if (filled === "0") return;
          const dot = document.createElement("span");
          const column = startColumn + x;
          dot.style.gridColumn = column + 1;
          dot.style.gridRow = y + 1;
          dot.style.setProperty("--message-column", column);
          message.append(dot);
        });
      });
      startColumn += glyph[0].length + 1;
    }

    clearTimeout(messageTimeout);
    backdrop.querySelector(".backdrop-message")?.remove();
    backdrop.classList.remove("konami");
    backdrop.offsetWidth; // Restart the wave when the code is entered again.
    backdrop.classList.add("konami");
    fitBackdropMessage(message);
    backdrop.append(message);
    messageTimeout = setTimeout(() => {
      message.remove();
      backdrop.classList.remove("konami");
      backdrop.style.removeProperty("--message-division");
    }, 3900);
  }

  window.addEventListener("resize", () => {
    const message = backdrop.querySelector(".backdrop-message");
    if (message) fitBackdropMessage(message);
  });

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.isComposing || (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select")))) {
      recentKeys.length = 0;
      return;
    }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key === "Shift") return;
    recentKeys.push(event.key.toLowerCase());
    if (recentKeys.length > konamiCode.length) recentKeys.shift();
    if (recentKeys.length === konamiCode.length && konamiCode.every((key, index) => key === recentKeys[index])) {
      recentKeys.length = 0;
      showBackdropMessage();
      unlockAchievement("konami");
    }
  });

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
      // The callout sits inside the scaled scene: measure in its own units.
      const x = ((at.left - frame.left) / fit).toFixed(2);
      const y = ((at.top - frame.top) / fit).toFixed(2);
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
  /* ---------- Likes: each thumb holds a few; once full, further likes flow on ---------- */
  // Tapping a thumb fills it. A full thumb passes the like along the arrow to the
  // next one. When all three are full, confetti flies and the diagram starts over.
  const LIKE_GOAL = 3;
  const flow = document.querySelector(".flow");
  const likes = [...flow.querySelectorAll(".like")].map((button) => ({
    button,
    tile: button.querySelector(".tile"),
    badge: button.querySelector(".like-count"),
    count: 0,
  }));
  const likeSource = flow.querySelector(".like-source");
  // One arrow leads into each thumb: the first from the IT tile, the rest from the thumb before.
  const likeArrows = [...flow.querySelectorAll(".flow-arrow")];
  // Each arrow gets a second copy of its line, drawn only while a like passes.
  const likeLights = likeArrows.map((arrow) => {
    const light = arrow.querySelector("path").cloneNode();
    light.setAttribute("class", "flow-light");
    light.setAttribute("pathLength", "1");
    arrow.append(light);
    return light;
  });
  let celebrating = false;

  function renderLike(like) {
    like.button.style.setProperty("--fill", like.count / LIKE_GOAL);
    like.button.classList.toggle("has-likes", like.count > 0);
    like.button.classList.toggle("full", like.count === LIKE_GOAL);
    // Keep the last text while the badge shrinks away. A full thumb reads MAX instead of its number.
    if (like.count > 0) like.badge.textContent = like.count === LIKE_GOAL ? "MAX" : like.count;
  }

  function popTile(tile) {
    if (reduceMotion) return;
    tile.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], {
      duration: 260,
      easing: "ease-out",
    });
  }

  function addLike(index) {
    if (celebrating) return;
    const like = likes[index];
    popTile(like.tile);
    const wasFull = like.count === LIKE_GOAL;
    if (!wasFull) {
      like.count++;
      renderLike(like);
      if (likes.every((each) => each.count === LIKE_GOAL)) {
        celebrate();
        return;
      }
    }
    if (wasFull && likes.slice(index + 1).some((each) => each.count < LIKE_GOAL)) {
      sendLike(index + 1);
    }
  }

  // A streak of light runs along the arrow into a thumb, and the like lands there.
  function sendLike(to) {
    if (reduceMotion) {
      addLike(to);
      return;
    }
    const light = likeLights[to];
    light.style.setProperty("--hue", getComputedStyle(likes[to].button).getPropertyValue("--hue"));
    // The path is measured as 1 long; a streak 0.45 long enters at the tail and leaves past the head.
    light.animate(
      [
        { strokeDashoffset: 0.45, opacity: 1 },
        { strokeDashoffset: -1, opacity: 1 },
      ],
      { duration: 460, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
    ).onfinish = () => addLike(to);
  }

  function celebrate() {
    celebrating = true;
    flow.classList.add("celebrating");
    unlockAchievement("likes");
    if (!reduceMotion) throwConfetti(likes[likes.length - 1].tile);
    setTimeout(
      () => {
        for (const like of likes) {
          like.count = 0;
          renderLike(like);
        }
        flow.classList.remove("celebrating", "liked");
        celebrating = false;
      },
      reduceMotion ? 1200 : 1800,
    );
  }

  // Square confetti, like the logo's dot, thrown up from the last thumb.
  function throwConfetti(origin) {
    const box = origin.getBoundingClientRect();
    const width = innerWidth;
    const height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.className = "confetti";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    document.body.append(canvas);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const COLORS = ["#16bed0", "#4fe3a1", "#ffd447", "#ff6b9a", "#ffffff", "#071428"];
    const DURATION = 2600;
    const pieces = Array.from({ length: 130 }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 300 + Math.random() * 560;
      return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 5,
        turn: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 14,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 4 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
      };
    });
    let start;
    let last;
    function frame(now) {
      start ??= now;
      const dt = Math.min((now - (last ?? now)) / 1000, 0.05);
      last = now;
      const elapsed = now - start;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.max(0, Math.min(1, (DURATION - elapsed) / 500));
      for (const piece of pieces) {
        piece.vx *= Math.pow(0.3, dt);
        piece.vy = Math.min(piece.vy + 900 * dt, 380); // paper falls slowly
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.turn += piece.spin * dt;
        piece.flip += piece.flipSpeed * dt;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.turn);
        context.scale(1, Math.cos(piece.flip));
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        context.restore();
      }
      if (elapsed < DURATION) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  likeSource.addEventListener("click", () => {
    if (celebrating) return;
    flow.classList.add("liked");
    popTile(likeSource.querySelector(".tile"));
    sendLike(0);
  });
  for (const [index, like] of likes.entries()) {
    renderLike(like);
    like.button.addEventListener("click", () => {
      flow.classList.add("liked");
      addLike(index);
    });
  }

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
