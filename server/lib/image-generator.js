// ==================================================
// Dynamic Image Generator (Sharp Profile Overlay)
// ==================================================
// Uses 'sharp' instead of @napi-rs/canvas for better
// compatibility with Render.com build environment.
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
 * Generate a dynamic card image overlaying the friend's profile picture.
 *
 * @param {number|string} bgIndex - Background image index (1-4)
 * @param {string} [profilePicUrl] - URL of tagged friend's profile photo
 * @param {string} [friendName] - Friend's name to write on image
 * @returns {Promise<Buffer>} JPEG image buffer
 */
async function generateCardImage(bgIndex, profilePicUrl, friendName) {
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

  // Overlay profile picture if provided
  if (profilePicUrl) {
    try {
      // If URL contains redirect=false, Graph API returns JSON with the real URL
      let actualImageUrl = profilePicUrl;
      if (profilePicUrl.includes("redirect=false")) {
        const metaRes = await axios.get(profilePicUrl, { timeout: 5000 });
        if (metaRes.data && metaRes.data.data && metaRes.data.data.url) {
          actualImageUrl = metaRes.data.data.url;
        }
      }

      const response = await axios.get(actualImageUrl, {
        responseType: "arraybuffer",
        timeout: 5000,
        maxRedirects: 5,
      });
      const avatarBuffer = Buffer.from(response.data);

      // Calculate circle position and size
      const radius = Math.round(Math.min(bgWidth, bgHeight) * 0.16);
      const diameter = radius * 2;
      const centerX = Math.round(bgWidth / 2);
      const centerY = Math.round(bgHeight * 0.42);

      // Resize avatar to fit the circle
      const resizedAvatar = await sharp(avatarBuffer)
        .resize(diameter, diameter, { fit: "cover" })
        .raw()
        .toBuffer();

      // Create circular mask
      const circleSvg = `<svg width="${diameter}" height="${diameter}">
        <circle cx="${radius}" cy="${radius}" r="${radius}" fill="white"/>
      </svg>`;

      // Apply circular mask to avatar
      const circularAvatar = await sharp(resizedAvatar, {
        raw: { width: diameter, height: diameter, channels: 3 },
      })
        .ensureAlpha()
        .composite([
          {
            input: Buffer.from(circleSvg),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      // Create white border ring
      const borderWidth = 10;
      const borderDiameter = diameter + borderWidth * 2;
      const borderRadius = borderDiameter / 2;
      const borderSvg = `<svg width="${borderDiameter}" height="${borderDiameter}">
        <circle cx="${borderRadius}" cy="${borderRadius}" r="${borderRadius}" fill="white"/>
      </svg>`;
      const borderCircle = await sharp(Buffer.from(borderSvg))
        .png()
        .toBuffer();

      // Composite: background + white border ring + circular avatar
      bgBuffer = await sharp(bgBuffer)
        .composite([
          {
            input: borderCircle,
            left: centerX - Math.round(borderDiameter / 2),
            top: centerY - Math.round(borderDiameter / 2),
          },
          {
            input: circularAvatar,
            left: centerX - radius,
            top: centerY - radius,
          },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

      return bgBuffer;
    } catch (err) {
      console.log("[ImageGen] ℹ️ Profile pic unavailable (FB API restriction for non-admin users) — using background only");
    }
  }

  // Return background only (no overlay)
  return sharp(bgBuffer).jpeg({ quality: 90 }).toBuffer();
}

module.exports = {
  generateCardImage,
  BG_IMAGES,
};
