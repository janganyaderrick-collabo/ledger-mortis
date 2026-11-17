import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { nextTheme, isLightsOn } from './theme';
import type { Theme } from './theme';
import './LandingScreen.css';

export function LandingScreen(): ReactElement {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <main className="landing">
      <h1>Ledger Mortis</h1>
      <p className="landing__tagline">Paste your transactions. Summon the ghosts of your money.</p>
      <button
        type="button"
        className="lights-on-toggle"
        aria-pressed={isLightsOn(theme)}
        onClick={() => setTheme((t) => nextTheme(t))}
      >
        Lights-On mode
        <span className="lights-on-toggle__state" aria-hidden="true">
          {isLightsOn(theme) ? 'On' : 'Off'}
        </span>
      </button>
    </main>
  );
}
