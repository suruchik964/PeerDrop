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

const BUSY_STATUSES = ["Waiting for them to accept", "Preparing", "Sending"];

export function useFileTransfer(channelRef) {
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [sendProgress, setSendProgress] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [notice, setNotice] = useState("");

  const incomingRef = useRef(null); // the file that is arriving right now
  const pendingRef = useRef(null); // the file we offered: { file, id, token }
  const acceptedRef = useRef(false); // did WE click Accept?

  function updateSent(id, changes) {
    setSent((list) =>
      list.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    );
  }

  function sendToPeer(message) {
    const channel = channelRef.current;
    if (channel && channel.readyState === "open")
      channel.send(JSON.stringify(message));
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
    // The token lets us stop the sending loop from outside
    pendingRef.current = { file, id, token: { cancelled: false } };
    setSent((list) => [
      {
        id,
        name: file.name,
        size: file.size,
        status: "Waiting for them to accept",
      },
      ...list,
    ]);
    sendToPeer({
      type: "file-offer",
      name: file.name,
      size: file.size,
      mime: file.type,
    });
  }

  async function startSending() {
    const pending = pendingRef.current;
    const channel = channelRef.current;
    if (!pending || !channel || channel.readyState !== "open") return;
    const { file, id, token } = pending;

    // Stop and tidy up (only touches pendingRef if it is still this file)
    function finishUp(status, message) {
      if (status) updateSent(id, { status });
      if (message) setNotice(message);
      setSendProgress(null);
      if (pendingRef.current && pendingRef.current.id === id)
        pendingRef.current = null;
    }

    updateSent(id, { status: "Preparing" });
    const hash = await sha256(file);
    if (token.cancelled) return finishUp();
    if (channel.readyState !== "open") {
      return finishUp("Failed", "Connection closed before sending.");
    }

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
      if (token.cancelled) return finishUp();
      if (channel.readyState !== "open") {
        return finishUp("Failed", "Connection closed during the transfer.");
      }

      const piece = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      if (token.cancelled) return finishUp();
      channel.send(piece);
      offset += piece.byteLength;

      const percent = Math.round((offset / file.size) * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        setSendProgress(percent);
      }
    }

    finishUp("Sent");
  }

  // Stop our own sending (we clicked cancel, or the other side did)
  function abortSending(message) {
    const pending = pendingRef.current;
    if (!pending) return;
    pending.token.cancelled = true;
    updateSent(pending.id, { status: "Cancelled" });
    pendingRef.current = null;
    setSendProgress(null);
    setNotice(message);
  }

  function cancelSending() {
    sendToPeer({ type: "file-cancel", role: "sender" });
    abortSending("You cancelled the transfer.");
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

  // Stop our own receiving (we clicked cancel, or the sender did)
  function abortReceiving(message) {
    incomingRef.current = null;
    acceptedRef.current = false;
    setIncomingOffer(null);
    setReceiveProgress(null);
    setNotice(message);
  }

  function cancelReceiving() {
    sendToPeer({ type: "file-cancel", role: "receiver" });
    abortReceiving("You cancelled the transfer.");
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
    } else if (msg.type === "file-cancel") {
      // role tells us who cancelled: the sender stopped, or the receiver stopped
      if (msg.role === "sender")
        abortReceiving("The other device cancelled the file.");
      else abortSending("The other device cancelled the transfer.");
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
    if (pendingRef.current) pendingRef.current.token.cancelled = true;
    pendingRef.current = null;
    incomingRef.current = null;
    acceptedRef.current = false;
    setIncomingOffer(null);
    setSendProgress(null);
    setReceiveProgress(null);
    setNotice("");
    setSent((list) =>
      list.map((s) =>
        BUSY_STATUSES.includes(s.status) ? { ...s, status: "Failed" } : s,
      ),
    );
  }

  const sendBusy = sent.some((s) => BUSY_STATUSES.includes(s.status));

  return {
    sent,
    received,
    sendProgress,
    receiveProgress,
    incomingOffer,
    notice,
    sendBusy,
    sendFile,
    cancelSending,
    cancelReceiving,
    respondToOffer,
    onIncomingText,
    onIncomingChunk,
    reset,
  };
}
