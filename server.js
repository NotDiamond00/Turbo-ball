// Turbo League server: serves the client and runs authoritative matches over WebSocket.
// Env: PORT, MATCH_SECONDS (default 300), ALLOWED_ORIGIN (optional, e.g. https://your-app.onrender.com)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{WebSocketServer}=require('ws'),S=require('./sim.js');
const PORT=process.env.PORT||8080,ORIGIN=process.env.ALLOWED_ORIGIN,MATCH=+process.env.MATCH_SECONDS||300,DT=1/60;
const T={'/':['index.html','text/html'],'/sim.js':['sim.js','text/javascript']};
const srv=http.createServer((q,r)=>{const f=T[q.url.split('?')[0]];if(!f){r.writeHead(404);return r.end('Not found')}
 r.writeHead(200,{'Content-Type':f[1]+'; charset=utf-8'});r.end(fs.readFileSync(path.join(__dirname,f[0])))});
const wss=new WebSocketServer({server:srv,maxPayload:512,verifyClient:i=>!ORIGIN||i.origin===ORIGIN});
const rooms=new Map(),queues={1:[],2:[],3:[]};let nid=1;
const f2=v=>Math.round(v*100)/100,f1=v=>Math.round(v*10)/10;
const snd=(p,o,raw)=>{if(p.ws.readyState==1)p.ws.send(raw?o:JSON.stringify(o))};
const code=()=>{let c;do{c=Array.from(crypto.randomBytes(5),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('')}while(rooms.has(c));return c};
const mkRoom=(mode,priv)=>{const r={code:code(),mode,priv,pl:[],st:'wait',sc:[0,0],t:MATCH,ot:false,cd:0,gt:0,gs:0,idle:0,hit:0,host:0,ball:S.newBall()};rooms.set(r.code,r);return r};
const info=r=>r.pl.forEach(p=>snd(p,{t:'rm',code:r.code,mode:r.mode,priv:r.priv,st:r.st,host:r.host,pl:r.pl.map(x=>({id:x.id,n:x.name,tm:x.team}))}));
function join(p,r){if(r.pl.length>=2*r.mode||r.st!='wait')return false;const a=r.pl.filter(x=>!x.team).length;
 p.team=a<=r.pl.length-a?0:1;p.room=r;r.pl.push(p);if(!r.host)r.host=p.id;info(r);return true}
function kick(r){const n=[0,0],m=[0,0];r.pl.forEach(p=>m[p.team]++);
 r.pl.forEach(p=>{p.car=S.newCar(p.team,n[p.team]++,m[p.team]);p.car.jc=p.inp.j});r.ball=S.newBall()}
function start(r){r.st='cd';r.cd=3;r.sc=[0,0];r.t=MATCH;r.ot=false;kick(r);info(r)}
const qs=m=>queues[m].forEach(x=>snd(x,{t:'qs',m,n:queues[m].length,need:2*m}));
function deq(p){if(!p.q)return;const m=p.q,i=queues[m].indexOf(p);if(i>=0)queues[m].splice(i,1);p.q=0;qs(m)}
function enq(p,m){deq(p);queues[m].push(p);p.q=m;
 if(queues[m].length>=2*m){const r=mkRoom(m,false);queues[m].splice(0,2*m).forEach(x=>{x.q=0;join(x,r)});start(r)}qs(m)}
function fin(r,why){r.st='end';r.idle=0;r.pl.forEach(p=>snd(p,{t:'end',sc:r.sc,why:why||''}))}
function closeRoom(r){r.pl.forEach(p=>{p.room=null;p.car=null;snd(p,{t:'lv'})});rooms.delete(r.code)}
function leave(p){deq(p);const r=p.room;if(!r)return;p.room=null;p.car=null;r.pl=r.pl.filter(x=>x!==p);
 if(!r.pl.length){rooms.delete(r.code);return}
 if(r.host==p.id)r.host=r.pl[0].id; // host policy: next player becomes host
 if(r.st!='wait'&&r.st!='end'&&(!r.pl.some(x=>!x.team)||!r.pl.some(x=>x.team)))fin(r,'The other team left.');
 info(r)}
function sim(r){
 if(r.st=='wait'){if((r.idle+=DT)>900)closeRoom(r);return}
 if(r.st=='end'){if((r.idle+=DT)>30)closeRoom(r);return}
 if(r.st=='cd'){if((r.cd-=DT)<=0)r.st='play';return}
 const a=r.pl;a.forEach(p=>S.stepCar(p.car,p.inp,DT));
 for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)S.carCar(a[i].car,a[j].car);
 S.stepBall(r.ball,DT);a.forEach(p=>{r.hit=Math.max(r.hit,S.hit(p.car,r.ball))});
 if(r.st=='goal'){if((r.gt-=DT)<=0){if(r.ot)fin(r);else{kick(r);r.st='cd';r.cd=3}}return}
 if(r.t>0&&(r.t-=DT)<=0){r.t=0;if(r.sc[0]==r.sc[1])r.ot=true;else return fin(r)}
 const g=S.goalSide(r.ball);if(g>=0){r.sc[g]++;r.gs=g;r.gt=3;r.st='goal'} // state change guarantees one goal per sequence
}
function snap(r){if(r.st=='wait'||r.st=='end')return;
 const o=JSON.stringify({t:'s',st:r.st,tm:Math.ceil(r.t),sc:r.sc,cd:Math.ceil(r.cd),ot:r.ot,g:r.gs,h:f1(r.hit),
  b:[f2(r.ball.x),f2(r.ball.y),f2(r.ball.z),f1(r.ball.vx),f1(r.ball.vz)],
  c:r.pl.map(p=>{const c=p.car;return[p.id,f2(c.x),f2(c.y),f2(c.z),f2(c.yaw),f2(c.pitch),f1(c.fs),Math.round(c.boost),c.on]})});
 r.hit=0;r.pl.forEach(p=>snd(p,o,1))}
const num=v=>typeof v=='number'&&isFinite(v)?Math.max(-1,Math.min(1,v)):0;
function onMsg(p,raw){
 const n=Date.now();if(n-p.w>1000){p.w=n;p.c=0}if(++p.c>90)return; // rate limit
 let m;try{m=JSON.parse(raw)}catch{return}if(!m||typeof m.t!='string')return;
 const mode=[1,2,3].includes(m.m)?m.m:0;
 switch(m.t){
  case'in':{const i=p.inp;i.th=num(m.th);i.st=num(m.st);i.bs=m.bs?1:0;i.br=m.br?1:0;if(Number.isInteger(m.j))i.j=m.j;break}
  case'q':if(!p.room&&mode)enq(p,mode);break;
  case'cq':deq(p);break;
  case'mk':if(!p.room&&mode){deq(p);join(p,mkRoom(mode,true))}break;
  case'jn':{if(p.room)break;const r=rooms.get(String(m.c||'').toUpperCase().slice(0,5));deq(p);
   if(!r||!join(p,r))snd(p,{t:'er',m:'Room not found, full or already started'});break}
  case'st':{const r=p.room;if(r&&r.st=='wait'&&r.host==p.id&&r.pl.some(x=>!x.team)&&r.pl.some(x=>x.team))start(r);break}
  case'rs':if(p.car&&n-p.rt>3000){p.rt=n;const b=p.car.boost;Object.assign(p.car,S.newCar(p.team,0,1),{boost:b,jc:p.inp.j})}break;
  case'lv':leave(p);break;
 }}
let last=Date.now(),acc=0,tk=0;
setInterval(()=>{const n=Date.now();acc=Math.min(acc+(n-last)/1000,.25);last=n;
 while(acc>=DT){acc-=DT;tk++;rooms.forEach(sim);if(tk%3==0)rooms.forEach(snap)}},8); // 60 Hz simulation, 20 Hz snapshots
wss.on('connection',ws=>{const p={id:nid++,ws,team:0,inp:{th:0,st:0,bs:0,br:0,j:0},w:0,c:0,rt:0,room:null,q:0,car:null};p.name='Player '+p.id;ws.alive=true;
 ws.on('pong',()=>ws.alive=true);ws.on('message',d=>onMsg(p,d.toString()));ws.on('close',()=>leave(p));ws.on('error',()=>{});snd(p,{t:'hi',id:p.id})});
setInterval(()=>wss.clients.forEach(w=>{if(!w.alive)return w.terminate();w.alive=false;w.ping()}),15000); // drop dead connections
srv.listen(PORT,()=>console.log('Turbo League listening on :'+PORT));
