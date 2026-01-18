const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const express = require("express");
const readline = require("readline");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const ownerNumber = "6285883881264"; // Nomor Tujuan
const tokenRequired = "ryn";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let sock;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // SISTEM PAIRING CODE
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question("Masukkan Nomor Bot (Contoh: 62831xxx): ");
        const code = await sock.requestPairingCode(phoneNumber, "LILYBAIL");
        console.log(`\n╭────────────────────────────╮`);
        console.log(`  KODE PAIRING ANDA: ${code}  `);
        console.log(`╰────────────────────────────╯\n`);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("BOT TERHUBUNG DENGAN WHATSAPP!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // Endpoint untuk menerima data dari HTML
    app.post("/send-data", async (req, res) => {
        const { link, emoji } = req.body;
        const waktu = new Date().toLocaleString("id-ID");

        const caption = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\n` +
                        `ʟɪɴᴋ ᴄʜ : ${link}\n` +
                        `ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${emoji}\n` +
                        `ᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : Ya\n` +
                        `ᴡᴀᴋᴛᴜ : ${waktu}`;

        try {
            await sock.sendMessage(ownerNumber + "@s.whatsapp.net", { text: caption });
            res.status(200).send({ status: "success" });
        } catch (err) {
            res.status(500).send({ status: "failed" });
        }
    });
}

// Menjalankan Server Web & Bot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Web jalan di http://localhost:${PORT}`);
    startBot();
});
