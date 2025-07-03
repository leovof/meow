// plugins/autoViewStatus.js
let enabled = true;

module.exports = async (m, sock) => {
  const jid = m.key.remoteJid;
  const isMe = m.key.fromMe;
  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    "";

  // Command to toggle
  if (isMe && text.startsWith(".autoview ")) {
    const arg = text.split(" ")[1];
    if (arg === "on") {
      enabled = true;
      await sock.sendMessage(jid, { text: "✅ Auto view status is now *ON*" }, { quoted: m });
    } else if (arg === "off") {
      enabled = false;
      await sock.sendMessage(jid, { text: "❌ Auto view status is now *OFF*" }, { quoted: m });
    } else {
      await sock.sendMessage(jid, { text: "⚙️ Usage: .autoview on / off" }, { quoted: m });
    }
    return;
  }

  if (!enabled || m.key.remoteJid !== "status@broadcast") return;

  try {
    await sock.readMessages([m.key]);
    console.log(`👁 Viewed status from: ${m.pushName || m.key.participant}`);
  } catch (err) {
    console.error("❌ Error in autoViewStatus.js:", err);
  }
};
