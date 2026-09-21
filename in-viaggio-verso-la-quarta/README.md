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
- Con `prefers-reduced-motion` il volo è sostituito da un passaggio rapido senza
  movimenti. Nessuna nuova libreria di animazione, immagine o traccia audio.
- Testi, domande, immagini, attività, punteggi, colori e suoni originali conservati.
  Le due risposte personali restano separate al passaggio di schermata.

## Anteprima e verifiche

```sh
npm ci
npm run dev       # porta 5173, disponibile anche nell’anteprima Arena
npm run typecheck
npx playwright install chromium
npm test
```

I test verificano risposte giuste e sbagliate, doppi tocchi, tutte le cinque
domande, l’intera avventura fino al distintivo e al riavvio, modalità a movimento
ridotto e schermi mobili verticali/orizzontali. Per un browser già installato è
possibile impostare `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## File pronto da aprire

```sh
npm run export
```

Genera `../quiz-palloncini.html`, apribile direttamente in un browser o pubblicabile
come pagina statica. JavaScript, CSS e immagini sono incorporati; i font Google
restano quelli originali, con caratteri di sistema come alternativa senza rete.
L’esportazione non modifica `../index.html` né il resto del sito Festival.

Le animazioni sono in `src/components/BalloonJourney.tsx` e
`src/components/balloon-journey.css`; il loro avvio è collegato ai passaggi già
presenti in `App.tsx` e al riscontro delle risposte in `Level1Screen.tsx`.
