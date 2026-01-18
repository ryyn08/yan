const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;
let sock; // Variable untuk menyimpan koneksi bot

// KONFIGURASI
const ownerNumber = "6285883881264"; // Nomor tujuan notifikasi
const botNumber = "6283119396819"; // Nomor bot kamu
const tokenValid = "ryn";

// FRONTEND HTML (Disederhanakan dalam string agar jadi 1 file)
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>React Channel Booster</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); min-height: 100vh; color: white; font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(139, 92, 246, 0.3); }
    </style>
</head>
<body class="flex items-center justify-center p-4">
    <div class="max-w-md w-full glass-card rounded-2xl p-8 shadow-2xl">
        <div class="text-center mb-8">
            <i class="fas fa-bolt text-4xl text-purple-500 mb-4"></i>
            <h1 class="text-2xl font-bold tracking-tight">React Channel by ryyn</h1>
            <p class="text-slate-400 text-sm">Masukan data untuk booster</p>
        </div>

        <div class="space-y-4">
            <input type="text" id="token" placeholder="Masukan Token" class="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-sm mb-2">
            <input type="text" id="postUrl" placeholder="https://whatsapp.com/channel/..." class="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-sm">
            <input type="text" id="reactEmoji" placeholder="Masukan emoji..." class="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 text-sm">
            
            <button onclick="submitReact()" id="btnSubmit" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg">
                KIRIM SEKARANG
            </button>
        </div>
    </div>

    <script>
        async function submitReact() {
            const token = document.getElementById('token').value;
            const url = document.getElementById('postUrl').value;
            const react = document.getElementById('reactEmoji').value;

            if (token !== "${tokenValid}") return alert("Token Salah!");
            if (!url || !react) return alert("Isi semua bidang!");

            try {
                // Kirim data ke backend internal bot
                const response = await fetch('/send-data', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ url, react })
                });
                
                // Hit API eksternal (FAA)
                await fetch(\`https://api-faa.my.id/faa/react-channel?url=\${encodeURIComponent(url)}&react=\${encodeURIComponent(react)}\`);
                
                alert("Data Terkirim ke Owner & Sedang Diproses!");
            } catch (e) {
                alert("Gagal mengirim data");
            }
        }
    </script>
</body>
</html>
`;

// --- WHATSAPP BOT LOGIC ---
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session_wa");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // Kita pakai Pairing Code
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
    });

    // Fitur Pairing Code
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(botNumber);
            console.log("\n========================================");
            console.log("KODE PAIRING ANDA:", code);
            console.log("========================================\n");
        }, 3000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("BOT BERHASIL TERHUBUNG KE WHATSAPP");
        }
    });
}

// --- EXPRESS SERVER ---
app.use(express.json());

app.get("/", (req, res) => {
    res.send(htmlContent);
});

app.post("/send-data", async (req, res) => {
    const { url, react } = req.body;
    const waktu = new Date().toLocaleString("id-ID");

    const pesan = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\n` +
                  `ʟɪɴᴋ ᴄʜ : ${url}\n` +
                  `ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${react}\n` +
                  `ᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : Ya\n` +
                  `ᴡᴀᴋᴛᴜ : ${waktu}`;

    if (sock && sock.authState.creds.registered) {
        try {
            await sock.sendMessage(`${ownerNumber}@s.whatsapp.net`, { text: pesan });
            res.json({ status: "success" });
        } catch (err) {
            res.status(500).json({ status: "failed" });
        }
    } else {
        res.status(500).json({ status: "bot_not_ready" });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di port ${port}`);
    startBot();
});
