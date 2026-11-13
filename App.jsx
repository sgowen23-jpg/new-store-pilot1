import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DEMO, loadStores, saveVisit, loadBlitz, saveBlitzVisit } from './data.js'
import { STATES, exportExcel, exportSummary } from './exporters.js'

const CORAL = '#FF8A65'
const WHITE = '#FFFFFF'
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%'

/* ---------- projects on the home wheel (swipe left / right) ---------- */
const PROJECTS = [
  { key: 'gsv', title: <>Team V GSV<br />Non Universe</>, tab: 'GSV Non Universe' },
  { key: 'blitz', title: <>NSW Vitasoy<br />Blitz</>, tab: 'NSW Blitz' },
]
const BLITZ_DAYS = ['TUE', 'WED', 'THU']
const DAY_NAMES = { TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday' }
const isStore = s => s.kind === 'target' || s.kind === 'fillin'

const BLITZ_QUESTIONS = [
  { key: 'call_completed', title: 'Call completed?', kind: 'yn' },
  { key: 'sold_in_tower', title: 'Sold in tower?', kind: 'yn', targetsOnly: true },
  { key: 'units', title: 'Units ordered', kind: 'num' },
  { key: 'visit_notes', title: 'Notes', kind: 'txt' },
]
const BLITZ_EMPTY = { call_completed: '', sold_in_tower: '', units: '', visit_notes: '' }
const mapsUrl = s => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${s.store_name} ${s.address} NSW`)

const QUESTIONS = [
  { key: 'call_completed', title: 'Call completed?', kind: 'yn' },
  { key: 'sold_in_tower', title: 'Sold in tower?', kind: 'yn' },
  { key: 'volume', title: 'Volume ordered', kind: 'num' },
  { key: 'vita_gains', title: 'Vitasoy gains', kind: 'num' },
  { key: 'notes', title: 'Notes', kind: 'txt' },
]
const EMPTY = { call_completed: '', sold_in_tower: '', volume: '', vita_gains: '', notes: '' }

/* ---------- icons ---------- */
const Icon = ({ d, size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ArrowLeft = () => <Icon d={<><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6-6" /></>} />
const Home = () => <Icon d={<><path d="M5 12H3l9-9 9 9h-2" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" /></>} />
const Download = () => <Icon size={17} d={<><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M7 11l5 5 5-5" /><path d="M12 4v12" /></>} />
const Check = () => <Icon size={22} d={<path d="M5 12l5 5L20 7" />} />
const Sheet = () => <Icon size={20} d={<><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M8 11h8v7H8z" /><path d="M8 15h8" /><path d="M11 11v7" /></>} />
const Doc = () => <Icon size={20} d={<><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 9h1" /><path d="M9 13h6" /><path d="M9 17h6" /></>} />
const Route = () => <Icon size={18} d={<><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H12" /></>} />

/* ---------- full blitz itinerary (all three days) ---------- */
const hrs = m => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`
// Google Maps allows about 10 points per link, so long days get two links
const dirLinks = stops => {
  const p = stops.map(s => `${s.lat},${s.lng}`)
  const out = []
  for (let i = 0; i < p.length - 1; i += 9) out.push(p.slice(i, i + 10))
  return out.map(c => 'https://www.google.com/maps/dir/' + c.join('/'))
}

function Itinerary({ stops, onBack }) {
  const stores = stops.filter(isStore)
  const totalKm = stops.reduce((a, s) => a + Number(s.km || 0), 0)
  const totalMin = stops.reduce((a, s) => a + Number(s.drive_min || 0), 0)
  return (
    <div className="page">
      <div className="hdr">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><ArrowLeft /></button>
        <div className="ttl itin-ttl">Full itinerary</div>
        <span />
      </div>
      <div className="itin-sum">
        {stores.filter(s => s.kind === 'target').length} sun targets · {stores.length} stores · {Math.round(totalKm)} km · {hrs(totalMin)} driving
      </div>
      <div className="itin-scroll">
        {BLITZ_DAYS.map(d => {
          const day = stops.filter(s => s.day === d)
          if (!day.length) return null
          const ds = day.filter(isStore)
          const km = day.reduce((a, s) => a + Number(s.km || 0), 0)
          const min = day.reduce((a, s) => a + Number(s.drive_min || 0), 0)
          const links = dirLinks(day)
          return (
            <section key={d} className="itin-day">
              <div className="itin-dayhead">
                <b>{DAY_NAMES[d]}</b>
                <span>{day[0].day_area}</span>
                <small>{ds.length} stores · {Math.round(km)} km · {hrs(min)} driving</small>
              </div>
              <div className="itin-links">
                {links.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                    Directions{links.length > 1 ? ` ${i + 1} of ${links.length}` : ''} ↗
                  </a>
                ))}
              </div>
              <ol className="itin-list">
                {day.map(s => (
                  <li key={s.id} className={'itin-row ' + s.kind + (s.visited ? ' done' : '')}>
                    {s.seq > 0 && <div className="itin-leg">↓ {Number(s.km).toFixed(1)} km · {s.drive_min} min</div>}
                    <div className="itin-stop">
                      <em>{s.arrive}</em>
                      <i className={'stop-dot' + (s.kind === 'target' ? ' t' : '') + (isStore(s) ? '' : ' h')} />
                      <span className="itin-name">
                        {s.kind === 'start' ? 'Leave ' : s.kind === 'hotel' ? (s.store_name === 'Sydney Airport' ? 'Fly home: ' : 'Hotel: ') : ''}
                        {s.store_name}
                        <small>{s.address}{isStore(s) && s.gaps != null ? ` · ${s.gaps} gaps` : ''}</small>
                      </span>
                      {s.visited && <span className="itin-tick">{s.sold_in_tower === 'Yes' ? 'Tower ✓' : '✓'}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
        <p className="itin-foot">km are road distances on the fastest route (toll roads), estimated for newly added stores. Times assume leaving at 7:30am, 40 min at key stores (Vitasoy top 5, stores with a tower, Doonside), 30 min elsewhere, extra parking time in the inner city and a 30 min lunch.</p>
      </div>
    </div>
  )
}

/* ---------- wheel styling (applied directly to DOM for smooth scrolling) ---------- */
function styleWheel(el, itemH, opts) {
  if (!el) return
  const items = el.querySelectorAll('[data-wheel-item]')
  const centre = el.scrollTop + el.clientHeight / 2
  items.forEach((it, i) => {
    const d = (i * itemH + itemH / 2 - centre) / itemH
    const a = Math.min(Math.abs(d), opts.limit)
    it.style.transform = `rotateX(${-d * opts.rot}deg) scale(${1 - a * opts.scale})`
    it.style.opacity = String(1 - a * opts.fade)
    if (opts.highlight) it.style.color = Math.abs(d) < 0.5 ? CORAL : WHITE
  })
}

/* ---------- big looping wheel (3 visible): states, or blitz days ---------- */
const STATE_H = 110
const LOOPS = 7

function StateWheel({ onPick, items = STATES }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const mid = Math.floor(LOOPS / 2) * items.length
  const opts = { limit: 1.6, rot: 28, scale: 0.25, fade: 0.28, highlight: true }
  const restyle = () => styleWheel(ref.current, STATE_H, opts)

  useLayoutEffect(() => {
    ref.current.scrollTop = mid * STATE_H - STATE_H
    restyle()
  }, [])

  const onScroll = () => {
    requestAnimationFrame(restyle)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.round((el.scrollTop + STATE_H) / STATE_H)
      const k = ((i % items.length) + items.length) % items.length
      if (Math.abs(i - mid) > items.length) {
        el.scrollTop = (mid + k) * STATE_H - STATE_H
        restyle()
      }
    }, 150)
  }

  return (
    <div className="state-wheel-wrap">
      <div className="state-band" />
      <div className="wheel state-wheel" ref={ref} onScroll={onScroll}>
        {Array.from({ length: LOOPS }).flatMap((_, r) =>
          items.map(s => (
            <div key={r + s} data-wheel-item className="state-item" onClick={() => onPick(s)}>{s}</div>
          ))
        )}
      </div>
    </div>
  )
}

/* ---------- horizontal project wheel (swipe left / right) ---------- */
const LAST_PROJECT_KEY = 'nsp_last_project'

function ProjectWheel({ children, onChange }) {
  const ref = useRef(null)
  // A link ending in #blitz (or #gsv) opens straight on that project; otherwise reopen the last one used
  const [idx, setIdx] = useState(() => {
    const fromHash = PROJECTS.findIndex(p => '#' + p.key === window.location.hash)
    if (fromHash >= 0) return fromHash
    try { return Math.max(0, PROJECTS.findIndex(p => p.key === localStorage.getItem(LAST_PROJECT_KEY))) } catch { return 0 }
  })
  const panels = Array.isArray(children) ? children : [children]

  const restyle = () => {
    const el = ref.current
    if (!el) return
    const w = el.clientWidth || 1
    el.querySelectorAll('[data-project]').forEach((p, i) => {
      const d = (i * w - el.scrollLeft) / w
      const a = Math.min(Math.abs(d), 1)
      p.style.transform = `rotateY(${d * 32}deg) scale(${1 - a * 0.12})`
      p.style.opacity = String(1 - a * 0.55)
    })
  }

  useLayoutEffect(() => {
    const el = ref.current
    el.scrollLeft = idx * el.clientWidth
    restyle()
    onChange?.(PROJECTS[idx].key)
    const onResize = () => { el.scrollLeft = idx * el.clientWidth; restyle() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onScroll = () => {
    requestAnimationFrame(restyle)
    const el = ref.current
    const i = Math.round(el.scrollLeft / (el.clientWidth || 1))
    if (i !== idx && PROJECTS[i]) {
      setIdx(i)
      onChange?.(PROJECTS[i].key)
      try { localStorage.setItem(LAST_PROJECT_KEY, PROJECTS[i].key) } catch { /* ignore */ }
      try { history.replaceState(null, '', '#' + PROJECTS[i].key) } catch { /* ignore */ }
    }
  }

  const go = (i) => ref.current.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })

  // Mouse drag to swipe on desktop (touch already swipes natively)
  const drag = useRef(null)
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; ref.current.style.scrollSnapType = 'none' }
    if (d.moved) ref.current.scrollLeft = d.left - dx
  }
  const endDrag = (e) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.moved) return
    const el = ref.current
    el.style.scrollSnapType = ''
    const w = el.clientWidth || 1
    const dx = (e?.clientX ?? d.x) - d.x
    let i = Math.round(d.left / w)
    if (dx < -w * 0.15) i += 1
    if (dx > w * 0.15) i -= 1
    go(Math.max(0, Math.min(PROJECTS.length - 1, i)))
    const stop = (ev) => { ev.stopPropagation(); ev.preventDefault() }
    el.addEventListener('click', stop, { capture: true, once: true })
    setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0)
  }

  return (
    <>
      <div className="project-wheel" ref={ref} onScroll={onScroll}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
        {panels.map((p, i) => <div key={PROJECTS[i].key} data-project className="project-panel">{p}</div>)}
      </div>
      <div className="project-tabs" role="tablist" aria-label="Projects">
        {PROJECTS.map((p, i) => (
          <button key={p.key} role="tab" aria-selected={i === idx}
            className={i === idx ? 'on' : ''} onClick={() => go(i)}>{p.tab}</button>
        ))}
      </div>
    </>
  )
}

/* ---------- store wheel (7 visible) ---------- */
const STORE_H = 50

function StoreWheel({ stores, onPick, resetKey, idKey = 'store_id', render = s => <span>{s.store_name}</span>, empty = 'No stores here yet' }) {
  const ref = useRef(null)
  const opts = { limit: 3.5, rot: 9, scale: 0.06, fade: 0.16, highlight: false }
  const restyle = () => styleWheel(ref.current, STORE_H, opts)

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0
    restyle()
  }, [resetKey, stores.length])

  if (!stores.length) return <div className="wheel store-wheel empty">{empty}</div>

  return (
    <div className="wheel store-wheel" ref={ref} onScroll={() => requestAnimationFrame(restyle)}>
      {stores.map(s => (
        <div key={s[idKey]} data-wheel-item className="store-item" onClick={() => onPick(s)}>
          {render(s)}
        </div>
      ))}
    </div>
  )
}

/* ---------- question screen ---------- */
function Questions({ store, onBack, onHome, onSaved, questions = QUESTIONS, initial, save, info, id }) {
  const QUESTIONS = questions
  const storeId = id ?? store.store_id
  const [qi, setQi] = useState(0)
  const [ans, setAns] = useState(() => initial ?? (store.visited ? {
    call_completed: store.call_completed || '',
    sold_in_tower: store.sold_in_tower || '',
    volume: store.volume ?? '',
    vita_gains: store.vita_gains ?? '',
    notes: store.notes || '',
  } : EMPTY))
  const [err, setErr] = useState('')
  const [state, setState] = useState('idle') // idle | saving | done
  const inputRef = useRef(null)
  const advancing = useRef(false)
  const q = QUESTIONS[qi]
  const last = qi === QUESTIONS.length - 1

  useEffect(() => {
    advancing.current = false
    setErr('')
    if (q.kind !== 'yn') inputRef.current?.focus()
  }, [qi])

  const set = (v) => { setAns(a => ({ ...a, [q.key]: v })); setErr('') }

  const next = async (override) => {
    if (state !== 'idle') return
    const value = override ?? ans[q.key]
    if (q.kind === 'yn' && !value) return setErr('Pick yes or no')
    if (q.kind === 'num' && String(value) === '') return setErr('Enter a number')
    if (q.kind === 'txt' && !String(value).trim()) return setErr('Add a short note')
    if (!last) return setQi(i => i + 1)

    setState('saving')
    try {
      const row = await (save ?? saveVisit)(storeId, ans)
      setState('done')
      setTimeout(() => onSaved(storeId, row), 700)
    } catch (e) {
      console.error(e)
      setState('idle')
      setErr("Couldn't save. Check signal and press Complete again")
    }
  }

  const pickYN = (v) => {
    if (advancing.current) return
    advancing.current = true
    set(v)
    setTimeout(() => next(v), 220)
  }

  const back = () => {
    if (state !== 'idle') return
    if (qi > 0) setQi(i => i - 1)
    else onBack()
  }

  return (
    <div className="page">
      <div className="hdr">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft /></button>
        <div className="ttl store-ttl">{store.store_name}</div>
        <button className="icon-btn" onClick={() => state === 'idle' && onHome()} aria-label="Home"><Home /></button>
      </div>
      {info}
      <div className="dots">
        {QUESTIONS.map((_, k) => <span key={k} className={k <= qi ? 'on' : ''} />)}
      </div>
      <div className="q-body">
        <div className="q-title">{q.title}</div>

        {q.kind === 'yn' && (
          <div className="yn">
            {['Yes', 'No'].map(v => (
              <button key={v} className={ans[q.key] === v ? 'on' : ''} onClick={() => pickYN(v)}>{v}</button>
            ))}
          </div>
        )}

        {q.kind === 'num' && (
          <input
            ref={inputRef}
            key={q.key}
            className="inp"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={ans[q.key]}
            onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && next()}
          />
        )}

        {q.kind === 'txt' && (
          <textarea
            ref={inputRef}
            className="inp txt"
            placeholder="Ranged 4 SKUs, follow up order next week"
            value={ans[q.key]}
            onChange={e => set(e.target.value)}
          />
        )}

        <div className="err">{err}</div>

        {q.kind !== 'yn' && (
          <button className={'next' + (state === 'done' ? ' ok' : '')} onClick={() => next()} disabled={state === 'saving'}>
            {last ? <><Check />{state === 'saving' ? 'Saving' : 'Complete'}</> : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- app ---------- */
export default function App() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [page, setPage] = useState('home') // home | state | store
  const [curState, setCurState] = useState('SA')
  const [mode, setMode] = useState('todo') // todo | done
  const [curStore, setCurStore] = useState(null)
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [project, setProject] = useState('gsv')
  const [blitz, setBlitz] = useState([])
  const [blitzErr, setBlitzErr] = useState('')
  const [curDay, setCurDay] = useState('TUE')
  const [curStop, setCurStop] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await loadStores()
      setStores(data)
      setLoadErr('')
    } catch (e) {
      console.error(e)
      setLoadErr("Couldn't load stores. Check signal.")
    } finally {
      setLoading(false)
    }
    try {
      setBlitz(await loadBlitz())
      setBlitzErr('')
    } catch (e) {
      console.error(e)
      setBlitzErr("Couldn't load the blitz. Check signal.")
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVis = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const total = stores.length
  const visited = stores.filter(s => s.visited).length
  const inState = useMemo(() => stores.filter(s => s.state === curState), [stores, curState])
  const stateVisited = inState.filter(s => s.visited).length
  const listed = inState.filter(s => (mode === 'done') === !!s.visited)

  const openState = (s) => { setCurState(s); setMode('todo'); setPage('state'); refresh() }
  const openStore = (s) => { setCurStore(s); setPage('store') }
  const goHome = () => { setPage('home'); refresh() }

  const onSaved = (id, row) => {
    setStores(list => list.map(s => (s.store_id === id ? { ...s, ...row } : s)))
    setMode('todo')
    setPage('state')
  }

  /* blitz */
  const blitzStores = blitz.filter(isStore)
  const blitzTargets = blitzStores.filter(s => s.kind === 'target')
  const towersSold = blitzTargets.filter(s => s.sold_in_tower === 'Yes').length
  const blitzVisited = blitzStores.filter(s => s.visited).length
  const dayStops = blitz.filter(s => s.day === curDay)
  const dayStores = dayStops.filter(isStore)
  const dayTargets = dayStores.filter(s => s.kind === 'target')
  const dayListed = dayStores.filter(s => (mode === 'done') === !!s.visited)
  const dayHotel = dayStops.find(s => s.kind === 'hotel')

  const openDay = (d) => { setCurDay(d); setMode('todo'); setPage('day'); refresh() }
  const openStop = (s) => { setCurStop(s); setPage('stop') }
  const onBlitzSaved = (id, row) => {
    setBlitz(list => list.map(s => (s.id === id ? { ...s, ...row } : s)))
    setMode('todo')
    setPage('day')
  }

  const doExport = (kind) => {
    setMenu(false)
    if (!stores.length) return showToast('Nothing to export yet')
    try {
      if (kind === 'xlsx') { exportExcel(stores); showToast('Excel file downloaded') }
      else { exportSummary(stores); showToast('HTML summary downloaded') }
    } catch (e) {
      console.error(e)
      showToast('Export failed. Try again')
    }
  }

  return (
    <div className="app">
      {/* HOME */}
      <div className={'page' + (page === 'home' ? '' : ' hidden')}>
        {DEMO && <div className="demo">Demo mode</div>}
        <ProjectWheel onChange={setProject}>
          <>
            <div className="home-title">{PROJECTS[0].title}</div>
            <StateWheel onPick={openState} />
            <div className="pct">
              <b>{loading ? '...' : pct(visited, total)}</b>
              <small>{loadErr || (loading ? 'Loading stores' : `${visited} of ${total} visited`)}</small>
            </div>
          </>
          <>
            <div className="home-title">{PROJECTS[1].title}</div>
            <StateWheel onPick={openDay} items={BLITZ_DAYS} />
            <div className="pct">
              <b>{loading ? '...' : pct(towersSold, blitzTargets.length)}</b>
              <small>{blitzErr || (loading ? 'Loading the blitz' : `${towersSold} of ${blitzTargets.length} towers sold · ${blitzVisited} of ${blitzStores.length} visited`)}</small>
            </div>
          </>
        </ProjectWheel>
        {project === 'gsv' && <button className="export-btn" onClick={() => setMenu(true)} aria-label="Export"><Download /></button>}
        {project === 'blitz' && (
          <button className="itin-btn" onClick={() => setPage('itin')} aria-label="Full itinerary"><Route />Itinerary</button>
        )}
        {menu && (
          <div className="scrim" onClick={e => e.target === e.currentTarget && setMenu(false)}>
            <div className="sheet">
              <div className="sheet-lbl">Export visits</div>
              <button className="opt pri" onClick={() => doExport('xlsx')}><Sheet />Excel file</button>
              <button className="opt" onClick={() => doExport('html')}><Doc />HTML summary</button>
              <button className="cancel" onClick={() => setMenu(false)}>Cancel</button>
            </div>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>

      {/* STATE / STORE LIST */}
      <div className={'page' + (page === 'state' ? '' : ' hidden')}>
        <div className="hdr">
          <button className="icon-btn" onClick={goHome} aria-label="Back to states"><ArrowLeft /></button>
          <div className="ttl state-ttl">{curState}</div>
          <button className="icon-btn" onClick={goHome} aria-label="Home"><Home /></button>
        </div>
        <div className="seg">
          <button className={mode === 'todo' ? 'on' : ''} onClick={() => setMode('todo')}>Not visited</button>
          <button className={mode === 'done' ? 'on' : ''} onClick={() => setMode('done')}>Visited</button>
        </div>
        <StoreWheel stores={listed} onPick={openStore} resetKey={curState + mode + page} />
        <div className="pct">
          <b>{pct(stateVisited, inState.length)}</b>
          <small>{stateVisited} of {inState.length} visited</small>
        </div>
      </div>

      {page === 'itin' && <Itinerary stops={blitz} onBack={() => setPage('home')} />}

      {/* BLITZ DAY */}
      <div className={'page' + (page === 'day' ? '' : ' hidden')}>
        <div className="hdr">
          <button className="icon-btn" onClick={goHome} aria-label="Back to days"><ArrowLeft /></button>
          <div className="ttl state-ttl">{curDay}</div>
          <button className="icon-btn" onClick={goHome} aria-label="Home"><Home /></button>
        </div>
        <div className="day-sub">{DAY_NAMES[curDay]} · {dayStops[0]?.day_area}</div>
        <div className="seg">
          <button className={mode === 'todo' ? 'on' : ''} onClick={() => setMode('todo')}>Not visited</button>
          <button className={mode === 'done' ? 'on' : ''} onClick={() => setMode('done')}>Visited</button>
        </div>
        <StoreWheel
          stores={dayListed}
          onPick={openStop}
          idKey="id"
          resetKey={curDay + mode + page}
          empty={mode === 'todo' ? 'Every store done for today' : 'No visits yet today'}
          render={s => (
            <span className="stop-row">
              <em className="stop-time">{s.arrive}</em>
              <i className={'stop-dot' + (s.kind === 'target' ? ' t' : '')} aria-label={s.kind === 'target' ? 'Sun target' : 'Fill-in'} />
              <span className="stop-name">{s.store_name}</span>
            </span>
          )}
        />
        {dayHotel && <div className="day-hotel">Tonight: {dayHotel.store_name} · {dayHotel.arrive}</div>}
        <div className="pct">
          <b>{pct(dayTargets.filter(s => s.sold_in_tower === 'Yes').length, dayTargets.length)}</b>
          <small>{dayTargets.filter(s => s.sold_in_tower === 'Yes').length} of {dayTargets.length} towers sold · {dayStores.filter(s => s.visited).length} of {dayStores.length} visited</small>
        </div>
      </div>

      {page === 'stop' && curStop && (
        <Questions
          key={curStop.id}
          store={curStop}
          id={curStop.id}
          questions={BLITZ_QUESTIONS.filter(q => !q.targetsOnly || curStop.kind === 'target')}
          initial={curStop.visited ? {
            call_completed: curStop.call_completed || '',
            sold_in_tower: curStop.sold_in_tower || '',
            units: curStop.units ?? '',
            visit_notes: curStop.visit_notes || '',
          } : BLITZ_EMPTY}
          save={saveBlitzVisit}
          info={(
            <div className="stop-info">
              <div className="stop-tags">
                <span className={'tag' + (curStop.kind === 'target' ? ' t' : '')}>{curStop.kind === 'target' ? 'Sun target' : 'Fill-in'}</span>
                {curStop.store_rank && <span>Rank {curStop.store_rank}</span>}
                <span>{curStop.gaps != null ? `${curStop.gaps} gaps · ${curStop.must_have} must-have` : 'No ranging data'}</span>
              </div>
              <a className="stop-addr" href={mapsUrl(curStop)} target="_blank" rel="noopener noreferrer">{curStop.address} ↗</a>
              {curStop.note && <div className="stop-note">{curStop.note}</div>}
            </div>
          )}
          onBack={() => setPage('day')}
          onHome={goHome}
          onSaved={onBlitzSaved}
        />
      )}

      {/* QUESTIONS */}
      {page === 'store' && curStore && (
        <Questions
          key={curStore.store_id}
          store={curStore}
          onBack={() => setPage('state')}
          onHome={goHome}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
