/**
 * Forschungssystem: Auswahl und Fortschritt von Technologien.
 */
import type { ActionResult, GameState, Technology } from '../models/types';
import { getAllTechnologies, getTechnology } from '../services/contentService';

/** Sind alle Voraussetzungen einer Technologie erfüllt? */
export function isTechAvailable(state: GameState, countryId: string, tech: Technology): boolean {
  const country = state.countries[countryId];
  if (!country) return false;
  if (country.technologies.includes(tech.id)) return false;
  return tech.requires.every((requirement) => country.technologies.includes(requirement));
}

/** Alle aktuell erforschbaren Technologien eines Landes. */
export function getAvailableTechnologies(state: GameState, countryId: string): Technology[] {
  return getAllTechnologies().filter((tech) => isTechAvailable(state, countryId, tech));
}

/** Technologien, deren Voraussetzungen noch fehlen (für die Baumansicht). */
export function getLockedTechnologies(state: GameState, countryId: string): Technology[] {
  const country = state.countries[countryId];
  if (!country) return [];
  return getAllTechnologies().filter(
    (tech) =>
      !country.technologies.includes(tech.id) &&
      !tech.requires.every((requirement) => country.technologies.includes(requirement))
  );
}

/** Geschätzte Rundenzahl bis zum Abschluss eines Projekts. */
export function getResearchTurns(cost: number, points: number, perTurn: number): number {
  if (perTurn <= 0) return Infinity;
  return Math.max(1, Math.ceil((cost - points) / perTurn));
}

/** Setzt das aktuelle Forschungsprojekt. */
export function setResearch(state: GameState, countryId: string, techId: string | null): ActionResult {
  const country = state.countries[countryId];
  if (!country) return { ok: false, message: 'Ungültiges Land.' };
  if (techId === null) {
    country.currentResearchId = null;
    return { ok: true, message: 'Forschung angehalten.' };
  }
  const tech = getTechnology(techId);
  if (!tech) return { ok: false, message: 'Unbekannte Technologie.' };
  if (!isTechAvailable(state, countryId, tech)) {
    return { ok: false, message: 'Die Voraussetzungen sind nicht erfüllt.' };
  }
  country.currentResearchId = techId;
  return { ok: true, message: `Forschung an "${tech.name}" gestartet.` };
}

/**
 * Verarbeitet den Forschungsfortschritt einer Runde.
 * Forschungspunkte werden in economy.ts gutgeschrieben und hier ausgegeben.
 */
export function applyResearchPhase(state: GameState, countryId: string): void {
  const country = state.countries[countryId];
  if (!country || !country.currentResearchId) return;
  const tech = getTechnology(country.currentResearchId);
  if (!tech) {
    country.currentResearchId = null;
    return;
  }
  if (country.researchPoints >= tech.cost) {
    country.researchPoints -= tech.cost;
    country.technologies.push(tech.id);
    country.currentResearchId = null;
    state.log.unshift({
      turn: state.turn,
      type: 'research',
      text: `${country.name} schließt die Forschung "${tech.name}" ab.`,
      important: country.isPlayer
    });
  }
}
