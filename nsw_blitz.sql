-- =====================================================================
-- NSW Vitasoy Blitz (second project in the New Store Pilot app)
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

-- 4. The plan (Dec 2026 route, Vitasoy-first): 26 stores in a clockwise loop from the airport, plus hotels.
--    km and drive_min are from the previous stop. Legs to newly added stores are estimates.
insert into public.blitz_stops (id, day, day_area, seq, kind, store_id, store_name, suburb, address, lat, lng, arrive, km, drive_min, store_rank, gaps, must_have, note) values
  ('tue-00', 'TUE', 'Inner city, east & inner west', 0, 'start', null, 'ibis Sydney Airport', null, '205 O''Riordan St, Mascot NSW', -33.9235, 151.188, '7:30am', 0, 0, null, null, null, 'Or any hotel near the airport'),
  ('tue-01', 'TUE', 'Inner city, east & inner west', 1, 'fillin', 84035, 'IGA Local Grocer Mascot', 'Mascot', 'Mascot NSW', -33.929, 151.188, '7:40am', 0.9, 10, null, null, null, 'Vitasoy #20 in NSW.'),
  ('tue-02', 'TUE', 'Inner city, east & inner west', 2, 'fillin', 2341, 'IGA M Botany', 'Botany', '1128 Botany Road, Botany', -33.945038, 151.196278, '8:20am', 2.7, 10, null, 56, 18, 'Vitasoy #16 in NSW.'),
  ('tue-03', 'TUE', 'Inner city, east & inner west', 3, 'target', 20634, 'IGA M Rosebery', 'Rosebery', 'Cnr Botany  Queen St, Rosebery', -33.920611, 151.197302, '9:00am', 2.9, 10, 795, 49, 16, 'Vitasoy #9 in NSW. Ordered 4 Nov (3 lines), no sun item.'),
  ('tue-04', 'TUE', 'Inner city, east & inner west', 4, 'fillin', null, 'IGA Romeos Foodhall Bondi', 'Bondi', 'Bondi NSW', -33.893, 151.263, '10:00am', 9.5, 30, 627, null, null, 'Has a sun tower: reorder.'),
  ('tue-05', 'TUE', 'Inner city, east & inner west', 5, 'fillin', null, 'IGA M Alexandria', 'Alexandria', 'Alexandria NSW', -33.905, 151.196, '11:10am', 8.9, 30, 1303, null, null, 'Has a sun tower: reorder.'),
  ('tue-06', 'TUE', 'Inner city, east & inner west', 6, 'fillin', 211128, 'IGA M Romeo''s Foodhall South Eveleigh', 'Eveleigh', 'Eveleigh NSW', -33.896, 151.1925, '12:00pm', 1.5, 10, null, null, null, 'Vitasoy #11 in NSW.'),
  ('tue-07', 'TUE', 'Inner city, east & inner west', 7, 'fillin', 8863, 'IGA M Newtown', 'Newtown', 'Newtown NSW', -33.8975, 151.179, '1:10pm', 1.8, 10, null, null, null, 'Vitasoy #10 in NSW.'),
  ('tue-08', 'TUE', 'Inner city, east & inner west', 8, 'fillin', 32864, 'IGA M Dulwich Hill', 'Dulwich Hill', 'Dulwich Hill NSW', -33.9046, 151.1395, '2:00pm', 5.2, 20, null, null, null, 'Vitasoy #1 in NSW.'),
  ('tue-09', 'TUE', 'Inner city, east & inner west', 9, 'fillin', 19435, 'IGA L Summer Hill (Romeo)', 'Summer Hill', 'Summer Hill NSW', -33.8915, 151.1375, '2:50pm', 2.1, 10, null, null, null, 'Vitasoy #2 in NSW.'),
  ('tue-10', 'TUE', 'Inner city, east & inner west', 10, 'fillin', null, 'IGA M Drummoyne Plus CBN', 'Drummoyne', 'Drummoyne NSW', -33.853, 151.154, '3:50pm', 6.4, 20, 432, null, null, 'Has a sun tower: reorder.'),
  ('tue-11', 'TUE', 'Inner city, east & inner west', 11, 'fillin', 1683, 'IGA M Breakfast Point Lqr', 'Breakfast Point', 'Breakfast Point NSW', -33.8418, 151.1095, '4:50pm', 6, 20, null, null, null, 'Vitasoy #5 in NSW.'),
  ('tue-12', 'TUE', 'Inner city, east & inner west', 12, 'hotel', null, 'Crowne Plaza Sydney Macquarie Park', null, '7-11 Talavera Rd, Macquarie Park NSW', -33.776, 151.123, '5:50pm', 10.4, 20, null, null, null, 'Parking approx. $20/night. Some sites still list it as Courtyard by Marriott North Ryde'),
  ('wed-00', 'WED', 'North Shore, west & south-west', 0, 'start', null, 'Crowne Plaza Sydney Macquarie Park', null, '7-11 Talavera Rd, Macquarie Park NSW', -33.776, 151.123, '7:30am', 0, 0, null, null, null, 'Parking approx. $20/night. Some sites still list it as Courtyard by Marriott North Ryde'),
  ('wed-01', 'WED', 'North Shore, west & south-west', 1, 'fillin', 21451, 'IGA M Turramurra Plaza (Corp)', 'Turramurra', 'Turramurra NSW', -33.7325, 151.129, '7:40am', 6.8, 10, null, null, null, 'Vitasoy #13 in NSW.'),
  ('wed-02', 'WED', 'North Shore, west & south-west', 2, 'fillin', 22373, 'IGA M Pennant Hills', 'Pennant Hills', 'Ramsay & Hillcrest Roads, Pennant Hills', -33.73772, 151.071448, '8:25am', 7.5, 15, null, 63, 15, null),
  ('wed-03', 'WED', 'North Shore, west & south-west', 3, 'fillin', 7857, 'IGA M Plus Liquor Northmead', 'Northmead', '2 Campbell Street, Northmead', -33.7895917, 150.996748, '9:20am', 12.6, 25, null, 63, 19, null),
  ('wed-04', 'WED', 'North Shore, west & south-west', 4, 'target', 19366, 'Supa Valu Romeos Doonside', 'Doonside', '52 Rosenthal Street, Doonside', -33.7722387, 150.8763608, '10:10am', 15.8, 20, 4, 46, 12, 'Top-ranked store with no sun order. Lead call.'),
  ('wed-05', 'WED', 'North Shore, west & south-west', 5, 'fillin', 38469, 'IGA M Rooty Hill North', 'Rooty Hill', '26  Rooty Hill Road North, Rooty Hill', -33.7703954, 150.8435552, '11:00am', 6.4, 10, null, 65, 26, 'Vitasoy #18 in NSW.'),
  ('wed-06', 'WED', 'North Shore, west & south-west', 6, 'target', 32600, 'IGA L Erskine Park (ashcroft)', 'Erskine Park', 'Cnr Swallow  Peppertree Rd., Erskine Park', -33.804879, 150.803692, '11:45am', 8.3, 15, 250, 29, 7, null),
  ('wed-07', 'WED', 'North Shore, west & south-west', 7, 'target', 32677, 'IGA M Greenfield Park', 'Greenfield Park', '1 Greenfield Raod, Greenfield Park', -33.8721988, 150.8894143, '1:05pm', 15.3, 20, 398, null, null, 'Vitasoy #6 in NSW.'),
  ('wed-08', 'WED', 'North Shore, west & south-west', 8, 'target', 21461, 'IGA L Wakeley', 'Wakeley', 'Cnr Bulls Road, Lamond Street, Wakeley', -33.869632, 150.91105, '1:40pm', 2.4, 5, 516, 40, 11, null),
  ('wed-09', 'WED', 'North Shore, west & south-west', 9, 'target', 16107, 'IGA M West Hoxton', 'West Hoxton', 'Edmonson Ave, West Hoxton', -33.950233, 150.808604, '2:35pm', 18.2, 25, 839, 71, 29, 'Vitasoy #7 in NSW.'),
  ('wed-10', 'WED', 'North Shore, west & south-west', 10, 'hotel', null, 'Quest Liverpool', null, '39 Scott St, Liverpool NSW', -33.92, 150.924, '3:25pm', 15.6, 20, null, null, null, 'Free parking. Backup: Mercure Sydney Liverpool, Prestons'),
  ('thu-00', 'THU', 'Bankstown & Shire, back to the airport', 0, 'start', null, 'Quest Liverpool', null, '39 Scott St, Liverpool NSW', -33.92, 150.924, '7:30am', 0, 0, null, null, null, 'Free parking. Backup: Mercure Sydney Liverpool, Prestons'),
  ('thu-01', 'THU', 'Bankstown & Shire, back to the airport', 1, 'target', 24058, 'IGA M Merrylands', 'Merrylands', 'Shop 7. Merryway Shopping Centre. 530 Merrylands Rd, Merrylands', -33.8326, 150.968413, '7:55am', 14.8, 25, 524, 26, 12, 'Vitasoy #17 in NSW. 37-line order cancelled in March. Re-pitch.'),
  ('thu-02', 'THU', 'Bankstown & Shire, back to the airport', 2, 'target', 52511, 'IGA L Georges Hall', 'Georges Hall', 'Lot 601 Birdwood Rd, Georges Hall', -33.913039, 150.990492, '8:45am', 11.6, 20, 215, 31, 12, 'Vitasoy #8 in NSW. March order cancelled; 1 line in May.'),
  ('thu-03', 'THU', 'Bankstown & Shire, back to the airport', 3, 'target', 21776, 'IGA M Condell Park', 'Condell Park', 'Sho 1, 63-77 Simmat Ave, Condell Park', -33.923376, 151.01175, '9:20am', 3.4, 5, 574, 78, 30, 'Self-tracked order in May, no sun item.'),
  ('thu-04', 'THU', 'Bankstown & Shire, back to the airport', 4, 'fillin', 33103, 'IGA M Peakhurst', 'Peakhurst', '701 Forest Rd, Peakhurst', -33.95977, 151.063033, '10:05am', 8.9, 15, null, 143, 59, 'Biggest gap list in NSW.'),
  ('thu-05', 'THU', 'Bankstown & Shire, back to the airport', 5, 'fillin', 17306, 'Supabarn Gymea', 'Gymea', '76 Gymea Rd, Gymea', -34.036379, 151.085127, '10:55am', 12.3, 20, null, 134, 48, null),
  ('thu-06', 'THU', 'Bankstown & Shire, back to the airport', 6, 'target', 53365, 'IGA M Sutherland', 'Sutherland', '561 President Avenue, Sutherland', -34.0335124, 151.0581436, '11:30am', 2.9, 5, 596, 64, 19, null),
  ('thu-07', 'THU', 'Bankstown & Shire, back to the airport', 7, 'hotel', null, 'Sydney Airport', null, 'Mascot NSW 2020', -33.9399, 151.1753, '12:30pm', 21, 30, null, null, null, null)
on conflict (id) do nothing;

-- Check: should return TUE 13, WED 11, THU 8 (stores plus hotels)
-- select day, kind, count(*) from public.blitz_stops group by day, kind order by day, kind;
