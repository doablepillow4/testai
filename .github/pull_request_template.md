## Summary

Brief description of what this PR changes and why.

## Changes

- 
- 
- 

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code quality
- [ ] Documentation
- [ ] Dependency update

## Checklist

- [ ] `pnpm run typecheck` passes with no errors
- [ ] If `openapi.yaml` was changed, codegen was re-run (`pnpm --filter @workspace/api-spec run codegen`)
- [ ] If DB schema was changed, `pnpm --filter @workspace/db run push` was run
- [ ] No `any` types or `@ts-ignore` added without explanation
- [ ] All external API calls have fallback data

## Testing

Describe how you tested these changes.

## Related Issues

Closes #
