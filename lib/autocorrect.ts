/**
 * Autocorrect for common typos (Settings → Account → Typing, off by default). Only fixes words
 * from this list: mistakes nobody means to type. Never touches names, email addresses, links,
 * or anything with numbers. Keeps the capitalization the person used. Safe in the browser.
 */
const FIXES: Record<string, string> = {
  // Swapped letters and slips
  teh: "the", hte: "the", taht: "that", thta: "that", adn: "and", nad: "and", fo: "of", ot: "to", si: "is", ti: "it",
  waht: "what", whta: "what", wiht: "with", wtih: "with", jsut: "just", juts: "just", knwo: "know", konw: "know",
  nwo: "now", owrk: "work", wokr: "work", becuase: "because", becasue: "because", beacuse: "because", becaus: "because",
  thier: "their", theyre: "they're", recieve: "receive", recieved: "received", reciept: "receipt", beleive: "believe",
  belive: "believe", acheive: "achieve", wierd: "weird", freind: "friend", freinds: "friends", peice: "piece",
  // Missing apostrophes (only where the word without one isn't a real word)
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't",
  arent: "aren't", werent: "weren't", havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", couldnt: "couldn't",
  shouldnt: "shouldn't", wouldnt: "wouldn't", im: "I'm", ive: "I've", youre: "you're", youve: "you've", theyve: "they've",
  thats: "that's", whats: "what's", wasn: "wasn't", didn: "didn't",
  // Common misspellings
  definately: "definitely", definatly: "definitely", defintely: "definitely", seperate: "separate", seperately: "separately",
  occured: "occurred", occurence: "occurrence", untill: "until", tommorow: "tomorrow", tomorow: "tomorrow", tommorrow: "tomorrow",
  tomorroww: "tomorrow", yesturday: "yesterday", wensday: "Wednesday", wendsday: "Wednesday", wednsday: "Wednesday",
  thrusday: "Thursday", thursay: "Thursday", febuary: "February", calender: "calendar", appointmnet: "appointment",
  appointmet: "appointment", apointment: "appointment", appointement: "appointment", folow: "follow", followup: "follow-up",
  adress: "address", addres: "address", accomodate: "accommodate", accross: "across", alot: "a lot", aswell: "as well",
  basicly: "basically", begining: "beginning", buisness: "business", busness: "business", bussiness: "business",
  comming: "coming", commited: "committed", completly: "completely", concious: "conscious", curently: "currently",
  enviroment: "environment", existance: "existence", experiance: "experience", familar: "familiar", finaly: "finally",
  foward: "forward", goverment: "government", gaurd: "guard", happend: "happened", immediatly: "immediately",
  independant: "independent", interupt: "interrupt", knowlege: "knowledge", lisence: "license", liason: "liaison",
  maintainance: "maintenance", neccessary: "necessary", necesary: "necessary", noticable: "noticeable", ocassion: "occasion",
  oppurtunity: "opportunity", opportunty: "opportunity", payed: "paid", persistant: "persistent", posession: "possession",
  potentialy: "potentially", prefered: "preferred", priviledge: "privilege", probaly: "probably", probly: "probably",
  pronounciation: "pronunciation", publically: "publicly", realy: "really", reccomend: "recommend", recomend: "recommend",
  refered: "referred", referal: "referral", relevent: "relevant", remeber: "remember", rember: "remember", resturant: "restaurant",
  schedual: "schedule", schedle: "schedule", sucessful: "successful", succesful: "successful", suprise: "surprise",
  thanx: "thanks", thnaks: "thanks", thakns: "thanks", tounge: "tongue", truely: "truly", unfortunatly: "unfortunately",
  usualy: "usually", wich: "which", whcih: "which", wether: "whether", writting: "writing",
  shoudl: "should", shoud: "should", woudl: "would", coudl: "could", agian: "again", agin: "again", allready: "already",
  anwser: "answer", beggining: "beginning", cheif: "chief", collegue: "colleague",
  comittee: "committee", embarass: "embarrass", excercise: "exercise", grammer: "grammar", harrass: "harass",
  hieght: "height", humourous: "humorous", inital: "initial", intresting: "interesting",
  lenght: "length", libary: "library", mispell: "misspell", neice: "niece", occassionally: "occasionally",
  paitent: "patient", paitents: "patients", recived: "received", sincerly: "sincerely", strenght: "strength",
  temprature: "temperature", therefor: "therefore", threshhold: "threshold", vaccuum: "vacuum", visable: "visible",
  clinet: "client", cleint: "client", clients: "clients", clinets: "clients", cleints: "clients", custmer: "customer",
  cusotmer: "customer", costumer: "customer", reminer: "reminder", remidner: "reminder", meetign: "meeting", meting: "meeting",
  emial: "email", emali: "email", nuber: "number", numebr: "number", phoen: "phone",
};
// "clients" maps to itself above only to document it's not a typo; drop identity entries.
for (const [k, v] of Object.entries(FIXES)) if (k === v) delete FIXES[k];

/** The corrected word, or null. Keeps "Teh" → "The" and "TEH" → "THE"; "i" alone becomes "I". */
export function correctWord(word: string): string | null {
  if (!word || word.length > 30 || /[\d@/\\.:_#]/.test(word)) return null;
  if (word === "i") return "I";
  const lower = word.toLowerCase();
  const fix = FIXES[lower];
  if (!fix) return null;
  if (word === lower) return fix;
  if (word === word.toUpperCase() && word.length > 1) return fix.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return fix[0].toUpperCase() + fix.slice(1);
  return fix;
}

/**
 * After a word-ending character is typed at `caret` (a space or punctuation), the word just
 * before it and its corrected form, or null.
 */
export function correctionBefore(text: string, caret: number): { start: number; end: number; word: string; fix: string } | null {
  const ender = text[caret - 1];
  if (!ender || !/[\s.,!?;:)]/.test(ender)) return null;
  const end = caret - 1;
  let start = end;
  while (start > 0 && /[A-Za-z']/.test(text[start - 1])) start--;
  if (start === end) return null;
  // Part of a link, email or path: leave it alone.
  if (start > 0 && /[\w@/.:\-]/.test(text[start - 1])) return null;
  const word = text.slice(start, end);
  const fix = correctWord(word);
  return fix && fix !== word ? { start, end, word, fix } : null;
}
