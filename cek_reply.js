// cek_reply.js
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', (upd) => {
        const { connection, qr } = upd;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('✅ Bot sudah online!');
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg || !msg.message) return;

            // 🚫 skip pesan yang dikirim bot sendiri
            if (msg.key.fromMe) return;

            const from = msg.key.remoteJid;

            // teks utama
            const teks =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // cek apakah pesan ini reply
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (quoted) {
                await sock.sendMessage(from, { text: `📩 Ini reply ke pesan sebelumnya:\n"${teks}"` });
            } else {
                await sock.sendMessage(from, { text: `💬 Ini pesan langsung:\n"${teks}"` });
            }

        } catch (err) {
            console.error('messages.upsert error', err);
        }
    });
}

connectToWhatsApp().catch(console.error);
