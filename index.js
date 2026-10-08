import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    markOnlineOnConnect: false,
    printQRInTerminal: false
  });

  if (!state.creds.registered) {
    const phone = await question(
      "شماره واتساپ را با کد کشور وارد کنید (فقط عدد): "
    );

    const number = phone.replace(/\D/g, "");

    try {
      const code = await sock.requestPairingCode(number);

      console.log("");
      console.log("================================");
      console.log("🔐 کد اتصال واتساپ:");
      console.log(code);
      console.log("================================");
      console.log("");
    } catch (error) {
      console.error("❌ خطا:", error);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ واتساپ با موفقیت وصل شد!");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : null;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 اتصال قطع شد؛ دوباره وصل می‌شوم...");
        startBot();
      } else {
        console.log("🚪 اتصال واتساپ خارج شده است.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      if (!message.message || message.key.fromMe) continue;

      const jid = message.key.remoteJid;

      console.log("📩 پیام جدید از:", jid);

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";

      if (text === "/منو") {
        await sock.sendMessage(jid, {
          text:
`🤖 منوی ربات

/عکس_تایمر
/ویدیو_تایمر
/وایس_تایمر
/دانلود_آهنگ
/دانلود_ویدیو`
        });
      }
    }
  });
}

startBot();