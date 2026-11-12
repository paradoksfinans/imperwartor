# imperWARtor

Ein rundenbasiertes Strategiespiel auf der Landkarte – von der Antike bis 1914.
Läuft vollständig im Browser: kein Server, kein Konto, keine Installation nötig.

**Spielen: https://paradoksfinans.github.io/imperwartor/**

Auf dem iPhone lässt es sich über *Teilen → Zum Home-Bildschirm* wie eine App
ablegen. Danach startet es im Vollbild und läuft auch ohne Netz.

---

## Worum es geht

Du führst ein Land durch Haushalt, Diplomatie und Krieg. Es gibt keine
Schlachtanimationen: Jeder Kampf ist eine offengelegte Rechnung, die du vorher
abschätzen und hinterher nachlesen kannst. Wer verliert, kann nachvollziehen,
woran es lag.

- **14 Szenarien** aus allen Zeitaltern – Antike, Kalifat, Seldschuken,
  Kreuzzüge 1099, Mongolen, Frühe Neuzeit, Dreißigjähriger Krieg 1618,
  Napoleon 1805, Europa 1914, Zweiter Weltkrieg 1939, dazu eine Weltkarte
  und drei frei erfundene
- **Echte Landkarten** aus Natural-Earth-Daten: feine Küstenlinien und
  Staatsgrenzen, die echten Verwaltungsgrenzen folgen
- **Wirtschaft**: Steuern, Verwaltungskosten, Bauwerke, Versorgung, Unruhe
- **Diplomatie**: Bündnisse, Vasallen, Handelsverträge, Kriegserklärungen
- **Verdeckte Mittel**: Spionage, Aufwiegelung, Bestechung – mit Entdeckungsrisiko
- **Herrscher** mit Eigenschaften, die Wirtschaft, Krieg und Diplomatie verschieben,
  und mit Thronwechseln
- **Ziele**: drei laufende Vorgaben mit Belohnung, die zeigen, was sich lohnt
- **Historische Ereignisse**, an Jahr und Lage gebunden
- **Geführter Einstieg** über eine volle Runde

## Bauen

```bash
npm install
npm run bauen      # erzeugt dist/ und site/
npm run typen      # Typprüfung
npm run pruefen    # Typen + 10 Szenarien je 40 Runden + Browserprüfung
```

`npm run bauen` erzeugt drei Dinge:

| Datei | Zweck |
| --- | --- |
| `dist/imperwartor.html` | das ganze Spiel in einer Datei (~510 kB) |
| `dist/imperwartor-klein.html` | dasselbe gepackt (~221 kB), entpackt sich selbst |
| `site/` | die Web-Fassung mit Manifest und Service Worker |

Die Einzeldatei braucht keinen Server – doppelklicken genügt.

## Aufbau

```
src/core/     Regeln: Wirtschaft, Kampf, Diplomatie, Ziele, Herrscher, Runden
src/data/     Szenarien, Karten, historische Ereignisse
src/ui/       Oberfläche: Karte, Tafeln, Bildschirme, Einstieg
tools/        Karten erzeugen, Symbole zeichnen, Web-Fassung bauen
test/         Simulationen über viele Runden und Browserprüfungen
```

## Die Karten

Die Umrisse stammen aus [Natural Earth](https://www.naturalearthdata.com/)
(10 m für die Regionalkarten, Staatsgrenzen für die Weltkarte). `tools/karten.mjs`
ordnet jedem Spielgebiet die gleichnamige Verwaltungseinheit zu, verteilt die
übrigen Einheiten auf das jeweils nächste Gebiet und baut daraus Umrisse, die
sich ihre Kanten teilen. Dadurch sind auch die Innengrenzen echte
Verwaltungsgrenzen, und das Spiel kann Staatsgrenzen als Linien zeichnen statt
sie über einen Bildfilter anzudeuten.

Die Daten holt man sich einmal:

```bash
mkdir -p ../ne-daten && cd ../ne-daten
for f in ne_10m_admin_1_states_provinces ne_10m_admin_0_countries; do
  curl -LO "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/$f.geojson"
done
cd - && node tools/karten.mjs ../ne-daten
```

Die Punkte liegen als Unterschiede zum Vorgänger auf einem festen Gitter
(`src/core/koordinaten.ts`): rund zwei Zeichen je Punkt statt zwölf.
`npx tsx test/koordinaten.mjs` prüft, dass Kodierer und Dekodierer
zueinander passen.

Kein Framework, keine Laufzeitabhängigkeiten: TypeScript, von esbuild zu einer
Datei gebündelt. Die Karte ist SVG.

## Lizenz

MIT. Kartendaten: [Natural Earth](https://www.naturalearthdata.com/) (gemeinfrei).
