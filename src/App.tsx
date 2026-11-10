/**
 * Wurzelkomponente: wählt den Bildschirm und fängt unerwartete Fehler ab,
 * damit nie eine leere Seite erscheint.
 */
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { useGame } from './state/GameContext';
import { MainMenu } from './screens/MainMenu';
import { ScenarioSelect } from './screens/ScenarioSelect';
import { CountrySelect } from './screens/CountrySelect';
import { GameScreen } from './screens/GameScreen';
import { HelpWindow } from './components/modals/HelpWindow';

interface BoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unerwarteter Fehler:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="menu">
          <div className="menu-inner">
            <div className="cartouche">
              <h1>Da ist etwas schiefgegangen</h1>
              <p className="lede">
                Das Spiel hat einen Fehler gemeldet und angehalten, damit kein Spielstand
                beschädigt wird. Der automatische Spielstand der letzten Runde bleibt erhalten.
              </p>
              <p className="faint">{this.state.message}</p>
              <button type="button" className="primary" onClick={() => window.location.reload()}>
                Neu laden
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Screens() {
  const { state, dispatch, settings, updateSettings } = useGame();
  const [helpOpen, setHelpOpen] = useState(false);

  const help = helpOpen ? <HelpWindow onClose={() => setHelpOpen(false)} /> : null;

  switch (state.screen) {
    case 'scenario':
      return (
        <>
          <ScenarioSelect
            theme={settings.theme}
            onSelectScenario={(scenarioId) => dispatch({ type: 'SELECT_SCENARIO', scenarioId })}
            onBack={() => dispatch({ type: 'GO_TO', screen: 'menu' })}
          />
          {help}
        </>
      );

    case 'country': {
      if (!state.setup.scenarioId) {
        return (
          <ScenarioSelect
            theme={settings.theme}
            onSelectScenario={(scenarioId) => dispatch({ type: 'SELECT_SCENARIO', scenarioId })}
            onBack={() => dispatch({ type: 'GO_TO', screen: 'menu' })}
          />
        );
      }
      return (
        <>
          <CountrySelect
            theme={settings.theme}
            scenarioId={state.setup.scenarioId}
            selectedCountryId={state.setup.countryId}
            difficulty={state.setup.difficulty}
            options={state.setup.options}
            seed={state.setup.seed}
            onSelectCountry={(countryId) => dispatch({ type: 'SELECT_SETUP_COUNTRY', countryId })}
            onSelectDifficulty={(difficulty) => dispatch({ type: 'SET_DIFFICULTY', difficulty })}
            onToggleOption={(key, value) => dispatch({ type: 'SET_OPTION', key, value })}
            onSetSeed={(seed) => dispatch({ type: 'SET_SEED', seed })}
            onStart={() => dispatch({ type: 'START_GAME' })}
            onBack={() => dispatch({ type: 'GO_TO', screen: 'scenario' })}
          />
          {help}
        </>
      );
    }

    case 'game':
      if (!state.game) {
        return (
          <MainMenu
            theme={settings.theme}
            onNewGame={() => dispatch({ type: 'GO_TO', screen: 'scenario' })}
            onLoadGame={(loaded) => dispatch({ type: 'LOAD_STATE', state: loaded })}
            onOpenHelp={() => setHelpOpen(true)}
            onSetTheme={(theme) => updateSettings({ theme })}
          />
        );
      }
      return <GameScreen game={state.game} />;

    case 'menu':
    default:
      return (
        <>
          <MainMenu
            theme={settings.theme}
            onNewGame={() => dispatch({ type: 'GO_TO', screen: 'scenario' })}
            onLoadGame={(loaded) => dispatch({ type: 'LOAD_STATE', state: loaded })}
            onOpenHelp={() => setHelpOpen(true)}
            onSetTheme={(theme) => updateSettings({ theme })}
          />
          {help}
          {state.notification ? (
            <div className="toast" role="status">
              {state.notification}
            </div>
          ) : null}
        </>
      );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="app-shell">
        <Screens />
      </div>
    </ErrorBoundary>
  );
}
