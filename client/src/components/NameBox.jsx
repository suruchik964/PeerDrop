import { useState } from "react";

export default function NameBox({ me, onSave }) {
  const [value, setValue] = useState("");

  return (
    <div>
      <p>
        You are <b>{me ? me.name : "..."}</b>
        {me?.device && <span> · {me.device}</span>}
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Change your name"
        maxLength={20}
      />
      <button
        onClick={() => {
          onSave(value);
          setValue("");
        }}
      >
        Save name
      </button>
    </div>
  );
}
