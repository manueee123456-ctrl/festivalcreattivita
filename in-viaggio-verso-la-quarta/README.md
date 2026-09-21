# In Viaggio verso la Quarta · Palloncini in volo

Progetto originale recuperato dal [file condiviso](https://filetourl.org/f/4dccnrbw),
con una nuova transizione tra risposte, domande e tappe dell’avventura.
Il sito Festival nella radice del repository non è stato sostituito.

## Cosa cambia

- Un mazzo di palloncini solleva un cartellino con la prossima tappa, tra nuvole
  e stelline. La schermata precedente sale e quella successiva entra dolcemente.
- Il riscontro della risposta corretta rimane visibile prima del decollo.
  Le risposte sbagliate continuano a consentire un nuovo tentativo.
- I comandi sono temporaneamente bloccati durante il volo, anche per la tastiera,
  evitando salti di domanda con tocchi ripetuti. I timer vengono ripuliti.
- Al termine, la nuova domanda riceve il focus e la pagina torna in alto.
- La preferenza di movimento del dispositivo è rispettata inizialmente.
  Nella schermata di benvenuto il pulsante **Attiva i palloncini** permette di
  scegliere esplicitamente il volo anche se Windows richiede movimento ridotto;
  è sempre possibile disattivarlo o tornare alle impostazioni del dispositivo.
  Nessuna nuova libreria di animazione, immagine o traccia audio.
- Testi, domande, immagini, attività, punteggi, colori e suoni originali conservati.
  Le due risposte personali restano separate al passaggio di schermata.

## Anteprima e verifiche

```sh
npm ci
npm run dev       # porta 5173, disponibile anche nell’anteprima Arena
npm run typecheck
npx playwright install chromium
npm test
npm run test:standalone # test sul vero file HTML, con la rete disattivata
```

I test verificano risposte giuste e sbagliate, doppi tocchi, tutte le cinque
domande, l’intera avventura fino al distintivo e al riavvio, modalità a movimento
ridotto, riattivazione esplicita dei palloncini e schermi mobili verticali/orizzontali.
La modalità standalone esegue gli stessi test da `file://`, fino al distintivo,
con la rete disattivata, verificando anche gli errori di console e le risorse.
Per un browser già installato è
possibile impostare `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## File pronto da aprire

```sh
npm run export
```

Genera `../quiz-palloncini.html`, apribile direttamente in un browser o pubblicabile
come pagina statica. Nella **versione 2 offline**, JavaScript, CSS, immagini e font
Fredoka/Nunito sono tutti incorporati, senza richieste di rete o file di supporto.
Lo script è un IIFE classico eseguito dopo il contenitore dell’app: non richiede
moduli ES, CORS o un server locale. L’ombra del distintivo non usa più riferimenti
SVG `url(#…)`, che possono causare problemi con le origini opache dei file locali.
Non è necessario disattivare alcuna protezione del browser. Le licenze SIL dei
font sono incluse nel documento esportato.

Se sul dispositivo è attivo «riduci movimento», premere **Attiva i palloncini**
prima di iniziare. La scelta è salvata quando il browser lo consente; se lo
storage dei file locali è bloccato, il comando funziona comunque per la partita.
Le risposte personali non sono salvate né inviate in rete.

L’esportazione non modifica `../index.html` né il resto del sito Festival.

Le animazioni sono in `src/components/BalloonJourney.tsx` e
`src/components/balloon-journey.css`; il loro avvio è collegato ai passaggi già
presenti in `App.tsx` e al riscontro delle risposte in `Level1Screen.tsx`.
