/**
 * Welches Gebiet heisst wie - und wie hiess es in den Rohdaten.
 *
 * Diese Tabelle wird von zwei Werkzeugen gebraucht, und deshalb liegt sie
 * hier statt in einem davon:
 *
 *   - tools/gebietsnamen.mjs benennt die Gebiete der Karten damit um,
 *   - tools/karten.mjs rechnet damit zurueck, um die Gebiete wieder den
 *     Natural-Earth-Einheiten zuzuordnen.
 *
 * Das zweite ist der Grund fuer diese Datei. Beim ersten Versuch, die
 * Karten feiner neu zu erzeugen, verloren 92 von 211 Gebieten ihren
 * Umriss: Die Zuordnung sucht nach dem Namen, und der hiess inzwischen
 * "Picardie" statt "Hauts-de-France". Wer die Namen aendert, muss den Weg
 * zurueck offenhalten.
 *
 * Links steht immer der Name aus den Rohdaten, rechts der im Spiel.
 */

/** karte -> { rohdatenName: spielName } */
export const TABELLEN = {};

TABELLEN.europadetail = {
  /* --- Britische Inseln: Statistikkennungen zu Landschaften ------- */
  'North East': 'Northumberland',
  'North West': 'Lancashire',
  'Yorkshire and the Humber': 'Yorkshire',
  'East Midlands': 'Nottingham',
  'West Midlands': 'Birmingham',
  East: 'Ostanglien',
  'Greater London': 'London',
  'South East': 'Kent',
  'South West': 'Wessex',
  'East Wales': 'Ostwales',
  'West Wales and the Valleys': 'Westwales',
  'Highlands and Islands': 'Hochland',
  Eastern: 'Ostschottland',
  'North Eastern': 'Nordostschottland',
  'South Western': 'Südwestschottland',
  'Northern Ireland': 'Nordirland',
  Kilkenny: 'Kilkenny',
  Louth: 'Louth',
  Offaly: 'Offaly',

  /* --- Polen: 1914 zwischen drei Reichen geteilt ------------------ */
  'Greater Poland': 'Posen',
  'Lesser Poland': 'Westgalizien',
  'Lower Silesian': 'Niederschlesien',
  Silesian: 'Oberschlesien',
  Opole: 'Oppeln',
  'Kuyavian-Pomeranian': 'Kujawien',
  'West Pomeranian': 'Pommern',
  Pomeranian: 'Westpreußen',
  'Warmian-Masurian': 'Masuren',
  Masovian: 'Masowien',
  Podlachian: 'Podlachien',
  Lublin: 'Lublin',
  Lubusz: 'Lebus',
  Subcarpathian: 'Ostgalizien',
  Świętokrzyskie: 'Kielce',
  Łódź: 'Lodz',

  /* --- Russisches Reich: deutsche Namensformen -------------------- */
  'Kiev City': 'Kiew',
  Kharkiv: 'Charkow',
  Kherson: 'Cherson',
  "Dnipropetrovs'k": 'Jekaterinoslaw',
  Volyn: 'Wolhynien',
  Vitebsk: 'Witebsk',
  Mogilev: 'Mohilew',
  Gomel: 'Gomel',
  Brest: 'Brest-Litowsk',
  Sumy: 'Sumy',
  Chernivtsi: 'Bukowina',
  Transcarpathia: 'Karpatenrussland',
  Petersburg: 'St. Petersburg',
  "Astrakhan'": 'Astrachan',
  Orenburg: 'Orenburg',
  Penza: 'Pensa',
  Mordovia: 'Mordwinien',
  'Mariy-El': 'Mari',
  'Khanty-Mansiy': 'Jugra',
  Estonia: 'Estland',
  Latvia: 'Livland',
  Lithuania: 'Litauen',
  Moldova: 'Bessarabien',

  /* --- Finnland: 1914 russisches Großfürstentum ------------------- */
  'Central Finland': 'Mittelfinnland',
  'South Karelia': 'Karelien',
  'Tavastia Proper': 'Tawastland',
  Kainuu: 'Kajanaland',

  /* --- Böhmen, Mähren, Slowakei ---------------------------------- */
  Ústecký: 'Aussig',
  Plzeňský: 'Pilsen',
  Královéhradecký: 'Königgrätz',
  Moravskoslezský: 'Mährisch-Schlesien',
  Vysočina: 'Böhmisch-Mährische Höhe',
  Zlínský: 'Zlin',
  Bratislavský: 'Preßburg',
  Košický: 'Kaschau',
  Nitriansky: 'Neutra',

  /* --- Ungarn und Siebenbürgen ----------------------------------- */
  'Bács-Kiskun': 'Batschka',
  'Jász-Nagykun-Szolnok': 'Szolnok',
  Vas: 'Eisenburg',
  Eger: 'Erlau',
  Érd: 'Érd',
  Somogy: 'Somogy',
  Cluj: 'Klausenburg',
  Harghita: 'Szeklerland',
  Timis: 'Temeschwar',
  Prahova: 'Prahova',
  Vrancea: 'Vrancea',

  /* --- Balkan ---------------------------------------------------- */
  Istarska: 'Istrien',
  'Sisacko-Moslavacka': 'Sisak',
  'Brodsko-Posavska': 'Brod',
  'Central Bosnia': 'Mittelbosnien',
  Vlasenica: 'Vlasenica',
  Zlatiborski: 'Zlatibor',
  Nišavski: 'Niš',
  Macedonia: 'Makedonien',
  Albania: 'Albanien',
  Montenegro: 'Montenegro',
  Slovenia: 'Krain',
  Ruse: 'Rustschuk',
  Varna: 'Warna',
  Pernik: 'Pernik',
  Smolyan: 'Smoljan',

  /* --- Griechenland: aus der Umschrift ins Deutsche --------------- */
  Attiki: 'Attika',
  Peloponnisos: 'Peloponnes',
  'Ionioi Nisoi': 'Ionische Inseln',
  'Voreio Aigaio': 'Nordägäis',
  'Ayion Oros': 'Athos',

  /* --- Skandinavien ---------------------------------------------- */
  Hovedstaden: 'Kopenhagen',
  Sjaælland: 'Seeland',
  Syddanmark: 'Südjütland',
  Skåne: 'Schonen',
  Orebro: 'Örebro',
  Blekinge: 'Blekinge',
  Södermanland: 'Södermanland',
  Västernorrland: 'Ångermanland',
  Nordland: 'Nordland',
  Telemark: 'Telemark',
  Vestfold: 'Vestfold',
  Østfold: 'Østfold',
  Uppsala: 'Uppsala',

  /* --- Frankreich: die heutigen Regionen stammen von 2016. Benannt
     wird nach den historischen Landschaften, die 1914 jeder kannte. --- */
  'Hauts-de-France': 'Picardie',
  'Grand Est': 'Champagne',
  'Pays de la Loire': 'Anjou',
  'Centre-Val de Loire': 'Orléanais',
  'Bourgogne-Franche-Comté': 'Burgund',
  'Auvergne-Rhône-Alpes': 'Auvergne',
  'Nouvelle-Aquitaine': 'Aquitanien',
  Occitanie: 'Languedoc',
  'Île-de-France': 'Île-de-France',
  Normandie: 'Normandie',
  Bretagne: 'Bretagne',

  /* --- Spanien: deutsche Namensformen ----------------------------- */
  Aragón: 'Aragonien',
  Extremadura: 'Estremadura',
  Cantabria: 'Kantabrien',
  Asturias: 'Asturien',
  Murcia: 'Murcia',
  'La Rioja': 'La Rioja',
  Madrid: 'Madrid',

  /* --- Westeuropa ------------------------------------------------ */
  'Flemish Brabant': 'Brabant',
  'Walloon Brabant': 'Wallonisch-Brabant',
  Liege: 'Lüttich',
  Namur: 'Namur',
  Zeeland: 'Seeland (NL)',
  Limburg: 'Limburg',
  Gelderland: 'Geldern',
  Drenthe: 'Drenthe',
  Lucerne: 'Luzern',
  Neuchâtel: 'Neuenburg',
  Thurgau: 'Thurgau',
  Obwalden: 'Obwalden',
  Corse: 'Korsika',
  "Provence-Alpes-Côte-d'Azur": 'Provence',
  'Valle d\'Aosta': 'Aostatal',
  Sicily: 'Sizilien',
  Sardegna: 'Sardinien',
  Lombardia: 'Lombardei',
  Piemonte: 'Piemont',
  Toscana: 'Toskana',
  Apulia: 'Apulien',
  Calabria: 'Kalabrien',
  Campania: 'Kampanien',
  'Trentino-Alto Adige': 'Südtirol',
  'Friuli-Venezia Giulia': 'Friaul',
  'Emilia-Romagna': 'Emilia-Romagna',
  Lazio: 'Latium',
  Marche: 'Marken',
  Abruzzo: 'Abruzzen',
  Basilicata: 'Basilikata',
  Molise: 'Molise',
  Umbria: 'Umbrien',
  Veneto: 'Venetien',
  Liguria: 'Ligurien',
  'Islas Baleares': 'Balearen',
  Cataluña: 'Katalonien',
  'País Vasco': 'Baskenland',
  Andalucía: 'Andalusien',
  'Castilla y León': 'Altkastilien',
  'Castilla-La Mancha': 'Neukastilien',
  'Foral de Navarra': 'Navarra',
  Valenciana: 'Valencia',
  Galicia: 'Galicien (Spanien)',
  Azores: 'Azoren',
  Évora: 'Évora',
  Coimbra: 'Coimbra',

  /* --- Osmanisches Reich ----------------------------------------- */
  Çankiri: 'Çankırı',
  Erzincan: 'Erzincan',
  Kayseri: 'Kayseri',
  Manisa: 'Manisa',

  /* --- Offensichtlich falsch verortet ----------------------------
     "Bouvet Island" liegt im Südatlantik. Der Umriss sitzt hier im
     hohen Norden - ein Fehlgriff aus den Rohdaten. Benannt nach dem,
     wo er tatsächlich liegt. */
  'Bouvet Island': 'Finnmark',
};


TABELLEN.vorderasien = {
  /* Die Karte dient den Szenarien von 1071 und 1099. Die Namen stammen
     aus heutigen Provinzen - "UNDOF" ist eine Pufferzone der Vereinten
     Nationen, "F.C.T." ein pakistanisches Verwaltungskuerzel. Benannt
     wird nach den Staedten und Landschaften, um die damals gekaempft
     wurde. */
  'North Kazakhstan': 'Kiptschakensteppe',
  Qaraghandy: 'Steppe',
  Atyrau: 'Saksin',
  Zhambyl: 'Talas',
  Pernik: 'Sofia',
  Varna: 'Warna',
  Georgia: 'Georgien',
  Bukhoro: 'Buchara',
  'Ionioi Nisoi': 'Ionische Inseln',
  'Ayion Oros': 'Athos',
  Sakarya: 'Nikomedia',
  Çankiri: 'Ankyra',
  Yozgat: 'Kappadokien',
  Giresun: 'Trapezunt',
  Bingöl: 'Erzurum',
  Ardahan: 'Kars',
  Armenia: 'Armenien',
  Kəlbəcər: 'Gandscha',
  Kürdəmir: 'Schirwan',
  Tashauz: 'Chorasmien',
  Tashkent: 'Taschkent',
  Ferghana: 'Ferghana',
  Attiki: 'Attika',
  Manisa: 'Smyrna',
  Aksaray: 'Ikonion',
  Kayseri: 'Kaisareia',
  Erzincan: 'Erzindschan',
  Batman: 'Amida',
  Ardebil: 'Ardabil',
  Ahal: 'Nisa',
  Chardzhou: 'Amul',
  Surkhandarya: 'Termiz',
  Dushanbe: 'Chuttal',
  'Gorno-Badakhshan': 'Badachschan',
  Denizli: 'Laodikeia',
  Nigde: 'Tyana',
  Mardin: 'Mardin',
  Dihok: 'Mossul',
  Gilan: 'Gilan',
  Golestan: 'Gurgan',
  Mary: 'Merw',
  Kunar: 'Kabul',
  Cyprus: 'Zypern',
  'Homs (Hims)': 'Homs',
  'Ar Raqqah': 'Raqqa',
  'As-Sulaymaniyah': 'Schahrizor',
  Lorestan: 'Luristan',
  Tehran: 'Rayy',
  Semnan: 'Semnan',
  'South Khorasan': 'Chorasan',
  Baghlan: 'Balch',
  'F.C.T.': 'Peschawar',
  Lebanon: 'Tripolis',
  UNDOF: 'Hauran',
  Baghdad: 'Bagdad',
  Hirat: 'Herat',
  Paktya: 'Ghazna',
  'K.P.': 'Indus',
  'Al Gharbiyah': 'Nildelta',
  Israel: 'Jerusalem',
  Jordan: 'Transjordanien',
  'Al-Qādisiyyah': 'Kufa',
  Maysan: 'Wasit',
  Khuzestan: 'Chusistan',
  Uruzgan: 'Kandahar',
  Punjab: 'Pandschab',
  'An-Najaf': 'Nadschaf',
  Bushehr: 'Fars',
  Hormozgan: 'Hormus',
  'Al Hudud ash Shamaliyah': 'Nordarabien',
  'Sistan and Baluchestan': 'Sistan',
  Baluchistan: 'Belutschistan',
  'Al Minya': 'Oberägypten',
  Najran: 'Nadschran',
};

/** karte -> { spielName: rohdatenName } - der Weg zurueck zu den Rohdaten. */
export const RUECKWAERTS = {};
for (const [karte, tabelle] of Object.entries(TABELLEN)) {
  const zurueck = {};
  for (const [roh, spiel] of Object.entries(tabelle)) zurueck[spiel] = roh;
  RUECKWAERTS[karte] = zurueck;
}
