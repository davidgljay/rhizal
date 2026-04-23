# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Rhizal is a Signal-based chatbot for community organizing — no AI, just structured conversation flows. It routes messages between Signal groups via hashtags, handles member onboarding, sends announcements, and manages permission-gated access. Bot behavior is defined in YAML scripts, not code.

## Commands

```bash
# Build: transpile src/ → dist/ via Babel (also copies initialization/ and scripts_config/)
yarn build

# Run tests (Jest, watch mode)
yarn test

# Run a single test file without watch mode
npx jest src/tests/models/membership.test.js --watchAll=false

# Development: nodemon on dist/app.js (auto-restarts, but you must run yarn build first)
yarn dev

# Docker: start production / stop all containers
yarn start
yarn stop

# First-time setup (interactive: DB schema, Signal registration, script sync)
yarn rhizal-init

# Sync YAML scripts to DB after editing scripts_config/
yarn script-sync

# Wipe and recreate DB schema
yarn wipe-db
```

`src/` is the source of truth; `dist/` is the transpiled output. After editing `src/`, run `yarn build` before `yarn dev` picks up changes.

## Architecture

### Message Flow

```
Signal network
  → signal-cli-rest-api (Docker service, WebSocket)
  → src/apis/signal.js        (one WS connection per bot phone number)
  → src/routes/ws.js          (classify: DM / group message / reply to bot)
  → src/handlers/receive_message.js  (main dispatch: loads community + membership state)
  → models (DB reads/writes via Hasura GraphQL)
  → script runner (advances YAML script steps)
  → src/apis/signal.js send   (reply back to Signal)
```

`src/app.js` bootstraps the app: fetches all bot phone numbers from DB, opens a WebSocket per account.

### Key Modules

- **`src/models/`** — Data access classes (Community, Membership, GroupThread, Message, Script). All DB access goes through Hasura GraphQL — never raw SQL at runtime.
- **`src/apis/signal.js`** — Sends/receives Signal messages; also handles identity trust, typing indicators, reactions, group management.
- **`src/apis/graphql.js`** — Thin HTTP wrapper around Hasura for all queries/mutations.
- **`src/handlers/receive_message.js`** — Core business logic: `receive_message` (DM), `receive_group_message` (group), `receive_reply` (reply to bot in group), `group_join_or_leave`.
- **`src/helpers/rhizal_parser.js`** — Parses and executes YAML scripts (variable interpolation, conditionals, actions).
- **`src/helpers/hashtag_commands.js`** — Detects and routes hashtag-based cross-group messages.

### The Script System

All bot conversation flows are YAML files in `scripts_config/`. After editing, run `yarn script-sync` to load them into the DB.

```yaml
steps:
  - step: 0
    send:
      - "Hello {{name}}! What's your zip code?"
    on_receive:
      if: "regex(message, /\\d{5}/)"
      then:
        - set_variable:
            variable: zip_code
            value: "{{message}}"
        - step: 1
      else:
        - step: 0   # repeat
  - step: 1
    send:
      - "Got it, thanks!"
    on_receive:
      - step: done
```

Available `on_receive` actions: `set_variable`, `set_group_variable`, `set_message_type`, `send_to_admins`, `if/then/else`. Variables are interpolated as `{{variable_name}}`.

### Infrastructure (Docker Compose)

| Service | Image | Role |
|---|---|---|
| `rhizal` | Node 23 (this repo) | Application |
| `signal-cli` | `bbernhard/signal-cli-rest-api` | Signal protocol bridge (WebSocket on :8080) |
| `postgres` | PostgreSQL 15 | Primary database |
| `graphql-engine` | Hasura v2 | GraphQL API over Postgres |

The app only talks to Postgres via Hasura at `http://graphql-engine:8080/v1/graphql`.

## Configuration

**`scripts_config/community_config.yml`** — Community settings: bot phone number, Signal username/profile, and `access_levels` (named permission groups like `admins`, `greeters`). Each access level lists permissions: `announcement`, `group_comms`, `onboarding`.

**`.env`** (copy from `sample.env`) — `POSTGRES_PASSWORD`, `HASURA_GRAPHQL_ADMIN_SECRET`, `PG_DATABASE_URL`, `HASURA_GRAPHQL_METADATA_DATABASE_URL`.

**`scripts_config/*.yml`** — Individual conversation scripts. Synced to DB via `yarn script-sync`.

## Tests

Tests live in `src/tests/`. `integration.test.js` and `integration_scenarios.test.js` are the most comprehensive — they cover full message flows end-to-end. Mocks are in `src/tests/mocks/`. Tests run against transpiled source via `babel-jest`.
