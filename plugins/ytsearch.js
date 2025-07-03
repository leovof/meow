const axios = require("axios");

module.exports = async (m, sock) => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
  if (!text.startsWith(".yts ")) return;

  const jid = m.key.remoteJid;
  const query = text.slice(5).trim();
  if (!query) {
    await sock.sendMessage(jid, { text: "❌ Usage: `.yts <search keywords>`" }, { quoted: m });
    return;
  }

  await sock.sendMessage(jid, { react: { text: "🔍", key: m.key } });

  try {
    const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    // YouTube search page includes a JSON in 'ytInitialData' variable we can parse
    const jsonStr = res.data.match(/var ytInitialData = (.*?);<\/script>/);
    if (!jsonStr) {
      await sock.sendMessage(jid, { text: "❌ Could not parse search results." }, { quoted: m });
      return;
    }

    const ytInitialData = JSON.parse(jsonStr[1]);

    // Navigate JSON to find videoRenderer items
    const contents = ytInitialData.contents
      ?.twoColumnSearchResultsRenderer
      ?.primaryContents
      ?.sectionListRenderer
      ?.contents?.[0]
      ?.itemSectionRenderer
      ?.contents || [];

    const videos = contents.filter(c => c.videoRenderer).slice(0, 10);

    if (videos.length === 0) {
      await sock.sendMessage(jid, { text: "❌ No results found." }, { quoted: m });
      return;
    }

    // Format results nicely
    const results = videos.map((v, i) => {
      const video = v.videoRenderer;
      const title = video.title.runs[0].text;
      const videoId = video.videoId;
      const duration = video.lengthText?.simpleText || "N/A";
      return `*${i + 1}. ${title}*\nDuration: ${duration}\nhttps://youtu.be/${videoId}`;
    }).join("\n\n");

    const caption = `🔎 *YouTube Search Results for:* _${query}_\n\n${results}`;

    await sock.sendMessage(jid, { text: caption }, { quoted: m });
    await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });

  } catch (err) {
    console.error("❌ .yts error:", err);
    await sock.sendMessage(jid, { text: "❌ Failed to fetch YouTube search results." }, { quoted: m });
  }
};
