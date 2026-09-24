## Services

There is no catalogue of services. A service is whatever address somebody types in the Add window, and every service works the same way:

- its icon is the page's own favicon, kept on the record as `favicon` so the rail has it before the page loads;
- its unread count is read from the page title, in the shape `(3) Inbox`, or `(•)` for "something, but not how many";
- a link it opens stays inside the app, in a window that shares its session, and the context menu's Open Link in Browser is the way out.

Records saved while the catalogue existed keep the catalogue id in `type`, which is part of their session partition and must not change. They wear their initials until their page shows a favicon. Their `js_unread`, the unread code the Add window used to take, stays on the model so they keep their shape, and nothing runs it; `media` is `null` on them, which is asked about like `false`.
