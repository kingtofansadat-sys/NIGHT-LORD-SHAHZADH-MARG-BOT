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
    markOnlineOnConnect: false
  });

  let pairingRequested = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // گرفتن Pairing Code
    if (qr && !sock.authState.creds.registered && !pairingRequested) {
      pairingRequested = true;

      try {
        const phone = await question(
          "شماره واتساپ را با کد کشور وارد کنید (فقط عدد): "
        );

        const number = phone.replace(/\D/g, "");

        const code = await sock.requestPairingCode(number);

        console.log("");
        console.log("================================");
        console.log("🔐 PAIRING CODE:");
        console.log(code);
        console.log("================================");
        console.log("");
      } catch (error) {
        console.error("❌ خطا در گرفتن کد:", error);
        pairingRequested = false;
      }
    }

    // اتصال موفق
    if (connection === "open") {
      console.log("✅ واتساپ با موفقیت وصل شد!");
      rl.close();
    }

    // قطع اتصال
    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : null;

      const reconnect =
        statusCode !== DisconnectReason.loggedOut;

      console.log("❌ اتصال قطع شد.");

      if (reconnect) {
        console.log("🔄 تلاش برای اتصال دوباره...");
        startBot();
      } else {
        console.log("🚪 حساب از ربات خارج شده است.");
      }
    }
  });

  // ذخیره اطلاعات اتصال
  sock.ev.on("creds.update", saveCreds);

  // دریافت پیام
  sock.ev.on("messages.upsert", async (event) => {
    if (event.type !== "notify") return;

    for (const message of event.messages) {
      if (message.key.fromMe) continue;

      const jid = message.key.remoteJid;

      if (!jid) continue;

      console.log("📩 پیام جدید از:", jid);
    }
  });
}

startBot();