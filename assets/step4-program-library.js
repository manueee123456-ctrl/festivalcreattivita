/* Profondità interattiva dei libri — non intercetta i comandi interni */
(function programBooks3D(){
 let raf=0;
 function bind(){document.querySelectorAll('#page-programma .activity-card:not([data-book3d])').forEach(card=>{card.dataset.book3d='1';
  card.addEventListener('pointermove',e=>{if(matchMedia('(max-width:700px)').matches)return;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`translateY(-15px) rotateY(${x*12-7}deg) rotateX(${-y*8}deg) translateZ(35px)`})});
  card.addEventListener('pointerleave',()=>card.style.transform='');
  card.addEventListener('click',e=>{if(e.target.closest('button,a,input'))return;card.classList.toggle('book-active')});
 });}
 const obs=new MutationObserver(bind);obs.observe(document.body,{subtree:true,childList:true});
 document.addEventListener('DOMContentLoaded',bind);setTimeout(bind,300);
})();

/* La nuova edizione usa stabilmente il tema scuro. */
document.documentElement.classList.add('dark');
(function forceFestivalDark(){const apply=()=>document.body&&document.body.classList.add('dark');apply();document.addEventListener('DOMContentLoaded',apply)})();
