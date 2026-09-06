(() => {
  const C = window.VISION_CONTENT;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  function setText(sel, value) {
    $$(sel).forEach(el => el.textContent = value);
  }

  function brandHTML() {
    return `<img class="brand-icon" src="${C.brand.icon}" alt="Vision SMP icon"><span>${C.brand.name}</span>`;
  }

  function nav() {
    $("#site-nav").innerHTML = `
      <nav class="nav">
        <div class="container nav-inner">
          <a class="brand" href="/index.html">${brandHTML()}</a>
          <button class="menu-btn" aria-label="Toggle menu">MENU</button>
          <div class="nav-links">
            <a href="/index.html">Home</a>
            <a href="/competitive.html">Competitive</a>
            <a href="/chill.html">Chill</a>
            <a href="/store.html">Store</a>
            <a href="/rules.html">Rules</a>
            <a href="/support.html">Support</a>
            <a class="nav-cta" href="${C.brand.discord}" target="_blank" rel="noopener">Discord</a>
          </div>
        </div>
      </nav>`;

    $(".menu-btn")?.addEventListener("click", () => $(".nav-links")?.classList.toggle("open"));
    const page = location.pathname.split("/").pop() || "index.html";
    $$(".nav-links a").forEach(a => {
      const href = a.getAttribute("href");
      if (href?.endsWith(page)) a.classList.add("active");
    });
  }

  function footer() {
    $("#site-footer").innerHTML = `
      <footer class="footer">
        <div class="container footer-inner">
          <div>
            <div class="brand">${brandHTML()}</div>
            <p>${C.brand.playAddress} · Minecraft Java · ${C.brand.compatibilityNote}</p>
            <p>© ${new Date().getFullYear()} ${C.brand.name}. Not affiliated with Mojang Studios or Microsoft.</p>
          </div>
          <div class="footer-links">
            <a href="/terms.html">Terms</a>
            <a href="/privacy.html">Privacy</a>
            <a href="/refunds.html">Refunds</a>
            <a href="/support.html">Support</a>
            <a href="${C.brand.discord}" target="_blank" rel="noopener">Discord</a>
          </div>
        </div>
      </footer>`;
  }

  async function copyIP(btn) {
    try {
      await navigator.clipboard.writeText(C.brand.playAddress);
      btn.textContent = "COPIED!";
      const status = $(".copy-status");
      if (status) status.textContent = `${C.brand.playAddress} copied to clipboard.`;
      setTimeout(() => btn.textContent = C.hero.primaryButton, 1600);
    } catch {
      prompt("Copy the server IP:", C.brand.playAddress);
    }
  }

  async function getTebexStore() {
    try {
      const response = await fetch("/api/tebex/info", {headers: {"Accept": "application/json"}});
      if (!response.ok) throw new Error("Store unavailable");
      const data = await response.json();
      if (!data.store_url) throw new Error("Missing store URL");
      return data;
    } catch {
      return null;
    }
  }

  function home() {
    if (!$("#home-page")) return;

    setText("[data-ip]", C.brand.playAddress);
    setText("[data-version]", C.brand.versionDisplay);
    setText("[data-domain]", C.brand.domain);
    setText("[data-tagline]", C.brand.tagline);
    setText("[data-hero-subtitle]", C.hero.subtitle);

    $("#stats").innerHTML = C.stats.map(s =>
      `<div class="stat reveal"><b>${s.value}</b><span>${s.label}</span></div>`
    ).join("");

    $("#modes").innerHTML = [C.modes.competitive, C.modes.chill].map((m,i) => `
      <article class="mode-card ${i ? "green":""} reveal">
        <span class="badge">${m.badge}</span>
        <h3>${m.name}</h3>
        <div class="kicker">${m.kicker}</div>
        <p class="section-copy">${m.description}</p>
        <ul class="feature-list">${m.features.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="actions"><a class="btn btn-secondary" href="/${i?"chill":"competitive"}.html">Explore ${m.name}</a></div>
      </article>`).join("");

    $("#ranks").innerHTML = C.ranks.map(r => `
      <article class="rank-card ${r.featured?"featured":""} reveal">
        <div class="rank-label">${r.label}</div>
        <h3>${r.name}</h3>
        <div class="price">${r.price}</div>
        <ul>${r.perks.map(p=>`<li>${p}</li>`).join("")}</ul>
        <div class="actions"><a class="btn ${r.featured?"btn-primary":"btn-secondary"}" href="/store.html">VIEW STORE</a></div>
      </article>`).join("");

    $("#copy-ip")?.addEventListener("click", e => copyIP(e.currentTarget));
  }

  function modePage(type) {
    const wrap = $("#mode-page");
    if (!wrap) return;
    const m = C.modes[type];
    $("#mode-badge").textContent = m.badge;
    $("#mode-name").textContent = m.name;
    $("#mode-kicker").textContent = m.kicker;
    $("#mode-desc").textContent = m.description;
    $("#mode-features").innerHTML = m.features.map(x=>`<li>${x}</li>`).join("");
    setText("[data-ip]", C.brand.playAddress);
  }

  async function store() {
    const grid = $("#store-grid");
    if (!grid) return;

    grid.innerHTML = C.ranks.map(r => `
      <article class="rank-card ${r.featured?"featured":""} reveal">
        <div class="rank-label">${r.label}</div>
        <h3>${r.name}</h3>
        <div class="price">${r.price}</div>
        <ul>${r.perks.map(p=>`<li>${p}</li>`).join("")}</ul>
        <div class="actions">
          <a class="btn ${r.featured?"btn-primary":"btn-secondary"} store-link" href="#" rel="noopener">
            OPEN SECURE STORE
          </a>
        </div>
      </article>`).join("");

    const storeInfo = await getTebexStore();
    $$(".store-link").forEach(link => {
      if (storeInfo?.store_url) {
        link.href = storeInfo.store_url;
        link.target = "_blank";
      } else {
        link.href = "/support.html";
        link.textContent = "STORE SUPPORT";
      }
    });

    if (storeInfo?.currency) {
      const currency = $("#store-currency");
      if (currency) currency.textContent = storeInfo.currency;
    }
  }

  function rules() {
    const grid = $("#rules-grid");
    if (!grid) return;
    grid.innerHTML = C.rules.map((r,i)=>`
      <article class="rule reveal"><h3>${String(i+1).padStart(2,"0")} · ${r.title}</h3><p>${r.text}</p></article>
    `).join("");
  }

  function support() {
    setText("[data-support-email]", C.brand.supportEmail);
    $$("[data-support-mail]").forEach(a => a.href = `mailto:${C.brand.supportEmail}`);
    $$("[data-discord-link]").forEach(a=>a.href=C.brand.discord);
  }

  function reveals() {
    const obs = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add("visible");
    }), {threshold:.08});
    $$(".reveal").forEach(el => obs.observe(el));
  }

  nav();
  footer();
  home();
  store();
  rules();
  support();
  modePage(document.body.dataset.mode);
  reveals();
})();