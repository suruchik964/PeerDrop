import { formatSize } from "../utils/formatSize";

export default function FileTransfer({ file }) {
  return (
    <div>
      <p>
        Send a file: <input type="file" onChange={file.sendFile} />
      </p>

      {file.incomingOffer && (
        <div
          style={{ border: "1px solid #999", padding: 12, margin: "12px 0" }}
        >
          <p>
            <b>Incoming file:</b> {file.incomingOffer.name} (
            {formatSize(file.incomingOffer.size)})
          </p>
          <button onClick={() => file.respondToOffer(true)}>Accept</button>{" "}
          <button onClick={() => file.respondToOffer(false)}>Decline</button>
        </div>
      )}

      {file.sendProgress !== null && (
        <p>
          Sending: {file.sendProgress}%{" "}
          <progress value={file.sendProgress} max="100" />
        </p>
      )}
      {file.receiveProgress !== null && (
        <p>
          Receiving: {file.receiveProgress}%{" "}
          <progress value={file.receiveProgress} max="100" />
        </p>
      )}

      <h3>Received files</h3>
      <ul>
        {file.received.map((f, i) => (
          <li key={i}>
            <a href={f.url} download={f.name}>
              {f.name}
            </a>{" "}
            ({formatSize(f.size)})
          </li>
        ))}
      </ul>
    </div>
  );
}
