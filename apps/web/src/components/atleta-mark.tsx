/** Anillo PR: el icono de la marca. Siempre azul y dorado de la marca, no toma el color del equipo. */
export function AtletaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="30" fill="none" stroke="hsl(var(--primary))" strokeOpacity=".2" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="154.6 400"
        transform="rotate(-90 50 50)"
      />
      <circle cx="22.86" cy="37.23" r="7.5" fill="hsl(var(--gold))" stroke="hsl(var(--background))" strokeWidth="2.5" />
      <polyline
        points="40,57 50,45 60,57"
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
