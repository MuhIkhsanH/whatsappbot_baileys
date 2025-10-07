// save_image.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const GAMBAR_DIR = path.join(__dirname, 'gambarwa');

async function start() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: 'silent' })
    });

    // Simpan credentials
    sock.ev.on('creds.update', saveCreds);

    // Buat folder gambar jika belum ada
    if (!fs.existsSync(GAMBAR_DIR)) fs.mkdirSync(GAMBAR_DIR, { recursive: true });

    // Tangani QR / koneksi
    sock.ev.on('connection.update', (update) => {
      const { qr, connection, lastDisconnect } = update;
      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log('Pindai QR di terminal untuk login');
      }
      if (connection === 'open') {
        console.log('✅ Terhubung');
      }
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
        // reconnect jika bukan logged out permanent
        if (reason !== DisconnectReason.loggedOut) {
          console.log('🔄 Koneksi tertutup, reconnecting...');
          setTimeout(() => start().catch(()=>{}), 2000);
        } else {
          console.log('Keluar (logged out). Hapus auth_info_baileys dan scan ulang QR.');
        }
      }
    });

    // Tangani pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
      try {
        const messages = Array.isArray(m.messages) ? m.messages : [m.messages];
        for (const msg of messages) {
          if (!msg || !msg.message) continue;
          // skip status
          if (msg.key.remoteJid === 'status@broadcast') continue;

          // cari media di berbagai tempat (direct / quoted)
          const imageMsg =
            msg.message.imageMessage ||
            msg.message.stickerMessage ||
            msg.message.videoMessage ||
            msg.message.documentMessage ||
            msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
            msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage ||
            msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;

          if (!imageMsg) continue;

          // tentukan jenis dan ekstensi
          const mimetype = imageMsg.mimetype || imageMsg.mediaKey && 'application/octet-stream' || '';
          let mediaType = 'document'; // fallback
          if (imageMsg.imageMessage) mediaType = 'image';
          if (imageMsg.videoMessage) mediaType = 'video';
          // detect sticker/webp
          if (mimetype && mimetype.includes('image')) mediaType = 'image';
          if (mimetype && mimetype.includes('video')) mediaType = 'video';
          if (mimetype && mimetype.includes('webp')) mediaType = 'image';

          // download stream
          const stream = await downloadContentFromMessage(imageMsg, mediaType);
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

          // tentukan ekstensi aman
          let ext = 'bin';
          if (mimetype) {
            const parts = mimetype.split('/');
            ext = (parts[1] || 'bin').split(';')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
          } else {
            // coba tebak dari mediaType
            ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'bin';
          }

          // nama file aman
          const senderRaw = msg.key.fromMe ? 'saya' : (msg.pushName || msg.participant || msg.key.remoteJid);
          const safeSender = String(senderRaw).replace(/\W+/g, '_').slice(0, 40) || 'unknown';
          const ts = (msg.messageTimestamp && msg.messageTimestamp.low) ? Number(msg.messageTimestamp.low) * 1000 : Date.now();
          const filename = `${ts}_${safeSender}.${ext}`;
          const filepath = path.join(GAMBAR_DIR, filename);

          // tulis file
          fs.writeFileSync(filepath, buffer);
          console.log('📥 Disimpan:', filepath);
        }
      } catch (err) {
        // jangan ganggu proses, tampilkan ringkas
        console.error('Error simpan media:', err?.message || err);
      }
    });
  } catch (e) {
    console.error('Start error:', e?.message || e);
    setTimeout(() => start().catch(()=>{}), 2000);
  }
}

start();
