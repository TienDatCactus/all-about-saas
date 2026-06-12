## Description
Please include a summary of the changes and the related issue/ticket. Please also include relevant motivation and context.
Fixes # (issue number or link)
## Type of Change
Please mark the relevant options:
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Code refactoring / Cleanup
- [ ] Documentation update
- [ ] Configuration / Dependency update
## Monorepo Scope
Please check all the apps or packages modified in this PR:
### Apps
- [ ] `apps/web` (TanStack Start / Frontend)
- [ ] `apps/api` (NestJS / Backend)
### Packages
- [ ] `packages/ui` (Shared React Components)
- [ ] `packages/eslint-config` (Lint configurations)
- [ ] `packages/typescript-config` (TypeScript configurations)
## Database / Migration Changes (if applicable)
If this PR involves database changes (TypeORM / PostgreSQL):
- [ ] I have generated and verified the database migration scripts (`npm run migration:generate`).
- [ ] I have verified the migration rollback works (`npm run migration:revert`).
- [ ] No database changes are introduced.
## How Has This Been Tested?
Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce.
- **Test A:** e.g., verified user registration with Google OAuth.
- **Test B:** e.g., ran `npm run test` in `apps/api` and all tests passed.
## Checklist
- [ ] My code follows the style guidelines of this project.
- [ ] I have performed a self-review of my own code.
- [ ] I have commented my code, particularly in hard-to-understand areas.
- [ ] I have updated the documentation / Swagger API docs accordingly.
- [ ] My changes generate no new warnings or console errors.
- [ ] I have run `npm run lint` and `npm run format` and fixed any issues.
- [ ] I have run `npm run check-types` (or `npm run typecheck`) and resolved all type errors.

@mention related reviewer
