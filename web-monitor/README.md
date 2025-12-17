# FazAI - Multi-Task Monitor

This project is a web-based monitoring interface for FazAI's Jules sessions. It provides a real-time view of the progress of multiple tasks, including status updates, logs, and file modifications.

## Features

### Dashboard (Jules Tasks Monitor)
- **Real-time Dashboard:** Monitor multiple Jules tasks at a glance.
- **Live Logs:** A terminal-like view of the logs from all tasks.
- **Progress Visualization:** A timeline and progress bars to track the status of each task.
- **File Tracking:** See which files are being modified by the tasks.
- **Desktop Notifications:** Get notified when a task is complete or encounters an error.

### Management Pages (Coming Soon)
- **Cloudflare Management:** DNS, WAF, and Cache configuration
- **SpamExperts Management:** Anti-spam protection settings
- **OPNsense Management:** Firewall and security rules

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router v6
- **Backend:** Node.js, Express, TypeScript, Server-Sent Events (SSE)
- **Containerization:** Docker, Docker Compose

## Getting Started

### Prerequisites

- Node.js v18+ and npm
- (Optional) Docker and Docker Compose

### Configuration

The web monitor uses settings from `/etc/fazai/fazai.conf`:

```ini
# Web Monitor Configuration
WEB_MONITOR_HOSTNAME=walker.storageweb
WEB_MONITOR_BACKEND_PORT=3001
WEB_MONITOR_FRONTEND_PORT=8080
```

Edit these values to match your system hostname and desired ports.

### Running the Application

#### Option 1: Local Development (Recommended)

1.  **Navigate to the `web-monitor` directory:**

    ```bash
    cd web-monitor
    ```

2.  **Install dependencies:**

    ```bash
    cd backend && npm install
    cd ../frontend && npm install
    ```

3.  **Start the backend:**

    ```bash
    cd backend
    npm start
    # Backend will run at http://walker.storageweb:3001
    ```

4.  **Start the frontend (in another terminal):**

    ```bash
    cd frontend
    npm run dev -- --host 0.0.0.0 --port 8080
    # Frontend will run at http://localhost:8080
    ```

5.  **Open your browser:**
    - Local: `http://localhost:8080`
    - Network: `http://walker.storageweb:8080`

#### Option 2: Docker Compose

1.  **Build and run:**

    ```bash
    docker-compose up --build
    ```

2.  **Open your browser and navigate to `http://localhost:8080`**.

You should now see the FazAI Multi-Task Monitor dashboard with real-time updates from the simulated Jules tasks.

## Architecture

The application is composed of two main services:

-   **`frontend`:** A React application built with Vite that serves as the user interface. It connects to the backend to receive real-time updates.
-   **`backend`:** An Express.js server that provides a REST API and a Server-Sent Events (SSE) endpoint. It simulates the Jules tasks and streams the data to the frontend.

### Frontend Structure

```
src/
├── App.tsx                 # Main router configuration
├── main.tsx                # Entry point with BrowserRouter
├── components/
│   ├── Layout.tsx          # Main layout with sidebar navigation
│   ├── TaskCard.tsx        # Task status card
│   ├── LogViewer.tsx       # Real-time log viewer
│   ├── Timeline.tsx        # Task timeline
│   ├── FilesModified.tsx   # Modified files list
│   └── CodePreview.tsx     # Code preview component
├── pages/
│   ├── DashboardPage.tsx   # Jules tasks monitor (main page)
│   ├── CloudflarePage.tsx  # Cloudflare management (placeholder)
│   ├── SpamExpertsPage.tsx # SpamExperts management (placeholder)
│   └── OPNsensePage.tsx    # OPNsense management (placeholder)
├── hooks/
│   ├── useTaskStream.ts    # SSE connection hook
│   └── useNotifications.ts # Browser notifications hook
├── store.ts                # Zustand state management
└── types.ts                # TypeScript type definitions
```

### Navigation

The application uses React Router v6 with the following routes:

- `/` - Dashboard (Jules Tasks Monitor)
- `/cloudflare` - Cloudflare Management
- `/spamexperts` - SpamExperts Management
- `/opnsense` - OPNsense Management

The sidebar navigation is responsive and collapses to a hamburger menu on mobile devices.

### Communication

The frontend communicates with the backend in two ways:

1.  **Initial Data Fetch:** When the application loads, it makes a request to the `/api/tasks` endpoint to get the initial state of all tasks.
2.  **Real-time Updates:** The frontend establishes a persistent connection to the `/api/tasks/:id/stream` SSE endpoint for each task. The backend uses this connection to push real-time updates to the frontend whenever the state of a task changes.

### Jules Monitor Simulation

The `backend/src/services/jules-monitor.ts` file contains a simulation of the Jules monitoring process. It periodically updates the status, progress, logs, and modified files for each task to mimic the behavior of a real monitoring system.

**Note:** In a real-world scenario, this simulation would be replaced with actual logic to monitor the Jules sessions via an API or other means. The frontend's API endpoint URLs would also be configured using environment variables rather than being hardcoded.
