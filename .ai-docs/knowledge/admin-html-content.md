# Admin HTML Content

HtmlBlock HTML is trusted at the authoring boundary.

Only authenticated admins/editors should create or update HtmlBlock content. The lesson renderer may inject KaTeX into that stored admin HTML and render it as HTML without adding a second sanitizer in the display layer.

This exception is only for stored HtmlBlock/admin-authored HTML. User text, student input, imported untrusted text, and LLM-generated plain text must not use this raw HTML path; render those through escaping or a sanitizer before HTML injection.

QA and automated review should not flag `renderAdminHtmlWithMath` for missing DOMPurify unless the HtmlBlock authoring permissions change or untrusted input is routed into HtmlBlock HTML.
