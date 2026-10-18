import { useRef } from "react";
import { useRoom } from "./hooks/useRoom";
import { useChat } from "./hooks/useChat";
import { useFileTransfer } from "./hooks/useFileTransfer";
import { usePeerConnection } from "./hooks/usePeerConnection";
import RoomPanel from "./components/RoomPanel";
import DeviceList from "./components/DeviceList";
import ChatBox from "./components/ChatBox";
import FileTransfer from "./components/FileTransfer";

function App() {
  const channelRef = useRef(null); // the direct pipe, shared by the hooks below

  const roomState = useRoom();
  const chat = useChat(channelRef);
  const file = useFileTransfer(channelRef, chat.addMessage);

  // Everything that arrives through the pipe comes here first,
  // and gets handed to the right hook
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

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>PeerDrop</h1>
      <p>
        {roomState.me
          ? `You are ${roomState.me.name}`
          : "Connecting to server..."}
      </p>

      {!roomState.room ? (
        <RoomPanel
          onCreate={roomState.createRoom}
          onJoin={roomState.joinRoom}
          error={roomState.error}
        />
      ) : (
        <div>
          <h2>Room code: {roomState.room}</h2>
          <button onClick={roomState.leaveRoom}>Leave room</button>

          <DeviceList
            others={roomState.others}
            onConnect={connectTo}
            peerStatus={peerStatus}
          />
          <ChatBox
            messages={chat.messages}
            text={chat.text}
            setText={chat.setText}
            onSend={chat.sendMessage}
          />
          <FileTransfer file={file} />
        </div>
      )}
    </div>
  );
}

export default App;
