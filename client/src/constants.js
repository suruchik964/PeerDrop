export const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
export const CHUNK_SIZE = 16 * 1024;
export const MAX_SIZE = 300 * 1024 * 1024;
export const MAX_BUFFER = 1 * 1024 * 1024;
export const LOW_BUFFER = 256 * 1024;

// Testing only: open the site with ?relay=1 to force all traffic through the TURN relay
export const FORCE_RELAY =
  new URLSearchParams(window.location.search).get("relay") === "1";
