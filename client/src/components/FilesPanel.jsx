import { formatSize } from "../utils/formatSize";
import ProgressBar from "./ProgressBar";

function statusColor(status) {
  if (status === "Sent") return "text-green-400";
  if (status === "Declined" || status === "Failed") return "text-red-400";
  return "text-amber-400";
}

export default function FilesPanel({ file }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-4 text-lg font-semibold">Files</h2>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Sent
        </h3>
        {file.sent.length === 0 && (
          <p className="text-sm text-slate-500">Nothing sent yet.</p>
        )}
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {file.sent.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">{s.name}</p>
                <p className="text-xs text-slate-400">{formatSize(s.size)}</p>
              </div>
              <span className={`shrink-0 text-xs ${statusColor(s.status)}`}>
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Received
        </h3>
        {file.receiveProgress !== null && (
          <div>
            <ProgressBar label="Receiving" percent={file.receiveProgress} />
            <button
              onClick={file.cancelReceiving}
              className="mt-2 text-xs text-red-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        {file.received.length === 0 && file.receiveProgress === null && (
          <p className="text-sm text-slate-500">Nothing received yet.</p>
        )}
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {file.received.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-800 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                {f.verified === false ? (
                  <p className="truncate">{f.name}</p>
                ) : (
                  <a
                    href={f.url}
                    download={f.name}
                    className="block truncate text-indigo-400 hover:underline"
                  >
                    {f.name}
                  </a>
                )}
                <p className="text-xs text-slate-400">{formatSize(f.size)}</p>
              </div>

              {f.verified === true && (
                <span className="shrink-0 text-xs text-green-400">
                  ✔ Verified
                </span>
              )}
              {f.verified === false && (
                <span className="shrink-0 text-xs text-red-400">
                  ✘ Corrupted
                </span>
              )}
              {f.verified === null && (
                <span className="shrink-0 text-xs text-slate-400">
                  Not verified
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
