'use strict';
const assert=require('assert');
const motion=require('./tv-motion.js');
function events(obj) {
  const handlers={};
  obj.addEventListener=(name,fn)=>{(handlers[name] ||= []).push(fn);};
  obj.removeEventListener=(name,fn)=>{handlers[name]=(handlers[name] || []).filter(x=>x!==fn);};
  obj.emit=(name,event={})=>(handlers[name] || []).slice().forEach(fn=>fn(event));
  return obj;
}
let next=0, queue=new Map(), reads=0, observer;
const preference={matches:false};
const win=events({innerWidth:1920,innerHeight:1080,matchMedia:()=>preference,
  getComputedStyle:()=>({display:'block',visibility:'visible',overflow:'visible',overflowX:'visible',overflowY:'visible',borderRadius:'12px'}),
  requestAnimationFrame:fn=>{let id=++next;queue.set(id,fn);return id;},cancelAnimationFrame:id=>queue.delete(id),
  MutationObserver:class { constructor(cb){observer=cb;} observe(){} disconnect(){} }});
function step(time) {const work=[...queue.values()];queue.clear();work.forEach(fn=>fn(time));}
const frame={style:{},setAttribute(){},remove(){this.removed=true;}};
const html={nodeType:1,parentElement:null,hidden:false,isConnected:true,classList:{add(){},remove(){}},getAttribute(){return null;},getBoundingClientRect(){reads++;return {left:0,top:0,right:1920,bottom:1080,width:1920,height:1080};}};
const body={...html,appendChild(){},parentElement:html};
const doc=events({nodeType:9,defaultView:win,body,documentElement:html,hidden:false,createElement:()=>frame,activeElement:null});
function element(top,height=100) {return {nodeType:1,parentElement:body,isConnected:true,hidden:false,top,
  getAttribute(name){return name==='data-focus-height'?'60':null;}, matches:()=>true,
  getBoundingClientRect(){reads++;return {left:50,top:this.top,right:150,bottom:this.top+height,width:100,height};},
  focus(options){this.focusOptions=options;doc.activeElement=this;doc.emit('focusin',{target:this});}};}
const controller=motion.create({root:doc});
const first=element(100), second=element(220);
controller.focus(first);
assert.deepStrictEqual(first.focusOptions,{preventScroll:true});
assert.strictEqual(frame.style.height,'68px');
controller.focus(second);
assert.match(frame.style.transform,/96px/);
step(0); step(70);
const midway=frame.style.transform;
assert.notStrictEqual(midway,'translate3d(46px, 96px, 0)');
observer([{target:body}]); doc.emit('scroll'); step(100);
assert.notStrictEqual(frame.style.transform,midway);
step(140);
assert.strictEqual(frame.style.transform,'translate3d(46px, 216px, 0)');
const before=reads;
observer([{target:frame}]);
assert.strictEqual(queue.size,0);
assert.strictEqual(reads,before);
const container={scrollTop:0,scrollLeft:0,scrollWidth:200,clientWidth:200,scrollHeight:1000,clientHeight:200,
  getBoundingClientRect(){return {left:0,top:0,right:200,bottom:200};}};
const third=element(400);
controller.reveal(third,container,{padding:10});
step(0); step(80);
assert(container.scrollTop>0 && container.scrollTop<270);
const partial=container.scrollTop;
third.top=300;
controller.reveal(third,container,{padding:10});
step(100); step(260);
assert.strictEqual(container.scrollTop,partial+170);
assert.strictEqual(queue.size,0);
controller.reveal(element(900),container,{padding:10});
assert(queue.size>0);
win.emit('blur');
assert.strictEqual(queue.size,0);
assert.strictEqual(frame.style.display,'none');
win.emit('focus');step(300);
assert.strictEqual(frame.style.display,'block');
second.isConnected=false;
observer([{target:body}]);step(320);
assert.strictEqual(frame.style.display,'none');
controller.destroy();
assert(frame.removed);
preference.matches=true;
const reducedController=motion.create({root:doc});
const reducedElement=element(900);
container.scrollTop=0;
reducedController.focus(reducedElement);
reducedController.reveal(reducedElement,container,{padding:10});
assert.strictEqual(container.scrollTop,770);
assert.strictEqual(queue.size,0);
assert.strictEqual(frame.style.display,'block');
reducedElement.top=2000;
reducedController.sync();
assert.strictEqual(frame.style.display,'none');
reducedController.destroy();
preference.matches=false;
const combined=motion.create({root:doc});
first.isConnected=true; second.isConnected=true;
combined.focus(first); combined.focus(second);
container.scrollTop=0;
combined.reveal(element(400),container,{padding:10});
step(400); step(470);
const moving=frame.style.transform;
step(540);
assert.notStrictEqual(frame.style.transform,moving);
assert.strictEqual(frame.style.transform,'translate3d(46px, 216px, 0)');
step(560);
combined.destroy();
console.log('TV motion tests passed');
