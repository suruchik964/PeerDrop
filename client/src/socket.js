import { io } from "socket.io-client";

// Online, VITE_SERVER_URL holds the deployed server's address.
// While developing, use the same computer that served the page, on port 3000.
// (This also makes it work when you open the site from your phone on the same Wi-Fi.)
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3000`;

function makeId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// A secret ID for this browser tab. It survives a reload, so the server can
// recognise us and give our seat in the room back.
function getClientId() {
  try {
    let id = sessionStorage.getItem("peerdrop-client-id");
    if (!id) {
      id = makeId();
      sessionStorage.setItem("peerdrop-client-id", id);
    }
    return id;
  } catch {
    return makeId();
  }
}

export const socket = io(SERVER_URL, { auth: { clientId: getClientId() } });
