# Dependency Audit Report
*Generated: December 28, 2025*

## Security Vulnerabilities

### 1. esbuild (Moderate Severity) ✅ FIXED
- **Package:** esbuild
- **Vulnerable versions:** <=0.24.2
- **Patched versions:** >=0.25.0
- **Status:** ✅ Fixed via pnpm override
- **Fix Applied:** Added pnpm override in `package.json`:
  ```json
  "pnpm": {
    "overrides": {
      "esbuild": ">=0.25.0"
    }
  }
  ```
- **Verification:** `pnpm audit` now shows "No known vulnerabilities found"
- **Original Issue:** esbuild enables any website to send any requests to the development server and read the response
- **More info:** https://github.com/advisories/GHSA-67mh-4wv8-2f99

## Outdated Packages

### Minor Updates Available:
- `@eslint/js`: 9.39.1 → 9.39.2
- `eslint`: 9.39.1 → 9.39.2
- `@mui/x-data-grid`: 8.22.0 → 8.23.0
- `typescript-eslint`: 8.49.0 → 8.50.1
- `eslint-plugin-react-refresh`: 0.4.24 → 0.4.26

### Major Updates Available (Require Testing):
- `@mui/icons-material`: 6.5.0 → 7.3.6 (Major)
- `@mui/material`: 6.5.0 → 7.3.6 (Major)
- `@types/node`: 24.10.3 → 25.0.3 (Major)
- `date-fns`: 3.6.0 → 4.1.0 (Major)
- `react-router-dom`: 6.30.2 → 7.11.0 (Major)
- `recharts`: 2.15.4 → 3.6.0 (Major)
- `vite`: 5.4.21 → 7.3.0 (Major)
- `@google/generative-ai`: 0.21.0 → 0.24.1 (Minor)

## Recommendations

### ✅ Completed Actions:
1. ✅ **Fixed esbuild vulnerability** - Added pnpm override (>=0.25.0)
2. ✅ **Updated minor versions** - Updated ESLint and related packages:
   - @eslint/js: 9.39.1 → 9.39.2
   - eslint: 9.39.1 → 9.39.2
   - eslint-plugin-react-refresh: 0.4.24 → 0.4.26
   - typescript-eslint: 8.49.0 → 8.50.1
   - @mui/x-data-grid: 8.22.0 → 8.23.0

### Future Considerations:
1. **Plan major version updates** - Test thoroughly before updating:
   - MUI v6 → v7 (breaking changes)
   - Vite v5 → v7 (breaking changes)
   - React Router v6 → v7 (breaking changes)
   - date-fns v3 → v4 (breaking changes)
   - recharts v2 → v3 (breaking changes)

### Unused Dependencies Check:
Run `pnpm list --depth=0` and manually verify each dependency is used in the codebase.

## API Dependencies

The API directory uses npm (has package-lock.json). Consider:
- Running `npm audit` in the `api/` directory separately
- Standardizing on one package manager (pnpm or npm) across the project

