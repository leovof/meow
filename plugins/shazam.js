const axios = require("axios");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const acrcloud = require("acrcloud");

const ACR_HOST = "identify-us-west-2.acrcloud.com";
const ACR_KEY = "4dcc03ffef2f7e8e565f9a39ffc17a64";
const ACR_SECRET = "lkfbU2qOv31npMa7wyd6uNsxIzLmQK0ZmNBLXDeD";

const recognizer = new acrcloud({
  host: ACR_HOST,
  access_key: ACR_KEY,
  access_secret: ACR_SECRET,
});

module.exports = async (m, sock, store) => {
  try {
    const text = m.message?.conversation ||
      m.message?.extendedTextMessage?.text || "";

    if (!text.startsWith(".shazam")) return;
    if (!m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Please reply to an *audio* or *video* with `.shazam`",
      }, { quoted: m });
      return;
    }

    const quoted = m.message.extendedTextMessage.contextInfo.quotedMessage;
    const type = Object.keys(quoted)[0];
    if (!["audioMessage", "videoMessage"].includes(type)) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Only *audio* or *video* messages are supported.",
      }, { quoted: m });
      return;
    }

    const buffer = await downloadMediaMessage(
      { message: quoted },
      "buffer",
      {},
      { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
    );

    const result = await recognizer.identify(buffer);
    if (
      result.status.code !== 0 ||
      !result.metadata ||
      !result.metadata.music
    ) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "❌ Could not recognize any music.",
      }, { quoted: m });
      return;
    }

    const music = result.metadata.music[0];
    const title = music.title || "Unknown";
    const artists = music.artists?.map(a => a.name).join(", ") || "Unknown";
    const album = music.album?.name || "Unknown";
    const release = music.release_date || "Unknown";

    const platforms = music.external_metadata || {};
    const spotify = platforms.spotify?.track?.external_urls?.spotify || null;
    const youtube = platforms.youtube?.vid || null;

    let message = `🎵 *Song Detected!*\n\n`;
    message += `🎧 *Title:* ${title}\n`;
    message += `👤 *Artist:* ${artists}\n`;
    message += `💿 *Album:* ${album}\n`;
    message += `📅 *Released:* ${release}\n\n`;

    if (spotify) message += `🟢 *Spotify:* ${spotify}\n`;
    if (youtube) message += `▶️ *YouTube:* https://youtu.be/${youtube}`;

    await sock.sendMessage(m.key.remoteJid, { text: message }, { quoted: m });

  } catch (err) {
    console.error("❌ Error in shazam.js:", err);
    await sock.sendMessage(m.key.remoteJid, {
      text: "❌ Failed to identify song.",
    }, { quoted: m });
  }
};
