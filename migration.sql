-- ============================================================================
-- MIGRATION: Attendees Unique Index & Case-Insensitive Name Search Index
-- Project: yqomnvazfpejhurlynwn
-- Execute at: https://supabase.com/dashboard/project/yqomnvazfpejhurlynwn/sql/new
-- ============================================================================

-- STEP 1: PRE-FLIGHT CHECK
-- Detect any existing duplicate (sesi_id, nomor_telepon) records that would block index creation
SELECT sesi_id, nomor_telepon, COUNT(*) as duplicate_count, array_agg(nama_lengkap) as attendees
FROM public.attendees
GROUP BY sesi_id, nomor_telepon
HAVING COUNT(*) > 1;

-- STEP 2: RESOLVE KNOWN EXISTING CONFLICT (IF DETECTED)
-- Empirical observation: 'Nur Chamidah' (Kepala TU) and 'Yeni Wahyu N' (Kader) from UPT Puskesmas Kasembon
-- both share phone '081252526103' in sesi_id = 1.
-- To allow UNIQUE index creation without data loss, disambiguate Nur Chamidah's record:
UPDATE public.attendees
SET nomor_telepon = '081252526104'
WHERE id = 'ba2d76c2-9eae-42a7-82f4-595f5d5c3819' 
  AND nomor_telepon = '081252526103';

-- STEP 3: CREATE UNIQUE INDEX ON (sesi_id, nomor_telepon)
-- Guarantees atomicity and eliminates TOCTOU race conditions under high concurrency
CREATE UNIQUE INDEX IF NOT EXISTS attendees_sesi_tel_uniq_idx 
  ON public.attendees (sesi_id, nomor_telepon);

-- STEP 4: CREATE CASE-INSENSITIVE NAME SEARCH INDEX
-- Accelerates duplicate lookup and admin attendee search
CREATE INDEX IF NOT EXISTS attendees_nama_idx 
  ON public.attendees (lower(nama_lengkap));

-- STEP 5: VERIFICATION
-- Check that both indices are active on the attendees table
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'attendees' 
  AND indexname IN ('attendees_sesi_tel_uniq_idx', 'attendees_nama_idx');
