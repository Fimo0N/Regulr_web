import { useState } from 'react';

export type Bar = { label: string; tooltip: string; value: number };

/**
 * A single-series bar chart: thin bars with rounded tops on a shared baseline, a quiet
 * max-value guide, a few x-axis labels, and a tooltip for whichever bar is hovered or
 * focused. Each bar's hit area is the full column, so small bars are easy to hover.
 */
export function BarChart({ bars, title, summary, tickEvery }: { bars: Bar[]; title: string; summary: string; tickEvery: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const shown = active !== null ? bars[active] : null;

  return (
    <figure className="chart">
      <figcaption className="chart-title">{title}</figcaption>
      <div className="chart-plot" role="img" aria-label={summary} onMouseLeave={() => setActive(null)}>
        <span className="chart-guide">{max}</span>
        <div className="chart-bars">
          {bars.map((b, i) => (
            <div
              key={b.label + i}
              className={`chart-col${active === i ? ' active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              aria-label={b.tooltip}
            >
              <div className="chart-bar" style={{ height: `${(b.value / max) * 100}%` }} />
            </div>
          ))}
        </div>
        {shown && (
          <div className="chart-tip" style={{ left: `${((active! + 0.5) / bars.length) * 100}%` }}>
            {shown.tooltip}
          </div>
        )}
      </div>
      <div className="chart-axis">
        {bars.map((b, i) => (
          <span key={b.label + i}>{(bars.length - 1 - i) % tickEvery === 0 ? b.label : ''}</span>
        ))}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <table>
          <tbody>
            {bars.map((b, i) => (
              <tr key={b.label + i}>
                <td>{b.tooltip.split(' · ')[0]}</td>
                <td>{b.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
