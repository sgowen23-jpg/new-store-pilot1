# New Store Pilot (Team V GSV Non Universe)

A standalone mobile web app for once-off visits to the 185 non-universe stores.
It's completely separate from Team VB, with its own app, its own Vercel link and its own Supabase tables.

## How it works
- Home screen: a state wheel (SA, VIC, NSW, QLD, WA) with the overall visited % and an Export button.
- State screen: a store wheel showing 7 stores at a time, a Not visited / Visited toggle, and that state's %.
- Store screen: 4 questions plus Notes, one at a time, ending with Complete.
- There's no login, so anyone with the link can record a visit (including on someone else's behalf).
- Each store has one row. A new visit **overwrites** the previous answers.
- Every completed visit is also copied to `new_store_visits_log` as a backup. You can only see it in the Supabase dashboard.
- The app can only change the visit answers. It can't rename, add or delete stores.

## Setup (about 10 minutes)

### 1. Supabase (same project as Team VB)
1. Open Supabase, then **SQL Editor**, then **New query**.
2. Paste in all of `supabase/new_store_pilot.sql` and press **Run**.
3. Check it worked: `select state, count(*) from new_store_visits group by state;`
   The result should be SA 23, VIC 32, NSW 64, QLD 23, WA 43.

### 2. Try it locally (optional)
```
npm install
copy .env.example .env.local      (then fill in the two values)
npm run dev
```
If the app runs without `.env.local`, it runs in **Demo mode**. Demo mode saves to that browser only and is useful for trying it out.

### 3. Deploy to Vercel (its own project)
1. Push this folder to a **new** GitHub repo (for example `new-store-pilot`).
2. In Vercel, choose **Add New**, then **Project**, and import that repo. Vercel detects Vite automatically.
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: the **anon / publishable** key (never the service role key)
4. Press **Deploy**, then share the link with the team.
   Tip: on a phone, use "Add to Home Screen" to get an app icon.

## Exports
- **Excel file:** one row per store, with Volume and Vita Gains stored as numbers.
- **HTML summary:** a one-page report with headline totals, a breakdown by state, and every visit note.

## Resetting a visit (dashboard only)
```sql
update new_store_visits
set visited=false, visit_date=null, call_completed=null, sold_in_tower=null,
    volume=null, vita_gains=null, notes=null
where store_id = 12345;
```

## Files
- `src/App.jsx`: screens and wheel logic
- `src/data.js`: Supabase load and save (falls back to Demo mode)
- `src/exporters.js`: Excel and HTML summary exports
- `src/demoStores.json`: store list used only in Demo mode
- `supabase/new_store_pilot.sql`: tables, security and the 185 stores
