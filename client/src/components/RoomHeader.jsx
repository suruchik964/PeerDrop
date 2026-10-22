import { useState } from "react";
import Logo from "./Logo";

export default function RoomHeader({ room, onLeave }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be blocked, so do nothing
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
      <Logo />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-slate-400">Room</p>
          <p className="font-mono text-lg font-bold tracking-widest">{room}</p>
        </div>
        <button
          onClick={copyCode}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={onLeave}
          className="rounded-lg bg-red-600/80 px-3 py-2 text-sm font-medium hover:bg-red-600"
        >
          Leave
        </button>
      </div>
    </header>
  );
}
