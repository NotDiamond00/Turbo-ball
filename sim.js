(function(r){
const W=30,L=45,GW=8,GD=7,GH=7,H=16,R=2.2,G=22,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const newCar=(team,k,n)=>{const x=(k-(n-1)/2)*9;return{team,x:team?-x:x,y:.6,z:team?30:-30,vx:0,vy:0,vz:0,yaw:team?Math.PI:0,pitch:0,boost:100,jumps:2,fs:0,jc:0,hc:0,on:0}};
const newBall=()=>({x:0,y:R,z:0,vx:0,vy:0,vz:0});
// I = {th:-1..1, st:-1..1, bs:0|1, br:0|1, j:jump counter}
function stepCar(c,I,dt){
 const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),bs=I.bs&&c.boost>0,th=I.th,st=I.st;let gr=c.y<=.62&&c.vy<=.5;c.hc-=dt;
 if(I.j!==c.jc){c.jc=I.j;if(gr){c.vy=9;c.jumps=1;gr=false}else if(c.jumps>0){c.jumps=0;c.vy=th>0?2:7;if(th>0){c.vx+=fx*13;c.vz+=fz*13}}}
 if(gr){c.jumps=2;c.vy=0;c.pitch*=Math.exp(-10*dt);
  let fs=c.vx*fx+c.vz*fz,ls=c.vx*fz-c.vz*fx;
  if(th)fs+=th*(th>0?38:30)*dt;else fs-=Math.sign(fs)*Math.min(Math.abs(fs),8*dt);
  if(I.br)fs-=Math.sign(fs)*Math.min(Math.abs(fs),28*dt);
  if(bs){c.boost-=34*dt;fs+=60*dt}
  const mx=bs?42:26;if(fs>mx)fs=Math.max(mx,fs-20*dt);if(fs<-14)fs=-14;
  ls*=Math.exp(-(I.br?1.2:9)*dt);c.vx=fx*fs+fz*ls;c.vz=fz*fs-fx*ls;c.fs=fs;
  c.yaw-=st*2.6*Math.min(1,Math.abs(fs)/8)*(fs<0?-1:1)*(I.br?1.4:1)*dt;
 }else{
  c.yaw-=st*2.2*dt;c.pitch=cl(c.pitch-th*2.4*dt,-1.2,1.2);
  if(bs){c.boost-=34*dt;const cp=Math.cos(c.pitch);c.vx+=fx*cp*45*dt;c.vz+=fz*cp*45*dt;c.vy+=Math.sin(c.pitch)*45*dt}
  c.vy-=G*dt;const sp=Math.hypot(c.vx,c.vy,c.vz);if(sp>46){const k=46/sp;c.vx*=k;c.vy*=k;c.vz*=k}
 }
 c.on=bs?1:0;if(!bs)c.boost=Math.min(100,c.boost+6*dt);if(c.boost<0)c.boost=0;
 c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;
 if(c.y<.6){c.y=.6;if(c.vy<0)c.vy=0}if(c.y>H-1){c.y=H-1;c.vy=Math.min(0,c.vy)}
 const zl=Math.abs(c.x)<GW-1.3?L+GD-2:L-2;if(Math.abs(c.z)>zl){c.z=Math.sign(c.z)*zl;c.vz*=-.3}
 const xl=Math.abs(c.z)>L-2?GW-1.3:W-1.2;if(Math.abs(c.x)>xl){c.x=Math.sign(c.x)*xl;c.vx*=-.3}
}
function stepBall(b,dt){
 b.vy-=G*dt;const k=Math.exp(-.1*dt);b.vx*=k;b.vy*=k;b.vz*=k;
 const sp=Math.hypot(b.vx,b.vy,b.vz);if(sp>62){const q=62/sp;b.vx*=q;b.vy*=q;b.vz*=q}
 b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
 if(b.y<R){b.y=R;if(b.vy<0)b.vy=b.vy<-2.5?-b.vy*.72:0;const f=Math.exp(-.3*dt);b.vx*=f;b.vz*=f}
 const ins=Math.abs(b.z)>L+.2,mouth=Math.abs(b.x)<GW-R&&b.y<GH-R,ce=ins?GH-R:H-R;
 if(b.y>ce){b.y=ce;b.vy=-Math.abs(b.vy)*.5}
 const bz=mouth||ins?L+GD:L;if(Math.abs(b.z)>bz-R){const s=Math.sign(b.z);b.z=s*(bz-R);b.vz=-s*Math.abs(b.vz)*.7}
 const bx=Math.abs(b.z)>L?GW:W;if(Math.abs(b.x)>bx-R){const s=Math.sign(b.x);b.x=s*(bx-R);b.vx=-s*Math.abs(b.vx)*.7}
}
// car vs ball; returns impact strength (0 if no strong hit) for sound/shake
function hit(c,b){
 const dx=b.x-c.x,dy=b.y-c.y,dz=b.z-c.z,s=Math.sin(c.yaw),co=Math.cos(c.yaw);
 const lf=dx*s+dz*co,ll=dx*co-dz*s,df=lf-cl(lf,-2,2),dl=ll-cl(ll,-1,1),du=dy-cl(dy,-.5,.5),d=Math.hypot(df,dl,du);
 if(d>=R||d<1e-4)return 0;
 const nx=(df*s+dl*co)/d,ny=du/d,nz=(df*co-dl*s)/d,p=R-d;b.x+=nx*p;b.y+=ny*p;b.z+=nz*p;
 const rv=(b.vx-c.vx)*nx+(b.vy-c.vy)*ny+(b.vz-c.vz)*nz;let out=0;
 if(rv<0){let j=-1.4*rv;if(c.hc<=0){j+=4+Math.hypot(c.vx,c.vz)*.25;b.vy+=2;c.hc=.12;if(rv<-4)out=-rv}b.vx+=nx*j;b.vy+=ny*j;b.vz+=nz*j}
 return out}
function carCar(a,b){const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
 if(d<3&&d>1e-3&&Math.abs(a.y-b.y)<1.5){const nx=dx/d,nz=dz/d,p=(3-d)/2;a.x-=nx*p;a.z-=nz*p;b.x+=nx*p;b.z+=nz*p;
  const rv=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;if(rv<0){a.vx+=nx*rv;a.vz+=nz*rv;b.vx-=nx*rv;b.vz-=nz*rv}}}
// 0 = blue scored (ball in +z goal), 1 = orange scored, -1 = none. Whole ball must be past the line.
const goalSide=b=>Math.abs(b.z)>L+R&&Math.abs(b.x)<GW&&b.y<GH?(b.z>0?0:1):-1;
const API={newCar,newBall,stepCar,stepBall,hit,carCar,goalSide};
if(typeof module!='undefined')module.exports=API;else r.SIM=API;
})(this);
