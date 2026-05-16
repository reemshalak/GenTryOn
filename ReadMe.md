# 👗 GenTryOn

### See Yourself in Any Outfit Before You Buy

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![HeyGen](https://img.shields.io/badge/Powered%20by-HeyGen-7c5cfc?style=for-the-badge)](https://heygen.com)
[![Gemini](https://img.shields.io/badge/AI-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)

> Stop wondering. Start trying. Virtual try-on for any clothing store.

**GenTryOn** is a Chrome extension that lets you virtually try on any outfit from any online store. Upload your photos once, train your avatar, then click "Try On Me" on any product page — the AI generates a realistic photo of you wearing that exact outfit.

Built with **HeyGen Photo Avatar API** + **Google Gemini AI**.

https://github.com/user-attachments/assets/gentryon-demo

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 👤 **Photo Avatar Training** | Upload 5-10 photos — AI learns your face and body |
| 👕 **One-Click Try-On** | Click "Try On Me" on any product page |
| 🎨 **AI Image Generation** | Gemini creates realistic composite of you + outfit |
| 📸 **Save & Share Looks** | Gallery of all your try-ons with shareable links |
| 🎬 **Video Generation** | Avatar speaks while showing off the outfit |
| 🔌 **Works Everywhere** | ASOS, Zara, H&M, Shein, and any product page |

---

## 🎯 Why GenTryOn?

**Online shopping has a problem:** You can't try before you buy.

GenTryOn solves this:
1. **Upload your photos once** — train your personal avatar
2. **Shop anywhere** — product pages get a "Try On Me" button
3. **See yourself instantly** — AI generates a realistic try-on photo
4. **Share with friends** — each look has a shareable link

---

## 🛠️ Tech Stack

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your Photos   │ ──► │   HeyGen AI     │ ──► │   Your Avatar   │
│   (5-10 images) │     │  (Photo Avatar) │     │   (Trained)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Outfit Image  │ ──► │   Gemini AI     │ ──► │   Try-On Photo  │
│   (product page)│     │  (Image-to-Image│     │   (You + Outfit)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

| Layer | Technology | Role |
|-------|------------|------|
| **Avatar Training** | HeyGen Photo Avatar API | Creates digital twin from your photos |
| **Image Generation** | Google Gemini 3.1 Flash | Combines you + outfit realistically |
| **Video Generation** | HeyGen Video API | Avatar speaks + shows outfit |
| **Extension** | Chrome Extension API | Injects buttons, manages state |

---

## 🚀 Quick Start

### Prerequisites

- Chrome browser
- HeyGen API key ([get one here](https://app.heygen.com/settings?tab=api))
- Google Gemini API key ([get free key here](https://aistudio.google.com/))

### Installation

```bash
# Clone the repo
git clone https://github.com/reemshalak/gentryon.git
cd gentryon

```

### Loading the Extension

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer Mode** (top right)
3. Click **Load Unpacked**
4. Select the `gentryon` folder
5. The extension icon appears in your toolbar

### First-Time Setup

1. Click the GenTryOn icon in your toolbar
2. Enter your **HeyGen API Key**
3. Enter your **Gemini API Key** (free from aistudio.google.com)
4. Upload **5-10 photos** of yourself (include full-body shots)
5. Click **Train Avatar** — wait 1-5 minutes
6. Done! Start shopping.

### Using the Extension

1. Go to any product page (ASOS, Zara, H&M, Shein, etc.)
2. Look for the **"Try On Me"** button near "Add to Cart"
3. Click it — AI generates you wearing that outfit
4. Save to your gallery or share the link

---

## 📁 Project Structure

```
gentryon/
├── manifest.json           # Extension config
├── background.js           # Service worker (API calls)
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Popup logic (avatar training)
│   └── popup.css           # Styling
├── content/
│   ├── content.js          # Injected on product pages
│   └── content.css         # Button + modal styles
└── icons/                  # Extension icons
```

---

## 🧠 How It Works

### Step 1: Avatar Training

```javascript
// User uploads 5-10 photos
// HeyGen API creates a Photo Avatar group
POST /v2/photo_avatar/avatar_group/create
{
  name: "User Avatar",
  image_key: "uploaded_photo_key"
}

// Add remaining photos
POST /v2/photo_avatar/avatar_group/add
{
  group_id: "group_123",
  image_keys: ["key2", "key3", ...]
}

// Train the model
POST /v2/photo_avatar/avatar_group/train
{
  group_id: "group_123"
}
```

### Step 2: Try-On Generation

```javascript
// Extension detects product page
// Extracts outfit image URL
// Sends to background script

// Gemini generates composite
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent
{
  contents: [{
    parts: [
      { inline_data: { mime_type: "image/jpeg", data: "user_base64" } },
      { inline_data: { mime_type: "image/jpeg", data: "outfit_base64" } },
      { text: "Generate realistic photo of person wearing this outfit..." }
    ]
  }]
}

// Returns data:image/jpeg;base64,... of you in the outfit
```

### Step 3: Save & Share

```javascript
// Save to Chrome storage
chrome.storage.local.set({
  looks: [...existingLooks, {
    id: Date.now(),
    imageUrl: "generated_image_url",
    product: "Bardot Maxi Dress",
    site: "asos.com",
    savedAt: Date.now()
  }]
});
```

---

## 🎨 Screenshots

| Setup | Training | Try-On |
|-------|----------|--------|
| ![Setup](https://via.placeholder.com/300x200?text=API+Key+Setup) | ![Training](https://via.placeholder.com/300x200?text=Upload+Photos) | ![TryOn](https://via.placeholder.com/300x200?text=Try+On+Me) |

| Product Page | Generated Look | Gallery |
|--------------|----------------|---------|
| ![Product](https://via.placeholder.com/300x200?text=Product+Page) | ![Result](https://via.placeholder.com/300x200?text=You+in+Outfit) | ![Gallery](https://via.placeholder.com/300x200?text=Saved+Looks) |

---

## 🔧 API Endpoints Used

| Service | Endpoint | Purpose |
|---------|----------|---------|
| HeyGen | `POST /v2/photo_avatar/avatar_group/create` | Create avatar group |
| HeyGen | `POST /v2/photo_avatar/avatar_group/add` | Add photos to group |
| HeyGen | `POST /v2/photo_avatar/avatar_group/train` | Train avatar model |
| HeyGen | `GET /v2/photo_avatar/avatar_group/{id}` | Check training status |
| HeyGen | `POST /v2/photo_avatar/look/add` | Save generated look |
| HeyGen | `POST /v2/video/generate` | Generate avatar video |
| Google Gemini | `POST /v1beta/models/gemini-3.1-flash-image:generateContent` | Generate try-on image |

---

## 🐛 Known Issues & Lessons Learned

### What I Learned Building This

1. **HeyGen v2 vs v3 endpoints** — The API changed; use `/v2/photo_avatar/...` not `/v3/avatars`

2. **Photo upload requires raw binary** — Not FormData. Use `arrayBuffer()` with `Content-Type: image/jpeg`

3. **Gemini model ID is specific** — Correct ID is `gemini-3.1-flash-image` (no `:free` suffix)

4. **Min 5 photos for training** — HeyGen needs at least 5 photos, but 10 works better

5. **Batch adds in groups of 4** — The `/add` endpoint accepts up to 4 `image_keys` at once

6. **Extension context invalidated** — After reloading extension, refresh the page

### Current Limitations

- ⏳ **Training takes 1-5 minutes** — HeyGen needs time to process
- ⏳ **Gemini has rate limits** — ~1,500 requests/day free tier
- ⏳ **Best results need good photos** — Clear, varied poses, good lighting
- ⏳ **Shoes/accessories are hit or miss** — Works best for tops, dresses, coats

---

## 🗺️ Roadmap

- [ ] **Multiple avatar support** — Save different body types
- [ ] **Outfit history** — Track what you've tried on
- [ ] **Share to TikTok/Instagram** — Direct social posting
- [ ] **Remove background from results** — Better compositing
- [ ] **Batch generation** — Try multiple outfits at once

---

## 📚 Resources

- [HeyGen Photo Avatar API Docs](https://docs.heygen.com/reference/photo-avatar)
- [Google Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

---

## 🙏 Acknowledgments

- **HeyGen** for Photo Avatar API
- **Google** for Gemini AI (Nano Banana)
- All the testers who uploaded photos of themselves

---

## 📄 License

MIT — free for personal and commercial use.

---

*Built with ☕, 👗, and 🎬 during the HeyGen Hackathon 2026*
