// ==================================================
// OYOSHI Campaign — Personality Logic & Message Formatting
// ==================================================
// Campaign-specific logic: extracting friend names,
// generating personality results, and formatting reply messages.
// ==================================================

const PERSONALITY_TYPES = [
  {
    index: 1,
    type: "THE HYPE FRIEND",
    emoji: "🔥",
    desc: "คนที่พร้อมเติมไฟให้คุณเสมอ",
    imageUrl: "https://i.ibb.co/j9y1XGDC/1.jpg",
  },
  {
    index: 2,
    type: "THE COMFORT FRIEND",
    emoji: "🤗",
    desc: "ไม่ต้องพูดเยอะก็เข้าใจกัน",
    imageUrl: "https://i.ibb.co/5hFJpTL1/2.jpg",
  },
  {
    index: 3,
    type: "THE CHAOS FRIEND",
    emoji: "🤪",
    desc: "อยู่ด้วยกันทีไร ไม่มีคำว่าสงบ",
    imageUrl: "https://i.ibb.co/60P7VPLD/3.jpg",
  },
  {
    index: 4,
    type: "THE ADVENTURE FRIEND",
    emoji: "🏔️",
    desc: "คนที่พร้อมไปทุกที่ด้วยกัน",
    imageUrl: "https://i.ibb.co/XZWHVscg/4.jpg",
  },
];

function extractFriendData(commentText, messageTags = []) {
  if (messageTags && messageTags.length > 0) {
    const tag = messageTags.find((t) => t.type === "user");
    if (tag && tag.name) {
      return {
        name: tag.name.trim(),
        id: tag.id || null,
      };
    }
  }

  // Match @mentions including names with spaces (up to 40 chars)
  const atMentionRegex = /@([\p{L}\p{M}\p{N}_\s.]{1,40}?)(?=$|#|https?:\/\/|[\r\n])/gu;
  const matches = [...(commentText || "").matchAll(atMentionRegex)];
  if (matches.length > 0 && matches[0][1].trim().length > 0) {
    return {
      name: matches[0][1].trim(),
      id: null,
    };
  }

  const cleaned = (commentText || "")
    .replace(/#\S+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();

  if (cleaned.length > 0 && cleaned.length <= 40) {
    return {
      name: cleaned,
      id: null,
    };
  }

  return { name: null, id: null };
}

function extractFriendName(commentText, messageTags = []) {
  return extractFriendData(commentText, messageTags).name;
}

/**
 * Generate a random campaign result for a friend.
 *
 * @param {string} friendName - The friend's name
 * @returns {{ friendName: string, personality: object, score: number }}
 */
function generateResult(friendName) {
  const personality =
    PERSONALITY_TYPES[Math.floor(Math.random() * PERSONALITY_TYPES.length)];
  const score = Math.floor(Math.random() * 15) + 85; // 85–99%

  return { friendName, personality, score };
}

/**
 * Format the reply message with personality result.
 *
 * @param {string} friendName
 * @param {object} personality - { type, emoji, desc }
 * @param {number} score - Good Energy Score (85-99)
 * @returns {string} Formatted reply message
 */
function formatReplyMessage(friendName, personality, score) {
  // Build a visual score bar
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  return [
    `⚡ GOOD ENERGY RESULT ⚡`,
    ``,
    `${friendName} คือ...`,
    ``,
    `${personality.emoji} ${personality.type}`,
    `${personality.desc}`,
    ``,
    `Good Energy Score: ${score}%`,
    `${bar} ${score}%`,
    ``,
    `🎁 ส่ง OYOSHI ให้เพื่อนดีๆ ของคุณ!`,
    `#OYOSHI #GoodEnergy #TagYourFriend`,
  ].join("\n");
}

module.exports = {
  PERSONALITY_TYPES,
  extractFriendName,
  extractFriendData,
  generateResult,
  formatReplyMessage,
};
