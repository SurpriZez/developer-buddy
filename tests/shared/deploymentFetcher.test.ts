import {
  mapGitHubStatus,
  mapJenkinsStatus,
  getDeployNotificationMessage,
  jenkinsJobPath,
  type DeploymentItem,
  type DeploySnapshot,
} from '../../src/shared/deployments/deploymentFetcher';

describe('mapGitHubStatus', () => {
  it('returns in_progress for in_progress status', () => {
    expect(mapGitHubStatus({ status: 'in_progress', conclusion: null })).toBe('in_progress');
  });
  it('returns in_progress for queued status', () => {
    expect(mapGitHubStatus({ status: 'queued', conclusion: null })).toBe('in_progress');
  });
  it('returns success for completed+success', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'success' })).toBe('success');
  });
  it('returns failure for completed+failure', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'failure' })).toBe('failure');
  });
  it('returns failure for completed+timed_out', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'timed_out' })).toBe('failure');
  });
  it('returns cancelled for completed+cancelled', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: 'cancelled' })).toBe('cancelled');
  });
  it('returns unknown for completed with unknown conclusion', () => {
    expect(mapGitHubStatus({ status: 'completed', conclusion: null })).toBe('unknown');
  });
});

describe('mapJenkinsStatus', () => {
  it('returns in_progress when building', () => {
    expect(mapJenkinsStatus({ building: true, result: null })).toBe('in_progress');
  });
  it('returns success for SUCCESS', () => {
    expect(mapJenkinsStatus({ building: false, result: 'SUCCESS' })).toBe('success');
  });
  it('returns failure for FAILURE', () => {
    expect(mapJenkinsStatus({ building: false, result: 'FAILURE' })).toBe('failure');
  });
  it('returns failure for UNSTABLE', () => {
    expect(mapJenkinsStatus({ building: false, result: 'UNSTABLE' })).toBe('failure');
  });
  it('returns cancelled for ABORTED', () => {
    expect(mapJenkinsStatus({ building: false, result: 'ABORTED' })).toBe('cancelled');
  });
  it('returns unknown for null result', () => {
    expect(mapJenkinsStatus({ building: false, result: null })).toBe('unknown');
  });
});

describe('jenkinsJobPath', () => {
  it('wraps single segment', () => {
    expect(jenkinsJobPath('my-job')).toBe('job/my-job');
  });
  it('handles folder/job', () => {
    expect(jenkinsJobPath('my-folder/my-job')).toBe('job/my-folder/job/my-job');
  });
});

const baseItem: DeploymentItem = {
  id: 'gh-1',
  connectionId: 'c1',
  provider: 'github_actions',
  connectionLabel: 'my-app',
  runName: 'Deploy to Production',
  buildRef: 'main',
  status: 'success',
  timestamp: '2026-03-19T12:00:00Z',
  url: 'https://github.com/owner/repo/actions/runs/1',
};

describe('getDeployNotificationMessage', () => {
  it('notifies on new item with failure status', () => {
    const result = getDeployNotificationMessage({ ...baseItem, status: 'failure' }, undefined);
    expect(result).toEqual({
      title: 'Deployment failed',
      message: 'Deploy to Production (main) — my-app',
    });
  });

  it('does not notify on new item with success status', () => {
    expect(getDeployNotificationMessage({ ...baseItem, status: 'success' }, undefined)).toBeNull();
  });

  it('does not notify on new item with in_progress status', () => {
    expect(getDeployNotificationMessage({ ...baseItem, status: 'in_progress' }, undefined)).toBeNull();
  });

  it('notifies on in_progress → success', () => {
    const old: DeploySnapshot = { status: 'in_progress', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    const result = getDeployNotificationMessage({ ...baseItem, status: 'success' }, old);
    expect(result?.title).toBe('Deployment succeeded');
    expect(result?.message).toBe('Deploy to Production (main) — my-app');
  });

  it('notifies on in_progress → failure', () => {
    const old: DeploySnapshot = { status: 'in_progress', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    const result = getDeployNotificationMessage({ ...baseItem, status: 'failure' }, old);
    expect(result?.title).toBe('Deployment failed');
  });

  it('does not notify on success → success (no change)', () => {
    const old: DeploySnapshot = { status: 'success', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    expect(getDeployNotificationMessage({ ...baseItem, status: 'success' }, old)).toBeNull();
  });

  it('does not notify on unknown → success (was not in_progress)', () => {
    const old: DeploySnapshot = { status: 'unknown', connectionLabel: 'my-app', runName: 'Deploy to Production', buildRef: 'main', url: '' };
    expect(getDeployNotificationMessage({ ...baseItem, status: 'success' }, old)).toBeNull();
  });
});
