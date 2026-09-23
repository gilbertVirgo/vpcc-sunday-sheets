/** GET /api/<path> as JSON. A 401 sends the browser to the auth hub and never resolves. */
export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, { credentials: "same-origin" });
  if (res.status === 401) {
    const { hub } = (await res.json()) as { hub: string };
    location.assign(`${hub}/?returnTo=${encodeURIComponent(location.href)}`);
    return new Promise<T>(() => {});
  }
  if (!res.ok) throw new Error(`/api/${path} failed (${res.status})`);
  return (await res.json()) as T;
}
