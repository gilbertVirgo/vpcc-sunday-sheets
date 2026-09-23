type FontBytes = { regular: Uint8Array; bold: Uint8Array };

let cached: Promise<FontBytes> | undefined;

async function get(name: string): Promise<Uint8Array> {
  const res = await fetch(`/fonts/${name}`);
  if (!res.ok) throw new Error(`Font ${name} failed to load (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export function loadFonts(): Promise<FontBytes> {
  cached ??= Promise.all([get("Inter-Regular.ttf"), get("Inter-Bold.ttf")])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((err) => {
      cached = undefined;
      throw err;
    });
  return cached;
}
