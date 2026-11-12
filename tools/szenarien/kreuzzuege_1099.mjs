/**
 * Die Kreuzfahrerstaaten - 1099
 *
 * Stand: Juli 1099, unmittelbar nach der Einnahme Jerusalems durch das
 * Heer des Ersten Kreuzzugs.
 *
 * Die Lage ist bewusst so unausgewogen gelassen, wie sie war. Die drei
 * Kreuzfahrerstaaten sind winzig, liegen weit voneinander entfernt und
 * grenzen an Gegner, die sie um ein Vielfaches übertreffen. Dass sie
 * trotzdem knapp zwei Jahrhunderte hielten, lag daran, dass ihre Gegner
 * zerstritten waren - die Grossseldschuken lagen im Thronstreit, die
 * Fatimiden waren Schiiten und die Seldschuken Sunniten. Wer hier mit den
 * Kreuzfahrern spielt, muss genau diese Risse nutzen.
 *
 * Zwei Ungenauigkeiten sind bewusst: Oultrejordain - hier Transjordanien -
 * fiel erst 1115 an Jerusalem, und die Grafschaft Tripolis entstand erst
 * 1102. Sie steht hier schon bei Antiochia, weil ein Fürstentum aus einem
 * einzigen Gebiet auf dieser groben Karte nach zwei Runden verschwunden
 * wäre - und die Küste tatsächlich binnen drei Jahren fiel.
 */

export default {
  id: 'kreuzzuege_1099',
  name: 'Die Kreuzfahrerstaaten - 1099',
  description: 'Jerusalem ist gefallen. Drei winzige Kreuzfahrerstaaten liegen '
    + 'verstreut zwischen Fatimiden und Seldschuken - und halten sich nur, '
    + 'solange ihre Gegner einander bekämpfen.',
  mapId: 'vorderasien',
  startYear: 1099,
  endYear: 1300,
  monthsPerTurn: 12,

  laender: [
    {
      id: 'jerusalem',
      name: 'Königreich Jerusalem',
      color: '#e8e2d2',
      emblem: 'J',
      flag: 'kz_jerusalem',
      ruler: 'Gottfried von Bouillon',
      government: 'monarchy',
      personality: 'defensive',
      hauptstadt: 'Jerusalem',
      gebiete: ['Jerusalem', 'Hauran', 'Transjordanien'],
      gold: 700,
      stability: 48,
      politicalPower: 28,
      tech: { military: 3, economy: 1, administration: 1, logistics: 2, defense: 3 },
      heer: { hauptstadt: 13, schwerpunkte: { Hauran: 5, Transjordanien: 4 } },
      traits: { military: 1.3, economy: 0.85, defense: 1.35, research: 0.95, trade: 1 },
      description: 'Ein Heer aus dem Westen, das eine Stadt hält und sonst nichts. '
        + 'Schwere Reiterei und Burgenbau gegen eine zehnfache Übermacht.',
    },
    {
      id: 'antiochia',
      name: 'Fürstentum Antiochia',
      color: '#c0392b',
      emblem: 'A',
      flag: 'kz_antiochia',
      ruler: 'Bohemund von Tarent',
      government: 'monarchy',
      personality: 'expansionist',
      hauptstadt: 'Homs',
      gebiete: ['Homs', 'Tripolis'],
      gold: 650,
      stability: 45,
      politicalPower: 25,
      tech: { military: 3, economy: 1, administration: 1, logistics: 2, defense: 2 },
      heer: { hauptstadt: 12, schwerpunkte: { Tripolis: 6 } },
      traits: { military: 1.35, economy: 0.9, defense: 1.15, research: 0.95, trade: 1.1 },
      description: 'Normannen aus Süditalien, die sich einen eigenen Staat genommen '
        + 'haben - gegen den Willen des Kaisers in Konstantinopel.',
    },
    {
      id: 'edessa',
      name: 'Grafschaft Edessa',
      color: '#8e44ad',
      emblem: 'E',
      flag: 'kz_edessa',
      ruler: 'Balduin von Boulogne',
      government: 'monarchy',
      personality: 'opportunist',
      hauptstadt: 'Raqqa',
      gebiete: ['Raqqa', 'Amida'],
      gold: 600,
      stability: 42,
      politicalPower: 22,
      tech: { military: 2, economy: 1, administration: 1, logistics: 2, defense: 2 },
      heer: { hauptstadt: 8, schwerpunkte: { Amida: 3 } },
      traits: { military: 1.2, economy: 0.95, defense: 1.1, research: 0.95, trade: 1.05 },
      description: 'Der am weitesten vorgeschobene Kreuzfahrerstaat, jenseits des '
        + 'Euphrat und von den anderen abgeschnitten. Stützt sich auf armenische Christen.',
    },
    {
      id: 'fatimiden',
      name: 'Fatimidenkalifat',
      color: '#1f7a4d',
      emblem: 'F',
      flag: 'fatimiden_weiss',
      ruler: 'al-Afdal Schahanschah',
      government: 'monarchy',
      personality: 'defensive',
      hauptstadt: 'Kairo',
      gebiete: ['Kairo', 'Nildelta', 'Oberägypten', 'Nordarabien', 'Nadschran'],
      gold: 1400,
      stability: 60,
      politicalPower: 34,
      tech: { military: 2, economy: 3, administration: 3, logistics: 2, defense: 2 },
      heer: { hauptstadt: 16, schwerpunkte: { Nildelta: 7 } },
      traits: { military: 1.05, economy: 1.3, defense: 1.1, research: 1.15, trade: 1.3 },
      description: 'Schiitische Kalifen in Kairo, reich aus dem Nilhandel. Haben '
        + 'Jerusalem gerade erst an die Kreuzfahrer verloren und wollen es zurück.',
    },
    {
      id: 'rum_seldschuken',
      name: 'Sultanat von Rum',
      color: '#41b0c9',
      emblem: 'R',
      flag: 'seldschuken_bogen',
      ruler: 'Kilidsch Arslan I.',
      government: 'monarchy',
      personality: 'aggressive',
      hauptstadt: 'Ikonion',
      gebiete: ['Ikonion', 'Ankyra', 'Kappadokien', 'Tyana'],
      gold: 750,
      stability: 50,
      politicalPower: 26,
      tech: { military: 3, economy: 1, administration: 1, logistics: 3, defense: 1 },
      heer: { hauptstadt: 15, schwerpunkte: { Ankyra: 8, Kappadokien: 5 } },
      traits: { military: 1.3, economy: 0.95, defense: 0.95, research: 0.95, trade: 1 },
      description: 'Turkmenische Reiterbogenschützen in Anatolien. Haben das '
        + 'Kreuzfahrerheer durchziehen lassen müssen und wollen den Weg schliessen.',
    },
    {
      id: 'danischmenden',
      name: 'Danischmenden',
      color: '#d98c2b',
      emblem: 'D',
      flag: 'danischmenden',
      ruler: 'Gazi Gümüschtigin',
      government: 'monarchy',
      personality: 'opportunist',
      hauptstadt: 'Kaisareia',
      gebiete: ['Kaisareia', 'Erzindschan', 'Erzurum'],
      gold: 600,
      stability: 47,
      politicalPower: 20,
      tech: { military: 2, economy: 1, administration: 1, logistics: 2, defense: 2 },
      heer: { hauptstadt: 11, schwerpunkte: { Erzurum: 6 } },
      traits: { military: 1.2, economy: 0.95, defense: 1.05, research: 0.95, trade: 1 },
      description: 'Turkmenisches Emirat in Ostanatolien, Rivale der Rum-Seldschuken '
        + 'um dieselben Weiden und dieselben Städte.',
    },
    {
      id: 'byzanz',
      name: 'Byzantinisches Reich',
      color: '#9b59b6',
      emblem: 'B',
      flag: 'byzanz_tetragramm',
      ruler: 'Alexios I. Komnenos',
      government: 'monarchy',
      personality: 'opportunist',
      hauptstadt: 'Nikomedia',
      gebiete: ['Nikomedia', 'Smyrna', 'Laodikeia', 'Attika', 'Athos',
        'Ionische Inseln', 'Zypern', 'Trapezunt', 'Sofia', 'Warna'],
      gold: 1600,
      stability: 58,
      politicalPower: 36,
      tech: { military: 2, economy: 3, administration: 3, logistics: 2, defense: 3 },
      heer: { hauptstadt: 14, schwerpunkte: { Smyrna: 6, Sofia: 5 } },
      traits: { military: 1.05, economy: 1.25, defense: 1.3, research: 1.2, trade: 1.25 },
      description: 'Hat den Kreuzzug gerufen und bereut es. Will die anatolischen '
        + 'Städte zurück und betrachtet Antiochia als sein Eigentum.',
    },
    {
      id: 'grossseldschuken',
      name: 'Großseldschukisches Reich',
      color: '#2e86c1',
      emblem: 'S',
      flag: 'seldschuken_bogen',
      ruler: 'Berkyaruq',
      government: 'monarchy',
      personality: 'balanced',
      hauptstadt: 'Isfahan',
      gebiete: ['Isfahan', 'Bagdad', 'Rayy', 'Fars', 'Chusistan', 'Luristan',
        'Nadschaf', 'Kufa', 'Wasit', 'Schahrizor', 'Mossul', 'Mardin', 'Semnan',
        'Gilan', 'Ardabil', 'Gandscha', 'Schirwan', 'Armenien', 'Chorasan',
        'Gurgan', 'Merw', 'Nisa', 'Herat', 'Balch', 'Sistan', 'Hormus', 'Damaskus'],
      gold: 2200,
      stability: 44,
      politicalPower: 40,
      tech: { military: 3, economy: 2, administration: 3, logistics: 3, defense: 2 },
      heer: { hauptstadt: 18, schwerpunkte: { Bagdad: 12, Damaskus: 8, Mossul: 6, Chorasan: 6 } },
      traits: { military: 1.25, economy: 1.1, defense: 1, research: 1.1, trade: 1.15 },
      description: 'Das grösste Reich der Region - und das zerrissenste. Seit dem Tod '
        + 'Malik Schahs streiten die Brüder um den Thron, und jeder Emir handelt für sich.',
    },
    {
      id: 'georgien',
      name: 'Königreich Georgien',
      color: '#c0c7cf',
      emblem: 'G',
      flag: 'georgien_kreuz',
      ruler: 'David IV. der Erbauer',
      government: 'monarchy',
      personality: 'defensive',
      hauptstadt: 'Georgien',
      gebiete: ['Georgien', 'Kars'],
      gold: 550,
      stability: 52,
      politicalPower: 22,
      tech: { military: 2, economy: 1, administration: 2, logistics: 1, defense: 3 },
      heer: { hauptstadt: 8, schwerpunkte: { Kars: 4 } },
      traits: { military: 1.15, economy: 0.95, defense: 1.3, research: 1.05, trade: 1 },
      description: 'Christliches Königreich im Kaukasus unter einem jungen König, '
        + 'der sein Land gerade erst aus seldschukischer Abhängigkeit löst.',
    },
    {
      id: 'ghaznawiden',
      name: 'Ghaznawiden',
      color: '#b8860b',
      emblem: 'Gh',
      flag: 'ghaznawiden_schwert',
      ruler: 'Masʻud III.',
      government: 'monarchy',
      personality: 'balanced',
      hauptstadt: 'Ghazna',
      gebiete: ['Ghazna', 'Kabul', 'Peschawar', 'Indus', 'Pandschab',
        'Kandahar', 'Belutschistan'],
      gold: 900,
      stability: 54,
      politicalPower: 24,
      tech: { military: 2, economy: 2, administration: 2, logistics: 2, defense: 2 },
      heer: { hauptstadt: 11, schwerpunkte: { Pandschab: 6 } },
      traits: { military: 1.15, economy: 1.15, defense: 1.05, research: 1.05, trade: 1.2 },
      description: 'Reich geworden an den Plünderzügen nach Indien, inzwischen auf '
        + 'den Osten zurückgedrängt und von den Seldschuken abhängig.',
    },
    {
      id: 'karachaniden',
      name: 'Karachaniden',
      color: '#5d8aa8',
      emblem: 'K',
      flag: 'karachaniden_mond',
      ruler: 'Ahmad Arslan Chan',
      government: 'monarchy',
      personality: 'balanced',
      hauptstadt: 'Buchara',
      gebiete: ['Buchara', 'Taschkent', 'Ferghana', 'Termiz', 'Chuttal',
        'Badachschan', 'Talas', 'Amul', 'Chorasmien'],
      gold: 800,
      stability: 50,
      politicalPower: 22,
      tech: { military: 2, economy: 2, administration: 2, logistics: 3, defense: 1 },
      heer: { hauptstadt: 10, schwerpunkte: { Taschkent: 5 } },
      traits: { military: 1.15, economy: 1.1, defense: 1, research: 1.1, trade: 1.25 },
      description: 'Das erste türkische Reich, das den Islam annahm. Sitzt auf den '
        + 'Karawanenstädten der Seidenstrasse und zahlt den Seldschuken Tribut.',
    },
  ],

  beziehungen: [
    ['jerusalem', 'fatimiden', -85],
    ['jerusalem', 'grossseldschuken', -60],
    ['antiochia', 'byzanz', -55],
    ['antiochia', 'rum_seldschuken', -40],
    ['edessa', 'grossseldschuken', -55],
    ['jerusalem', 'antiochia', 45],
    ['jerusalem', 'edessa', 50],
    ['antiochia', 'edessa', 40],
    ['byzanz', 'rum_seldschuken', -75],
    ['byzanz', 'danischmenden', -40],
    ['byzanz', 'georgien', 45],
    ['fatimiden', 'grossseldschuken', -65],
    ['rum_seldschuken', 'danischmenden', -45],
    ['grossseldschuken', 'ghaznawiden', -25],
    ['grossseldschuken', 'karachaniden', 20],
    ['georgien', 'grossseldschuken', -50],
  ],
  buendnisse: [{
    id: 'kreuzfahrerstaaten',
    name: 'Die Kreuzfahrerstaaten',
    fuehrer: 'jerusalem',
    mitglieder: ['jerusalem', 'edessa', 'antiochia'],
  }],
  /* Nur zwei Kriege zum Start, und beide belegt: Das fatimidische Heer
     marschierte im August 1099 auf Jerusalem (Aschkelon), und Byzanz nahm
     im Windschatten des Kreuzzugs die anatolische Küste zurück. Antiochia
     und Rum standen sich 1099 nicht im Feld gegenüber - das Kreuzfahrer-
     heer war längst durchgezogen, und Bohemunds Gegner sass in Aleppo. */
  kriege: [
    [['jerusalem'], ['fatimiden']],
    [['byzanz'], ['rum_seldschuken']],
  ],

  events: ['mit_kreuzzug', 'mit_pest', 'mit_haeresie', 'mit_handelsweg',
    'mit_thronstreit', 'mit_burgenbau', 'mit_steppenreiter', 'mit_gelehrtenhaus',
    'mit_hungerjahr', 'harvest_failure', 'drought', 'succession_dispute',
    'epidemic_returns', 'mercenary_offer', 'tax_revolt', 'plague',
    'border_incident', 'resource_find', 'unrest_protest'],

  sieg: { gebiete: 46, hauptstaedte: 3 },
};
