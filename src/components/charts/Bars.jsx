// Grafico a barre minimale, SVG inline: niente libreria nuova (il progetto
// non ne ha già una, e un'app offline-first non deve appesantirsi per due
// grafici a barre). Una forma sola copre due usi diversi:
//   - barre AFFIANCATE (lordo/netto): ogni categoria ha più `bars`, ciascuna
//     con un solo segmento;
//   - barre IMPILATE (ore ordinarie/supplementari): ogni categoria ha una
//     sola `bars`, con più `segments`.
//
// data: [{ label, bars: [{ segments: [{ value, color, title? }] }] }]

const CATEGORY_WIDTH = 44; // px per mese nel viewBox — sotto lo scroll orizzontale se serve
const CHART_HEIGHT = 140;
const TOP_PADDING = 12; // spazio sopra la barra più alta, per non tagliarla a filo

export default function Bars({ data, formatValue = (n) => String(n), emptyLabel = 'Nessun dato' }) {
  const maxTotal = data.reduce((max, cat) => {
    const catMax = cat.bars.reduce((m, bar) => {
      const total = bar.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
      return Math.max(m, total);
    }, 0);
    return Math.max(max, catMax);
  }, 0);

  if (maxTotal <= 0) {
    return <p className="stats-chart-empty">{emptyLabel}</p>;
  }

  const scale = (CHART_HEIGHT - TOP_PADDING) / maxTotal;
  const width = data.length * CATEGORY_WIDTH;
  const barsPerCategory = Math.max(1, ...data.map(c => c.bars.length));
  const barWidth = (CATEGORY_WIDTH - 8) / barsPerCategory;

  return (
    <div className="stats-chart-scroll">
      <svg
        className="stats-chart-svg"
        viewBox={`0 0 ${width} ${CHART_HEIGHT + 20}`}
        width={width}
        height={CHART_HEIGHT + 20}
        role="img"
        aria-label="Grafico a barre"
      >
        <line x1={0} y1={CHART_HEIGHT} x2={width} y2={CHART_HEIGHT} className="stats-chart-axis" />
        {data.map((cat, i) => {
          const catX = i * CATEGORY_WIDTH + 4;
          return (
            <g key={cat.label}>
              {cat.bars.map((bar, bi) => {
                let y = CHART_HEIGHT;
                const x = catX + bi * barWidth;
                return (
                  <g key={bi}>
                    {bar.segments.map((seg, si) => {
                      const h = Math.max(0, seg.value) * scale;
                      y -= h;
                      const label = seg.title || `${cat.label}: ${formatValue(seg.value)}`;
                      return (
                        <rect
                          key={si}
                          x={x}
                          y={y}
                          width={Math.max(0, barWidth - 2)}
                          height={h}
                          fill={seg.color}
                          rx={1.5}
                        >
                          <title>{label}</title>
                        </rect>
                      );
                    })}
                  </g>
                );
              })}
              <text
                x={catX + (barWidth * barsPerCategory) / 2}
                y={CHART_HEIGHT + 15}
                className="stats-chart-label"
                textAnchor="middle"
              >
                {cat.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
