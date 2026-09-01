// ==================================================
// Dynamic Image Generator (Sharp + Text Overlay)
// ==================================================
// Generates card images with friend's name as text
// overlay on the background card.
// ==================================================

const axios = require("axios");
const sharp = require("sharp");

const BG_IMAGES = {
  1: "https://i.ibb.co/j9y1XGDC/1.jpg",
  2: "https://i.ibb.co/5hFJpTL1/2.jpg",
  3: "https://i.ibb.co/60P7VPLD/3.jpg",
  4: "https://i.ibb.co/XZWHVscg/4.jpg",
};

/**
 * Generate a dynamic card image with the friend's name overlaid as text.
 *
 * @param {number|string} bgIndex - Background image index (1-4)
 * @param {string} [profilePicUrl] - (kept for API compatibility, not used)
 * @param {string} [friendName] - Friend's name to display on the card
 * @returns {Promise<Buffer>} JPEG image buffer
 */
async function generateCardImage(bgIndex, profilePicUrl, friendName = "Friend") {
  const bgUrl = BG_IMAGES[bgIndex] || BG_IMAGES[1];

  // Load background image
  const bgResponse = await axios.get(bgUrl, {
    responseType: "arraybuffer",
    timeout: 10000,
  });
  let bgBuffer = Buffer.from(bgResponse.data);

  // Get background dimensions
  const bgMeta = await sharp(bgBuffer).metadata();
  const bgWidth = bgMeta.width;
  const bgHeight = bgMeta.height;

  // Create text overlay with friend's name
  if (friendName && friendName !== "Friend") {
    try {
      // Calculate text positioning (center of the card, upper area)
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

      // Create SVG text overlay with shadow effect for readability
      const textSvg = `<svg width="${bgWidth}" height="${bgHeight}">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.7)"/>
          </filter>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
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

      bgBuffer = await sharp(bgBuffer)
        .composite([
          {
            input: Buffer.from(textSvg),
            top: 0,
            left: 0,
          },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log(`[ImageGen] ✅ Card generated with name: "${friendName}" on bg ${bgIndex}`);
      return bgBuffer;
    } catch (err) {
      console.warn("[ImageGen] ⚠️ Text overlay failed:", err.message);
    }
  }

  // Return background only (no overlay)
  return sharp(bgBuffer).jpeg({ quality: 90 }).toBuffer();
}

module.exports = {
  generateCardImage,
  BG_IMAGES,
};
