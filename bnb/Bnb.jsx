import React, { useEffect, useMemo, useState } from 'react'

const STATES = ['All', 'SA', 'WA', 'NSW', 'QLD', 'VIC', 'Other']
const RANGES = [['all', 'All lines'], ['ss', 'Sea Salt'], ['msl', 'MSL incl. Sea Salt'], ['pp', 'Sun prepack 6']]
const LABEL = { buy: 'Buying', lap: 'Lapsed', nev: 'Never', pp: 'SUN PP', hold: 'Sun Hold' }
const STATUS_ORDER = { lap: 0, nev: 1, hold: 2, buy: 3, pp: 4 }
const PAGE = 300

const fmt = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}` }
const highBit = m => (m ? 31 - Math.clz32(m) : -1)

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

export default function Bnb() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [view, setView] = useState('store')
  const [st, setSt] = useState('SA')
  const [rg, setRg] = useState('all')
  const [rep, setRep] = useState('')
  const [banner, setBanner] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState('pri')
  const [hideDel, setHideDel] = useState(true)
  const [activeOnly, setActiveOnly] = useState(true)
  const [flt, setFlt] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(-1)
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    fetch('/bnb-data.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(setData).catch(() => setErr("Couldn't load the report data. Check signal and refresh."))
  }, [])

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
    return { NB, cols, stores, products, reps, banners, cats }
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
    const lastIdx = highBit(mask)
    return { s, p, mask, status, lastIdx, sunLine }
  }

  const storeOk = s => (st === 'All' || s.state === st) && (!rep || s.rep === rep) && (!banner || s.b === banner) && (!activeOnly || s.active)
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
  }, [D, view, q, st, rep, banner, activeOnly, rg, cat, hideDel])

  const cur = pickList.find(x => x.i === sel) || pickList[0]

  const lines = useMemo(() => {
    if (!D || !cur) return []
    const out = []
    if (view === 'store') { for (const p of D.products) if (prodOk(p)) { const l = line(cur, p); if (l) out.push(l) } }
    else { for (const s of D.stores) if (storeOk(s)) { const l = line(s, cur); if (l) out.push(l) } }
    return out
  }, [D, cur, view, st, rep, banner, activeOnly, rg, cat, hideDel])

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
        ? (a, b) => pri(a) - pri(b) || (a.p.rc || '').localeCompare(b.p.rc || '') || (a.p.rank || 99) - (b.p.rank || 99) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        : (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.s.rk - b.s.rk,
    }[sort]
    return f.sort(cmp)
  }, [lines, flt, sort, view])

  useEffect(() => setLimit(PAGE), [cur, flt, sort, view])

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
        if (!((l.s.seen & l.p.seen) >> i & 1)) cls += ' na'
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

  const doExport = () => {
    const head = view === 'store'
      ? ['Store', 'Store ID', 'State', 'Item no.', 'Product', 'Range', 'Rank', 'Status', 'Last bought']
      : ['Product', 'Item no.', 'Store', 'Store ID', 'State', 'Rep', 'Status', 'Last bought']
    const rows = shown.map(l => view === 'store'
      ? [cur.n, cur.id, cur.state, l.p.r, l.p.n, l.p.ss ? 'Sea Salt' : l.p.msl ? 'MSL' : '', l.p.rank || '', LABEL[l.status], lastLabel(l)]
      : [cur.n, cur.r, l.s.n, l.s.id, l.s.state, l.s.rep, LABEL[l.status], lastLabel(l)])
    const who = (view === 'store' ? cur.n : cur.r).replace(/[^a-z0-9]+/gi, '_')
    download(`bnb_${who}_${data.built}.csv`, csv([head, ...rows]))
  }

  const Seg = ({ items, value, onChange, label }) => (
    <div className="seg-row"><span className="seg-lbl">{label}</span>
      {items.map(([v, t]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  )

  return (
    <div className="bnb">
      <header className="bnb-hdr">
        <div>
          <h1>Beiersdorf buy / not buy history</h1>
          <p>{D.NB} reports, W/E {fmt(data.reports[0])} to {fmt(data.reports[D.NB - 1])}. Sun prepack orders to {fmt(data.built)}.</p>
        </div>
        <a href="/" className="back">Back to pilot</a>
      </header>

      <Seg label="State" items={STATES.map(s => [s, s])} value={st} onChange={v => { setSt(v); setSel(-1) }} />
      <Seg label="Range" items={RANGES} value={rg} onChange={setRg} />

      <div className="ctrls">
        <select value={rep} onChange={e => { setRep(e.target.value); setSel(-1) }}>
          <option value="">All reps</option>
          {D.reps.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={banner} onChange={e => { setBanner(e.target.value); setSel(-1) }}>
          <option value="">All banners</option>
          {D.banners.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          {D.cats.map(x => <option key={x}>{x}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="pri">{view === 'store' ? 'Sort: Sea Salt, MSL, rank' : 'Sort: status, store rank'}</option>
          <option value="stat">Sort: status</option>
          <option value="az">Sort: A to Z</option>
          <option value="num">Sort: {view === 'store' ? 'item number' : 'store ID'}</option>
        </select>
        <label><input type="checkbox" checked={hideDel} onChange={e => setHideDel(e.target.checked)} /> Hide deleted items</label>
        <label><input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setSel(-1) }} /> Current stores only</label>
        <div className="view">
          <button className={view === 'store' ? 'on' : ''} onClick={() => { setView('store'); setSel(-1); setQ('') }}>By store</button>
          <button className={view === 'prod' ? 'on' : ''} onClick={() => { setView('prod'); setSel(-1); setQ('') }}>By product</button>
        </div>
      </div>

      <div className="picker">
        <input value={q} onChange={e => { setQ(e.target.value); setSel(-1) }} placeholder={view === 'store' ? 'Search store name or ID' : 'Search product or item number'} />
        <select value={cur ? cur.i : ''} onChange={e => setSel(+e.target.value)}>
          {pickList.length === 0 && <option value="">No matches</option>}
          {pickList.slice(0, 500).map(x => <option key={x.i} value={x.i}>
            {view === 'store'
              ? `${x.n} (${x.state}) · ${x.id}${x.rep ? ' · ' + x.rep : ''}${x.sun ? (x.sun[0] === 'pp' ? ' · SUN PP' : ' · Sun Hold') : ''}`
              : `${x.r} · ${x.n}${x.ss ? ' · SS' : x.msl ? ' · MSL' : ''}${x.pp ? ' · PP' : ''}`}
          </option>)}
        </select>
      </div>
      {cur && view === 'prod' && cur.rrp && <p className="meta">RRP ${cur.rrp.toFixed(2)} · GM {cur.gm}% · Metcash grading {cur.g} · {cur.rc} rank {cur.rank}</p>}
      {cur && view === 'store' && <p className="meta">{cur.b}{cur.mso ? ' · ' + cur.mso : ''} · store rank {cur.rk === 99999 ? 'n/a' : cur.rk}{cur.rep ? ' · ' + cur.rep : ''}{cur.sun ? ` · Sun prepack ${cur.sun[0] === 'pp' ? 'received' : 'on hold'} ${fmt(cur.sun[1])}` : ''}</p>}

      <div className="kpis">
        {[['all', 'All lines', lines.length, ''], ['buy', 'Buying', c('buy'), 'g'], ['lap', 'Lapsed', c('lap'), 'a'], ['nev', 'Never', c('nev'), 'r'], ['sun', 'Sun PP / Hold', `${c('pp')} / ${c('hold')}`, 'b']]
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
      <p className="foot">Each dot is a 26 week report: green means the store bought it at least once in the 26 weeks to that date. Lapsed = bought in an earlier report but not the latest. Sun prepack stores get SUN PP on the 6 prepack lines. Range tags from the Beiersdorf Metcash range book (July 2026).</p>
    </div>
  )
}
