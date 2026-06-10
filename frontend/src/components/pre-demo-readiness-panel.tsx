import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { ReadinessCheck, usePreDemoReadiness } from "@/hooks/usePreDemoReadiness";
import { DemoManifest } from "@/hooks/useDemoManifest";

interface PreDemoReadinessPanelProps {
  manifest: DemoManifest | null;
  pool: `0x${string}` | undefined;
  presentMode?: boolean;
}

function StatusIcon({ status }: { status: ReadinessCheck["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-4 w-4 text-white" />;
    case "fail":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "loading":
      return <Loader2 className="h-4 w-4 animate-spin text-white/50" />;
  }
}

export function PreDemoReadinessPanel({ manifest, pool, presentMode }: PreDemoReadinessPanelProps) {
  const { checks, allPass } = usePreDemoReadiness(manifest, pool);

  if (presentMode) return null;

  return (
    <div className={`mb-6 rounded-lg border p-4 ${allPass ? "border-white/10 bg-white/5" : "border-red-500/20 bg-red-500/5"}`}>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-medium text-white">Pre-Flight Checklist</h3>
        {allPass ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">Ready for Demo</span>
        ) : (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">Action Required</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center justify-between rounded bg-white/[0.02] p-2.5">
            <div className="flex items-center gap-3">
              <StatusIcon status={check.status} />
              <div>
                <p className="text-xs font-medium text-white/90">{check.label}</p>
                {check.detail && <p className="text-[10px] text-white/50">{check.detail}</p>}
              </div>
            </div>
            {check.action && (
              <button
                onClick={check.action.onClick}
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white hover:bg-white/10"
              >
                {check.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
