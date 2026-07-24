export function DemoPageBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25px 25px, white 1px, transparent 0)",
          backgroundSize: "50px 50px",
        }}
      />

      <svg
        className="absolute -right-24 top-1/2 h-[120%] w-[70%] -translate-y-1/2 opacity-30"
        viewBox="0 0 600 600"
        fill="none"
      >
        {[
          [120, 80],
          [280, 140],
          [420, 90],
          [180, 260],
          [360, 220],
          [500, 300],
          [240, 380],
          [400, 420],
          [140, 480],
          [320, 520],
        ].map(([x, y], index) => (
          <g key={`${x}-${y}`}>
            {index < 9 && (
              <line
                x1={x}
                y1={y}
                x2={
                  [
                    [280, 140],
                    [420, 90],
                    [180, 260],
                    [360, 220],
                    [500, 300],
                    [240, 380],
                    [400, 420],
                    [140, 480],
                    [320, 520],
                  ][index][0]
                }
                y2={
                  [
                    [280, 140],
                    [420, 90],
                    [180, 260],
                    [360, 220],
                    [500, 300],
                    [240, 380],
                    [400, 420],
                    [140, 480],
                    [320, 520],
                  ][index][1]
                }
                stroke="#10b981"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
            )}
            <circle cx={x} cy={y} r="4" fill="#10b981" fillOpacity="0.5" />
          </g>
        ))}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary via-brand-secondary to-emerald-950/40" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-emerald-500/10 to-transparent" />
    </div>
  );
}
