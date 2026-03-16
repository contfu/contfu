# Contfu Client

The Contfu client app — a self-hosted SvelteKit application that syncs content from a Contfu service instance into a local SQLite database and serves it with on-the-fly media processing.

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -v contfu-data:/data \
  -e CONTFU_URL=ws://your-contfu-service:3000/contfu \
  -e CONTFU_API_KEY=your-api-key \
  contfu/client:latest
```

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `CONTFU_URL` | WebSocket URL of the Contfu service (e.g. `ws://host:3000/contfu`) |
| `CONTFU_API_KEY` | API key for authenticating with the Contfu service |

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `/data/db` | Path to the SQLite database file. Mount a volume at `/data` for persistence. |

### Asset Storage

By default, media assets are stored in the SQLite database. Set `ASSETS_URL` to store them on the filesystem or in S3-compatible object storage instead.

| Variable | Description |
|---|---|
| `ASSETS_URL` | Asset storage location — a local path (e.g. `/data/assets`) or an S3 URL (e.g. `s3://my-bucket/assets`) |

#### S3 Storage

When `ASSETS_URL` is an `s3://` URL, Bun's native S3 support is used. Configure credentials via environment variables:

| Variable | Fallback | Description |
|---|---|---|
| `S3_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `S3_ENDPOINT` | `AWS_ENDPOINT` | S3 endpoint URL (required for non-AWS services) |
| `S3_REGION` | `AWS_REGION` | S3 region (default: `us-east-1`) |
| `S3_BUCKET` | `AWS_BUCKET` | Default bucket name |
| `S3_SESSION_TOKEN` | `AWS_SESSION_TOKEN` | Temporary session token (optional) |

Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, and any S3-compatible service. See [Bun S3 docs](https://bun.sh/docs/runtime/s3#credentials) for details.

**Example with Cloudflare R2:**

```bash
docker run -d \
  -p 3000:3000 \
  -v contfu-data:/data \
  -e CONTFU_URL=ws://your-contfu-service:3000/contfu \
  -e CONTFU_API_KEY=your-api-key \
  -e ASSETS_URL=s3://my-bucket/assets \
  -e S3_ACCESS_KEY_ID=your-access-key \
  -e S3_SECRET_ACCESS_KEY=your-secret-key \
  -e S3_ENDPOINT=https://account-id.r2.cloudflarestorage.com \
  contfu/client:latest
```

## Volumes

| Path | Description |
|---|---|
| `/data` | Default location for the SQLite database and local asset storage |

## Ports

| Port | Description |
|---|---|
| `3000` | HTTP server |
