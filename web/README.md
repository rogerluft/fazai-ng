# FazAI - Web Interface

A modern web interface for the FazAI autonomous Linux administration agent. Built with Next.js 14, TypeScript, TailwindCSS, and shadcn/ui.

## Overview

FazAI Web is a comprehensive dashboard for monitoring, controlling, and configuring the FazAI autonomous agent. It provides interfaces for:

- **Dashboard**: Real-time agent status, metrics, and action timeline
- **Personality Manager**: Define and adjust agent behavioral traits
- **Memory Viewer**: Search and explore agent conversation history
- **Learning Panel**: Monitor agent learning progress and pattern detection
- **Knowledge Base**: Manage agent knowledge repository
- **Inference Rules**: Create and manage decision-making rules

## Features

### Dashboard
- Real-time agent status (online/offline/paused)
- Key metrics: uptime, actions/minute, success rate, total actions
- System resource monitoring (memory, CPU usage)
- 24-hour performance charts
- Action timeline with status tracking
- Agent control buttons (pause, resume, stop)

### Personality Manager
- CRUD operations for agent traits
- Three categories: Communication, Decision-Making, Ethics
- Intensity sliders (0-100%) for each trait
- Personality preview and behavior modeling

### Memory Viewer
- Semantic search across conversation history
- Filter by role (user, assistant, system, autonomous)
- Memory importance scoring
- Conversation summaries and timestamps

### Learning Panel
- Analytics dashboard with success rate and confidence metrics
- Category distribution charts (Linux, Network, Security, Social)
- Outcome distribution (Success, Failure, Partial)
- Error tracking and pattern detection
- Confidence scoring for all learnings

### Knowledge Base
- Add/edit/delete knowledge entries
- Categorization: Networking, Storage, Security
- Scope selection: cluster, host, container
- Confidence scoring and validation status
- Full Markdown support for documentation

### Inference Rules
- Visual rule builder with condition/action syntax
- Priority-based rule ordering (1-10)
- Enable/disable toggles for rules
- Rule testing and execution tracking
- Automatic vs. user-created rule distinction

## Architecture

### Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: Zustand
- **Data Fetching**: React Query
- **Vector Database**: Qdrant (for semantic search)
- **Charts**: Recharts
- **Icons**: Lucide React

### Directory Structure

```
web/
├── app/
│   ├── (dashboard)/        # Main dashboard layout
│   │   ├── page.tsx        # Dashboard home
│   │   ├── personality/
│   │   ├── memory/
│   │   ├── learning/
│   │   ├── knowledge/
│   │   └── inference/
│   ├── api/                # API routes
│   │   ├── agent/
│   │   ├── personality/
│   │   ├── memory/
│   │   ├── learning/
│   │   ├── knowledge/
│   │   └── rules/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn UI components
│   ├── sidebar.tsx         # Main navigation
│   └── dashboard/
│       ├── agent-status.tsx
│       ├── metrics-panel.tsx
│       └── action-timeline.tsx
├── lib/
│   ├── api.ts              # API client
│   ├── qdrant.ts           # Qdrant integration
│   ├── store.ts            # Zustand store
│   └── utils.ts            # Utility functions
├── types/
│   └── fazai.ts            # Type definitions
└── package.json
```

## Setup & Development

### Prerequisites
- Node.js 18.17.0+
- npm or yarn
- (Optional) Qdrant running on localhost:6333

### Installation

```bash
cd web
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Qdrant configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_api_key_optional

# FazAI CLI configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# WebSocket configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

### Running Locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
npm run start
```

### Type Checking

```bash
npm run type-check
```

## API Integration

### Agent API Endpoints

The web interface communicates with the CLI agent via:

- `GET /api/agent/status` - Agent status and metrics
- `GET /api/agent/actions` - Recent actions
- `POST /api/agent/pause` - Pause agent
- `POST /api/agent/resume` - Resume agent
- `POST /api/agent/stop` - Stop agent

### Collection Endpoints

#### Personality
- `GET /api/personality` - Get personality configuration
- `PUT /api/personality` - Update personality
- `POST /api/personality/traits` - Add trait
- `DELETE /api/personality/traits/[name]` - Remove trait

#### Memory
- `GET /api/memory/search?query=...` - Semantic search
- `GET /api/memory/by-role/[role]` - Filter by role

#### Learning
- `GET /api/learning` - Get learnings
- `GET /api/learning/stats` - Statistics
- `POST /api/learning` - Add learning

#### Knowledge Base
- `GET /api/knowledge` - List entries
- `POST /api/knowledge` - Create entry
- `PUT /api/knowledge/[slug]` - Update entry
- `DELETE /api/knowledge/[slug]` - Delete entry

#### Inference Rules
- `GET /api/rules` - List rules
- `POST /api/rules` - Create rule
- `PUT /api/rules/[ruleId]` - Update rule
- `DELETE /api/rules/[ruleId]` - Delete rule
- `POST /api/rules/[ruleId]/test` - Test rule

## Qdrant Collections

The interface manages 5 specialized Qdrant collections:

### 1. fazai_personality
Stores agent personality traits with intensities and categories.

### 2. fazai_memory
Stores conversation history with semantic embeddings for search.

### 3. fazai_learning
Stores learning records (errors, successes, patterns) with confidence scores.

### 4. fazai_kb
Stores knowledge base entries with validation and confidence scoring.

### 5. fazai_inference
Stores inference rules with conditions, actions, and priority levels.

## UI Components

### Custom Components
- `Button` - Variant support (default, destructive, outline, secondary, ghost, link)
- `Card` - CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `Badge` - Variant support (default, secondary, destructive, outline, success, warning, info)
- `Input` - Text input with full styling
- `Slider` - Range slider using Radix UI

### Theme System
Dark mode by default with automatic CSS variable theming.

## Development Guidelines

### Code Style
- **No `any` types** - Always use proper TypeScript
- **Strict mode enabled** - Helps catch potential bugs
- **React Server Components** where appropriate
- **Client Components** marked with `"use client"`

### Best Practices
1. Use React Query for all data fetching
2. Use Zustand for cross-component state
3. Keep components small and focused
4. Document complex logic with comments
5. Use CSS modules or TailwindCSS for styling

### Adding New Features

1. **New Page**:
   ```bash
   # Add page directory
   mkdir app/(dashboard)/new-feature
   # Create page.tsx
   ```

2. **New Component**:
   ```bash
   # Add to appropriate subdirectory
   components/new-feature/MyComponent.tsx
   ```

3. **New API Route**:
   ```bash
   # Create route handler
   app/api/new-feature/route.ts
   ```

## Integration with FazAI CLI

This web interface is designed to work alongside the FazAI CLI agent. To connect:

1. Ensure the CLI is running (or accessible via API)
2. Configure `NEXT_PUBLIC_API_URL` to point to the CLI's API
3. The interface will auto-poll for agent status

## License

This code is licensed under CC BY 4.0. See the root LICENSE-CC-BY-4.0.md for details.

## Contributing

The interface follows the same contribution guidelines as the main FazAI project.

## Future Enhancements

- [ ] WebSocket integration for real-time updates
- [ ] Full Qdrant semantic search implementation
- [ ] Export/import functionality for knowledge base
- [ ] Rule execution visualization
- [ ] Performance optimization and caching
- [ ] Mobile app version
- [ ] Advanced analytics and reporting

## Support

For issues and feature requests, please refer to the main FazAI repository.
