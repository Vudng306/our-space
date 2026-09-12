/**
 * Little pencil marks.
 *
 * Drawn as open strokes with round caps and slightly imperfect paths, so they
 * read as something sketched in a margin rather than an icon set. All of them
 * inherit `currentColor` and are hidden from screen readers.
 */

type DoodleProps = { size?: number; className?: string; strokeWidth?: number };

export function HeartDoodle({ size = 22, className, strokeWidth = 1.6 }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 24 22"
      width={size}
      height={(size * 22) / 24}
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M12 20C9.4 17.7 3.2 13.6 2.3 9.2 1.6 5.7 4 2.6 7.1 2.7c2.2.1 3.9 1.7 4.8 3.5.8-1.9 2.5-3.6 4.8-3.6 3.2 0 5.5 3.2 4.7 6.7-1 4.3-7 8.3-9.4 10.7z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleDoodle({ size = 18, className, strokeWidth = 1.5 }: DoodleProps) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden className={className}>
      <path
        d="M10 2.2c.5 3.4 1.9 5.4 5.6 6.1-3.6.8-5 2.8-5.5 6.2-.6-3.4-2-5.4-5.6-6.1 3.6-.8 5-2.8 5.5-6.2z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M16.4 13.6c.2 1.3.7 2 2.1 2.3-1.3.3-1.9 1-2.1 2.3-.2-1.3-.7-2-2.1-2.3 1.4-.3 1.9-1 2.1-2.3z" stroke="currentColor" strokeWidth={strokeWidth - 0.3} strokeLinejoin="round" />
    </svg>
  );
}

/** A hand-drawn ring, used around avatars. */
export function RingDoodle({ size = 64, className, strokeWidth = 1.6 }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden className={className}>
      <path
        d="M50 4c26 0 46 20.5 46 46.5S75.5 96 49 96 3 76.5 3 49.5 24 4 50 4z"
        stroke="currentColor"
        strokeWidth={strokeWidth * 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A squiggle that separates two things without shouting. */
export function SquiggleDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 10" width="96" height="10" fill="none" aria-hidden className={className}>
      <path
        d="M2 6c6-5.5 12 3.6 18-.4 6-4 12 5 18 1s12-5.5 18-1.6 12 4 20 1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Two hearts and a stroke between them: the pair, drawn. */
export function TwoHearts({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg viewBox="0 0 62 24" width="62" height="24" fill="none">
        <path
          d="M14 20.5C11.4 18.4 5.6 14.7 4.8 10.7 4.2 7.5 6.3 4.7 9.2 4.8c2 .1 3.5 1.6 4.3 3.2.8-1.7 2.3-3.3 4.4-3.3 2.9 0 5 2.9 4.3 6.1-.9 3.9-6.4 7.6-8.2 9.7z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M48 20.5c-2.6-2.1-8.4-5.8-9.2-9.8-.6-3.2 1.5-6 4.4-5.9 2 .1 3.5 1.6 4.3 3.2.8-1.7 2.3-3.3 4.4-3.3 2.9 0 5 2.9 4.3 6.1-.9 3.9-6.4 7.6-8.2 9.7z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M26 12.5c3.5-1.2 6.5-1.2 10 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
