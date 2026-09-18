(() => {
  const defaultDescription = "Plan precise running paces, learn practical running lessons, and follow the Danz pacer build.";
  const content = {
    weekly: { topics: [], articles: [] },
    building: { stages: [], updates: [] },
    products: { products: [], sourceCatalogues: [] },
    spots: { spots: [] },
    site: { newsletter: { status: "not-configured" } },
  };
  let adminAccess = false;
  let contentError = false;
  let contentReady;

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
  }

  function formatDate(value) {
    return new Date(`${value}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  }

  function setMeta(title, description = defaultDescription) {
    document.title = title;
    document.querySelector('meta[name="description"]').setAttribute("content", description);
  }

  function routePath() {
    const path = location.pathname.replace(/\/+$/, "");
    return path || "/";
  }

  function showPage(id) {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    document.querySelector(`#${id}`)?.classList.add("active");
    const path = routePath();
    document.querySelectorAll("[data-route].tab").forEach((link) => {
      const href = link.getAttribute("href");
      const active = href === "/"
        ? path === "/"
        : path === href || path.startsWith(`${href}/`);
      link.classList.toggle("active", active);
    });
    scrollTo({ top: 0, behavior: "instant" });
  }

  function articleCard(article) {
    return `
      <article class="weekly-card">
        <div class="weekly-card-meta"><span>Week ${article.weekNumber}</span><span>${escapeHtml(formatDate(article.publishedDate))}</span></div>
        <p class="topic-label">${escapeHtml(article.category)}</p>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.excerpt)}</p>
        <div class="card-footer"><span>${escapeHtml(article.readingTime)}</span><a data-route href="/run-weekly/${encodeURIComponent(article.slug)}">Read article →</a></div>
      </article>`;
  }

  function archiveMarkup(articles) {
    if (!articles.length) return `<p class="empty-state compact">No published articles match this filter.</p>`;
    const activeTopic = new URLSearchParams(location.search).get("topic");
    const archiveHref = (year, month) => {
      const params = new URLSearchParams({ year });
      if (month) params.set("month", month.toLowerCase());
      if (activeTopic) params.set("topic", activeTopic);
      return `/run-weekly?${params}`;
    };
    const years = articles.reduce((result, article) => {
      result[article.year] ||= {};
      result[article.year][article.month] ||= [];
      result[article.year][article.month].push(article);
      return result;
    }, {});
    return Object.entries(years).sort(([a], [b]) => Number(b) - Number(a)).map(([year, months]) => `
      <section class="archive-year">
        <h3><a data-route href="${archiveHref(year)}">${year}</a></h3>
        ${Object.entries(months).map(([month, monthArticles]) => `
          <div class="archive-month">
            <h4><a data-route href="${archiveHref(year, month)}">${escapeHtml(month)}</a></h4>
            ${monthArticles.map((article) => `<a data-route href="/run-weekly/${encodeURIComponent(article.slug)}"><span>Week ${article.weekNumber}</span><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(article.readingTime)}</small></a>`).join("")}
          </div>`).join("")}
      </section>`).join("");
  }

  function renderRunWeekly() {
    const today = new Date().toISOString().slice(0, 10);
    const published = content.weekly.articles
      .filter((article) => article.status === "published" && article.publishedDate <= today)
      .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
    const latest = published.find((article) => article.featured) || published[0];
    const params = new URLSearchParams(location.search);
    const topic = params.get("topic")?.toUpperCase();
    const year = Number(params.get("year")) || null;
    const month = params.get("month")?.toUpperCase();
    const filtered = published.filter((article) => (!topic || article.category === topic) && (!year || article.year === year) && (!month || article.month === month));
    const topicLinks = content.weekly.topics.map((item) => `<a data-route class="filter-chip ${topic === item ? "active" : ""}" href="/run-weekly?topic=${encodeURIComponent(item)}">${escapeHtml(item)}</a>`).join("");
    document.querySelector("#run-weekly-content").innerHTML = `
      <header class="editorial-header">
        <p class="eyebrow">Danz Run Weekly</p>
        <h1>Run Weekly</h1>
        <p>One thing each week to help you run better.</p>
      </header>
      ${latest ? `<article class="latest-article">
        <div class="latest-number">W${latest.weekNumber}</div>
        <div>
          <p class="issue-line">Week ${latest.weekNumber} • ${escapeHtml(formatDate(latest.publishedDate))}</p>
          <p class="topic-label">${escapeHtml(latest.category)}</p>
          <h2>${escapeHtml(latest.title)}</h2>
          <p>${escapeHtml(latest.excerpt)}</p>
          <a class="arrow-link" data-route href="/run-weekly/${encodeURIComponent(latest.slug)}">Read this week's article →</a>
        </div>
      </article>` : `<p class="empty-state">The first Run Weekly article is being prepared.</p>`}
      <section class="weekly-section">
        <div class="section-kicker"><div><p class="eyebrow">RECENT ARTICLES</p><h2>Keep learning.</h2></div><p>Short, practical lessons for the next run.</p></div>
        <div class="weekly-grid">${published.slice(1, 4).map(articleCard).join("") || `<p class="empty-state compact">More weekly articles will appear here.</p>`}</div>
      </section>
      <section class="weekly-section archive-section">
        <div class="section-kicker"><div><p class="eyebrow">ARCHIVE</p><h2>Find a useful idea.</h2></div>${topic || year || month ? `<a data-route class="clear-filter" href="/run-weekly">Clear filters</a>` : ""}</div>
        <div class="topic-filters"><a data-route class="filter-chip ${!topic ? "active" : ""}" href="/run-weekly">ALL</a>${topicLinks}</div>
        ${archiveMarkup(filtered)}
      </section>
      <aside class="building-link-card">
        <div><p class="eyebrow">Building Danz</p><h2>Follow the development of our running pacer.</h2></div>
        <a class="arrow-link" data-route href="/building-danz">View the build →</a>
      </aside>
      <section class="newsletter-card">
        <div><p class="eyebrow">GET RUN WEEKLY</p><h2>One useful running idea. Once a week.</h2></div>
        <form id="newsletter-form"><label>Email address<input type="email" required placeholder="runner@example.com" /></label><button type="submit">Subscribe →</button></form>
        <p id="newsletter-message" role="status">${content.site.newsletter.status === "configured" ? "" : "Newsletter delivery is not yet connected."}</p>
      </section>`;
    document.querySelector("#newsletter-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#newsletter-message");
      const newsletter = content.site.newsletter;
      if (newsletter.status !== "configured" || !newsletter.endpoint) {
        message.textContent = "Subscriptions are not open yet. No email was submitted.";
        return;
      }
      message.textContent = "Subscribing…";
      try {
        const response = await fetch(newsletter.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: event.currentTarget.querySelector('input[type="email"]').value }),
        });
        if (!response.ok) throw new Error("Subscription failed");
        event.currentTarget.reset();
        message.textContent = "You're subscribed to Run Weekly.";
      } catch {
        message.textContent = "Subscription could not be completed. Please try again later.";
      }
    });
    setMeta("Run Weekly | Danz", "One practical running lesson each week from Danz Run Lab.");
    showPage("run-weekly-page");
  }

  function renderArticle(slug) {
    const today = new Date().toISOString().slice(0, 10);
    const article = content.weekly.articles.find((item) => item.slug === slug && item.status === "published" && item.publishedDate <= today);
    if (!article) return renderNotFound();
    const hero = article.heroImage
      ? `<img class="article-hero-image" src="${escapeHtml(article.heroImage)}" alt="" />`
      : `<div class="article-hero-type"><span>W${article.weekNumber}</span><strong>${escapeHtml(article.category)}</strong></div>`;
    document.querySelector("#article-content").innerHTML = `
      <article class="article-layout">
        <a class="back-link" data-route href="/run-weekly">← Run Weekly</a>
        <header class="article-header">
          <p class="eyebrow">Danz Run Weekly</p>
          <p class="issue-line">Week ${article.weekNumber} • ${escapeHtml(formatDate(article.publishedDate))}</p>
          <h1>${escapeHtml(article.title)}</h1>
          <p class="article-deck">${escapeHtml(article.excerpt)}</p>
          <div class="article-byline"><span>${escapeHtml(article.category)}</span><span>${escapeHtml(article.readingTime)}</span><span>By ${escapeHtml(article.author)}</span></div>
        </header>
        ${hero}
        <div class="article-body">
          ${article.body.map((section) => `<section><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("")}
          ${article.quickTakeaway ? `<aside class="quick-takeaway"><p class="eyebrow">QUICK TAKEAWAY</p><p>${escapeHtml(article.quickTakeaway)}</p></aside>` : ""}
        </div>
      </article>`;
    setMeta(article.seoTitle, article.seoDescription);
    showPage("article-page");
  }

  function renderBuildingDanz() {
    const data = content.building;
    const updates = [...data.updates].sort((a, b) => b.date.localeCompare(a.date));
    document.querySelector("#building-danz-content").innerHTML = `
      <header class="build-hero">
        <p class="eyebrow">Building Danz</p>
        <h1>Building the Danz Pacer</h1>
        <p>${escapeHtml(data.summary)}</p>
        <small>This page documents what we are testing, what we learn and what changes. It does not claim the idea is proven.</small>
      </header>
      <section class="build-problem two-column-copy">
        <div><p class="eyebrow">WHY WE'RE BUILDING IT</p><h2>A watch shows pace. Holding it is still difficult.</h2></div>
        <div><p>Runners can already see pace on a watch. Yet many still start too quickly, slow without noticing, repeatedly check a fluctuating GPS number or struggle to settle into the target for a tempo or interval session.</p><p>Danz is exploring whether a physical adaptive pacer could offer another way to train. Not every runner will need one, and we are not claiming a robot is proven to make people faster. We are testing the idea and learning from runners.</p></div>
      </section>
      <section class="robot-vision">
        <div class="section-kicker"><div><p class="eyebrow">THE VISION</p><h2>A compact outdoor running pacer.</h2></div><p>Direction, not a list of finished features.</p></div>
        <div class="vision-grid">
          <div><h3>Pacing</h3><p>Selected pace, predefined routes and programmed changes for tempo sessions, intervals and progressive runs.</p></div>
          <div><h3>Safety</h3><p>Obstacle detection, controlled slowing and stopping, with approximately 60 minutes or more of useful running time as a design goal.</p></div>
          <div><h3>Session data</h3><p>A broad running pace range and recorded session information for understanding how a workout was executed.</p></div>
          <div><h3>Future view</h3><p>A runner-facing camera, post-run video and overlays for pace, distance, splits, heart rate, cadence, power and other available metrics.</p></div>
        </div>
      </section>
      <section class="milestone-section">
        <div class="section-kicker"><div><p class="eyebrow">DEVELOPMENT STAGES</p><h2>From question to pilot.</h2></div><p>Nothing is marked complete without evidence.</p></div>
        <ol class="milestone-track">${data.stages.map((stage) => `<li class="${stage.status.toLowerCase().replaceAll(" ", "-")}"><span></span><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.status)}</small></li>`).join("")}</ol>
      </section>
      <section class="build-log">
        <div class="section-kicker"><div><p class="eyebrow">BUILD LOG</p><h2>The work, in order.</h2></div><p>Photos, video and longer notes can be attached to each update.</p></div>
        ${updates.length ? updates.map(buildUpdate).join("") : `<div class="empty-state">No development updates have been published yet. We will add the first entry when there is real progress to document.</div>`}
      </section>`;
    setMeta("Building the Danz Pacer | Danz", "Follow the honest development story of the Danz outdoor running pacer.");
    showPage("building-danz-page");
  }

  function buildUpdate(update) {
    const images = (update.images || []).map((image) => `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" />`).join("");
    const video = update.video ? `<video controls src="${escapeHtml(update.video)}"></video>` : "";
    return `<article class="build-update"><p class="issue-line">Week ${update.weekNumber} • ${update.year} • ${escapeHtml(formatDate(update.date))}</p><span class="status-chip">${escapeHtml(update.status)}</span><h3>${escapeHtml(update.title)}</h3><p>${escapeHtml(update.summary)}</p>${images || video ? `<div class="build-media">${images}${video}</div>` : ""}${update.articleUrl ? `<a class="arrow-link" data-route href="${escapeHtml(update.articleUrl)}">Read the longer update →</a>` : ""}</article>`;
  }

  function renderShop() {
    const products = content.products.products.filter((product) => product.status === "published");
    document.querySelector("#shop-content").innerHTML = `
      <header class="editorial-header"><p class="eyebrow">Danz Shop</p><h1>Run in Danz.</h1><p>Original Danz merchandise, using the approved designs exactly as created.</p></header>
      ${products.length ? `<div class="product-grid">${products.map((product) => `<a class="product-card" data-route href="/shop/${encodeURIComponent(product.slug)}"><img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}" /><p>${escapeHtml(product.category)}</p><h2>${escapeHtml(product.name)}</h2><span>${escapeHtml(product.priceDisplay)}</span></a>`).join("")}</div>` : `<div class="empty-state shop-empty"><strong>No products are published yet.</strong><p>Approved Danz merchandise will appear here when its product record is published.</p></div>`}`;
    setMeta("Shop | Danz", "Shop approved Danz running merchandise designs.");
    showPage("shop-page");
  }

  function renderProduct(slug) {
    const product = content.products.products.find((item) => item.slug === slug && item.status === "published");
    if (!product) return renderNotFound();
    document.querySelector("#product-content").innerHTML = `<a class="back-link" data-route href="/shop">← Shop</a><article class="product-detail"><div class="product-gallery">${product.images.map((image) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />`).join("")}</div><div><p class="eyebrow">${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p><strong>${escapeHtml(product.priceDisplay)}</strong></div></article>`;
    setMeta(`${product.name} | Danz Shop`, product.description);
    showPage("product-page");
  }

  function renderRunSpots() {
    const spots = content.spots.spots.filter((spot) => spot.status === "published");
    document.querySelector("#run-spots-content").innerHTML = `<header class="editorial-header"><p class="eyebrow">RUN SPOTS</p><h1>Good places to run.</h1><p>Practical local notes for routes worth knowing.</p></header>${spots.length ? `<div class="spot-grid">${spots.map((spot) => `<a class="spot-card" data-route href="/run-spots/${encodeURIComponent(spot.slug)}"><p>${escapeHtml(spot.location)}</p><h2>${escapeHtml(spot.name)}</h2><span>${escapeHtml(spot.distanceSummary)}</span></a>`).join("")}</div>` : `<div class="empty-state"><strong>Run Spots are coming.</strong><p>No locations have been published yet. We will only add spots after their details are verified.</p></div>`}`;
    setMeta("Run Spots | Danz", "Verified places and routes for runners.");
    showPage("run-spots-page");
  }

  function renderRunSpot(slug) {
    const spot = content.spots.spots.find((item) => item.slug === slug && item.status === "published");
    if (!spot) return renderNotFound();
    document.querySelector("#run-spot-content").innerHTML = `<a class="back-link" data-route href="/run-spots">← Run Spots</a><article class="spot-detail"><p class="eyebrow">${escapeHtml(spot.location)}</p><h1>${escapeHtml(spot.name)}</h1><p>${escapeHtml(spot.description)}</p></article>`;
    setMeta(`${spot.name} | Danz Run Spots`, spot.description);
    showPage("run-spot-page");
  }

  function renderNotFound() {
    document.querySelector("#not-found-content").innerHTML = `<div class="not-found"><p class="eyebrow">404</p><h1>That route ran away.</h1><p>Return to the pace planner and start again.</p><a class="arrow-link" data-route href="/">Plan a run →</a></div>`;
    setMeta("Page not found | Danz");
    showPage("not-found-page");
  }

  async function loadContent() {
    const entries = await Promise.all([
      ["weekly", "content/run-weekly.json"],
      ["building", "content/building-danz.json"],
      ["products", "content/products.json"],
      ["spots", "content/run-spots.json"],
      ["site", "content/site.json"],
    ].map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ${url}`);
      return [key, await response.json()];
    }));
    entries.forEach(([key, value]) => { content[key] = value; });
  }

  async function renderCurrentRoute() {
    await contentReady;
    if (contentError) {
      setMeta("Content unavailable | Danz");
      return showPage("not-found-page");
    }
    const path = routePath();
    if (path === "/") {
      setMeta("Danz Run Lab", defaultDescription);
      return showPage("plan");
    }
    if (path === "/run-weekly") return renderRunWeekly();
    if (path.startsWith("/run-weekly/")) return renderArticle(decodeURIComponent(path.split("/").pop()));
    if (path === "/building-danz") return renderBuildingDanz();
    if (path === "/shop") return renderShop();
    if (path.startsWith("/shop/")) return renderProduct(decodeURIComponent(path.split("/").pop()));
    if (path === "/run-spots") return renderRunSpots();
    if (path.startsWith("/run-spots/")) return renderRunSpot(decodeURIComponent(path.split("/").pop()));
    if (path === "/admin" && adminAccess) return showPage("sessions");
    return renderNotFound();
  }

  function navigate(path) {
    history.pushState({}, "", path);
    renderCurrentRoute();
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-route]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  });
  addEventListener("popstate", renderCurrentRoute);

  contentReady = loadContent().catch((error) => {
    contentError = true;
    console.error(error);
    document.querySelector("#not-found-content").innerHTML = `<div class="empty-state">Site content could not be loaded. Please try again online.</div>`;
  });

  window.DanzSite = {
    navigate,
    renderCurrentRoute,
    showPage,
    setAdminAccess(value) {
      adminAccess = value;
      if (!value && routePath() === "/admin") navigate("/");
      else if (value && routePath() === "/admin") renderCurrentRoute();
    },
  };
  renderCurrentRoute();
})();
