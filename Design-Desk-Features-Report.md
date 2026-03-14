# Design Desk — Features Report
**Generated:** 2026-03-13
**Project:** Design Desk (Design Request Management System)

---

## Table of Contents
1. [Backend Features](#backend-features)
2. [Frontend Features](#frontend-features)
3. [External Integrations](#external-integrations)
4. [Tech Stack](#tech-stack)

---

## Backend Features

### Authentication & Authorization
- Email/Password login & signup (staff domain restricted)
- Google OAuth authentication with role-based access
- JWT access tokens with refresh token rotation
- OTP-based password reset via SMS (2Factor API)
- Password change functionality
- Session management with secure refresh token storage
- Refresh token reuse detection
- Admin user creation and management
- User roles: `staff`, `designer`, `treasurer`, `admin`, `other`

### Task Management
- Full CRUD operations for tasks
- Status workflow: `pending → assigned → accepted → in_progress → under_review → completed`
- Categories: poster, social_media, banner, brochure, others, campaign_or_others, social_media_creative, website_assets, ui_ux, led_backdrop, flyer
- Urgency levels: low, normal, intermediate, urgent
- Emergency task approval workflow
- Task assignment to designers by ID or email
- Deadline management with proposed deadline approval
- Deadline change requests & approval
- Task change history tracking (field-level)
- Comments with threading & @mentions
- Comment seen tracking by role
- Modification flag for task changes
- Requester info: name, email, phone, department, secondary phone

### File Management
- File upload to Google Drive with configurable size limits
- Resumable upload support for large files (multi-chunk)
- File organization in nested Drive folders by task ID and section
- Text extraction from PDF, DOC, DOCX files
- AI-powered file content processing (Ollama/Gemini)
- File downloads with proper MIME types
- File metadata retrieval from Drive
- Public/private file sharing control
- Working file storage and management
- AI Mode file upload with automatic content extraction

### AI & Content Generation
- Gemini API integration with multi-key support and key rotation
- Gemini API cooldown management (rate limit, quota, auth failures)
- Ollama fallback for AI generation when Gemini unavailable
- AI Buddy system prompt-based content processing
- Attachment-only mode for strict content preservation
- AI-powered task draft generation
- JSON response contract enforcement for AI outputs
- Error classification and retry mechanisms

### Drive Authentication
- Google Drive OAuth connection
- Drive token management (refresh token, access token)
- Connection status checking
- Drive folder permission handling
- Service account and OAuth2 authentication support

### Notifications & Communications
- Email notifications with templates
- SMS notifications via Twilio
- WhatsApp messaging via Twilio
- In-app push notifications (Socket.io)
- Notification preferences management per user
- Task completion notifications
- Status update notifications
- Comment notifications with @mentions
- Deadline reminders
- Emergency approval notifications
- Designer availability notifications
- Final deliverable submission notifications

### Activity & Audit Logging
- Activity feed tracking
- Audit log creation for all write operations
- IP address and user agent logging
- Action classification (LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, etc.)
- Target ID tracking for resource actions
- Client metadata capture
- Refresh token reuse detection

### Designer Management
- Designer availability tracking
- Designer portal access control
- Main designer role differentiation
- Designer assignment validation
- Excluded designer filtering (demo/debug accounts)
- Designer scope management (main vs. standard)

### Design Deliverables & Review
- Final deliverable version management
- Design version tracking
- Deliverable file uploads
- Review status workflow: pending, approved, rejected
- Image annotation for reviews (drawing, shapes, comments)
- Review note documentation
- Version history per deliverable

---

## Frontend Features

### Pages & Routes

| Page | Purpose |
|------|---------|
| Index | Entry point with auto-redirect if authenticated |
| Login | Email/password, Google OAuth, OTP password recovery |
| Dashboard | Task stats, activity feed, quick task creation |
| New Request | Create design requests with AI Mode support |
| Tasks | Browse and filter all tasks |
| Task Detail | Full task view: comments, files, changes, approvals |
| My Requests | User's submitted requests |
| Drafts | Save and manage task drafts |
| Approvals | Approve/reject emergencies and deadlines |
| Activity | System activity feed |
| Settings | User preferences, notifications, password |
| Help | User documentation |
| AI Mode | Advanced AI-powered task creation and processing |
| WhatsApp Templates | WhatsApp message templates management |
| Email Task | Email-based task access with permission checking |
| Privacy Policy | Legal documentation |
| Terms of Service | Legal documentation |
| Reset Password | Password reset form with token validation |
| Design System Capture | Design system documentation tool |
| Responsive Showcase | Responsive design showcase tool |
| Not Found | 404 error page |

### Dashboard Features
- Task statistics and analytics (total, pending, completed)
- Task filtering by date range and status
- Activity feed display
- Quick task creation dialog
- Designer assignment interface
- Global search functionality
- Date range filtering (last 7 days, 30 days, custom)

### Task Management UI
- Task creation with title, description, category, urgency, deadline
- Task status visualization with badges
- Task comments with threading
- File uploads (input, output, working files)
- Design version management
- Change history tracking with field-level details
- Assignment to designers by email/ID
- Task approval workflow UI
- Emergency approval interface
- Deadline negotiation interface
- Task modification tracking

### Task Detail Features
- Full task information display
- Comment section with nested threads
- Attachment previews (images, documents)
- Design version viewer
- Final deliverable upload and review interface
- Image annotation canvas for reviews
- Change history timeline
- Task status workflow management
- Deadline change requests
- Emergency request approval
- Task note attachments

### AI Mode Features
- File upload with AI processing
- Attachment-based content analysis
- Automatic task draft generation
- JSON response parsing and display
- AI error handling with fallback display
- Content extraction from uploaded files
- Intelligent field population from AI output

### File Management UI
- File upload interface with progress tracking
- Google Drive integration
- File preview capabilities
- Resumable upload for large files
- File type filtering
- Thumbnail display
- Download functionality
- File metadata display

### Designer Features
- Designer availability calendar
- Schedule management
- Task assignment UI
- Designer portal access
- Availability status tracking

### Search & Filtering
- Global search across tasks
- Filter by category, status, urgency, assignee, date range, requester
- Text-based search in task titles and descriptions

### User Interface Components
- Dark/Light theme toggle
- Responsive layout (mobile, tablet, desktop)
- Sidebar navigation
- TopNav with notifications bell
- Dialog/Modal components
- Toast notifications (Sonner)
- Loading animations (Lottie)
- Chart components (Recharts)
- Table components
- Calendar pickers (MUI Date Pickers)
- Form components with validation (React Hook Form)
- Dropdown menus, Tooltips, Progress indicators
- Badges, Tabs, Accordions

### Authentication UI
- Login form with email/password
- Google sign-in button
- OTP verification for password reset
- Password reset form
- Signup form (staff-domain restricted)
- Session persistence with token refresh
- Auth error messages

### Notifications UI
- Notification bell with unread count
- Notification dropdown/panel
- Mark as read functionality
- Clear notifications
- Real-time notification updates via Socket.io

### Settings & Preferences
- Profile management
- Password change
- Notification preferences (email, WhatsApp, reminders)
- Theme preferences
- Account security settings

### Real-time Features
- WebSocket (Socket.io) integration
- Real-time task updates
- Live comment notifications
- Real-time activity feed

---

## External Integrations

| Service | Purpose |
|---------|---------|
| Google Drive API | File upload, storage, metadata, shared folders |
| Google OAuth | Staff email authentication, profile sync |
| Gemini AI API | Content generation, task drafts, document analysis |
| Ollama (Local LLM) | Fallback AI provider, local content processing |
| Twilio | SMS notifications & WhatsApp messaging |
| 2Factor.in | OTP generation, verification, SMS delivery |
| MongoDB | Data persistence and document storage |
| Socket.io | Real-time notifications and live updates |

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| Authentication | JWT, Google OAuth, Passport.js |
| File Storage | Google Drive API |
| AI | Gemini API, Ollama |
| Messaging | Twilio (SMS/WhatsApp), 2Factor.in (OTP) |
| Real-time | Socket.io |
| Extras | Rate limiting, CORS, Email templating, File extraction (PDF/DOCX) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS + Radix UI |
| Forms | React Hook Form + Zod |
| Data Fetching | React Query + Custom Auth Client |
| Charts | Recharts |
| Date Utilities | date-fns |
| UI Extras | Sonner (toasts), Lottie (animations), MUI Date Pickers |
| Real-time | Socket.io Client |

---

*Report generated from codebase analysis of Design Desk project.*
