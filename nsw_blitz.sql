-- =====================================================================
-- NSW Sun Tower Blitz (second project in the New Store Pilot app)
-- Own tables, nothing shared with Team VB tables or new_store_visits.
-- Safe to re-run. Paste into Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- 1. One row per stop (stores, plus the start hotel and the night's hotel for each day).
create table if not exists public.blitz_stops (
  id              text primary key,
  project         text    not null default 'nsw-sun-blitz-2026',
  day             text    not null check (day in ('TUE','WED','THU')),
  day_area        text,
  seq             integer not null,
  kind            text    not null check (kind in ('start','target','fillin','hotel')),
  store_id        bigint,
  store_name      text    not null,
  suburb          text,
  address         text,
  lat             double precision,
  lng             double precision,
  arrive          text,
  km              numeric,
  drive_min       integer,
  store_rank      integer,
  gaps            integer,
  must_have       integer,
  note            text,
  visited         boolean not null default false,
  visit_date      date,
  call_completed  text    check (call_completed in ('Yes','No')),
  sold_in_tower   text    check (sold_in_tower  in ('Yes','No')),
  units           integer check (units >= 0),
  visit_notes     text,
  updated_at      timestamptz not null default now()
);

-- 2. History log: every completed visit is copied here.
create table if not exists public.blitz_stops_log (
  id              bigserial primary key,
  stop_id         text not null,
  store_name      text,
  visit_date      date,
  call_completed  text,
  sold_in_tower   text,
  units           integer,
  visit_notes     text,
  logged_at       timestamptz not null default now()
);

create or replace function public.blitz_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.blitz_log_visit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visited then
    insert into public.blitz_stops_log (stop_id, store_name, visit_date, call_completed, sold_in_tower, units, visit_notes)
    values (new.id, new.store_name, new.visit_date, new.call_completed, new.sold_in_tower, new.units, new.visit_notes);
  end if;
  return new;
end $$;

drop trigger if exists blitz_touch on public.blitz_stops;
create trigger blitz_touch before update on public.blitz_stops
  for each row execute function public.blitz_touch_updated_at();

drop trigger if exists blitz_log on public.blitz_stops;
create trigger blitz_log after update on public.blitz_stops
  for each row execute function public.blitz_log_visit();

-- 3. Access: same as the pilot. No login; the app can read stops and only change the visit answers.
alter table public.blitz_stops     enable row level security;
alter table public.blitz_stops_log enable row level security;
revoke all on public.blitz_stops     from anon, authenticated;
revoke all on public.blitz_stops_log from anon, authenticated;
grant select on public.blitz_stops to anon, authenticated;
grant update (visited, visit_date, call_completed, sold_in_tower, units, visit_notes)
  on public.blitz_stops to anon, authenticated;

do $$ begin
  create policy blitz_read on public.blitz_stops for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy blitz_update on public.blitz_stops for update to anon, authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 4. The plan: 20 sun tower targets, 6 fill-ins, hotels. km and drive_min are from the previous stop.
insert into public.blitz_stops (id, day, day_area, seq, kind, store_id, store_name, suburb, address, lat, lng, arrive, km, drive_min, store_rank, gaps, must_have, note) values
  ('tue-00', 'TUE', 'Shire, Illawarra & Macarthur', 0, 'start', null, 'Sutherland Motel', null, '2 Aldgate St, Sutherland NSW', -34.031, 151.058, '7:30am', 0, 0, null, null, null, 'Free parking'),
  ('tue-01', 'TUE', 'Shire, Illawarra & Macarthur', 1, 'target', 53365, 'IGA M Sutherland', 'Sutherland', '561 President Avenue, Sutherland', -34.033512, 151.058144, '7:32am', 0.6, 2, 596, 64, 19, null),
  ('tue-02', 'TUE', 'Shire, Illawarra & Macarthur', 2, 'fillin', 17306, 'Supabarn Gymea', 'Gymea', '76 Gymea Rd, Gymea', -34.036379, 151.085127, '8:02am', 2.9, 6, null, 134, 48, null),
  ('tue-03', 'TUE', 'Shire, Illawarra & Macarthur', 3, 'target', 53338, 'IGA L Woonona Plus Liquor', 'Woonona', '10 Russell St, Woonona', -34.341179, 150.908411, '9:19am', 45, 52, 314, 40, 12, '22-line order cancelled in March.'),
  ('tue-04', 'TUE', 'Shire, Illawarra & Macarthur', 4, 'target', 53367, 'IGA M Thirroul', 'Thirroul', 'Lawrence Hargreave Drive, Thirroul', -34.316307, 150.920917, '9:50am', 3.6, 7, 249, 23, 5, 'March order cancelled.'),
  ('tue-05', 'TUE', 'Shire, Illawarra & Macarthur', 5, 'target', 98518, 'IGA L Bargo', 'Bargo', '90 Railside Ave, Bargo', -34.29083, 150.579135, '11:14am', 55.2, 59, 321, '', '', '7-line order cancelled in March.'),
  ('tue-06', 'TUE', 'Shire, Illawarra & Macarthur', 6, 'target', 392, 'IGA L Picton (khan''s)', 'Picton', '100 Argyle St, Picton', -34.168791, 150.612127, '12:02pm', 15.8, 23, 423, 33, 11, '12-line order cancelled in March.'),
  ('tue-07', 'TUE', 'Shire, Illawarra & Macarthur', 7, 'target', 16107, 'IGA M West Hoxton', 'West Hoxton', 'Edmonson Ave, West Hoxton', -33.950233, 150.808604, '1:44pm', 38.5, 47, 839, 71, 29, null),
  ('tue-08', 'TUE', 'Shire, Illawarra & Macarthur', 8, 'target', 32677, 'IGA M Greenfield Park', 'Greenfield Park', '1 Greenfield Raod, Greenfield Park', -33.872199, 150.889414, '2:31pm', 15.4, 22, 398, '', '', null),
  ('tue-09', 'TUE', 'Shire, Illawarra & Macarthur', 9, 'target', 21461, 'IGA L Wakeley', 'Wakeley', 'Cnr Bulls Road, Lamond Street, Wakeley', -33.869632, 150.91105, '3:02pm', 2.4, 6, 516, 40, 11, null),
  ('tue-10', 'TUE', 'Shire, Illawarra & Macarthur', 10, 'hotel', null, 'Quest Liverpool', null, '39 Scott St, Liverpool NSW', -33.92, 150.924, '3:40pm', 7.7, 13, null, null, null, 'Free parking. Backup: Mercure Sydney Liverpool, Prestons'),
  ('wed-00', 'WED', 'Mountains, West & Hills', 0, 'start', null, 'Quest Liverpool', null, '39 Scott St, Liverpool NSW', -33.92, 150.924, '7:30am', 0, 0, null, null, null, 'Free parking. Backup: Mercure Sydney Liverpool, Prestons'),
  ('wed-01', 'WED', 'Mountains, West & Hills', 1, 'target', 40484, 'IGA M Luddenham Plus Liquor', 'Luddenham', '2130 The Northern Rd, Luddenham', -33.883712, 150.69427, '8:04am', 28.2, 34, 1055, '', '', null),
  ('wed-02', 'WED', 'Mountains, West & Hills', 2, 'target', 6252, 'IGA L Lloyds Springwood', 'Springwood', '167 Macquarie Rd, Springwood', -33.698808, 150.565831, '9:11am', 33.2, 41, 154, 56, 23, null),
  ('wed-03', 'WED', 'Mountains, West & Hills', 3, 'target', 40655, 'IGA L Blaxland Karellas', 'Blaxland', '152 Great Western Highway, Blaxland', -33.751915, 150.611652, '9:49am', 9.5, 14, 44, 26, 4, 'Ordered 11 Oct (7 lines), no sun item.'),
  ('wed-04', 'WED', 'Mountains, West & Hills', 4, 'target', 32600, 'IGA L Erskine Park (ashcroft)', 'Erskine Park', 'Cnr Swallow  Peppertree Rd., Erskine Park', -33.804879, 150.803692, '10:43am', 25.5, 29, 250, 29, 7, null),
  ('wed-05', 'WED', 'Mountains, West & Hills', 5, 'fillin', 38469, 'IGA M Rooty Hill North', 'Rooty Hill', '26  Rooty Hill Road North, Rooty Hill', -33.770395, 150.843555, '11:23am', 8.3, 15, null, 65, 26, null),
  ('wed-06', 'WED', 'Mountains, West & Hills', 6, 'target', 19366, 'Supa Valu Romeos Doonside', 'Doonside', '52 Rosenthal Street, Doonside', -33.772239, 150.876361, '12:00pm', 6.4, 12, 4, 46, 12, 'Top-ranked store with no sun order. Lead call.'),
  ('wed-07', 'WED', 'Mountains, West & Hills', 7, 'target', 43698, 'IGA M Beaumont Hills Plus Liquor', 'Beaumont Hills', '70 The Parkway, Beaumont Hills', -33.6984, 150.941301, '1:18pm', 14.4, 24, 940, 88, 35, null),
  ('wed-08', 'WED', 'Mountains, West & Hills', 8, 'target', 13949, 'IGA M Rouse Hill (chriss)', 'Rouse Hill', 'Shop 6. 57 Windsor Rd, Rouse Hill', -33.710612, 150.954831, '1:50pm', 3.4, 7, 1043, 77, 31, 'Ordered 25 Aug (7 lines), no sun item.'),
  ('wed-09', 'WED', 'Mountains, West & Hills', 9, 'fillin', 22373, 'IGA M Pennant Hills', 'Pennant Hills', 'Ramsay & Hillcrest Roads, Pennant Hills', -33.73772, 151.071448, '2:38pm', 13.8, 23, null, 63, 15, null),
  ('wed-10', 'WED', 'Mountains, West & Hills', 10, 'target', 21544, 'IGA M Lindfield (supamart IGA Lindfield)', 'Lindfield', '27 Lindfield Ave, Lindfield', -33.77433, 151.169646, '3:27pm', 15.1, 24, 319, '', '', '7-line order cancelled in March.'),
  ('wed-11', 'WED', 'Mountains, West & Hills', 11, 'hotel', null, 'Crowne Plaza Sydney Macquarie Park', null, '7-11 Talavera Rd, Macquarie Park NSW', -33.776, 151.123, '4:04pm', 6.1, 12, null, null, null, 'Parking approx. $20/night. Some sites still list it as Courtyard by Marriott North Ryde'),
  ('thu-00', 'THU', 'Parramatta, Bankstown & home', 0, 'start', null, 'Crowne Plaza Sydney Macquarie Park', null, '7-11 Talavera Rd, Macquarie Park NSW', -33.776, 151.123, '7:30am', 0, 0, null, null, null, 'Parking approx. $20/night. Some sites still list it as Courtyard by Marriott North Ryde'),
  ('thu-01', 'THU', 'Parramatta, Bankstown & home', 1, 'fillin', 7857, 'IGA M Plus Liquor Northmead', 'Northmead', '2 Campbell Street, Northmead', -33.789592, 150.996748, '7:51am', 16.9, 21, null, 63, 19, null),
  ('thu-02', 'THU', 'Parramatta, Bankstown & home', 2, 'target', 24058, 'IGA M Merrylands', 'Merrylands', 'Shop 7. Merryway Shopping Centre. 530 Merrylands Rd, Merrylands', -33.8326, 150.968413, '8:30am', 8.4, 14, 524, 26, 12, '37-line order cancelled in March. Re-pitch.'),
  ('thu-03', 'THU', 'Parramatta, Bankstown & home', 3, 'target', 52511, 'IGA L Georges Hall', 'Georges Hall', 'Lot 601 Birdwood Rd, Georges Hall', -33.913039, 150.990492, '9:14am', 11.6, 19, 215, 31, 12, 'March order cancelled; 1 line in May.'),
  ('thu-04', 'THU', 'Parramatta, Bankstown & home', 4, 'target', 21776, 'IGA M Condell Park', 'Condell Park', 'Sho 1, 63-77 Simmat Ave, Condell Park', -33.923376, 151.01175, '9:45am', 3.4, 6, 574, 78, 30, 'Self-tracked order in May, no sun item.'),
  ('thu-05', 'THU', 'Parramatta, Bankstown & home', 5, 'fillin', 33103, 'IGA M Peakhurst', 'Peakhurst', '701 Forest Rd, Peakhurst', -33.95977, 151.063033, '10:25am', 8.9, 15, null, 143, 59, 'Biggest gap list in NSW.'),
  ('thu-06', 'THU', 'Parramatta, Bankstown & home', 6, 'target', 20634, 'IGA M Rosebery', 'Roseberry', 'Cnr Botany  Queen St, Roseberry', -33.920611, 151.197302, '11:13am', 16.7, 22, 795, 49, 16, 'Ordered 4 Nov (3 lines), no sun item.'),
  ('thu-07', 'THU', 'Parramatta, Bankstown & home', 7, 'fillin', 2341, 'IGA M Botany', 'Botany', '1128 Botany Road, Botany', -33.945038, 151.196278, '11:44am', 2.9, 6, null, 56, 18, null),
  ('thu-08', 'THU', 'Parramatta, Bankstown & home', 8, 'hotel', null, 'Sydney Airport', null, 'Mascot NSW 2020', -33.9399, 151.1753, '12:55pm', 7.3, 17, null, null, null, null)
on conflict (id) do nothing;

-- Check: should return TUE 11, WED 12, THU 9 (stores plus hotels)
-- select day, kind, count(*) from public.blitz_stops group by day, kind order by day, kind;
