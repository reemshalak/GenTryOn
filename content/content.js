// TryOnMate - Content Script (FIXED)
(function () {
  "use strict";

  const BLOCKED_DOMAINS = [
    "google.", "bing.com", "yahoo.com", "duckduckgo.com",
    "youtube.com", "reddit.com", "twitter.com", "x.com",
    "facebook.com", "instagram.com", "tiktok.com", "linkedin.com",
    "wikipedia.org", "github.com", "stackoverflow.com",
    "gmail.com", "mail.google.com", "docs.google.com",
    "notion.so", "slack.com", "discord.com",
  ];

  function isBlockedDomain() {
    return BLOCKED_DOMAINS.some(d => location.hostname.includes(d));
  }

  function isProductPage() {
    const ogType = document.querySelector('meta[property="og:type"]')?.content || "";
    if (ogType === "product") return true;
    if (document.querySelector('[itemtype*="schema.org/Product"]')) return true;
    if (/\/(product|products|item|items|prd|pd|dp|p)\//.test(location.pathname)) return true;
    if (document.querySelector('[class*="add-to-cart"],[class*="add-to-bag"]')) return true;
    return false;
  }

  const SITE_ADAPTERS = [
    {
      name: "ASOS",
      match: () => location.hostname.includes("asos.com"),
      getProductInfo: () => ({
        name: document.querySelector('[data-testid="product-title"]')?.innerText || document.querySelector("h1")?.innerText,
        imageUrl: document.querySelector('[data-testid="hero-image"] img')?.src || document.querySelector("meta[property='og:image']")?.content
      }),
      injectTarget: () => document.querySelector('[data-testid="add-button"]') || document.querySelector('[data-auto-id="add-button"]')
    },
    {
      name: "Generic",
      match: () => !isBlockedDomain() && isProductPage(),
      getProductInfo: () => ({
        name: document.querySelector('meta[property="og:title"]')?.content || document.querySelector("h1")?.innerText,
        imageUrl: document.querySelector('meta[property="og:image"]')?.content || document.querySelector("[class*='product'] img")?.src
      }),
      injectTarget: () => document.querySelector('[class*="add-to-cart"]') || document.querySelector('[id*="add-to-cart"]')
    },
  ];

  let injected = false;
  let modalOpen = false;
  let currentJobId = null;
  let pollInterval = null;
  let generationDone = false;
  let lastResult = null;

  function init() {
    const observer = new MutationObserver(() => { if (!injected) tryInject(); });
    observer.observe(document.body, { childList: true, subtree: true });
    tryInject();
  }

  function tryInject() {
    const adapter = SITE_ADAPTERS.find((a) => a.match());
    const target = adapter?.injectTarget();
    if (!target || injected) return;
    injected = true;
    injectButton(target, adapter);
    injectModal();
  }

  function injectModal() {
    const modal = document.createElement("div");
    modal.id = "tryonmate-modal";
    modal.innerHTML = `
      <div class="tom-backdrop"></div>
      <div class="tom-panel">
        <button class="tom-close">✕</button>
        <div class="tom-state" id="tom-idle">
          <div class="tom-logo">✦ TryOnMate</div>
          <div class="tom-product-preview" id="tom-product-preview"></div>
          <button class="tom-generate-btn" id="tom-generate-btn">Generate Look</button>
        </div>
        <div class="tom-state" id="tom-loading" style="display:none">
          <div class="tom-spinner"><div class="tom-spinner-ring"></div></div>
          <p class="tom-loading-text">Dressing your avatar...</p>
        </div>
        <div class="tom-state" id="tom-result" style="display:none">
          <img id="tom-result-img" />
          <div class="tom-result-actions">
            <button class="tom-btn-secondary" id="tom-retry-btn">Try Again</button>
            <button class="tom-btn-primary" id="tom-save-btn">Save Look</button>
          </div>
        </div>
        <div class="tom-state" id="tom-error" style="display:none">
          <p id="tom-error-msg">Something went wrong</p>
          <button class="tom-btn-secondary" id="tom-error-retry">Try Again</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    bindModalEvents();
  }

  function bindModalEvents() {
    document.querySelector(".tom-backdrop")?.addEventListener("click", closeModal);
    document.querySelector(".tom-close")?.addEventListener("click", closeModal);
    document.getElementById("tom-generate-btn")?.addEventListener("click", startGeneration);
    document.getElementById("tom-retry-btn")?.addEventListener("click", () => showState("idle"));
    document.getElementById("tom-error-retry")?.addEventListener("click", () => showState("idle"));
    document.getElementById("tom-save-btn")?.addEventListener("click", saveLook);
  }

  async function getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, resolve);
    });
  }

  async function startGeneration() {
    const settings = await getSettings();
    
    // FIX: Use correct property names
    if (!settings.heygenApiKey || !settings.avatarGroupId || !settings.openrouterApiKey || !settings.userPhotoDataUrl) {
      showError("Please complete avatar setup in the extension popup first");
      return;
    }

    const preview = document.getElementById("tom-product-preview");
    const adapter = SITE_ADAPTERS.find(a => a.match());
    const productInfo = adapter?.getProductInfo();
    
    if (!productInfo?.imageUrl) {
      showError("Could not find outfit image on this page");
      return;
    }

    showState("loading");

    try {
      const result = await chrome.runtime.sendMessage({
        type: "GENERATE_TRYON",
        payload: {
          heygenApiKey: settings.heygenApiKey,
          openrouterApiKey: settings.openrouterApiKey,
          avatarGroupId: settings.avatarGroupId,
          userPhotoDataUrl: settings.userPhotoDataUrl,
          outfitImageUrl: productInfo.imageUrl,
          outfitName: productInfo.name || "this outfit",
        },
      });

      if (result.error) throw new Error(result.error);

      currentJobId = result.videoId;
      pollForResult(settings.heygenApiKey);
    } catch (err) {
      showError(err.message);
    }
  }

  function pollForResult(apiKey) {
    let attempts = 0;
    pollInterval = setInterval(async () => {
      attempts++;
      if (attempts >= 60) {
        clearInterval(pollInterval);
        showError("Generation timed out");
        return;
      }
      try {
        const result = await chrome.runtime.sendMessage({
          type: "POLL_VIDEO",
          videoId: currentJobId,
          apiKey: apiKey,
        });
        if (result.status === "completed" && result.videoUrl) {
          clearInterval(pollInterval);
          showResult(result.videoUrl);
        } else if (result.status === "failed") {
          clearInterval(pollInterval);
          showError("Generation failed");
        }
      } catch (e) {}
    }, 3000);
  }

  function showResult(imageUrl) {
    lastResult = { imageUrl };
    generationDone = true;
    const img = document.getElementById("tom-result-img");
    img.src = imageUrl;
    showState("result");
    
    // Auto-save
    const adapter = SITE_ADAPTERS.find(a => a.match());
    const productInfo = adapter?.getProductInfo();
    chrome.runtime.sendMessage({
      type: "SAVE_LOOK",
      look: {
        imageUrl: imageUrl,
        product: productInfo?.name || document.title,
        site: location.hostname,
      }
    });
  }

  function showError(msg) {
    document.getElementById("tom-error-msg").textContent = msg;
    showState("error");
  }

  function showState(state) {
    ["idle", "loading", "result", "error"].forEach(s => {
      const el = document.getElementById(`tom-${s}`);
      if (el) el.style.display = s === state ? "flex" : "none";
    });
  }

  function openModal() {
    const modal = document.getElementById("tryonmate-modal");
    modal.classList.add("open");
    modalOpen = true;
    showState("idle");
  }

  function closeModal() {
    const modal = document.getElementById("tryonmate-modal");
    modal.classList.remove("open");
    modalOpen = false;
  }

  function saveLook() {
    const img = document.getElementById("tom-result-img");
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `tryonmate-${Date.now()}.jpg`;
    a.click();
  }

  function injectButton(target, adapter) {
    const btn = document.createElement("button");
    btn.id = "tryonmate-btn";
    btn.innerHTML = `<span class="tom-icon">✦</span><span class="tom-label">Try On Me</span>`;
    btn.addEventListener("click", async () => {
      if (generationDone && lastResult) {
        document.getElementById("tom-result-img").src = lastResult.imageUrl;
        showState("result");
        openModal();
      } else if (currentJobId && !generationDone) {
        showState("loading");
        openModal();
      } else {
        const settings = await getSettings();
        if (!settings.heygenApiKey || !settings.avatarGroupId) {
          showError("Please setup avatar in extension popup first");
          return;
        }
        const productInfo = adapter.getProductInfo();
        document.getElementById("tom-product-preview").innerHTML = `
          <div class="tom-product-card">
            <img class="tom-product-img" src="${productInfo.imageUrl}" />
            <div class="tom-product-name">${productInfo.name || "This item"}</div>
          </div>
        `;
        openModal();
      }
    });
    target.parentNode.insertBefore(btn, target.nextSibling);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();