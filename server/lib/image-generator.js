// ==================================================
// Dynamic Image Generator (Sharp + Text Overlay + Memory Cache)
// ==================================================
// Generates card images with friend's name as text
// overlay on the background card with in-memory caching
// and automatic fallback for missing/slow network images.
// ==================================================

const axios = require("axios");
const sharp = require("sharp");

const BG_IMAGES = {
  1: "https://i.ibb.co/j9y1XGDC/1.jpg",
  2: "https://i.ibb.co/5hFJpTL1/2.jpg",
  3: "https://i.ibb.co/60P7VPLD/3.jpg",
  4: "https://i.ibb.co/XZWHVscg/4.jpg",
};

// In-memory cache for background image buffers to prevent HTTP timeouts
const bgCache = new Map();

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

    // Verify it's a valid image using sharp
    await sharp(buffer).metadata();

    // Cache valid buffer
    bgCache.set(index, buffer);
    return buffer;
  } catch (err) {
    console.warn(`[ImageGen] ⚠️ Failed to load bg ${index} (${bgUrl}): ${err.message} — falling back to bg 1`);

    // Fallback to cached bg 1 if available
    if (bgCache.has(1)) {
      return bgCache.get(1);
    }

    // Otherwise download bg 1 as guaranteed fallback
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

      const textSvg = `<svg width="${bgWidth}" height="${bgHeight}">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.7)"/>
          </filter>
        </defs>
        
        <!-- Background pill/badge behind the name -->
        <rect 
          x="${centerX - (safeName.length * fontSize * 0.32)}" 
          y="${centerY - fontSize * 0.8}" 
          width="${safeName.length * fontSize * 0.64}" 
          height="${fontSize * 1.8}" 
          rx="${fontSize * 0.4}" 
          ry="${fontSize * 0.4}" 
          fill="rgba(0,0,0,0.5)" 
        />
        
        <!-- Friend's name text -->
        <text 
          x="${centerX}" 
          y="${centerY + fontSize * 0.35}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${fontSize}" 
          font-weight="bold" 
          fill="white" 
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

// Pre-warm background cache on module load
getBgBuffer(1).catch(() => {});
getBgBuffer(4).catch(() => {});

module.exports = {
  generateCardImage,
  BG_IMAGES,
};
