import { ArrowUp, LocateFixed } from 'lucide-react';
import styles from './SiteMap.module.scss';

export type Basemap = 'terrain' | 'satellite';

interface SiteMapProps {
  jobRef: string;
  variant: 'preview' | 'full';
  basemap: Basemap;
  onBasemapChange: (basemap: Basemap) => void;
  /** Preview only: re-centre on the device GPS. */
  onLocate?: () => void;
  /** Job coordinates from the backend; when given, a live map centred on them replaces the illustration. */
  location?: { latitude: number; longitude: number };
}

// Illustration coordinates (the Figma map frame, 716 wide). The pin sits on Bourke Street.
const VIEW_FULL = '0 0 716 884';
const VIEW_PREVIEW = '0 240 716 560';
const PIN = { x: 343, y: 471 };

const BLOCK_COLUMNS = [22, 100, 200, 273, 345];
const BLOCK_ROWS = [301, 425, 549, 673];

const STREET_LABELS: { text: string; x: number; y: number; strong?: boolean }[] = [
  { text: 'Exhibition St', x: 134, y: 172 },
  { text: 'Lonsdale Street', x: 10, y: 270 },
  { text: 'Little Bourke Street', x: 10, y: 394 },
  { text: 'Bourke Street', x: 10, y: 518, strong: true },
  { text: 'Little Collins Street', x: 10, y: 642 },
  { text: 'Collins Street', x: 10, y: 766 },
  { text: 'Princess Theatre', x: 346, y: 349 },
  { text: 'Spring St', x: 407, y: 570 },
];

/**
 * Stylised site map (matches the Figma illustration). It is a static drawing, not a live map:
 * a real tile map is tracked in docs/surveyor-backlog.md.
 */
export function SiteMap({ jobRef, variant, basemap, onBasemapChange, onLocate, location }: Readonly<SiteMapProps>) {
  const isPreview = variant === 'preview';
  const pinWidth = 40 + jobRef.length * 7.6;

  return (
    <div className={[styles.map, styles[basemap], isPreview ? styles.preview : styles.full].join(' ')}>
      {location ? (
        <iframe
          className={styles.svg}
          title={`Map of the site for ${jobRef}`}
          src={`https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=17&t=${basemap === 'satellite' ? 'k' : 'm'}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
      <svg
        className={styles.svg}
        viewBox={isPreview ? VIEW_PREVIEW : VIEW_FULL}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Map of the site for ${jobRef}`}
      >
        {BLOCK_ROWS.flatMap((y) =>
          BLOCK_COLUMNS.map((x) => (
            <rect key={`${x}-${y}`} className={styles.block} x={x} y={y} width={51} height={58} rx={6} />
          )),
        )}

        <g className={styles.streets}>
          <line x1={168} y1={268} x2={434} y2={266} />
          <line x1={175} y1={380} x2={428} y2={378} />
          <line x1={181} y1={510} x2={436} y2={508} />
          <line x1={185} y1={636} x2={440} y2={634} />
          <line x1={186} y1={754} x2={446} y2={750} />
          <line x1={168} y1={268} x2={186} y2={754} />
          <line x1={315} y1={268} x2={329} y2={752} />
          <line x1={427} y1={266} x2={445} y2={750} />
        </g>

        <rect className={styles.park} x={435} y={244} width={134} height={194} rx={14} />
        <rect className={styles.park} x={446} y={608} width={134} height={194} rx={14} />
        <text className={styles.parkLabel} x={451} y={289}>
          Parliament Gardens
        </text>
        <text className={styles.parkLabel} x={452} y={670}>
          Treasury Gardens
        </text>

        {STREET_LABELS.map((label) => (
          <text
            key={label.text}
            className={label.strong ? styles.labelStrong : styles.label}
            x={label.x}
            y={label.y}
          >
            {label.text}
          </text>
        ))}

        <circle className={styles.halo} cx={PIN.x} cy={PIN.y} r={15} />
        <circle className={styles.dot} cx={PIN.x} cy={PIN.y} r={6} />
        <g transform={`translate(${PIN.x - 20} ${PIN.y - 33})`}>
          <rect className={styles.pin} width={pinWidth} height={30} rx={8} />
          <g className={styles.pinIcon} transform="translate(9 6) scale(0.75)">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx={12} cy={10} r={3} />
          </g>
          <text className={styles.pinText} x={34} y={20}>
            {jobRef}
          </text>
        </g>

        {!isPreview && (
          <g className={styles.scale} transform="translate(10 800)">
            <rect width={54} height={22} rx={4} />
            <text x={10} y={15}>
              100 m
            </text>
          </g>
        )}
      </svg>
      )}

      <div className={styles.basemap} role="group" aria-label="Map type">
        {(['terrain', 'satellite'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={[styles.basemapButton, basemap === type ? styles.basemapActive : ''].filter(Boolean).join(' ')}
            aria-pressed={basemap === type}
            onClick={() => onBasemapChange(type)}
          >
            {type === 'terrain' ? 'Terrain' : 'Satellite'}
          </button>
        ))}
      </div>

      {isPreview ? (
        <button type="button" className={styles.locate} onClick={onLocate} aria-label="Use my current location">
          <LocateFixed size={20} aria-hidden="true" />
        </button>
      ) : (
        <div className={styles.compass} aria-hidden="true">
          <span>N</span>
          <ArrowUp size={16} />
        </div>
      )}
    </div>
  );
}
