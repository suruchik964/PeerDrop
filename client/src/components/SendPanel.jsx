import { useRef, useState } from "react";
import ProgressBar from "./ProgressBar";

export default function SendPanel({
  connected,
  onSend,
  progress,
  notice,
  busy,
  onCancel,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files) {
    if (files && files[0]) onSend(files[0]);
  }

  let zoneStyle;
  if (!connected)
    zoneStyle = "cursor-not-allowed border-slate-800 text-slate-600";
  else if (dragging)
    zoneStyle = "cursor-pointer border-indigo-400 bg-indigo-500/10";
  else zoneStyle = "cursor-pointer border-slate-700 hover:border-indigo-500";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-lg font-semibold">Send a file</h2>

      <div
        onClick={() => connected && inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (connected) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (connected) handleFiles(e.dataTransfer.files);
        }}
        className={`flex h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition ${zoneStyle}`}
      >
        <p className="text-4xl">📤</p>
        <p className="mt-2 font-medium">
          {connected
            ? "Drop a file here, or click to choose"
            : "Waiting for the other device to connect"}
        </p>
        {connected && (
          <p className="mt-1 text-xs text-slate-500">Up to 300 MB for now</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // so choosing the same file again still works
        }}
      />

      {notice && <p className="mt-3 text-sm text-amber-400">{notice}</p>}
      {progress !== null && <ProgressBar label="Sending" percent={progress} />}

      {busy && (
        <button
          onClick={onCancel}
          className="mt-3 rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium hover:bg-slate-600"
        >
          Cancel transfer
        </button>
      )}
    </div>
  );
}
