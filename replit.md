# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Real-time**: Socket.IO (game multiplayer)
- **File uploads**: Multer (Excel + PNG images)

## Applications

### Flash / لمحة (artifacts/flash)
A browser-based multiplayer flash memory game.
- Players join via 5-digit room code
- Admin uploads Excel sheet (words/numbers) and transparent PNG images
- 9 rounds: Easy (600ms), Medium (300ms), Hard (150ms) flash duration
- Billboard-style game UI using the purple city background image
- Real-time via Socket.IO at `/api/socket.io`

### API Server (artifacts/api-server)
Express 5 backend with Socket.IO for the Flash game.
- Socket.IO multiplayer game management at `/api/socket.io`
- File upload at `/api/upload/excel` and `/api/upload/image`
- Uploaded files served at `/api/uploads/:filename`
- Uploads stored in `artifacts/api-server/uploads/`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
