/* Motion system: reveal a maschera, senza librerie esterne. */
(function premiumMotion2027(){
 let observer;
 function observe(){if(!('IntersectionObserver' in window))return;observer=observer||new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');observer.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -35px'});document.querySelectorAll('#page-chisiamo .chisiamo-card,#page-chisiamo .chisiamo-desc,#page-chisiamo .chisiamo-patrocinio,#page-chisiamo .chisiamo-inner>.chisiamo-card').forEach(el=>{if(!el.classList.contains('motion-reveal')){el.classList.add('motion-reveal');observer.observe(el)}})}
 function animatePage(){const page=document.querySelector('.page.active');if(!page)return;page.animate([{opacity:.65,transform:'translateY(9px)'},{opacity:1,transform:'none'}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});setTimeout(observe,50)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observe();document.addEventListener('click',e=>{if(e.target.closest('[onclick*="switchPage"]'))setTimeout(animatePage,40)})},{once:true});else observe();
 new MutationObserver(observe).observe(document.body,{childList:true,subtree:true});
})();
