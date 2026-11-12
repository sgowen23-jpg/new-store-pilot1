import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DEMO, loadStores, saveVisit } from './data.js'
import { STATES, exportExcel, exportSummary } from './exporters.js'

const CORAL = '#FF8A65'
const WHITE = '#FFFFFF'
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%'

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

/* ---------- state wheel (loops, 3 visible) ---------- */
const STATE_H = 110
const LOOPS = 7
const MID = Math.floor(LOOPS / 2) * STATES.length

function StateWheel({ onPick }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const opts = { limit: 1.6, rot: 28, scale: 0.25, fade: 0.28, highlight: true }
  const restyle = () => styleWheel(ref.current, STATE_H, opts)

  useLayoutEffect(() => {
    ref.current.scrollTop = MID * STATE_H - STATE_H
    restyle()
  }, [])

  const onScroll = () => {
    requestAnimationFrame(restyle)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.round((el.scrollTop + STATE_H) / STATE_H)
      const k = ((i % STATES.length) + STATES.length) % STATES.length
      if (Math.abs(i - MID) > STATES.length) {
        el.scrollTop = (MID + k) * STATE_H - STATE_H
        restyle()
      }
    }, 150)
  }

  return (
    <div className="state-wheel-wrap">
      <div className="state-band" />
      <div className="wheel state-wheel" ref={ref} onScroll={onScroll}>
        {Array.from({ length: LOOPS }).flatMap((_, r) =>
          STATES.map(s => (
            <div key={r + s} data-wheel-item className="state-item" onClick={() => onPick(s)}>{s}</div>
          ))
        )}
      </div>
    </div>
  )
}

/* ---------- store wheel (7 visible) ---------- */
const STORE_H = 50

function StoreWheel({ stores, onPick, resetKey }) {
  const ref = useRef(null)
  const opts = { limit: 3.5, rot: 9, scale: 0.06, fade: 0.16, highlight: false }
  const restyle = () => styleWheel(ref.current, STORE_H, opts)

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0
    restyle()
  }, [resetKey, stores.length])

  if (!stores.length) return <div className="wheel store-wheel empty">No stores here yet</div>

  return (
    <div className="wheel store-wheel" ref={ref} onScroll={() => requestAnimationFrame(restyle)}>
      {stores.map(s => (
        <div key={s.store_id} data-wheel-item className="store-item" onClick={() => onPick(s)}>
          <span>{s.store_name}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- question screen ---------- */
function Questions({ store, onBack, onHome, onSaved }) {
  const [qi, setQi] = useState(0)
  const [ans, setAns] = useState(() => store.visited ? {
    call_completed: store.call_completed || '',
    sold_in_tower: store.sold_in_tower || '',
    volume: store.volume ?? '',
    vita_gains: store.vita_gains ?? '',
    notes: store.notes || '',
  } : EMPTY)
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
      const row = await saveVisit(store.store_id, ans)
      setState('done')
      setTimeout(() => onSaved(store.store_id, row), 700)
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
            value={ans.notes}
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
        <div className="home-title">Team V GSV<br />Non Universe</div>
        <StateWheel onPick={openState} />
        <div className="pct">
          <b>{loading ? '...' : pct(visited, total)}</b>
          <small>{loadErr || (loading ? 'Loading stores' : `${visited} of ${total} visited`)}</small>
        </div>
        <button className="export-btn" onClick={() => setMenu(true)} aria-label="Export"><Download /></button>
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
