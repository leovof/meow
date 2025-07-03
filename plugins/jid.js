module.exports = async (m, sock) => {
  const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
  if (!text.startsWith(".jid")) return;

  const jid = m.key.remoteJid;
  await sock.sendMessage(jid, { text: `🆔 JID: ${jid}` }, { quoted: m });
};
