/* Dark mode obbligatorio e fullscreen disabilitato. */
(function finalDarkAndNoFullscreen(){
 function apply(){document.documentElement.classList.add('dark');document.body?.classList.add('dark');document.body?.classList.remove('light','no-anim');document.getElementById('darkModeBtn')?.remove();document.getElementById('toggleDark')?.closest('.settings-row')?.remove();document.getElementById('galleryFullscreenBtn')?.remove();const g=document.getElementById('galleryFirstEdition');g?.classList.remove('gallery-fullscreen');if(document.body)document.body.style.overflow=''}
 apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});setTimeout(apply,300);
 window.setGalleryFullscreen2027=function(){apply()};window.toggleDarkMode=function(){apply()};window.handleDarkToggle=function(){apply()};
})();
