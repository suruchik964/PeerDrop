export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <circle cx="6" cy="15" r="4.5" fill="#818cf8" />
        <circle cx="24" cy="15" r="4.5" fill="#818cf8" />
        <path
          d="M11 15h8"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 4"
        />
      </svg>
      <span className="text-xl font-bold tracking-tight">PeerDrop</span>
    </div>
  );
}
