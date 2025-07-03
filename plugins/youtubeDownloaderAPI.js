const axios = require("axios");

// 🔍 Get video ID from keyword for .song and .song2
async function getVideoIdFromKeyword(query) {
  try {
    const res = await axios.get(`https://wwd.mp3juice.blog/search.php?q=${encodeURIComponent(query)}`);
    const idMatch = res.data?.items?.[0]?.id;
    return idMatch || null;
  } catch (err) {
    console.error("❌ Failed to fetch video ID:", err);
    return null;
  }
}

module.exports = async (m, sock) => {
  try {
    const text = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const jid = m.key.remoteJid;

    const handleSongRequest = async (query, isVoiceMessage = false) => {
      if (!query) {
        await sock.sendMessage(jid, { text: `❌ Usage:\n.${isVoiceMessage ? 'song2' : 'song'} <keyword or YouTube link>` }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: "🔍", key: m.key } });

      let videoId = null;

      if (query.includes("youtube.com") || query.includes("youtu.be")) {
        const match = query.match(/(?:v=|\/shorts\/|\/watch\?v=|youtu\.be\/)([0-9A-Za-z_-]{11})/);
        videoId = match ? match[1] : null;
      } else {
        videoId = await getVideoIdFromKeyword(query);
      }

      if (!videoId) {
        await sock.sendMessage(jid, { text: "❌ Could not find a valid video ID." }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: "⬇️", key: m.key } });

      const res = await axios.get(`https://lucicodes.x10.mx/api/ytDL/?Vid=${videoId}&type=mp3`);
      const mp3Url = res.data?.resp;

      if (!mp3Url || mp3Url.includes("Unable to download")) {
        await sock.sendMessage(jid, { text: "❌ Failed to download audio." }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: "⬆️", key: m.key } });

      await sock.sendMessage(jid, {
        audio: { url: mp3Url },
        mimetype: "audio/mp4",
        ptt: isVoiceMessage,
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
    };

    // === .song ===
    if (text.startsWith(".song ")) {
      const query = text.slice(6).trim();
      await handleSongRequest(query, false);
    }

    // === .song2 === (voice message)
    else if (text.startsWith(".song2 ")) {
      const query = text.slice(7).trim();
      await handleSongRequest(query, true);
    }

    // === .video ===
    else if (text.startsWith(".video ")) {
      const url = text.slice(7).trim();
      if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
        await sock.sendMessage(jid, { text: "❌ Usage:\n.video <YouTube or Shorts link>" }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: "🔍", key: m.key } });

      const match = url.match(/(?:v=|\/shorts\/|\/watch\?v=|youtu\.be\/)([0-9A-Za-z_-]{11})/);
      const videoId = match ? match[1] : null;

      if (!videoId) {
        await sock.sendMessage(jid, { text: "❌ Could not extract a valid video ID." }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: "⬇️", key: m.key } });

      const res = await axios.get(`https://lucicodes.x10.mx/api/ytDL/?Vid=${videoId}&type=mp4`);
      const videoUrl = res.data?.resp;

      if (!videoUrl || videoUrl.includes("Unable to download")) {
        await sock.sendMessage(jid, { text: "❌ Failed to download video." }, { quoted: m });
        return;
      }

      await sock.sendMessage(jid, { react: { text: "⬆️", key: m.key } });

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        mimetype: "video/mp4",
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: "✅", key: m.key } });
    }

  } catch (err) {
    console.error("❌ Error in youtubeDownloader plugin:", err);
    await sock.sendMessage(m.key.remoteJid, { text: "❌ Failed to process your request." }, { quoted: m });
  }
};
