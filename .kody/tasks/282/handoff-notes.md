Fix two failures on PR #282:

**Type errors (lines 127/130):** `string | ObjectId` not assignable to `Condition<ObjectId>`. The `asObjectIdOrString` helper returned a union type that MongoDB's typed `Filter` wouldn't accept. Fixed by inlining the ternary and using `as unknown as ObjectId` double-cast — safe because the codebase always passes valid 24-char hex IDs.

**Lint error:** `SUPPORTED_LOCALES` const was `as const`-asserted but only its type `SupportedLocale` was used, triggering `@typescript-eslint/no-unused-vars`. Fixed by replacing `const SUPPORTED_LOCALES = ['en', 'he'] as const; type SupportedLocale = ...` with the simpler `type SupportedLocale = 'en' | 'he'`.
