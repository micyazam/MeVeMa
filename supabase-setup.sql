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
  published_at timestamptz,                       -- מועד עלייה לאוויר (תוקף ללא הגבלה, מינימום 3 שנים)
  created_at   timestamptz default now()          -- מועד ההזמנה (לחישוב חלון 14 יום)
);

-- אם הטבלה כבר קיימת מהרצה קודמת — מוסיף את העמודות החדשות
alter table public.ads add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.ads add column if not exists pending_title text;
alter table public.ads add column if not exists pending_link text;
alter table public.ads add column if not exists pending_image_url text;
alter table public.ads add column if not exists published_at timestamptz;
alter table public.ads add column if not exists approved_at timestamptz;  -- מועד אישור התוכן (לספירת 24/48/72 שעות לתשלום)

-- 2) טבלת מנהלים (מי שיש לו גישה לאזור הניהול)
create table if not exists public.admins (email text primary key);

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- pgcrypto (לחישוב סיסמה מוצפנת) — בדרך כלל כבר מותקן ב-Supabase
create extension if not exists pgcrypto with schema extensions;

-- שחזור סיסמה למשתמש — רק מנהל יכול להפעיל. יוצר סיסמה חדשה למשתמש לפי האימייל הפנימי (טלפון@mevema.co.il)
create or replace function public.admin_reset_password(target_email text, new_password text)
returns boolean language plpgsql security definer
set search_path = public, auth, extensions as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where email = lower(target_email);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
grant execute on function public.admin_reset_password(text, text) to authenticated;


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
  select id, category, x, y, w, h, pixels, title, link, image_url, status, published_at
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
insert into public.admins (email) values ('972500000000@mevema.co.il')
on conflict (email) do nothing;

-- ===== שחזור סיסמה אוטומטי (Green API) =====
create table if not exists public.password_resets (
  phone text not null,
  created_at timestamptz not null default now()
);
alter table public.password_resets enable row level security;
-- אין מדיניות — רק service_role (השרת) ניגש לטבלה

create or replace function public.system_reset_password(target_email text, new_password text)
returns boolean language plpgsql security definer
set search_path = public, auth, extensions as $$
begin
  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
  where lower(email) = lower(target_email);
  return found;
end $$;
revoke execute on function public.system_reset_password(text, text) from public, anon, authenticated;
grant execute on function public.system_reset_password(text, text) to service_role;

-- ===== גיבוי אוטומטי יומי (Vercel Cron → /api/backup-snapshot) =====
create table if not exists public.ad_backups (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ads_count int not null default 0,
  data jsonb not null
);
alter table public.ad_backups enable row level security;
drop policy if exists "admin read backups" on public.ad_backups;
create policy "admin read backups" on public.ad_backups for select to authenticated using (public.is_admin());
-- כתיבה: רק השרת (service_role) — אין מדיניות לכתיבה
-- דלי גיבוי לתמונות (עותק נפרד של כל תמונה שהועלתה)
insert into storage.buckets (id, name, public) values ('ad-images-backup', 'ad-images-backup', false)
on conflict (id) do nothing;

-- ===== עמודי מותג — "עמוד מיליון שלם" לחברות =====
create table if not exists public.brand_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  tagline text,
  description text,
  logo_url text,
  hero_url text,
  link text,
  sort_order int not null default 100,
  status text not null default 'draft' check (status in ('draft','live','removed')),
  published_at timestamptz
);
alter table public.brand_pages enable row level security;
drop policy if exists "public read live brands" on public.brand_pages;
create policy "public read live brands" on public.brand_pages for select to anon, authenticated using (status = 'live' or public.is_admin());
drop policy if exists "admin write brands" on public.brand_pages;
create policy "admin write brands" on public.brand_pages for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.brand_pages to anon, authenticated;
grant insert, update, delete on public.brand_pages to authenticated;

-- שחזור מגיבוי: המנהלת רשאית להוסיף/לעדכן מודעות של כל משתמש
drop policy if exists "admin insert" on public.ads;
create policy "admin insert" on public.ads for insert to authenticated with check (public.is_admin());

-- ===== עמוד מותג = לוח רגיל שכולו של מותג אחד (v46) =====
alter table public.brand_pages add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.brand_pages add column if not exists owner_phone text;

-- מודעות רגילות לא נכנסות לעמודי מותג (רק דרך add_brand_ad)
drop policy if exists "own insert" on public.ads;
create policy "own insert" on public.ads
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending' and category not like 'brand:%');

-- איתור משתמש לפי טלפון (למנהלת בלבד) — כדי לשייך מנהל/ת מותג
create or replace function public.user_id_by_email(target_email text)
returns uuid language sql security definer stable set search_path = public, auth as $$
  select case when public.is_admin() then (select id from auth.users where lower(email) = lower(target_email) limit 1) else null end;
$$;
grant execute on function public.user_id_by_email(text) to authenticated;

-- מנהל/ת המותג (או המנהלת) מעלה תוכן למשבצת בעמוד המותג — עולה לאוויר מיד, בלי תשלום
create or replace function public.add_brand_ad(
  p_brand uuid, p_x int, p_y int, p_w int, p_h int, p_pixels int, p_title text, p_link text, p_image_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.brand_pages%rowtype; cat text; new_id uuid;
begin
  select * into b from public.brand_pages where id = p_brand;
  if not found then raise exception 'brand not found'; end if;
  if not (b.owner_id = auth.uid() or public.is_admin()) then raise exception 'not authorized'; end if;
  cat := 'brand:' || p_brand::text;
  if exists (select 1 from public.ads where category = cat and x = p_x and y = p_y and status <> 'removed') then
    raise exception 'slot taken';
  end if;
  insert into public.ads (owner_id, category, x, y, w, h, pixels, title, link, phone, image_url, status, published_at, approved_at)
  values (auth.uid(), cat, p_x, p_y, p_w, p_h, p_pixels, p_title, p_link,
          coalesce(auth.jwt() -> 'user_metadata' ->> 'phone', ''), p_image_url, 'live', now(), now())
  returning id into new_id;
  return new_id;
end $$;
grant execute on function public.add_brand_ad(uuid, int, int, int, int, int, text, text, text) to authenticated;

-- ===== עריכה/מחיקה של משבצת בעמוד מותג (v47) — מיידי, בלי אישור =====
create or replace function public.update_brand_ad(p_ad uuid, p_title text, p_link text, p_image_url text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.ads%rowtype; b public.brand_pages%rowtype;
begin
  select * into a from public.ads where id = p_ad;
  if not found or a.category not like 'brand:%' then raise exception 'not found'; end if;
  select * into b from public.brand_pages where id = substring(a.category from 7)::uuid;
  if not (b.owner_id = auth.uid() or public.is_admin()) then raise exception 'not authorized'; end if;
  update public.ads set title = coalesce(p_title, title), link = coalesce(p_link, link), image_url = coalesce(p_image_url, image_url)
  where id = p_ad;
end $$;
grant execute on function public.update_brand_ad(uuid, text, text, text) to authenticated;

create or replace function public.delete_brand_ad(p_ad uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.ads%rowtype; b public.brand_pages%rowtype;
begin
  select * into a from public.ads where id = p_ad;
  if not found or a.category not like 'brand:%' then raise exception 'not found'; end if;
  select * into b from public.brand_pages where id = substring(a.category from 7)::uuid;
  if not (b.owner_id = auth.uid() or public.is_admin()) then raise exception 'not authorized'; end if;
  delete from public.ads where id = p_ad;
end $$;
grant execute on function public.delete_brand_ad(uuid) to authenticated;
