# Academic AI Assistant

API server untuk asisten akademik berbasis **Gemini**, **RAG** dari folder dataset lokal, queue, rate limiting, dan proteksi sumber daya API.

## Struktur Proyek

```
dataset/                        # Sumber pengetahuan akademik (LOKAL)
  academic/                     #   topik akademik: KRS, ujian, presensi, wisuda, cuti, kalender
  campus/                       #   profil universitas
  seminar/                      #   persyaratan & prosedur seminar
  regulations/                  #   peraturan akademik
src/
  config/env.ts                 # Konfigurasi environment (dotenv + zod)
  middleware/                   # validation, rateLimit, concurrency, deduplicate, scopeGuard
  services/
    knowledgeBase.ts            # Index & retrieval RAG dari folder dataset (tanpa GitHub)
    gemini.ts                   # Pemanggilan Gemini dengan retry
    sync.ts                     # Sinkronisasi knowledge base dari dataset lokal
  types/                        # Tipe & skema request/response
tests/                          # Unit test (vitest)
```

## Sumber Pengetahuan (Dataset Lokal)

Pengetahuan akademik diambil **seluruhnya dari folder `dataset/`** di dalam proyek — tidak ada pengambilan dari repo GitHub atau sumber eksternal.

- Folder dataset dikonfigurasi melalui variabel `KNOWLEDGE_BASE_DIR` (default: `dataset`).
- File dengan ekstensi `.md` dan `.txt` akan diindeks secara rekursif saat server start.
- Setiap pertanyaan ke `/api/assistant` akan me-*retrieve* konteks relevan dari dataset
  (keyword matching deterministik) dan meneruskannya ke prompt Gemini (RAG).
- `/api/sync` melakukan pemindaian ulang folder dataset dan membangun ulang index.

## Setup

```bash
npm install
cp .env.example .env   # lalu isi GEMINI_API_KEY dan AI_ASSISTANT_SECRET
npm run dev
```

Variabel penting di `.env`:

| Variabel | Deskripsi |
| --- | --- |
| `GEMINI_API_KEY` | API key Google Gemini |
| `AI_ASSISTANT_SECRET` | Secret Bearer token untuk proteksi endpoint |
| `KNOWLEDGE_BASE_DIR` | Folder dataset (default `dataset`) |
| `AI_MOCK_MODE` | `true` untuk respons simulasi tanpa memanggil Gemini |

## Endpoint

| Method | Path | Deskripsi |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/api/assistant` | Tanya ke asisten akademik (RAG dari dataset) |
| `POST` | `/api/sync` | Sinkronisasi ulang knowledge base dari dataset |
| `GET` | `/api/sync/status` | Status sinkronisasi |

## Scripts

```bash
npm run dev        # jalankan dengan tsx watch
npm run build      # kompilasi TypeScript ke dist/
npm start          # jalankan build produksi
npm test           # unit test (vitest)
node scripts/chat.mjs 'pertanyaan...'    # test chat ke server (mock/Gemini sesuai .env)
node scripts/check-gemini.mjs            # verifikasi API key + model Gemini
```

## Test ke Gemini Asli

1. Isi `GEMINI_API_KEY` valid di `.env` (buat di https://aistudio.google.com/apikey).
2. Set `AI_MOCK_MODE=false` di `.env`.
3. `node scripts/check-gemini.mjs` hingga tampil `SUKSES`.
4. Restart server (`npm run dev`), lalu `node scripts/chat.mjs 'pertanyaan kamu'`.

## Menambahkan Pengetahuan Baru

Cukup tambahkan file `.md` (atau `.txt`) baru di dalam `dataset/`, lalu jalankan
`POST /api/sync` (atau restart server) agar file tersebut terindeks.
