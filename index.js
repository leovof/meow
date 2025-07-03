
// START: Clean Logging Block
const originalLog = console.log;
const originalError = console.error;

function shouldFilter(message) {
    return (
        message.includes('Closing open session in favor of incoming prekey bundle') ||
        message.includes('Closing session: SessionEntry') ||
        message.includes('@g.us') || // WhatsApp group JIDs
        message.includes('received app state sync key') ||
        message.includes('app state sync key')
    );
}

console.log = function (...args) {
    const msg = args.join(' ');
    if (shouldFilter(msg)) return;
    originalLog.apply(console, args);
};

console.error = function (...args) {
    const msg = args.join(' ');
    if (shouldFilter(msg)) return;
    originalError.apply(console, args);
};
// END: Clean Logging Block

//index.js for Baileys v6.6.0 with full support and working store
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser,
  makeInMemoryStore,
  proto
} = require("@whiskeysockets/baileys");
const { Browsers } = require("@whiskeysockets/baileys");

const fs = require("fs");
const path = require("path");
const P = require("pino");
const qrcode = require("qrcode-terminal");

// === Plugin system ===
const PLUGIN_DIR = path.join(__dirname, "plugins");

// === Registry system ===
let registeredUsers = new Set();
let registeredGroups = new Set();

if (fs.existsSync("registered.json")) {
  const data = JSON.parse(fs.readFileSync("registered.json"));
  registeredUsers = new Set(data.users || []);
  registeredGroups = new Set(data.groups || []);
}

const saveRegistry = () => {
  fs.writeFileSync(
    "registered.json",
    JSON.stringify({
      users: Array.from(registeredUsers),
      groups: Array.from(registeredGroups),
    }, null, 2)
  );
};

const startBot = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const store = makeInMemoryStore({ logger: P({ level: "silent" }) });

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    browser: Browsers.ubuntu("Ninja Bot"),
    getMessage: async (key) => {
      return (await store.loadMessage(key.remoteJid, key.id)) || {};
    },
  });

  store.bind(sock.ev);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
  if (qr) {
    qrcode.generate(qr, { small: true }); // Show QR in terminal
  }

  if (connection === "close") {
    const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    if (shouldReconnect) {
      console.log("🔄 Reconnecting...");
      startBot();
    } else {
      console.log("❌ Logged out.");
    }
  } else if (connection === "open") {
    console.log("✅ Bot is ready.");
    await sock.sendPresenceUpdate("unavailable");

    const groups = await sock.groupFetchAllParticipating();
    for (const id in groups) {
      const name = groups[id].subject;
      console.log(`📌 Group: ${name} → JID: ${id}`);
    }
  }
});


  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m?.message) return;
    const jid = m.key.remoteJid;
    const sender = jidNormalizedUser(m.key.participant || m.key.remoteJid);
    const isMe = m.key.fromMe;
    const isGroup = jid.endsWith("@g.us");

    const text = m.message?.conversation ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      m.message?.videoMessage?.caption || "";

    await sock.sendPresenceUpdate("unavailable");

    if (text.startsWith(".reg ") && isMe) {
      const target = text.split(" ")[1];
      if (!target) return;
      if (target.endsWith("@g.us")) {
        registeredGroups.add(target);
        await sock.sendMessage(jid, { text: `✅ Registered group: ${target}` }, { quoted: m });
      } else if (/^\+?\d{6,}$/.test(target)) {
        const number = target.replace("+", "") + "@s.whatsapp.net";
        registeredUsers.add(number);
        await sock.sendMessage(jid, { text: `✅ Registered user: ${number}` }, { quoted: m });
      } else {
        await sock.sendMessage(jid, {
          text: `❌ Invalid format. Use:\n.reg +9471234567\n.reg group_jid`,
        }, { quoted: m });
      }
      return saveRegistry();
    }

    // Always run statussender.js (even if unregistered)
try {
  const statusSender = require(path.join(PLUGIN_DIR, "statussender.js"));
  if (typeof statusSender === "function") await statusSender(m, sock, store);
} catch (err) {
  console.error("❌ Error in statussender.js:", err);
}

// Run all other plugins only for registered users/groups
if (!isMe && !registeredUsers.has(sender) && !registeredGroups.has(jid)) return;

if (fs.existsSync(PLUGIN_DIR)) {
  const files = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith(".js") && f !== "statussender.js");
  for (const file of files) {
    try {
      const plugin = require(path.join(PLUGIN_DIR, file));
      if (typeof plugin === "function") {
        await plugin(m, sock, store);
      }
    } catch (err) {
      console.error(`❌ Plugin error in ${file}:`, err);
    }
  }
}

if (!store[jid]) store[jid] = {};
store[jid][m.key.id] = m;
  });


  // Reactions (like/unlike)
  sock.ev.on("messages.reaction", async (events) => {
    for (const m of events) {
      try {
        const plugin = require(path.join(PLUGIN_DIR, "likeStatusSave.js"));
        if (typeof plugin === "function") await plugin(m, sock, store);
      } catch (err) {
        console.error("❌ Error in likeStatusSave plugin:", err);
      }
    }
  }
);
};

startBot();
