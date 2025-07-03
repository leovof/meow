const axios = require("axios");

module.exports = async (m, sock) => {
  try {
    const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const jid = m.key.remoteJid;

    if (!text.startsWith(".tiktok")) return;

    const args = text.split(" ");
    const url = args[1];

    if (!url || !url.includes("tiktok.com")) {
      await sock.sendMessage(jid, { text: "❌ Usage:\n.tiktok <tiktok video link>" }, { quoted: m });
      return;
    }

    await sock.sendMessage(jid, { react: { text: "🔍", key: m.key } });

    const apiUrl = `https://lucicodes.x10.mx/api/tiktokDL/?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiUrl);
    const { status, resp } = res.data;

    if (status !== "success" || !resp) {
      await sock.sendMessage(jid, {
        text: "❌ Failed to fetch video from TikTok. Link may be private or invalid."
      }, { quoted: m });
      return;
    }

    await sock.sendMessage(jid, {
      video: { url: resp },
      caption: `🎬 *TikTok Video*\n✅ Successfully downloaded.`
    }, { quoted: m });

    await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });

  } catch (err) {
    console.error("❌ TikTok download error:", err);
    await sock.sendMessage(m.key.remoteJid, {
      text: "❌ Unexpected error during TikTok download."
    }, { quoted: m });
  }
};
