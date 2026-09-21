export type Level1Question = {
  id: string;
  question: string;
  helper: string;
  portraits: Array<"carl" | "russell" | "ellie" | "dug" | "kevin">;
  options: Array<{ id: "A" | "B" | "C"; text: string; correct: boolean }>;
};

export type SortItem = {
  id: string;
  text: string;
  emoji: string;
  zone: "sack" | "balloons";
};

export const INTRO_TEXT =
  "Benvenuti, Esploratori di Quarta! Il nostro viaggio inizia ora. Per raggiungere la nostra meta e diventare “Esploratori Esperti” come Russell, dovremo superare prove, rispondere a domande e soprattutto… capire quali pesi lasciare andare e quali aiuti portarci nel cuore. Pronti? Allacciate i vostri palloncini!";

export const FINAL_QUOTE =
  "L’avventura non è andare lontano, ma vivere insieme alle persone che ami le piccole cose.";

export const CARL_INSIGHT =
  "Carl capisce che la sua vera avventura non è stata il viaggio fisico, ma la vita con Ellie. Capisce che l’avventura non è andare lontano, ma vivere insieme alle persone che ami le piccole cose.";

export const level1Questions: Level1Question[] = [
  {
    id: "carl",
    question: "Chi è Carl Fredricksen?",
    helper: "Pensa al signore della casetta gialla…",
    portraits: ["carl"],
    options: [
      { id: "A", text: "Un giovane inventore sognatore.", correct: false },
      { id: "B", text: "Un anziano burbero dal cuore d’oro.", correct: true },
      { id: "C", text: "Un esploratore che vive nella giungla.", correct: false },
    ],
  },
  {
    id: "ellie",
    question: "Come viene descritta Ellie da bambina?",
    helper: "Ellie amava i racconti di avventura!",
    portraits: ["ellie"],
    options: [
      { id: "A", text: "Silenziosa e timida.", correct: false },
      { id: "B", text: "Sognatrice, coraggiosa e piena di fantasia.", correct: true },
      { id: "C", text: "Interessata solo alle regole e allo studio.", correct: false },
    ],
  },
  {
    id: "dream",
    question: "Qual era il grande sogno d’infanzia di Carl ed Ellie?",
    helper: "Guardate la pagina dell’album dei ricordi…",
    portraits: ["carl", "ellie"],
    options: [
      { id: "A", text: "Comprare una casa enorme in città.", correct: false },
      { id: "B", text: "Raggiungere le Cascate Paradiso.", correct: true },
      { id: "C", text: "Diventare famosi attori.", correct: false },
    ],
  },
  {
    id: "friends",
    question: "Chi si unisce a Carl e Russell nel loro viaggio?",
    helper: "Un cane parlante e un uccello meraviglioso!",
    portraits: ["dug", "kevin"],
    options: [
      { id: "A", text: "Un gatto parlante e un pappagallo.", correct: false },
      { id: "B", text: "Un orso polare e un pinguino.", correct: false },
      { id: "C", text: "Due simpatici animali: Dug e Kevin.", correct: true },
    ],
  },
  {
    id: "balloons",
    question: "Perché Carl decide di far volare la sua casa con migliaia di palloncini colorati?",
    helper: "Una promessa è per sempre…",
    portraits: ["carl"],
    options: [
      { id: "A", text: "Per non pagare più l’affitto.", correct: false },
      { id: "B", text: "Per scappare dalla polizia.", correct: false },
      { id: "C", text: "Per mantenere la promessa fatta ad Ellie.", correct: true },
    ],
  },
];

export const sortItems: SortItem[] = [
  { id: "fear-wrong", text: "La paura di sbagliare", emoji: "😟", zone: "sack" },
  { id: "fights", text: "I bisticci all’intervallo", emoji: "🗯️", zone: "sack" },
  { id: "not-enough", text: "La paura di non essere abbastanza", emoji: "🌧️", zone: "sack" },
  { id: "curiosity", text: "La curiosità di scoprire cose nuove", emoji: "🔍", zone: "balloons" },
  { id: "collab", text: "Collaborare con i compagni", emoji: "🤝", zone: "balloons" },
  { id: "listen", text: "Ascoltare i miei insegnanti", emoji: "👂", zone: "balloons" },
  { id: "smile", text: "Un sorriso", emoji: "😊", zone: "balloons" },
  { id: "courage", text: "Il coraggio", emoji: "💪", zone: "balloons" },
];

export const sortItemColors: Record<string, string> = {
  "fear-wrong": "#ffadad",
  fights: "#ffd6a5",
  "not-enough": "#fdffb6",
  curiosity: "#caffbf",
  collab: "#9bf6ff",
  listen: "#a0c4ff",
  smile: "#bdb2ff",
  courage: "#ffc6ff",
};

export const correctMessages = [
  "Un palloncino si gonfia!",
  "Bravissimo, esploratore!",
  "La casa è sempre più leggera!",
  "Ancora un po’ e decolliamo!",
  "L’ultimo palloncino! Si vola!",
];

export const wrongMessages = [
  "Non è questa… prova un’altra risposta!",
  "Ci sei quasi! Riprova con calma.",
  "Pensa alla storia di Up e riprova!",
];

export const badgeColors = [
  { id: "red", label: "Rosso", value: "#e63946" },
  { id: "orange", label: "Arancio", value: "#f77f00" },
  { id: "yellow", label: "Giallo", value: "#ffd166" },
  { id: "green", label: "Verde", value: "#2a9d8f" },
  { id: "sky", label: "Cielo", value: "#4eb8e8" },
  { id: "blue", label: "Blu", value: "#3a86ff" },
  { id: "purple", label: "Viola", value: "#9b5de5" },
  { id: "pink", label: "Rosa", value: "#ff6b9d" },
];

export type Step =
  | "intro"
  | "level1"
  | "liftoff"
  | "level2sort"
  | "level2map"
  | "level2adventure"
  | "landing"
  | "shareFavorite"
  | "shareEmotion"
  | "vote"
  | "promise"
  | "conclusion";
