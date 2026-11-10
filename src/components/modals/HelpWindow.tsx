/**
 * Spielhilfe: Ablauf einer Runde, Kampfrechnung, Diplomatie und Tastenkürzel.
 */
import { Icon } from '../ui/Icon';
import { Window } from '../ui/Window';

const PHASES = [
  'Einnahmen, Rohstoffe und politische Macht',
  'Bevölkerung, Zufriedenheit und Unruhe',
  'Forschung und fertige Bauvorhaben',
  'Innere Lage: Desertion, Aufstände, Abspaltungen',
  'Züge der anderen Mächte',
  'Ereignisse',
  'Siegprüfung und neue Aktionspunkte'
];

const KEYS: [string, string][] = [
  ['Leertaste', 'Runde beenden'],
  ['1 bis 6', 'Bereiche des Dossiers'],
  ['D', 'Dossier ein- und ausklappen'],
  ['K', 'Kartenansicht wechseln'],
  ['+ und -', 'Karte vergrössern und verkleinern'],
  ['0', 'Ansicht zurücksetzen'],
  ['B', 'Bewegen, wenn ein eigenes Gebiet gewählt ist'],
  ['A', 'Angreifen, wenn ein eigenes Gebiet gewählt ist'],
  ['Esc', 'Aktion abbrechen oder Fenster schließen'],
  ['?', 'Diese Hilfe']
];

export function HelpWindow({ onClose }: { onClose: () => void }) {
  return (
    <Window
      title="Spielhilfe"
      icon="help"
      onClose={onClose}
      wide
      footer={
        <button type="button" className="primary" onClick={onClose}>
          Verstanden
        </button>
      }
    >
      <p className="lede">
        Du führst ein Land auf einer Karte aus einzelnen Gebieten. Jede Runde hast du
        Aktionspunkte, Gold und Rohstoffe - und mehr Vorhaben, als beides erlaubt. Darin liegt
        das Spiel.
      </p>

      <div className="section-title">So läuft eine Runde</div>
      <p>
        Du handelst frei, solange Aktionspunkte reichen: Truppen ausheben, verlegen, angreifen,
        Gebiete ausbauen, Gesandte schicken, forschen. Mit <strong>Runde beenden</strong> werden
        dann in dieser Reihenfolge verarbeitet:
      </p>
      <ol className="stack tight" style={{ paddingLeft: '1.2rem', margin: 0 }}>
        {PHASES.map((phase) => (
          <li key={phase} style={{ fontSize: '0.9rem' }}>
            {phase}
          </li>
        ))}
      </ol>

      <div className="section-title">Kampf</div>
      <p>Jede Schlacht wird in Runden ausgerechnet. Es gilt:</p>
      <pre
        className="panel sunk"
        style={{ padding: '0.6rem', overflowX: 'auto', fontSize: '0.8rem', lineHeight: 1.6 }}
      >
{`Angriffskraft     = Truppen (nach Gattung und Gelände)
                  x Technologie x Moral x Versorgung
                  x Feldherr x Kaserne x Regierungsform x Zufall

Verteidigungskraft = Truppen (nach Gattung und Gelände)
                  x Technologie x Moral x Gelände
                  x Befestigung (gesenkt durch Belagerung)
                  x Versorgung x Feldherr x Regierungsform x Zufall`}
      </pre>
      <p className="faint">
        Der Zufall liegt zwischen 0,85 und 1,15. Er kann eine Schlacht kippen, aber niemals ein
        klares Kräfteverhältnis umdrehen. Jeder Bericht zeigt alle Faktoren einzeln.
      </p>

      <div className="section-title">Gattungen</div>
      <div className="grid two">
        <p style={{ fontSize: '0.88rem' }}>
          <Icon name="infantry" size={14} /> <strong>Infanterie</strong> hält Stellungen, stark im
          Wald und im Gebirge.
        </p>
        <p style={{ fontSize: '0.88rem' }}>
          <Icon name="cavalry" size={14} /> <strong>Kavallerie</strong> schlägt in der Ebene und in
          der Steppe zu, taugt kaum im Sumpf.
        </p>
        <p style={{ fontSize: '0.88rem' }}>
          <Icon name="artillery" size={14} /> <strong>Artillerie</strong> bricht Befestigungen,
          braucht aber Schutz.
        </p>
        <p style={{ fontSize: '0.88rem' }}>
          <Icon name="fleet" size={14} /> <strong>Flotten</strong> verbinden Häfen, blockieren
          Küsten und tragen Landtruppen über See.
        </p>
      </div>

      <div className="section-title">Bauen</div>
      <p>
        Jedes Gebiet führt eine eigene Bauschlange mit bis zu drei Vorhaben. Gebaut wird immer
        nur am vordersten, die übrigen warten. Bezahlt wird beim Vormerken: Nimmst du ein noch
        nicht begonnenes Vorhaben wieder heraus, bekommst du alles zurück, beim laufenden die
        Hälfte. Mit politischer Macht lässt sich das vorderste Vorhaben sofort abschließen.
        Großprojekte entstehen weiterhin nur eines gleichzeitig im ganzen Reich.
      </p>

      <div className="section-title">Versorgung</div>
      <p>
        Jedes Gebiet versorgt nur eine begrenzte Truppenzahl. Darüber verliert die Armee jede
        Runde Einheiten und kämpft schlechter. Straßen, Lager und Infrastruktur erhöhen die
        Grenze, Wüste und Gebirge senken sie.
      </p>

      <div className="section-title">Krieg und Frieden</div>
      <p>
        Ein Angriff braucht immer eine Kriegserklärung. Ein Anspruch auf ein Grenzgebiet
        rechtfertigt den Krieg und schont dein Ansehen. Im Krieg wächst der Kriegsfortschritt
        durch Siege und Eroberungen - er bestimmt, welche Forderungen die Gegenseite im Frieden
        annimmt. Bündnispartner werden mit hineingezogen, und gegen eine zu große Macht bilden
        sich Koalitionen.
      </p>

      <div className="section-title">Tastenkürzel</div>
      <table className="ledger">
        <tbody>
          {KEYS.map(([key, description]) => (
            <tr key={key}>
              <td style={{ width: '9rem' }}>
                <strong>{key}</strong>
              </td>
              <td style={{ textAlign: 'left' }}>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">Rat des Reichsrats</div>
      <p className="faint">
        Die Leiste unter der Karte meldet, was gerade schiefgeht oder möglich ist. Ein Klick
        darauf springt an die Stelle, an der du es beheben kannst.
      </p>
    </Window>
  );
}
