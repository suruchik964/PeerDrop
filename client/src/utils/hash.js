export async function sha256(blob) {
  // Browsers only allow this on secure pages (https or localhost)
  if (!window.crypto || !window.crypto.subtle) return null;

  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);

  // Turn the raw bytes into a readable 64-character code
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
