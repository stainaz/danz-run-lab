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
  const galleryStore = new Map();
  const newsletterDialog = document.querySelector("#newsletter-dialog");
  const lightbox = document.querySelector("#image-lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const lightboxViewport = document.querySelector("#lightbox-viewport");
  let lightboxImages = [];
  let lightboxIndex = 0;
  let lightboxZoom = 1;
  let swipeStart = null;

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

  function normalizeImages(images, fallbackAlt) {
    return (images || []).map((image, index) => typeof image === "string"
      ? { src: image, label: index ? `View ${index + 1}` : "Front + back", alt: fallbackAlt }
      : {
        src: image.src,
        label: image.label || `View ${index + 1}`,
        alt: image.alt || fallbackAlt,
      });
  }

  function registerGallery(key, images, fallbackAlt) {
    const normalized = normalizeImages(images, fallbackAlt);
    galleryStore.set(key, normalized);
    return normalized;
  }

  function updateModalScrollLock() {
    requestAnimationFrame(() => {
      document.body.classList.toggle("modal-open", Boolean(document.querySelector("dialog[open]")));
    });
  }

  function renderLightbox() {
    const image = lightboxImages[lightboxIndex];
    if (!image) return;
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxImage.style.transform = `scale(${lightboxZoom})`;
    lightboxViewport.classList.toggle("zoomed", lightboxZoom > 1);
    document.querySelector("#lightbox-label").textContent = image.label;
    document.querySelector("#lightbox-counter").textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    document.querySelector("#lightbox-zoom-value").textContent = `${Math.round(lightboxZoom * 100)}%`;
    document.querySelectorAll("[data-lightbox-previous], [data-lightbox-next]").forEach((button) => {
      button.classList.toggle("hidden", lightboxImages.length < 2);
    });
    const thumbnails = document.querySelector("#lightbox-thumbnails");
    thumbnails.innerHTML = lightboxImages.length > 1
      ? lightboxImages.map((item, index) => `<button type="button" class="${index === lightboxIndex ? "active" : ""}" data-lightbox-thumbnail="${index}" aria-label="View ${escapeHtml(item.label)}"><img src="${escapeHtml(item.src)}" alt="" /><span>${escapeHtml(item.label)}</span></button>`).join("")
      : "";
    const activeThumbnail = thumbnails.querySelector(".active");
    if (activeThumbnail) {
      const centeredLeft = activeThumbnail.offsetLeft - thumbnails.offsetLeft - ((thumbnails.clientWidth - activeThumbnail.offsetWidth) / 2);
      thumbnails.scrollLeft = Math.max(0, centeredLeft);
    }
  }

  function openLightbox(key, index = 0) {
    const images = galleryStore.get(key);
    if (!images?.length) return;
    lightboxImages = images;
    lightboxIndex = Math.max(0, Math.min(Number(index) || 0, images.length - 1));
    lightboxZoom = 1;
    renderLightbox();
    lightbox.showModal();
    document.body.classList.add("modal-open");
    lightbox.querySelector("[data-lightbox-close]").focus();
  }

  function moveLightbox(direction) {
    if (lightboxImages.length < 2) return;
    lightboxIndex = (lightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
    lightboxZoom = 1;
    renderLightbox();
  }

  function setLightboxZoom(value) {
    lightboxZoom = Math.max(1, Math.min(3, value));
    renderLightbox();
  }

  function galleryMarkup(key, images) {
    if (!images.length) return "";
    const main = images[0];
    return `<div class="product-gallery" data-product-gallery="${escapeHtml(key)}">
      <button class="product-main-image" type="button" data-open-gallery="${escapeHtml(key)}" data-gallery-index="0" aria-label="Open ${escapeHtml(main.label)} image">
        <img data-product-main-image src="${escapeHtml(main.src)}" alt="${escapeHtml(main.alt)}" />
        <span class="image-action">View / zoom ↗</span>
      </button>
      ${images.length > 1 ? `<div class="product-thumbnails">${images.map((image, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-product-thumbnail="${index}" aria-label="Show ${escapeHtml(image.label)}"><img src="${escapeHtml(image.src)}" alt="" /><span>${escapeHtml(image.label)}</span></button>`).join("")}</div>` : ""}
    </div>`;
  }

  async function submitNewsletter(form) {
    const input = form.querySelector('input[name="email"]');
    const message = form.querySelector("[data-newsletter-message]");
    const button = form.querySelector('button[type="submit"]');
    if (!input.validity.valid) {
      message.textContent = "Enter a valid email address.";
      input.focus();
      return;
    }
    const endpoint = content.site.newsletter.endpoint;
    if (!endpoint) {
      message.textContent = "Run Weekly subscriptions are not live yet.";
      return;
    }
    button.disabled = true;
    button.dataset.label ||= button.textContent;
    button.textContent = "Subscribing…";
    message.textContent = "Adding you to Run Weekly…";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input.value.trim(),
          website: form.querySelector('input[name="website"]')?.value || "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "We couldn't add you right now. Please try again shortly.");
      message.textContent = "You're in. Run Weekly will land in your inbox.";
      input.disabled = true;
      button.textContent = "Subscribed ✓";
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = button.dataset.label;
    }
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
        <div class="editorial-header-action"><p>One thing each week to help you run better.</p><button type="button" class="outline-button" data-open-newsletter>Get Run Weekly</button></div>
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
        <form class="newsletter-form" novalidate><label>Email address<input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="runner@example.com" /></label><label class="newsletter-honeypot" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off" /></label><button type="submit">Subscribe →</button><p class="newsletter-message" data-newsletter-message role="status">${content.site.newsletter.status === "configured" ? "" : "MailerLite is ready to connect; subscriptions are not live yet."}</p></form>
      </section>`;
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
    const cards = products.map((product) => {
      const key = `product:${product.slug}`;
      const images = registerGallery(key, product.images, product.name);
      const image = images[0];
      return `<article class="product-card">
        <button class="product-card-image" type="button" data-open-gallery="${escapeHtml(key)}" data-gallery-index="0" aria-label="Open image of ${escapeHtml(product.name)}">
          <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" />
          <span class="image-action">View ↗</span>
        </button>
        <a data-route href="/shop/${encodeURIComponent(product.slug)}"><p>${escapeHtml(product.category)}</p><h2>${escapeHtml(product.name)}</h2><span>${escapeHtml(product.priceDisplay)}</span></a>
      </article>`;
    }).join("");
    document.querySelector("#shop-content").innerHTML = `
      <header class="editorial-header"><p class="eyebrow">Danz Shop</p><h1>Run in Danz.</h1><p>Original Danz merchandise, using the approved designs exactly as created.</p></header>
      ${products.length ? `<div class="product-grid">${cards}</div>` : `<div class="empty-state shop-empty"><strong>No products are published yet.</strong><p>Approved Danz merchandise will appear here when its product record is published.</p></div>`}`;
    setMeta("Shop | Danz", "Shop approved Danz running merchandise designs.");
    showPage("shop-page");
  }

  function renderProduct(slug) {
    const product = content.products.products.find((item) => item.slug === slug && item.status === "published");
    if (!product) return renderNotFound();
    const key = `product:${product.slug}`;
    const images = registerGallery(key, product.images, product.name);
    const features = product.features?.length
      ? `<section class="product-features"><p class="eyebrow">KEY FEATURES</p><ul>${product.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul></section>`
      : "";
    document.querySelector("#product-content").innerHTML = `<a class="back-link" data-route href="/shop">← Shop</a><article class="product-detail">${galleryMarkup(key, images)}<div class="product-copy"><p class="eyebrow">${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p><strong>${escapeHtml(product.priceDisplay)}</strong>${features}</div></article>`;
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
    const key = `spot:${spot.slug}`;
    const images = registerGallery(key, spot.images || [], spot.name);
    document.querySelector("#run-spot-content").innerHTML = `<a class="back-link" data-route href="/run-spots">← Run Spots</a><article class="spot-detail"><p class="eyebrow">${escapeHtml(spot.location)}</p><h1>${escapeHtml(spot.name)}</h1><p>${escapeHtml(spot.description)}</p>${images.length ? galleryMarkup(key, images) : ""}</article>`;
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

  document.addEventListener("click", (event) => {
    const newsletterButton = event.target.closest("[data-open-newsletter]");
    if (newsletterButton) {
      newsletterDialog.showModal();
      document.body.classList.add("modal-open");
      newsletterDialog.querySelector('input[name="email"]').focus();
      return;
    }
    if (event.target.closest("[data-close-newsletter]")) {
      newsletterDialog.close();
      return;
    }

    const productThumbnail = event.target.closest("[data-product-thumbnail]");
    if (productThumbnail) {
      const gallery = productThumbnail.closest("[data-product-gallery]");
      const key = gallery.dataset.productGallery;
      const images = galleryStore.get(key);
      const index = Number(productThumbnail.dataset.productThumbnail);
      const image = images?.[index];
      if (!image) return;
      const mainButton = gallery.querySelector("[data-open-gallery]");
      const mainImage = gallery.querySelector("[data-product-main-image]");
      mainButton.dataset.galleryIndex = index;
      mainButton.setAttribute("aria-label", `Open ${image.label} image`);
      mainImage.src = image.src;
      mainImage.alt = image.alt;
      gallery.querySelectorAll("[data-product-thumbnail]").forEach((button) => button.classList.toggle("active", button === productThumbnail));
      return;
    }

    const galleryButton = event.target.closest("[data-open-gallery]");
    if (galleryButton) {
      openLightbox(galleryButton.dataset.openGallery, galleryButton.dataset.galleryIndex);
      return;
    }
    if (event.target.closest("[data-lightbox-close]")) return lightbox.close();
    if (event.target.closest("[data-lightbox-previous]")) return moveLightbox(-1);
    if (event.target.closest("[data-lightbox-next]")) return moveLightbox(1);
    if (event.target.closest("[data-lightbox-zoom-out]")) return setLightboxZoom(lightboxZoom - 0.5);
    if (event.target.closest("[data-lightbox-zoom-in]")) return setLightboxZoom(lightboxZoom + 0.5);
    const lightboxThumbnail = event.target.closest("[data-lightbox-thumbnail]");
    if (lightboxThumbnail) {
      lightboxIndex = Number(lightboxThumbnail.dataset.lightboxThumbnail);
      lightboxZoom = 1;
      renderLightbox();
    }
  });

  document.addEventListener("submit", (event) => {
    if (!event.target.matches(".newsletter-form")) return;
    event.preventDefault();
    submitNewsletter(event.target);
  });

  [newsletterDialog, lightbox].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", updateModalScrollLock);
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.open) return;
    if (event.key === "ArrowLeft") moveLightbox(-1);
    if (event.key === "ArrowRight") moveLightbox(1);
    if (event.key === "+" || event.key === "=") setLightboxZoom(lightboxZoom + 0.5);
    if (event.key === "-") setLightboxZoom(lightboxZoom - 0.5);
  });

  lightboxImage.addEventListener("dblclick", () => setLightboxZoom(lightboxZoom === 1 ? 2 : 1));
  lightboxViewport.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    swipeStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  lightboxViewport.addEventListener("touchend", (event) => {
    if (!swipeStart) return;
    if (lightboxZoom > 1) {
      swipeStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) moveLightbox(deltaX < 0 ? 1 : -1);
  }, { passive: true });
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
