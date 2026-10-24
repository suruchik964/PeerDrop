export default function ServerBanner({ online }) {
  if (online) return null;
  return (
    <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium">
      Lost connection to the server. Trying to reconnect...
    </div>
  );
}
