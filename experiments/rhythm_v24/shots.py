# -*- coding: utf-8 -*-
"""rhythm_v24 截图：同一机位、同一年，黄昏 18:40 与凌晨 4:00 各一张；收集 JS 报错。用法：shots.py 输出目录 前缀 [card]
——Hark（刘线）"""
import os, sys, json, subprocess, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT, PRE = sys.argv[1], sys.argv[2]; CARD = 'card' in sys.argv[3:]; REVIEW = 'review' in sys.argv[3:]
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8767", "-d", os.path.join(ROOT, "docs")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errs = []; log = {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1400, "height": 900})
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        pg.on("console", lambda m: errs.append("console." + m.type + ": " + m.text) if m.type == "error" else None)
        pg.goto("http://localhost:8767/living/xerolophos/", wait_until="load")
        pg.wait_for_function("window.__anth && window.__anth.houses.length>0", timeout=60000)
        pg.wait_for_timeout(8000)
        pg.add_style_tag(content='#talk{display:none!important}')
        def settle():
            # 关掉卡片和引导镜头（camT），让机位固定
            pg.evaluate("()=>{const x=document.getElementById('cardx');if(document.getElementById('card').style.display!=='none')x.click();document.getElementById('c')?.dispatchEvent(new WheelEvent('wheel',{deltaY:0,clientX:700,clientY:450,bubbles:true,cancelable:true}))}")
        pg.evaluate("()=>{const e=document.getElementById('yr');e.value=60;e.dispatchEvent(new Event('input',{bubbles:true}))}")
        pg.wait_for_timeout(1500)
        def cam(x, y, z):
            settle()
            pg.evaluate(f"()=>{{const c=window.__anth.cam;c.x={x};c.y={y};c.z={z}}}")
        def at(hh):
            pg.evaluate(f"()=>{{window.__anth.clock={hh}}}"); pg.wait_for_timeout(250)
        def shot(name):
            pg.screenshot(path=os.path.join(OUT, name)); log[name] = pg.inner_text('#clock')
        # 主机位：克塞罗洛福斯坡上一片住家，z=1.1 能看到窗灯、摊子、行人
        hx, hy = pg.evaluate("()=>{const h=window.__anth.houseById(13821);return [h.cx,h.cy]}")
        if not REVIEW:
            cam(hx, hy, 1.1); at(19.3); shot(PRE + '_dusk.png')
            cam(hx, hy, 1.1); at(4.0); shot(PRE + '_dawn.png')
        if CARD:
            at(10); cam(hx, hy, 2.6); pg.wait_for_timeout(400); pg.mouse.click(700, 450); pg.wait_for_timeout(1500)
            log['card'] = pg.inner_text('#cardbody')[:500]; shot('card.png')
            # 再点一户面包师
            bid = pg.evaluate("()=>{const A=window.__anth;const h=A.houses.find(h=>h.built<=60&&h.destroyed>60&&A.RH_sched&&A.RH_sched(h,60).liv==='面包'&&!A.STORIES_has(h.id));return h?[h.id,h.cx,h.cy]:null}")
            if bid:
                cam(bid[1], bid[2], 2.6); pg.wait_for_timeout(400); pg.mouse.click(700, 450); pg.wait_for_timeout(1500)
                log['card_baker'] = pg.inner_text('#cardbody')[:400]; shot('card_baker.png')
            log['statehash_page'] = pg.evaluate("()=>window.__anth.RH_hash?window.__anth.RH_hash(60,1120):null")
        if REVIEW:
            settle(); pg.wait_for_timeout(300)
            at(10); pg.evaluate("()=>{const A=window.__anth;A.cam.z=0.01;A.cam.x=1e5;A.cam.y=1e5}"); pg.wait_for_timeout(400); shot('review_panorama.png')
            cam(hx, hy, 3.0); at(10.5); shot('review_street_detail.png')
            cam(hx, hy, 1.1); at(18.9); shot('review_dusk_lights.png')
            at(10.5); cam(hx, hy, 1.4); pg.click('#surfbtn'); pg.wait_for_timeout(3000); shot('review_surface.png')
        b.close()
finally:
    srv.terminate()
print(json.dumps(log, ensure_ascii=False, indent=1))
print("ERRORS", len(errs)); print("\n".join(errs[:30]))
