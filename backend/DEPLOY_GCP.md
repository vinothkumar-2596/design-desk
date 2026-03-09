# Deploy backend to Google Cloud Run

This backend is prepared for container deployment on Google Cloud Run.

## 1) Prerequisites

- Google Cloud project with billing enabled.
- `gcloud` CLI installed and authenticated.
- Docker installed locally (only needed for local image test).

## 2) Enable required services

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 3) Create Artifact Registry repo (one-time)

```bash
gcloud artifacts repositories create design-desk \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Design Desk backend images"
```

## 4) Configure secrets/environment

Minimum required values:

- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

Recommended: store sensitive values in Secret Manager.

```bash
echo -n "<your-mongodb-uri>" | gcloud secrets create MONGODB_URI --data-file=-
echo -n "<your-jwt-secret>" | gcloud secrets create JWT_SECRET --data-file=-
```

If a secret already exists, add a new version instead:

```bash
echo -n "<new-value>" | gcloud secrets versions add MONGODB_URI --data-file=-
```

## 5) Build + deploy (from `backend/`)

```bash
cd backend
gcloud builds submit --config cloudbuild.yaml
```

This will:
- Build container image using `Dockerfile`
- Push to Artifact Registry
- Deploy Cloud Run service `design-desk-backend`

## 6) Set runtime env vars/secrets on Cloud Run

```bash
gcloud run services update design-desk-backend \
  --region asia-south1 \
  --set-env-vars NODE_ENV=production,FRONTEND_URL=https://your-frontend-domain \
  --set-secrets MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest
```

## 7) Verify deployment

```bash
gcloud run services describe design-desk-backend --region asia-south1 --format='value(status.url)'
curl https://YOUR_CLOUD_RUN_URL/healthz
```

Expected health response:

```json
{"status":"ok","service":"antigravity-api","timestamp":"..."}
```

## Optional local Docker test

```bash
cd backend
docker build -t design-desk-backend .
docker run --rm -p 8080:8080 --env-file .env design-desk-backend
```
