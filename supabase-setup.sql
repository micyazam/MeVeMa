-- =====================================================================
--  מי ומה — הגדרת מסד הנתונים ב-Supabase  (גרסה עם חשבונות מפרסמים)
--  הדביקי את כל הקובץ ב: Supabase → SQL Editor → New query → Run
--  ⚠️ בסוף הקובץ: החליפי את האימייל שלך בשורת ה-admins!
-- =====================================================================

-- 1) טבלת המודעות
create table if not exists public.ads (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade, -- בעל המודעה
  category    text not null,
  x int not null, y int not null, w int not null, h int not null,
  pixels      int not null,
  title       text,
  link        text,
  phone       text,
  image_url   text,
  status      text not null default 'pending',  -- pending | awaiting_payment | live | removed
  flags       text[] default '{}',
  pending_title     text,                        -- שינוי שממתין לאישור
  pending_link      text,
  pending_image_url text,
  published_at timestamptz,                       -- מועד עלייה לאוויר (לחישוב תוקף שנה)
  created_at   timestamptz default now()          -- מועד ההזמנה (לחישוב חלון 14 יום)
);

-- אם הטבלה כבר קיימת מהרצה קודמת — מוסיף את העמודות החדשות
alter table public.ads add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.ads add column if not exists pending_title text;
alter table public.ads add column if not exists pending_link text;
alter table public.ads add column if not exists pending_image_url text;
alter table public.ads add column if not exists published_at timestamptz;

-- 2) טבלת מנהלים (מי שיש לו גישה לאזור הניהול)
create table if not exists public.admins (email text primary key);

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- 3) הרשאות (RLS)
alter table public.ads enable row level security;
grant select, insert, update, delete on public.ads to authenticated;

-- מפרסם מחובר יוצר מודעה משלו (תמיד "ממתינה")
drop policy if exists "own insert" on public.ads;
create policy "own insert" on public.ads
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

-- מפרסם רואה את המודעות שלו; מנהל רואה הכל
drop policy if exists "own or admin select" on public.ads;
create policy "own or admin select" on public.ads
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- רק מנהל מעדכן/מוחק ישירות (מפרסם משתמש בפונקציות למטה)
drop policy if exists "admin update" on public.ads;
create policy "admin update" on public.ads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on public.ads;
create policy "admin delete" on public.ads
  for delete to authenticated using (public.is_admin());

-- 4) תצוגה ציבורית ללוח — בלי טלפון, רק מה שמותר להציג
drop view if exists public.public_ads;
create view public.public_ads as
  select id, category, x, y, w, h, pixels, title, link, image_url, status
  from public.ads
  where status in ('pending', 'awaiting_payment', 'live');
grant select on public.public_ads to anon, authenticated;

-- 5) פעולות מפרסם (מאובטחות — בודקות בעלות)
-- שליחת שינוי לאישור (לא משנה את המודעה החיה עד אישור מנהל)
create or replace function public.submit_ad_update(
  p_ad_id uuid, p_title text, p_link text, p_image_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ads set
    pending_title = p_title, pending_link = p_link, pending_image_url = p_image_url
  where id = p_ad_id and owner_id = auth.uid();
end; $$;
grant execute on function public.submit_ad_update(uuid, text, text, text) to authenticated;

-- הסרה מרצון (המפרסם מוותר על המקום)
create or replace function public.remove_own_ad(p_ad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ads set status = 'removed'
  where id = p_ad_id and owner_id = auth.uid();
end; $$;
grant execute on function public.remove_own_ad(uuid) to authenticated;

-- 6) אחסון לתמונות
insert into storage.buckets (id, name, public)
values ('ad-images', 'ad-images', true)
on conflict (id) do nothing;

drop policy if exists "auth upload ad images" on storage.objects;
create policy "auth upload ad images" on storage.objects
  for insert to authenticated with check (bucket_id = 'ad-images');

drop policy if exists "auth delete ad images" on storage.objects;
create policy "auth delete ad images" on storage.objects
  for delete to authenticated using (bucket_id = 'ad-images');

-- =====================================================================
--  ⚠️ חשוב! המנהלת מזוהה לפי הטלפון שאיתו היא נרשמת לאתר.
--  הכניסה לאתר היא בטלפון + סיסמה (לא אימייל).
--  החליפי 972500000000 במספר שלך בפורמט בינלאומי:
--    050-1234567  =>  972501234567   (מורידים 0 בהתחלה, מוסיפים 972)
-- =====================================================================
insert into public.admins (email) values ('972500000000@miuma.app')
on conflict (email) do nothing;
