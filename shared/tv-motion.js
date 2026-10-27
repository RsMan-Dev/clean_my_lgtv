(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.TVMotion = factory();
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  var owners = new WeakMap();

  function create(options) {
    options = options || {};
    var root = options.root || document;
    var doc = root.nodeType === 9 ? root : root.ownerDocument;
    var win = doc.defaultView;
    var previous = owners.get(doc);
    if (previous) previous.destroy();
    var frame = doc.createElement('div');
    var focus = null, destroyed = false, active = true, updateFrame = 0, scrollFrame = 0;
    var painted = null, animation = null, paintedRadius = null;
    var media = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var selector = 'button, [tabindex], input, select, textarea, a[href]';
    var style = frame.style;
    style.position = 'fixed'; style.pointerEvents = 'none'; style.zIndex = '2147483647';
    style.boxSizing = 'border-box'; style.border = '2px solid white';
    style.boxShadow = '0 0 0 1px rgba(0,0,0,.6)';
    style.left='0'; style.top='0'; style.display = 'none'; style.willChange = 'transform, width, height';
    frame.setAttribute('aria-hidden', 'true');
    (doc.body || doc.documentElement).appendChild(frame);
    doc.documentElement.classList.add('tv-motion-active');

    function reduced() { return !!(media && media.matches); }
    function target(el) { return options.resolveTarget ? (options.resolveTarget(el) || el) : el; }
    function rect(el, face) {
      var value = options.resolveRect && options.resolveRect(el);
      var r = value || face.getBoundingClientRect();
      var height = Number(el.getAttribute('data-focus-height'));
      return {left:r.left, top:r.top, width:r.width, height:height > 0 ? Math.min(height, r.height) : r.height};
    }
    function bounds(el, face, r) {
      if (!active || doc.hidden || !el.isConnected || !face.isConnected || r.width <= 0 || r.height <= 0) return null;
      var left=0, top=0, right=win.innerWidth, bottom=win.innerHeight;
      for (var node=face; node && node.nodeType === 1; node=node.parentElement) {
        var css=win.getComputedStyle(node);
        if (node.hidden || node.getAttribute('aria-hidden') === 'true' || css.opacity === '0' || css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse') return null;
        if (node !== face && /(auto|scroll|hidden|clip)/.test(css.overflow + ' ' + css.overflowX + ' ' + css.overflowY)) {
          var clip=node.getBoundingClientRect();
          left=Math.max(left,clip.left); top=Math.max(top,clip.top);
          right=Math.min(right,clip.right); bottom=Math.min(bottom,clip.bottom);
        }
      }
      if (r.left + r.width <= left || r.left >= right || r.top + r.height <= top || r.top >= bottom) return null;
      return {left:left,top:top,right:right,bottom:bottom};
    }
    function draw(animate, now) {
      if (destroyed || !focus) { style.display='none'; painted=null; animation=null; return; }
      var face=target(focus), r=rect(focus,face);
      var clip=bounds(focus,face,r);
      if (!clip) { style.display='none'; painted=null; animation=null; return; }
      var wasHidden=style.display === 'none';
      var pad=typeof options.padding === 'number' ? options.padding : 4;
      var goal={left:r.left-pad,top:r.top-pad,width:r.width+pad*2,height:r.height+pad*2};
      var radius=focus.getAttribute('data-focus-radius') || win.getComputedStyle(face).borderRadius;
      if (/^\d+(\.\d+)?$/.test(radius)) radius += 'px';
      var radiusNumber=/^\d+(\.\d+)?px$/.test(radius) ? parseFloat(radius) : null;
      if (animate && !wasHidden && painted && !reduced()) animation={from:painted,radiusFrom:paintedRadius,start:null,progress:0};
      if (reduced()) animation=null;
      if (animation && typeof now === 'number') {
        if (animation.start === null) animation.start=now;
        animation.progress=Math.min(1,(now-animation.start)/140);
      }
      var t=animation ? 1-Math.pow(1-animation.progress,3) : 1;
      var from=animation ? animation.from : goal;
      var box={left:from.left+(goal.left-from.left)*t,top:from.top+(goal.top-from.top)*t,
        width:from.width+(goal.width-from.width)*t,height:from.height+(goal.height-from.height)*t};
      painted=box;
      style.transform='translate3d('+box.left+'px, '+box.top+'px, 0)';
      style.width=box.width+'px'; style.height=box.height+'px';
      style.clipPath='inset('+Math.max(0,clip.top-box.top)+'px '+Math.max(0,box.left+box.width-clip.right)+'px '+Math.max(0,box.top+box.height-clip.bottom)+'px '+Math.max(0,clip.left-box.left)+'px)';
      paintedRadius=radiusNumber;
      if (animation && radiusNumber !== null && animation.radiusFrom !== null) {
        paintedRadius=animation.radiusFrom+(radiusNumber-animation.radiusFrom)*t;
        style.borderRadius=paintedRadius+'px';
      } else style.borderRadius=radius;
      style.display='block';
      if (animation && animation.progress >= 1) animation=null;
      if (animation) schedule();
    }
    function schedule() {
      if (!updateFrame && !destroyed) updateFrame=win.requestAnimationFrame(function (now) { updateFrame=0; draw(false,now); });
    }
    function onFocus(event) {
      var el=event.target;
      if (!el || !el.matches || !el.matches(selector)) return;
      if (updateFrame) { win.cancelAnimationFrame(updateFrame); updateFrame=0; }
      if (focus === el) { draw(false); return; }
      focus=el; draw(true);
    }
    function focusElement(el) {
      if (destroyed || !el) return;
      try { el.focus({preventScroll:true}); } catch (_) { el.focus(); }
      if (focus !== el) { focus=el; draw(true); }
    }
    function stopScroll() { if (scrollFrame) win.cancelAnimationFrame(scrollFrame); scrollFrame=0; }
    function reveal(el, container, config) {
      stopScroll();
      if (destroyed || !el || !container) return;
      var pad=config && typeof config.padding === 'number' ? config.padding : 10;
      var r=rect(el,target(el)), c=container.getBoundingClientRect();
      var startX=container.scrollLeft, startY=container.scrollTop;
      var dx=r.left < c.left+pad ? r.left-c.left-pad : r.left+r.width > c.right-pad ? r.left+r.width-c.right+pad : 0;
      var dy=r.top < c.top+pad ? r.top-c.top-pad : r.top+r.height > c.bottom-pad ? r.top+r.height-c.bottom+pad : 0;
      var x=Math.max(0, Math.min(container.scrollWidth-container.clientWidth,startX+dx));
      var y=Math.max(0, Math.min(container.scrollHeight-container.clientHeight,startY+dy));
      if (x === startX && y === startY) return;
      if (reduced()) { container.scrollLeft=x; container.scrollTop=y; draw(false); return; }
      var started=null;
      function tick(now) {
        if (started === null) started=now;
        var t=Math.min(1,(now-started)/160), ease=1-Math.pow(1-t,3);
        container.scrollLeft=startX+(x-startX)*ease; container.scrollTop=startY+(y-startY)*ease;
        draw(false);
        scrollFrame=t < 1 ? win.requestAnimationFrame(tick) : 0;
      }
      scrollFrame=win.requestAnimationFrame(tick);
    }
    function hide() { active=false; style.display='none'; painted=null; animation=null; stopScroll(); }
    function show() { active=true; schedule(); }
    function visibility() { if (doc.hidden) hide(); else show(); }
    root.addEventListener('focusin',onFocus);
    doc.addEventListener('scroll',schedule,true);
    doc.addEventListener('wheel',stopScroll,true); doc.addEventListener('touchstart',stopScroll,true);
    doc.addEventListener('visibilitychange',visibility);
    win.addEventListener('resize',schedule); win.addEventListener('blur',hide); win.addEventListener('focus',show);
    var observer=win.MutationObserver ? new win.MutationObserver(function (records) {
      if (records.some(function (record) { return record.target !== frame; })) schedule();
    }) : null;
    if (observer) observer.observe(root.nodeType === 9 ? root.documentElement : root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
    var controller = {
      focus:focusElement, reveal:reveal,
      sync:function () { if (!destroyed) { if (doc.activeElement && doc.activeElement.matches && doc.activeElement.matches(selector)) focus=doc.activeElement; draw(false); } },
      destroy:function () {
        if (destroyed) return;
        destroyed=true; stopScroll(); if (updateFrame) win.cancelAnimationFrame(updateFrame);
        root.removeEventListener('focusin',onFocus); doc.removeEventListener('scroll',schedule,true);
        doc.removeEventListener('wheel',stopScroll,true); doc.removeEventListener('touchstart',stopScroll,true);
        doc.removeEventListener('visibilitychange',visibility);
        win.removeEventListener('resize',schedule); win.removeEventListener('blur',hide); win.removeEventListener('focus',show);
        if (observer) observer.disconnect(); frame.remove(); doc.documentElement.classList.remove('tv-motion-active'); owners.delete(doc);
      }
    };
    owners.set(doc,controller);
    return controller;
  }
  return {create:create};
}));
