import {useEffect,useLayoutEffect,useRef,useState} from 'react';
export function edgeSpeed(point,start,end,zone=56){
 if(point<start||point>end)return 0;
 if(point<start+zone)return -Math.ceil(14*Math.min(1,(start+zone-point)/zone));
 if(point>end-zone)return Math.ceil(14*Math.min(1,(point-end+zone)/zone));
 return 0;
}
export function useDragScroll(canvas,dragging){
 const point=useRef(null);
 useEffect(()=>{
  if(!dragging){point.current=null;return}
  let frame;
  const step=()=>{
   const current=point.current,board=canvas.current;
   if(current&&board){
    const bounds=board.getBoundingClientRect();
    board.scrollLeft+=edgeSpeed(current.x,bounds.left,bounds.right);
    const cards=current.cards;
    if(cards?.isConnected){const rect=cards.getBoundingClientRect();cards.scrollTop+=edgeSpeed(current.y,rect.top,rect.bottom,44)}
   }
   frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return()=>cancelAnimationFrame(frame);
 },[canvas,dragging]);
 return event=>{point.current={x:event.clientX,y:event.clientY,cards:event.target.closest('.kbColumn')?.querySelector('.kbCards')}};
}
export function useBoardMotion(canvas,items){
 const previous=useRef(new Map()),animations=useRef(new Set());
 useLayoutEffect(()=>{
  if(!canvas.current)return;
  const bounds=canvas.current.getBoundingClientRect(),next=new Map();
  for(const card of canvas.current.querySelectorAll('[data-card-id]')){
   const rect=card.getBoundingClientRect(),list=card.closest('.kbCards');
   const transform=new DOMMatrixReadOnly(getComputedStyle(card).transform);
   const position={left:rect.left-transform.m41-bounds.left+canvas.current.scrollLeft,top:rect.top-transform.m42-bounds.top+(list?.scrollTop||0)};
   next.set(card.dataset.cardId,position);
   const old=previous.current.get(card.dataset.cardId);
   if(!old||matchMedia('(prefers-reduced-motion: reduce)').matches||!card.animate)continue;
   const x=old.left-position.left,y=old.top-position.top;
   if(Math.abs(x)<1&&Math.abs(y)<1)continue;
   const animation=card.animate([{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:200,easing:'cubic-bezier(.16,1,.3,1)'});
   animations.current.add(animation);animation.onfinish=animation.oncancel=()=>animations.current.delete(animation);
  }
  previous.current=next;
 },[canvas,items]);
 useEffect(()=>()=>{for(const animation of animations.current)animation.cancel()},[]);
}
export function useBoardNavigation(canvas){
 const [edges,setEdges]=useState({start:true,end:true});
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  let frame;
  const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const next={start:element.scrollLeft<2,end:element.scrollLeft+element.clientWidth>=element.scrollWidth-2};
   setEdges(old=>old.start===next.start&&old.end===next.end?old:next);
  })};
  const observer=new ResizeObserver(measure);observer.observe(element);
  const mutation=new MutationObserver(measure);mutation.observe(element,{childList:true});
  element.addEventListener('scroll',measure,{passive:true});measure();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();mutation.disconnect();element.removeEventListener('scroll',measure)};
 },[canvas]);
 return {...edges,scroll:direction=>canvas.current?.scrollBy({left:direction*Math.min(660,canvas.current.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
}
