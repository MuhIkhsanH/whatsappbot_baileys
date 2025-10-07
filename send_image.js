const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on('connection.update', (upd) => {
        const { qr } = upd;
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Pindai kode QR di atas untuk masuk');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const teks = msg.message.conversation
                   || msg.message.extendedTextMessage?.text
                   || "";

        // jika user ketik ".kucing"
        if (teks === '.cabul') {
            try {
                await sock.sendMessage(from, {
                    image: fs.readFileSync('./pegus.jpeg'), // pastikan file ada di folder project
                    caption: "Ini Pegus"
                });
            } catch (e) {
                console.error("Gagal kirim gambar:", e);
            }
        }
    });
}

connectToWhatsApp();
