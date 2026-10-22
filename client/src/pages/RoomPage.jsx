import { useRef } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useFileTransfer } from "../hooks/useFileTransfer";
import { usePeerConnection } from "../hooks/usePeerConnection";
import DeviceList from "../components/DeviceList";
import ChatBox from "../components/ChatBox";
import FileTransfer from "../components/FileTransfer";

export default function RoomPage({ roomState }) {
  const { code } = useParams(); // the code from the address bar
  const channelRef = useRef(null);

  const chat = useChat(channelRef);
  const file = useFileTransfer(channelRef, chat.addMessage);

  function handleMessage(e) {
    if (typeof e.data === "string") {
      const msg = JSON.parse(e.data);
      if (msg.type === "chat") chat.onIncoming(msg);
      else file.onIncomingText(msg);
    } else {
      file.onIncomingChunk(e.data);
    }
  }

  const { peerStatus, connectTo } = usePeerConnection(
    channelRef,
    handleMessage,
  );

  // Not in this room (reload, Leave button, wrong address)? Go back to the landing page
  if (roomState.room !== code) return <Navigate to="/" replace />;

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <header>
        <b style={{ fontSize: 22 }}>PeerDrop</b>
      </header>

      <p>
        You are <b>{roomState.me?.name}</b>
      </p>
      <h2>Room code: {roomState.room}</h2>
      <button onClick={roomState.leaveRoom}>Leave room</button>

      <DeviceList
        others={roomState.others}
        onConnect={connectTo}
        peerStatus={peerStatus}
      />
      <FileTransfer file={file} />
      <ChatBox
        messages={chat.messages}
        text={chat.text}
        setText={chat.setText}
        onSend={chat.sendMessage}
      />
    </div>
  );
}
