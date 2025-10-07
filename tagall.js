const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

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

        // jika user ketik ".tagall" di grup
        if (teks === '.tagall' && from.endsWith('@g.us')) {
            try {
                // ambil metadata grup
                const metadata = await sock.groupMetadata(from);
                const members = metadata.participants.map(p => p.id);

                // bikin teks dengan semua mention
                let textMention = "Tag All 👥\n\n";
                for (let id of members) {
                    const nomor = id.split('@')[0];
                    textMention += `@${nomor}\n`;
                }

                // kirim pesan dengan teks + mention
                await sock.sendMessage(from, {
                    text: textMention,
                    mentions: members
                });
            } catch (e) {
                console.error("Gagal ambil member grup:", e);
            }
        }
    });
}

connectToWhatsApp();
