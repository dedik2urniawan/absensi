-- ============================================================
-- Absensi HKN ke-62 (2026) - SKEMA DATABASE
-- Jalankan sekali di Supabase > SQL Editor, lalu jalankan supabase_seed.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists instansi_kategori (
  kode text primary key,
  label text not null,
  urut int default 0,
  punya_sublist boolean default true,
  perlu_teks_lain boolean default false
);

create table if not exists instansi (
  id serial primary key,
  kategori text not null references instansi_kategori(kode) on delete cascade,
  nama text not null,
  aktif boolean default true,
  unique (kategori, nama)
);

create table if not exists sesi (
  id serial primary key,
  nama text not null,
  mulai timestamptz not null,
  selesai timestamptz not null,
  aktif boolean not null default true,
  override text check (override in ('buka','tutup')),
  check (selesai > mulai)
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  nama_lengkap text not null check (char_length(nama_lengkap) between 2 and 120),
  usia smallint not null check (usia between 5 and 120),
  kategori text not null references instansi_kategori(kode),
  instansi_nama text not null check (char_length(instansi_nama) between 2 and 200),
  jenis_kelamin text not null check (jenis_kelamin in ('Laki-laki','Perempuan')),
  disabilitas boolean not null,
  jabatan text check (jabatan is null or char_length(jabatan) <= 120),
  nomor_telepon text not null check (nomor_telepon ~ '^[0-9]{9,15}$'),
  sesi_id int references sesi(id) on delete set null,
  tanda_tangan_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists attendees_created_idx on attendees (created_at desc);
create index if not exists attendees_kategori_idx on attendees (kategori);
create index if not exists attendees_sesi_idx on attendees (sesi_id);

create table if not exists admins (
  email text primary key
);

-- ---------- Row Level Security ----------
-- Peserta TIDAK mengakses tabel secara langsung; seluruh tulis/baca data
-- sensitif lewat server (service role) setelah validasi.
alter table attendees enable row level security;
alter table admins enable row level security;
alter table instansi_kategori enable row level security;
alter table instansi enable row level security;
alter table sesi enable row level security;

-- Data referensi boleh dibaca publik (read-only)
drop policy if exists "baca kategori" on instansi_kategori;
create policy "baca kategori" on instansi_kategori for select using (true);
drop policy if exists "baca instansi" on instansi;
create policy "baca instansi" on instansi for select using (aktif);
drop policy if exists "baca sesi" on sesi;
create policy "baca sesi" on sesi for select using (true);
-- attendees & admins: tanpa policy = ditolak untuk anon/authenticated

-- ---------- Bucket tanda tangan (private, maks 100 KB, PNG) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 102400, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 102400, allowed_mime_types = array['image/png'];

-- ---------- Admin & sesi awal ----------
insert into admins(email) values ('hkn2026@dinkes.go.id') on conflict do nothing;

insert into sesi(nama, mulai, selesai) values
 ('Sesi Pagi - Senam & Talkshow', '2026-11-13 06:00:00+07', '2026-11-13 12:00:00+07'),
 ('Sesi Malam - Puncak HKN',      '2026-11-13 17:30:00+07', '2026-11-13 23:00:00+07');
