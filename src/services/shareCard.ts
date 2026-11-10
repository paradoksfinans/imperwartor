/**
 * Abschlusskarte zum Teilen.
 *
 * Erzeugt aus dem Spielstand ein eigenständiges Bild: Kartusche, Urteil,
 * Kennzahlen und die tatsächliche Weltkarte am Ende der Partie. Die Karte
 * wird im Browser gezeichnet und als PNG gespeichert - ohne fremde Dienste.
 */
import type { GameState } from '../models/types';
import { getMap } from './contentService';
import {
  getCountryArmySize,
  getCountryPopulation,
  getCountryScore,
  getCountryTerritories
} from '../engine/rules';
import { landFill, neutralFill, palette } from '../components/map/mapVisuals';
import { parseViewBox } from '../hooks/useMapCamera';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Baut die Karte als SVG-Text. */
export function buildShareSvg(game: GameState): string {
  const country = game.countries[game.playerCountryId];
  const map = getMap(game.mapId);
  const world = parseViewBox(map.viewBox);
  const colors = palette('dark');

  const verdict =
    game.status === 'victory' ? 'Sieg' : game.status === 'defeat' ? 'Niederlage' : 'Zwischenstand';

  const territories = getCountryTerritories(game, game.playerCountryId).length;
  const stats: [string, string][] = [
    ['Gebiete', String(territories)],
    ['Truppen', String(getCountryArmySize(game, game.playerCountryId))],
    ['Bevölkerung', getCountryPopulation(game, game.playerCountryId).toLocaleString('de-DE')],
    ['Punkte', getCountryScore(game, game.playerCountryId).toLocaleString('de-DE')],
    ['Schlachten gewonnen', String(game.stats.battlesWon)],
    ['Gebiete erobert', String(game.stats.territoriesConquered)],
    ['Kriege erklärt', String(game.stats.warsDeclared)],
    ['Technologien', String(country?.technologies.length ?? 0)]
  ];

  // Weltkarte in das rechte Drittel einpassen
  const mapWidth = 520;
  const mapHeight = 430;

  const polygons = map.territories
    .map((definition) => {
      const territory = game.territories[definition.id];
      if (!territory) return '';
      const owner = territory.ownerId ? game.countries[territory.ownerId] : null;
      const fill = owner ? landFill(owner.color, 'dark') : neutralFill('dark');
      const stroke = owner?.id === game.playerCountryId ? '#e3bd48' : colors.border;
      const strokeWidth = owner?.id === game.playerCountryId ? world.width / 240 : world.width / 700;
      return `<polygon points="${definition.polygon}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"/>`;
    })
    .join('');

  const statLines = stats
    .map(
      ([label, value], index) => `
      <text x="${72 + (index % 2) * 240}" y="${334 + Math.floor(index / 2) * 46}" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#9fb0c6">${escapeXml(label)}</text>
      <text x="${72 + (index % 2) * 240}" y="${358 + Math.floor(index / 2) * 46}" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#e8e2d4">${escapeXml(value)}</text>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#15242f"/>
      <stop offset="100%" stop-color="#0a141c"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="18" y="18" width="${WIDTH - 36}" height="${HEIGHT - 36}" fill="none" stroke="#3d5c70" stroke-width="1"/>
  <path d="M30 30h46M30 30v46" stroke="#c9a227" stroke-width="3" fill="none"/>
  <path d="M${WIDTH - 30} ${HEIGHT - 30}h-46M${WIDTH - 30} ${HEIGHT - 30}v-46" stroke="#c9a227" stroke-width="3" fill="none"/>

  <text x="72" y="104" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#c9a227">Empire Tactics</text>
  <text x="72" y="168" font-family="Georgia, serif" font-size="54" font-weight="bold" fill="#e8e2d4">${escapeXml(
    country?.name ?? 'Unbekanntes Reich'
  )}</text>
  <text x="72" y="206" font-family="Georgia, serif" font-size="22" font-style="italic" fill="#a4b2bd">${escapeXml(
    `${verdict} im ${game.turnLabel} ${game.year} nach ${game.turn} Runden`
  )}</text>
  <text x="72" y="248" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#71838f">${escapeXml(
    `${game.scenarioName} · ${country?.ruler ?? ''}`
  )}</text>
  <line x1="72" y1="276" x2="560" y2="276" stroke="#2a4252" stroke-width="1"/>
  ${statLines}

  <svg x="${WIDTH - mapWidth - 60}" y="${(HEIGHT - mapHeight) / 2}" width="${mapWidth}" height="${mapHeight}" viewBox="${map.viewBox}" preserveAspectRatio="xMidYMid meet">
    <rect x="${world.x}" y="${world.y}" width="${world.width}" height="${world.height}" fill="#0d1a24"/>
    ${polygons}
  </svg>
</svg>`;
}

/** Wandelt die Karte in ein PNG und lädt es herunter. */
export async function downloadShareCard(game: GameState): Promise<boolean> {
  const svg = buildShareSvg(game);
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Die Karte konnte nicht gezeichnet werden.'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Kein Zeichenbereich verfügbar.');
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    URL.revokeObjectURL(url);

    const link = document.createElement('a');
    link.download = `empire-tactics-${game.scenarioId}-runde-${game.turn}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (error) {
    console.error('Abschlusskarte fehlgeschlagen:', error);
    // Rückfall: SVG direkt anbieten
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.download = `empire-tactics-runde-${game.turn}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      return true;
    } catch {
      return false;
    }
  }
}

/** Kurzfassung als Text, etwa für eine Nachricht. */
export function buildSummaryText(game: GameState): string {
  const country = game.countries[game.playerCountryId];
  const verdict = game.status === 'victory' ? 'Sieg' : game.status === 'defeat' ? 'Niederlage' : 'Zwischenstand';
  return [
    `Empire Tactics - ${game.scenarioName}`,
    `${country?.name ?? 'Reich'} unter ${country?.ruler ?? 'unbekannter Führung'}`,
    `${verdict} im ${game.turnLabel} ${game.year} (Runde ${game.turn})`,
    `Gebiete: ${getCountryTerritories(game, game.playerCountryId).length}`,
    `Punkte: ${getCountryScore(game, game.playerCountryId)}`,
    `Schlachten gewonnen: ${game.stats.battlesWon}, Gebiete erobert: ${game.stats.territoriesConquered}`
  ].join('\n');
}
