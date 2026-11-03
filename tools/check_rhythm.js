#!/usr/bin/env node
/* rhythm_v24 确定性检查 + 同时切换占比。用法：node tools/check_rhythm.js [年=60] [分钟=1120]
   1) 同一年同一时刻跑两次逐户状态（灯亮度/铺面/出门），求哈希必须一致（FNV，与页面 __anth.RH_hash 同一算法）；
   2) 逐分钟统计「这一分钟内切换的灯 / 铺 / 摊 / 烟」占比，取最大值；前 = liu6 规则（灯 19:00 齐亮、5:30 齐灭，摊子 5:00 齐出、18:00 齐收），后 = rhythm.js。
   目标：后 ≤ 5%。——Hark（刘线） */
const fs=require('fs'),path=require('path');const D=path.join(__dirname,'..','docs','living','xerolophos');
const R=require(path.join(D,'rhythm.js'));const J=f=>JSON.parse(fs.readFileSync(path.join(D,f)));
const Y=+(process.argv[2]||60),M0=+(process.argv[3]||1120);
const tr=J('trades.json'),fl=J('rhythm_flags.json'),HD=J('houses.json');
const alive=HD.houses.filter(h=>!(h[3]<=1||h[3]<=h[2]+1)).map(h=>({id:h[0],built:h[2],destroyed:h[3]}))
  .concat((HD.ledger_new||[]).map(([id,built,destroyed])=>({id,built,destroyed}))).filter(h=>h.built<=Y&&h.destroyed>Y).sort((a,b)=>a.id-b.id);
const run=()=>R.fnv(R.stateString(alive.map(h=>[h.id,R.schedFor(tr,fl,h.id,Y)]),Y,M0));
const a=run(),b=run();
// 页面用的同一份表面层「开张的铺子/作坊」作为铺面集合
const surf=J('surface_AF'+Math.min(70,Math.max(40,Y))+'.json').houses;
const shops=alive.filter(h=>surf[h.id]&&(surf[h.id][1]===1||surf[h.id][1]===2));
const lights=alive.filter(h=>R.h01(h.id,'win')<.06||R.schedFor(tr,fl,h.id,Y).liv==='面包');
function maxToggle(ents,stateAt){let best=0,at=0;let prev=ents.map(e=>stateAt(e,1439));for(let m=0;m<1440;m++){const cur=ents.map(e=>stateAt(e,m));let n=0;for(let i=0;i<cur.length;i++)if(cur[i]!==prev[i])n++;if(n/ents.length>best){best=n/ents.length;at=m}prev=cur}return {pct:+(100*best).toFixed(2),at:String(Math.floor(at/60)).padStart(2,'0')+':'+String(at%60).padStart(2,'0'),n:ents.length}}
const S=h=>R.schedFor(tr,fl,h.id,Y);
const stalls=[...Array(420).keys()],smokes=[...Array(36).keys()];
const before={
  灯:maxToggle([...Array(220).keys()],(e,m)=>m>=1140||m<330),
  铺:maxToggle(shops,()=>true),
  摊:maxToggle(stalls,(e,m)=>m>=300&&m<1080),
  烟:maxToggle(smokes,(e,m)=>(m>=300&&m<540)||(m>=1080&&m<1260)?1:.55)};
before.全部=maxToggle([...Array(220+shops.length+420+36).keys()],(e,m)=>e<220?(m>=1140||m<330):e<220+shops.length?true:e<220+shops.length+420?(m>=300&&m<1080):((m>=300&&m<540)||(m>=1080&&m<1260)?1:.55));
const LA=lights.map(h=>[h,S(h)]),SA=shops.map(h=>[h,S(h)]),SW=stalls.map(i=>R.stallWin(i)),SM=smokes.map(i=>R.smokeWin(i));
const after={
  灯:maxToggle(LA,([h,s],m)=>R.lightAt(s,m)>0),
  铺:maxToggle(SA,([h,s],m)=>R.shopOpenAt(s,h.id,Y,m)),
  摊:maxToggle(SW,(w,m)=>m>=w[0]&&m<w[1]),
  烟:maxToggle(SM,(w,m)=>R.smokeAt(w,m)>0)};
const ALL=[...LA.map(x=>['L',x]),...SA.map(x=>['S',x]),...SW.map(x=>['T',x]),...SM.map(x=>['M',x])];
after.全部=maxToggle(ALL,([k,x],m)=>k==='L'?R.lightAt(x[1],m)>0:k==='S'?R.shopOpenAt(x[1],x[0].id,Y,m):k==='T'?(m>=x[0]&&m<x[1]):R.smokeAt(x,m)>0);
const cats=new Set(alive.map(h=>S(h).liv));
const out={year:Y,minute:M0,houses:alive.length,hash1:a,hash2:b,deterministic:a===b,schedule_classes_used:cats.size,schedule_classes_defined:Object.keys(R.SCHED).length+1,before,after,pass:a===b&&Object.values(after).every(v=>v.pct<=5)};
console.log(JSON.stringify(out,null,1));process.exit(out.pass?0:1);
