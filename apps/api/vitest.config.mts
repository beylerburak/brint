import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: [
      'node_modules',
      'dist',
      'build',
      // Exclude old script-based test files (they use main() functions, not Vitest format)
      'src/core/auth/auth.context.spec.ts',
      'src/core/auth/permission.service.spec.ts',
      'src/core/auth/permissions.registry.spec.ts',
      'src/core/auth/require-permission.spec.ts',
      'src/core/auth/session.service.spec.ts',
      'src/core/auth/token.service.spec.ts',
      'src/modules/auth/auth.refresh-logout.spec.ts',
      'src/modules/auth/google-oauth.service.spec.ts',
      'src/modules/auth/magic-link.service.spec.ts',
      'src/modules/user/user.repository.spec.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.spec.ts',
        '**/test/**',
        'prisma/**',
        'scripts/**',
      ],
    },
  },
});

