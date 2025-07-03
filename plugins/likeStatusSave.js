const { downloadMediaMessage } = require("@whiskeysockets/baileys");

// Cache: user -> status key
const likedStatusMap = new Map();

module.exports = async (msg, sock, store) => {
  try {
    const { key, message } = msg;
    if (!message?.reactionMessage) return;

    const reaction = message.reactionMessage;
    const fromJid = reaction.key?.remoteJid;
    const statusKey = `${reaction.key?.id}:${reaction.key?.participant}`;

    // Log reaction received
    console.log(`💬 Reaction from ${reaction.key?.participant || "unknown"} → ${reaction.text || "REMOVED"}`);

    // Check it's a status
    if (fromJid !== "status@broadcast") return;

    // 🟢 When liked (💚)
    if (reaction.text === "💚") {
      likedStatusMap.set(statusKey, Date.now());
      console.log(`🟩 Stored status key for ${statusKey}`);
      
      // Clear it after 30 seconds
      setTimeout(() => likedStatusMap.delete(statusKey), 30000);
      return;
    }

    // 🔴 When unliked (reaction removed)
    if (!reaction.text) {
      if (!likedStatusMap.has(statusKey)) {
        console.log(`❌ Unlike detected but status not found in memory: ${statusKey}`);
        return;
      }

      likedStatusMap.delete(statusKey);
      console.log(`📥 Detected unlike for status → ${statusKey}. Attempting to save...`);

      const original = await store.loadMessage("status@broadcast", reaction.key?.id);
      if (!original?.message) {
        console.log("⚠️ Could not load original status message.");
        return;
      }

      const type = Object.keys(original.message)[0];
      if (!["imageMessage", "videoMessage"].includes(type)) {
        console.log("⚠️ Not image/video status. Ignored.");
        return;
      }

      const buffer = await downloadMediaMessage(
        original,
        "buffer",
        {},
        {
          logger: sock.logger,
          reuploadRequest: sock.updateMediaMessage,
        }
      );

      if (!buffer) {
        // If the download failed, notify the bot's DM with the error message.
        const ownerJid = sock.user.id;
        const errorMsg = `❌ Error downloading status: ${statusKey} - Could not retrieve media.`;
        await sock.sendMessage(ownerJid, {
          text: errorMsg,
        });
        console.log(errorMsg);
        return;
      }

      const ownerJid = sock.user.id;
      const participantJid = key.participant || "unknown@s.whatsapp.net";
      const originalCaption =
        original.message?.imageMessage?.caption ||
        original.message?.videoMessage?.caption ||
        "No caption available";

      const caption = originalCaption !== "No caption available" 
        ? `${originalCaption}\n\n👤 @${participantJid.split("@")[0]}` 
        : `👤 @${participantJid.split("@")[0]}`;

      await sock.sendMessage(ownerJid, {
        [type === "imageMessage" ? "image" : "video"]: buffer,
        caption,
        mentions: [participantJid],
      });

      console.log("✅ Status saved to bot’s DM successfully.");
    }
  } catch (err) {
    console.error("❌ Error in likeStatusSave plugin:", err);

    // Notify the bot's DM about the error
    const ownerJid = sock.user.id;
    const errorMsg = `❌ Error in likeStatusSave plugin: ${err.message || err}`;
    await sock.sendMessage(ownerJid, {
      text: errorMsg,
    });
  }
};
