# Beiersdorf buy / not buy data refresh

Builds `public/bnb-data.json` for the `/bnb/` page.

```
pip install pyxlsb openpyxl
python3 tools/bnb/build_bnb.py <folder of BNB .xlsb reports> <orders_by_rep...xlsx> public/bnb-data.json <Beiersdorf June 2026.xlsx>
```

- Drop new Buying vs Not Buying reports in the folder and re-run. Each report becomes one dot.
- Range tags (Sea Salt, MSL, rank, RRP, GM) live in `onepager.py` (Metcash range book July 2026).
- Sun prepack: item 540259 in the orders file. PROCESSED = SUN PP, HOLD = Sun Hold, CANCELLED ignored.
- Change `today` in build_bnb.py to extend the weekly columns.
