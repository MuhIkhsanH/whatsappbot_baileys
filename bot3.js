const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    // QR Code
    sock.ev.on('connection.update', (update) => {
        const { qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Pindai kode QR di atas untuk masuk');
        }
    });

    // Simpan session
    sock.ev.on('creds.update', saveCreds);

    // Tangani pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const pesan = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (pesan === '.halo') {
            await sock.sendMessage(from, { text: 'halo juga' });
        }
    });
}

connectToWhatsApp();
