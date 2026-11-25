"""Build bnb.json for the /bnb dashboard.
usage: python3 -I build_bnb.py <bnb_dir> <orders.xlsx> <out.json> <beiersdorf_june.xlsx>
"""
import sys, glob, json, re, os, datetime as dt
sys.path.insert(0, __import__('os').path.dirname(__file__))
from pyxlsb import open_workbook
import openpyxl
from collections import Counter
import onepager

EXPORTS = [a.split('=', 1)[1] for a in sys.argv if a.startswith('--export=')]
sys.argv = [a for a in sys.argv if not a.startswith('--export=')]
bnb_dir, orders_path, out_path = sys.argv[1:4]
STATE = {'South Australia':'SA','Victoria':'VIC','New South Wales':'NSW','Queensland':'QLD','West Australia':'WA','Western Australia':'WA'}

def num(v):
    try: return str(int(float(v)))
    except Exception: return None

def read_report(path):
    with open_workbook(path) as wb:
        with wb.get_sheet('Matrix') as sh:
            M = [[c.v for c in row] for row in sh.rows()]
    m = re.search(r'(\d\d)/(\d\d)/(\d{4})', str(M[4][0]))
    date = dt.date(int(m[3]), int(m[2]), int(m[1]))
    fn = re.search(r'Beiersdorf[ _](\d{6})', path)
    if fn:  # header copy/paste errors: trust the filename DDMMYY when they disagree
        d_, m_, y_ = fn[1][:2], fn[1][2:4], fn[1][4:]
        try:
            fdate = dt.date(2000 + int(y_), int(m_), int(d_))
            if fdate != date and abs((fdate - date).days) < 120 and fdate.year == date.year: date = fdate
        except ValueError: pass
    # locate header rows by label in col 2
    lab = {str(r[2]).strip(): i for i, r in enumerate(M[:20]) if len(r) > 2 and r[2]}
    hdr = next(i for i, r in enumerate(M[:30]) if r and r[0] == 'StoreName')
    names, refs, eans = M[lab['Product Description']], M[lab['Ref No.']], M[lab['EAN']]
    blank = [None]*len(names)
    cats = M[lab['Category']] if 'Category' in lab else blank; coms = M[lab['Commodity']] if 'Commodity' in lab else blank
    prods = []
    for j in range(6, len(names)):
        if names[j] and num(refs[j]):
            prods.append((j, num(refs[j]), str(names[j]).strip(), num(eans[j]), cats[j], coms[j]))
    stores = []
    for r in M[hdr+1:]:
        if not r or not r[0] or num(r[1]) is None: continue
        bought = {ref for (j, ref, *_ ) in prods if j < len(r) and r[j] not in (None, 0, '')}
        stores.append(dict(id=num(r[1]), n=str(r[0]).strip(), st=STATE.get(r[2], 'Other'), b=r[3], mso=r[4], rk=num(r[5]), bought=bought))
    return date, prods, stores

def read_export(spec):
    # store x item export (one row per store and item): SUM RANGING > 0 = bought
    path, day = spec.rsplit('@', 1)
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True)); ix = {h: i for i, h in enumerate(rows[0])}
    prods, stores = {}, {}
    for r in rows[1:]:
        sid, ref = str(r[ix['STORE ID']]), str(r[ix['METCASH CODE']])
        prods.setdefault(ref, (None, ref, None, None, None, None))
        s = stores.setdefault(sid, dict(id=sid, n=r[ix['STORE NAME']], st=r[ix['STATE']] if r[ix['STATE']] in ('SA','VIC','NSW','QLD','WA') else 'Other',
                                       b=None, mso=None, rk=num(r[ix['STORE RANK']]), rep=r[ix['REP NAME']], bought=set()))
        if (r[ix['SUM RANGING']] or 0) > 0: s['bought'].add(ref)
    return dt.date.fromisoformat(day), list(prods.values()), list(stores.values())

reports = sorted([read_report(f) for f in glob.glob(bnb_dir + '/*.xlsb')] + [read_export(e) for e in EXPORTS], key=lambda x: x[0])
dates = [r[0] for r in reports]
print('reports', len(reports), dates[0], '->', dates[-1])

# products: union by ref, latest metadata wins
P = {}
for ri, (d, prods, _) in enumerate(reports):
    for (_, ref, name, ean, cat, com) in prods:
        old = P.get(ref, {})
        if name is None:  # export row: keep metadata from the BNB reports
            if old: continue
            name = ref
        P[ref] = dict(r=ref, n=name.lstrip('*'), del_=name.startswith('*'), e=ean, c=cat or old.get('c'), cm=com or old.get('cm'), last=ri)
# stores: union by id, latest metadata wins
S = {}
EXPORT_REP = {}
for ri, (d, _, stores) in enumerate(reports):
    for s in stores:
        old = S.get(s['id'], {})
        S[s['id']] = dict(id=s['id'], n=s['n'] or old.get('n'), st=s['st'] or old.get('st'), b=s['b'] or old.get('b', ''),
                          mso=s['mso'] or old.get('mso', ''), rk=s['rk'] or old.get('rk'), last=ri)
        if s.get('rep') and s['rep'] != 'Unassigned': EXPORT_REP[s['id']] = s['rep']

prod_list = sorted(P.values(), key=lambda p: (p['c'] or '', p['n']))
pidx = {p['r']: i for i, p in enumerate(prod_list)}
store_list = sorted(S.values(), key=lambda s: (s['st'], s['n']))
sidx = {s['id']: i for i, s in enumerate(store_list)}

# history masks: bit ri set if bought in report ri; also track which reports a store/product appeared in
H = [[0]*len(prod_list) for _ in store_list]
seenS = [0]*len(store_list); seenP = [0]*len(prod_list)
for ri, (d, prods, stores) in enumerate(reports):
    for (_, ref, *_) in prods: seenP[pidx[ref]] |= 1 << ri
    for s in stores:
        si = sidx[s['id']]; seenS[si] |= 1 << ri
        for ref in s['bought']: H[si][pidx[ref]] |= 1 << ri

# range book tags
ean2p = {p['e']: i for i, p in enumerate(prod_list) if p['e']}
matched, unmatched = 0, []
for row in onepager.rows():
    i = pidx.get(row['metcode']) if row['metcode'] else None
    if i is None and row['ean']: i = ean2p.get(row['ean'])
    if i is None: unmatched.append(row); continue
    if row['metcode'] == '196458' and 'Coconut' in row['name']:
        pass
    matched += 1
    p = prod_list[i]
    p.update(ss=row['ss'], msl=row['msl'], rank=row['rank'], rc=row['cat'], rrp=row['rrp'], gm=row['gm'], g=row['grade'])
# lines removed from the dashboard on request (still kept in the data so history lines up)
# MSO group per store (mso_groups.tsv: store name, MSO, state), matched by name
MSO_PATH = os.path.join(os.path.dirname(__file__), 'mso_groups.tsv')
msomap = {}
if os.path.exists(MSO_PATH):
    for ln in open(MSO_PATH):
        nm, grp, *_ = ln.rstrip('\n').split('\t')
        msomap[re.sub(r'[^A-Z0-9]', '', nm.upper())] = grp.strip()
def mso_of(name):
    g = msomap.get(re.sub(r'[^A-Z0-9]', '', name.upper()))
    if g and g != '-': return g
    u = name.upper()
    if 'ROMEO' in u: return 'ROMEO'
    if 'RITCHIE' in u: return 'RITCHIES'
    return g or ''

EXCLUDE = {'560241', '363092',
           '215676', '215710', '215590', '215817', '215697', '215833',  # Derma Control range: deleted
           '922037', '326359',            # Sun sprays 300ml: deleted
           '435700', '718551',            # Men Shave Gel Moist 200ml, Sun Pro Sensitive 100ml: deleted
           '303217', '465331', '356969'}  # older deletions still in report history
# kept on purpose: 700464 NIVEA SUN 2025 (last season's tower, useful for reference)
# rule (Sam): a line that isn't on the latest report has been deleted
KEEP = {'700464', '540259'}  # NIVEA SUN 2025 tower kept for reference; 2026 sun prepack code
latest_bit = 1 << (len(dates) - 1)
for i, p in enumerate(prod_list):
    if p['r'] in EXCLUDE or (not (seenP[i] & latest_bit) and p['r'] not in KEEP): p['hide'] = True
print('range book matched', matched, 'unmatched', len(unmatched))
for u in unmatched: print('   no BNB match:', u['metcode'], u['ean'], u['name'])
for code in onepager.PREPACK + [onepager.PREPACK_CODE]:
    if code in pidx: prod_list[pidx[code]]['pp' if code != onepager.PREPACK_CODE else 'ppk'] = True
    else: print('   prepack code not in BNB:', code)

# extension columns: weekly W/E Sunday after last report, through the week containing today
today = dt.date(2026, 11, 24)
ext = []
d = dates[-1] + dt.timedelta(days=7)
while True:
    ext.append(d)
    if d >= today: break
    d += dt.timedelta(days=7)
cols = dates + ext
def col_for(day):
    for i, c in enumerate(cols):
        if day <= c: return i
    return len(cols) - 1

# orders: sun prepack status
ws = openpyxl.load_workbook(orders_path, read_only=True, data_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True)); hdr = rows[0]; ix = {h: i for i, h in enumerate(hdr)}
PPS = {}
skipped = []
for r in rows[1:]:
    if str(r[ix['Item Code']]) != onepager.PREPACK_CODE: continue
    st = r[ix['Status']]; sid = str(r[ix['Store ID']])
    if st == 'CANCELLED': continue
    if sid == '0' or sid not in sidx: skipped.append((sid, r[ix['Store']], st)); continue
    day = dt.date.fromisoformat(str(r[ix['First Order']])[:10])
    cur = PPS.setdefault(sid, {})
    key = 'pp' if st in ('PROCESSED', 'SELF_TRACKING') else 'hold'
    if key not in cur or day < cur[key][0]: cur[key] = (day, r[ix['Rep']])
# BNB evidence: prepack bought in a report from this season (report W/E on/after 12/07/2026)
season = dt.date(2026, 7, 12)
bnb_pp = 0
if onepager.PREPACK_CODE in pidx:
    pj = pidx[onepager.PREPACK_CODE]
    for si, s in enumerate(store_list):
        for ri, d in enumerate(dates):
            if d >= season and H[si][pj] >> ri & 1:
                cur = PPS.setdefault(s['id'], {})
                if 'pp' not in cur:
                    # bought within the 26 wk window ending d; pin to that report column
                    cur['pp'] = (d, 'BNB report'); bnb_pp += 1
                break
sun = {}
for sid, v in PPS.items():
    if 'pp' in v: sun[sid] = ['pp', v['pp'][0].isoformat(), col_for(v['pp'][0]), v['pp'][1]]
    else: sun[sid] = ['hold', v['hold'][0].isoformat(), col_for(v['hold'][0]), v['hold'][1]]
print('sun stores', len(sun), 'pp', sum(1 for v in sun.values() if v[0]=='pp'), 'hold', sum(1 for v in sun.values() if v[0]=='hold'), 'from BNB only', bnb_pp)
print('skipped prepack rows', skipped)

# rep per store: June Gains call file (Location ID = BNB Storeid), then orders file
reps = {}
gw = openpyxl.load_workbook(sys.argv[4], read_only=True, data_only=True)['Gains ']
for r in list(gw.iter_rows(values_only=True))[1:]:
    if r[1] and r[3] and str(r[3]) in sidx and r[1] != 'Total': reps.setdefault(str(r[3]), r[1])
cnt = {}
for r in rows[1:]:
    sid = str(r[ix['Store ID']])
    if sid in sidx and sid not in reps: cnt.setdefault(sid, Counter())[r[ix['Rep']]] += 1
for sid, c in cnt.items(): reps[sid] = c.most_common(1)[0][0]
reps.update(EXPORT_REP)
print('stores with rep', len(reps), Counter(reps.values()))

# team store list (486 stores, matched by name to BNB store names)
ALIAS = {'IGA LG LANG LANG': '9744', 'IGA M LLOYDS SOUTH HURSTVILLE': '18052', 'IGA M LLOYDS SPRINGWOOD': '6252',
         'IGA M ROUSE HILL': '13949', 'IGA TUCKER FRESH DARCH': '52411'}
norm = lambda x: re.sub(r'[^A-Z0-9]', '', x.upper())
byname = {}
for s_ in store_list: byname.setdefault(norm(s_['n']), s_['id'])
team, team_missing = [], []
list_path = sys.argv[5] if len(sys.argv) > 5 else None
if list_path:
    for ln in open(list_path):
        nm = ln.split('\t')[0].strip()
        if not nm: continue
        sid = ALIAS.get(nm) or byname.get(norm(nm))
        (team.append(sid) if sid else team_missing.append(nm))
print('team list', len(team), 'matched,', len(team_missing), 'missing', team_missing)

out = dict(
    built=today.isoformat(),
    reports=[d.isoformat() for d in dates],
    ext=[d.isoformat() for d in ext],
    products=[{k: v for k, v in p.items() if k not in ('last',) and v not in (None, False, '')} | ({'del': True} if p['del_'] else {}) for p in prod_list],
    stores=[[s['id'], s['n'], s['st'], s['b'], s['mso'], s['rk'], reps.get(s['id'], ''), mso_of(s['n'])] for s in store_list],
    seenS=seenS, seenP=seenP,
    act=[1 if (m >> (len(dates) - 1)) & 1 or (m >> (len(dates) - 2)) & 1 else 0 for m in seenS],
    h=H,
    sun=sun,
    team=team,
    notes=dict(team_missing=team_missing, unmatched_range=[u['name'] for u in unmatched], skipped_prepack=[f'{a} {b} ({c})' for a, b, c in skipped]),
)
for p in out['products']: p.pop('del_', None)
with open(out_path, 'w') as f: json.dump(out, f, separators=(',', ':'))
import os; print('wrote', out_path, os.path.getsize(out_path)//1024, 'KB', len(store_list), 'stores', len(prod_list), 'products')
