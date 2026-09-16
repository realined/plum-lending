export async function request<T>(
  url: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api/${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const value = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(value.error ?? "Request failed"), {
      status: res.status,
    });
  return value as T;
}
