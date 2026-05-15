// TryOnMate — Popup JS

const API = "https://api.heygen.com";

let pendingPhotos = [];
let currentLookId = null;

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const { heygenApiKey, avatarGroupId } = await store.get(["heygenApiKey", "avatarGroupId"]);

  if (avatarGroupId && heygenApiKey) {
    showScreen("home");
    loadHome();
  } else if (heygenApiKey) {
    showScreen("upload");
  } else {
    showScreen("apikey");
  }

  bindAll();
});

// ── Navigation ─────────────────────────────────────────────────────────────

function showScreen(name) {
  ["apikey", "upload", "training", "home"].forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.style.display = s === name ? "block" : "none";
  });
}

function showOverlay(name) {
  const el = document.getElementById(`overlay-${name}`);
  if (el) { el.style.display = "flex"; el.style.flexDirection = "column"; }
}

function hideOverlay(name) {
  const el = document.getElementById(`overlay-${name}`);
  if (el) el.style.display = "none";
}

// ── Bind all events ────────────────────────────────────────────────────────

function bindAll() {
  // API key screen — HeyGen key
  bindToggle("apikey-toggle", "apikey-input");
  // API key screen — OpenRouter key
  bindToggle("orkey-toggle", "orkey-input");
  bind("apikey-next", "click", onApiKeyNext);
  bind("apikey-input", "keydown", e => { if (e.key === "Enter") onApiKeyNext(); });

  // Upload screen
  bind("upload-zone", "click", () => document.getElementById("photo-input").click());
  bind("photo-input", "change", onPhotosSelected);
  bind("upload-next", "click", onStartTraining);
  bind("upload-back", "click", () => showScreen("apikey"));

  // Training done
  bind("training-finish", "click", () => { showScreen("home"); loadHome(); });

  // Home tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Settings
  bind("reset-btn", "click", onReset);

  // Look detail overlay
  bind("detail-close", "click", () => hideOverlay("detail"));
  bind("detail-copy", "click", copyDetailLink);
  bind("detail-download", "click", downloadDetailImage);
  bind("detail-delete", "click", deleteCurrentLook);

  // Drag-and-drop
  const zone = document.getElementById("upload-zone");
  if (zone) {
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.style.borderColor = "#c9a96e"; });
    zone.addEventListener("dragleave", () => { zone.style.borderColor = ""; });
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.style.borderColor = "";
      handleFiles([...e.dataTransfer.files]);
    });
  }
}

function bind(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

function bindToggle(btnId, inputId) {
  let visible = false;
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    visible = !visible;
    input.type = visible ? "text" : "password";
    btn.textContent = visible ? "🙈" : "👁";
  });
}

// ── API key screen ─────────────────────────────────────────────────────────

async function onApiKeyNext() {
  const heygenKey = document.getElementById("apikey-input").value.trim();
  const orKey = document.getElementById("orkey-input")?.value.trim() || "";
  const errEl = document.getElementById("apikey-err");
  errEl.textContent = "";

  if (!heygenKey) { errEl.textContent = "Please enter your HeyGen API key."; return; }
  if (!orKey) { errEl.textContent = "Please enter your OpenRouter API key (it's free!)."; return; }

  // Validate HeyGen key
  try {
    const res = await fetch(`${API}/v3/users/me`, {
      headers: { "X-Api-Key": heygenKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await store.set({ heygenApiKey: heygenKey, openrouterApiKey: orKey });
    showScreen("upload");
  } catch (err) {
    errEl.textContent = `HeyGen key invalid (${err.message}) — double-check and retry.`;
  }
}

// ── Upload screen ──────────────────────────────────────────────────────────

function onPhotosSelected(e) { handleFiles([...e.target.files]); }

function handleFiles(files) {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const validFiles = [];
  
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > MAX_SIZE) {
      showToast(`⚠️ ${file.name} exceeds 5MB and was skipped`, "⚠️");
    } else {
      validFiles.push(file);
    }
  }
  
  const availableSlots = 10 - pendingPhotos.length;
  const filesToAdd = validFiles.slice(0, availableSlots);
  
  if (validFiles.length > availableSlots && availableSlots > 0) {
    showToast(`Only ${availableSlots} more photo(s) allowed (max 10)`, "⚠️");
  }
  
  filesToAdd.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      pendingPhotos.push({ file, dataUrl: e.target.result });
      renderThumbs();
    };
    reader.readAsDataURL(file);
  });
}

function renderThumbs() {
  const grid = document.getElementById("thumb-grid");
  grid.innerHTML = "";
  pendingPhotos.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `<img src="${p.dataUrl}" alt="Photo ${i + 1}" /><button class="thumb-remove" data-index="${i}">✕</button>`;
    div.querySelector(".thumb-remove").addEventListener("click", e => {
      e.stopPropagation();
      pendingPhotos.splice(+e.target.dataset.index, 1);
      renderThumbs();
    });
    grid.appendChild(div);
  });
  updateCountBadge();
}

function updateCountBadge() {
  const n = pendingPhotos.length;
  const row = document.getElementById("count-row");
  const badge = document.getElementById("count-badge");
  const hint = document.getElementById("count-hint");
  const btn = document.getElementById("upload-next");

  if (!row || !badge || !hint || !btn) return;

  row.style.display = n > 0 ? "flex" : "none";
  badge.textContent = `${n} photo${n !== 1 ? "s" : ""}`;

  if (n < 5) {
    badge.className = "count-badge";
    hint.textContent = `Need ${5 - n} more photo${(5 - n) !== 1 ? "s" : ""} (minimum 5 required)`;
    btn.disabled = true;
  } else if (n >= 5 && n < 10) {
    badge.className = "count-badge enough";
    const remaining = 10 - n;
    hint.textContent = remaining === 0 ? "Perfect! Ready to train ✓" : `${remaining} more recommended (up to 10) ✨`;
    btn.disabled = false;
  } else if (n >= 10) {
    badge.className = "count-badge enough";
    hint.textContent = "Maximum 10 photos reached ✓ Ready to train!";
    btn.disabled = false;
  }
}

// ── Training ───────────────────────────────────────────────────────────────

async function onStartTraining() {
  showScreen("training");
  const { heygenApiKey } = await store.get(["heygenApiKey"]);

  try {
    setTrainingStatus("Creating your avatar…", "Uploading first photo", 10);

    const firstPhoto = pendingPhotos[0];
    
    // ✅ STEP 1: Upload first photo - verify it returns a valid image_key
    const firstImageKey = await uploadImageToHeyGen(heygenApiKey, firstPhoto.file);
    console.log("First image key:", firstImageKey); // Debug - check if this is valid
    if (!firstImageKey) throw new Error("Failed to get image key from upload");

   const avatarName = `TryOnMate Avatar ${Date.now()}`;
 console.log("Creating avatar with payload:", {
  name: avatarName,
  image_key: firstImageKey
});

const createRes = await heygen(
  heygenApiKey,
  "POST",
  "/v2/photo_avatar/avatar_group/create",
  {
    name: avatarName,
    image_key: firstImageKey
  }
);

    const groupId = createRes.data?.group_id || createRes.data?.id;
    if (!groupId) throw new Error("Failed to create avatar group - no group_id returned");
    
    console.log("Group created:", groupId);

    // ✅ STEP 3: Add remaining photos in batches of 4
    const remainingPhotos = pendingPhotos.slice(1);
    for (let i = 0; i < remainingPhotos.length; i += 4) {
      const batch = remainingPhotos.slice(i, i + 4);
      const pct = 10 + Math.round(((i + batch.length) / pendingPhotos.length) * 45);
      setTrainingStatus(`Adding photos ${i + 2} to ${Math.min(i + batch.length + 1, pendingPhotos.length)}…`, "Building your complete avatar", pct);
      
      const imageKeys = [];
      for (const photo of batch) {
        const key = await uploadImageToHeyGen(heygenApiKey, photo.file);
        if (!key) throw new Error(`Failed to upload photo: ${photo.file.name}`);
        imageKeys.push(key);
      }
      
      // ✅ Use correct endpoint: /v2/photo_avatar/avatar_group/add
  await heygen(heygenApiKey, "POST", "/v2/photo_avatar/avatar_group/add", {
  group_id: groupId,
  name: `Batch ${i / 4 + 1}`,
  image_keys: imageKeys
});
    }

    await store.set({
      avatarGroupId: groupId,
      userPhotoDataUrl: pendingPhotos[0].dataUrl,
    });

    setTrainingStatus("Training your avatar…", "HeyGen AI is learning your face (3–5 minutes)", 60);
    await heygen(heygenApiKey, "POST", "/v2/photo_avatar/avatar_group/train", { group_id: groupId });

    await pollTraining(heygenApiKey, groupId);

    setTrainingStatus("Done!", "", 100);
    document.getElementById("training-active").style.display = "none";
    document.getElementById("training-done").style.display = "block";

  } catch (err) {
    console.error("Training error:", err);
    setTrainingStatus("Error: " + err.message, "Please go back and try again", 0);
    const spinner = document.querySelector(".spinner");
    if (spinner) spinner.style.display = "none";
  }
}

// ✅ Upload image to HeyGen asset service
async function uploadImageToHeyGen(apiKey, file) {
  const arrayBuffer = await file.arrayBuffer();

  const res = await fetch("https://upload.heygen.com/v1/asset", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": file.type,
      "Content-Length": file.size.toString(),
      "X-Asset-Name": file.name
    },
    body: arrayBuffer
  });

  const text = await res.text();

  console.log("Raw upload response:", text);

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} - ${text}`);
  }

  const data = JSON.parse(text);

  const imageKey =
    data?.data?.key ||
    data?.data?.image_key ||
    data?.key;

  console.log("Parsed image key:", imageKey);

  if (!imageKey) {
    throw new Error("No image key returned");
  }

  return imageKey;
}

// ✅ Poll training status
async function pollTraining(apiKey, groupId) {
  const maxAttempts = 60; // 5 minutes max (5 seconds * 60)
  
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);
    const pct = 60 + Math.round((i / maxAttempts) * 35);
    setTrainingStatus("Training…", `~${Math.max(1, Math.round((maxAttempts - i) * 5 / 60))} min remaining`, pct);
    
    try {
      const res = await heygen(apiKey, "GET", `/v2/photo_avatar/avatar_group/${groupId}`);
      const status = res.data?.status;
      
      if (status === "completed" || status === "ready" || status === "trained") {
        return;
      }
      if (status === "failed") {
        throw new Error("Training failed — please use clearer photos with good lighting");
      }
    } catch (e) {
      // If group not found yet, keep polling
      if (!e.message.includes("404")) throw e;
    }
  }
  console.warn("Training poll timed out, but avatar may still complete");
}

function setTrainingStatus(title, sub, pct) {
  setEl("training-title", title);
  setEl("training-sub", sub);
  const prog = document.getElementById("training-prog");
  const label = document.getElementById("training-prog-label");
  if (prog) prog.style.width = pct + "%";
  if (label) label.textContent = pct + "%";
}

// ── Home ───────────────────────────────────────────────────────────────────

async function loadHome() {
  const { avatarGroupId, openrouterApiKey } = await store.get(["avatarGroupId", "openrouterApiKey"]);
  setEl("s-avatar-id", avatarGroupId || "—");
  setEl("s-or-key", openrouterApiKey ? "••••" + openrouterApiKey.slice(-4) : "—");
  await renderLooks();
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.style.display = p.id === `tab-${name}` ? "block" : "none";
  });
  if (name === "looks") renderLooks();
}

async function renderLooks() {
  const { looks = [] } = await store.get(["looks"]);
  const empty = document.getElementById("looks-empty");
  const grid = document.getElementById("looks-grid");
  if (looks.length === 0) {
    empty.style.display = "block"; grid.style.display = "none"; return;
  }
  empty.style.display = "none"; grid.style.display = "grid";
  grid.innerHTML = "";
  [...looks].reverse().forEach(look => {
    const card = document.createElement("div");
    card.className = "look-card";
    const imgSrc = look.imageDataUrl || look.imageUrl || "";
    card.innerHTML = `
      <img class="look-thumb" src="${imgSrc}" alt="${look.product || 'Look'}" />
      <div class="look-meta">
        <p class="look-product">${look.product || "Outfit"}</p>
        <p class="look-site">${look.site || ""} · ${timeAgo(look.savedAt)}</p>
        ${look.videoUrl ? '<p class="look-has-video">▶ Video ready</p>' : '<p class="look-pending">⏳ Video generating…</p>'}
      </div>
    `;
    card.addEventListener("click", () => openLookDetail(look));
    grid.appendChild(card);
  });
}

function openLookDetail(look) {
  currentLookId = look.id;
  const img = look.imageDataUrl || look.imageUrl || "";
  document.getElementById("detail-img").src = img;
  document.getElementById("detail-img").dataset.url = img;
  setEl("detail-name", look.product || "Outfit");
  setEl("detail-site", look.site || "");
  document.getElementById("copy-confirm").style.display = "none";
  showOverlay("detail");

  // Show video if ready, otherwise show "video generating"
  const videoBtn = document.getElementById("detail-video");
  if (videoBtn) {
    if (look.videoUrl) {
      videoBtn.style.display = "block";
      videoBtn.onclick = () => window.open(look.videoUrl, "_blank");
    } else {
      videoBtn.style.display = "none";
    }
  }
}

async function copyDetailLink() {
  const url = document.getElementById("detail-img").dataset.url || document.getElementById("detail-img").src;
  try {
    await navigator.clipboard.writeText(url);
    const el = document.getElementById("copy-confirm");
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 2500);
  } catch {}
}

function downloadDetailImage() {
  const url = document.getElementById("detail-img").src;
  const a = document.createElement("a");
  a.href = url; a.download = `tryonmate-${Date.now()}.jpg`; a.click();
}

async function deleteCurrentLook() {
  if (!currentLookId) return;
  const { looks = [] } = await store.get(["looks"]);
  await store.set({ looks: looks.filter(l => l.id !== currentLookId) });
  hideOverlay("detail");
  renderLooks();
}

// ── Reset ──────────────────────────────────────────────────────────────────

async function onReset() {
  if (!confirm("This removes your avatar and all saved looks. Continue?")) return;
  await store.set({ avatarGroupId: null, userPhotoDataUrl: null, looks: [] });
  pendingPhotos = [];
  showScreen("apikey");
}

// ── Storage ────────────────────────────────────────────────────────────────

const store = {
  get: keys => new Promise(r => chrome.storage.local.get(keys, r)),
  set: data => new Promise(r => chrome.storage.local.set(data, r)),
};

// ── HeyGen API helper ──────────────────────────────────────────────────────

async function heygen(apiKey, method, path, body) {
  const opts = { method, headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Utils ──────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Save look from content script message
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "SAVE_LOOK") saveLook(msg.look);
});

async function saveLook(look) {
  const { looks = [] } = await store.get(["looks"]);
  looks.push({ id: Date.now().toString(), savedAt: Date.now(), ...look });
  await store.set({ looks });
}

function showToast(message, icon = "✓") {
  const existing = document.querySelector(".toast-message");
  if (existing) existing.remove();
  
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.innerHTML = `${icon} ${message}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 10000;
    white-space: nowrap;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}