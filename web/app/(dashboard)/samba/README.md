# Samba Dashboard Page

Dashboard page for managing Samba file shares in FazAI.

## Files Created

### Frontend
- **`page.tsx`** (389 lines) - Main Samba dashboard page component
  - React component with TypeScript
  - Uses shadcn/ui components (Card, Button, Input, Badge)
  - TanStack Query for data fetching
  - Zustand store integration
  - Mobile-responsive layout

### Types
- **`/types/samba.types.ts`** (69 lines) - TypeScript type definitions
  - `SambaShare` - Share configuration interface
  - `CreateSharePayload` - API payload for creating shares
  - `SambaStatus` - Service status and shares list
  - `SambaUser` - User management types
  - `SambaConnection` - Active connection tracking
  - `SambaAPIResponse<T>` - Generic API response wrapper

### API Routes
- **`/api/samba/status/route.ts`** - GET service status and shares list
- **`/api/samba/shares/route.ts`** - POST create new share
- **`/api/samba/shares/[name]/route.ts`** - DELETE remove share
- **`/api/samba/restart/route.ts`** - POST restart Samba service

## Features

### 1. Service Status Card
- Real-time service status (running/stopped)
- Samba version display
- Quick status badge with color coding

### 2. Share Management
- **List all shares** with details:
  - Share name and path
  - Description/comment
  - Valid users (with visual indicators)
  - Access flags (readonly, browseable, guest access)
- **Create new shares** via modal form:
  - Name validation (no spaces)
  - Absolute path input
  - Comment/description
  - User/group permissions (comma-separated)
  - Checkbox toggles for access flags
- **Delete shares** with confirmation:
  - Click once to activate delete mode
  - Click again within 3 seconds to confirm
  - Protected shares cannot be deleted

### 3. Service Actions
- **Refresh** button to reload data
- **Restart Service** button for applying changes

## UI Components Used

From shadcn/ui:
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Button` with variants (default, outline, destructive)
- `Input` for text fields
- `Badge` for status indicators

From lucide-react:
- `Plus` - Add new share
- `Trash2` - Delete share
- `RefreshCw` - Refresh data
- `Server` - Service management
- `FolderOpen` - Share icon
- `Users` - User permissions icon

## State Management

### TanStack Query
- `samba-status` query key
- 30-second auto-refresh interval
- Mutations for create, delete, restart operations

### Zustand Store
- `setLoading()` - Global loading state
- `setError()` - Global error display

## API Integration Status

All API routes are currently **MOCK** implementations with TODO comments for integration:

```typescript
// TODO: Integrate with actual fzsamba script
// const exec = require('child_process').execSync;
// exec('sudo /opt/fazai/bin/fzsamba status');
```

### Expected Backend Integration

The API routes expect a backend script at `/opt/fazai/bin/fzsamba` with commands:
- `fzsamba status` - Return JSON with service status
- `fzsamba list` - Return JSON array of shares
- `fzsamba add-share <params>` - Create new share
- `fzsamba remove-share <name>` - Delete share
- `fzsamba restart` - Restart Samba service

## Accessibility

- Semantic HTML structure
- ARIA labels via button titles
- Keyboard navigation support
- Focus management for modals
- Color contrast compliant

## Performance Considerations

- React Query caching to reduce API calls
- Optimistic UI updates on mutations
- Debounced auto-refresh (30s interval)
- Lazy evaluation of share list rendering
- Memoized status badge color logic

## Security

- Server-side validation in API routes
- Protected share names (homes, printers, IPC$, print$)
- Input sanitization for shell commands (TODO in backend)
- CSRF protection via Next.js API routes
- HTTP-only authentication (to be implemented)

## Mobile Responsiveness

- Grid layout: `grid-cols-1 sm:grid-cols-2`
- Flexible card containers
- Touch-friendly button sizes (p-2 minimum)
- Responsive typography
- Stack layout on mobile, side-by-side on desktop

## Testing Checklist

- [ ] Service status display works
- [ ] Share list renders correctly
- [ ] Create share form validation
- [ ] Delete confirmation flow
- [ ] Restart service button
- [ ] Refresh button updates data
- [ ] Error handling displays
- [ ] Loading states show
- [ ] Mobile layout responsive
- [ ] Keyboard navigation works

## Next Steps

1. Install missing shadcn/ui components:
   ```bash
   npx shadcn-ui@latest add table
   npx shadcn-ui@latest add dialog
   npx shadcn-ui@latest add alert-dialog
   ```

2. Implement backend `/opt/fazai/bin/fzsamba` script

3. Add real-time WebSocket updates for active connections

4. Implement user management page

5. Add share permissions editor

6. Add audit log for share changes

## Routes

- **Dashboard:** `/samba`
- **API Status:** `GET /api/samba/status`
- **API Create:** `POST /api/samba/shares`
- **API Delete:** `DELETE /api/samba/shares/:name`
- **API Restart:** `POST /api/samba/restart`

---

**Created:** 2025-12-27
**Version:** FazAI v3.6.22-beta
**Author:** Claude (Frontend Developer Specialist)
