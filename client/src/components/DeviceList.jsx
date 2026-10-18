export default function DeviceList({ others, onConnect, peerStatus }) {
  return (
    <div>
      <h3>Other devices in this room</h3>
      {others.length === 0 && <p>Waiting for others to join...</p>}
      <ul>
        {others.map((d) => (
          <li key={d.id}>
            {d.name} <button onClick={() => onConnect(d.id)}>Connect</button>
          </li>
        ))}
      </ul>
      <p>
        <b>Direct connection:</b> {peerStatus}
      </p>
    </div>
  );
}
