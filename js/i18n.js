// UI chrome text (not content data) in Telugu, English, and Kannada. Content
// itself (data/questions.json vs data/en/questions.json, data/kn/..., etc.)
// is loaded per language separately by data.js - this file only covers
// screen labels, buttons, and messages that app.js renders around that content.

export const LANGUAGES = ['te', 'en', 'kn'];
export const DEFAULT_LANGUAGE = 'te';

const STRINGS = {
  back: { te: '← వెనుకకు', en: '← Back', kn: '← ಹಿಂದೆ' },
  changeName: { te: 'మార్చు', en: 'Change', kn: 'ಬದಲಿಸಿ' },

  introTitle: { te: 'నామ నిధి కి స్వాగతం', en: 'Welcome to Nāma Nidhi', kn: 'ನಾಮ ನಿಧಿಗೆ ಸ್ವಾಗತ' },
  introBody1: {
    te: "ఇది ఒక ఆటవిడుపు లాంటి సాధన. మీరు రెండు మార్గాలు ఎంచుకోవచ్చు. మొదటిది ఇచ్చిన అక్షరాల సమూహంలో భగవంతుని లేదా ఆ సంబంధించిన వ్యక్తుల లేదా వస్తువుల పేర్లను గుర్తించడం ('ఈనాడు' పదవినోదం లాగా ).",
    en: "Think of this as a little daily break, more play than practice. There are two ways to spend a few minutes here. One is searching for names of the divine - or people and things connected to them - hidden inside a grid of letters, much like the word-search in the newspaper.",
    kn: 'ಇದನ್ನು ಒಂದು ಸಣ್ಣ ದೈನಂದಿನ ವಿರಾಮ ಎಂದು ಭಾವಿಸಿ, ಸಾಧನೆಗಿಂತ ಹೆಚ್ಚು ಆಟ. ಇಲ್ಲಿ ಕೆಲವು ನಿಮಿಷಗಳನ್ನು ಕಳೆಯಲು ಎರಡು ಮಾರ್ಗಗಳಿವೆ. ಒಂದು, ಪತ್ರಿಕೆಯ ಪದ ಶೋಧ ಆಟದಂತೆ, ಅಕ್ಷರಗಳ ಗ್ರಿಡ್‌ನಲ್ಲಿ ಅಡಗಿರುವ ದೇವರ ಅಥವಾ ಅವರಿಗೆ ಸಂಬಂಧಿಸಿದ ವ್ಯಕ್ತಿಗಳ/ವಸ್ತುಗಳ ಹೆಸರುಗಳನ್ನು ಹುಡುಕುವುದು.',
  },
  introBody2: {
    te: 'రెండవది, తెల్సిన నామాన్ని ప్రశాంతంగా పెన్ తో పేపర్ మీద రాస్తున్నట్లు గా స్క్రీన్ మీద వ్రాయడం. దీన్ని లిఖిత జపం అంటారు. మీకు నచ్చిన పేర్లను కూడా మీరు వ్రాయవచ్చు.',
    en: 'The other is writing out a name you already know, slowly and calmly, as if pen were touching paper - except it\'s your finger on the screen. This is Likhita Japam, "written chanting." Write whatever name you like, not just the ones suggested.',
    kn: 'ಇನ್ನೊಂದು, ನಿಮಗೆ ಈಗಾಗಲೇ ತಿಳಿದಿರುವ ಹೆಸರನ್ನು ನಿಧಾನವಾಗಿ, ಶಾಂತವಾಗಿ ಬರೆಯುವುದು - ಪೆನ್ನು ಕಾಗದದ ಮೇಲೆ ಇರುವಂತೆ, ಆದರೆ ಇಲ್ಲಿ ನಿಮ್ಮ ಬೆರಳು ಪರದೆಯ ಮೇಲೆ ಇರುತ್ತದೆ. ಇದನ್ನು ಲಿಖಿತ ಜಪ ಎಂದು ಕರೆಯುತ್ತಾರೆ. ಸೂಚಿಸಿದ ಹೆಸರುಗಳು ಮಾತ್ರವಲ್ಲದೆ ನಿಮಗೆ ಇಷ್ಟವಾದ ಯಾವುದೇ ಹೆಸರನ್ನು ಬರೆಯಬಹುದು.',
  },
  introBody3: {
    te: 'స్కోర్ బోర్డు లో మీ ప్రగతి ని చూడగలరు. మన బృందంలోని మిగతా వారి ప్రగతి కూడా అక్కడ ఉంటుంది.',
    en: "You'll find your own progress on the Scoreboard, right alongside everyone else in our little network.",
    kn: 'ಸ್ಕೋರ್ ಬೋರ್ಡ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಪ್ರಗತಿಯನ್ನು ನೋಡಬಹುದು. ನಮ್ಮ ಬಳಗದ ಇತರರ ಪ್ರಗತಿ ಕೂಡ ಅಲ್ಲಿ ಇರುತ್ತದೆ.',
  },
  introBody4: {
    te: 'ఇది చెయ్యటానికి ముఖ్య కారణం, మన phone ద్వారా మనం చాల సేపు మనం సమాచార సేకరణ యంత్రాలుగా ఉంటున్నాం. కొంచెం సేపు దానికి విరామం అవసరం అనిపించి వేరే ఎదో పని బదులు ఇది పురుషార్థం గా కూడా పనికి వస్తుంది అన్న భావం తో దీనికి పూనుకున్నా.',
    en: "Why I made this: our phones keep us glued to them, endlessly gathering information we don't really need. It felt like this could be a nice little break from that - a few minutes spent on something worthwhile instead.",
    kn: 'ಇದನ್ನು ಏಕೆ ಮಾಡಿದೆ ಎಂದರೆ: ನಮ್ಮ ಫೋನ್‌ಗಳು ನಮ್ಮನ್ನು ಸದಾ ಹಿಡಿದಿಟ್ಟುಕೊಂಡು, ನಮಗೆ ನಿಜವಾಗಿಯೂ ಅಗತ್ಯವಿಲ್ಲದ ಮಾಹಿತಿಯನ್ನು ಸಂಗ್ರಹಿಸುತ್ತಲೇ ಇರುತ್ತವೆ. ಅದಕ್ಕೊಂದು ಸಣ್ಣ ವಿರಾಮ - ಬದಲಿಗೆ ಒಳ್ಳೆಯದೇನಾದರೂ ಮಾಡಲು ಕೆಲವು ನಿಮಿಷ ಕಳೆಯುವುದು - ಚೆನ್ನಾಗಿರಬಹುದು ಎಂದೆನಿಸಿತು.',
  },
  introPrivacyNote: {
    te: 'మీ భద్రత గురించి: ఇది కేవలం ఒక వ్యక్తిగత సాధన కోసం రూపొందించిన యాప్ - యాడ్‌లు గానీ, ట్రాకింగ్ గానీ ఉండవు. మీరిచ్చే పేరు (అసలు పేరు కానక్కర్లేదు, ముద్దుపేరు చాలు) మరియు మీ ఆట పురోగతి తప్ప వేరే ఏ వ్యక్తిగత సమాచారం సేకరించబడదు. ఇది మన బృందం లోపలే ఉంటుంది - ఎక్కడికీ అమ్మబడదు, ఎవరికీ ఇవ్వబడదు. మీ విలువైన అభిప్రాయం, సలహా లేదా సూచనలను దయచేసి <a href="mailto:namanidhi07@gmail.com">namanidhi07@gmail.com</a>కి తెలియజేయండి.',
    en: 'On your safety: This is purely a personal sadhana app - no ads, no tracking. Beyond the name you enter (a nickname is completely fine, it doesn\'t need to be your real name) and your own play progress, nothing else about you is collected. Everything stays within our own network - never sold, never handed to anyone outside it. Please share your valuable feedback, advice, or suggestions at <a href="mailto:namanidhi07@gmail.com">namanidhi07@gmail.com</a>.',
    kn: 'ನಿಮ್ಮ ಸುರಕ್ಷತೆಯ ಬಗ್ಗೆ: ಇದು ಸಂಪೂರ್ಣವಾಗಿ ವೈಯಕ್ತಿಕ ಸಾಧನಾ ಆ್ಯಪ್ - ಜಾಹೀರಾತುಗಳಿಲ್ಲ, ಟ್ರ್ಯಾಕಿಂಗ್ ಇಲ್ಲ. ನೀವು ನೀಡುವ ಹೆಸರು (ಅಡ್ಡಹೆಸರಾದರೂ ಸಾಕು, ನಿಜವಾದ ಹೆಸರೇ ಬೇಕಿಲ್ಲ) ಮತ್ತು ನಿಮ್ಮ ಆಟದ ಪ್ರಗತಿ ಹೊರತು ಬೇರೆ ಯಾವುದೇ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ಸಂಗ್ರಹಿಸಲಾಗುವುದಿಲ್ಲ. ಇದು ನಮ್ಮ ಬಳಗದ ಒಳಗೇ ಇರುತ್ತದೆ - ಎಲ್ಲಿಯೂ ಮಾರಾಟವಾಗುವುದಿಲ್ಲ, ಯಾರಿಗೂ ಕೊಡುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಅಮೂಲ್ಯ ಅಭಿಪ್ರಾಯ, ಸಲಹೆ ಅಥವಾ ಸೂಚನೆಗಳನ್ನು <a href="mailto:namanidhi07@gmail.com">namanidhi07@gmail.com</a> ಗೆ ತಿಳಿಸಿ.',
  },
  feedbackNote: {
    te: 'మీ విలువైన అభిప్రాయం, సలహా లేదా సూచనలను దయచేసి <a href="mailto:namanidhi07@gmail.com">namanidhi07@gmail.com</a>కి తెలియజేయండి.',
    en: 'Please share your valuable feedback, advice, or suggestions at <a href="mailto:namanidhi07@gmail.com">namanidhi07@gmail.com</a>.',
    kn: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಅಮೂಲ್ಯ ಅಭಿಪ್ರಾಯ, ಸಲಹೆ ಅಥವಾ ಸೂಚನೆಗಳನ್ನು <a href="mailto:namanidhi07@gmail.com">namanidhi07@gmail.com</a> ಗೆ ತಿಳಿಸಿ.',
  },
  shareBtnLabel: {
    te: '↗ మిత్రులతో పంచుకోండి',
    en: '↗ Share with friends',
    kn: '↗ ಸ್ನೇಹಿತರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ',
  },
  shareMessage: {
    te: 'నామ నిధి - నామాల్లో దాగిన రత్నాలను వెతికే ఒక భక్తి పద పజిల్ ఆట. మీరు కూడా ప్రయత్నించండి!',
    en: 'Nāma Nidhi - a devotional word-search game for finding hidden names. Try it out!',
    kn: 'ನಾಮ ನಿಧಿ - ಅಡಗಿರುವ ಹೆಸರುಗಳನ್ನು ಹುಡುಕುವ ಭಕ್ತಿಪೂರ್ವಕ ಪದ ಶೋಧ ಆಟ. ನೀವೂ ಪ್ರಯತ್ನಿಸಿ!',
  },
  installGuideLink: {
    te: 'యాప్‌గా ఇన్‌స్టాల్ చేసుకోవడం ఎలా? →',
    en: 'How to install this as an app →',
    kn: 'ಇದನ್ನು ಆ್ಯಪ್ ಆಗಿ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡುವುದು ಹೇಗೆ? →',
  },
  introSignature: {
    te: 'Just a random thought in action....but once started, it was absorbing for me. Hope you too enjoy it.',
    en: 'Just a random thought in action....but once started, it was absorbing for me. Hope you too enjoy it.',
    kn: 'Just a random thought in action....but once started, it was absorbing for me. Hope you too enjoy it.',
  },
  continueBtn: { te: 'ప్రారంభించండి', en: 'Continue', kn: 'ಮುಂದುವರಿಸಿ' },

  appTitle: { te: 'నామ నిధి', en: 'Nāma Nidhi', kn: 'ನಾಮ ನಿಧಿ' },
  appTagline: { te: 'నామాల్లో దాగిన రత్నాలు', en: 'Gems hidden in names', kn: 'ಹೆಸರುಗಳಲ್ಲಿ ಅಡಗಿರುವ ರತ್ನಗಳು' },
  nameGatePrompt: { te: 'ఆడటానికి మీ పేరు లేదా ముద్దుపేరు రాయండి', en: 'Enter your name or nickname to play', kn: 'ಆಡಲು ನಿಮ್ಮ ಹೆಸರು ಅಥವಾ ಅಡ್ಡಹೆಸರನ್ನು ಬರೆಯಿರಿ' },
  namePlaceholder: { te: 'మీ పేరు', en: 'Your name', kn: 'ನಿಮ್ಮ ಹೆಸರು' },
  beginBtn: { te: 'ప్రారంభించండి', en: 'Start', kn: 'ಪ್ರಾರಂಭಿಸಿ' },
  resumeNoticeText: {
    te: (name) => `"${name}" పేరుతో ఇప్పటికే ఆట చరిత్ర ఉంది. ఇది మీరే గతంలో వాడిన పేరైతే పర్వాలేదు — కానీ వేరే వ్యక్తి వాడిన పేరైతే, మీ స్కోర్లు వారి స్కోర్లతో కలిసిపోతాయి.`,
    en: (name) => `"${name}" already has play history. If this is your own name from before, that's fine - but if it belongs to someone else, your scores will merge with theirs.`,
    kn: (name) => `"${name}" ಎಂಬ ಹೆಸರಿಗೆ ಈಗಾಗಲೇ ಆಟದ ಇತಿಹಾಸ ಇದೆ. ಇದು ಹಿಂದೆ ನೀವೇ ಬಳಸಿದ ಹೆಸರಾಗಿದ್ದರೆ ಪರವಾಗಿಲ್ಲ — ಆದರೆ ಇದು ಬೇರೊಬ್ಬರ ಹೆಸರಾಗಿದ್ದರೆ, ನಿಮ್ಮ ಸ್ಕೋರ್‌ಗಳು ಅವರ ಸ್ಕೋರ್‌ಗಳೊಂದಿಗೆ ಸೇರಿಕೊಳ್ಳುತ್ತವೆ.`,
  },
  resumeConfirmBtn: { te: 'ఇది నేనే, కొనసాగించు', en: "It's me, continue", kn: 'ಇದು ನಾನೇ, ಮುಂದುವರಿಸಿ' },
  resumeCancelBtn: { te: 'వెనక్కి, పేరు మార్చాలి', en: 'Go back, change name', kn: 'ಹಿಂದಕ್ಕೆ, ಹೆಸರು ಬದಲಿಸಿ' },

  languageLabel: { te: 'భాష', en: 'Language', kn: 'ಭಾಷೆ' },
  languageTelugu: { te: 'తెలుగు', en: 'తెలుగు', kn: 'తెలుగు' },
  languageEnglish: { te: 'English', en: 'English', kn: 'English' },
  languageKannada: { te: 'ಕನ್ನಡ', en: 'ಕನ್ನಡ', kn: 'ಕನ್ನಡ' },
  languageNote: {
    te: 'ఆంగ్ల విధానంలో స్కోర్లు ఈ పరికరంలో మాత్రమే విడిగా భద్రపరచబడతాయి.',
    en: 'Scores in English mode are kept separately, only on this device.',
    kn: 'ಕನ್ನಡ ವಿಧಾನದಲ್ಲಿ ಸ್ಕೋರ್‌ಗಳು ಈ ಸಾಧನದಲ್ಲಿ ಮಾತ್ರ ಪ್ರತ್ಯೇಕವಾಗಿ ಉಳಿಸಲ್ಪಡುತ್ತವೆ.',
  },

  chooseModePrompt: { te: 'మీకు నచ్చిన విధానాన్ని ఎంచుకోండి', en: 'Choose how you would like to play', kn: 'ನಿಮಗೆ ಇಷ್ಟವಾದ ವಿಧಾನವನ್ನು ಆಯ್ಕೆಮಾಡಿ' },
  namaGuptaNidhiTitle: { te: 'నామ గుప్త నిధి', en: 'Nāma Gupta Nidhi', kn: 'ನಾಮ ಗುಪ್ತ ನಿಧಿ' },
  namaGuptaNidhiSub: { te: 'పజిల్ ఆడండి, స్తోత్రాలను పరీక్షించుకోండి', en: 'Play word puzzles, test your stotram recall', kn: 'ಪದ ಪಜಲ್ ಆಡಿ, ಸ್ತೋತ್ರಗಳ ನೆನಪನ್ನು ಪರೀಕ್ಷಿಸಿಕೊಳ್ಳಿ' },
  likhitaJapamTitle: { te: 'లిఖిత జపం', en: 'Likhita Japam', kn: 'ಲಿಖಿತ ಜಪ' },
  likhitaJapamSub: { te: 'నామాన్ని ప్రశాంతంగా రాయండి', en: 'Write a name calmly, one letter at a time', kn: 'ಹೆಸರನ್ನು ಶಾಂತವಾಗಿ, ಒಂದೊಂದೇ ಅಕ್ಷರ ಬರೆಯಿರಿ' },
  chooseSubModePrompt: { te: 'ఏ పజిల్ ఆడాలనుకుంటున్నారు?', en: 'Which puzzle would you like to play?', kn: 'ಯಾವ ಪಜಲ್ ಆಡಬಯಸುತ್ತೀರಿ?' },
  generalModeTitle: { te: 'పురాణాలు', en: 'Puranas', kn: 'ಪುರಾಣಗಳು' },
  generalModeSub: { te: 'అన్ని నామాల నుండి కలగలిపిన పజిల్', en: 'A mixed puzzle drawn from all names', kn: 'ಎಲ್ಲಾ ಹೆಸರುಗಳಿಂದ ಆಯ್ದ ಮಿಶ್ರ ಪಜಲ್' },
  stotraParikshaTitle: { te: 'స్తోత్ర పరీక్ష', en: 'Stotra Pariksha', kn: 'ಸ್ತೋತ್ರ ಪರೀಕ್ಷೆ' },
  stotraParikshaSub: { te: 'మీ అవగాహనను పరీక్షించుకోండి', en: 'Test how well you know a stotram', kn: 'ಒಂದು ಸ್ತೋತ್ರ ನಿಮಗೆ ಎಷ್ಟು ಗೊತ್ತಿದೆ ಎಂದು ಪರೀಕ್ಷಿಸಿಕೊಳ್ಳಿ' },
  scoreboardBtn: { te: 'స్కోరు బోర్డు', en: 'Scoreboard', kn: 'ಸ್ಕೋರ್ ಬೋರ್ಡ್' },
  aboutBtn: { te: 'ఈ యాప్ గురించి', en: 'About this app', kn: 'ಈ ಆ್ಯಪ್ ಬಗ್ಗೆ' },

  puzzleInstructions: {
    te: 'కింద సూచనల్లో ఉన్న నామాలను అక్షరాల్లో వేలితో గీసి కనుగొనండి',
    en: 'Find the names listed below by tracing them in the grid with your finger',
    kn: 'ಕೆಳಗೆ ಪಟ್ಟಿ ಮಾಡಿರುವ ಹೆಸರುಗಳನ್ನು ಗ್ರಿಡ್‌ನಲ್ಲಿ ಬೆರಳಿನಿಂದ ಗುರುತಿಸಿ ಹುಡುಕಿ',
  },
  newPuzzleBtn: { te: 'కొత్త పజిల్', en: 'New puzzle', kn: 'ಹೊಸ ಪಜಲ್' },
  showAnswerBtn: { te: 'సమాధానం చూపు', en: 'Show answer', kn: 'ಉತ್ತರ ತೋರಿಸಿ' },
  hintsTitle: { te: 'సూచనలు', en: 'Hints', kn: 'ಸೂಚನೆಗಳು' },
  continueLevelBtn: { te: 'కొనసాగించు', en: 'Continue', kn: 'ಮುಂದುವರಿಸಿ' },

  flagHintExplainer: {
    te: '🚩 ఏదైనా పదం లేదా దాని అర్థం సరిగ్గా లేదని అనిపిస్తే, మాకు తెలియజేయడానికి పక్కన ఉన్న జెండా గుర్తును నొక్కండి.',
    en: '🚩 If a word or its meaning looks off, tap the flag next to it to let us know.',
    kn: '🚩 ಒಂದು ಪದ ಅಥವಾ ಅದರ ಅರ್ಥ ಸರಿಯಿಲ್ಲ ಎಂದು ಅನಿಸಿದರೆ, ನಮಗೆ ತಿಳಿಸಲು ಪಕ್ಕದಲ್ಲಿರುವ ಧ್ವಜ ಚಿಹ್ನೆಯನ್ನು ಒತ್ತಿ.',
  },
  flagBtnTitle: { te: 'ఈ పదం సరిగ్గా లేదని తెలియజేయండి', en: 'Flag this word/meaning as off', kn: 'ಈ ಪದ/ಅರ್ಥ ಸರಿಯಿಲ್ಲ ಎಂದು ತಿಳಿಸಿ' },
  flaggedConfirm: { te: 'తెలియజేయబడింది', en: 'Flagged', kn: 'ತಿಳಿಸಲಾಗಿದೆ' },
  dismissFlagBtn: { te: 'పరిష్కరించబడింది', en: 'Resolved', kn: 'ಪರಿಹರಿಸಲಾಗಿದೆ' },
  flaggedQuestionsTitle: { te: 'తెలియజేసిన పదాలు', en: 'Flagged questions', kn: 'ತಿಳಿಸಿದ ಪದಗಳು' },
  noFlaggedEntries: { te: 'ఇంకా ఏమీ తెలియజేయలేదు.', en: 'Nothing flagged yet.', kn: 'ಇನ್ನೂ ಏನನ್ನೂ ತಿಳಿಸಿಲ್ಲ.' },
  colWord: { te: 'పదం', en: 'Word', kn: 'ಪದ' },
  colMeaning: { te: 'అర్థం', en: 'Meaning', kn: 'ಅರ್ಥ' },
  colSource: { te: 'ఎక్కడ నుండి', en: 'From', kn: 'ಎಲ್ಲಿಂದ' },
  colFlaggedBy: { te: 'ఎవరు తెలియజేశారు', en: 'Flagged by', kn: 'ಯಾರು ತಿಳಿಸಿದರು' },
  colFlaggedAt: { te: 'ఎప్పుడు', en: 'When', kn: 'ಯಾವಾಗ' },
  sourceGeneral: { te: 'పురాణాలు', en: 'Puranas', kn: 'ಪುರಾಣಗಳು' },

  congratulations: { te: 'అభినందనలు!', en: 'Well done!', kn: 'ಅಭಿನಂದನೆಗಳು!' },
  allFoundLevel: { te: 'అన్ని నామాలు దొరికాయి.', en: 'You found every name.', kn: 'ಎಲ್ಲಾ ಹೆಸರುಗಳನ್ನೂ ಕಂಡುಹಿಡಿದಿದ್ದೀರಿ.' },

  poolExhaustedTitle: { te: 'అన్ని నామాలు చాలాసార్లు వచ్చాయి!', en: "You've seen every name here!", kn: 'ಇಲ್ಲಿನ ಎಲ್ಲಾ ಹೆಸರುಗಳನ್ನೂ ಹಲವು ಬಾರಿ ನೋಡಿದ್ದೀರಿ!' },
  poolExhaustedGeneralMessage: {
    te: 'ఈ విభాగంలోని అన్ని నామాలు ఇప్పటికే చాలాసార్లు కనిపించాయి. కొంచెం విరామం తర్వాత మళ్ళీ రండి, లేదా స్తోత్ర పరీక్ష ప్రయత్నించండి.',
    en: "You've already been asked every name in this pool many times over. Take a little break and come back later, or try Stotra Pariksha for now.",
    kn: 'ಈ ವಿಭಾಗದಲ್ಲಿನ ಎಲ್ಲಾ ಹೆಸರುಗಳನ್ನೂ ನಿಮಗೆ ಈಗಾಗಲೇ ಹಲವು ಬಾರಿ ಕೇಳಲಾಗಿದೆ. ಸ್ವಲ್ಪ ವಿರಾಮ ತೆಗೆದುಕೊಂಡು ನಂತರ ಬನ್ನಿ, ಅಥವಾ ಸದ್ಯಕ್ಕೆ ಸ್ತೋತ್ರ ಪರೀಕ್ಷೆ ಪ್ರಯತ್ನಿಸಿ.',
  },
  poolExhaustedStotramMessage: {
    te: 'ఈ స్తోత్రంలోని అన్ని నామాలు ఇప్పటికే చాలాసార్లు కనిపించాయి. వేరే స్తోత్రం ఎంచుకోండి, లేదా పురాణాలు ప్రయత్నించండి.',
    en: "You've already been asked every name in this stotram many times over. Choose a different stotram, or try Puranas for now.",
    kn: 'ಈ ಸ್ತೋತ್ರದಲ್ಲಿನ ಎಲ್ಲಾ ಹೆಸರುಗಳನ್ನೂ ನಿಮಗೆ ಈಗಾಗಲೇ ಹಲವು ಬಾರಿ ಕೇಳಲಾಗಿದೆ. ಬೇರೆ ಸ್ತೋತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ, ಅಥವಾ ಸದ್ಯಕ್ಕೆ ಪುರಾಣಗಳು ಪ್ರಯತ್ನಿಸಿ.',
  },
  poolExhaustedSwitchToStotra: { te: 'స్తోత్ర పరీక్షకు వెళ్ళండి', en: 'Go to Stotra Pariksha', kn: 'ಸ್ತೋತ್ರ ಪರೀಕ್ಷೆಗೆ ಹೋಗಿ' },
  poolExhaustedSwitchToPuranas: { te: 'పురాణాలకు వెళ్ళండి', en: 'Go to Puranas', kn: 'ಪುರಾಣಗಳಿಗೆ ಹೋಗಿ' },

  soonBadge: { te: 'త్వరలో', en: 'Soon', kn: 'ಶೀಘ್ರದಲ್ಲಿ' },
  soonSub: { te: 'త్వరలో వస్తుంది', en: 'Coming soon', kn: 'ಶೀಘ್ರದಲ್ಲಿ ಬರಲಿದೆ' },
  playableBadge: { te: 'ఆడవచ్చు', en: 'Play', kn: 'ಆಡಿ' },
  stotramCardSub: {
    te: (n) => `మొత్తం ${n} పేర్లు · గ్రిడ్ సైజు, ప్రశ్నల సంఖ్య ప్రతిసారి మారుతుంది`,
    en: (n) => `${n} names total · grid size and question count change every round`,
    kn: (n) => `ಒಟ್ಟು ${n} ಹೆಸರುಗಳು · ಗ್ರಿಡ್ ಗಾತ್ರ ಮತ್ತು ಪ್ರಶ್ನೆಗಳ ಸಂಖ್ಯೆ ಪ್ರತಿ ಸುತ್ತಿನಲ್ಲಿ ಬದಲಾಗುತ್ತದೆ`,
  },
  stotramFoundAll: {
    te: (title) => `${title}లోని అన్ని నామాలను మీరు కనుగొన్నారు.`,
    en: (title) => `You found every name in ${title}.`,
    kn: (title) => `${title}ನಲ್ಲಿನ ಎಲ್ಲಾ ಹೆಸರುಗಳನ್ನೂ ನೀವು ಕಂಡುಹಿಡಿದಿದ್ದೀರಿ.`,
  },
  stotramAboutLabel: {
    te: (title) => `${title} గురించి:`,
    en: (title) => `About ${title}:`,
    kn: (title) => `${title} ಬಗ್ಗೆ:`,
  },
  playAgainBtn: { te: 'మళ్ళీ ఆడండి', en: 'Play again', kn: 'ಮತ್ತೆ ಆಡಿ' },
  finishBtn: { te: 'ముగించు', en: 'Finish', kn: 'ಮುಗಿಸಿ' },

  japamPickerTitle: { te: 'ఏ నామాన్ని రాద్దాం?', en: 'Which name shall we write?', kn: 'ಯಾವ ಹೆಸರನ್ನು ಬರೆಯೋಣ?' },
  japamCustomPrompt: { te: 'లేదా మీకు నచ్చిన నామాన్ని రాయండి', en: 'Or write any name you like', kn: 'ಅಥವಾ ನಿಮಗೆ ಇಷ್ಟವಾದ ಹೆಸರನ್ನು ಬರೆಯಿರಿ' },
  japamCustomPlaceholder: { te: 'తెలుగులో లేదా English లో రాయండి', en: 'Type the name you want to trace', kn: 'ಬರೆಯಬೇಕಾದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ' },
  suggestedBadge: { te: 'సూచించినది', en: 'Suggested', kn: 'ಸೂಚಿಸಿದ್ದು' },

  likhitaJapamHeading: { te: 'లిఖిత జపం', en: 'Likhita Japam', kn: 'ಲಿಖಿತ ಜಪ' },
  japamTraceInstructions: {
    te: 'చుక్కలను అనుసరిస్తూ వేలితో గీయండి',
    en: 'Trace the dots with your finger',
    kn: 'ಚುಕ್ಕೆಗಳನ್ನು ಅನುಸರಿಸುತ್ತಾ ಬೆರಳಿನಿಂದ ಬರೆಯಿರಿ',
  },
  japamLandscapeHint: {
    te: '📱 ఫోన్‌ను అడ్డంగా (ల్యాండ్‌స్కేప్) తిప్పితే రాయడం మరింత సులభంగా ఉంటుంది',
    en: '📱 Turning your phone sideways (landscape) makes writing easier',
    kn: '📱 ಫೋನ್ ಅಡ್ಡವಾಗಿ (ಲ್ಯಾಂಡ್‌ಸ್ಕೇಪ್) ತಿರುಗಿಸಿದರೆ ಬರೆಯುವುದು ಇನ್ನಷ್ಟು ಸುಲಭ',
  },
  japamSessionCount: { te: (n) => `ఈ సెషన్‌లో: ${n} సార్లు`, en: (n) => `This session: ${n} times`, kn: (n) => `ಈ ಸೆಷನ್‌ನಲ್ಲಿ: ${n} ಬಾರಿ` },
  japamThisSession: { te: 'ఈ సెషన్‌లో', en: 'This session', kn: 'ಈ ಸೆಷನ್‌ನಲ್ಲಿ' },
  japamTimes: { te: (n) => `${n} సార్లు`, en: (n) => `${n} times`, kn: (n) => `${n} ಬಾರಿ` },
  goHomeBtn: { te: 'హోమ్‌కు వెళ్ళండి', en: 'Go to Home', kn: 'ಹೋಮ್‌ಗೆ ಹೋಗಿ' },
  japamComplete: { te: 'లిఖిత జపం పూర్తయింది.', en: 'Likhita Japam complete.', kn: 'ಲಿಖಿತ ಜಪ ಪೂರ್ಣಗೊಂಡಿದೆ.' },

  scoreboardTitle: { te: 'స్కోరు బోర్డు', en: 'Scoreboard', kn: 'ಸ್ಕೋರ್ ಬೋರ್ಡ್' },
  scoreboardTagline: { te: 'మన బృందం సాధించిన ప్రగతి', en: "Our network's progress", kn: 'ನಮ್ಮ ಬಳಗದ ಪ್ರಗತಿ' },
  puzzleBoardTitle: { te: 'నామ గుప్త నిధి స్కోరు బోర్డు', en: 'Nāma Gupta Nidhi scoreboard', kn: 'ನಾಮ ಗುಪ್ತ ನಿಧಿ ಸ್ಕೋರ್ ಬೋರ್ಡ್' },
  gemLegend: {
    te: (pearl, gem, diamond) => `${pearl} ముత్యం = సులభం, ${gem} రత్నం = మధ్యమం, ${diamond} వజ్రం = కష్టం — మీరే స్వయంగా కనుగొన్న పదాలకు మాత్రమే లభిస్తాయి, "సమాధానం చూపు" వాడితే రావు.`,
    en: (pearl, gem, diamond) => `${pearl} Pearl = easy, ${gem} Gem = medium, ${diamond} Diamond = difficult — earned only for words you find yourself, not ones revealed with "Show answer."`,
    kn: (pearl, gem, diamond) => `${pearl} ಮುತ್ತು = ಸುಲಭ, ${gem} ರತ್ನ = ಮಧ್ಯಮ, ${diamond} ವಜ್ರ = ಕಷ್ಟ — ನೀವೇ ಸ್ವತಃ ಕಂಡುಹಿಡಿದ ಪದಗಳಿಗೆ ಮಾತ್ರ ಸಿಗುತ್ತವೆ, "ಉತ್ತರ ತೋರಿಸಿ" ಬಳಸಿದರೆ ಸಿಗುವುದಿಲ್ಲ.`,
  },
  japamBoardTitle: { te: 'లిఖిత జప స్కోరు బోర్డు', en: 'Likhita Japam scoreboard', kn: 'ಲಿಖಿತ ಜಪ ಸ್ಕೋರ್ ಬೋರ್ಡ್' },
  loading: { te: 'లోడ్ అవుతోంది...', en: 'Loading...', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...' },
  colName: { te: 'పేరు', en: 'Name', kn: 'ಹೆಸರು' },
  colPearls: { te: 'ముత్యాలు', en: 'Pearls', kn: 'ಮುತ್ತುಗಳು' },
  colGems: { te: 'రత్నాలు', en: 'Gems', kn: 'ರತ್ನಗಳು' },
  colDiamonds: { te: 'వజ్రాలు', en: 'Diamonds', kn: 'ವಜ್ರಗಳು' },
  colPuzzlesCompleted: { te: 'పూర్తయిన పజిల్స్', en: 'Puzzles completed', kn: 'ಪೂರ್ಣಗೊಂಡ ಪಜಲ್‌ಗಳು' },
  colTotalJapamCount: { te: 'మొత్తం జపసంఖ్య', en: 'Total japam count', kn: 'ಒಟ್ಟು ಜಪ ಸಂಖ್ಯೆ' },
  colDailyAverage: { te: 'రోజువారీ సగటు', en: 'Daily average', kn: 'ದೈನಂದಿನ ಸರಾಸರಿ' },
  noScoresYet: { te: 'ఇంకా స్కోర్లు లేవు.', en: 'No scores yet.', kn: 'ಇನ್ನೂ ಸ್ಕೋರ್‌ಗಳಿಲ್ಲ.' },
  showMoreLink: { te: 'మరిన్ని చూపు →', en: 'Show more →', kn: 'ಇನ್ನಷ್ಟು ತೋರಿಸಿ →' },
  showLessLink: { te: '← తక్కువగా చూపు', en: 'Show less ←', kn: '← ಕಡಿಮೆ ತೋರಿಸಿ' },
  localOnlyNote: {
    te: 'ఇది ఈ పరికరంలో మాత్రమే భద్రపరచబడింది.',
    en: 'This is saved only on this device.',
    kn: 'ಇದು ಈ ಸಾಧನದಲ್ಲಿ ಮಾತ್ರ ಉಳಿಸಲ್ಪಟ್ಟಿದೆ.',
  },
  localPuzzlesCompleted: { te: (n) => `పూర్తయిన పజిల్స్: ${n}`, en: (n) => `Puzzles completed: ${n}`, kn: (n) => `ಪೂರ್ಣಗೊಂಡ ಪಜಲ್‌ಗಳು: ${n}` },
  localTotalJapam: { te: (n) => `మొత్తం జపసంఖ్య: ${n}`, en: (n) => `Total japam count: ${n}`, kn: (n) => `ಒಟ್ಟು ಜಪ ಸಂಖ್ಯೆ: ${n}` },
  localTodayJapam: { te: (n) => `ఈ రోజు: ${n}`, en: (n) => `Today: ${n}`, kn: (n) => `ಇಂದು: ${n}` },
  localAverageJapam: { te: (n) => `రోజువారీ సగటు: ${n}`, en: (n) => `Daily average: ${n}`, kn: (n) => `ದೈನಂದಿನ ಸರಾಸರಿ: ${n}` },

  gemEasy: { te: 'ముత్యం', en: 'Pearl', kn: 'ಮುತ್ತು' },
  gemMedium: { te: 'రత్నం', en: 'Gem', kn: 'ರತ್ನ' },
  gemDifficult: { te: 'వజ్రం', en: 'Diamond', kn: 'ವಜ್ರ' },

  syllableCount: { te: (n) => `(${n})`, en: (n) => `(${n})`, kn: (n) => `(${n})` },
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
