# 🎲 Ludo Online — Netlify + Railway Deployment Guide

## 📁 Project Structure

```
ludo_netlify/
├── backend/          ← Deploy on Railway
│   ├── app.py
│   ├── config.py
│   ├── models.py
│   ├── ludo.py
│   ├── requirements.txt
│   ├── Procfile
│   └── nixpacks.toml
│
└── frontend/         ← Deploy on Netlify
    ├── index.html
    ├── netlify.toml
    ├── _redirects
    ├── css/
    │   ├── style.css
    │   └── board.css
    └── js/
        ├── board.js
        └── game.js
```

---

## 🚀 STEP 1 — Deploy Backend on Railway

### 1.1 Create Railway account
Go to → https://railway.app → Sign up with GitHub

### 1.2 Create New Project
- Click **"New Project"**
- Select **"Deploy from GitHub repo"**
- Upload/push the `backend/` folder as a GitHub repo
  OR use Railway CLI:
  ```bash
  npm install -g @railway/cli
  railway login
  cd backend
  railway init
  railway up
  ```

### 1.3 Add MySQL Database
- In Railway project → Click **"+ New"** → **"Database"** → **"MySQL"**
- Railway auto-creates a MySQL instance and sets env vars:
  - `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

### 1.4 Set Environment Variables
In Railway → your backend service → **Variables** tab, add:
```
SECRET_KEY = any-long-random-string-here
CORS_ORIGINS = https://your-netlify-site.netlify.app
```

### 1.5 Get Your Backend URL
After deploy, Railway gives you a URL like:
```
https://ludo-backend-production.up.railway.app
```
**Copy this URL — you need it for Step 2!**

---

## 🌐 STEP 2 — Deploy Frontend on Netlify

### 2.1 Update Backend URL in game.js
Open `frontend/js/game.js` and change line 7:
```javascript
// BEFORE:
const BACKEND_URL = window.BACKEND_URL || 'https://your-app.railway.app';

// AFTER (paste your Railway URL):
const BACKEND_URL = window.BACKEND_URL || 'https://ludo-backend-production.up.railway.app';
```

### 2.2 Deploy to Netlify
**Option A — Drag & Drop (Easiest):**
1. Go to → https://netlify.com → Sign up/Login
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag the entire `frontend/` folder into Netlify
4. Done! Netlify gives you a URL like `https://amazing-ludo-123.netlify.app`

**Option B — GitHub (Auto-deploy):**
1. Push `frontend/` folder to a GitHub repo
2. Netlify → "New site from Git" → connect repo
3. Build settings: leave blank (no build command needed)
4. Publish directory: `.` (root of frontend folder)

### 2.3 Your site is LIVE! 🎉
Open your Netlify URL → Register → Create Room → Share code → Play!

---

## ✅ Summary

| Part | Platform | URL |
|------|----------|-----|
| Frontend | Netlify | `https://your-site.netlify.app` |
| Backend API + WebSocket | Railway | `https://your-app.railway.app` |
| MySQL Database | Railway (built-in) | Auto-configured |

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| "CORS error" in browser console | In Railway Variables, set `CORS_ORIGINS` to your Netlify URL |
| Login doesn't work | Make sure `BACKEND_URL` in game.js matches Railway URL exactly |
| WebSocket not connecting | Railway supports WebSockets — check the URL has no trailing slash |
| Database error on Railway | MySQL env vars are auto-set when you add MySQL service — check Variables tab |
| Netlify shows 404 on refresh | The `netlify.toml` and `_redirects` file handle this — make sure they're in the folder |

---

## 💰 Cost

- **Netlify Free tier**: ✅ Free (100GB bandwidth/month)
- **Railway Free tier**: ✅ $5 free credit/month (enough for small projects)
- **Railway MySQL**: ✅ Included in free tier
