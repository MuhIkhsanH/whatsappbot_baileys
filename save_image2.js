// its just debug not the code :p
// debug_media.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
    if (qr) { qrcode.generate(qr, { small: true }); console.log('Pindai QR untuk login'); }
    if (connection === 'open') console.log('✅ Terhubung');
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
      if (reason !== DisconnectReason.loggedOut) setTimeout(() => start().catch(()=>{}), 2000);
      else console.log('Logged out. Hapus auth_info_baileys dan scan ulang QR.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    messages = Array.isArray(messages) ? messages : [messages];
    for (const msg of messages) {
      if (!msg?.message) continue;

      console.log('----------------------------------------');
      console.log('Chat ID:', msg.key.remoteJid);
      console.log('From Me:', msg.key.fromMe);
      console.log('Push Name:', msg.pushName);
      console.log('Timestamp:', msg.messageTimestamp?.low || Date.now());
      
      // Tentukan tipe pesan
      let tipe = 'unknown';
      if (msg.message.imageMessage) tipe = 'image';
      else if (msg.message.videoMessage) tipe = 'video';
      else if (msg.message.documentMessage) tipe = 'document';
      else if (msg.message.stickerMessage) tipe = 'sticker';
      else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) tipe = 'quotedMessage';
      else if (msg.message.ephemeralMessage) tipe = 'ephemeral';
      console.log('Tipe Pesan:', tipe);

      // Cek apakah ada teks
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      console.log('Teks Pesan:', text || '[Media/Other]');

      // Print seluruh object message untuk melihat struktur
      console.log('Raw message object:', JSON.stringify(msg.message, null, 2));
      console.log('----------------------------------------');
    }
  });
}

start();
