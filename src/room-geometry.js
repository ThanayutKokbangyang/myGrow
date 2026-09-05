// Opaque pixel bounds measured from each 420 x 280 desk asset (alpha > 100).
const BOUNDS={english:[67,56,394,249],coding:[31,56,354,249],math:[67,24,394,218],cognitive:[31,24,354,218]};
export const contains=(r,p)=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;
export function deskBounds(code,cx,cy,width,height){const b=BOUNDS[code];const scale=Math.min(width/420,height/280);const x=cx-420*scale/2,y=cy-280*scale/2;return {left:x+b[0]*scale,right:x+b[2]*scale,top:y+b[1]*scale,bottom:y+b[3]*scale};}
export function roomGeometry(room,character){const width=room.clientWidth,height=room.clientHeight;const cw=character?.offsetWidth||80,ch=character?.offsetHeight||80;
 return [...room.querySelectorAll('.station')].map(el=>{const code=el.dataset.skill;const raw=deskBounds(code,el.offsetLeft,el.offsetTop,el.offsetWidth,el.offsetHeight);const depth=.84+(raw.bottom/height*100)*.003;const footOffset=ch*.4*depth,rx=cw*.18*depth,ry=5;const collision={left:(raw.left-rx)/width*100,right:(raw.right+rx)/width*100,top:(raw.top-footOffset-ry)/height*100,bottom:(raw.bottom-footOffset+ry)/height*100};return {code,raw,collision};});
}
