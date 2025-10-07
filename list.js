// list.js
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', (upd) => {
        const { connection, qr } = upd;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('Bot sudah online!');
        else if (connection) console.log('connection update ->', connection);
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            // ambil teks dari berbagai bentuk pesan (conversation, extendedText, listResponse, templateButtonReply)
            const teksRaw = msg.message.conversation
                         || msg.message.extendedTextMessage?.text
                         || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
                         || msg.message.templateButtonReplyMessage?.selectedId
                         || "";

            const teks = (typeof teksRaw === 'string') ? teksRaw.trim() : "";

            // kirim list (format yang biasanya diterima oleh Baileys)
            if (teks === '.menu') {
                // kirim list (interactive) — many clients render; some clients may not, so fallback di bawah
                await sock.sendMessage(from, {
                    text: "Silakan pilih menu di bawah ini:",
                    title: "📌 Menu Utama",
                    footer: "Bot Baileys",
                    buttonText: "Klik untuk memilih",
                    sections: [
                        {
                            title: "Informasi",
                            rows: [
                                { title: "👤 Profil", rowId: "menu_profil", description: "Lihat profil" },
                                { title: "📜 Bantuan", rowId: "menu_bantuan", description: "Cara pakai bot" }
                            ]
                        },
                        {
                            title: "Hiburan",
                            rows: [
                                { title: "🐱 Kirim Kucing", rowId: "menu_kucing", description: "Kirim gambar kucing" },
                                { title: "🎲 Main Game", rowId: "menu_game", description: "Mini game sederhana" }
                            ]
                        }
                    ]
                });

                // fallback instruksi agar user bisa pilih pake angka kalau list nggak muncul
                await sock.sendMessage(from, {
                    text:
`Jika menu tidak muncul di perangkatmu, ketik angka untuk memilih:
1. Profil
2. Bantuan
3. Kirim Kucing
4. Main Game

Contoh: kirim "3" untuk Kirim Kucing.`
                });
                return;
            }

            // tangani respon dari list (kalo muncul) atau template button
            if (msg.message?.listResponseMessage) {
                const selectedId = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
                await handleMenuSelection(selectedId, from, sock);
                return;
            }
            if (msg.message?.templateButtonReplyMessage) {
                const selectedId = msg.message.templateButtonReplyMessage.selectedId;
                await handleMenuSelection(selectedId, from, sock);
                return;
            }

            // tangani fallback numeric (user ketik 1 - 4)
            if (/^[1-4]$/.test(teks)) {
                const map = { '1': 'menu_profil', '2': 'menu_bantuan', '3': 'menu_kucing', '4': 'menu_game' };
                await handleMenuSelection(map[teks], from, sock);
                return;
            }

            // contoh simple command lain
            if (teks === '.kucing') {
                await sendLocalImage(from, './kucing.jpg', 'Ini kucing 🐱', sock);
                return;
            }

        } catch (err) {
            console.error('messages.upsert error', err);
        }
    });
}

async function handleMenuSelection(id, from, sock) {
    try {
        if (!id) return;
        if (id === 'menu_profil') {
            await sock.sendMessage(from, { text: "👤 Ini profilmu (contoh):\n- Nama: User\n- Role: Member" });
        } else if (id === 'menu_bantuan') {
            await sock.sendMessage(from, { text: "📜 Bantuan:\nKetik .menu untuk buka menu. Ketik angka jika list tidak tampil." });
        } else if (id === 'menu_kucing') {
            await sendLocalImage(from, './kucing.jpg', 'Ini kucing 🐱', sock);
        } else if (id === 'menu_game') {
            await sock.sendMessage(from, { text: "🎲 Game belum aktif. Nanti saya tambahkan." });
        } else {
            await sock.sendMessage(from, { text: "Pilihan tidak dikenali." });
        }
    } catch (e) {
        console.error('handleMenuSelection error', e);
    }
}

async function sendLocalImage(to, path, caption, sock) {
    try {
        const buffer = fs.readFileSync(path);
        await sock.sendMessage(to, { image: buffer, caption: caption });
    } catch (e) {
        console.error('sendLocalImage error', e);
        await sock.sendMessage(to, { text: `Gagal kirim gambar. Pastikan file ${path} ada.` });
    }
}

connectToWhatsApp().catch(console.error);
