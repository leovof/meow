const games = new Map();

const emojiMap = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

function renderBoard(board) {
  return (
    [0, 1, 2].map(i => (board[i] || emojiMap[i])).join(" | ") + "\n" +
    [3, 4, 5].map(i => (board[i] || emojiMap[i])).join(" | ") + "\n" +
    [6, 7, 8].map(i => (board[i] || emojiMap[i])).join(" | ")
  );
}

function checkWin(board, sym) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return wins.some(p => p.every(i => board[i] === sym));
}

module.exports = async (m, sock) => {
  const normalizeJid = jid => jid?.split(":")[0]?.split("/")[0];

  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
    "";

  const jid = m.key.remoteJid;
  const botId = normalizeJid(sock.user.id);
  const botName = sock.user.name;

  // ✅ Correctly identify sender even in inbox chat
  let actualSender;
  if (jid.endsWith("@s.whatsapp.net")) {
    actualSender = normalizeJid(m.key.fromMe ? botId : jid);
  } else {
    actualSender = normalizeJid(m.key.participant || m.key.remoteJid);
  }

  if (!jid.endsWith("@s.whatsapp.net")) return; // inbox only

  const isCommand = text.startsWith(".tt");

  if (isCommand) {
    const args = text.trim().split(/\s+/);
    const cmd = args[1];

    if (cmd === "start") {
      const board = Array(9).fill(null);
      const partner = actualSender === jid ? botId : jid;

      const game = {
        board,
        playerX: actualSender,
        playerO: partner,
        players: [actualSender, partner],
        symbols: {
          [actualSender]: "❌",
          [partner]: "⭕️"
        },
        history: {
          [actualSender]: [],
          [partner]: []
        },
        currentTurn: actualSender
      };

      games.set(jid, game);

      return sock.sendMessage(jid, {
        text:
          `🎮 Game started between:\n` +
          `@${actualSender.split("@")[0]} (❌) and @${partner.split("@")[0]} (⭕️)\n\n` +
          `🌀 Turn: @${actualSender.split("@")[0]}\n\n` +
          renderBoard(board),
        mentions: [actualSender, partner]
      }, { quoted: m });
    }

    if (cmd === "board") {
      const game = games.get(jid);
      if (!game) {
        return sock.sendMessage(jid, { text: "🎲 No game in progress." }, { quoted: m });
      }

      const { board, currentTurn, playerX, playerO, symbols } = game;
      const currentMention = `@${currentTurn.split("@")[0]}`;

      return sock.sendMessage(jid, {
        text:
          `🌀 Current turn: ${currentMention}\n\n` +
          renderBoard(board) +
          `\n\n@${playerX.split("@")[0]} ${symbols[playerX]}\n@${playerO.split("@")[0]} ${symbols[playerO]}`,
        mentions: [playerX, playerO]
      }, { quoted: m });
    }

    if (cmd === "end") {
      if (!games.has(jid)) {
        return sock.sendMessage(jid, { text: "⚠️ No game in progress." }, { quoted: m });
      }
      games.delete(jid);
      return sock.sendMessage(jid, { text: "🛑 Game ended." }, { quoted: m });
    }

    return sock.sendMessage(jid, {
      text: "🎮 Commands:\n.tt start - Start new game\n.tt board - Show board\n.tt end - End game"
    }, { quoted: m });
  }

  const game = games.get(jid);
  if (!game) return;

  const num = parseInt(text.trim());
  if (isNaN(num) || num < 1 || num > 9) return;

  const pos = num - 1;
  const { board, currentTurn, symbols, history, playerX, playerO } = game;

  if (![playerX, playerO].includes(actualSender)) {
    return sock.sendMessage(jid, { text: "🚫 You're not part of this game." }, { quoted: m });
  }

  if (actualSender !== currentTurn) {
    return sock.sendMessage(jid, { text: "⏳ It's not your turn." }, { quoted: m });
  }

  if (board[pos]) {
    return sock.sendMessage(jid, { text: "🚫 That spot is already taken." }, { quoted: m });
  }

  const symbol = symbols[currentTurn];
  const moves = history[currentTurn];
 if (moves.length >= 3) {
    const old = moves.shift();
    board[old] = null;
  }

  board[pos] = symbol;
  moves.push(pos);

  if (checkWin(board, symbol)) {
    games.delete(jid);
    const winMention = `@${currentTurn.split("@")[0]}`;
    return sock.sendMessage(jid, {
      text:
        `🎉 ${symbol} wins!\n👏 Congrats ${winMention}!\n\n` +
        renderBoard(board) +
        `\n\n@${playerX.split("@")[0]} ${symbols[playerX]}\n@${playerO.split("@")[0]} ${symbols[playerO]}`,
      mentions: [playerX, playerO]
    }, { quoted: m });
  }

  const next = currentTurn === playerX ? playerO : playerX;
  game.currentTurn = next;

  const nextMention = `@${next.split("@")[0]}`;

  return sock.sendMessage(jid, {
    text:
      `✅ Move accepted.\n\n🌀 Turn: ${nextMention}\n\n` +
      renderBoard(board) +
      `\n\n@${playerX.split("@")[0]} ${symbols[playerX]}\n@${playerO.split("@")[0]} ${symbols[playerO]}`,
    mentions: [playerX, playerO]
  }, { quoted: m });
};
