import { vi, beforeEach, afterEach } from 'vitest';

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Restore all mocks after each test
afterEach(() => {
  vi.restoreAllMocks();
});
