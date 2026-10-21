import { useRef, useState } from "react";
import { CHUNK_SIZE, MAX_SIZE, MAX_BUFFER } from "../constants";
import { sha256 } from "../utils/hash";

function waitForBuffer(channel) {
  if (channel.bufferedAmount <= MAX_BUFFER) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      channel.removeEventListener("bufferedamountlow", done);
      channel.removeEventListener("close", done);
      resolve();
    };
    channel.addEventListener("bufferedamountlow", done);
    channel.addEventListener("close", done);
  });
}

export function useFileTransfer(channelRef, addMessage) {
  const [received, setReceived] = useState([]);
  const [sendProgress, setSendProgress] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const incomingRef = useRef(null);
  const pendingFileRef = useRef(null);

  // ---------- sending ----------

  function sendFile(e) {
    const file = e.target.files[0];
    const channel = channelRef.current;
    e.target.value = "";
    if (!file || !channel || channel.readyState !== "open") return;

    if (pendingFileRef.current) {
      alert("Please wait for the current file to finish.");
      return;
    }
    if (file.size === 0) {
      alert("This file is empty.");
      return;
    }
    if (file.size > MAX_SIZE) {
      alert("For now, choose a file under 300 MB.");
      return;
    }

    pendingFileRef.current = file;
    channel.send(
      JSON.stringify({
        type: "file-offer",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );
    addMessage("me", `Waiting for them to accept: ${file.name}`);
  }

  async function startSending() {
    const file = pendingFileRef.current;
    const channel = channelRef.current;
    if (!file || !channel || channel.readyState !== "open") return;

        const hash = await sha256(file);

        channel.send(
          JSON.stringify({
            type: "file-meta",
            name: file.name,
            size: file.size,
            mime: file.type,
            hash,
          }),
        );

    let offset = 0;
    let lastPercent = -1;
    setSendProgress(0);
    while (offset < file.size) {
      await waitForBuffer(channel);
      if (channel.readyState !== "open") {
        alert("Connection closed during the transfer.");
        setSendProgress(null);
        pendingFileRef.current = null;
        return;
      }
      const piece = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      channel.send(piece);
      offset += piece.byteLength;

      const percent = Math.round((offset / file.size) * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        setSendProgress(percent);
      }
    }

    setSendProgress(null);
    pendingFileRef.current = null;
    addMessage("me", `Sent file: ${file.name}`);
  }

  // ---------- receiving ----------

  function respondToOffer(accepted) {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(
      JSON.stringify({ type: accepted ? "file-accept" : "file-decline" }),
    );
    setIncomingOffer(null);
  }

  function onIncomingText(msg) {
    if (msg.type === "file-offer") {
      setIncomingOffer(msg);
    } else if (msg.type === "file-accept") {
      startSending();
    } else if (msg.type === "file-decline") {
      pendingFileRef.current = null;
      addMessage("them", "Declined your file.");
    } else if (msg.type === "file-meta") {
      incomingRef.current = {
        ...msg,
        chunks: [],
        received: 0,
        lastPercent: -1,
      };
      setReceiveProgress(0);
    }
  }

    async function finishFile(meta) {
      const blob = new Blob(meta.chunks, { type: meta.mime });
      const url = URL.createObjectURL(blob);

      // null = could not check, true = matches, false = does NOT match
      let verified = null;
      if (meta.hash) {
        const actual = await sha256(blob);
        if (actual !== null) verified = actual === meta.hash;
      }

      setReceived((r) => [
        ...r,
        { name: meta.name, size: meta.size, url, verified },
      ]);
    }

  function onIncomingChunk(data) {
    const meta = incomingRef.current;
    if (!meta) return; // we never agreed to receive this, so ignore it

    meta.chunks.push(data);
    meta.received += data.byteLength;

    const percent = Math.round((meta.received / meta.size) * 100);
    if (percent !== meta.lastPercent) {
      meta.lastPercent = percent;
      setReceiveProgress(percent);
    }

    if (meta.received >= meta.size) {
      incomingRef.current = null;
      setReceiveProgress(null);
      finishFile(meta);
    }
  }

  return {
    received,
    sendProgress,
    receiveProgress,
    incomingOffer,
    sendFile,
    respondToOffer,
    onIncomingText,
    onIncomingChunk,
  };
}
