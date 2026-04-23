# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Rhizal is a Signal-based chatbot platform for community organizing — no AI, just structured conversation flows. It routes messages between Signal groups via hashtags, handles onboarding, announcements, events, and permission-gated access. The bot logic is defined entirely in YAML scripts.

## Commands

```bash
# Build (transpile src/ → dist/ via Babel)
yarn build

# Run tests (Jest, watch mode)
yarn test

# Run a single test file
npx jest src/tests/models/membership.test.js

# Development (runs nodemon on dist/app.js, auto-rebuilds)
yarn dev

# Docker: start production / stop
yarn start
yarn stop

# Docker: start dev environment
yarn dev-start

# First-time setup (interactive: DB schema, Signal registration, config)
yarn rhizal-init

# Sync YAML scripts to database after editing scripts_config/
yarn script-sync

# Wipe and recreate database schema
yarn wipe-db
```

Source lives in `src/`, transpiled output goes to `dist/`. After editing `src/`, run `yarn build` (or use `yarn dev` which auto-rebuilds).

## Architecture

### Message Flow

```
Signal (WebSocket via signal-cli-rest-api)
  → src/apis/signal.js          (WebSocket manager, one connection per bot account)
  → src/routes/ws.js            (classifies: DM / group message / reply)
  → src/handlers/receive_message.js  (main dispatch logic)
  → models + script runner
  → Signal send API
```

`src/app.js` bootstraps everything: loads all bot phone numbers from DB, opens a WebSocket per account, starts listening.

### Key Layers

- **`src/models/`** — Data access classes (Community, Membership, GroupThread, Message, Script). All DB access goes through Hasura GraphQL.
- **`src/apis/signal.js`** — Sends/receives Signal messages. Also handles trust, typing indicators, reactions, group management.
- **`src/apis/graphql.js`** — Thin wrapper around Hasura GraphQL for all DB operations.
- **`src/handlers/`** — Business logic. `receive_message.js` is the main handler; others handle specific flows (onboarding, group threads, admin messages).
- **`src/helpers/`** — YAML script parser, hashtag command parsing, utilities.
- **`src/initialization/`** — First-run setup: DB schema (`rhizal_schema.sql`), Hasura metadata, Signal config.

### The Script System

Bot behavior is defined in YAML files in `scripts_config/`. These are loaded into the database via `yarn script-sync`.

```yaml
# A script step has `send` (outgoing) and `on_receive` (what to do with reply)
steps:
  - step: 0
    send:
      - "Hello {{name}}! What's your zip code?"
    on_receive:
      actions:
        - action: set_variable
          variable: zip_code
          value: "{{message}}"
      next_step: 1
```

- Variables: `{{name}}`, `{{message}}`, custom ones from GraphQL queries
- Actions: `set_variable`, `set_group_variable`, `set_message_type`, `send_to_admins`, conditionals (`if`/`then`/`else`)
- Scripts are linked to communities; `community_config.yml` sets access levels and bot phone numbers

### Infrastructure (Docker Compose)

| Service | Role |
|---|---|
| `rhizal` | Node.js app (this repo) |
| `signal-cli` | `bbernhard/signal-cli-rest-api` — bridges Signal protocol |
| `postgres` | PostgreSQL 15 — primary database |
| `graphql-engine` | Hasura v2 — GraphQL API over Postgres |

Hasura is the only way the app talks to Postgres. The GraphQL endpoint is `http://graphql-engine:8080/v1/graphql` inside Docker.

## Configuration

**`scripts_config/community_config.yml`** — master community config: bot phone number, access levels, permission assignments. Edit this and run `yarn script-sync` to apply.

**`.env`** — Docker secrets: `POSTGRES_PASSWORD`, `HASURA_GRAPHQL_ADMIN_SECRET`, `PG_DATABASE_URL`, `HASURA_GRAPHQL_METADATA_DATABASE_URL`.

**`scripts_config/*.yml`** — Individual conversation scripts (onboarding, group_thread, announcements, etc.).

## Tests

Tests are in `src/tests/`. Integration tests (`integration.test.js`, `integration_scenarios.test.js`) are the most comprehensive — they cover full message flows. Mocks are in `src/tests/mocks/`.

Jest is configured in `jest.config.js` with Babel transpilation via `babel-jest`.
