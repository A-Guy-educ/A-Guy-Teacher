Added @ai-summary headers to all 8 modules in src/client/hooks and created a central index.ts.

Central index.ts documents the folder purpose (client-side React hooks for auth, search, progress, time tracking, exams), lists key hooks, and captures four load-bearing gotchas:
- useProgressMap gradeLevel falls back to localStorage userProfile — pass explicitly when content grade differs
- useActiveTimeTracker stops heartbeats when tab is hidden
- useCourseSearch debounces at 300ms and requires 2+ characters
- useAccessGate timer pauses while warning modal is open

Each module header includes @fileType, @domain, @pattern, and @ai-summary following the conventions in src/server/services/.
