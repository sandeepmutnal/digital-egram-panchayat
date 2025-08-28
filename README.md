# Digital E-Gram Panchayat

## Quick setup
1. Create Firebase project (console.firebase.google.com).
2. Enable Authentication → Email/Password.
3. Create Firestore database.
4. Replace config in `js/firebase-config.js`.
5. Serve files with a static server (Live Server or `npx http-server`).

## Firestore structure
- users (doc id = uid): { name, email, role }
- services (auto id): { title, description, createdBy, createdAt }
- applications (auto id): { userId, userName, serviceId, details, status, createdAt }
- logs (optional)

## Notes
- Client-side role checks are for demo only. Add Firestore security rules / Cloud Functions for production.
- To style further, edit `css/style.css`.
