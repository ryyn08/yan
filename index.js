const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    makeCacheableSignalKeyStore,
    PHONENUMBER_MCC
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3000;

// --- KONFIGURASI ---
const ownerNumber = "6285883881264"; // Nomor tujuan (penerima data)
const botNumber = "6283119396819";   // Nomor bot
const validToken = "ryn";            // Token akses
// --------------------

app.use(express.json());

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_ryn');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
        },
        printQRInTerminal: false, // Matikan QR karena pakai Pairing Code
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // Fitur Pairing Code
    if (!sock.authState.creds.registered) {
        let phoneNumber = botNumber;
        if (phoneNumber) {
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                console.log("Nomor bot harus dimulai dengan kode negara seperti 62!");
            } else {
                setTimeout(async () => {
                    let code = await sock.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(`\n\x1b[32mKODE PAIRING ANDA: ${code}\x1b[0m\n`);
                }, 3000);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Bot WhatsApp Terkoneksi!');
        }
    });

    // Endpoint untuk menerima data dari Frontend
    app.post('/send-data', async (req, res) => {
        const { link, react, token, time } = req.body;

        if (token !== validToken) {
            return res.status(403).json({ success: false, message: "Token Invalid" });
        }

        const caption = `𝐇𝐈 𝐀𝐃𝐌𝐈𝐍 𝐓𝐇𝐄𝐑𝐄'𝐒 𝐍𝐄𝐖 𝐂𝐇 𝐃𝐀𝐓𝐀 𝐇𝐄𝐑𝐄🪀\n\n` +
                        `ʟɪɴᴋ ᴄʜ : ${link}\n` +
                        `ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪ : ${react}\n` +
                        `ᴋᴇᴍʙᴀʟɪ ᴀᴋᴛɪꜰ : 10 Menit\n` +
                        `ᴡᴀᴋᴛᴜ : ${time}`;

        try {
            await sock.sendMessage(ownerNumber + "@s.whatsapp.net", { text: caption });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
}

// Route Frontend (HTML)
app.get('/', (req, res) => {
    res.send(`
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
        #customPopup { display: none; animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    </style>
</head>
<body class="flex items-center justify-center p-4">
    <div class="max-w-md w-full glass-card rounded-2xl p-8 shadow-2xl">
        <div class="text-center mb-8">
            <i class="fas fa-bolt text-4xl text-purple-500 mb-4"></i>
            <h1 class="text-2xl font-bold tracking-tight">React Channel by ryyn</h1>
            <p class="text-slate-400 text-sm">Masukan URL dan Token</p>
        </div>

        <div id="cooldownDisplay" class="hidden mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-center">
            <p id="timerText" class="text-xl font-mono text-white">00:00:00</p>
        </div>

        <div class="space-y-4">
            <input type="text" id="postUrl" placeholder="Link Channel" class="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 focus:border-purple-500 outline-none text-sm">
            <input type="text" id="reactEmoji" placeholder="Emoji" class="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 focus:border-purple-500 outline-none text-sm">
            <input type="text" id="tokenRyn" placeholder="Masukan Token" class="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 focus:border-purple-500 outline-none text-sm">
            
            <button onclick="submitReact()" id="btnSubmit" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 font-bold py-3 rounded-xl shadow-lg mt-4">
                Kirim React
            </button>
        </div>
    </div>

    <div id="customPopup" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div class="glass-card max-w-sm w-full p-8 rounded-3xl text-center">
            <h2 class="text-2xl font-bold mb-2">Berhasil!</h2>
            <p class="text-slate-300 mb-6">Data telah dikirim otomatis ke Owner.</p>
            <button onclick="closePopup()" class="w-full bg-slate-700 py-2 rounded-lg">Tutup</button>
        </div>
    </div>

    <script>
        async function submitReact() {
            const url = document.getElementById('postUrl').value;
            const react = document.getElementById('reactEmoji').value;
            const token = document.getElementById('tokenRyn').value;
            const timeNow = new Date().toLocaleTimeString();

            if (!url || !react || !token) return alert('Isi semua field!');

            const btn = document.getElementById('btnSubmit');
            btn.innerHTML = 'Memproses...';

            try {
                // Proses API luar
                await fetch(\`https://api-faa.my.id/faa/react-channel?url=\${encodeURIComponent(url)}&react=\${encodeURIComponent(react)}\`);
                
                // Kirim otomatis ke bot Node.js (untuk diteruskan ke owner)
                const res = await fetch('/send-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ link: url, react: react, token: token, time: timeNow })
                });

                const data = await res.json();
                if(data.success) {
                    document.getElementById('customPopup').style.display = 'flex';
                } else {
                    alert('Token Salah atau Bot Mati');
                }
            } catch (e) { alert('Error: ' + e.message); }
            finally { btn.innerHTML = 'Kirim React'; }
        }
        function closePopup() { document.getElementById('customPopup').style.display = 'none'; }
    </script>
</body>
</html>
    `);
});

startBot();
app.listen(port, () => console.log(`Server running on port ${port}`));
