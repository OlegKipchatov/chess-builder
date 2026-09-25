import {CONVERSION as V} from './conversion-config.js?v=40';
import {CONFIG as C} from './cognitive-config.js?v=40';
import {boardPieces,clamp,opposite} from './cognitive-model.js?v=40';
const xy = square => [square.charCodeAt(0)-97,Number(square[1])-1];
const distance = (a,b) => Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
export const conversionSignature = (game,side) => {
 const pieces=boardPieces(game),own=pieces.filter(p=>p.color===side),enemy=pieces.filter(p=>p.color!==side);
 const signature=own.map(p=>p.type).sort().join('')+':'+enemy.map(p=>p.type).sort().join('');
 const active=pieces.length<=V.maxPieces&&!pieces.some(p=>p.type==='p')&&enemy.length===1&&enemy[0].type==='k'&&own.some(p=>p.type==='r'||p.type==='q');
 return {active,signature,kind:active?'major-vs-lone-king':null};
};
/** Geometric attacks on a tiny virtual board, including opened rays after king moves. */
const attacked = (pieces,target,side) => pieces.some(p=>{
 if(p.color!==side)return false;
 const [x,y]=xy(p.square),dx=target[0]-x,dy=target[1]-y,ax=Math.abs(dx),ay=Math.abs(dy);
 if(!ax&&!ay)return false;
 if(p.type==='k')return Math.max(ax,ay)===1;
 if(p.type==='n')return ax*ay===2;
 if(p.type==='p')return ax===1&&dy===(side==='w'?1:-1);
 if(!((p.type==='r'||p.type==='q')&&(!dx||!dy)||(p.type==='b'||p.type==='q')&&ax===ay))return false;
 const sx=Math.sign(dx),sy=Math.sign(dy),steps=Math.max(ax,ay);
 for(let n=1;n<steps;n++)if(pieces.some(q=>{const [qx,qy]=xy(q.square);return qx===x+sx*n&&qy===y+sy*n;}))return false;
 return true;
});
export const conversionFeatures = (game,side) => {
 const pieces=boardPieces(game),enemy=opposite(side),king=pieces.find(p=>p.type==='k'&&p.color===enemy),ownKing=pieces.find(p=>p.type==='k'&&p.color===side);
 if(!king||!ownKing)throw Error('Missing conversion king');
 const [x,y]=xy(king.square),ring=[];
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if((dx||dy)&&x+dx>=0&&x+dx<8&&y+dy>=0&&y+dy<8)ring.push([x+dx,y+dy]);
 const coverage=ring.filter(s=>attacked(pieces,s,side)).length/ring.length;
 let mobilityCount=0;
 for(const target of ring){
  const to=String.fromCharCode(97+target[0])+(target[1]+1),occupant=pieces.find(p=>p.square===to);
  if(occupant?.color===enemy||occupant?.type==='k')continue;
  const virtual=pieces.filter(p=>p!==king&&p!==occupant).concat({...king,square:to});
  if(!attacked(virtual,target,side))mobilityCount++;
 }
 const confinement=1-mobilityCount/ring.length,edgePressure=1-Math.min(x,7-x,y,7-y)/3;
 const kingProximity=1-clamp((distance(xy(ownKing.square),[x,y])-2)/5,0,1);
 // A king can have three adjacent exits in both a large and a small box.
 // Flood the empty safe region to distinguish those plans. Remove the lone
 // king before tracing rays; occupied squares remain barriers (heuristic,
 // not a claim about captures). Immediate captures are checked by search.
 const withoutKing=pieces.filter(p=>p!==king),seen=new Set([x+8*y]),queue=[[x,y]],safe=new Map();
 for(let i=0;i<queue.length;i++){
  const [cx,cy]=queue[i];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   const nx=cx+dx,ny=cy+dy,index=nx+8*ny;
   if((!dx&&!dy)||nx<0||nx>7||ny<0||ny>7||seen.has(index))continue;
   if(!safe.has(index))safe.set(index,!withoutKing.some(p=>{const [px,py]=xy(p.square);return px===nx&&py===ny;})&&!attacked(withoutKing,[nx,ny],side));
   if(safe.get(index)){seen.add(index);queue.push([nx,ny]);}
  }
 }
 const cage=1-seen.size/64;
 const result={mobilityCount,confinement,edgePressure,kingProximity,coverage,cage};
 return {...result,progress:Object.entries(V.featureWeights).reduce((sum,[key,weight])=>sum+weight*result[key],0)};
};
export const conversionValue = (game,side,caps,features) => {
 const pieces=boardPieces(game),material=pieces.reduce((sum,p)=>sum+(p.color===side?1:-1)*C.values[p.type],0);
 return material+(conversionSignature(game,side).active?V.progressWeight*(.45+.55*caps.conversionSkill)*features.progress:0);
};
