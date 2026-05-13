import assert from 'node:assert/strict';
import type { Mock } from 'node:test';

/**
 * Marker for "actual array must include all listed items".
 * Used inside `matches` / `assertCalledWith` for shallow array containment.
 */
const ARR_CONTAINS = Symbol('arrayContaining');
const STR_CONTAINS = Symbol('stringContaining');

export function arrayContaining<T>(items: T[]): unknown {
  return { [ARR_CONTAINS]: items };
}

export function stringContaining(sub: string): unknown {
  return { [STR_CONTAINS]: sub };
}

/**
 * Deep partial-match: every key in `expected` must be present in `actual`
 * with a value that itself matches. Use `arrayContaining` / `stringContaining`
 * inside `expected` to express looser checks. Equivalent to Vitest's
 * `expect.objectContaining` combined with the other matchers.
 */
export function matches(actual: any, expected: any): boolean {
  if (expected && typeof expected === 'object' && ARR_CONTAINS in expected) {
    if (!Array.isArray(actual)) return false;
    const items = (expected as any)[ARR_CONTAINS] as any[];
    return items.every((item) => actual.some((a: any) => matches(a, item)));
  }
  if (expected && typeof expected === 'object' && STR_CONTAINS in expected) {
    return typeof actual === 'string' && actual.includes((expected as any)[STR_CONTAINS]);
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((v, i) => matches(actual[i], v));
  }
  if (expected && typeof expected === 'object') {
    if (actual == null || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([k, v]) => matches((actual as any)[k], v));
  }
  return actual === expected;
}

export function assertMatches(actual: any, expected: any, message?: string): void {
  if (!matches(actual, expected)) {
    throw new assert.AssertionError({
      message:
        message ??
        `Expected value to match.\nactual:   ${safeStringify(actual)}\nexpected: ${safeStringify(expected)}`,
      actual,
      expected,
      operator: 'matches',
    });
  }
}

/**
 * Asserts the mock was called at least once with arguments that match the
 * provided list (each positional argument is compared with `matches`).
 */
export function assertCalledWith(fn: Mock<any>, ...expectedArgs: any[]): void {
  const calls = fn.mock.calls;
  const hit = calls.some((c) => matches(Array.from(c.arguments), expectedArgs));
  if (!hit) {
    throw new assert.AssertionError({
      message: `Expected mock to have been called with matching arguments.\nexpected: ${safeStringify(expectedArgs)}\ncalls: ${safeStringify(calls.map((c) => Array.from(c.arguments)))}`,
      operator: 'calledWith',
    });
  }
}

export function assertCalled(fn: Mock<any>): void {
  assert.ok(fn.mock.callCount() > 0, 'Expected mock to have been called at least once');
}

export function assertNotCalled(fn: Mock<any>): void {
  assert.equal(fn.mock.callCount(), 0, 'Expected mock not to have been called');
}

export function assertCalledTimes(fn: Mock<any>, n: number): void {
  assert.equal(
    fn.mock.callCount(),
    n,
    `Expected mock to be called ${n} times, but was called ${fn.mock.callCount()}`
  );
}

export function rejectWith(fn: Mock<any>, err: unknown): void {
  fn.mock.mockImplementation((() => Promise.reject(err)) as any);
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_, val) => (typeof val === 'function' ? '[Function]' : val));
  } catch {
    return String(v);
  }
}
