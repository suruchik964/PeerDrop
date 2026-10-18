import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { ICE_CONFIG, LOW_BUFFER } from "../constants";

export function usePeerConnection(channelRef, onMessage) {
  const [peerStatus, setPeerStatus] = useState("Not connected");
  const peerRef = useRef(null);
  const pendingRef = useRef([]);
  const onMessageRef = useRef(onMessage);

  // Always remember the newest version of the message handler
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  function createPeer(targetId) {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", {
          to: targetId,
          data: { candidate: e.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setPeerStatus("Connection failed");
      if (pc.connectionState === "disconnected") setPeerStatus("Disconnected");
    };

    peerRef.current = pc;
    pendingRef.current = [];
    return pc;
  }

  function setupChannel(channel) {
    channelRef.current = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_BUFFER;
    channel.onopen = () => setPeerStatus("Connected directly!");
    channel.onclose = () => setPeerStatus("Channel closed");
    channel.onmessage = (e) => onMessageRef.current(e);
  }

  async function flushCandidates() {
    for (const c of pendingRef.current) {
      await peerRef.current.addIceCandidate(c);
    }
    pendingRef.current = [];
  }

  async function connectTo(targetId) {
    setPeerStatus("Connecting...");
    const pc = createPeer(targetId);
    setupChannel(pc.createDataChannel("files"));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", {
      to: targetId,
      data: { description: pc.localDescription },
    });
  }

  useEffect(() => {
    socket.on("signal", async ({ from, data }) => {
      if (data.description) {
        if (data.description.type === "offer") {
          setPeerStatus("Connecting...");
          const pc = createPeer(from);
          pc.ondatachannel = (e) => setupChannel(e.channel);
          await pc.setRemoteDescription(data.description);
          await flushCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", {
            to: from,
            data: { description: pc.localDescription },
          });
        } else {
          await peerRef.current.setRemoteDescription(data.description);
          await flushCandidates();
        }
      } else if (data.candidate) {
        const pc = peerRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(data.candidate);
        } else {
          pendingRef.current.push(data.candidate);
        }
      }
    });

    return () => {
      socket.off("signal");
    };
  }, []);

  return { peerStatus, connectTo };
}
