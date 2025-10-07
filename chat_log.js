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
        const { qr, connection } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Pindai kode QR di atas untuk masuk');
        }
        if (connection === 'open') console.log('✅ Terhubung ke WhatsApp!');
    });

    // Simpan session
    sock.ev.on('creds.update', saveCreds);

    // Tangani pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid; // chat id
        const isGroup = from.endsWith('@g.us'); // cek group
        const sender = msg.key.fromMe ? 'Ini saya' : msg.pushName || msg.participant || from;
        const pesan = msg.message.conversation || msg.message.extendedTextMessage?.text || '[Media/Other]';

        // Log ke console
        console.log('---------------------------------');
        console.log('Chat ID:', from);
        console.log('Tipe:', isGroup ? 'Group' : 'Personal');
        console.log('Pengirim:', sender);
        console.log('Pesan:', pesan);

        // Contoh balas
        if (pesan === '.halo') {
            await sock.sendMessage(from, { text: 'halo juga' });
        }
    });
}

connectToWhatsApp();
