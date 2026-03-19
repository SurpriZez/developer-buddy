export interface PRSnapshot {
  mergeState: string;
  checksFailing: boolean;
}

export function getPRNotificationMessage(
  newMergeState: string,
  newChecksFailing: boolean,
  oldSnapshot: PRSnapshot | undefined,
  prTitle: string,
  repoName: string,
  prNumber: number,
): { title: string; message: string } | null {
  // Never notify on first encounter — caller must have seen this PR before
  if (!oldSnapshot) return null;

  const msg = `${prTitle} — ${repoName} #${prNumber}`;

  if (newMergeState === 'clean' && oldSnapshot.mergeState !== 'clean') {
    return { title: 'Ready to merge', message: msg };
  }
  if (newMergeState === 'unstable' && newChecksFailing && !oldSnapshot.checksFailing) {
    return { title: 'Checks failing', message: msg };
  }
  if (newMergeState === 'dirty' && oldSnapshot.mergeState !== 'dirty') {
    return { title: 'Merge conflict', message: msg };
  }
  if (newMergeState === 'behind' && oldSnapshot.mergeState !== 'behind') {
    return { title: 'Branch behind', message: msg };
  }
  return null;
}
