// bot.js

// Impor pustaka yang diperlukan
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ================= KONFIGURASI BOT =================
// Ganti dengan Nomor WhatsApp ID Owner (misalnya: '6281234567890@c.us')
// Anda bisa mendapatkan ID lengkap ini dengan mencatat ID pengirim saat Anda mengirim pesan ke bot.
const OWNER_NUMBER = '6281775442315@c.us';
let currentMode = 'public'; // Mode default: 'public' atau 'private'
// ===================================================

console.log("Mempersiapkan bot WhatsApp...");

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium', // Sesuaikan jika path Chromium Anda berbeda, atau hapus jika ingin Puppeteer mengunduh sendiri
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

console.log("Client WhatsApp sedang diinisialisasi...");

client.on('qr', (qr) => {
    console.log('QR CODE DITERIMA, Pindai dengan WhatsApp Anda:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('Otentikasi BERHASIL!');
});

client.on('auth_failure', msg => {
    console.error('Otentikasi GAGAL:', msg);
});

client.on('ready', () => {
    console.log('Client SIAP DIGUNAKAN!');
    console.log(`Bot terhubung sebagai: ${client.info.pushname} (${client.info.wid._serialized})`);
    if (OWNER_NUMBER === 'NOMOR_OWNER_ANDA@c.us') {
        console.warn("PERHATIAN: Harap ganti 'NOMOR_OWNER_ANDA@c.us' dengan nomor WhatsApp ID Anda di skrip!");
    }
    console.log(`Mode bot saat ini: ${currentMode.toUpperCase()}`);
});

client.on('message_create', async msg => {
    if (msg.isStatus) return; // Abaikan pembaruan status

    const chat = await msg.getChat();
    const contact = await msg.getContact(); // Objek kontak pengirim
    const senderName = contact.pushname || contact.name || contact.number;

    // Tentukan ID pengirim aktual untuk pemeriksaan izin
    let actualSenderId;
    if (msg.fromMe) { // Pesan dikirim oleh akun bot sendiri
        actualSenderId = client.info.wid._serialized;
    } else { // Pesan diterima dari orang lain
        actualSenderId = msg.author || msg.from; 
    }

    const isOwner = actualSenderId === OWNER_NUMBER;

    console.log(`[${new Date().toLocaleTimeString()}] Pesan: "${msg.body}" dari ${senderName} (${actualSenderId}). Owner: ${isOwner}. Mode: ${currentMode}. FromMe: ${msg.fromMe}`);

    // --- Perintah khusus Owner: !setmode, !statusmode ---
    if (msg.body.toLowerCase().startsWith('!setmode ') || msg.body.toLowerCase() === '!statusmode') {
        if (isOwner) {
            if (msg.body.toLowerCase().startsWith('!setmode ')) {
                const parts = msg.body.toLowerCase().split(' ');
                if (parts.length > 1) {
                    const newMode = parts[1];
                    if (newMode === 'private' || newMode === 'public') {
                        currentMode = newMode;
                        await msg.reply(`Mode bot diubah menjadi: *${currentMode.toUpperCase()}*`);
                        console.log(`Mode diubah menjadi ${currentMode.toUpperCase()} oleh owner (${actualSenderId}).`);
                    } else {
                        await msg.reply('Mode tidak valid. Gunakan `!setmode private` atau `!setmode public`');
                    }
                } else {
                    await msg.reply('Format salah. Gunakan: `!setmode [private/public]`');
                }
            } else if (msg.body.toLowerCase() === '!statusmode') {
                await msg.reply(`Mode bot saat ini: *${currentMode.toUpperCase()}*`);
            }
        } else {
            // Bisa dibalas atau diabaikan jika bukan owner
            console.log(`Pengguna ${senderName} (${actualSenderId}) mencoba perintah owner: ${msg.body}`);
            // await msg.reply('Anda tidak memiliki izin untuk perintah ini.');
        }
        return; 
    }



    if (msg.fromMe && actualSenderId !== OWNER_NUMBER) {
        console.log("Pesan dari bot sendiri (bot bukan OWNER_NUMBER terdaftar), diabaikan untuk mencegah loop.");
        return;
    }
    if (msg.fromMe && actualSenderId === OWNER_NUMBER) {
        console.log("Pesan dari bot sendiri (bot adalah OWNER_NUMBER), melanjutkan untuk proses perintah umum.");
    }

    // Jika dalam mode private dan pengirim bukan owner, abaikan.
    if (currentMode === 'private' && !isOwner) {
        console.log(`Pesan dari ${senderName} (${actualSenderId}) diabaikan (mode private). Isi: "${msg.body}"`);
        return;
    }

    // --- Perintah yang tersedia untuk publik (atau owner dalam mode private) ---
    if (msg.body.toLowerCase() === '!ping') {
        console.log(`Perintah !ping diterima dari ${senderName} (${actualSenderId})`);
        await msg.reply('Pong!');
    } else if (msg.body.toLowerCase().startsWith('!tagall')) {
        if (chat.isGroup) {

            const customMessage = msg.body.substring('!tagall'.length).trim();

            if (!customMessage) {
                await msg.reply("Silakan berikan pesan setelah perintah `!tagall`. Contoh: `!tagall Halo semua!`");
                return;
            }

            console.log(`Perintah !tagall diterima di grup "${chat.name}" dari ${senderName} (${actualSenderId}) dengan pesan: "${customMessage}"`);
            let mentions = [];

            try {
                for (let participant of chat.participants) {
                    // Kita hanya perlu mengumpulkan kontak untuk di-mention.
                    // Tidak perlu menambahkan @username ke dalam teks pesan yang terlihat.
                    const participantContact = await client.getContactById(participant.id._serialized);
                    mentions.push(participantContact);
                }

                if (mentions.length > 0) {
                    // Kirim HANYA pesan kustom, tetapi sertakan semua anggota dalam opsi 'mentions'
                    await chat.sendMessage(customMessage, { mentions });
                    console.log(`Berhasil melakukan tag all invisible di grup "${chat.name}" dengan pesan: "${customMessage}"`);
                } else {
                    await msg.reply("Tidak ada partisipan untuk di-tag di grup ini.");
                }
            } catch (err) {
                console.error("Error saat !tagall invisible:", err);
                await msg.reply("Terjadi kesalahan saat mencoba melakukan tag all.");
            }
        } else {
            await msg.reply('Perintah `!tagall` hanya bisa digunakan di grup.');
        }
    }
    // ... tambahkan perintah lain di sini ...
});

client.on('disconnected', (reason) => {
    console.log('Client TERPUTUS:', reason);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

console.log("Memulai client WhatsApp...");
client.initialize().catch(err => {
    console.error("Gagal menginisialisasi client:", err);
    process.exit(1);
});

console.log("Skrip selesai dieksekusi (inisialisasi sedang berjalan).");