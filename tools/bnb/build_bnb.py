"""Build bnb.json for the /bnb dashboard.
usage: python3 -I build_bnb.py <bnb_dir> <orders.xlsx> <out.json> <beiersdorf_june.xlsx>
"""
import sys, glob, json, re, datetime as dt
sys.path.insert(0, __import__('os').path.dirname(__file__))
from pyxlsb import open_workbook
import openpyxl
from collections import Counter
import onepager

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

reports = sorted((read_report(f) for f in glob.glob(bnb_dir + '/*.xlsb')), key=lambda x: x[0])
dates = [r[0] for r in reports]
print('reports', len(reports), dates[0], '->', dates[-1])

# products: union by ref, latest metadata wins
P = {}
for ri, (d, prods, _) in enumerate(reports):
    for (_, ref, name, ean, cat, com) in prods:
        old = P.get(ref, {})
        P[ref] = dict(r=ref, n=name.lstrip('*'), del_=name.startswith('*'), e=ean, c=cat or old.get('c'), cm=com or old.get('cm'), last=ri)
# stores: union by id, latest metadata wins
S = {}
for ri, (d, _, stores) in enumerate(reports):
    for s in stores:
        S[s['id']] = dict(id=s['id'], n=s['n'], st=s['st'], b=s['b'] or '', mso=s['mso'] or '', rk=s['rk'], last=ri)

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
print('stores with rep', len(reps), Counter(reps.values()))

out = dict(
    built=today.isoformat(),
    reports=[d.isoformat() for d in dates],
    ext=[d.isoformat() for d in ext],
    products=[{k: v for k, v in p.items() if k not in ('last',) and v not in (None, False, '')} | ({'del': True} if p['del_'] else {}) for p in prod_list],
    stores=[[s['id'], s['n'], s['st'], s['b'], s['mso'], s['rk'], reps.get(s['id'], '')] for s in store_list],
    seenS=seenS, seenP=seenP,
    h=H,
    sun=sun,
    notes=dict(unmatched_range=[u['name'] for u in unmatched], skipped_prepack=[f'{a} {b} ({c})' for a, b, c in skipped]),
)
for p in out['products']: p.pop('del_', None)
with open(out_path, 'w') as f: json.dump(out, f, separators=(',', ':'))
import os; print('wrote', out_path, os.path.getsize(out_path)//1024, 'KB', len(store_list), 'stores', len(prod_list), 'products')
