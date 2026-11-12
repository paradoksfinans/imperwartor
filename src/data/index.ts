/** Sammelstelle für alle Spieldaten. Neue Karten und Szenarien hier eintragen. */
import type { GameEventDefinition, GameMap } from '../core/types';

import mapEuropaDetail from './maps/europadetail.json';
import mapMittelmeer from './maps/mittelmeer.json';
import mapVorderasien from './maps/vorderasien.json';
import mapWelt from './maps/welt.json';
import mapAurelia from './maps/aurelia.json';

import scEuropa1914 from './scenarios/europa_1914.json';
import scAntike from './scenarios/antike_200v.json';
import scSeldschuken from './scenarios/seldschuken_1071.json';
import scKalifat from './scenarios/kalifat_750.json';
import scMongolen from './scenarios/mongolen_1240.json';
import scNeuzeit from './scenarios/neuzeit_1500.json';
import scWelt1914 from './scenarios/welt_1914.json';
import scKreuzzuege from './scenarios/kreuzzuege_1099.json';
import scDreissig from './scenarios/dreissigjaehriger_1618.json';
import scNapoleon from './scenarios/napoleon_1805.json';
import scWeltkrieg1939 from './scenarios/weltkrieg_1939.json';
import scAureliaAufbruch from './scenarios/aurelia_aufbruch.json';
import scAureliaBrand from './scenarios/aurelia_brand.json';
import scAureliaSandkasten from './scenarios/aurelia_sandkasten.json';

import eventsJson from './events.json';

export const maps = [
  mapEuropaDetail, mapMittelmeer, mapVorderasien, mapWelt, mapAurelia,
] as unknown as GameMap[];

/** Reihenfolge bestimmt die Anzeige im Auswahlbildschirm. */
/* Reihenfolge wie im Auswahlbildschirm: erst die geschichtlichen
   Szenarien von der Antike bis 1939, dann die erfundene Welt Aurelia. */
export const scenarios = [
  scAntike, scKalifat, scSeldschuken, scKreuzzuege, scMongolen, scNeuzeit,
  scDreissig, scNapoleon, scEuropa1914, scWelt1914, scWeltkrieg1939,
  scAureliaAufbruch, scAureliaBrand, scAureliaSandkasten,
] as unknown as any[];

export const eventDefinitions = eventsJson as unknown as GameEventDefinition[];

export function getMap(id: string): GameMap | undefined {
  return maps.find((m) => m.id === id);
}
