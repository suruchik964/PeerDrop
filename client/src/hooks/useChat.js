import { useState } from "react";

export function useChat(channelRef) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  function addMessage(from, content) {
    setMessages((m) => [...m, { from, text: content }]);
  }

  function sendMessage() {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open" || !text.trim()) return;
    channel.send(JSON.stringify({ type: "chat", text }));
    addMessage("me", text);
    setText("");
  }

  function onIncoming(msg) {
    addMessage("them", msg.text);
  }

  return { messages, text, setText, sendMessage, addMessage, onIncoming };
}
