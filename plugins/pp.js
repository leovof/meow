// plugins/pp_fixed.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = async (m, sock) => {
  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text || "";

  if (!text.startsWith(".pp")) return;

  const args = text.split(" ");
  const target = args[1];
  if (!target || !/^\+?\d{6,}$/.test(target)) {
    return sock.sendMessage(m.key.remoteJid, {
      text: "❌ Use: .pp +94712345678"
    }, { quoted: m });
  }

  const jid = target.replace("+", "") + "@s.whatsapp.net";

  try {
    const url = await sock.profilePictureUrl(jid, "image").catch(() => null);
    const presence = await sock.presenceSubscribe(jid).then(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return sock.presence[jid] || {};
    }).catch(() => ({}));

    let statusText = "🔘 Status: Unknown";
    if (presence.lastSeen) {
      const lastSeenDate = new Date(presence.lastSeen);
      const diffMins = Math.floor((Date.now() - lastSeenDate.getTime()) / 60000);
      statusText = `🕒 Last seen: ${diffMins} minute(s) ago`;
    } else if (presence?.isOnline) {
      statusText = "🟢 Online";
    }

    if (!url) {
      return sock.sendMessage(m.key.remoteJid, {
        text: "⚠️ No profile picture found or request timed out."
      }, { quoted: m });
    }

    await sock.sendMessage(m.key.remoteJid, {
      image: { url },
      caption: `🖼️ *Profile Picture*\n👤 *Number:* wa.me/${target.replace("+", "")}\n${statusText}`
    }, { quoted: m });

    console.log(`📤 Sent profile pic of ${jid}`);
  } catch (err) {
    console.error("❌ Error fetching profile picture:", err);
    await sock.sendMessage(m.key.remoteJid, {
      text: "❌ Failed to fetch profile picture."
    }, { quoted: m });
  }
};
