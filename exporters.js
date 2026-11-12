import * as XLSX from 'xlsx'

export const STATES = ['SA', 'VIC', 'NSW', 'QLD', 'WA']
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%'
const stamp = () => new Date().toLocaleDateString('en-CA')

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function exportExcel(stores) {
  const header = ['STATE', 'STORE ID', 'STORE', 'VISITED', 'VISIT DATE', 'CALL COMPLETED', 'TOWER', 'VOLUME #', 'VITA GAINS', 'NOTES']
  const rows = [header]
  STATES.forEach(st => stores.filter(s => s.state === st).forEach(s => {
    rows.push([
      s.state, s.store_id, s.store_name,
      s.visited ? 'Yes' : 'No',
      s.visit_date || '',
      s.call_completed || '',
      s.sold_in_tower || '',
      s.volume ?? null,
      s.vita_gains ?? null,
      s.notes || '',
    ])
  }))
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [6, 9, 38, 8, 11, 15, 8, 10, 11, 50].map(w => ({ wch: w }))
  ws['!autofilter'] = { ref: `A1:J${rows.length}` }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Visits')
  XLSX.writeFile(wb, `Team_V_GSV_Non_Universe_Visits_${stamp()}.xlsx`)
}

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function exportSummary(stores) {
  const T = { n: 0, v: 0, c: 0, t: 0, vol: 0, g: 0 }
  let stateRows = ''
  let notes = ''
  STATES.forEach(st => {
    const list = stores.filter(s => s.state === st)
    const done = list.filter(s => s.visited)
    const c = done.filter(s => s.call_completed === 'Yes').length
    const tw = done.filter(s => s.sold_in_tower === 'Yes').length
    const vol = done.reduce((a, s) => a + (s.volume || 0), 0)
    const g = done.reduce((a, s) => a + (s.vita_gains || 0), 0)
    T.n += list.length; T.v += done.length; T.c += c; T.t += tw; T.vol += vol; T.g += g
    stateRows += `<tr><td><b>${st}</b></td><td>${list.length}</td><td>${done.length}</td><td>${pct(done.length, list.length)}</td><td>${c}</td><td>${tw}</td><td>${vol}</td><td>${g}</td></tr>`
    done.forEach(s => {
      notes += `<tr><td>${st}</td><td>${esc(s.store_name)}</td><td>${esc(s.visit_date)}</td><td>${esc(s.notes)}</td></tr>`
    })
  })
  const today = new Date().toLocaleDateString('en-AU')
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Team V GSV Non Universe summary</title><style>
body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#F4F7F8;color:#0E4A5C}
header{background:#0E4A5C;color:#fff;padding:28px 32px}h1{margin:0;font-size:26px}p.s{margin:6px 0 0;color:#9CC4CF}
main{padding:24px 32px;max-width:960px}
.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.k div{background:#fff;border-radius:12px;padding:16px}.k b{display:block;font-size:30px;color:#E0623D}.k span{font-size:13px;color:#5b7a85}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;margin-bottom:24px}
th{background:#0E4A5C;color:#fff;text-align:left;padding:10px;font-size:13px}td{padding:9px 10px;border-top:1px solid #e3eaec;font-size:14px;vertical-align:top}h2{font-size:18px}
</style></head><body><header><h1>Team V GSV Non Universe</h1><p class="s">Visit summary, ${today}</p></header><main>
<div class="k"><div><b>${pct(T.v, T.n)}</b><span>${T.v} of ${T.n} stores visited</span></div><div><b>${T.c}</b><span>Calls completed</span></div><div><b>${T.t}</b><span>Sold in tower</span></div><div><b>${T.vol}</b><span>Total volume</span></div><div><b>${T.g}</b><span>Vitasoy gains</span></div></div>
<h2>By state</h2><table><tr><th>State</th><th>Stores</th><th>Visited</th><th>%</th><th>Calls</th><th>Tower</th><th>Volume</th><th>Gains</th></tr>${stateRows}</table>
<h2>Visit notes</h2><table><tr><th>State</th><th>Store</th><th>Date</th><th>Notes</th></tr>${notes || '<tr><td colspan="4">No visits recorded yet</td></tr>'}</table>
</main></body></html>`
  download(new Blob([html], { type: 'text/html' }), `Team_V_GSV_Non_Universe_Summary_${stamp()}.html`)
}
