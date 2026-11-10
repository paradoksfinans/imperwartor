/**
 * Auswahl des Landes, des Schwierigkeitsgrads und der Spielregeln.
 * Die Auswahl ist direkt auf der Karte möglich.
 */
import type { Difficulty, GameOptions } from '../models/types';
import { getMap, getScenario } from '../services/contentService';
import { DIFFICULTY_INFO, GOVERNMENT_INFO } from '../engine/rules';
import { formatDecimal, formatNumber } from '../utils/format';
import { Icon } from '../components/ui/Icon';
import { Tag } from '../components/ui/Bits';
import { ScenarioPreview } from '../components/map/ScenarioPreview';
import { landFill, type ThemeId } from '../components/map/mapVisuals';

interface CountrySelectProps {
  theme: ThemeId;
  scenarioId: string;
  selectedCountryId: string | null;
  difficulty: Difficulty;
  options: GameOptions;
  seed: string;
  onSelectCountry: (countryId: string) => void;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onToggleOption: (key: keyof GameOptions, value: boolean) => void;
  onSetSeed: (seed: string) => void;
  onStart: () => void;
  onBack: () => void;
}

const AI_LABEL: Record<string, string> = {
  aggressive: 'angriffslustig',
  defensive: 'verteidigend',
  economic: 'wirtschaftlich',
  diplomatic: 'diplomatisch',
  expansionist: 'ausgreifend',
  opportunistic: 'gelegenheitssuchend',
  isolationist: 'abgeschottet'
};

export function CountrySelect(props: CountrySelectProps) {
  const {
    theme,
    scenarioId,
    selectedCountryId,
    difficulty,
    options,
    seed,
    onSelectCountry,
    onSelectDifficulty,
    onToggleOption,
    onSetSeed,
    onStart,
    onBack
  } = props;

  let scenario;
  try {
    scenario = getScenario(scenarioId);
    getMap(scenario.mapId);
  } catch (error) {
    console.error(error);
    return (
      <div className="menu">
        <div className="menu-inner">
          <h1>Diese Lage lässt sich nicht laden</h1>
          <p className="lede">Die Daten des Szenarios sind unvollständig.</p>
          <button type="button" className="primary" onClick={onBack}>
            Zurück
          </button>
        </div>
      </div>
    );
  }

  const selected = scenario.countries.find((country) => country.id === selectedCountryId) ?? null;

  return (
    <div className="menu">
      <div className="menu-inner">
        <button type="button" className="quiet small" onClick={onBack}>
          <Icon name="chevronRight" size={14} />
          Andere Lage
        </button>

        <h1 style={{ marginTop: '0.75rem' }}>Wer bist du?</h1>
        <p className="lede">
          {scenario.description}
        </p>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
          <div>
            <ScenarioPreview
              scenarioId={scenarioId}
              theme={theme}
              selectedCountryId={selectedCountryId}
              onPickCountry={onSelectCountry}
            />
            <p className="faint" style={{ marginTop: '0.4rem' }}>
              Tippe ein Land auf der Karte an. Die Punkte zeigen die Hauptstädte.
            </p>

            <div className="section-title">Schwierigkeit</div>
            <div className="panel" style={{ overflow: 'hidden' }}>
              {(['easy', 'normal', 'hard', 'brutal'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`choice${difficulty === level ? ' selected' : ''}`}
                  aria-pressed={difficulty === level}
                  onClick={() => onSelectDifficulty(level)}
                >
                  <span className="choice-title">{DIFFICULTY_INFO[level].name}</span>
                  <span className="faint">{DIFFICULTY_INFO[level].description}</span>
                </button>
              ))}
            </div>

            <div className="section-title">Regeln</div>
            <div className="panel" style={{ padding: '0.7rem 0.85rem' }}>
              {(
                [
                  ['fogOfWar', 'Nebel des Krieges', 'Fremde Stärken bleiben verborgen, bis du aufklärst.'],
                  ['rebellions', 'Aufstände', 'Unzufriedene Gebiete können sich losreissen.'],
                  ['showTurnReport', 'Rundenbericht', 'Nach jeder Runde eine Zusammenfassung.'],
                  ['sandbox', 'Freies Spiel', 'Kein Spielende, keine Siegbedingung.']
                ] as [keyof GameOptions, string, string][]
              ).map(([key, label, hint]) => (
                <label
                  key={key}
                  className="row between"
                  style={{ cursor: 'pointer', padding: '0.25rem 0', alignItems: 'flex-start' }}
                >
                  <span>
                    <span style={{ fontSize: '0.92rem' }}>{label}</span>
                    <span className="faint" style={{ display: 'block' }}>
                      {hint}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(event) => onToggleOption(key, event.target.checked)}
                  />
                </label>
              ))}

              <div style={{ marginTop: '0.5rem' }}>
                <label className="faint" htmlFor="seed">
                  Startwert (gleicher Wert erzeugt denselben Verlauf)
                </label>
                <input
                  id="seed"
                  type="text"
                  value={seed}
                  placeholder="beliebig, z. B. Nordwind"
                  onChange={(event) => onSetSeed(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="section-title">Mächte</div>
            <div className="panel" style={{ overflow: 'hidden' }}>
              {scenario.countries.map((country) => (
                <button
                  key={country.id}
                  type="button"
                  className={`choice${selectedCountryId === country.id ? ' selected' : ''}`}
                  aria-pressed={selectedCountryId === country.id}
                  onClick={() => onSelectCountry(country.id)}
                >
                  <span className="row tight" style={{ width: '100%' }}>
                    <span className="crest" style={{ background: landFill(country.color, theme) }} />
                    <span style={{ minWidth: 0 }}>
                      <span className="choice-title">{country.name}</span>
                      <span className="faint" style={{ display: 'block' }}>
                        {country.ruler} · {GOVERNMENT_INFO[country.government].name} ·{' '}
                        {AI_LABEL[country.ai] ?? country.ai}
                      </span>
                    </span>
                  </span>
                  <span className="faint">{country.bonusText}</span>
                  <span className="row tight" style={{ marginTop: '0.2rem' }}>
                    <Tag icon="layers">{country.territories.length} Gebiete</Tag>
                    <Tag icon="gold">{formatNumber(country.gold)}</Tag>
                    <Tag icon="infantry">{country.startArmyPerTerritory} je Gebiet</Tag>
                  </span>
                </button>
              ))}
            </div>

            {selected ? (
              <div className="panel" style={{ marginTop: '0.75rem', padding: '0.75rem 0.9rem' }}>
                <h3 style={{ marginBottom: '0.2rem' }}>{selected.name}</h3>
                <p className="faint">{selected.description}</p>
                <div className="grid three">
                  {(
                    [
                      ['Angriff', selected.traits.attack],
                      ['Verteidigung', selected.traits.defense],
                      ['Wirtschaft', selected.traits.economy],
                      ['Forschung', selected.traits.research],
                      ['Zufriedenheit', selected.traits.stability]
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div className="kv" key={label}>
                      <span>{label}</span>
                      <span className={value > 1 ? 'positive' : value < 1 ? 'negative' : undefined}>
                        {formatDecimal(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="faint" style={{ marginTop: '0.4rem' }}>
                  {GOVERNMENT_INFO[selected.government].description}
                </p>
                <p className="faint">
                  Kultur {selected.culture} · Glaube {selected.religion}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="primary block"
              style={{ marginTop: '0.9rem' }}
              disabled={!selectedCountryId}
              onClick={onStart}
            >
              <Icon name="compass" size={17} />
              {selected ? `Als ${selected.name} beginnen` : 'Zuerst ein Land wählen'}
            </button>
            <p className="faint" style={{ marginTop: '0.4rem' }}>
              {scenario.victory.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
