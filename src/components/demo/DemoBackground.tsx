export function DemoBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-br from-[#152233] via-[#152233] to-[#0f1a28]" />

      <div className="absolute right-0 top-1/4 h-[520px] w-[520px] -translate-y-1/2 translate-x-1/4 rounded-full bg-[#10b981]/12 blur-3xl" />

      <svg
        className="absolute right-0 top-0 h-full w-[45%] opacity-[0.12]"
        viewBox="0 0 400 800"
        fill="none"
      >
        {[
          [80, 120], [180, 80], [280, 140], [120, 260], [240, 220], [340, 300],
          [160, 380], [300, 420], [100, 520], [260, 560], [200, 680],
        ].map(([x, y], i, arr) => (
          <g key={`${x}-${y}`}>
            {i < arr.length - 1 && (
              <line
                x1={x}
                y1={y}
                x2={arr[i + 1][0]}
                y2={arr[i + 1][1]}
                stroke="#10b981"
                strokeWidth="1"
              />
            )}
            <circle cx={x} cy={y} r="3" fill="#10b981" />
          </g>
        ))}
      </svg>

      <div
        className="absolute bottom-0 left-0 h-1/2 w-1/2 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20px 20px, #10b981 1px, transparent 0)",
          backgroundSize: "36px 36px",
        }}
      />

      <svg
        className="absolute bottom-8 left-8 h-24 w-48 opacity-[0.08]"
        viewBox="0 0 200 60"
        fill="none"
      >
        <path
          d="M0 30 C 30 10, 60 50, 90 30 S 150 10, 200 30"
          stroke="#10b981"
          strokeWidth="2"
        />
        <path
          d="M0 40 C 30 20, 60 55, 90 38 S 150 18, 200 38"
          stroke="#10b981"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
