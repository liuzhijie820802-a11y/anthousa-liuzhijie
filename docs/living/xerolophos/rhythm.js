/* rhythm_v24 · 生计决定作息 + 任何效果都不整齐划一（借 Civitas 的两条思路，不借代码）。
   纯函数：同一 (房id, 年, 分钟) 永远得到同一状态；页面和 tools/check_rhythm.js 共用这一份。——Hark（刘线）
   作息表是「模型假设」，括号里是「历史参照」，见 experiments/rhythm_v24/REPORT.md。 */
(function(root){
'use strict';
function fnv(s){let h=2166136261>>>0;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;return h>>>0}
/* 唯一的抖动来源：h01(id,salt) ∈ [0,1)。不用 Math.random，不看墙上时钟。 */
function h01(id,salt){return fnv(id+'|'+salt)/4294967296}
const jit=(id,salt,r)=>Math.round((h01(id,salt)*2-1)*r);   // ±r 分钟
const M=(h,m)=>h*60+(m||0);
/* 每类生计一张作息表（分钟，从子夜算）。wake 起床/起炉，out 出门，back 回家，open/close 铺面营业，on 天黑点灯的偏移，off 熄灯，j 抖动幅度。
   open=null 表示没有铺面。 */
const SCHED={
  '雇工':   {wake:M(4,45),out:M(5,15),back:M(18,30),open:null,off:M(20,30),j:40,day:['{wake}起','天亮前出门找活','{back}才回','{off}熄灯']},
  '码头脚夫':{wake:M(4,15),out:M(4,40),back:M(17,30),open:null,off:M(20,0),j:55,day:['{wake}起，看船早出','卸完船{back}回','{off}熄灯']},
  '面包':   {wake:M(2,50),out:null,back:null,open:M(5,0),close:M(13,0),off:M(19,40),j:30,smoke:[M(3,0),M(11,0)],day:['{wake}起炉','{open}开门卖饼','{close}收摊，午后歇','{off}熄灯']},
  '手工铺': {wake:M(5,40),out:null,back:null,open:M(6,30),close:M(18,0),off:M(21,0),j:35,day:['{open}日出开铺','{close}日落关门','{off}熄灯']},
  '作坊':   {wake:M(5,20),out:null,back:null,open:M(6,0),close:M(18,30),off:M(21,0),j:35,smoke:[M(6,0),M(18,0)],day:['{open}开工生火','{close}收工','{off}熄灯']},
  '港货商': {wake:M(6,0),out:M(6,40),back:M(18,0),open:M(7,0),close:M(17,30),off:M(22,0),j:35,day:['{open}开仓','{close}关门','{off}熄灯']},
  '运水人': {wake:M(4,30),out:M(5,0),back:M(16,0),open:null,off:M(20,0),j:40,day:['{wake}起，趁凉挑水','{back}回','{off}熄灯']},
  '营造':   {wake:M(5,0),out:M(5,40),back:M(17,40),open:null,off:M(20,30),j:35,day:['{out}上工地','{back}收工回','{off}熄灯']},
  '体面户': {wake:M(6,50),out:M(8,30),back:M(12,30),open:null,off:M(22,40),j:45,day:['{wake}起','上午出门办事，{back}回','灯点到{off}']},
  '兵户':   {wake:M(5,0),out:M(5,40),back:M(18,0),open:null,off:M(21,0),j:30,night:{out:M(18,0),back:M(6,0)},day:['{out}上岗','{back}换岗回','{off}熄灯'],dayN:['{out}上夜岗','{back}换岗回','白天睡觉']},
  '装卸行': {wake:M(4,40),out:M(5,10),back:M(18,0),open:M(5,30),close:M(17,30),off:M(21,0),j:40,day:['{open}开行，看船','{close}关门','{off}熄灯']},
  '港仓':   {wake:M(5,10),out:M(5,40),back:M(18,0),open:M(6,0),close:M(17,30),off:M(21,0),j:35,day:['{open}开仓','{close}落锁','{off}熄灯']},
  '船修':   {wake:M(5,0),out:M(5,30),back:M(18,0),open:M(6,0),close:M(17,30),off:M(20,40),j:35,day:['{out}下船坞','{back}回','{off}熄灯']},
  '牙人':   {wake:M(6,30),out:M(7,30),back:M(18,30),open:null,off:M(22,0),j:45,day:['{out}出门说合','{back}回','{off}熄灯']},
  '兑钱商': {wake:M(6,30),out:M(7,20),back:M(17,40),open:M(8,0),close:M(17,0),off:M(22,0),j:30,day:['{open}开柜','{close}收柜','{off}熄灯']},
  '菜农':   {wake:M(3,50),out:M(4,20),back:M(12,30),open:null,off:M(19,40),j:40,day:['{wake}起，挑菜赶早市','{back}回','{off}熄灯']},
  '渔户':   {wake:M(3,20),out:M(3,50),back:M(11,0),open:null,off:M(19,40),j:50,day:['{wake}起，摸黑出海','{back}回','{off}熄灯']},
  '住家':   {wake:M(5,30),out:M(6,30),back:M(18,0),open:null,off:M(21,0),j:45,day:['{wake}起','{back}回','{off}熄灯']}
};
/* 教士：两座教堂各按自己的钟点敲（晨钟、晚钟），每座有自己的偏移 */
const CLERGY={hours:[M(6,0),M(18,0)],j:6};
const DUSK=M(18,40),DUSK_J=45,FADE=8;
const SH='子丑寅卯辰巳午未申酉戌亥';
function shichen(m){m=((m%1440)+1440)%1440;const h=Math.floor(m/60);const k=Math.floor(((h+1)%24)/2);return SH[k]+(((h+1)%2)?'正':'初')}
const wrap=m=>((m%1440)+1440)%1440;
const inWin=(m,a,b)=>{a=wrap(a);b=wrap(b);return a<=b?(m>=a&&m<b):(m>=a||m<b)};
/* 一户一年的作息：只由 (id, 年, 生计, 标记) 决定 */
function schedule(id,Y,liv,flags){
  const S=SCHED[liv]||SCHED['住家'];const k=id+':'+Y;const J=S.j;
  const r={liv:SCHED[liv]?liv:'住家',cold:!!(flags&2),poor:!!(flags&1)};
  r.wake=S.wake+jit(k,'wake',J);
  let out=S.out,back=S.back;r.nightShift=false;
  if(S.night&&h01(id,'watch')<1/3){out=S.night.out;back=S.night.back;r.nightShift=true}
  r.out=out==null?null:out+jit(k,'out',J);r.back=back==null?null:back+jit(k,'back',J);
  if(S.open!=null){r.open=S.open+jit(k,'open',J);r.close=S.close+jit(k,'close',J)}else{r.open=r.close=null}
  r.on=DUSK+jit(k,'on',DUSK_J);
  r.off=S.off+jit(k,'off',J+15);
  if(r.back!=null&&!r.nightShift)r.off=Math.max(r.off,r.back+40);   // 回家后才熄灯
  if(r.poor)r.off=Math.min(r.off,r.on+50+Math.round(h01(k,'oil')*50));   // 灯油省着点
  if(r.off<r.on+20)r.off=r.on+20;
  r.dawn=M(6,15)+jit(k,'dawn',35);   // 天亮吹灯，各家早晚不一
  r.inten=.55+.45*h01(id,'inten');r.rad=7+4*h01(id,'rad');r.ph=h01(id,'ph')*6.28;
  if(S.smoke){r.smoke=[S.smoke[0]+jit(k,'s0',J),S.smoke[1]+jit(k,'s1',J)]}
  return r}
/* 窗灯亮度 0..1（含淡入淡出），灶冷户不点灯 */
function lightAt(S,m){if(S.cold)return 0;
  const seg=(a,b)=>{if(!inWin(m,a,b))return 0;const da=wrap(m-a),db=wrap(b-m);return Math.min(1,(da+1)/FADE,db/FADE)};
  let v=seg(S.on,S.off);
  if(S.wake<M(6,10)){const e=Math.min(S.out==null?S.dawn:S.out,S.dawn);if(e>S.wake)v=Math.max(v,seg(S.wake,e))}
  return v*S.inten}
const openAt=(S,m)=>S.open!=null&&m>=S.open&&m<S.close;
const outAt=(S,m)=>S.out!=null&&inWin(m,S.out,S.back);
function dayLine(S){if(S.cold)return '灶冷：天黑不点灯，早早睡下';
  const T=SCHED[S.liv];const parts=(S.nightShift&&T.dayN)?T.dayN:T.day;
  let s=parts.map(p=>p.replace(/\{(\w+)\}/g,(_,k)=>shichen(S[k]))).join('，');
  if(S.poor)s+='（灯油省着点）';return s}
/* 街上的东西（摊子、烟、行人、工地人手）：同一套哈希给各自的时段 */
function stallWin(i){return [M(5,30)+Math.round(h01('st'+i,'o')*120),M(16,30)+Math.round(h01('st'+i,'c')*120)]}
/* 烟只有 36 柱，纯随机偏移在分钟粒度上容易撞车：用哈希起点 + 黄金分割步长铺开（仍只由编号决定） */
const GR=.6180339887,lds=(i,salt)=>(h01('smoke',salt)+i*GR)%1;
function smokeWin(i){const u=h01('sm'+i,'kind'),a=Math.round((lds(i,'a')*2-1)*45),b=Math.round((lds(i,'b')*2-1)*45);
  if(u<.3)return {kind:'炉',w:[[M(3,0)+a,M(11,0)+b]],s:.8+.4*h01('sm'+i,'s')};
  if(u<.7)return {kind:'坊',w:[[M(6,30)+a,M(18,0)+b]],s:.6+.4*h01('sm'+i,'s')};
  return {kind:'灶',w:[[M(5,40)+a,M(8,0)+b],[M(17,0)+b,M(19,30)+a]],s:.5+.5*h01('sm'+i,'s')}}
function smokeAt(sw,m){let v=0;for(const [a,b] of sw.w){if(m>=a&&m<b)v=Math.max(v,Math.min(1,(m-a+1)/15,(b-m)/15))}return v*sw.s}
function workWin(id){return [M(5,30)+Math.round(h01(id,'cw0')*90),M(17,0)+Math.round(h01(id,'cw1')*120)]}
function bellTimes(cid){const o=Math.round(h01(cid,'bell')*CLERGY.j*2);return CLERGY.hours.map(h=>h+o)}
/* 铺面营业：作息表里有铺面的按表；表面层说「开张的铺子/作坊」而生计没铺面的（如雇工家开了个小铺），按手工铺的日出日落 */
function shopOpenAt(S,id,Y,m){if(S.open!=null)return m>=S.open&&m<S.close;const T=SCHED['手工铺'],k=id+':'+Y;return m>=T.open+jit(k,'open',T.j)&&m<T.close+jit(k,'close',T.j)}
/* 与页面 trCode 同一规则：取当年生计码，当年无户就找最近有户的一年 */
function livCode(s,Y){if(!s)return null;const k=Math.min(Math.max(Y,40),70)-40;if(s[k]!=='.')return s.charCodeAt(k)-97;for(let d=1;d<31;d++)for(const kk of [k-d,k+d])if(kk>=0&&kk<s.length&&s[kk]!=='.')return s.charCodeAt(kk)-97;return null}
function flagsOf(s,Y){if(!s||Y<40||Y>70)return 0;return +s[Y-40]||0}
/* 一户一年的作息，页面和检查脚本都走这里：tr = trades.json，fl = rhythm_flags.json */
function schedFor(tr,fl,id,Y){const c=livCode(tr&&tr.h[id],Y);const liv=c==null?'住家':tr.liv[c];return schedule(id,Y,liv,flagsOf(fl&&fl.f[id],Y))}
/* 逐户状态的规范串 → 求哈希（确定性检查用） */
function stateString(list,Y,m){return list.map(([id,S])=>id+':'+lightAt(S,m).toFixed(4)+(shopOpenAt(S,id,Y,m)?'o':'-')+(outAt(S,m)?'w':'-')).join(';')}
const RH={shopOpenAt,livCode,flagsOf,schedFor,h01,fnv,SCHED,CLERGY,schedule,lightAt,openAt,outAt,dayLine,shichen,stallWin,smokeWin,smokeAt,workWin,bellTimes,stateString,inWin,M};
if(typeof module!=='undefined'&&module.exports)module.exports=RH;else root.RH=RH;
})(this);
