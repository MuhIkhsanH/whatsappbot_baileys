// save_image_on_caption.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

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

    sock.ev.on('creds.update', saveCreds);

    if (!fs.existsSync(GAMBAR_DIR)) fs.mkdirSync(GAMBAR_DIR, { recursive: true });

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
      for (const msg of messages) {
        if (!msg?.message) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const imgMsg = msg.message.imageMessage;
        if (!imgMsg) continue;

        const caption = imgMsg.caption || '';
        if (!caption.includes('.save')) continue; // Hanya simpan jika caption ada ".save"

        try {
          const stream = await downloadContentFromMessage(imgMsg, 'image');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

          const mimetype = imgMsg.mimetype || 'image/jpeg';
          const ext = mimetype.split('/')[1]?.split(';')[0] || 'jpg';

          const senderRaw = msg.key.fromMe ? 'saya' : (msg.pushName || msg.participant || msg.key.remoteJid);
          const safeSender = String(senderRaw).replace(/\W+/g, '_').slice(0, 40) || 'unknown';
          const ts = (msg.messageTimestamp?.low) ? Number(msg.messageTimestamp.low) * 1000 : Date.now();
          const filename = `${ts}_${safeSender}.${ext}`;
          const filepath = path.join(GAMBAR_DIR, filename);

          fs.writeFileSync(filepath, buffer);
          console.log('📥 Disimpan:', filepath);
        } catch (err) {
          console.error('❌ Gagal simpan gambar:', err?.message || err);
        }
      }
    });

  } catch (e) {
    console.error('Start error:', e?.message || e);
    setTimeout(() => start().catch(()=>{}), 2000);
  }
}

start();
