import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { ICE_CONFIG, LOW_BUFFER, FORCE_RELAY } from "../constants";

export function usePeerConnection(channelRef, onMessage, onReady) {
  const [peerStatus, setPeerStatus] = useState("Not connected");
  const peerRef = useRef(null);
  const pendingRef = useRef([]);
  const attemptRef = useRef(0); // goes up on every disconnect, to spot out-of-date attempts
  const iceConfigRef = useRef(ICE_CONFIG);
  const iceReadyRef = useRef(Promise.resolve());
  const onMessageRef = useRef(onMessage);
  const onReadyRef = useRef(onReady);

  // Always remember the newest versions of the handlers
  useEffect(() => {
    onMessageRef.current = onMessage;
    onReadyRef.current = onReady;
  });

  // Ask our server for the STUN and TURN details as soon as this page opens
  useEffect(() => {
    iceReadyRef.current = new Promise((resolve) => {
      const timer = setTimeout(resolve, 4000); // do not wait forever
      socket.emit("get-ice-servers", (servers) => {
        clearTimeout(timer);
        if (Array.isArray(servers) && servers.length > 0) {
          iceConfigRef.current = { iceServers: servers };
        }
        resolve();
      });
    });
  }, []);

  function createPeer(targetId) {
    const config = { ...iceConfigRef.current };
    if (FORCE_RELAY) config.iceTransportPolicy = "relay"; // testing only
    const pc = new RTCPeerConnection(config);

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

  // The device that starts the connection
  async function connectTo(targetId) {
    setPeerStatus("Connecting...");
    const attempt = attemptRef.current;
    await iceReadyRef.current; // make sure the STUN/TURN details have arrived
    if (attempt !== attemptRef.current) return; // we disconnected meanwhile

    pendingRef.current = [];
    const pc = createPeer(targetId);
    setupChannel(pc.createDataChannel("files"));

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", {
        to: targetId,
        data: { description: pc.localDescription },
      });
    } catch (err) {
      if (peerRef.current !== pc) return; // an old attempt that was closed, ignore it
      console.error("Could not start connection:", err);
      setPeerStatus("Connection failed");
    }
  }

  // Close the current connection and reset
  function disconnect() {
    attemptRef.current += 1;
    const channel = channelRef.current;
    if (channel) {
      channel.onopen = null;
      channel.onclose = null;
      channel.onmessage = null;
    }
    if (peerRef.current) {
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    channelRef.current = null;
    pendingRef.current = [];
    setPeerStatus("Not connected");
  }

  useEffect(() => {
    socket.on("signal", async ({ from, data }) => {
      try {
        // The other page says "I'm here and listening"
        if (data.ready) {
          if (onReadyRef.current) onReadyRef.current(from);
          return;
        }

        if (data.description) {
          if (data.description.type === "offer") {
            setPeerStatus("Connecting...");
            const attempt = attemptRef.current;
            await iceReadyRef.current; // make sure the STUN/TURN details have arrived
            if (attempt !== attemptRef.current) return;

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
          } else if (peerRef.current) {
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
      } catch (err) {
        console.error("Signal handling failed:", err);
      }
    });

    return () => {
      socket.off("signal");
    };
  }, []);

  return { peerStatus, connectTo, disconnect };
}
