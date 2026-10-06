// PvE campaign rules are independent of classic chess, its rating and archive.
export const PVE = Object.freeze({version:1,armySize:8,initialCap:3,bossCap:5,maxPlies:240,evolutionCost:1});
export const TYPE_WEIGHT = Object.freeze({p:1,n:3,b:3,r:5,q:9,k:4});
export const DEATH_RATE = Object.freeze({p:.12,n:.16,b:.16,r:.20,q:.25,k:.16});
export const NODES = Object.freeze([
 {id:'trail',step:1,threat:1,name:'Лесная тропа',minPower:17,maxPower:21,ratio:.94,composition:'mixed'},
 {id:'clearing',step:2,threat:1,name:'Заросшая поляна',minPower:18,maxPower:23,ratio:.98,composition:'mixed'},
 {id:'riders',step:3,threat:2,name:'Конный дозор',minPower:21,maxPower:27,ratio:1,composition:'knights'},
 {id:'watch',step:3,threat:2,name:'Каменная застава',minPower:22,maxPower:29,ratio:1.07,composition:'rooks',bonus:true},
 {id:'bridge',step:4,threat:2,name:'Старый мост',minPower:22,maxPower:30,ratio:1.02,composition:'bishops'},
 {id:'gate',step:5,threat:3,name:'Ворота крепости',minPower:24,maxPower:33,ratio:1.05,composition:'mixed'},
 {id:'warden',step:6,threat:3,name:'Страж крепости',minPower:25,maxPower:35,ratio:1.08,composition:'rooks',boss:true},
]);
const number = (value,fallback=0,max=1e8) => Number.isSafeInteger(value)&&value>=0?Math.min(max,value):fallback;
export const statScale = level => 1+.25*(level-1);
export const maxHp = unit => Math.round(100*statScale(unit.level));
export const damage = maxHp;
export const xpThreshold = level => Math.round(60*Math.pow(1.55,level-1));
export const unitPower = unit => TYPE_WEIGHT[unit.type]*statScale(unit.level)*(unit.hp===undefined?1:unit.hp/maxHp(unit));
export const armyPower = units => units.reduce((sum,unit)=>sum+unitPower(unit),0);
export const activeArmy = profile => profile.units.filter(unit=>unit.active);
// A piece keeps its home square even when another piece leaves the army.
export const homeSquare = id => ['e1','a1','b1','f1','a2','c2','e2','g2','b2','f2'][Number(id.replace('pve-unit-',''))-1];
export const initialPve = () => ({version:1,revision:0,sequence:0,levelCap:3,stones:0,cores:0,cleared:[],nodes:{},battle:null,lastResult:null,stats:{battles:0,wins:0,draws:0,stonesUsed:0,firstEvolutionAt:null,stoneInvestments:{},deaths:{},recent:[]},units:['k','r','n','b','p','p','p','p','p','p'].map((type,index)=>({id:`pve-unit-${index+1}`,type,level:1,xp:0,deaths:0,active:index<8}))});
export const frontier = profile => {
 for(let step=1;step<=6;step++)if(!NODES.some(node=>node.step===step&&profile.cleared.includes(node.id)))return step;
 return 6;
};
export const isUnlocked = (profile,node) => !!node&&node.step<=frontier(profile);
export const campaignComplete = profile => profile.cleared.includes('warden');
export const strengthLabel = ratio => ratio<.94?'Слабее вашей армии':ratio>1.06?'Сильнее вашей армии':'Примерно равный соперник';
export const earnXp = (unit,amount,cap) => {
 let level=unit.level,xp=unit.xp+Math.max(0,Math.round(amount));
 while(level<cap&&xp>=xpThreshold(level)){xp-=xpThreshold(level);level++;}
 return {...unit,level,xp:Math.min(xp,xpThreshold(level)-1)};
};
export const deathPenalty = unit => {
 const penalty=Math.ceil(xpThreshold(unit.level)*DEATH_RATE[unit.type]);
 let level=unit.level,xp=unit.xp-penalty;
 if(xp<0&&level>1){level--;xp=xpThreshold(level)+xp;}
 return {...unit,level,xp:Math.max(0,xp),deaths:unit.deaths+1};
};
export const useStone = (profile,id) => {
 if(profile.battle||profile.stones<1)return profile;
 const unit=profile.units.find(unit=>unit.id===id);if(!unit||(unit.level===profile.levelCap&&unit.xp>=xpThreshold(unit.level)-1))return profile;
 const upgraded=earnXp(unit,Math.ceil(xpThreshold(unit.level)*.1),profile.levelCap);
 return {...profile,revision:profile.revision+1,stones:profile.stones-1,units:profile.units.map(row=>row.id===id?upgraded:row),stats:{...profile.stats,stonesUsed:profile.stats.stonesUsed+1,stoneInvestments:{...profile.stats.stoneInvestments,[id]:(profile.stats.stoneInvestments[id]||0)+1}}};
};
export const toggleUnit = (profile,id) => {
 if(profile.battle)return profile;
 const unit=profile.units.find(row=>row.id===id);if(!unit||unit.type==='k'||(!unit.active&&activeArmy(profile).length>=PVE.armySize))return profile;
 return {...profile,revision:profile.revision+1,units:profile.units.map(row=>row.id===id?{...row,active:!row.active}:row)};
};
export const evolveUnit = (profile,id) => {
 if(profile.battle||!campaignComplete(profile)||profile.cores<PVE.evolutionCost)return profile;
 const unit=profile.units.find(row=>row.id===id);if(unit?.type!=='p')return profile;
 return {...profile,revision:profile.revision+1,cores:profile.cores-PVE.evolutionCost,units:profile.units.map(row=>row.id===id?{...row,type:'r'}:row),stats:{...profile.stats,firstEvolutionAt:profile.stats.firstEvolutionAt??profile.stats.battles}};
};
// Deterministic encounters survive reloads and node selection without rerolls.
const randomFor = seed => {let value=2166136261;for(const char of String(seed))value=Math.imul(value^char.charCodeAt(0),16777619);return ()=>{value+=0x6D2B79F5;let x=value;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};};
export const encounter = (profile,node) => {
 const own=activeArmy(profile),power=armyPower(own),target=Math.max(node.minPower,Math.min(node.maxPower,power*node.ratio));
 const random=randomFor(`${node.id}:${profile.sequence}`),highest=Math.max(1,...own.map(unit=>unit.level));
 const maxLevel=Math.min(5,node.threat+1,highest+2),minLevel=Math.max(1,maxLevel-2,Math.min(maxLevel,highest-2));
 let best=null,bestError=Infinity;
 for(let trial=0;trial<300;trial++){
  const pool=node.composition==='knights'?['p','p','n','n','b','r']:node.composition==='rooks'?['p','p','n','b','r','r']:node.composition==='bishops'?['p','p','n','b','b','r']:['p','p','p','n','b','r'];
  const types=['k',node.composition==='knights'?'n':node.composition==='bishops'?'b':'r','p','p'];
  while(types.length<8)types.push(pool[Math.floor(random()*pool.length)]);
  const units=types.map((type,index)=>({id:`enemy-${index+1}`,type,level:minLevel+Math.floor(random()*(maxLevel-minLevel+1))}));
  const value=armyPower(units),error=Math.abs(value-target);
  if(error<bestError){best=units;bestError=error;}if(error<.01)break;
 }
 return {nodeId:node.id,units:best,power:armyPower(best),ratio:armyPower(best)/Math.max(1,power),target};
};
export const normalizePve = input => {
 const fresh=initialPve();if(input?.version!==1||!Array.isArray(input.units))return fresh;
 const cleared=NODES.filter(node=>Array.isArray(input.cleared)&&input.cleared.includes(node.id)).map(node=>node.id);
 const levelCap=cleared.includes('warden')?5:3;
 const units=fresh.units.map(base=>{
  const row=input.units.find(row=>row?.id===base.id)||base;
  const type=base.type==='p'&&row.type==='r'&&cleared.includes('warden')?'r':base.type;
  const level=Math.max(1,number(row.level,1,levelCap));
  return {id:base.id,type,level,xp:number(row.xp,0,xpThreshold(level)-1),deaths:number(row.deaths),active:base.type==='k'||row.active===true};
 });
 let active=0;for(const unit of units)if(unit.active){active++;if(active>8)unit.active=false;}
 const nodes=Object.fromEntries(NODES.filter(node=>input.nodes?.[node.id]).map(node=>[node.id,{attempts:number(input.nodes?.[node.id]?.attempts),wins:number(input.nodes?.[node.id]?.wins),openedAt:number(input.nodes?.[node.id]?.openedAt)}]));
 const stats={battles:number(input.stats?.battles),wins:number(input.stats?.wins),draws:number(input.stats?.draws),stonesUsed:number(input.stats?.stonesUsed),firstEvolutionAt:input.stats?.firstEvolutionAt===null?null:number(input.stats?.firstEvolutionAt),stoneInvestments:Object.fromEntries(units.map(unit=>[unit.id,number(input.stats?.stoneInvestments?.[unit.id])])),deaths:Object.fromEntries(Object.keys(TYPE_WEIGHT).map(type=>[type,number(input.stats?.deaths?.[type])])),recent:Array.isArray(input.stats?.recent)?input.stats.recent.slice(-30):[]};
 const next={...fresh,revision:number(input.revision),sequence:number(input.sequence),levelCap,stones:number(input.stones),cores:number(input.cores,0,1),cleared,units,nodes,stats,lastResult:input.lastResult?.id?input.lastResult:null};
 // A malformed save cannot be interpreted as a victory or mint a reward.
 const battle=input.battle;
 if(validBattle(battle,next))next.battle=structuredClone(battle);
 return next;
};
const validBattle = (battle,profile) => {
 if(!battle||typeof battle.id!=='string'||battle.id.length>120||!NODES.some(node=>node.id===battle.nodeId)||!['playing','result'].includes(battle.phase)||!['w','b'].includes(battle.turn)||!Number.isInteger(battle.ply)||battle.ply<0||battle.ply>PVE.maxPlies)return false;
 if(!Array.isArray(battle.units)||battle.units.length!==16||!battle.xp||typeof battle.xp!=='object'||!battle.positions||typeof battle.positions!=='object')return false;
 const ids=new Set(),squares=new Set();
 for(const unit of battle.units){
  if(!unit||!['w','b'].includes(unit.color)||!Object.hasOwn(TYPE_WEIGHT,unit.type)||!Number.isInteger(unit.level)||unit.level<1||unit.level>5||!Number.isInteger(unit.hp)||unit.hp<0||unit.hp>maxHp(unit)||ids.has(unit.id)||!/^[a-h][1-8]$/.test(unit.square))return false;
  if(unit.color==='w'&&!profile.units.some(row=>row.id===unit.id&&row.active))return false;
  if(unit.hp>0&&squares.has(unit.square))return false;
  ids.add(unit.id);if(unit.hp>0)squares.add(unit.square);
 }
 for(const color of ['w','b'])if(battle.units.filter(unit=>unit.color===color&&unit.type==='k').length!==1)return false;
 if(battle.phase==='result'){
  const result=battle.result;
  if(!battle.settled||!['win','loss','draw'].includes(result?.outcome)||!['king','resigned','limit','repetition','no-moves'].includes(result.reason)||!Array.isArray(result.changes))return false;
  for(const key of ['coins','stones','cores','levelCap'])if(!Number.isSafeInteger(result[key])||result[key]<0||result[key]>(key==='coins'?43:30))return false;
  for(const row of result.changes){
   if(!profile.units.some(unit=>unit.id===row?.id)||!Object.hasOwn(TYPE_WEIGHT,row.type))return false;
   for(const key of ['beforeLevel','afterLevel','earned','penalty'])if(!Number.isSafeInteger(row[key])||row[key]<0||row[key]>1e6)return false;
  }
 }
 if(battle.phase==='playing'&&battle.units.some(unit=>unit.type==='k'&&unit.hp===0))return false;
 return true;
};
