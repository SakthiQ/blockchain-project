# ChainJudge — Database Layer

This directory contains all **MongoDB / Mongoose** schema definitions, the database connection helper, and seed scripts for the ChainJudge platform.

---

## Structure

```
database/
├── connection.js          ← Mongoose connection helper (shared by backend)
├── models/
│   ├── User.js            ← User accounts, roles, wallet links, bcrypt hashes
│   ├── ProjectApplication.js ← Team self-registration applications
│   └── Dispute.js         ← Scoring dispute / appeal records
├── seeds/
│   └── seedUsers.js       ← Demo user seed data for local development
└── README.md              ← This file
```

## Collections

| Collection | Schema File | Purpose |
|------------|-------------|---------|
| `users` | `models/User.js` | Platform accounts (email, role, wallet, bcrypt hash) |
| `projectapplications` | `models/ProjectApplication.js` | Team registration pipeline with approval status |
| `disputes` | `models/Dispute.js` | Scoring appeal records with resolution audit trail |

## Connection

Default local connection string:
```
mongodb://127.0.0.1:27017/chainjudge
```

Override via environment variable in `backend/.env`:
```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/chainjudge
```

## Seed Demo Data

```bash
node database/seeds/seedUsers.js
```
