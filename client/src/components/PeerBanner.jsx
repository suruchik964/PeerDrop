export default function PeerBanner({ other, peerStatus }) {
  let text;
  let style;

  if (!other) {
    text = "Waiting for someone to join. Share the room code with them.";
    style = "border-slate-800 bg-slate-900 text-slate-300";
  } else if (peerStatus === "Connected directly!") {
    text = `Connected directly to ${other.name}${other.device ? ` (${other.device})` : ""}`;
    style = "border-green-500/30 bg-green-500/10 text-green-300";
  } else if (
    ["Connection failed", "Disconnected", "Channel closed"].includes(peerStatus)
  ) {
    text = `There is a problem with the connection to ${other.name}. Try leaving and rejoining the room.`;
    style = "border-red-500/30 bg-red-500/10 text-red-300";
  } else {
    text = `Connecting to ${other.name}...`;
    style = "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{text}</div>
  );
}
