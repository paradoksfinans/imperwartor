# Empire Tactics – Version 0.3

Rundenbasiertes geopolitisches Strategiespiel, vollständig über eine
interaktive Karte steuerbar. Keine Animationen, keine Echtzeitkämpfe: Jede
Entscheidung fällt durch Anklicken oder Antippen eines Gebietes.

Alle Inhalte – Karten, Länder, Szenarien, Grafik, Mechanik, Zeichensatz – sind
eigenständig entwickelt. Es werden keine geschützten Inhalte anderer Spiele
verwendet.

## Starten

```bash
npm install
npm run dev
```

Dann `http://localhost:5173` öffnen. Voraussetzung: Node.js 18 oder neuer.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit sofortiger Aktualisierung |
| `npm run typecheck` | TypeScript prüfen, ohne zu bauen |
| `npm run build` | Typprüfung und Produktionsbuild nach `dist/` |
| `npm run preview` | Produktionsbuild lokal ansehen |

Das Spiel läuft vollständig offline: Schriften sind mitgeliefert, es gibt keine
externen Anfragen, kein Backend und keine kostenpflichtigen Dienste.

## Gestaltung

Leitbild ist ein **Admiralitäts-Kartentisch**: Das Meer ist Tinte, das Land ist
Papier. Länderfarben werden als Druckfarbe in das Papier gerechnet, nicht
flächig aufgetragen.

- **Farben** – Tinte `#0e1a24`, Leinenpapier `#e7dcc6`, Messing `#c9a227`,
  Grünspan `#4e9a8f`, Siegelwachsrot `#b5422f`, Indigo `#2b4c6f`
- **Schrift** – *Spectral* für Titel und Kartenschrift, *IBM Plex Sans* mit
  Tabellenziffern für alle Zahlen. Gewässer sind kursiv beschriftet, Land
  aufrecht – wie in gedruckten Karten.
- **Zierwerk** – Die Kartusche erscheint genau zweimal: beim Start und am
  Spielende. Alles andere bleibt bei Haarlinien.
- **Zwei Designs** – Nacht und Tag, jeweils mit eigenen Kartenfarben.

### Farben sind geprüft, nicht geschätzt

Länderfarben tragen Spielinformation, deshalb wurden sie gerechnet statt
ausgewählt:

1. Acht gedeckte Kartentinten mit Kontrast ≥ 3:1 gegen **beide** Designs.
2. Für jedes Szenario wird die Nachbarschaft der Länder aus der Karte
   abgeleitet und die Farbzuweisung so gewählt, dass **kein angrenzendes
   Länderpaar** unter ΔE 6,7 liegt – geprüft gegen Protanopie, Deuteranopie,
   Tritanopie und Normalsicht.
3. Zusätzlich erhält jedes Land ein eigenes Flächenmuster, und benachbarte
   Länder haben nie dasselbe Muster.

Identität hängt damit an Farbe **und** Muster **und** Beschriftung – nie an
Farbe allein.

## Aufbau

```text
src/
  models/      Typdefinitionen (alle Strukturen JSON-serialisierbar)
  data/        Inhalte als JSON: Karten, Szenarien, Einheiten, Gebäude,
               Technologien, Projekte, Ereignisse
  services/    Inhalte, Spielstände, Einstellungen, Ton, Abschlusskarte
  engine/      Vollständige Spiellogik, kennt keine React-Komponenten
  state/       Reducer und Context
  hooks/       Kamera der Karte, Größenmessung
  components/  map/ (Karte), ui/ (Bausteine), hud/ (Leisten),
               panels/ (Dossier), modals/ (Fenster)
  screens/     Startmenü, Szenariowahl, Länderwahl, Spielbildschirm
  styles/      Designsystem und Layout
  utils/       Zufall, Formatierung, Hilfsfunktionen
```

**Grundprinzip: Logik und Oberfläche sind strikt getrennt.** Komponenten lösen
nur Aktionen im Reducer aus; der Reducer ruft Funktionen aus `engine/` auf, die
auf einer Kopie des Zustands arbeiten. Jede Aktion ist in `try/catch` gefasst –
schlägt sie fehl, bleibt der alte Zustand erhalten und es erscheint eine
Meldung.

Der Zufallsgenerator (`utils/rng.ts`, Mulberry32) ist deterministisch, sein
Startwert ist Teil des Spielstands. Gleicher Startwert bedeutet gleicher
Verlauf; geladene Spiele laufen reproduzierbar weiter.

## Spielablauf

Frei handeln, solange Aktionspunkte reichen – dann „Runde beenden". Danach
werden in fester Reihenfolge verarbeitet:

1. Einnahmen, Rohstoffe, politische Macht
2. Bevölkerung, Zufriedenheit, Unruhe
3. Forschung und fertige Bauvorhaben
4. Innere Lage: Desertion, Aufstände, Abspaltungen
5. Züge der anderen Mächte
6. Ereignisse
7. Siegprüfung und neue Aktionspunkte

## Was enthalten ist

**Karten und Szenarien**

- Nordmark – 16 Gebiete, 6 Mächte, kurze Wege (Einstieg)
- Aurelia – 46 Gebiete, 8 Mächte, weiter Kontinent
- Thalassa-Archipel – 30 Gebiete, 6 Mächte, 22 Häfen, Seewege entscheiden

Jede Karte ist prozedural aus Voronoi-Zellen erzeugt: organische Grenzen,
Höhenmodell, Küstenlinien, Tiefenzonen, Flüsse.

**Militär**

- Vier Gattungen – Infanterie, Kavallerie, Artillerie, Flotte – mit eigenen
  Geländestärken, Kosten, Rohstoffbedarf und Verlustanteilen
- Feldherren mit Eigenschaften, Erfahrung und Stufenaufstieg
- Versorgungsgrenzen je Gebiet, Attrition bei Überlastung
- Belagerung senkt die Befestigung, Flotten transportieren und blockieren
- Mehrrundiger Kampf mit vollständig aufgeschlüsseltem Bericht

**Staat und Wirtschaft**

- Steuersatz, drei Haushaltsschwerpunkte, Verwaltungskosten je Gebiet
- Fünf strategische Rohstoffe mit Zufluss und Bedarf
- Zehn Ausbauten in drei Stufen, fünf Großprojekte, Bauzeiten und Beschleunigung
- Bauschlange je Gebiet: bis zu drei Vorhaben vormerken, Kosten richten sich nach
  der geplanten Stufe, Abbruch erstattet wartende Vorhaben voll und laufende zur Hälfte
- 24 Technologien in acht Bereichen und drei Stufen
- Zufriedenheit, Kriegsmüdigkeit, Ansehen, politische Macht, Unruhe,
  Kriegsschäden, Aufstände

**Diplomatie**

- Beziehungen von −100 bis +100, Handelsabkommen, Nichtangriffspakte, Bündnisse,
  Koalitionen gegen übermächtige Staaten, Vasallen und Tribut
- Gebietsansprüche rechtfertigen Kriege und schonen das Ansehen
- Friedensverhandlung mit Forderungsgewicht gegen Annahmebereitschaft
- Spionage: Aufklärung, Sabotage, Aufwiegeln, Schatzraub, Abwehr
- Sieben KI-Persönlichkeiten, vier Schwierigkeitsgrade

**Oberfläche**

- Elf Kartenansichten mit eigener Legende
- Zeigerhinweise, Minikarte mit Sichtfeldrahmen, Zoom und Verschieben per Maus,
  Rad, Tastatur und Zwei-Finger-Geste
- Reichsrat: berechnete Hinweise auf Gefahren und Gelegenheiten, ein Klick
  springt an die betroffene Stelle
- Chronik mit Rangliste, Verlaufsdiagrammen und Ereignisbuch
- 16 Auszeichnungen, Abschlusskarte als Bild zum Teilen
- Tastenkürzel, Bottom-Sheet auf Smartphones, Nacht- und Tagdesign

## Eine neue Karte hinzufügen

1. `src/data/maps/<name>.json` anlegen mit `id`, `name`, `description`,
   `viewBox`, `seed`, `oceanCells`, `coastlines`, `rivers` und `territories`.
2. Jedes Gebiet braucht `id`, `name`, `polygon`, `labelX`, `labelY`,
   `elevation`, `terrain`, `neighbours`, `seaNeighbours`, `basePopulation`,
   `baseEconomy`, `hasPort`, `resources`.
3. Die Datei in `src/services/contentService.ts` importieren und in `MAPS`
   eintragen.

Seewege sind nur nutzbar, wenn **beide** Gebiete einen Hafen besitzen. Die
Grenzlinien werden automatisch aus gemeinsamen Polygonkanten berechnet – die
Punkte benachbarter Gebiete müssen daher übereinstimmen.

## Ein neues Szenario hinzufügen

1. `src/data/scenarios/<name>.json` anlegen, `mapId` auf eine vorhandene Karte
   setzen.
2. Länder mit Gebieten, Hauptstadt, Herrscher, Regierungsform, Startwerten,
   KI-Persönlichkeit, Kultur, Glaube und Boni definieren; dazu
   Anfangsbeziehungen, Bündnisse, laufende Kriege und Siegbedingungen.
3. In `src/services/contentService.ts` in `SCENARIOS` eintragen.

Am Code in `engine/` ist dafür nichts zu ändern. Farben und Muster lassen sich
frei wählen; für die geprüfte Nachbarschaftszuweisung die acht Kartentinten aus
diesem README verwenden.

## Selbstprüfung dieser Version

Neu in 0.3: **Bauschlange je Gebiet** – geprüft mit 14 gezielten Zusicherungen
(Kostenstaffelung nach geplanter Stufe, Begrenzung auf drei Plätze, Abarbeitung
in Reihenfolge, Beschleunigung des vordersten Vorhabens, Erstattung beim
Abbruch, nur ein Großprojekt je Reich) sowie 25 Runden Dauerlauf mit
durchgehend vollen Schlangen.

Geprüft wurde mit TypeScript, einer Engine-Simulation und einem automatisierten
Durchlauf der Oberfläche in einem echten Browser:

- `tsc --noEmit`: 0 Fehler, `vite build` erfolgreich
- Engine-Simulation: 450 Runden über alle drei Szenarien und neun Länder auf
  Schwierigkeit „Schwer" – keine Abstürze, keine ungültigen Werte, keine
  verwaisten Gebietsbesitzer
- Datenprüfung: alle Technologie-Voraussetzungen, Freischaltungen,
  Ereignisketten, Gebiets- und Länderbezüge auflösbar
- Browserdurchlauf: Menü → Szenario → Land → Spiel → Aushebung → Kartenfilter →
  Dossier → sechs Runden → Chronik → Tagdesign → Smartphone sowie
  Kriegserklärung → Angriff → Kampfbericht → Friedensverhandlung;
  **0 Konsolenfehler**

### Noch vereinfacht

- Ereignisse der KI-Länder werden automatisch entschieden, nicht ausgespielt
- Keine Staatsschulden und keine Zinsen; eine leere Kasse kostet Zufriedenheit
- Kein Karten- oder Szenarioeditor (die Datenstrukturen sind darauf ausgelegt)
- Töne sind synthetisch erzeugt, es gibt keine Musik

### Sinnvolle nächste Schritte

1. Ereignisfenster auch für KI-Länder, sichtbar als Meldung
2. Staatsschulden, Anleihen und Zinsen
3. Szenarioeditor im Browser mit Ausgabe als JSON
4. Weitere Karten und Szenarien auf Basis der vorhandenen Struktur
