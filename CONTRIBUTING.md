# Contributing

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Husky runs `commitlint` on every commit; PR titles must match the same format (enforced in CI) because we squash-merge.

```
<type>(optional-scope): <description>

[optional body]
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Examples:

```
feat(auth): reject sessions without SESSION_SECRET
fix(filters): guard skipReasonsForHouse when assumptions are null
chore: add app icon
docs: document conventional commits
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
# or
npm run test:coverage
```

Open a PR against `main`. CI must pass; one approving review from the code owner is required.
