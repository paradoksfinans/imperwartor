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
import scAureliaAufbruch from './scenarios/aurelia_aufbruch.json';
import scAureliaBrand from './scenarios/aurelia_brand.json';
import scAureliaSandkasten from './scenarios/aurelia_sandkasten.json';

import eventsJson from './events.json';

export const maps = [
  mapEuropaDetail, mapMittelmeer, mapVorderasien, mapWelt, mapAurelia,
] as unknown as GameMap[];

/** Reihenfolge bestimmt die Anzeige im Auswahlbildschirm. */
export const scenarios = [
  scEuropa1914, scAntike, scSeldschuken, scKalifat, scMongolen, scNeuzeit,
  scWelt1914, scAureliaAufbruch, scAureliaBrand, scAureliaSandkasten,
] as unknown as any[];

export const eventDefinitions = eventsJson as unknown as GameEventDefinition[];

export function getMap(id: string): GameMap | undefined {
  return maps.find((m) => m.id === id);
}
