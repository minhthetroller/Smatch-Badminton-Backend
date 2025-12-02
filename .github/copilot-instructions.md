# TypeScript + Express.js Coding Rules

## Project Structure
- Follow layered architecture: routes → controllers → services → repositories
- Keep files small and focused on single responsibility
- Export via index.ts barrel files per folder

## TypeScript
- Use strict mode, avoid `any`
- Prefer `type` for DTOs, `interface` for contracts
- Use `unknown` over `any`, narrow with type guards
- Always define return types for functions
- Use `.js` extension in imports (ESM)

## Express
- Controllers: Handle HTTP only (req/res), delegate to services
- Services: Business logic, no Express types
- Repositories: Data access only, no business logic
- Use async/await with try-catch, pass errors to `next()`
- Validate input at controller/middleware level

## Naming
- Files: `kebab-case.ts` or `feature.layer.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase` (DTOs suffix with `Dto`)

## Database (Prisma)
- Use migrations for schema changes
- Repository pattern for all DB operations
- Handle errors at service layer
- Use transactions for multi-table operations

## Error Handling
- Throw custom AppError subclasses
- Let error middleware handle all errors
- Never expose internal errors to clients in production

## API Response
- Use consistent response format: `{ success, data, meta? }` or `{ success, error }`
- Use proper HTTP status codes
- Paginate list endpoints
