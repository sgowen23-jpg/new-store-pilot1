import { createClient } from '@supabase/supabase-js'
import demoStores from './demoStores.json'
import blitzDemo from './blitzStops.json'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const DEMO = !URL || !KEY
const supabase = DEMO ? null : createClient(URL, KEY)

const TABLE = 'new_store_visits'
const DEMO_KEY = 'nsp_demo_visits'

function readDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '{}') } catch { return {} }
}

export async function loadStores() {
  if (DEMO) {
    const saved = readDemo()
    return demoStores.map(s => ({ visited: false, ...s, ...(saved[s.store_id] || {}) }))
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('state')
    .order('list_rank')
    .range(0, 4999)
  if (error) throw error
  return data
}

// One row per store: saving again overwrites the previous answers.
export async function saveVisit(storeId, a) {
  const row = {
    visited: true,
    visit_date: new Date().toLocaleDateString('en-CA'),
    call_completed: a.call_completed,
    sold_in_tower: a.sold_in_tower,
    volume: Number(a.volume),
    vita_gains: Number(a.vita_gains),
    notes: a.notes.trim(),
  }
  if (DEMO) {
    const saved = readDemo()
    saved[storeId] = row
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(saved)) } catch { /* ignore */ }
    return row
  }
  const { error } = await supabase.from(TABLE).update(row).eq('store_id', storeId)
  if (error) throw error
  return row
}

/* ---------- NSW Sun Tower Blitz (second project) ---------- */

const BLITZ_TABLE = 'blitz_stops'
const BLITZ_DEMO_KEY = 'nsp_demo_blitz'

function readBlitzDemo() {
  try { return JSON.parse(localStorage.getItem(BLITZ_DEMO_KEY) || '{}') } catch { return {} }
}

export async function loadBlitz() {
  if (DEMO) {
    const saved = readBlitzDemo()
    return blitzDemo.map(s => ({ ...s, ...(saved[s.id] || {}) }))
  }
  const { data, error } = await supabase
    .from(BLITZ_TABLE)
    .select('*')
    .order('day')
    .order('seq')
  if (error) throw error
  return data
}

// One row per stop: saving again overwrites the previous answers.
export async function saveBlitzVisit(stopId, a) {
  const row = {
    visited: true,
    visit_date: new Date().toLocaleDateString('en-CA'),
    call_completed: a.call_completed,
    sold_in_tower: a.sold_in_tower || null,
    units: Number(a.units),
    visit_notes: a.visit_notes.trim(),
  }
  if (DEMO) {
    const saved = readBlitzDemo()
    saved[stopId] = row
    try { localStorage.setItem(BLITZ_DEMO_KEY, JSON.stringify(saved)) } catch { /* ignore */ }
    return row
  }
  const { error } = await supabase.from(BLITZ_TABLE).update(row).eq('id', stopId)
  if (error) throw error
  return row
}
