// plugins/statussender.js
const fs = require("fs");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = async (m, sock) => {
  try {
    const textMsg =
      m.message?.extendedTextMessage?.text ||
      m.message?.conversation ||
      "";

    const msg = m;
    const jid = m.key.remoteJid;

    // ✅ Only run in inbox (not groups)
    if (jid.endsWith("@g.us")) return;

    if (!textMsg || typeof textMsg !== "string") return;

    const data = fs.readFileSync("./keywords.json", "utf-8");
    const keywords = JSON.parse(data);

    const keywordMatch = keywords.find(k =>
      textMsg.toLowerCase().includes(k)
    );
    if (!keywordMatch) return;

    console.log(`💬 Triggered by keyword: "${keywordMatch}" from ${jid}`);

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return;

    const mediaType = quoted.imageMessage
      ? "imageMessage"
      : quoted.videoMessage
      ? "videoMessage"
      : null;
    if (!mediaType) return;

    const mediaMessage = quoted[mediaType];
    const stream = await downloadContentFromMessage(mediaMessage, mediaType.replace("Message", ""));
    const chunks = [];
    for await (let chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // ✅ Use original caption if available
    const originalCaption = mediaMessage.caption || undefined;

    await sock.sendMessage(jid, {
      [mediaType.includes("image") ? "image" : "video"]: buffer,
      ...(originalCaption ? { caption: originalCaption } : {})
    }, { quoted: m });

  } catch (err) {
    console.error("❌ Auto Status Reply Error:", err);
  }
};
