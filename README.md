# POTBOOK

Pembukuan meja poker: buy-in, hitung chip, dan bagi transfer tanpa selisih.

PWA satu file — React 18 + Babel standalone via CDN, backend Supabase.
Tidak perlu `npm install`, tidak perlu build step.

## Isi

| File | Fungsi |
|---|---|
| `index.html` | Seluruh aplikasi (React + JSX inline + CSS) |
| `manifest.json` | Metadata PWA untuk install ke homescreen |
| `sw.js` | Service worker, network-first supaya update selalu terpasang |
| `icon-192.png` / `icon-512.png` | Ikon aplikasi |
| `icon-maskable-512.png` | Ikon maskable untuk Android |
| `.nojekyll` | Mematikan pemrosesan Jekyll di GitHub Pages |

## Cara deploy

1. Buat repo baru di GitHub, misalnya `potbook`. Set **Public** (GitHub Pages gratis hanya untuk repo public).
2. Upload semua file di folder ini ke root repo — bukan ke dalam subfolder.
3. Buka **Settings → Pages**. Bagian *Source* pilih **Deploy from a branch**, branch `main`, folder `/ (root)`. Simpan.
4. Tunggu 1–2 menit. Alamatnya jadi:

```
https://NAMA-AKUN.github.io/potbook/
```

5. Buka di HP, lalu **Add to Home Screen**. Setelah itu jalan seperti aplikasi biasa.

## Kalau ada update

Ubah `index.html`, lalu naikkan nomor versi di baris pertama `sw.js`:

```js
const VERSION = 'potbook-v2';
```

Tanpa itu, service worker lama bisa menyajikan file lama dari cache.

## Backend

Supabase project **Poker Ledger** (`diczhxkjcsmjsiowygjd`, region Singapore).
URL dan anon key tertanam di `index.html`.

Tabel: `players`, `sessions`, `session_players`, `buyins`, `settlements`,
`chip_denominations`, `hand_rankings`.
View: `v_session_player_stats`, `v_session_balance`, `v_player_leaderboard`.

### Peringatan keamanan

RLS saat ini terbuka untuk role `anon` — siapa pun yang punya anon key bisa
baca dan tulis. Karena repo harus public agar Pages aktif, key itu ikut
terlihat.

Untuk meja privat, ini biasanya cukup: yang bisa ditemukan orang cuma nama
pemain dan angka chip. Tapi kalau mau lebih aman, opsi paling ringan adalah
PIN meja yang dicek sebelum aplikasi terbuka, atau Supabase Auth dengan
policy per-user.
