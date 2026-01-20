# GameCreatorMVP-v2

AI-powered browser game creation platform. Create 2D/3D games through natural language chat.

## Overview

A chat-based game creation platform where users describe what they want, and AI (Gemini Flash 2.0 / Claude Code CLI) automatically generates playable browser games with real-time preview.

### Key Features

- **Chat-based Interface**: Describe your game in natural language
- **Real-time Preview**: See changes instantly in the browser
- **2D/3D Support**: Automatic detection or user selection (P5.js for 2D, Three.js for 3D)
- **AI Image Generation**: Generate game assets with Gemini Nano Banana
- **Version Control**: Git-based history for each project
- **Multi-project Management**: Create and manage multiple games
- **SQLite Database**: Persistent storage for chat history and project data

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS, WebSocket, HTML5 |
| Backend | Node.js, Express |
| AI | Gemini Flash 2.0, Claude Code CLI |
| Database | SQLite (better-sqlite3) |
| Image Processing | Sharp |
| Version Control | Git (per-project) |

## Quick Start

### Prerequisites

- Node.js >= 18
- Git
- Gemini API Key (required)
- Claude Code CLI (optional, for advanced generation)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd GameCreatorMVP-v2

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your API keys

# Start the server
npm start
```

### Access

Open http://localhost:3000 in your browser.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI generation |
| `REPLICATE_API_TOKEN` | No | Replicate API token (for alternative image generation) |

## Project Structure

```
GameCreatorMVP-v2/
├── server/                    # Backend
│   ├── index.js              # Main server (Express + WebSocket)
│   ├── claudeRunner.js       # AI processing core (Claude CLI + Gemini)
│   ├── geminiClient.js       # Gemini API client
│   ├── database.js           # SQLite management
│   ├── userManager.js        # User/project/Git management
│   ├── jobManager.js         # Async job management
│   └── prompts/              # Prompt templates
│       ├── createPrompt.js   # New game creation prompts
│       ├── updatePrompt.js   # Update prompts
│       └── baseRules.js      # Common rules
├── public/                   # Frontend
│   ├── index.html            # Landing page
│   ├── create.html           # Game creation page
│   ├── editor.html           # Game editor
│   ├── app.js                # Client-side logic
│   └── style.css             # Styles
├── users/                    # User data (gitignored)
│   └── {visitorId}/
│       └── {projectId}/
│           ├── index.html    # Generated game
│           ├── specs/        # Game specifications
│           └── assets/       # Generated images
├── data/                     # Database (gitignored)
│   └── gamecreator.db        # SQLite database
├── assets/                   # Uploaded assets (gitignored)
├── docs/                     # Additional documentation
├── ARCHITECTURE.md           # System architecture details
├── DESIGN_GUIDELINE.md       # Design guidelines
└── SPECIFICATION.md          # Full specification
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with auto-reload (--watch) |
| `npm run classify:html` | Generate game classification report (HTML) |
| `npm run classify:json` | Generate game classification report (JSON) |
| `npm run classify:csv` | Generate game classification report (CSV) |
| `npm run classify:all` | Generate all report formats |

## API Endpoints

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `user_message` | Client → Server | Send chat message |
| `ai_chunk` | Server → Client | Streaming AI response |
| `game_updated` | Server → Client | Game code updated |
| `error` | Server → Client | Error notification |

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Landing page |
| GET | `/create` | Game creation page |
| GET | `/editor` | Game editor |
| GET | `/game/:visitorId/:projectId/*` | Serve game files |
| POST | `/api/upload` | Upload asset files |
| GET | `/api/assets/:visitorId/:projectId` | List project assets |

## Architecture

```
Browser ←→ WebSocket ←→ Express Server
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
       claudeRunner    userManager      database
       (Gemini/CLI)    (Git ops)        (SQLite)
            │               │               │
            ▼               ▼               ▼
       External API    users/{id}/     data/*.db
```

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Development

### File Watching

```bash
npm run dev
```

This uses Node.js `--watch` flag for automatic restarts.

### Database

SQLite database is created automatically at `data/gamecreator.db` on first run.

### Git Versioning

- Each project has its own Git repository in `users/{visitorId}/{projectId}/.git`
- Global activity log in `users/.git`

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Detailed system architecture |
| [DESIGN_GUIDELINE.md](./DESIGN_GUIDELINE.md) | UI/UX design guidelines |
| [SPECIFICATION.md](./SPECIFICATION.md) | Full product specification |

## Codex / AI Agent Notes

### Important Files for Context

1. **Entry Points**
   - `server/index.js` - Main server, WebSocket handling
   - `public/app.js` - Client-side logic

2. **Core Logic**
   - `server/claudeRunner.js` - AI generation logic (largest file, ~96KB)
   - `server/geminiClient.js` - Gemini API integration
   - `server/userManager.js` - User/project management

3. **Data Layer**
   - `server/database.js` - SQLite operations
   - `server/prompts/` - AI prompt templates

### Code Style

- ES Modules (`import`/`export`)
- Async/await for async operations
- JSDoc comments for functions
- Japanese comments in some places (bilingual codebase)

### Testing

No automated tests currently. Manual testing via browser.

### Common Tasks

| Task | Files to Modify |
|------|-----------------|
| Add new AI feature | `server/claudeRunner.js`, `server/prompts/` |
| Modify UI | `public/*.html`, `public/app.js`, `public/style.css` |
| Add API endpoint | `server/index.js` |
| Database schema change | `server/database.js` |
| User/project logic | `server/userManager.js` |

## License

Private / Proprietary

---

## Troubleshooting

### Common Issues

**Port 3000 already in use**
```bash
lsof -i :3000
kill -9 <PID>
```

**Database locked**
- Ensure only one server instance is running
- Check for zombie processes

**Gemini API errors**
- Verify `GEMINI_API_KEY` in `.env`
- Check API quota limits

**Git operations failing**
- Ensure Git is installed: `git --version`
- Check file permissions in `users/` directory
