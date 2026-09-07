/* Tema scuro permanente, senza osservatori o cicli durante il caricamento. */
(function darkOnly2027(){
 function apply(){
  document.documentElement.classList.add('dark');
  if(document.body){document.body.classList.add('dark');document.body.classList.remove('light')}
  document.getElementById('darkModeBtn')?.remove();
  document.getElementById('toggleDark')?.closest('.settings-row')?.remove();
 }
 apply();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
 window.toggleDarkMode=function(){apply()};
 window.handleDarkToggle=function(){apply()};
 try{localStorage.setItem('fdcDark','1')}catch(e){}
})();
