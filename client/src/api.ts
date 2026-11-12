let accessToken: string | null = sessionStorage.getItem('spmb_token');

export function setToken(t: string | null) {
  accessToken = t;
  if (t) sessionStorage.setItem('spmb_token', t);
  else sessionStorage.removeItem('spmb_token');
}
export function getToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(data?.error || data?.errors?.join(', ') || 'Terjadi kesalahan');
    this.status = status;
    this.data = data;
  }
}

async function request(method: string, url: string, body?: any, extraHeaders: Record<string, string> = {}, isForm = false): Promise<any> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  let payload: BodyInit | undefined;
  if (isForm) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload, credentials: 'include' });
  if (res.status === 401 && accessToken && !url.includes('/auth/')) {
    // coba refresh sekali
    const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      setToken(d.access_token);
      headers['Authorization'] = `Bearer ${d.access_token}`;
      const retry = await fetch(url, { method, headers, body: payload, credentials: 'include' });
      if (retry.ok) return retry.headers.get('content-type')?.includes('json') ? retry.json() : retry;
      throw new ApiError(retry.status, await retry.json().catch(() => ({})));
    }
    setToken(null);
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return res;
}

export const api = {
  get: (url: string, headers?: any) => request('GET', url, undefined, headers),
  post: (url: string, body?: any, headers?: any) => request('POST', url, body, headers),
  put: (url: string, body?: any, headers?: any) => request('PUT', url, body, headers),
  del: (url: string, body?: any, headers?: any) => request('DELETE', url, body, headers),
  upload: (url: string, form: FormData, headers?: any) => request('POST', url, form, headers, true),
};
