import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    passWithNoTests: true,
    environment: 'jsdom',
    // NOTE: src/test/setup.ts (jest-dom matchers) is intentionally NOT wired as
    // setupFiles — the @testing-library/jest-dom devDependency is currently
    // installed from an unbuilt GitHub tarball (no dist/), so importing it fails
    // at transform time. No current test needs DOM matchers. Add it back here
    // once that dependency is pinned to a published, built release.
    // Scope to the app's own tests; the `@canopy/screen-ir` workspace package
    // owns and runs its own conformance suite.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
