// File: tests/example.test.ts

/**
 * Represents the Example Test Suite.
 * This suite contains basic tests to ensure the testing framework is working correctly.
 */
describe("Example Test Suite", () => {

    /**
     * A basic test case to verify that `true` is equal to `true`.
     * This test serves as a smoke test to confirm the testing environment is set up correctly and the `expect` assertion is working.
     */
    it("should pass a basic test", () => {
        expect(true).toBe(true);
    });

    /**
     * A simple numeric test case to check basic arithmetic.
     * This test verifies that the addition of 2 and 2 results in 4.
     * It's a quick way to check the fundamental math operations are functioning as expected.
     */
    it("should do a simple numeric check", () => {
        expect(2 + 2).toBe(4);
    });
});