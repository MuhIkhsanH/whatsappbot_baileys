const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // agar log Baileys bersih
    });

    // QR code
    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Pindai kode QR di atas untuk masuk');
        }

        if (connection === 'open') {
            console.log('✅ Terhubung ke WhatsApp!');
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
            console.log('⚠️ Connection closed, reason:', reason);

            // Auto reconnect
            if (reason === DisconnectReason.restartRequired || reason === DisconnectReason.loggedOut) {
                console.log('🔄 Restarting bot...');
                connectToWhatsApp();
            }
        }
    });

    // Simpan session
    sock.ev.on('creds.update', saveCreds);

    // Tangani pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];

        // Abaikan pesan kosong / gagal decrypt
        if (!msg.message) return;

        const from = msg.key.remoteJid; // chat ID
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.fromMe ? 'Ini saya' : msg.pushName || msg.participant || from;
        const pesan = msg.message.conversation || msg.message.extendedTextMessage?.text || '[Media/Other]';

        // Waktu pesan
        const waktu = msg.messageTimestamp
            ? new Date(msg.messageTimestamp.low * 1000).toLocaleString()
            : new Date().toLocaleString();

        // Nama chat / group
        let chatName = from; // default
        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(from);
                chatName = metadata.subject;
            } catch (e) {
                chatName = from; // fallback
            }
        }

        // Log ke console
        console.log('---------------------------------');
        console.log('Waktu:', waktu);
        console.log('Chat Name / ID:', chatName);
        console.log('Tipe:', isGroup ? 'Group' : 'Personal');
        console.log('Pengirim:', sender);
        console.log('Pesan:', pesan);

        // Contoh auto-reply sederhana
        if (pesan === '.halo') {
            await sock.sendMessage(from, { text: 'halo juga' });
        }
    });
}

connectToWhatsApp();
