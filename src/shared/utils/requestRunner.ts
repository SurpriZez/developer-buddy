import type {
  ApiRequest,
  ApiRequestParam,
  ApiRequestHeader,
  ApiResponse,
  EnvProfile,
} from '../types';
import { interpolate } from './interpolate';

export function buildUrl(
  url: string,
  params: ApiRequestParam[],
  profile: EnvProfile | null
): string {
  const interpolatedUrl = interpolate(url, profile);
  const enabled = params.filter((p) => p.enabled && p.key.trim() !== '');
  if (enabled.length === 0) return interpolatedUrl;

  const qs = enabled
    .map(
      (p) =>
        `${encodeURIComponent(interpolate(p.key, profile))}=${encodeURIComponent(
          interpolate(p.value, profile)
        )}`
    )
    .join('&');

  return interpolatedUrl.includes('?')
    ? `${interpolatedUrl}&${qs}`
    : `${interpolatedUrl}?${qs}`;
}

export function buildHeaders(
  headers: ApiRequestHeader[],
  profile: EnvProfile | null
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) {
    if (!h.enabled || h.key.trim() === '') continue;
    result[interpolate(h.key, profile)] = interpolate(h.value, profile);
  }
  return result;
}

export async function runRequest(
  request: ApiRequest,
  profile: EnvProfile | null
): Promise<ApiResponse> {
  const url = buildUrl(request.url, request.params, profile);
  const headers = buildHeaders(request.headers, profile);

  let body: BodyInit | undefined;
  if (request.bodyType !== 'none' && request.body) {
    if (request.bodyType === 'json') {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      body = interpolate(request.body, profile);
    } else if (request.bodyType === 'form-data') {
      body = interpolate(request.body, profile);
    } else {
      body = interpolate(request.body, profile);
    }
  }

  const start = Date.now();
  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'OPTIONS' || request.method === 'DELETE'
      ? undefined
      : body,
  });
  const durationMs = Date.now() - start;

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const responseBody = await response.text();

  return {
    requestId: request.id,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}
