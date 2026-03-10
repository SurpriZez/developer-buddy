import { interpolate } from '../../src/shared/utils/interpolate';
import type { EnvProfile } from '../../src/shared/types';

function profile(vars: Record<string, string>): EnvProfile {
  return {
    id: 'p1',
    name: 'test',
    isActive: true,
    variables: Object.entries(vars).map(([key, value]) => ({ key, value, secret: false })),
  };
}

describe('interpolate()', () => {
  it('replaces a single variable', () => {
    const result = interpolate('{{BASE_URL}}/users', profile({ BASE_URL: 'https://api.example.com' }));
    expect(result).toBe('https://api.example.com/users');
  });

  it('replaces multiple variables in one string', () => {
    const result = interpolate(
      '{{SCHEME}}://{{HOST}}/{{PATH}}',
      profile({ SCHEME: 'https', HOST: 'example.com', PATH: 'api/v1' })
    );
    expect(result).toBe('https://example.com/api/v1');
  });

  it('leaves unmatched {{VAR}} placeholders unchanged', () => {
    const result = interpolate('{{MISSING}}/path', profile({ OTHER: 'value' }));
    expect(result).toBe('{{MISSING}}/path');
  });

  it('returns the original string unchanged when profile is null', () => {
    const result = interpolate('{{BASE_URL}}/users', null);
    expect(result).toBe('{{BASE_URL}}/users');
  });

  it('is case-sensitive — {{base_url}} does not match BASE_URL', () => {
    const result = interpolate('{{base_url}}/users', profile({ BASE_URL: 'https://api.example.com' }));
    expect(result).toBe('{{base_url}}/users');
  });

  it('replaces the same variable appearing multiple times', () => {
    const result = interpolate('{{HOST}}/{{HOST}}', profile({ HOST: 'example.com' }));
    expect(result).toBe('example.com/example.com');
  });

  it('returns empty string unchanged', () => {
    expect(interpolate('', profile({ A: 'b' }))).toBe('');
  });

  it('does not replace partial or malformed placeholders', () => {
    expect(interpolate('{BASE_URL}', profile({ BASE_URL: 'x' }))).toBe('{BASE_URL}');
    expect(interpolate('{{BASE_URL', profile({ BASE_URL: 'x' }))).toBe('{{BASE_URL');
  });
});
