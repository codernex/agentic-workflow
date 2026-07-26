# Agentic Workflow Automation Engine 🚀

> **Next-Gen Event-Driven AI Agent DAG Execution Platform**  
> Powered by Hugging Face `smolagents`, Isolated Python Subprocess Sandboxing, Mailtrap Email Verification, and Real-Time WebSocket Execution Streaming.

---

## 🌟 Overview

The **Agentic Workflow Automation Engine** is a modern, full-stack monorepo platform designed to visually orchestrate autonomous AI agents, isolated Python execution sandboxes, event webhooks, and third-party integrations into directed acyclic graphs (DAGs).

---

## ✨ Key Features

- 🎨 **Visual DAG Canvas Studio**: Interactive node-based graph editor built with ReactFlow, featuring a collapsible nodes collection sidebar, 1-click custom tool builder, and live thought trace execution drawers.
- 🤖 **Hugging Face `smolagents` Reasoning**: Autonomous `CodeAgent` execution powered by OpenRouter / OpenAI models with dynamic template interpolation (e.g. `{node-1.data}`, `{source}`).
- 🔒 **Isolated Python Subprocess Sandbox**: Executes custom Python code snippets inside separate `multiprocessing.Process` workers with a restricted builtins whitelist and strict **5.0s execution timeout** limits.
- 🔀 **Selective Data Forwarding**: Per-node field projection control (`all` or `selected_keys`) allowing users to choose exact payload keys passed to downstream nodes.
- 📧 **User Authentication & Mailtrap Verification**: 6-digit email verification code delivery powered by the **Official Mailtrap Python SDK** with elegant responsive HTML email templates, JWT security, and a resend code facility.
- ⚡ **Event-Driven Webhook Ingestion**: Dedicated webhook trigger endpoints (`POST /api/v1/workflows/webhooks/{workflow_id}`) with raw JSON payload inspection.
- 🛡️ **GDPR Article 17 & 20 Compliance**: Native 1-click data portability export (downloadable `gdpr_export_<user_id>.json` archive) and permanent account erasure rights ("Right to be Forgotten").
- 🚀 **SEO & Social Sharing Support**: Built with Next.js 16 dynamic metadata, OpenGraph cards, Twitter preview cards, and JSON-LD `SoftwareApplication` structured schemas.

---

## 🛠️ Technology Stack

### Frontend (`apps/web`)
- **Framework**: Next.js 16 (App Router, Turbopack) & React 19
- **Styling**: TailwindCSS with custom Glassmorphism aesthetic tokens
- **Graph Editor**: `@xyflow/react` (ReactFlow v12)
- **State & Data Fetching**: TanStack React Query v5 & `@repo/api-client`
- **Icons & UI Components**: Lucide React, Radix UI, Shadcn UI

### Backend Engine (`apps/engine`)
- **Framework**: FastAPI (Python 3.14)
- **Database & ORM**: PostgreSQL via SQLModel & AsyncPG
- **Migrations**: Alembic
- **AI Agent Framework**: Hugging Face `smolagents` (`CodeAgent`, `OpenAIServerModel`)
- **Email Delivery**: Official `mailtrap` Python SDK
- **Security**: Direct `bcrypt` password hashing, `python-jose` JWT tokens

---

## 📁 Repository Structure

```text
agentic-workflow/
├── apps/
│   ├── engine/                # FastAPI Engine (Python 3.14)
│   │   ├── alembic/           # Database schema migrations
│   │   ├── src/
│   │   │   ├── api/v1/        # Auth, Workflows, Executions, GDPR, Webhooks APIs
│   │   │   ├── auth/          # Password hashing & JWT dependencies
│   │   │   ├── engine/        # smolagents agent runner & isolated sandbox.py
│   │   │   ├── models/        # SQLModel entities (User, Workflow, Execution, Tool)
│   │   │   └── services/      # Mailtrap email verification service
│   │   └── tests/             # Pytest suite (pytest 9/9 passed)
│   └── web/                   # Next.js 16 Web Application
│       ├── app/               # Public Landing Page, Dashboard, Login, Workflows
│       ├── components/        # CanvasEditor, CustomCanvasNode, GDPR & Onboarding
│       ├── context/           # AuthContext & useAuth hook
│       └── lib/               # API client setup
├── packages/
│   └── api-client/            # Auto-generated OpenAPI TypeScript client (@repo/api-client)
├── turbo.json                 # Turborepo configuration
└── pnpm-workspace.yaml        # Monorepo workspace configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18 & **pnpm** >= 9.0
- **Python** >= 3.14 & **uv** package manager
- **PostgreSQL** running locally on port `5432`

---

### 1. Installation

Clone the repository and install frontend dependencies:

```bash
pnpm install
```

Set up the Python backend environment in `apps/engine`:

```bash
cd apps/engine
uv sync
```

---

### 2. Database Migrations

Ensure your PostgreSQL database `workflow` exists, then run Alembic migrations:

```bash
cd apps/engine
.venv/bin/alembic upgrade head
```

---

### 3. Generate OpenAPI TypeScript Client

```bash
pnpm --filter @repo/api-client build
```

---

### 4. Running Locally

Start both the Next.js frontend (`http://localhost:3000`) and Python FastAPI engine (`http://localhost:8000`) simultaneously:

```bash
pnpm dev
```

---

## 🧪 Testing & Builds

### Run Backend Test Suite

```bash
cd apps/engine
.venv/bin/pytest
```

### Build Production Web App

```bash
pnpm --filter web run build
```

---

## 🔗 Key API Routes (`/api/v1`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/api/v1/auth/register`** | `POST` | Registers a new user and sends Mailtrap 6-digit email verification code. |
| **`/api/v1/auth/verify-email`** | `POST` | Validates 6-digit email verification code. |
| **`/api/v1/auth/resend-code`** | `POST` | Resends a new 6-digit verification code via Mailtrap. |
| **`/api/v1/auth/login`** | `POST` | Authenticates user and returns JWT access token. |
| **`/api/v1/workflows`** | `GET / POST` | User-scoped workflow management. |
| **`/api/v1/workflows/{id}/execute`** | `POST` | Launches manual workflow DAG execution. |
| **`/api/v1/workflows/webhooks/{id}`** | `POST` | Triggers workflow via external HTTP POST webhook. |
| **`/api/v1/gdpr/export`** | `GET` | Machine-readable JSON export (Article 20). |
| **`/api/v1/gdpr/account`** | `DELETE` | Permanent account & workflow data erasure (Article 17). |

---

## 📄 License

MIT License &copy; Agentic Workflow Platform. All rights reserved.
