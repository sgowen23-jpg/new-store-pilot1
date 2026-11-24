import React, { useEffect, useMemo, useState } from 'react'

const STATES = ['All', 'SA', 'WA', 'NSW', 'QLD', 'VIC', 'Other']
const RANGES = [['all', 'All lines'], ['ss', 'Sea Salt'], ['msl', 'MSL incl. Sea Salt'], ['pp', 'Sun prepack 6']]
const CHIPS = [['ss', 'Sea Salt'], ['msl', 'MSL'], ['all', 'All lines'], ['pp', 'Sun prepack 6']]
const LABEL = { buy: 'Buying', lap: 'Lapsed', nev: 'Never', pp: 'SUN PP', hold: 'Sun Hold' }
const STATUS_ORDER = { nev: 0, lap: 1, hold: 2, buy: 3, pp: 4 }
const PAGE = 300
const WIDE = 1000

const fmt = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}` }
const highBit = m => (m ? 31 - Math.clz32(m) : -1)
const bits = m => { let c = 0; while (m) { m &= m - 1; c++ } return c }
const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

function csv(rows) {
  return rows.map(r => r.map(v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n')
}
function download(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function useWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return w
}

const Icon = ({ name }) => {
  const P = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12v8h14v-8" /></>,
    box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></>,
    sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
    download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    back: <path d="M15 5l-7 7 7 7" />,
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>
}

export default function Bnb() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState('store')
  const [scope, setScope] = useState('team')
  const [st, setSt] = useState(() => store.get('bnb.state') || 'SA')
  const [rg, setRg] = useState('all')
  const [rep, setRep] = useState(() => store.get('bnb.rep') || '')
  const [banner, setBanner] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState('pri')
  const [hideDel, setHideDel] = useState(true)
  const [activeOnly, setActiveOnly] = useState(true)
  const [flt, setFlt] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(-1)
  const [limit, setLimit] = useState(PAGE)
  const [dark, setDark] = useState(() => store.get('bnb.theme') !== 'light')
  const [sheet, setSheet] = useState('') // '' | pick | filters
  const [open, setOpen] = useState(null)
  const [worst, setWorst] = useState(true)
  const width = useWidth()
  const wide = width >= WIDE

  useEffect(() => {
    fetch('/bnb-data.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(setData).catch(() => setErr("Couldn't load the report data. Check signal and refresh."))
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    store.set('bnb.theme', dark ? 'dark' : 'light')
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = '#0E4A5C'
  }, [dark])
  useEffect(() => { store.set('bnb.state', st) }, [st])
  useEffect(() => { store.set('bnb.rep', rep) }, [rep])

  const D = useMemo(() => {
    if (!data) return null
    const NB = data.reports.length
    const cols = data.reports.concat(data.ext)
    const stores = data.stores.map(([id, n, state, b, mso, rk, rp], i) => ({
      i, id, n, state, b, mso, rk: rk ? +rk : 99999, rep: rp,
      seen: data.seenS[i], active: (data.seenS[i] >> (NB - 1)) & 1, sun: data.sun[id] || null,
    }))
    const products = data.products.map((p, i) => ({ ...p, i, seen: data.seenP[i] }))
    const reps = [...new Set(stores.map(s => s.rep).filter(Boolean))].sort()
    const banners = [...new Set(stores.map(s => s.b).filter(Boolean))].sort()
    const cats = [...new Set(products.map(p => p.rc || p.c).filter(Boolean))].sort()
    const team = new Set(data.team || [])
    return { NB, cols, stores, products, reps, banners, cats, team }
  }, [data])

  // one store x product line
  const line = (s, p) => {
    const common = s.seen & p.seen
    if (!common) return null
    const mask = data.h[s.i][p.i] & common
    const L = highBit(common)
    const sunLine = (p.pp || p.ppk) && s.sun
    let status = mask ? (((mask >> L) & 1) ? 'buy' : 'lap') : 'nev'
    if (sunLine && s.sun[0] === 'pp') status = 'pp'
    else if (sunLine && s.sun[0] === 'hold' && status !== 'buy') status = 'hold'
    return { s, p, mask, common, status, lastIdx: highBit(mask), sunLine }
  }

  const storeOk = s => (scope !== 'team' || D.team.has(s.id)) && (st === 'All' || s.state === st) && (!rep || s.rep === rep) && (!banner || s.b === banner) && (!activeOnly || s.active)
  const prodOk = p => {
    if (rg === 'ss' && !p.ss) return false
    if (rg === 'msl' && !p.msl) return false
    if (rg === 'pp' && !p.pp) return false
    if (cat && (p.rc || p.c) !== cat) return false
    if (hideDel && p.del && !p.pp && !p.ppk) return false
    return true
  }

  const pickList = useMemo(() => {
    if (!D) return []
    const qq = q.trim().toLowerCase()
    if (view === 'store') return D.stores.filter(s => storeOk(s) && (!qq || s.n.toLowerCase().includes(qq) || s.id.includes(qq)))
    return D.products.filter(p => prodOk(p) && (!qq || p.n.toLowerCase().includes(qq) || p.r.includes(qq)))
  }, [D, view, q, scope, st, rep, banner, activeOnly, rg, cat, hideDel])

  const cur = !D ? null : view === 'prod' ? (sel >= 0 ? D.products[sel] : null) : (sel >= 0 ? D.stores[sel] : pickList[0])
  const ranking = view === 'prod' && !cur

  // product ranking: gaps (Never + Lapsed) per product across the filtered stores
  const ranks = useMemo(() => {
    if (!D || view !== 'prod') return []
    const stores = D.stores.filter(storeOk)
    const out = []
    for (const p of pickList) {
      if (!((p.seen >> (D.NB - 1)) & 1)) continue // not in the latest report
      const c = { buy: 0, lap: 0, nev: 0, pp: 0, hold: 0 }
      for (const s of stores) { const l = line(s, p); if (l) c[l.status]++ }
      const t = c.buy + c.lap + c.nev + c.pp + c.hold
      if (t) out.push({ p, c, t, g: c.lap + c.nev })
    }
    return out.sort((a, b) => worst ? b.g - a.g || b.c.nev - a.c.nev : a.g - b.g || a.c.nev - b.c.nev)
  }, [D, view, pickList, worst, scope, st, rep, banner, activeOnly])
  const storeCount = useMemo(() => (D ? D.stores.filter(storeOk).length : 0), [D, scope, st, rep, banner, activeOnly])

  const lines = useMemo(() => {
    if (!D || !cur) return []
    const out = []
    if (view === 'store') { for (const p of D.products) if (prodOk(p)) { const l = line(cur, p); if (l) out.push(l) } }
    else { for (const s of D.stores) if (storeOk(s)) { const l = line(s, cur); if (l) out.push(l) } }
    return out
  }, [D, cur, view, scope, st, rep, banner, activeOnly, rg, cat, hideDel])

  const shown = useMemo(() => {
    const f = lines.filter(l => flt === 'all' || (flt === 'sun' ? (l.status === 'pp' || l.status === 'hold') : l.status === flt))
    const name = l => view === 'store' ? l.p.n : l.s.n
    const num = l => +(view === 'store' ? l.p.r : l.s.id)
    const pri = l => (l.p.ss ? 0 : l.p.msl ? 1 : 2)
    const cmp = {
      az: (a, b) => name(a).localeCompare(name(b)),
      num: (a, b) => num(a) - num(b),
      stat: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || name(a).localeCompare(name(b)),
      pri: view === 'store'
        ? (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || pri(a) - pri(b) || (a.p.rc || '').localeCompare(b.p.rc || '') || (a.p.rank || 99) - (b.p.rank || 99)
        : (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.s.rk - b.s.rk,
    }[sort]
    return f.sort(cmp)
  }, [lines, flt, sort, view])

  useEffect(() => { setLimit(PAGE); setOpen(null) }, [cur, flt, sort, view, worst])

  if (err) return <div className="bnb"><p className="bnb-msg">{err}</p></div>
  if (!D) return <div className="bnb"><p className="bnb-msg">Loading reports…</p></div>

  const c = k => lines.filter(l => l.status === k).length
  const lastLabel = l => {
    if (l.status === 'pp' || l.status === 'hold') return (l.status === 'pp' ? 'PP ' : 'Ordered ') + fmt(l.s.sun[1])
    if (l.lastIdx < 0) return 'Not since Mar 25'
    if (l.status === 'buy') return 'Current'
    return 'W/E ' + fmt(D.cols[l.lastIdx])
  }
  const dots = l => {
    const out = []
    for (let i = 0; i < D.cols.length; i++) {
      let cls = 'dot'
      if (i < D.NB) {
        if (!((l.common >> i) & 1)) cls += ' na'
        else if ((l.mask >> i) & 1) cls += ' on'
      } else cls += ' ext'
      if (l.sunLine && l.s.sun[2] === i) cls = 'dot ' + (l.s.sun[0] === 'pp' ? 'pp' : 'hold')
      if (i === D.NB) out.push(<span key="sep" className="sep" />)
      out.push(<span key={i} className={cls} title={(i < D.NB ? 'Report W/E ' : 'Week ending ') + fmt(D.cols[i])} />)
    }
    return out
  }
  const tags = p => <>
    {p.ss ? <span className="tag ss">SS</span> : p.msl ? <span className="tag msl">MSL</span> : null}
    {p.pp && <span className="tag pp">PP</span>}
  </>
  const pickLabel = x => view === 'store'
    ? `${x.n} (${x.state}) · ${x.id}${x.rep ? ' · ' + x.rep : ''}${x.sun ? (x.sun[0] === 'pp' ? ' · SUN PP' : ' · Sun Hold') : ''}`
    : `${x.r} · ${x.n}${x.ss ? ' · SS' : x.msl ? ' · MSL' : ''}${x.pp ? ' · PP' : ''}`
  const curSub = !cur ? '' : view === 'store'
    ? `${cur.state} · ${cur.id}${cur.rep ? ' · ' + cur.rep.split(' ')[0] : ''}${cur.sun ? ` · ${cur.sun[0] === 'pp' ? 'SUN PP' : 'Sun Hold'} ${fmt(cur.sun[1]).slice(0, 5)}` : ''}`
    : `${cur.r}${cur.rrp ? ` · RRP $${cur.rrp.toFixed(2)} · GM ${cur.gm}%` : ''}${cur.ss ? ' · Sea Salt' : cur.msl ? ' · MSL' : ''}`

  const doExport = () => {
    if (ranking) {
      if (!ranks.length) return
      const head = ['Rank', 'Item no.', 'Product', 'Range', 'Gaps', 'Never', 'Lapsed', 'Buying', 'Sun PP', 'Sun Hold', 'Stores']
      const rows = ranks.map((x, i) => [i + 1, x.p.r, x.p.n, x.p.ss ? 'Sea Salt' : x.p.msl ? 'MSL' : '', x.g, x.c.nev, x.c.lap, x.c.buy, x.c.pp, x.c.hold, x.t])
      download(`gaps_by_product_${st}_${data.built}.csv`, csv([head, ...rows]))
      return
    }
    if (!shown.length) return
    const head = view === 'store'
      ? ['Store', 'Store ID', 'State', 'Item no.', 'Product', 'Range', 'Rank', 'Status', 'Last bought']
      : ['Product', 'Item no.', 'Store', 'Store ID', 'State', 'Rep', 'Status', 'Last bought']
    const rows = shown.map(l => view === 'store'
      ? [cur.n, cur.id, cur.state, l.p.r, l.p.n, l.p.ss ? 'Sea Salt' : l.p.msl ? 'MSL' : '', l.p.rank || '', LABEL[l.status], lastLabel(l)]
      : [cur.n, cur.r, l.s.n, l.s.id, l.s.state, l.s.rep, LABEL[l.status], lastLabel(l)])
    const who = (view === 'store' ? cur.n : cur.r).replace(/[^a-z0-9]+/gi, '_')
    download(`bnb_${who}_${data.built}.csv`, csv([head, ...rows]))
  }
  const switchView = v => { setView(v); setSel(-1); setQ(''); setFlt('all') }
  const resetSel = () => { if (view === 'store') setSel(-1) }
  const openProd = i => { setSel(i); setFlt('all'); setSort('pri'); setQ(''); window.scrollTo(0, 0) }
  const backToRanking = () => { setSel(-1); setFlt('all'); window.scrollTo(0, 0) }
  const gapCls = g => g >= 50 ? 'hi' : g >= 20 ? 'md' : 'lo'
  const rankList = <>
    <div className="rk-bar">
      <span>{ranks.length} products · {ranks.reduce((a, x) => a + x.g, 0).toLocaleString()} gaps · {storeCount} stores</span>
      <button onClick={() => setWorst(!worst)}>{worst ? 'Worst first' : 'Best first'}</button>
    </div>
    <div className="rk-list">
      {ranks.slice(0, limit).map((x, i) => {
        const w = v => (100 * v / x.t).toFixed(1) + '%'
        return (
          <button key={x.p.i} className="rk-row" onClick={() => openProd(x.p.i)}>
            <span className="rk-n">{i + 1}</span>
            <span className="rk-main">
              <span className="rk-nm">{tags(x.p)}{x.p.n}</span>
              <span className="rk-sub">{x.p.r} · {x.c.buy + x.c.pp} of {x.t} stocked ({Math.round(100 * (x.c.buy + x.c.pp) / x.t)}%) · {x.c.nev} never · {x.c.lap} lapsed</span>
              <span className="stk"><i className="s-buy" style={{ width: w(x.c.buy) }} /><i className="s-pp" style={{ width: w(x.c.pp + x.c.hold) }} /><i className="s-lap" style={{ width: w(x.c.lap) }} /><i className="s-nev" style={{ width: w(x.c.nev) }} /></span>
            </span>
            <span className={'rk-g ' + gapCls(x.g)}><b>{x.g}</b><small>gaps</small></span>
          </button>
        )
      })}
      {ranks.length === 0 && <p className="bnb-msg">No products match these filters.</p>}
    </div>
    {ranks.length > limit && <button className="more" onClick={() => setLimit(limit + PAGE)}>Show more ({ranks.length - limit} left)</button>}
    <div className="legend"><span className="sw s-buy" />Buying <span className="sw s-pp" />Sun PP / Hold <span className="sw s-lap" />Lapsed <span className="sw s-nev" />Never
      {wide && <button onClick={doExport} disabled={!ranks.length}>Export ranking (CSV)</button>}</div>
  </>

  const Seg = ({ items, value, onChange, label }) => (
    <div className="seg-row"><span className="seg-lbl">{label}</span>
      {items.map(([v, t]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  )
  const filterControls = <>
    <Seg label="Stores" items={[['team', `Your list (${D.team.size})`], ['all', 'All Metcash']]} value={scope} onChange={v => { setScope(v); resetSel() }} />
    <Seg label="State" items={STATES.map(s => [s, s])} value={st} onChange={v => { setSt(v); resetSel() }} />
    {wide && <Seg label="Range" items={RANGES} value={rg} onChange={setRg} />}
    <div className="ctrls">
      <select value={rep} onChange={e => { setRep(e.target.value); resetSel() }}>
        <option value="">All reps</option>
        {D.reps.map(r => <option key={r}>{r}</option>)}
      </select>
      <select value={banner} onChange={e => { setBanner(e.target.value); resetSel() }}>
        <option value="">All banners</option>
        {D.banners.map(b => <option key={b}>{b}</option>)}
      </select>
      <select value={cat} onChange={e => setCat(e.target.value)}>
        <option value="">All categories</option>
        {D.cats.map(x => <option key={x}>{x}</option>)}
      </select>
      <select value={sort} onChange={e => setSort(e.target.value)}>
        <option value="pri">{view === 'store' ? 'Sort: Never, Lapsed, Buying' : 'Sort: Never, Lapsed, store rank'}</option>
        <option value="stat">Sort: status</option>
        <option value="az">Sort: A to Z</option>
        <option value="num">Sort: {view === 'store' ? 'item number' : 'store ID'}</option>
      </select>
      <label><input type="checkbox" checked={hideDel} onChange={e => setHideDel(e.target.checked)} /> Hide deleted items</label>
      <label><input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); resetSel() }} /> Current stores only</label>
      {wide && <div className="view">
        <button className={view === 'store' ? 'on' : ''} onClick={() => switchView('store')}>By store</button>
        <button className={view === 'prod' ? 'on' : ''} onClick={() => switchView('prod')}>By product</button>
      </div>}
    </div>
  </>
  const foot = <p className="foot">Each dot is a 26 week report: green means the store bought it at least once in the 26 weeks to that date. Lapsed = bought in an earlier report but not the latest. Sun prepack stores get SUN PP on the 6 prepack lines. Range tags from the Beiersdorf Metcash range book (July 2026).{data.notes?.team_missing?.length ? ` Not in any report yet: ${data.notes.team_missing.join(', ')}.` : ''}</p>
  const themeBtn = <button className="theme" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'}><Icon name={dark ? 'sun' : 'moon'} /></button>

  /* ---------- PC: table ---------- */
  if (wide) return (
    <div className="bnb">
      <header className="bnb-hdr">
        <div>
          <h1>Beiersdorf buy / not buy history</h1>
          <p>{D.NB} reports, W/E {fmt(data.reports[0])} to {fmt(data.reports[D.NB - 1])}. Sun prepack orders to {fmt(data.built)}.</p>
        </div>
        <div className="hdr-r">{themeBtn}<a href="/#bnb" className="back">Back to pilot</a></div>
      </header>
      {filterControls}
      <div className="picker">
        <input value={q} onChange={e => { setQ(e.target.value); resetSel() }} placeholder={view === 'store' ? 'Search store name or ID' : 'Search product or item number'} />
        <select value={cur ? cur.i : -1} onChange={e => setSel(+e.target.value)}>
          {view === 'prod' && <option value={-1}>All products, ranked by gaps</option>}
          {pickList.length === 0 && <option value="">No matches</option>}
          {pickList.slice(0, 500).map(x => <option key={x.i} value={x.i}>{pickLabel(x)}</option>)}
        </select>
      </div>
      {view === 'prod' && cur && <button className="back-rank" onClick={backToRanking}>← All products</button>}
      {cur && view === 'prod' && cur.rrp && <p className="meta">RRP ${cur.rrp.toFixed(2)} · GM {cur.gm}% · Metcash grading {cur.g} · {cur.rc} rank {cur.rank}</p>}
      {cur && view === 'store' && <p className="meta">{cur.b}{cur.mso ? ' · ' + cur.mso : ''} · store rank {cur.rk === 99999 ? 'n/a' : cur.rk}{cur.rep ? ' · ' + cur.rep : ''}{cur.sun ? ` · Sun prepack ${cur.sun[0] === 'pp' ? 'received' : 'on hold'} ${fmt(cur.sun[1])}` : ''}</p>}

      {ranking ? rankList : <>
      <div className="kpis">
        {[['all', 'All lines', lines.length, ''], ['nev', 'Never', c('nev'), 'r'], ['lap', 'Lapsed', c('lap'), 'a'], ['buy', 'Buying', c('buy'), 'g'], ['sun', 'Sun PP / Hold', `${c('pp')} / ${c('hold')}`, 'b']]
          .map(([k, t, v, cl]) => <button key={k} className={'kpi ' + cl + (flt === k ? ' on' : '')} onClick={() => setFlt(k)}><span>{t}</span><b>{v}</b></button>)}
      </div>

      <div className="tbl">
        <div className="row head">
          <span>{view === 'store' ? 'Product' : 'Store'}</span>
          <span>{view === 'store' ? 'Item no.' : 'Store ID'}</span>
          <span>Status</span>
          <span>{fmt(D.cols[0]).slice(3)} → {fmt(data.reports[D.NB - 1]).slice(3)} <span className="sep" /> to {fmt(D.cols[D.cols.length - 1]).slice(0, 5)}</span>
          <span>Last bought</span>
        </div>
        {shown.slice(0, limit).map(l => (
          <div className="row" key={view === 'store' ? l.p.i : l.s.i}>
            <span className="nm">{view === 'store' ? <>{tags(l.p)}{l.p.n}</> : <>{l.s.n} <small>({l.s.state}{l.s.rep ? ', ' + l.s.rep.split(' ')[0] : ''})</small></>}</span>
            <span className="num">{view === 'store' ? l.p.r : l.s.id}</span>
            <span><span className={'pill ' + l.status}>{LABEL[l.status]}</span></span>
            <span className="dots">{dots(l)}</span>
            <span className="last">{lastLabel(l)}</span>
          </div>
        ))}
        {shown.length === 0 && <p className="bnb-msg">No lines match these filters.</p>}
        {shown.length > limit && <button className="more" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</button>}
      </div>

      <div className="legend">
        <span className="dot on" />bought <span className="dot" />not bought <span className="dot na" />not in that report
        <span className="dot pp" />sun prepack (that week) <span className="dot hold" />prepack on hold <span className="sep" />weekly after last report
        <button onClick={doExport} disabled={!shown.length}>Export call list (CSV)</button>
      </div>
      </>}
      {foot}
    </div>
  )

  /* ---------- phone / tablet: cards ---------- */
  return (
    <div className="m">
      <header className="m-top">
        <div className="m-row">
          {view === 'prod' && cur && <button className="theme" onClick={backToRanking} aria-label="All products"><Icon name="back" /></button>}
          <div className="m-ttl">
            <div className="m-name">{ranking ? 'Gaps by product' : cur ? cur.n : 'No matches'}</div>
            <div className="m-sub">{ranking ? `${scope === 'team' ? 'Your list' : 'All Metcash'} · ${st === 'All' ? 'All states' : st} · ${storeCount} stores` : curSub}</div>
          </div>
          {themeBtn}
        </div>
        <button className="m-search" onClick={() => { setQ(''); setSheet('pick') }}><Icon name="search" />{view === 'store' ? 'Change store' : ranking ? 'Find a product' : 'Change product'}</button>
      </header>

      <div className="chips">
        {CHIPS.map(([v, t]) => <button key={v} className={'chip' + (rg === v ? ' on' : '')} onClick={() => setRg(v)}>{t}</button>)}
        <button className={'chip' + (hideDel ? ' on' : '')} onClick={() => setHideDel(!hideDel)}>Hide deleted</button>
      </div>

      {ranking ? <div className="m-rank">{rankList}</div> : <>
      <div className="m-kpis">
        {[['nev', 'Never', c('nev')], ['lap', 'Lapsed', c('lap')], ['buy', 'Buying', c('buy')], ['sun', 'Sun PP', c('hold') ? `${c('pp')}/${c('hold')}` : c('pp')]]
          .map(([k, t, v]) => <button key={k} className={'m-kpi k-' + k + (flt === k ? ' on' : '')} onClick={() => setFlt(flt === k ? 'all' : k)}><b>{v}</b><span>{t}</span></button>)}
      </div>
      <div className="m-count">{flt === 'all' ? `${shown.length} lines` : `${shown.length} ${LABEL[flt === 'sun' ? 'pp' : flt].toLowerCase()} · tap again to clear`}</div>

      <div className="cards">
        {shown.slice(0, limit).map(l => {
          const k = view === 'store' ? l.p.i : l.s.i
          const isOpen = open === k
          return (
            <div key={k} className={'card' + (isOpen ? ' open' : '')} onClick={() => setOpen(isOpen ? null : k)}>
              <div className="c-r1">
                <div className="c-main">
                  <div className="c-nm">{view === 'store' ? <>{tags(l.p)}{l.p.n}</> : l.s.n}</div>
                  <div className="c-sub">{view === 'store' ? l.p.r : `${l.s.id} · ${l.s.state}${l.s.rep ? ' · ' + l.s.rep.split(' ')[0] : ''}`} · {lastLabel(l)}</div>
                </div>
                <span className={'pill ' + l.status}>{LABEL[l.status]}</span>
              </div>
              <div className="c-dots">{dots(l)}</div>
              {isOpen && <div className="c-more">
                {view === 'store'
                  ? <>{l.p.rc ? `${l.p.rc} #${l.p.rank} · RRP $${l.p.rrp.toFixed(2)} · GM ${l.p.gm}% · Grade ${l.p.g}` : (l.p.c || 'Not in range book')}<br /></>
                  : <>{l.s.b}{l.s.mso ? ' · ' + l.s.mso : ''} · store rank {l.s.rk === 99999 ? 'n/a' : l.s.rk}<br /></>}
                Bought in {bits(l.mask)} of {bits(l.common)} reports
                {view === 'prod' && <button className="c-link" onClick={e => { e.stopPropagation(); setView('store'); setSel(l.s.i); setFlt('all'); window.scrollTo(0, 0) }}>Open store</button>}
              </div>}
            </div>
          )
        })}
        {shown.length === 0 && <p className="bnb-msg">No lines match these filters.</p>}
      </div>
      {shown.length > limit && <button className="more m-more" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</button>}
      </>}
      <div className="m-pad">{foot}<a href="/#bnb" className="m-back">Back to pilot</a></div>

      <nav className="tabs">
        <button className={view === 'store' ? 'on' : ''} onClick={() => view === 'store' ? setSheet('pick') : switchView('store')}><Icon name="store" />Store</button>
        <button className={view === 'prod' ? 'on' : ''} onClick={() => view === 'prod' ? backToRanking() : switchView('prod')}><Icon name="box" />Product</button>
        <button className={sheet === 'filters' ? 'on' : ''} onClick={() => setSheet('filters')}><Icon name="sliders" />Filters</button>
        <button onClick={doExport}><Icon name="download" />Export</button>
      </nav>

      {sheet && <div className="scrim" onClick={e => e.target === e.currentTarget && setSheet('')}>
        <div className={'sheet' + (sheet === 'pick' ? ' tall' : '')}>
          <div className="sh-hd">
            <b>{sheet === 'pick' ? (view === 'store' ? 'Choose a store' : 'Choose a product') : 'Filters'}</b>
            <button className="theme" onClick={() => setSheet('')} aria-label="Close"><Icon name="x" /></button>
          </div>
          {sheet === 'pick' ? <>
            <input className="sh-q" value={q} onChange={e => setQ(e.target.value)} placeholder={view === 'store' ? 'Store name or ID' : 'Product or item number'} />
            <div className="sh-list">
              {pickList.slice(0, 200).map(x => (
                <button key={x.i} className={'sh-item' + (cur && cur.i === x.i ? ' on' : '')} onClick={() => { setSheet(''); view === 'prod' ? openProd(x.i) : (setSel(x.i), setFlt('all'), window.scrollTo(0, 0)) }}>
                  {view === 'store'
                    ? <><b>{x.n}</b><small>{x.state} · {x.id}{x.rep ? ' · ' + x.rep : ''}{x.sun ? (x.sun[0] === 'pp' ? ' · SUN PP' : ' · Sun Hold') : ''}</small></>
                    : <><b>{x.n}</b><small>{x.r}{x.ss ? ' · Sea Salt' : x.msl ? ' · MSL' : ''}{x.pp ? ' · Prepack' : ''}</small></>}
                </button>
              ))}
              {pickList.length === 0 && <p className="bnb-msg">No matches. Check the state and rep filters.</p>}
              {pickList.length > 200 && <p className="bnb-msg">Showing 200 of {pickList.length}. Type to narrow it down.</p>}
            </div>
          </> : <div className="sh-body">{filterControls}<button className="sh-done" onClick={() => setSheet('')}>Done</button></div>}
        </div>
      </div>}
    </div>
  )
}
