import { buildUrl, buildHeaders } from '../../src/shared/utils/requestRunner';
import type { ApiRequestParam, ApiRequestHeader, EnvProfile } from '../../src/shared/types';

function profile(vars: Record<string, string>): EnvProfile {
  return {
    id: 'p1',
    name: 'test',
    isActive: true,
    variables: Object.entries(vars).map(([key, value]) => ({ key, value, secret: false })),
  };
}

function param(key: string, value: string, enabled = true): ApiRequestParam {
  return { key, value, enabled };
}

function header(key: string, value: string, enabled = true): ApiRequestHeader {
  return { key, value, enabled };
}

describe('buildUrl()', () => {
  it('returns the URL unchanged when no params', () => {
    expect(buildUrl('https://api.example.com/users', [], null)).toBe('https://api.example.com/users');
  });

  it('appends enabled params as a query string', () => {
    const result = buildUrl('https://api.example.com/users', [param('page', '1'), param('limit', '10')], null);
    expect(result).toBe('https://api.example.com/users?page=1&limit=10');
  });

  it('skips disabled params', () => {
    const result = buildUrl(
      'https://api.example.com/users',
      [param('page', '1'), param('limit', '10', false)],
      null
    );
    expect(result).toBe('https://api.example.com/users?page=1');
  });

  it('skips params with empty keys', () => {
    const result = buildUrl('https://api.example.com', [param('', 'value')], null);
    expect(result).toBe('https://api.example.com');
  });

  it('appends to existing query string with &', () => {
    const result = buildUrl('https://api.example.com?existing=true', [param('page', '2')], null);
    expect(result).toBe('https://api.example.com?existing=true&page=2');
  });

  it('applies interpolation to the URL before appending params', () => {
    const result = buildUrl(
      '{{BASE_URL}}/users',
      [param('page', '1')],
      profile({ BASE_URL: 'https://api.example.com' })
    );
    expect(result).toBe('https://api.example.com/users?page=1');
  });

  it('applies interpolation to param values', () => {
    const result = buildUrl(
      'https://api.example.com',
      [param('token', '{{API_KEY}}')],
      profile({ API_KEY: 'secret123' })
    );
    expect(result).toBe('https://api.example.com?token=secret123');
  });

  it('URL-encodes special characters in params', () => {
    const result = buildUrl('https://api.example.com', [param('q', 'hello world')], null);
    expect(result).toBe('https://api.example.com?q=hello%20world');
  });
});

describe('buildHeaders()', () => {
  it('returns empty object when no headers', () => {
    expect(buildHeaders([], null)).toEqual({});
  });

  it('includes enabled headers', () => {
    const result = buildHeaders([header('Authorization', 'Bearer token')], null);
    expect(result).toEqual({ Authorization: 'Bearer token' });
  });

  it('excludes disabled headers', () => {
    const result = buildHeaders(
      [header('Authorization', 'Bearer token'), header('X-Debug', 'true', false)],
      null
    );
    expect(result).toHaveProperty('Authorization');
    expect(result).not.toHaveProperty('X-Debug');
  });

  it('excludes headers with empty keys', () => {
    const result = buildHeaders([header('', 'value')], null);
    expect(result).toEqual({});
  });

  it('applies interpolation to header values', () => {
    const result = buildHeaders(
      [header('Authorization', 'Bearer {{TOKEN}}')],
      profile({ TOKEN: 'abc123' })
    );
    expect(result).toEqual({ Authorization: 'Bearer abc123' });
  });

  it('applies interpolation to header keys', () => {
    const result = buildHeaders(
      [header('{{CUSTOM_HEADER}}', 'value')],
      profile({ CUSTOM_HEADER: 'X-My-Header' })
    );
    expect(result).toEqual({ 'X-My-Header': 'value' });
  });
});
