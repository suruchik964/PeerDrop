import { useEffect, useRef } from "react";
import { Navigate, useParams } from "react-router-dom";
import { socket } from "../socket";
import { useFileTransfer } from "../hooks/useFileTransfer";
import { usePeerConnection } from "../hooks/usePeerConnection";
import ServerBanner from "../components/ServerBanner";
import RoomHeader from "../components/RoomHeader";
import PeerBanner from "../components/PeerBanner";
import SendPanel from "../components/SendPanel";
import FilesPanel from "../components/FilesPanel";
import Modal from "../components/Modal";
import { formatSize } from "../utils/formatSize";

export default function RoomPage({ roomState }) {
  const { code } = useParams(); // the code from the address bar
  const channelRef = useRef(null);
  const startedRef = useRef(null); // whom we already started a connection to
  const pairedRef = useRef(null); // whom we are paired with in this room
  const myIdRef = useRef(null); // our own id, to notice when it changes

  const file = useFileTransfer(channelRef);

  const me = roomState.me;
  const other = roomState.others[0]; // rooms have 2 devices at most

  // Everything arriving through the direct pipe lands here first
  function handleMessage(e) {
    if (typeof e.data === "string") {
      try {
        file.onIncomingText(JSON.parse(e.data));
      } catch {
        // ignore anything that is not valid
      }
    } else {
      file.onIncomingChunk(e.data);
    }
  }

  // The other device told us its page is open and listening
  function handleReady(from) {
    if (!me || !other || from !== other.id) return;

    if (me.id < from) {
      // We are the one who starts the connection (smaller id), once per device
      if (startedRef.current !== from) {
        startedRef.current = from;
        connectTo(from);
      }
    } else {
      // We wait for their request, but let them know we are here too
      socket.emit("signal", { to: from, data: { ready: true } });
    }
  }

  const { peerStatus, connectTo, disconnect } = usePeerConnection(
    channelRef,
    handleMessage,
    handleReady,
  );

  // Tell the other device "I'm here", and clean up when they leave
  useEffect(() => {
    // Our own link to the server was replaced (it dropped and came back): start over
    if (me && myIdRef.current && myIdRef.current !== me.id) {
      startedRef.current = null;
      pairedRef.current = null;
      disconnect();
      file.reset();
    }
    if (me) myIdRef.current = me.id;

    if (!other) {
      if (pairedRef.current) {
        pairedRef.current = null;
        startedRef.current = null;
        disconnect();
        file.reset();
      }
      return;
    }
    if (!me) return;

    // A different device took their place: drop the old connection
    if (pairedRef.current && pairedRef.current !== other.id) {
      startedRef.current = null;
      disconnect();
      file.reset();
    }

    pairedRef.current = other.id;
    socket.emit("signal", { to: other.id, data: { ready: true } });
  }, [other?.id, me?.id]);

  // Close the connection when leaving this page
  useEffect(() => {
    return () => {
      startedRef.current = null;
      pairedRef.current = null;
      disconnect();
    };
  }, []);

  // Warn before closing or reloading the tab in the middle of a transfer
  const transferring =
    file.sendProgress !== null || file.receiveProgress !== null;
  useEffect(() => {
    if (!transferring) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [transferring]);

  function handleLeave() {
    if (
      transferring &&
      !window.confirm("A transfer is in progress. Leave anyway?")
    )
      return;
    roomState.leaveRoom();
  }

  // The server has not told us yet whether we are still in this room
  if (!roomState.ready) {
    return <p className="p-8 text-center text-slate-400">Loading...</p>;
  }

  // Not in this room (Leave button, wrong address, room expired)? Go back to the landing page
  if (roomState.room !== code) return <Navigate to="/" replace />;

  const connected = peerStatus === "Connected directly!";

  return (
    <div className="min-h-screen">
      <ServerBanner online={roomState.serverOnline} />
      <RoomHeader room={roomState.room} onLeave={handleLeave} />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <PeerBanner other={other} peerStatus={peerStatus} />

        <div className="grid gap-4 md:grid-cols-2">
          <SendPanel
            connected={connected}
            onSend={file.sendFile}
            progress={file.sendProgress}
            notice={file.notice}
            busy={file.sendBusy}
            onCancel={file.cancelSending}
          />
          <FilesPanel file={file} />
        </div>
      </main>

      {file.incomingOffer && (
        <Modal title="Incoming file" closable={false}>
          <p className="text-sm text-slate-400">
            {other ? other.name : "Someone"} wants to send you
          </p>
          <p className="mt-2 break-all text-lg font-semibold">
            {file.incomingOffer.name}
          </p>
          <p className="text-sm text-slate-400">
            {formatSize(file.incomingOffer.size)}
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => file.respondToOffer(false)}
              className="flex-1 rounded-lg bg-slate-700 px-4 py-2 font-medium hover:bg-slate-600"
            >
              Decline
            </button>
            <button
              onClick={() => file.respondToOffer(true)}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium hover:bg-green-500"
            >
              Accept
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
