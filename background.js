// TryOnMate - Background Service Worker (FIXED)

const HEYGEN_API = "https://api.heygen.com";
const HEYGEN_UPLOAD = "https://upload.heygen.com/v1/asset";
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GENERATE_TRYON") {
    handleTryOn(request.payload).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.type === "POLL_VIDEO") {
    pollVideoStatus(request.videoId, request.apiKey).then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.type === "GET_SETTINGS") {
    chrome.storage.local.get(["heygenApiKey", "openrouterApiKey", "avatarGroupId", "userPhotoDataUrl"], sendResponse);
    return true;
  }
  if (request.type === "SAVE_LOOK") {
    chrome.storage.local.get(["looks"], ({ looks = [] }) => {
      looks.push({ id: Date.now().toString(), savedAt: Date.now(), ...request.look });
      chrome.storage.local.set({ looks });
    });
  }
});

async function handleTryOn({ heygenApiKey, openrouterApiKey, avatarGroupId, userPhotoDataUrl, outfitImageUrl, outfitName }) {
  if (!heygenApiKey) throw new Error("HeyGen API key missing");
  if (!openrouterApiKey) throw new Error("OpenRouter API key missing");
  if (!avatarGroupId) throw new Error("No avatar trained");
  if (!userPhotoDataUrl) throw new Error("No reference photo");
  if (!outfitImageUrl) throw new Error("No outfit image");

  // Fetch outfit image
  const outfitBlob = await fetch(outfitImageUrl).then(r => r.blob());
  const outfitBase64 = await blobToBase64(outfitBlob);

  // Generate try-on with OpenRouter
  const tryOnDataUrl = await generateTryOn(openrouterApiKey, userPhotoDataUrl, outfitBase64, outfitBlob.type, outfitName);
  
  // Upload to HeyGen
  const imageKey = await uploadToHeyGen(heygenApiKey, tryOnDataUrl);
  
  // Add as look
  const lookId = await addLookToGroup(heygenApiKey, avatarGroupId, imageKey, outfitName);
  
  // Generate video
  const videoId = await generateVideo(heygenApiKey, lookId, outfitName);

  return { status: "pending", imageDataUrl: tryOnDataUrl, videoId, lookId };
}

async function generateTryOn(apiKey, userPhotoDataUrl, outfitBase64, outfitMime, outfitName) {
  const userBase64 = userPhotoDataUrl.split(",")[1];
  const userMime = userPhotoDataUrl.split(";")[0].replace("data:", "");

  const response = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview:free",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${userMime};base64,${userBase64}` } },
          { type: "image_url", image_url: { url: `data:${outfitMime};base64,${outfitBase64}` } },
          { type: "text", text: `Generate a realistic photo of the person wearing ${outfitName || "this outfit"}. Preserve face, body shape, and lighting.` }
        ]
      }]
    })
  });

  const data = await response.json();
  const imgPart = data.choices?.[0]?.message?.content?.find(p => p.type === "image_url");
  if (!imgPart?.image_url?.url) throw new Error("No image generated");
  return imgPart.image_url.url;
}

async function uploadToHeyGen(apiKey, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("file", blob, "tryon.jpg");
  form.append("type", "image");

  const res = await fetch(HEYGEN_UPLOAD, {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form
  });
  const data = await res.json();
  return data.data?.key || data.data?.image_key;
}

async function addLookToGroup(apiKey, groupId, imageKey, outfitName) {
  const res = await fetch(`${HEYGEN_API}/v2/photo_avatar/look/add`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: groupId, image_key: imageKey, name: outfitName || "TryOn Look" })
  });
  const data = await res.json();
  return data.data?.id || imageKey;
}

async function generateVideo(apiKey, lookId, outfitName) {
  const res = await fetch(`${HEYGEN_API}/v2/video/generate`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: "photo_avatar", photo_avatar_id: lookId },
        voice: { type: "text", input_text: `Check out this ${outfitName || "look"}`, voice_id: "1bd001e7e50f421d891986aad5158bc8" }
      }],
      dimension: { width: 720, height: 1280 }
    })
  });
  const data = await res.json();
  return data.data?.video_id;
}

async function pollVideoStatus(videoId, apiKey) {
  if (!videoId) return { status: "none" };
  const res = await fetch(`${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`, {
    headers: { "X-Api-Key": apiKey }
  });
  const data = await res.json();
  return { status: data.data?.status, videoUrl: data.data?.video_url };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}