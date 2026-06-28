# Create Lesson — AI Command Template

Creates a lesson with exercises in Payload CMS, matching the correct MongoDB schema.

## Workflow

### Step 1 — Find or create the course and chapter

Use `findCourses` and `findChapters` to locate existing course/chapter, or `createCourses`/`createChapters` if needed.

### Step 2 — Create the lesson (5a)

Create a lesson via `createLessons`. Use this exact payload shape:

```json
{
  "title": "<lesson title>",
  "slug": "<lesson-slug>",
  "chapter": "<chapter-id>",
  "tenant": "Aguy",
  "type": "learning",
  "status": "published",
  "isActive": true,
  "description": "<short description>"
}
```

**Required fields:** `title`, `chapter`, `tenant`, `status: "published"`, `isActive: true`

**Fields to NEVER use:** `introBlocks`, `questionBlocks`, `solutionBlocks` — these do not exist in the schema.

### Step 3 — Create exercises (5b)

For each exercise, use `createExercises`. Populate the `content` field directly as an array of `ContentBlock` objects.

**Required fields per exercise:** `title`, `lesson`, `status: "published"`, `isActive: true`, `content`

```json
{
  "title": "<exercise title>",
  "lesson": "<lesson-id>",
  "status": "published",
  "isActive": true,
  "content": [
    {
      "id": "<uuid>",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "<markdown text>",
      "mediaIds": []
    }
  ]
}
```

---

## ContentBlock JSON Templates

### Rich Text Block (Intro / Solutions)

```json
{
  "id": "<uuid>",
  "type": "rich_text",
  "format": "md-math-v1",
  "value": "<markdown string>",
  "mediaIds": []
}
```

### MCQ Block (`question_select`)

```json
{
  "id": "<uuid>",
  "type": "question_select",
  "variant": "mcq",
  "selectionMode": "single",
  "prompt": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<question text>",
    "mediaIds": []
  },
  "answer": {
    "multiSelect": false,
    "options": [
      {
        "id": "<uuid>",
        "content": {
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "<option text>",
          "mediaIds": []
        }
      }
    ],
    "correctOptionIds": ["<correct-option-id>"]
  },
  "hint": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<hint text>",
    "mediaIds": []
  },
  "solution": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<solution text>",
    "mediaIds": []
  }
}
```

### Free Response Block (`question_free_response`)

```json
{
  "id": "<uuid>",
  "type": "question_free_response",
  "prompt": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<question text>",
    "mediaIds": []
  },
  "answer": {
    "acceptedAnswers": ["<accepted answer 1>", "<accepted answer 2>"]
  },
  "hint": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<hint text>",
    "mediaIds": []
  },
  "solution": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<solution text>",
    "mediaIds": []
  }
}
```

---

## Schema Notes

- **`content`** is an array of `ContentBlock` objects — do NOT use `blocks`, `introBlocks`, `questionBlocks`, or `solutionBlocks`.
- **InlineRichText** fields (`prompt`, `hint`, `solution`, option `content`) all require `mediaIds: []` (empty array if no media).
- **IDs** should be UUIDs (e.g., use `crypto.randomUUID()` or similar).
- **`status: "published"`** and **`isActive: true`** are required for content to pass the `visibleContentFilter`.
