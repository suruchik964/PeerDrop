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

export function useFileTransfer(channelRef) {
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [sendProgress, setSendProgress] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [notice, setNotice] = useState("");

  const incomingRef = useRef(null); // the file that is arriving right now
  const pendingRef = useRef(null); // the file we offered and are waiting on
  const acceptedRef = useRef(false); // did WE click Accept?

  function updateSent(id, changes) {
    setSent((list) =>
      list.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    );
  }

  // ---------- sending ----------

  function sendFile(file) {
    const channel = channelRef.current;
    if (!file) return;

    if (!channel || channel.readyState !== "open") {
      setNotice("Not connected to the other device yet.");
      return;
    }
    if (pendingRef.current) {
      setNotice("Please wait for the current file to finish.");
      return;
    }
    if (file.size === 0) {
      setNotice("This file is empty.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setNotice("For now, choose a file under 300 MB.");
      return;
    }

    setNotice("");
    const id = Date.now() + Math.random();
    pendingRef.current = { file, id };
    setSent((list) => [
      {
        id,
        name: file.name,
        size: file.size,
        status: "Waiting for them to accept",
      },
      ...list,
    ]);
    channel.send(
      JSON.stringify({
        type: "file-offer",
        name: file.name,
        size: file.size,
        mime: file.type,
      }),
    );
  }

  async function startSending() {
    const pending = pendingRef.current;
    const channel = channelRef.current;
    if (!pending || !channel || channel.readyState !== "open") return;
    const { file, id } = pending;

    function fail(message) {
      updateSent(id, { status: "Failed" });
      setNotice(message);
      setSendProgress(null);
      pendingRef.current = null;
    }

    updateSent(id, { status: "Preparing" });
    const hash = await sha256(file);
    if (channel.readyState !== "open")
      return fail("Connection closed before sending.");

    updateSent(id, { status: "Sending" });
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
      if (channel.readyState !== "open")
        return fail("Connection closed during the transfer.");

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
    pendingRef.current = null;
    updateSent(id, { status: "Sent" });
  }

  // ---------- receiving ----------

  function respondToOffer(accepted) {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;
    acceptedRef.current = accepted;
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
      if (pendingRef.current) {
        updateSent(pendingRef.current.id, { status: "Declined" });
        pendingRef.current = null;
      }
    } else if (msg.type === "file-meta") {
      if (!acceptedRef.current) return; // we never said yes, so ignore it
      acceptedRef.current = false;
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

    let verified = null; // null = could not check, true = matches, false = does NOT match
    if (meta.hash) {
      const actual = await sha256(blob);
      if (actual !== null) verified = actual === meta.hash;
    }

    setReceived((r) => [
      { name: meta.name, size: meta.size, url, verified },
      ...r,
    ]);
  }

  function onIncomingChunk(data) {
    const meta = incomingRef.current;
    if (!meta) return;

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

  // Called when the other device leaves: clear anything half-finished
  function reset() {
    pendingRef.current = null;
    incomingRef.current = null;
    acceptedRef.current = false;
    setIncomingOffer(null);
    setSendProgress(null);
    setReceiveProgress(null);
    setNotice("");
    setSent((list) =>
      list.map((s) =>
        ["Waiting for them to accept", "Preparing", "Sending"].includes(
          s.status,
        )
          ? { ...s, status: "Failed" }
          : s,
      ),
    );
  }

  return {
    sent,
    received,
    sendProgress,
    receiveProgress,
    incomingOffer,
    notice,
    sendFile,
    respondToOffer,
    onIncomingText,
    onIncomingChunk,
    reset,
  };
}
