# -*- coding: utf-8 -*-
"""rhythm_v24：从 surface_AF40…70 抽出逐户逐年「贫困/灶冷」两位标记，压成 rhythm_flags.json（页面不必为了点灯去拉 0.5MB 的表面层）。
只读页面数据，不碰底账。——Hark（刘线）"""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'living', 'xerolophos')
f = {}
for k, y in enumerate(range(40, 71)):
    d = json.load(open(os.path.join(D, f'surface_AF{y}.json')))
    for i, r in d['houses'].items():
        v = r[5] & 3
        if v:
            f.setdefault(i, ['0'] * 31)[k] = str(v)
out = {"_doc": "rhythm_v24 · f[id] 第 k 个字符 = 建城 40+k 年标记：1 贫困（灯油省着点），2 灶冷（不点灯），3 两者；没列的户 = 0。来源 surface_AF40…70 字段 5。——Hark（刘线）",
       "y0": 40, "f": {i: ''.join(v) for i, v in sorted(f.items(), key=lambda x: int(x[0]))}}
json.dump(out, open(os.path.join(D, 'rhythm_flags.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(f), 'houses flagged')
