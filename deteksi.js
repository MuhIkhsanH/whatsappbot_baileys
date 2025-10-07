// deteksi.js
// Node/Baileys: deteksi gambar ketika caption mengandung ".deteksi"
// Requirements: npm i @whiskeysockets/baileys pino qrcode-terminal axios form-data
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
const axios = require('axios');
const FormData = require('form-data');

const GAMBAR_DIR = path.join(__dirname, 'gambarwa'); // tempat sementara
const PREDICT_URL = 'http://127.0.0.1:5001/predict'; // endpoint deteksi.py

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
        try {
          if (!msg?.message) continue;
          if (msg.key.remoteJid === 'status@broadcast') continue;

          const imgMsg = msg.message.imageMessage;
          if (!imgMsg) continue;

          const caption = imgMsg.caption || '';
          if (!caption.includes('.deteksi')) continue; // trigger .deteksi

          // download image stream
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
          console.log('📥 Gambar disimpan sementara:', filepath);

          // kirim file ke deteksi.py (Flask) via form-data
          try {
            const form = new FormData();
            form.append('file', fs.createReadStream(filepath), { filename });

            const headers = form.getHeaders();
            const resp = await axios.post(PREDICT_URL, form, { headers, timeout: 30000 });
            const data = resp.data;

            if (data.error) {
              await sock.sendMessage(msg.key.remoteJid, { text: `❌ Error prediksi: ${data.error}` }, { quoted: msg });
              console.error('Predict error:', data.error);
            } else {
              const prediction = data.prediction || 'unknown';
              const confidence = (typeof data.confidence === 'number') ? data.confidence : (data.confidence || 0);
              const confStr = Number(confidence).toFixed(2) + '%';

              const replyText =
                `🔍 Hasil Deteksi:\n` +
                `• Prediksi: ${prediction}\n` +
                `• Confidence: ${confStr}`;

              // send text reply (quoted)
              await sock.sendMessage(msg.key.remoteJid, { text: replyText }, { quoted: msg });

              console.log('✅ Dikirimkan hasil ke user:', replyText);
            }
          } catch (err) {
            console.error('❌ Gagal menghubungi service prediksi:', err?.message || err);
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal prediksi: ${err?.message || err}` }, { quoted: msg });
          } finally {
            // optional: hapus file sementara
            try { fs.unlinkSync(filepath); } catch(e){/* ignore */ }
          }

        } catch (errInner) {
          console.error('Error processing message:', errInner);
        }
      }
    });

  } catch (e) {
    console.error('Start error:', e?.message || e);
    setTimeout(() => start().catch(()=>{}), 2000);
  }
}

start();
