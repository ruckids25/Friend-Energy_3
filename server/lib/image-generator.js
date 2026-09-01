// ==================================================
// Dynamic Image Generator (Sharp + Vector Path Text Overlay)
// ==================================================
// Converts Thai text into SVG vector <path> shapes using
// opentype.js so that Thai characters render 100% accurately
// on any OS (Linux/Render/Mac) without relying on librsvg or
// system font availability.
// ==================================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const opentype = require("opentype.js");

const BG_IMAGES = {
  1: "https://i.ibb.co/j9y1XGDC/1.jpg",
  2: "https://i.ibb.co/5hFJpTL1/2.jpg",
  3: "https://i.ibb.co/60P7VPLD/3.jpg",
  4: "https://i.ibb.co/XZWHVscg/4.jpg",
};

// In-memory cache for background image buffers
const bgCache = new Map();

// Opentype font object
let parsedFont = null;

/**
 * Load or download NotoSansThai font and parse with opentype.js
 */
function getParsedFont() {
  if (parsedFont) return parsedFont;

  const fontPath = path.join(__dirname, "..", "assets", "NotoSansThai.ttf");
  if (fs.existsSync(fontPath)) {
    const fontBuffer = fs.readFileSync(fontPath);
    parsedFont = opentype.parse(
      fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength
      )
    );
    console.log("[ImageGen] ✅ NotoSansThai font parsed with opentype.js");
    return parsedFont;
  }
  return null;
}

/**
 * Fetch and cache background image buffer with fallback logic.
 * @param {number|string} bgIndex 
 * @returns {Promise<Buffer>}
 */
async function getBgBuffer(bgIndex) {
  const index = parseInt(bgIndex, 10) || 1;

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
  const font = getParsedFont();

  // Get background dimensions
  const bgMeta = await sharp(bgBuffer).metadata();
  const bgWidth = bgMeta.width;
  const bgHeight = bgMeta.height;

  // Create vector text overlay with friend's name
  if (friendName && friendName !== "Friend" && font) {
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

      // Calculate exact text width for pixel-perfect centering
      const textWidth = font.getAdvanceWidth(friendName, fontSize);
      const startX = Math.round((bgWidth - textWidth) / 2);

      // Convert Thai text into SVG vector path data using opentype.js
      const textPath = font.getPath(
        friendName,
        startX,
        centerY + fontSize * 0.35,
        fontSize
      );
      const pathData = textPath.toPathData(2);

      const textSvg = `<svg width="${bgWidth}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background pill/badge behind the name -->
        <rect 
          x="${centerX - textWidth / 2 - fontSize * 0.4}" 
          y="${centerY - fontSize * 0.85}" 
          width="${textWidth + fontSize * 0.8}" 
          height="${fontSize * 1.8}" 
          rx="${fontSize * 0.4}" 
          ry="${fontSize * 0.4}" 
          fill="rgba(0,0,0,0.55)" 
        />
        
        <!-- Vector Path for Thai Text (Drop Shadow) -->
        <path d="${pathData}" fill="rgba(0,0,0,0.7)" transform="translate(2, 2)"/>
        
        <!-- Vector Path for Thai Text (White Fill) -->
        <path d="${pathData}" fill="#FFFFFF"/>
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
      console.warn("[ImageGen] ⚠️ Vector text overlay failed:", err.message);
    }
  }

  // Return background only (no overlay)
  return sharp(bgBuffer).jpeg({ quality: 90 }).toBuffer();
}

// Pre-warm font and cache on module load
try { getParsedFont(); } catch (_e) {}
getBgBuffer(1).catch(() => {});
getBgBuffer(4).catch(() => {});

module.exports = {
  generateCardImage,
  BG_IMAGES,
};
