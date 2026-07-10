// UI chrome text (not content data) in Telugu and English. Content itself
// (data/questions.json vs data/en/questions.json, etc.) is loaded per
// language separately by data.js - this file only covers screen labels,
// buttons, and messages that app.js renders around that content.

export const LANGUAGES = ['te', 'en'];
export const DEFAULT_LANGUAGE = 'te';

const STRINGS = {
  back: { te: '← వెనుకకు', en: '← Back' },
  changeName: { te: 'మార్చు', en: 'Change' },

  introTitle: { te: 'నామ నిధి కి స్వాగతం', en: 'Welcome to Nama Nidhi' },
  introBody1: {
    te: "ఇది ఒక ఆటవిడుపు లాంటి సాధన. మీరు రెండు మార్గాలు ఎంచుకోవచ్చు. మొదటిది ఇచ్చిన అక్షరాల సమూహంలో భగవంతుని లేదా ఆ సంబంధించిన వ్యక్తుల లేదా వస్తువుల పేర్లను గుర్తించడం ('ఈనాడు' పదవినోదం లాగా ).",
    en: "This is a small daily practice, more play than chore. You can pick one of two ways to spend a few minutes. The first is spotting names of the divine - or people and things connected to it - hidden in a grid of letters (like a newspaper word-search).",
  },
  introBody2: {
    te: 'రెండవది, తెల్సిన నామాన్ని ప్రశాంతంగా పెన్ తో పేపర్ మీద రాస్తున్నట్లు గా స్క్రీన్ మీద వ్రాయడం. దీన్ని లిఖిత జపం అంటారు. మీకు నచ్చిన పేర్లను కూడా మీరు వ్రాయవచ్చు.',
    en: 'The second is writing out a name you already know, calmly, as if pen were touching paper - on the screen instead. This is called Likhita Japam ("written chanting"). You can write any name you like, not just the suggested ones.',
  },
  introBody3: {
    te: 'స్కోర్ బోర్డు లో మీ ప్రగతి ని చూడగలరు. మన ఇతర కుటుంబ సభ్యుల ప్రగతి కూడా అక్కడ ఉంటుంది.',
    en: "You can see your own progress on the Scoreboard, alongside the rest of the family's.",
  },
  introBody4: {
    te: 'ఇది చెయ్యటానికి ముఖ్య కారణం, మన phone ద్వారా మనం చాల సేపు మనం సమాచార సేకరణ యంత్రాలుగా ఉంటున్నాం. కొంచెం సేపు దానికి విరామం అవసరం అనిపించి వేరే ఎదో పని బదులు ఇది పురుషార్థం గా కూడా పనికి వస్తుంది అన్న భావం తో దీనికి పూనుకున్నా.',
    en: "The main reason I built this: our phones keep us in near-constant information-gathering mode. It felt like a short break from that - spent on something worthwhile instead - would do some good.",
  },
  introSignature: {
    te: 'Just a random thought in action....but once started, it was absorbing for me. Hope you too enjoy it.',
    en: 'Just a random thought in action....but once started, it was absorbing for me. Hope you too enjoy it.',
  },
  continueBtn: { te: 'ప్రారంభించండి', en: 'Continue' },

  appTitle: { te: 'నామ నిధి', en: 'Nama Nidhi' },
  appTagline: { te: 'నామాల్లో దాగిన రత్నాలు', en: 'Gems hidden in names' },
  nameGatePrompt: { te: 'ఆడటానికి మీ పేరు లేదా ముద్దుపేరు రాయండి', en: 'Enter your name or nickname to play' },
  namePlaceholder: { te: 'మీ పేరు', en: 'Your name' },
  nameTakenError: {
    te: 'ఈ పేరు ఇప్పటికే వాడుకలో ఉంది. దయచేసి వేరే పేరు లేదా ఇంటిపేరు జోడించి రాయండి.',
    en: 'That name is already taken. Please try another name, or add a last name.',
  },
  beginBtn: { te: 'ప్రారంభించండి', en: 'Start' },

  languageLabel: { te: 'భాష', en: 'Language' },
  languageTelugu: { te: 'తెలుగు', en: 'తెలుగు' },
  languageEnglish: { te: 'English', en: 'English' },
  languageNote: {
    te: 'ఆంగ్ల విధానంలో స్కోర్లు ఈ పరికరంలో మాత్రమే విడిగా భద్రపరచబడతాయి.',
    en: 'Scores in English mode are kept separately, only on this device.',
  },

  chooseModePrompt: { te: 'మీకు నచ్చిన విధానాన్ని ఎంచుకోండి', en: 'Choose how you would like to play' },
  namaGuptaNidhiTitle: { te: 'నామ గుప్త నిధి', en: 'Nama Gupta Nidhi' },
  namaGuptaNidhiSub: { te: 'నామాలు దాగిన పజిల్ ఆడండి', en: 'Play the hidden-names puzzle' },
  likhitaJapamTitle: { te: 'లిఖిత జపం', en: 'Likhita Japam' },
  likhitaJapamSub: { te: 'నామాన్ని ప్రశాంతంగా రాయండి', en: 'Write a name calmly, one letter at a time' },
  stotraParikshaTitle: { te: 'స్తోత్ర పరీక్ష', en: 'Stotra Pariksha' },
  stotraParikshaSub: { te: 'మీ అవగాహనను పరీక్షించుకోండి', en: 'Test how well you know a stotram' },
  scoreboardBtn: { te: 'స్కోరు బోర్డు', en: 'Scoreboard' },
  aboutBtn: { te: 'ఈ యాప్ గురించి', en: 'About this app' },

  puzzleInstructions: {
    te: 'కింద సూచనల్లో ఉన్న నామాలను అక్షరాల్లో వేలితో గీసి కనుగొనండి',
    en: 'Find the names listed below by tracing them in the grid with your finger',
  },
  newPuzzleBtn: { te: 'కొత్త పజిల్', en: 'New puzzle' },
  showAnswerBtn: { te: 'సమాధానం చూపు', en: 'Show answer' },
  hintsTitle: { te: 'సూచనలు', en: 'Hints' },
  continueLevelBtn: { te: 'కొనసాగించు', en: 'Continue' },

  congratulations: { te: 'అభినందనలు!', en: 'Well done!' },
  allFoundLevel: { te: 'అన్ని నామాలు దొరికాయి.', en: 'You found every name.' },

  soonBadge: { te: 'త్వరలో', en: 'Soon' },
  soonSub: { te: 'త్వరలో వస్తుంది', en: 'Coming soon' },
  playableBadge: { te: 'ఆడవచ్చు', en: 'Play' },
  stotramCardSub: {
    te: (n) => `మొత్తం ${n} పేర్లు · గ్రిడ్ సైజు, ప్రశ్నల సంఖ్య ప్రతిసారి మారుతుంది`,
    en: (n) => `${n} names total · grid size and question count change every round`,
  },
  stotramFoundAll: {
    te: (title) => `${title}లోని అన్ని నామాలను మీరు కనుగొన్నారు.`,
    en: (title) => `You found every name in ${title}.`,
  },
  stotramAboutLabel: {
    te: (title) => `<strong>${title}</strong> గురించి:`,
    en: (title) => `About <strong>${title}</strong>:`,
  },
  playAgainBtn: { te: 'మళ్ళీ ఆడండి', en: 'Play again' },
  finishBtn: { te: 'ముగించు', en: 'Finish' },

  japamPickerTitle: { te: 'ఏ నామాన్ని రాద్దాం?', en: 'Which name shall we write?' },
  japamCustomPrompt: { te: 'లేదా మీకు నచ్చిన నామాన్ని రాయండి', en: 'Or write any name you like' },
  japamCustomPlaceholder: { te: 'తెలుగులో లేదా English లో రాయండి', en: 'Type the name you want to trace' },
  suggestedBadge: { te: 'సూచించినది', en: 'Suggested' },

  likhitaJapamHeading: { te: 'లిఖిత జపం', en: 'Likhita Japam' },
  japamTraceInstructions: {
    te: 'కింద చుక్కలను అనుసరిస్తూ వేలితో గీయండి',
    en: 'Trace the dots below with your finger',
  },
  japamSessionCount: { te: (n) => `ఈ సెషన్‌లో: ${n} సార్లు`, en: (n) => `This session: ${n} times` },
  japamThisSession: { te: 'ఈ సెషన్‌లో', en: 'This session' },
  japamTimes: { te: (n) => `${n} సార్లు`, en: (n) => `${n} times` },
  goHomeBtn: { te: 'హోమ్‌కు వెళ్ళండి', en: 'Go to Home' },
  japamComplete: { te: 'లిఖిత జపం పూర్తయింది.', en: 'Likhita Japam complete.' },

  scoreboardTitle: { te: 'స్కోరు బోర్డు', en: 'Scoreboard' },
  scoreboardTagline: { te: 'మన బృందం సాధించిన ప్రగతి', en: "Our family's progress" },
  puzzleBoardTitle: { te: 'నామ గుప్త నిధి స్కోరు బోర్డు', en: 'Nama Gupta Nidhi scoreboard' },
  japamBoardTitle: { te: 'లిఖిత జప స్కోరు బోర్డు', en: 'Likhita Japam scoreboard' },
  loading: { te: 'లోడ్ అవుతోంది...', en: 'Loading...' },
  colName: { te: 'పేరు', en: 'Name' },
  colPearls: { te: 'ముత్యాలు', en: 'Pearls' },
  colGems: { te: 'రత్నాలు', en: 'Gems' },
  colDiamonds: { te: 'వజ్రాలు', en: 'Diamonds' },
  colPuzzlesCompleted: { te: 'పూర్తయిన పజిల్స్', en: 'Puzzles completed' },
  colTotalJapamCount: { te: 'మొత్తం జపసంఖ్య', en: 'Total japam count' },
  noScoresYet: { te: 'ఇంకా స్కోర్లు లేవు.', en: 'No scores yet.' },
  localOnlyNote: {
    te: 'ఇది ఈ పరికరంలో మాత్రమే భద్రపరచబడింది.',
    en: 'This is saved only on this device.',
  },
  localPuzzlesCompleted: { te: (n) => `పూర్తయిన పజిల్స్: ${n}`, en: (n) => `Puzzles completed: ${n}` },
  localTotalJapam: { te: (n) => `మొత్తం జపసంఖ్య: ${n}`, en: (n) => `Total japam count: ${n}` },
  localTodayJapam: { te: (n) => `ఈ రోజు: ${n}`, en: (n) => `Today: ${n}` },

  gemEasy: { te: 'ముత్యం', en: 'Pearl' },
  gemMedium: { te: 'రత్నం', en: 'Gem' },
  gemDifficult: { te: 'వజ్రం', en: 'Diamond' },

  syllableCount: { te: (n) => `(${n})`, en: (n) => `(${n})` },
};

let currentLang = DEFAULT_LANGUAGE;

export function setLang(lang) {
  currentLang = LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

export function getLang() {
  return currentLang;
}

// t('key') for plain strings, t('key', arg) for the function-valued ones
// above (counts, titles interpolated into a sentence).
export function t(key, ...args) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const value = entry[currentLang] ?? entry[DEFAULT_LANGUAGE];
  return typeof value === 'function' ? value(...args) : value;
}
