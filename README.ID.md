# Sync Later

**Engine Mutasi Offline-First untuk Standar REST API**


`sync-later` adalah perpustakaan (library) yang kuat dan ringan yang dirancang untuk memastikan mutasi data Anda (POST, PUT, DELETE, PATCH) tidak pernah gagal, bahkan dalam kondisi jaringan yang tidak stabil. Library ini menyimpan permintaan (request), menangani percobaan ulang (retry) dengan strategi exponential backoff, mengelola rantai dependensi yang kompleks antar permintaan, dan kini mendukung unggahan file serta pembaruan event yang reaktif.

Berbeda dengan solusi berat seperti TanStack Query atau Apollo Client yang berfokus pada *fetching* (pengambilan data), `sync-later` berfokus murni pada *mutasi yang reliable*.

## Fitur 🚀

- **Tanpa Dependensi**: Murni TypeScript, ukuran bundle sangat kecil.
- **Offline-First**: Permintaan disimpan ke IndexedDB secara langsung.
- **Tangguh**: Percobaan ulang otomatis dengan strategi exponential backoff.
- **Dependency Chaining**: Buat rantai permintaan orang tua-anak (misalnya, buat Post -> buat Komentar) di mana anak bergantung pada ID orang tua bahkan sebelum orang tua berhasil dibuat.
- **Sistem Event Reaktif**: Berlangganan ke pembaruan antrean (`queue_update`, `process_success`, `process_fail`).
- **Dukungan File**: Dukungan kelas satu untuk unggahan `FormData`, `Blob`, dan `File`.
- **Dapat Dibatalkan**: Batalkan permintaan yang tertunda dengan mudah.
- **Kontrol Konkurensi**: Pemrosesan serial menjamin urutan.

## Instalasi

```bash
npm install sync-later
# atau
pnpm add sync-later
# atau
yarn add sync-later
```

## Mulai Cepat

```typescript
import { RequestQueue } from 'sync-later';

// 1. Inisialisasi antrean
const queue = new RequestQueue({
  retryPolicy: { maxRetries: 3, initialDelayMs: 1000 },
  onQueueChange: (items) => console.log('Antrean diperbarui:', items.length)
});

// 2. Tambahkan permintaan (mengembalikan ID unik)
const id = await queue.add({
  url: 'https://api.example.com/posts',
  method: 'POST',
  body: { title: 'Halo Dunia' }
});

// Selesai! Library ini menangani sisanya:
// - Menyimpan ke IndexedDB
// - Memeriksa status jaringan
// - Mengirim permintaan
// - Mencoba lagi jika gagal
// - Menghapus jika berhasil
```

## Konsep Inti

### 1. Dependency Chaining 🔗
Eksekusi permintaan yang bergantung tanpa menunggu permintaan pertama selesai. Gunakan `tempId` yang akan diganti secara otomatis ketika permintaan parent berhasil.

```typescript
const tempId = 'temp-123';

// 1. Buat parent (Post)
await queue.add({
  tempId, // Tetapkan ID sementara
  url: '/posts',
  method: 'POST',
  body: { title: 'Postingan Baru' }
});

// 2. Buat child (Komentar) - Menggunakan tempId
await queue.add({
  url: '/comments',
  method: 'POST',
  body: { 
    postId: tempId, // Akan diganti dengan ID asli (misal: 101) setelah parent sukses
    content: 'Postingan bagus!' 
  }
});
```

### 2. Unggah File 📁
Unggah file dengan mulus. Library mendeteksi `FormData` dan melewati serialisasi JSON.

```typescript
const formData = new FormData();
formData.append('file', myFile);

await queue.add({
  url: '/upload',
  method: 'POST',
  body: formData
});
```

### 3. Event & Reaktivitas ⚡
Perbarui UI Anda secara real-time.

```typescript
queue.addListener('queue_update', (items) => {
  // Perbarui UI Anda dengan status antrean terbaru
  setQueueItems(items);
});

queue.addListener('process_success', ({ id, response }) => {
  console.log(`Permintaan ${id} berhasil!`, response);
});
```

## Referensi API

### `RequestQueue`
Kelas utama.

#### Constructor `new RequestQueue(config?)`
- `config.retryPolicy`: `{ maxRetries: number, initialDelayMs: number }`
- `config.userId`: `string` (Opsional, untuk dukungan isolasi multi-pengguna)
- `config.onBeforeSend`: `(item) => Promise<item>` (Hook untuk memodifikasi permintaan sebelum dikirim, misal: melampirkan token)
- `config.onQueueChange`: `(items) => void` (Jalan pintas untuk event queue_update)

#### Metode
- `add(request)`: Menambahkan permintaan. Mengembalikan `Promise<string>` (ID permintaan).
- `remove(id)`: Membatalkan permintaan yang tertunda.
- `getQueue()`: Mengembalikan semua item antrean saat ini.
- `addListener(event, callback)`: Berlangganan event.
- `removeListener(event, callback)`: Berhenti berlangganan.

### Event
- `queue_update`: Dipicu setiap kali antrean menambahkan, menghapus, atau memperbarui item.
- `process_success`: Dipicu ketika permintaan berhasil.
- `process_fail`: Dipicu ketika permintaan gagal secara permanen (setelah percobaan ulang).

## Lisensi

ISC © 2026 denisetiya
