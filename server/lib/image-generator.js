// ==================================================
// Dynamic Image Generator (Sharp + Thai Font Text Overlay)
// ==================================================
// Generates card images with friend's name as text
// overlay on the background card with embedded Thai font
// for 100% accurate Thai character rendering on Linux (Render).
// ==================================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

const BG_IMAGES = {
  1: "https://i.ibb.co/j9y1XGDC/1.jpg",
  2: "https://i.ibb.co/5hFJpTL1/2.jpg",
  3: "https://i.ibb.co/60P7VPLD/3.jpg",
  4: "https://i.ibb.co/XZWHVscg/4.jpg",
};

// In-memory cache for background image buffers
const bgCache = new Map();

// Base64-encoded Thai font for SVG rendering
let thaiFontB64 = "";

/**
 * Load or download NotoSansThai font and convert to Base64.
 */
async function loadThaiFont() {
  if (thaiFontB64) return thaiFontB64;

  const assetsDir = path.join(__dirname, "..", "assets");
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  const fontPath = path.join(assetsDir, "NotoSansThai.ttf");

  try {
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath);
      thaiFontB64 = fontBuffer.toString("base64");
      return thaiFontB64;
    }

    // Download Thai font if not present
    const fontUrl = "https://github.com/google/fonts/raw/main/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf";
    const res = await axios.get(fontUrl, { responseType: "arraybuffer", timeout: 10000 });
    fs.writeFileSync(fontPath, Buffer.from(res.data));
    thaiFontB64 = Buffer.from(res.data).toString("base64");
    console.log("[ImageGen] ✅ Thai font loaded and cached");
    return thaiFontB64;
  } catch (err) {
    console.warn("[ImageGen] ⚠️ Could not load Thai font:", err.message);
    return "";
  }
}

/**
 * Fetch and cache background image buffer with fallback logic.
 * @param {number|string} bgIndex 
 * @returns {Promise<Buffer>}
 */
async function getBgBuffer(bgIndex) {
  const index = parseInt(bgIndex, 10) || 1;

  // 1. Return from cache if available
  if (bgCache.has(index)) {
    return bgCache.get(index);
  }

  const bgUrl = BG_IMAGES[index] || BG_IMAGES[1];

  try {
    const response = await axios.get(bgUrl, {
      responseType: "arraybuffer",
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
    });

    const buffer = Buffer.from(response.data);
    await sharp(buffer).metadata();
    bgCache.set(index, buffer);
    return buffer;
  } catch (err) {
    console.warn(`[ImageGen] ⚠️ Failed to load bg ${index}: ${err.message} — falling back to bg 1`);

    if (bgCache.has(1)) {
      return bgCache.get(1);
    }

    try {
      const fbResponse = await axios.get(BG_IMAGES[1], {
        responseType: "arraybuffer",
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        },
      });
      const fbBuffer = Buffer.from(fbResponse.data);
      bgCache.set(1, fbBuffer);
      return fbBuffer;
    } catch (fbErr) {
      throw new Error(`Failed to load fallback background image: ${fbErr.message}`);
    }
  }
}

/**
 * Generate a dynamic card image with the friend's name overlaid as text.
 *
 * @param {number|string} bgIndex - Background image index (1-4)
 * @param {string} [profilePicUrl] - (kept for API compatibility, not used)
 * @param {string} [friendName] - Friend's name to display on the card
 * @returns {Promise<Buffer>} JPEG image buffer
 */
async function generateCardImage(bgIndex, profilePicUrl, friendName = "Friend") {
  let bgBuffer = await getBgBuffer(bgIndex);
  const fontB64 = await loadThaiFont();

  // Get background dimensions
  const bgMeta = await sharp(bgBuffer).metadata();
  const bgWidth = bgMeta.width;
  const bgHeight = bgMeta.height;

  // Create text overlay with friend's name
  if (friendName && friendName !== "Friend") {
    try {
      const centerX = Math.round(bgWidth / 2);
      const centerY = Math.round(bgHeight * 0.40);

      // Scale font size based on image width and name length
      let fontSize = Math.round(bgWidth * 0.07);
      if (friendName.length > 15) {
        fontSize = Math.round(bgWidth * 0.05);
      }
      if (friendName.length > 25) {
        fontSize = Math.round(bgWidth * 0.04);
      }

      // Escape special XML characters in the name
      const safeName = friendName
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

      const fontStyle = fontB64
        ? `@font-face { font-family: 'ThaiFont'; src: url('data:font/ttf;charset=utf-8;base64,${fontB64}') format('truetype'); }`
        : "";

      const textSvg = `<svg width="${bgWidth}" height="${bgHeight}">
        <defs>
          <style>
            ${fontStyle}
            .name-text {
              font-family: 'ThaiFont', Arial, Helvetica, sans-serif;
              font-size: ${fontSize}px;
              font-weight: bold;
              fill: white;
            }
          </style>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.7)"/>
          </filter>
        </defs>
        
        <!-- Background pill/badge behind the name -->
        <rect 
          x="${centerX - (safeName.length * fontSize * 0.35)}" 
          y="${centerY - fontSize * 0.85}" 
          width="${safeName.length * fontSize * 0.70}" 
          height="${fontSize * 1.8}" 
          rx="${fontSize * 0.4}" 
          ry="${fontSize * 0.4}" 
          fill="rgba(0,0,0,0.55)" 
        />
        
        <!-- Friend's name text -->
        <text 
          x="${centerX}" 
          y="${centerY + fontSize * 0.35}" 
          class="name-text" 
          text-anchor="middle" 
          filter="url(#shadow)"
        >${safeName}</text>
      </svg>`;

      const cardBuffer = await sharp(bgBuffer)
        .composite([
          {
            input: Buffer.from(textSvg),
            top: 0,
            left: 0,
          },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

      return cardBuffer;
    } catch (err) {
      console.warn("[ImageGen] ⚠️ Text overlay failed:", err.message);
    }
  }

  // Return background only (no overlay)
  return sharp(bgBuffer).jpeg({ quality: 90 }).toBuffer();
}

// Pre-warm cache and font on module load
loadThaiFont().catch(() => {});
getBgBuffer(1).catch(() => {});
getBgBuffer(4).catch(() => {});

module.exports = {
  generateCardImage,
  BG_IMAGES,
};
