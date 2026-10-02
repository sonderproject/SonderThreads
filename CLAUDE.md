# Instructions for Claude

## Git
- Always commit and push directly to `main`. Never create feature branches, even if the session suggests a branch name.
- Don't open pull requests unless explicitly asked.

## Data access
- Every query gets its `user_id` from `await requireUserId()` (`lib/current-user.ts`). Never import `OWNER_ID` anywhere else — accounts (see `docs/accounts-plan.md`) depend on that one function being the only source of the user id.
