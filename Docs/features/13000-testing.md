# 13000 - Testing

## Overview
Ensure reliability and correctness through comprehensive testing strategies.

---

## Features

### 13001 - Unit Testing Strategy
**Description:** Test individual functions and modules in isolation.

**Test Framework:**
```typescript
// Using Jest or similar
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Post Validation', () => {
  describe('hasImagePostHint', () => {
    it('should return true for image posts', () => {
      const post = { postHint: 'image' } as Post;
      expect(hasImagePostHint(post)).toBe(true);
    });

    it('should return false for text posts', () => {
      const post = { postHint: 'self' } as Post;
      expect(hasImagePostHint(post)).toBe(false);
    });

    it('should return false for undefined post hint', () => {
      const post = {} as Post;
      expect(hasImagePostHint(post)).toBe(false);
    });
  });

  describe('matchesImageURL', () => {
    it('should match imgur URLs', () => {
      expect(matchesImageURL('https://imgur.com/abc123', ['imgur'])).toBe(true);
    });

    it('should match steam community URLs', () => {
      expect(matchesImageURL(
        'https://steamcommunity.com/sharedfiles/filedetails',
        ['steamcommunity.com']
      )).toBe(true);
    });

    it('should not match non-image URLs', () => {
      expect(matchesImageURL('https://example.com', ['imgur'])).toBe(false);
    });
  });
});
```

---

### 13002 - Integration Testing
**Description:** Test interactions between components and external APIs.

**Implementation:**
```typescript
describe('Warning System Integration', () => {
  let mockContext: Context;
  let mockPost: Post;

  beforeEach(() => {
    mockContext = createMockContext();
    mockPost = createMockPost();
  });

  it('should post warning after grace period', async () => {
    // Setup: Post without R5 comment
    mockPost.authorName = 'testuser';
    mockContext.redis.get = jest.fn().mockResolvedValue(null);

    // Execute: Post warning
    await postWarning(mockPost, mockContext);

    // Verify: Warning posted and tracked
    expect(mockPost.addComment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('rule #5 comment'),
      })
    );
    expect(mockContext.redis.set).toHaveBeenCalledWith(
      `warned:${mockPost.id}`,
      expect.any(String),
      expect.any(Object)
    );
  });

  it('should not warn if R5 comment exists', async () => {
    // Setup: Post with R5 comment
    mockPost.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: mockPost.authorName,
        body: 'This is my R5 comment explaining the screenshot in detail',
      },
    ]);

    // Execute: Check for warning
    const shouldWarn = !(await hasValidR5Comment(mockPost, mockContext));

    // Verify: No warning needed
    expect(shouldWarn).toBe(false);
  });
});
```

---

### 13003 - Mock Data Generation
**Description:** Create realistic mock data for testing.

**Implementation:**
```typescript
function createMockPost(overrides?: Partial<Post>): Post {
  return {
    id: 'abc123',
    title: 'Test Post',
    authorName: 'testuser',
    url: 'https://i.imgur.com/test.jpg',
    postHint: 'image',
    permalink: '/r/test/comments/abc123/test_post',
    createdAt: new Date(),
    isSelf: false,
    selftext: '',
    approved: false,
    removed: false,
    linkFlairText: null,
    addComment: jest.fn(),
    remove: jest.fn(),
    approve: jest.fn(),
    report: jest.fn(),
    comments: {
      all: jest.fn().mockResolvedValue([]),
    },
    getSubreddit: jest.fn().mockResolvedValue({
      name: 'test',
    }),
    ...overrides,
  } as unknown as Post;
}

function createMockContext(overrides?: Partial<Context>): Context {
  return {
    reddit: {
      getCurrentUser: jest.fn().mockResolvedValue({
        username: 'testbot',
      }),
      getPostById: jest.fn(),
      getSubredditByName: jest.fn(),
    },
    redis: {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn().mockResolvedValue([]),
    },
    settings: {
      getAll: jest.fn().mockResolvedValue({
        graceperiod: 300,
        warningperiod: 600,
        mincommentlength: 50,
      }),
    },
    scheduler: {
      runJob: jest.fn(),
    },
    ...overrides,
  } as unknown as Context;
}
```

---

### 13004 - Image Detection Test Cases
**Description:** Comprehensive tests for image detection logic.

**Test Cases:**
```typescript
describe('Image Detection', () => {
  it('should detect direct image uploads', () => {
    const post = createMockPost({ postHint: 'image' });
    expect(shouldEnforceRule5(post, mockContext)).resolves.toBe(true);
  });

  it('should detect imgur links', () => {
    const post = createMockPost({
      url: 'https://imgur.com/abc123',
      postHint: 'link',
    });
    expect(shouldEnforceRule5(post, mockContext)).resolves.toBe(true);
  });

  it('should detect steam screenshots', () => {
    const post = createMockPost({
      url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=123',
    });
    expect(shouldEnforceRule5(post, mockContext)).resolves.toBe(true);
  });

  it('should detect text posts with embedded images', () => {
    const post = createMockPost({
      isSelf: true,
      postHint: 'self',
      selftext: 'Check this out https://i.imgur.com/test.jpg',
    });
    expect(shouldEnforceRule5(post, mockContext)).resolves.toBe(true);
  });

  it('should not detect text posts with long descriptions', () => {
    const post = createMockPost({
      isSelf: true,
      selftext: 'This is a long explanation with an image https://i.imgur.com/test.jpg and lots of context about what is happening in the screenshot...',
    });
    expect(shouldEnforceRule5(post, mockContext)).resolves.toBe(false);
  });

  it('should skip allowlisted users', async () => {
    mockContext.settings.getAll = jest.fn().mockResolvedValue({
      allowlistedusers: 'fatherlorris,testuser',
    });
    const post = createMockPost({
      authorName: 'fatherlorris',
      postHint: 'image',
    });
    expect(await shouldEnforceRule5(post, mockContext)).toBe(false);
  });

  it('should skip art flair', async () => {
    const post = createMockPost({
      postHint: 'image',
      linkFlairText: 'Art',
    });
    expect(await shouldEnforceRule5(post, mockContext)).toBe(false);
  });

  it('should skip comic flair', async () => {
    const post = createMockPost({
      postHint: 'image',
      linkFlairText: 'Comic',
    });
    expect(await shouldEnforceRule5(post, mockContext)).toBe(false);
  });

  it('should skip moderator-approved posts', async () => {
    const post = createMockPost({
      postHint: 'image',
      approved: true,
    });
    expect(await shouldEnforceRule5(post, mockContext)).toBe(false);
  });
});
```

---

### 13005 - Comment Validation Test Cases
**Description:** Test R5 comment detection and validation.

**Test Cases:**
```typescript
describe('Comment Validation', () => {
  it('should find valid R5 comment', async () => {
    const post = createMockPost();
    post.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: 'testuser',
        body: 'This is my detailed R5 comment explaining everything in the screenshot',
      },
    ]);

    expect(await hasValidR5Comment(post, mockContext)).toBe(true);
  });

  it('should reject short R5 comments', async () => {
    const post = createMockPost();
    post.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: 'testuser',
        body: 'R5',
      },
    ]);

    expect(await hasValidR5Comment(post, mockContext)).toBe(false);
  });

  it('should ignore comments from other users', async () => {
    const post = createMockPost({ authorName: 'testuser' });
    post.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: 'otheruser',
        body: 'This is a long comment but not from the author',
      },
    ]);

    expect(await hasValidR5Comment(post, mockContext)).toBe(false);
  });

  it('should ignore bot comments', async () => {
    const post = createMockPost();
    post.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: 'testbot',
        body: 'This is a bot warning message',
      },
    ]);

    expect(await hasValidR5Comment(post, mockContext)).toBe(false);
  });

  it('should accept any author comment over minimum length', async () => {
    const post = createMockPost({ authorName: 'testuser' });
    post.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: 'testuser',
        body: 'A'.repeat(50), // Exactly minimum length
      },
    ]);

    expect(await hasValidR5Comment(post, mockContext)).toBe(true);
  });
});
```

---

### 13006 - Timing and Grace Period Tests
**Description:** Test time-based logic for warnings and removals.

**Test Cases:**
```typescript
describe('Timing Logic', () => {
  it('should not warn during grace period', () => {
    const post = createMockPost({
      createdAt: new Date(Date.now() - 60000), // 1 minute ago
    });

    expect(getPostAge(post)).toBe(60);
    expect(isGracePeriodElapsed(post, mockContext)).resolves.toBe(false);
  });

  it('should warn after grace period', () => {
    const post = createMockPost({
      createdAt: new Date(Date.now() - 400000), // 6+ minutes ago
    });

    expect(getPostAge(post)).toBeGreaterThanOrEqual(400);
    expect(isGracePeriodElapsed(post, mockContext)).resolves.toBe(true);
  });

  it('should not remove during warning period', async () => {
    mockContext.redis.get = jest.fn().mockResolvedValue(
      (Date.now() - 300000).toString() // Warned 5 minutes ago
    );

    expect(await isWarningPeriodElapsed('abc123', mockContext)).toBe(false);
  });

  it('should remove after warning period', async () => {
    mockContext.redis.get = jest.fn().mockResolvedValue(
      (Date.now() - 700000).toString() // Warned 11+ minutes ago
    );

    expect(await isWarningPeriodElapsed('abc123', mockContext)).toBe(true);
  });
});
```

---

### 13007 - Modmail Parsing Tests
**Description:** Test modmail post ID extraction.

**Test Cases:**
```typescript
describe('Modmail Parsing', () => {
  it('should extract post ID from full URL', () => {
    const text = 'My post: https://reddit.com/r/test/comments/abc123/title';
    expect(extractPostId(text)).toBe('abc123');
  });

  it('should extract post ID from short URL', () => {
    const text = 'My post: https://redd.it/abc123';
    expect(extractPostId(text)).toBe('abc123');
  });

  it('should extract bare post ID', () => {
    const text = 'My post ID is abc123';
    expect(extractPostId(text)).toBe('abc123');
  });

  it('should return null for no post ID', () => {
    const text = 'Please help with my post';
    expect(extractPostId(text)).toBe(null);
  });

  it('should extract first post ID if multiple', () => {
    const text = 'abc123 and def456';
    expect(extractPostId(text)).toBe('abc123');
  });
});
```

---

### 13008 - Template Substitution Tests
**Description:** Test variable substitution in message templates.

**Test Cases:**
```typescript
describe('Template Substitution', () => {
  it('should substitute all variables', () => {
    const template = 'Hi {{username}}, your post in r/{{subreddit}}';
    const result = substituteVariables(template, {
      username: 'testuser',
      subreddit: 'test',
    });
    expect(result).toBe('Hi testuser, your post in r/test');
  });

  it('should handle multiple occurrences', () => {
    const template = '{{username}} and {{username}}';
    const result = substituteVariables(template, {
      username: 'testuser',
    });
    expect(result).toBe('testuser and testuser');
  });

  it('should leave unknown variables unchanged', () => {
    const template = 'Hi {{username}}, {{unknown}}';
    const result = substituteVariables(template, {
      username: 'testuser',
    });
    expect(result).toBe('Hi testuser, {{unknown}}');
  });
});
```

---

### 13009 - Error Handling Tests
**Description:** Test error scenarios and recovery.

**Test Cases:**
```typescript
describe('Error Handling', () => {
  it('should handle deleted post gracefully', async () => {
    mockContext.reddit.getPostById = jest.fn().mockRejectedValue(
      new Error('Post not found')
    );

    await expect(processPost('abc123', mockContext)).resolves.not.toThrow();
  });

  it('should handle Redis connection failure', async () => {
    mockContext.redis.get = jest.fn().mockRejectedValue(
      new Error('Connection failed')
    );

    await expect(isInWhitelist('abc123', mockContext)).resolves.toBe(false);
  });

  it('should handle permission errors', async () => {
    const post = createMockPost();
    post.remove = jest.fn().mockRejectedValue(
      new Error('403 Forbidden')
    );

    const result = await safeRemovePost(post, mockContext);
    expect(result).toBe(false);
  });

  it('should retry on transient errors', async () => {
    let callCount = 0;
    const flakeyFunction = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) throw new Error('Temporary failure');
      return 'success';
    });

    const result = await retryWithBackoff(flakeyFunction, 3);
    expect(result).toBe('success');
    expect(callCount).toBe(3);
  });
});
```

---

### 13010 - Performance Testing
**Description:** Test performance under load.

**Test Cases:**
```typescript
describe('Performance', () => {
  it('should process 100 posts in under 10 seconds', async () => {
    const posts = Array.from({ length: 100 }, (_, i) =>
      createMockPost({ id: `post${i}` })
    );

    const startTime = Date.now();

    for (const post of posts) {
      await processPost(post, mockContext);
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000);
  });

  it('should handle concurrent post processing', async () => {
    const posts = Array.from({ length: 50 }, (_, i) =>
      createMockPost({ id: `post${i}` })
    );

    const startTime = Date.now();

    await Promise.all(posts.map(post => processPost(post, mockContext)));

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);
  });

  it('should not exceed rate limits', async () => {
    const rateLimiter = new RateLimiter();

    for (let i = 0; i < 100; i++) {
      expect(await rateLimiter.checkLimit()).toBe(i < 60);
    }
  });
});
```

---

### 13011 - End-to-End Testing
**Description:** Test complete workflows from detection to removal/approval.

**Test Workflow:**
```typescript
describe('End-to-End Workflow', () => {
  it('should complete full removal workflow', async () => {
    // 1. Detect image post
    const post = createMockPost({ postHint: 'image' });
    expect(await shouldEnforceRule5(post, mockContext)).toBe(true);

    // 2. Wait for grace period (mocked)
    await simulateTimeElapsed(300); // 5 minutes

    // 3. Post warning
    await postWarning(post, mockContext);
    expect(post.addComment).toHaveBeenCalled();

    // 4. Wait for warning period (mocked)
    await simulateTimeElapsed(600); // 10 minutes

    // 5. Remove post (no R5 added)
    await removePost(post, mockContext);
    expect(post.remove).toHaveBeenCalled();
  });

  it('should complete full approval workflow', async () => {
    // 1. Detect image post
    const post = createMockPost({ postHint: 'image' });

    // 2. Post warning
    await postWarning(post, mockContext);

    // 3. User adds R5 comment
    post.comments.all = jest.fn().mockResolvedValue([
      {
        authorName: post.authorName,
        body: 'This is my detailed R5 comment explaining the screenshot',
      },
    ]);

    // 4. Detect R5 and reinstate
    expect(await hasValidR5Comment(post, mockContext)).toBe(true);
    await reinstatePost(post, mockContext);

    // 5. Verify cleanup
    expect(mockContext.redis.set).toHaveBeenCalledWith(
      `allowlist:${post.id}`,
      expect.any(String),
      expect.any(Object)
    );
  });
});
```

---

### 13012 - Test Environment Setup
**Description:** Configure test environment and mocks.

**Setup:**
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/test/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// src/test/setup.ts
import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Setup test environment
});

afterEach(() => {
  // Clear mocks after each test
  jest.clearAllMocks();
});
```

---

## Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| Post Validation | 90%+ |
| Comment Validation | 90%+ |
| Warning System | 85%+ |
| Removal System | 85%+ |
| Reinstatement System | 85%+ |
| Modmail Integration | 80%+ |
| Template System | 90%+ |
| Storage Layer | 75%+ |
| Overall | 80%+ |

---

## Manual Testing Checklist

- [ ] Install app on test subreddit
- [ ] Submit image post without R5 comment
- [ ] Verify warning posted after grace period
- [ ] Verify removal after warning period
- [ ] Submit image post with R5 comment
- [ ] Verify no warning posted
- [ ] Submit non-image post
- [ ] Verify no enforcement
- [ ] Add R5 comment after warning
- [ ] Verify post reinstated
- [ ] Send modmail reapproval request
- [ ] Verify post approved via modmail
- [ ] Test with different flairs
- [ ] Test with allowlisted users
- [ ] Verify Slack/Discord notifications
- [ ] Test settings UI changes

---

## Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - uses: codecov/codecov-action@v3
```

---

## Best Practices

✅ **Write tests first** - TDD approach
✅ **Test edge cases** - Null, empty, malformed data
✅ **Mock external dependencies** - Reddit API, Redis
✅ **Use descriptive test names** - Explain what is being tested
✅ **Aim for high coverage** - 80%+ across the board
✅ **Test error paths** - Not just happy paths
✅ **Integration tests** - Test component interactions
✅ **E2E tests** - Test complete workflows
✅ **Performance tests** - Ensure acceptable speed
✅ **Manual testing** - Real-world scenarios

❌ **Don't skip tests** - Tests are documentation
❌ **Don't test implementation details** - Test behavior
❌ **Don't use real API calls in tests** - Always mock
❌ **Don't ignore failing tests** - Fix or remove
