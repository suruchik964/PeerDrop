export default function ChatBox({ messages, text, setText, onSend }) {
  return (
    <div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message"
      />
      <button onClick={onSend}>Send</button>

      <ul>
        {messages.map((m, i) => (
          <li key={i}>
            <b>{m.from === "me" ? "You" : "Them"}:</b> {m.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
