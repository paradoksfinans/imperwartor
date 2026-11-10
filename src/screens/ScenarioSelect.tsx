/**
 * Auswahl von Kartenregion und Szenario.
 */
import { useState } from 'react';
import { getAllMaps, getScenariosForMap } from '../services/contentService';
import { Icon } from '../components/ui/Icon';
import { Empty, Tag } from '../components/ui/Bits';
import { ScenarioPreview } from '../components/map/ScenarioPreview';
import type { ThemeId } from '../components/map/mapVisuals';

export function ScenarioSelect({
  theme,
  onSelectScenario,
  onBack
}: {
  theme: ThemeId;
  onSelectScenario: (scenarioId: string) => void;
  onBack: () => void;
}) {
  const maps = getAllMaps();
  const [mapId, setMapId] = useState(maps[0]?.id ?? '');
  const scenarios = mapId ? getScenariosForMap(mapId) : [];
  const [preview, setPreview] = useState<string | null>(scenarios[0]?.id ?? null);

  const chooseMap = (id: string) => {
    setMapId(id);
    const first = getScenariosForMap(id)[0];
    setPreview(first ? first.id : null);
  };

  return (
    <div className="menu">
      <div className="menu-inner">
        <button type="button" className="quiet small" onClick={onBack}>
          <Icon name="chevronRight" size={14} />
          Zurück
        </button>

        <h1 style={{ marginTop: '0.75rem' }}>Welche Welt?</h1>
        <p className="lede">
          Wähle zuerst die Region, dann die Lage, in der du beginnst. Jede Karte spielt sich
          anders: kurze Wege erzwingen schnelle Entscheidungen, weite Kontinente belohnen Geduld.
        </p>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)' }}>
          <div>
            <div className="section-title">Region</div>
            <div className="panel" style={{ overflow: 'hidden' }}>
              {maps.map((map) => (
                <button
                  key={map.id}
                  type="button"
                  className={`choice${mapId === map.id ? ' selected' : ''}`}
                  aria-pressed={mapId === map.id}
                  onClick={() => chooseMap(map.id)}
                >
                  <span className="choice-title">{map.name}</span>
                  <span className="faint">{map.description}</span>
                  <span className="row tight" style={{ marginTop: '0.2rem' }}>
                    <Tag icon="layers">{map.territories.length} Gebiete</Tag>
                    <Tag icon="anchor">
                      {map.territories.filter((territory) => territory.hasPort).length} Häfen
                    </Tag>
                  </span>
                </button>
              ))}
            </div>

            <div className="section-title" style={{ marginTop: '1rem' }}>
              Lage
            </div>
            <div className="panel" style={{ overflow: 'hidden' }}>
              {scenarios.length === 0 ? (
                <div style={{ padding: '0.75rem' }}>
                  <Empty text="Für diese Region ist noch kein Szenario hinterlegt." />
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    className={`choice${preview === scenario.id ? ' selected' : ''}`}
                    aria-pressed={preview === scenario.id}
                    onClick={() => setPreview(scenario.id)}
                    onDoubleClick={() => onSelectScenario(scenario.id)}
                  >
                    <span className="choice-title">{scenario.name}</span>
                    <span className="faint">{scenario.description}</span>
                    <span className="row tight" style={{ marginTop: '0.2rem' }}>
                      <Tag icon="globe">{scenario.era}</Tag>
                      <Tag>Start {scenario.startYear}</Tag>
                      <Tag icon="crown">{scenario.countries.length} Mächte</Tag>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            {preview ? (
              <>
                <ScenarioPreview scenarioId={preview} theme={theme} />
                <div className="panel" style={{ marginTop: '0.6rem', padding: '0.7rem 0.85rem' }}>
                  {(() => {
                    const scenario = scenarios.find((entry) => entry.id === preview);
                    if (!scenario) return null;
                    return (
                      <>
                        <h3 style={{ marginBottom: '0.2rem' }}>{scenario.name}</h3>
                        <p className="faint" style={{ marginBottom: '0.5rem' }}>
                          {scenario.victory.description}
                        </p>
                        <div className="row tight" style={{ marginBottom: '0.6rem' }}>
                          {scenario.countries.map((country) => (
                            <span className="tag" key={country.id}>
                              <i
                                style={{
                                  width: '0.6rem',
                                  height: '0.6rem',
                                  background: country.color,
                                  borderRadius: '2px',
                                  display: 'inline-block'
                                }}
                              />
                              {country.name}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="primary block"
                          onClick={() => onSelectScenario(scenario.id)}
                        >
                          Diese Lage wählen
                        </button>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <Empty text="Wähle eine Lage, um die Karte zu sehen." icon="compass" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
