# Railway Database Setup Guide

## Current Issue
Your app is falling back to JSON file storage instead of using PostgreSQL, which means data gets erased on each deployment.

## Required Steps

### 1. Add PostgreSQL Service to Railway
1. Go to your Railway project dashboard
2. Click "New Service" → "Database" → "Add PostgreSQL"
3. Railway will create a PostgreSQL service and automatically generate connection details

### 2. Set Environment Variables
Make sure these environment variables are set in your Railway project:

**Required:**
- `DATABASE_URL` - Should be automatically set when you add PostgreSQL service
- `NODE_ENV=production` 
- `OPENAI_API_KEY` - Your OpenAI API key
- `USE_OPENAI=true`

**Optional:**
- `FRONTEND_URL` - Your frontend URL (if different from default)

### 3. Check Environment Variables
1. Go to Railway project → Your service → Variables tab
2. Verify `DATABASE_URL` exists and looks like: `postgresql://username:password@host:port/database`
3. If missing, connect the PostgreSQL service to your app service

### 4. Deploy and Check Logs
After setting up, redeploy and check the logs for:
```
🔍 Environment check:
- NODE_ENV: production
- DATABASE_URL exists: true
✅ PostgreSQL connected successfully
🏁 Database initialization complete. Using: PostgreSQL
```

### 5. Troubleshooting

**If you see "No DATABASE_URL found":**
- Add PostgreSQL service to your Railway project
- Make sure it's connected to your app service

**If you see "PostgreSQL connection failed":**
- Check that PostgreSQL service is running
- Verify the DATABASE_URL format
- Check Railway PostgreSQL service logs

**If data still gets erased:**
- Confirm logs show "Using: PostgreSQL" not "JSON file"
- Check that your PostgreSQL service has persistent storage (it should by default)

## Testing Connection
Once deployed, your logs should show detailed connection info including:
- Database connection time
- PostgreSQL version
- Table creation status
- Migration status

The enhanced logging will help us identify exactly what's happening during deployment.
