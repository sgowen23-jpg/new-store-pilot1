-- =====================================================================
-- New Store Pilot (Team V GSV Non Universe)
-- Fully siloed: own tables, nothing shared with Team VB tables.
-- Safe to re-run.
-- =====================================================================

-- 1. Main table: one row per store. Latest visit overwrites the previous one.
create table if not exists public.new_store_visits (
  store_id        bigint primary key,
  state           text    not null check (state in ('SA','VIC','NSW','QLD','WA')),
  store_name      text    not null,
  list_rank       integer not null,
  visited         boolean not null default false,
  visit_date      date,
  call_completed  text    check (call_completed in ('Yes','No')),
  sold_in_tower   text    check (sold_in_tower  in ('Yes','No')),
  volume          integer check (volume     >= 0),
  vita_gains      integer check (vita_gains >= 0),
  notes           text,
  updated_at      timestamptz not null default now()
);

-- 2. History log: every completed visit is copied here (backup if something is overwritten by mistake).
create table if not exists public.new_store_visits_log (
  id              bigserial primary key,
  store_id        bigint not null,
  state           text,
  store_name      text,
  visit_date      date,
  call_completed  text,
  sold_in_tower   text,
  volume          integer,
  vita_gains      integer,
  notes           text,
  logged_at       timestamptz not null default now()
);

-- 3. Triggers: stamp updated_at, and copy each completed visit into the log.
create or replace function public.nsp_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.nsp_log_visit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visited then
    insert into public.new_store_visits_log
      (store_id, state, store_name, visit_date, call_completed, sold_in_tower, volume, vita_gains, notes)
    values
      (new.store_id, new.state, new.store_name, new.visit_date, new.call_completed, new.sold_in_tower, new.volume, new.vita_gains, new.notes);
  end if;
  return new;
end $$;

drop trigger if exists nsp_touch on public.new_store_visits;
create trigger nsp_touch before update on public.new_store_visits
  for each row execute function public.nsp_touch_updated_at();

drop trigger if exists nsp_log on public.new_store_visits;
create trigger nsp_log after update on public.new_store_visits
  for each row execute function public.nsp_log_visit();

-- 4. Access: no login. Anyone with the app can read and record visits,
--    but can only change the visit answer columns. No adding or deleting stores.
alter table public.new_store_visits     enable row level security;
alter table public.new_store_visits_log enable row level security;

revoke all on public.new_store_visits     from anon, authenticated;
revoke all on public.new_store_visits_log from anon, authenticated;

grant select on public.new_store_visits to anon, authenticated;
grant update (visited, visit_date, call_completed, sold_in_tower, volume, vita_gains, notes)
  on public.new_store_visits to anon, authenticated;

do $$ begin
  create policy nsp_read on public.new_store_visits
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy nsp_update on public.new_store_visits
    for update to anon, authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
-- (The log table has no policies, so it is only visible in the Supabase dashboard.)

-- 5. Load the 185 stores from TOP_STORES_20261028 (National tab).
insert into public.new_store_visits (store_id, state, store_name, list_rank) values
  (18470, 'SA', 'THEBARTON FOODLAND IGA', 1),
  (729, 'SA', 'IGA LOCAL GROCER GLENELG EAST', 2),
  (43169, 'SA', 'IGA M HAHNDORF', 3),
  (14245, 'SA', 'FOODLAND IGA DARLINGTON', 4),
  (94962, 'SA', 'IGA LOCAL GROCER BOWDEN', 5),
  (15263, 'SA', 'LOCKLEYS FOODLAND IGA', 6),
  (43191, 'SA', 'MOANA FOODLAND', 7),
  (11195, 'SA', 'IGA LOCAL GROCER GILBERT STREET', 8),
  (10411, 'SA', 'BROOKLYN PARK IGA', 9),
  (337, 'SA', 'IGA LOCAL GROCER ADELAIDE (CITY EAST)', 10),
  (14289, 'SA', 'IGA M PARA HILLS', 11),
  (53557, 'SA', 'IGA LOCAL GROCER WESTWOOD', 12),
  (33029, 'SA', 'DULWICH SMKT (FWKS)', 13),
  (39305, 'SA', 'IGA M LEABROOK', 14),
  (187860, 'SA', 'IGA M BLAIR ATHOL', 15),
  (32464, 'SA', 'IGA M MORPHETT VALE', 16),
  (13990, 'SA', 'IGA LOCAL GROCER HENLEY BEACH SOUTH', 17),
  (1122, 'SA', 'IGA LOCAL GROCER NOVAR GARDENS', 18),
  (9665, 'SA', 'HOVE FOODLAND IGA', 19),
  (508, 'SA', 'IGA M CHRISTIES BEACH', 20),
  (11640, 'SA', 'IGA M ALBERTON', 21),
  (52898, 'SA', 'IGA M WESTSIDE', 22),
  (19726, 'SA', 'IGA M VALLEY VIEW', 23),
  (3469, 'VIC', 'IGA M YARRAVILLE PLUS LIQUOR', 1),
  (17234, 'VIC', 'IGA LG UPWEY PLUS LIQUOR', 2),
  (20287, 'VIC', 'IGA LG ANDRES WATSONIA', 3),
  (85199, 'VIC', 'IGA M SALTWATER', 4),
  (211342, 'VIC', 'IGA M CARNEGIE PLUS LIQUOR', 5),
  (16039, 'VIC', 'IGA M ORMOND PLUS LIQUOR', 6),
  (14257, 'VIC', 'IGA M KYNETON PLUS LIQUOR', 7),
  (108877, 'VIC', 'MARKET EUROPA KINGSTON', 8),
  (52520, 'VIC', 'IGA LG TOORAK ROAD PLUS LIQUOR', 9),
  (40170, 'VIC', 'IGA M LAVERTON PLUS LIQUOR', 10),
  (12940, 'VIC', 'IGA M PIEDIMONTES PASCOE VALE', 11),
  (52365, 'VIC', 'IGA LOCAL GROCER BENTLEIGH PLUS LIQUOR', 12),
  (15461, 'VIC', 'IGA M FOOD PLUS LIQUOR ALTONA', 13),
  (85244, 'VIC', 'IGA LOCAL GROCER + LIQ PRINCES HILL', 14),
  (53554, 'VIC', 'IGA M COBURG PLUS LIQUOR', 15),
  (43567, 'VIC', 'IGA LOCAL GROCER PRESTON', 16),
  (16551, 'VIC', 'IGA LOCAL GROCER FLINDERS ST MELBOURNE', 17),
  (21054, 'VIC', 'IGA LG EAST MELBOURNE', 18),
  (2591, 'VIC', 'IGA M ROWVILLE LAKES PLUS LIQUOR', 19),
  (52880, 'VIC', 'IGA LOCAL GROCER BRUNSWICK EAST', 20),
  (2274, 'VIC', 'IGA M VALLIS HAMLYN HEIGHTS PLUS LIQUOR', 21),
  (148551, 'VIC', 'IGA LOCAL GROCER + LIQ ETTARO', 22),
  (15978, 'VIC', 'IGA LOCAL GROCER PORT MELBOURNE PLUS LIQUOR', 23),
  (40715, 'VIC', 'IGA LOCAL GROCER NORTHCOTE PLUS LIQUOR', 24),
  (85182, 'VIC', 'IGA LOCAL GROCER ST GEORGES RD', 25),
  (183192, 'VIC', 'IGA LOCAL GROCER CREMORNE', 26),
  (227146, 'VIC', 'IGA LOCAL GROCER KEW', 27),
  (39324, 'VIC', 'IGA LOCAL GROCER CHEVRON', 28),
  (89713, 'VIC', 'IGA LOCAL GROCER CHELTENHAM', 29),
  (9646, 'VIC', 'IGA M WARBURTON PLUS LIQUOR', 30),
  (33269, 'VIC', 'IGA LOCAL GROCER ROSANNA PLUS LIQUOR', 31),
  (53539, 'VIC', 'IGA M BITTERN PLUS LIQUOR', 32),
  (239417, 'NSW', 'IGA LOCAL GROCER MILSONS POINT', 1),
  (7126, 'NSW', 'IGA LOCAL GROCER DARLINGHURST', 2),
  (444, 'NSW', 'IGA M MASCOT', 3),
  (83590, 'NSW', 'IGA M APPIN', 4),
  (4710, 'NSW', 'IGA LOCAL GROCER KIAMA DOWNS', 5),
  (82212, 'NSW', 'IGA M LOCALI BY ROMEO''S - GEORGE STREET', 6),
  (6743, 'NSW', 'IGA LOCAL GROCER STANMORE', 7),
  (84565, 'NSW', 'IGA M LILYFIELD', 8),
  (14420, 'NSW', 'IGA M ELANORA HEIGHTS', 9),
  (53355, 'NSW', 'FGRC BANGOR', 10),
  (13438, 'NSW', 'IGA M BEXLEY', 11),
  (6420, 'NSW', 'IGA LOCAL GROCER WAHROONGA', 12),
  (8953, 'NSW', 'IGA PUTNEY', 13),
  (21213, 'NSW', 'IGA M HEATHCOTE', 14),
  (53172, 'NSW', 'IGA M ALEXANDRIA', 15),
  (2971, 'NSW', 'IGA LOCAL GROCER LEICHHARDT', 16),
  (227054, 'NSW', 'IGA L BELMORE AFRESH', 17),
  (6033, 'NSW', 'IGA LOCAL GROCER ENMORE', 18),
  (53363, 'NSW', 'IGA L MEADOWBANK', 19),
  (12820, 'NSW', 'IGA LOCAL GROCER KINGSFORD', 20),
  (21372, 'NSW', 'IGA M QUAKERS HILL', 21),
  (21221, 'NSW', 'FRIENDLY GROCER PYRMONT', 22),
  (21479, 'NSW', 'FRIENDLY GROCER WAVERTON', 23),
  (53176, 'NSW', 'IGA M HORSLEY PARK', 24),
  (8513, 'NSW', 'IGA LOCAL GROCER GLEBE', 25),
  (14969, 'NSW', 'IGA LOCAL GROCER HAMMONDVILLE', 26),
  (53322, 'NSW', 'IGA LG DOONSIDE NTH', 27),
  (47660, 'NSW', 'IGA LOCAL GROCER WORONORA HEIGHTS', 28),
  (4647, 'NSW', 'IGA M WATERLOO', 29),
  (15831, 'NSW', 'IGA M QUAY QUARTER PLUS LIQ', 30),
  (90060, 'NSW', 'IGA LOCAL GROCER UNSW KENSINGTON', 31),
  (98499, 'NSW', 'IGA LOCAL GROCER BUNDEENA', 32),
  (14312, 'NSW', 'IGA LOCAL GROCER LILLI PILLI', 33),
  (52449, 'NSW', 'MINT FRESH IGA FITZWILLIAM', 34),
  (17948, 'NSW', 'FRIENDLY GROCER HURLSTONE PARK', 35),
  (33302, 'NSW', 'IGA LOCAL GROCER JAMBEROO', 36),
  (33404, 'NSW', 'IGA LOCAL GROCER BEVERLY HILLS', 37),
  (232800, 'NSW', 'IGA LOCAL GROCER SHELLHARBOUR', 38),
  (11943, 'NSW', 'FRIENDLY GROCER TERREY HILLS', 39),
  (16695, 'NSW', 'IGA M BIRRONG PLUS LIQUOR (CARLO''S)', 40),
  (53217, 'NSW', 'FGRC SOUTH WINDSOR', 41),
  (123650, 'NSW', 'FWKS REDFERN', 42),
  (4383, 'NSW', 'IGA M OATLEY PLUS LIQUOR', 43),
  (52882, 'NSW', 'FOODWORKS LITTLE BAY', 44),
  (21039, 'NSW', 'IGA ARNCLIFFE', 45),
  (21506, 'NSW', 'IGA M ST ANDREWS', 46),
  (85183, 'NSW', 'IGA LOCAL GROCER ST IVES NORTH', 47),
  (252344, 'NSW', 'IGA LG NOVEL FRESH EPPING', 48),
  (2911, 'NSW', 'IGA HABERFIELD', 49),
  (19133, 'NSW', 'IGA LOCAL GROCER GREENWICH', 50),
  (8045, 'NSW', 'FGRC KEIRAVILLE', 51),
  (8001, 'NSW', 'IGA LOCAL GROCER CROYDON PARK', 52),
  (33148, 'NSW', 'FRIENDLY GROCER KURRAJONG', 53),
  (21032, 'NSW', 'IGA LOCAL GROCER GALSTON (CHRISS)', 54),
  (40091, 'NSW', 'X GROCER PARRAMATTA FGRC', 55),
  (257507, 'NSW', 'CENTRO ARTARMON', 56),
  (11876, 'NSW', 'IGA LOCAL GROCER HUNTERS HILL', 57),
  (32887, 'NSW', 'IGA LOCAL GROCER OATLANDS', 58),
  (32404, 'NSW', 'IGA LOCAL GROCER PITT TOWN', 59),
  (21250, 'NSW', 'IGA LOCAL GROCER THE OAKS', 60),
  (15620, 'NSW', 'IGA M LALOR PARK', 61),
  (92268, 'NSW', 'IGA LOCAL GROCER EAST CAMPBELLTOWN', 62),
  (98652, 'NSW', 'IGA LOCAL GROCER ARTHUR ST MINT FRESH', 63),
  (16902, 'NSW', 'FGRC ROZELLE', 64),
  (12229, 'QLD', 'IGA M TUGUN BEACH', 1),
  (19362, 'QLD', 'IGA M SORRENTO VILLAGE (YITMOS)', 2),
  (90872, 'QLD', 'IGA M COOMERA', 3),
  (39883, 'QLD', 'IGA LOCAL GROCER CANNON HILL', 4),
  (32502, 'QLD', 'IGA M FRENCHS FOREST', 5),
  (85108, 'QLD', 'IGA M PULLENVALE MARKETPLACE', 6),
  (85207, 'QLD', 'IGA M CASHMERE', 7),
  (53203, 'QLD', 'IGA M BOONDALL', 8),
  (33084, 'QLD', 'IGA LOCAL GROCER BUDERIM PARK', 9),
  (266096, 'QLD', 'IGA M BOGGO ROAD (RANA)', 10),
  (10206, 'QLD', 'IGA M MAPLETON', 11),
  (20956, 'QLD', 'IGA LOCAL GROCER LANDSBOROUGH', 12),
  (83043, 'QLD', 'IGA M CARSELDINE (MINESH PATEL)', 13),
  (85523, 'QLD', 'IGA M AUGUSTINE HEIGHTS', 14),
  (46014, 'QLD', 'IGA M PORTSIDE WHARF (ZENELDIN)', 15),
  (21209, 'QLD', 'IGA LG GLASSHOUSE MOUNTAINS', 16),
  (40650, 'QLD', 'FWK BURNSIDE (NAMBOUR)', 17),
  (19118, 'QLD', 'IGA LG MAUD STREET', 18),
  (21596, 'QLD', 'IGA LOCAL GROCER VARSITY LAKES', 19),
  (211231, 'QLD', 'IGA M UPPER KEDRON', 20),
  (2863, 'QLD', 'IGA LOCAL GROCER TINGALPA', 21),
  (15297, 'QLD', 'FRIENDLY GROCER TUGUN FRUIT MARKET', 22),
  (52534, 'QLD', 'IGA LOCAL GROCER VALLEY', 23),
  (85074, 'WA', 'IGA M NICHOLSON RD', 1),
  (48276, 'WA', 'IGA M STIRLING', 2),
  (48312, 'WA', 'IGA M GLENDALOUGH FRESH', 3),
  (51912, 'WA', 'IGA  M EAST FREMANTLE', 4),
  (48075, 'WA', 'IGA M KALAMUNDA', 5),
  (48108, 'WA', 'IGA LOCAL GROCER EAST PERTH', 6),
  (99928, 'WA', 'FARMER JACKS BUTLER', 7),
  (48254, 'WA', 'IGA M MT LAWLEY', 8),
  (176978, 'WA', 'IGA TUCKER FRESH TREEBY', 9),
  (48097, 'WA', 'IGA M BEDFORD', 10),
  (51897, 'WA', 'GREENWOOD IGA', 11),
  (83288, 'WA', 'IGA M TUCKER FRESH ILUKA', 12),
  (39785, 'WA', 'IGA M MAYLANDS', 13),
  (48098, 'WA', 'IGA M MT PLEASANT (WA)', 14),
  (48086, 'WA', 'IGA M BENTLEY', 15),
  (5354, 'WA', 'IGA M SHENTON PARK', 16),
  (48264, 'WA', 'IGA M EAST VICTORIA PARK', 17),
  (48235, 'WA', 'IGA M THE BOULEVARD', 18),
  (48272, 'WA', 'IGA M BEELIAR', 19),
  (48976, 'WA', 'IGA M NORANDA', 20),
  (48077, 'WA', 'IGA M BEECHBORO', 21),
  (48319, 'WA', 'IGA M SANDERSON ROAD', 22),
  (48139, 'WA', 'IGA M MT HAWTHORN', 23),
  (83919, 'WA', 'IGA M SOUTH GUILDFORD WATERHALL RD + CBN', 24),
  (49850, 'WA', 'IGA M CANDLEWOOD', 25),
  (48072, 'WA', 'IGA M YANGEBUP', 26),
  (51309, 'WA', 'IGA LOCAL GROCER BULLCREEK', 27),
  (48242, 'WA', 'IGA LG TUCKER FRESH DALKEITH', 28),
  (48310, 'WA', 'IGA LOCAL GROCER EDGEWATER', 29),
  (84279, 'WA', 'IGA DAWESVILLE PLUS CBN', 30),
  (48327, 'WA', 'IGA M COTTESLOE', 31),
  (48102, 'WA', 'IGA M BALGA', 32),
  (50403, 'WA', 'IGA M PK FRESH PLUS CBN', 33),
  (82921, 'WA', 'IGA M SOUTH PERTH', 34),
  (6008, 'WA', 'IGA M BECKENHAM', 35),
  (26746, 'WA', 'IGA M MUNDIJONG + CBN', 36),
  (50721, 'WA', 'FOODWORKS FORRESTFIELD', 37),
  (39766, 'WA', 'IGA LOCAL GROCER HIGH WYCOMBE', 38),
  (48307, 'WA', 'IGA LOCAL GROCER MIAMI', 39),
  (48143, 'WA', 'IGA M HEATHRIDGE', 40),
  (48320, 'WA', 'IGA LOCAL GROCER OLD BRIDGE', 41),
  (83459, 'WA', 'IGA M CURTIN UNI (TUCKER FRESH)', 42),
  (48275, 'WA', 'IGA LOCAL GROCER ROSTRATA', 43)
on conflict (store_id) do nothing;

-- Check: should return SA 23, VIC 32, NSW 64, QLD 23, WA 43
-- select state, count(*) from public.new_store_visits group by state;
