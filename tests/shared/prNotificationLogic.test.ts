import { getPRNotificationMessage, type PRSnapshot } from '../../src/shared/pr/prNotificationLogic';

describe('getPRNotificationMessage', () => {
  const base = { prTitle: 'Fix bug', repoName: 'owner/repo', prNumber: 42 };

  it('does not notify on first encounter (no snapshot) regardless of state', () => {
    expect(getPRNotificationMessage('clean', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
    expect(getPRNotificationMessage('dirty', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
    expect(getPRNotificationMessage('behind', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
    expect(getPRNotificationMessage('unstable', true, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies ready to merge when transitioning from another state to clean', () => {
    const old: PRSnapshot = { mergeState: 'unstable', checksFailing: true };
    const result = getPRNotificationMessage('clean', false, old, base.prTitle, base.repoName, base.prNumber);
    expect(result).toEqual({ title: 'Ready to merge', message: 'Fix bug — owner/repo #42' });
  });

  it('does not notify when already clean', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    expect(getPRNotificationMessage('clean', false, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies checks failing when transitioning to unstable+failing', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    const result = getPRNotificationMessage('unstable', true, old, base.prTitle, base.repoName, base.prNumber);
    expect(result?.title).toBe('Checks failing');
    expect(result?.message).toBe('Fix bug — owner/repo #42');
  });

  it('does not notify for unstable when checks are still pending (not failing)', () => {
    expect(getPRNotificationMessage('unstable', false, undefined, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('does not notify when already in checksFailing state', () => {
    const old: PRSnapshot = { mergeState: 'unstable', checksFailing: true };
    expect(getPRNotificationMessage('unstable', true, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies merge conflict on → dirty', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    const result = getPRNotificationMessage('dirty', false, old, base.prTitle, base.repoName, base.prNumber);
    expect(result?.title).toBe('Merge conflict');
  });

  it('does not notify when already dirty', () => {
    const old: PRSnapshot = { mergeState: 'dirty', checksFailing: false };
    expect(getPRNotificationMessage('dirty', false, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

  it('notifies branch behind on → behind', () => {
    const old: PRSnapshot = { mergeState: 'clean', checksFailing: false };
    const result = getPRNotificationMessage('behind', false, old, base.prTitle, base.repoName, base.prNumber);
    expect(result?.title).toBe('Branch behind');
  });

  it('does not notify when already behind', () => {
    const old: PRSnapshot = { mergeState: 'behind', checksFailing: false };
    expect(getPRNotificationMessage('behind', false, old, base.prTitle, base.repoName, base.prNumber)).toBeNull();
  });

});
