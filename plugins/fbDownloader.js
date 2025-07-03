const axios = require("axios");

module.exports = async (m, sock) => {
  try {
    const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const jid = m.key.remoteJid;

    if (!text.startsWith(".fb")) return;

    const args = text.split(" ");
    const url = args[1];

    if (!url || !url.includes("facebook.com")) {
      await sock.sendMessage(jid, { text: "❌ Usage:\n.fb <facebook video link>" }, { quoted: m });
      return;
    }

    await sock.sendMessage(jid, { react: { text: "🔍", key: m.key } });

    const apiUrl = `https://tooly.chative.io/facebook/video?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiUrl);
    const data = res.data;

    if (!data.success || !data.videos) {
      await sock.sendMessage(jid, {
        text: "❌ Failed to fetch Facebook video. It may be private or removed."
      }, { quoted: m });
      return;
    }

    const video_url = data.videos.hd?.url || data.videos.sd?.url;
    const title = data.title || "No title available";

    if (!video_url) {
      await sock.sendMessage(jid, {
        text: "❌ Video found but no valid link available to download."
      }, { quoted: m });
      return;
    }

    await sock.sendMessage(jid, {
      video: { url: video_url },
      caption: `🎥 *Facebook Video*\n📝 ${title}`
    }, { quoted: m });

    await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });

  } catch (err) {
    console.error("❌ Facebook plugin error:", err);
    await sock.sendMessage(m.key.remoteJid, {
      text: "❌ Unexpected error during Facebook video download."
    }, { quoted: m });
  }
};
