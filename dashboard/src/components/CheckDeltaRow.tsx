import type { CheckDelta } from "../api/types";

const KIND_LABEL: Record<string, string> = {
  test: "Tests",
  type: "Type errors",
  lint: "Lint errors",
  coverage: "Coverage",
};

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const isGood = invert ? value < 0 : value > 0;
  const isBad  = invert ? value > 0 : value < 0;
  const color  = isGood ? "var(--score-hi)" : isBad ? "var(--score-lo)" : "var(--text-dim)";
  const prefix = value > 0 ? "+" : "";

  return (
    <span
      className="mono-sm font-semibold"
      style={{ color, fontFamily: "JetBrains Mono, monospace" }}
    >
      {prefix}{value}
    </span>
  );
}

function CoverageDelta({ value }: { value: number }) {
  const color = value >= 0 ? "var(--score-hi)" : "var(--score-lo)";
  const prefix = value > 0 ? "+" : "";
  return (
    <span className="mono-sm font-semibold" style={{ color, fontFamily: "JetBrains Mono, monospace" }}>
      {prefix}{value.toFixed(1)}%
    </span>
  );
}

interface Props {
  delta: CheckDelta;
}

export default function CheckDeltaRow({ delta }: Props) {
  const label = KIND_LABEL[delta.kind] ?? delta.kind;
  const b = delta.baseline;
  const f = delta.final;

  return (
    <div
      className="flex items-center gap-4 py-2 px-3 rounded"
      style={{ background: "var(--bg-overlay)", border: "1px solid var(--border)" }}
    >
      <p
        className="w-24 shrink-0 text-sm font-medium"
        style={{ fontFamily: "Archivo, sans-serif", color: "var(--text-muted)" }}
      >
        {label}
      </p>

      <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
        {/* Baseline */}
        <div>
          <p className="label mb-0.5">Before</p>
          <p className="mono-sm" style={{ color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
            {b ? `${b.passed}/${b.total}` : "—"}
            {b?.coverage_pct !== null && b?.coverage_pct !== undefined ? ` · ${b.coverage_pct.toFixed(1)}%` : ""}
          </p>
        </div>

        {/* Final */}
        <div>
          <p className="label mb-0.5">After</p>
          <p className="mono-sm" style={{ color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
            {f ? `${f.passed}/${f.total}` : "—"}
            {f?.coverage_pct !== null && f?.coverage_pct !== undefined ? ` · ${f.coverage_pct.toFixed(1)}%` : ""}
          </p>
        </div>

        {/* Delta */}
        <div>
          <p className="label mb-0.5">Delta</p>
          <div className="space-x-2">
            {delta.kind !== "coverage" && (
              <>
                <Delta value={delta.passed_delta} />
                {delta.failed_delta !== 0 && (
                  <Delta value={delta.failed_delta} invert />
                )}
              </>
            )}
            {delta.coverage_delta !== null && (
              <CoverageDelta value={delta.coverage_delta} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
