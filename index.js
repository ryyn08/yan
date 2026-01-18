const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const readline = require("readline");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- KONFIGURASI ---
const OWNER_NUMBER = "6285883881264"; // Nomor tujuan notifikasi
const BOT_NUMBER = "6283119396819";   // Nomor bot
const AUTH_TOKEN = "ryn";             // Token keamanan

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let sock; // Variabel untuk menyimpan koneksi socket Baileys

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("session");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // Kita pakai pairing code
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // Fitur Pairing Code
    if (!sock.authState.creds.registered) {
        console.log("--- BOT BY RYYN ---");
        const phoneNumber = await question('Masukkan Nomor Bot (Contoh: 628xxx): ');
        const code = await sock.requestPairingCode(phoneNumber, "LILYBAIL");
        console.log(`\nKODE PAIRING ANDA: ${code}\n`);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log("Koneksi WhatsApp Berhasil Terhubung!");
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

// --- ENDPOINT UNTUK MENERIMA DATA DARI WEB ---
app.post("/send-notif", async (req, res) => {
    const { token, link, emoji, waktu } = req.body;

    if (token !== AUTH_TOKEN) {
        return res.status(403).json({ status: false, message: "Token tidak valid!" });
    }

    const textMsg = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\n` +
                    `ʟɪɴᴋ ᴄʜ : ${link}\n` +
                    `ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${emoji}\n` +
                    `ᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : ${waktu}\n` +
                    `ᴡᴀᴋᴛᴜ : ${new Date().toLocaleString('id-ID')}`;

    try {
        if (sock && sock.authState.creds.registered) {
            await sock.sendMessage(`${OWNER_NUMBER}@s.whatsapp.net`, { text: textMsg });
            res.json({ status: true, message: "Notifikasi terkirim ke owner!" });
        } else {
            res.status(500).json({ status: false, message: "Bot belum login!" });
        }
    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
});

// Serve HTML (Gabung jadi satu file)
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>React Channel Booster</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); min-height: 100vh; color: white; }
                .glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(139, 92, 246, 0.3); }
            </style>
        </head>
        <body class="flex items-center justify-center p-4">
            <div class="max-w-md w-full glass-card rounded-2xl p-8 shadow-2xl">
                <div class="text-center mb-8">
                    <i class="fas fa-bolt text-4xl text-purple-500 mb-4"></i>
                    <h1 class="text-2xl font-bold">React Channel by ryyn</h1>
                </div>

                <div class="space-y-4">
                    <input type="text" id="postUrl" placeholder="Link Channel" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm">
                    <input type="text" id="reactEmoji" placeholder="Emoji (contoh: 🔥)" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm">
                    <button onclick="submitReact()" id="btnSubmit" class="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-xl transition-all">Kirim React</button>
                </div>
            </div>

            <script>
                async function submitReact() {
                    const url = document.getElementById('postUrl').value;
                    const react = document.getElementById('reactEmoji').value;
                    const btn = document.getElementById('btnSubmit');

                    if(!url || !react) return alert('Isi semua bidang!');
                    
                    btn.innerText = "Memproses...";
                    
                    try {
                        // Kirim data ke backend bot kita sendiri
                        const res = await fetch('/send-notif', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                token: "ryn",
                                link: url,
                                emoji: react,
                                waktu: "10 Menit"
                            })
                        });
                        const data = await res.json();
                        if(data.status) alert('Berhasil! Notifikasi terkirim ke owner.');
                        else alert('Gagal: ' + data.message);
                    } catch (e) {
                        alert('Error koneksi server');
                    } finally {
                        btn.innerText = "Kirim React";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
    connectToWhatsApp();
});
