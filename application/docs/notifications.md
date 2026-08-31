# Notifications

## Overview

Notifications inform students about enrollment periods, academic deadlines,
schedule conflicts, walking-time conflicts, payments, and general updates.

## Current Features

- View notifications in newest-first order.
- Filter notifications by type.
- Dismiss one notification.
- Dismiss all notifications.
- Generate current enrollment and upcoming deadline reminders through a sync endpoint.
- Prevent duplicate automatically generated reminders.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications` | List the current user's notifications |
| `GET` | `/api/notifications?type=deadline` | Filter notifications by type |
| `POST` | `/api/notifications/sync` | Generate current time-based reminders |
| `DELETE` | `/api/notifications/:notificationId` | Dismiss one notification |
| `DELETE` | `/api/notifications` | Dismiss all notifications |

All endpoints require an authentication token. A user can only access or
dismiss their own notifications.

## Database Limitation

The existing database table does not have read or dismissed status fields.
Therefore, dismissing a notification permanently deletes it. Persistent
read/unread tracking is not supported without a future database change.
The frontend does not call the sync endpoint on every page load because doing
so could recreate a time-based reminder immediately after it was dismissed.

## Related Files

- `frontend/src/Notifications.jsx`
- `frontend/src/Notifications.css`
- `backend/controllers/notifications.js`
- `backend/routes/notificationRoutes.js`
- `backend/tester/notifications.test.js`
