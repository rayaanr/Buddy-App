import { describe, expect, it } from '@jest/globals';

import { activityPathFrom } from './pendingLink';

const id = '0928ebcf-2869-4502-9241-4c7c5b831512';

describe('activityPathFrom', () => {
  it('reads app links and share-page links', () => {
    expect(activityPathFrom(`buddy://activity/${id}`)).toBe(`/activity/${id}`);
    expect(activityPathFrom(`https://api.buddy.lk/a/${id}`)).toBe(`/activity/${id}`);
    expect(activityPathFrom(`http://localhost:7481/activity/${id}`)).toBe(`/activity/${id}`);
  });

  it('ignores everything else', () => {
    expect(activityPathFrom(null)).toBeNull();
    expect(activityPathFrom('buddy://profile')).toBeNull();
    expect(activityPathFrom(`buddy://activity/${id}/chat`)).toBeNull();
    expect(activityPathFrom('buddy://activity/not-an-id')).toBeNull();
  });
});
