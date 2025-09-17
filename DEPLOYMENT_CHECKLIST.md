# Render Deployment Checklist

## Pre-Deployment
- [ ] Remove all Django files and dependencies
- [ ] Verify Express.js server runs locally
- [ ] Test all API endpoints
- [ ] Ensure MongoDB connection works
- [ ] Update package.json scripts
- [ ] Create .env.example file

## Render Configuration
- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Configure environment variables:
  - [ ] NODE_ENV=production
  - [ ] MONGODB_URI
  - [ ] JWT_SECRET
  - [ ] JWT_REFRESH_SECRET
  - [ ] CORS_ORIGIN
- [ ] Set up MongoDB database (Atlas or Render)
- [ ] Configure build and start commands

## Post-Deployment
- [ ] Test health endpoint: `/health`
- [ ] Test authentication endpoints
- [ ] Verify CORS configuration
- [ ] Check application logs
- [ ] Test frontend integration
- [ ] Monitor performance

## Files Modified/Created
- [x] `server.js` - Updated for production
- [x] `package.json` - Added engines and scripts
- [x] `render.yaml` - Service configuration
- [x] `.env.example` - Environment variables template
- [x] `RENDER_DEPLOYMENT_GUIDE.md` - Deployment documentation
- [x] Removed Django files: `main/`, `app/`, `manage.py`, `requirements.txt`

## Environment Variables Required
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb://...
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=https://your-frontend.onrender.com
```

## Deployment URL Pattern
- Service: `https://vendor-backend.onrender.com`
- Health: `https://vendor-backend.onrender.com/health`
- API: `https://vendor-backend.onrender.com/api/*`