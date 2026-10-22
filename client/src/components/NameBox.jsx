import { useState } from "react";

export default function NameBox({ me, onSave }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onSave(value);
    setValue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left"
    >
      <label className="text-sm text-slate-400">Your name</label>
      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={me ? me.name : "Connecting..."}
          maxLength={20}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {me ? `Showing as ${me.name}` : ""}
        {me?.device ? ` · ${me.device}` : ""}
      </p>
    </form>
  );
}
