const axios = require("axios");

module.exports = async (m, sock) => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
  const jid = m.key.remoteJid;

  if (!text.startsWith(".img")) return;

  const query = text.split(" ").slice(1).join(" ");
  if (!query) {
    return sock.sendMessage(jid, {
      text: "❌ Please provide a keyword.\n\nExample: `.img cat`"
    }, { quoted: m });
  }

  try {
    // Use DuckDuckGo unofficial API for image search
    const tokenRes = await axios.get("https://duckduckgo.com/", {
      params: { q: query }
    });
    const token = /vqd='(.*?)'/.exec(tokenRes.data)?.[1];
    if (!token) throw new Error("Failed to get token from DuckDuckGo");

    const imageRes = await axios.get("https://duckduckgo.com/i.js", {
      params: {
        l: "us-en",
        o: "json",
        q: query,
        vqd: token,
        f: "",
        p: "1"
      },
      headers: {
        "Referer": "https://duckduckgo.com/",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const results = imageRes.data?.results?.slice(0, 5);
    if (!results || results.length === 0) {
      return sock.sendMessage(jid, {
        text: "❌ No images found for that keyword."
      }, { quoted: m });
    }

    for (let img of results) {
      await sock.sendMessage(jid, {
        image: { url: img.image },
        caption: `🖼️ *${query}* — From ${img.source || "DuckDuckGo"}`
      }, { quoted: m });
    }

  } catch (err) {
    console.error("❌ Image search error:", err);
    await sock.sendMessage(jid, {
      text: "❌ Failed to fetch images. Try another keyword."
    }, { quoted: m });
  }
};
