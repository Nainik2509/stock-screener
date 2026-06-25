/** Connection state to the /api/stream SSE feed. */
export type ConnectionStatus = "connecting" | "live" | "polling" | "error";

function getConfig(status: ConnectionStatus) {
  const configs = {
    connecting: {
      label: "Connecting…",
      pulse: false,
      dotCls: "bg-slate-400",
      textCls: "text-slate-500 dark:text-slate-400",
    },
    live: {
      label: "Live",
      pulse: true,
      dotCls: "bg-green-500",
      textCls: "text-green-600 dark:text-green-400",
    },
    polling: {
      label: "Delayed",
      pulse: false,
      dotCls: "bg-amber-400",
      textCls: "text-amber-600 dark:text-amber-400",
    },
    error: {
      label: "Reconnecting…",
      pulse: false,
      dotCls: "bg-red-400",
      textCls: "text-red-600 dark:text-red-400",
    },
  };
  return configs[status];
}

interface Props {
  status: ConnectionStatus;
}

export function StatusBadge({ status }: Props) {
  const cfg = getConfig(status);
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`size-2 rounded-full ${cfg.dotCls} ${cfg.pulse ? "animate-pulse" : ""}`}
      />
      <span className={`text-xs font-medium ${cfg.textCls}`}>{cfg.label}</span>
    </span>
  );
}
