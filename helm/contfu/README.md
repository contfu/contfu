# Contfu Helm Chart

Helm chart for deploying [Contfu](../../README.md) (proxy CMS) on a K3S/Kubernetes cluster.

Manages three components:

- **Contfu app** -- Deployment, Service, optional Ingress
- **NATS** -- via official NATS Helm subchart (JetStream enabled)
- **PostgreSQL** -- via CloudNativePG `Cluster` custom resource

## Prerequisites

- Kubernetes 1.28+ (tested on K3S)
- Helm 3.12+
- [CloudNativePG operator](https://cloudnative-pg.io/) installed in the cluster:

```bash
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/main/releases/cnpg-1.25.1.yaml
```

Verify the operator is running before proceeding:

```bash
kubectl get pods -n cnpg-system
```

## Quick Start

```bash
# From the repository root
cd helm/contfu

# Download the NATS subchart dependency
helm dependency update

# Install
helm install contfu . \
  --set image.repository=ghcr.io/OWNER/contfu-app \
  --set image.tag=0.1.0 \
  --set app.origin=https://contfu.example.com \
  --set secrets.betterAuthSecret=$(openssl rand -base64 32)
```

## Configuration

All values are documented in [`values.yaml`](./values.yaml). Key sections:

### Image

| Parameter          | Description                                | Default                     |
| ------------------ | ------------------------------------------ | --------------------------- |
| `image.repository` | Container image repository                 | `ghcr.io/contfu/contfu-app` |
| `image.tag`        | Image tag (defaults to chart `appVersion`) | `""`                        |
| `image.pullPolicy` | Pull policy                                | `IfNotPresent`              |

### Application

| Parameter            | Description                                    | Default                                       |
| -------------------- | ---------------------------------------------- | --------------------------------------------- |
| `app.origin`         | Public URL of the app (`ORIGIN`)               | `http://localhost:3000`                       |
| `app.betterAuthUrl`  | BetterAuth callback URL (defaults to `origin`) | `""`                                          |
| `app.migrationsPath` | Path to DB migrations inside the container     | `/app/packages/service/backend/db/migrations` |
| `app.syncWorkerPath` | Path to sync worker inside the container       | `/app/packages/service/sync/src/worker.ts`    |
| `app.smtpHost`       | SMTP server hostname (`SMTP_HOST`)             | `""`                                          |
| `app.smtpPort`       | SMTP server port (`SMTP_PORT`)                 | `"465"`                                       |

### Secrets

| Parameter                    | Description                                           | Default |
| ---------------------------- | ----------------------------------------------------- | ------- |
| `secrets.existingSecret`     | Use a pre-created Secret instead of chart-managed one | `""`    |
| `secrets.betterAuthSecret`   | BetterAuth signing secret                             | `""`    |
| `secrets.googleClientId`     | Google OAuth client ID                                | `""`    |
| `secrets.googleClientSecret` | Google OAuth client secret                            | `""`    |
| `secrets.githubClientId`     | GitHub OAuth client ID                                | `""`    |
| `secrets.githubClientSecret` | GitHub OAuth client secret                            | `""`    |
| `secrets.polarAccessToken`   | Polar billing API token                               | `""`    |
| `secrets.polarWebhookSecret` | Polar webhook secret                                  | `""`    |
| `secrets.basicAuth`          | HTTP basic auth credentials (`user:password`)         | `""`    |
| `secrets.smtpUser`           | SMTP username (`SMTP_USER`)                           | `""`    |
| `secrets.smtpPass`           | SMTP password (`SMTP_PASS`)                           | `""`    |

### Ingress

| Parameter           | Description             | Default                                                        |
| ------------------- | ----------------------- | -------------------------------------------------------------- |
| `ingress.enabled`   | Enable Ingress resource | `false`                                                        |
| `ingress.className` | Ingress class           | `traefik`                                                      |
| `ingress.hosts`     | Host rules              | `[{host: contfu.local, paths: [{path: /, pathType: Prefix}]}]` |
| `ingress.tls`       | TLS configuration       | `[]`                                                           |

### PostgreSQL (CloudNativePG)

| Parameter                         | Description                             | Default                                  |
| --------------------------------- | --------------------------------------- | ---------------------------------------- |
| `postgresql.enabled`              | Deploy a CNPG Cluster                   | `true`                                   |
| `postgresql.instances`            | Number of PostgreSQL instances          | `1`                                      |
| `postgresql.imageName`            | PostgreSQL image                        | `ghcr.io/cloudnative-pg/postgresql:17.4` |
| `postgresql.database`             | Database name                           | `contfu`                                 |
| `postgresql.owner`                | Database owner                          | `contfu`                                 |
| `postgresql.storage.size`         | PVC size                                | `5Gi`                                    |
| `postgresql.storage.storageClass` | Storage class (empty = cluster default) | `""`                                     |

### NATS

| Parameter                                  | Description          | Default |
| ------------------------------------------ | -------------------- | ------- |
| `nats.enabled`                             | Deploy NATS subchart | `true`  |
| `nats.config.jetstream.enabled`            | Enable JetStream     | `true`  |
| `nats.config.jetstream.fileStore.pvc.size` | JetStream PVC size   | `2Gi`   |

### Resources

| Parameter                   | Description    | Default |
| --------------------------- | -------------- | ------- |
| `resources.requests.cpu`    | CPU request    | `100m`  |
| `resources.requests.memory` | Memory request | `256Mi` |
| `resources.limits.memory`   | Memory limit   | `512Mi` |

## Examples

### Minimal install (port-forward access)

```bash
helm install contfu . \
  --set image.repository=ghcr.io/OWNER/contfu-app \
  --set secrets.betterAuthSecret=change-me
```

Then access via port-forward:

```bash
kubectl port-forward svc/contfu 3000:3000
```

### Production install with Ingress and TLS

Create a `values-prod.yaml`:

```yaml
image:
  repository: ghcr.io/OWNER/contfu-app
  tag: "1.0.0"

app:
  origin: https://contfu.example.com

secrets:
  existingSecret: contfu-secrets # managed by External Secrets Operator

ingress:
  enabled: true
  className: traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: contfu.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: contfu-tls
      hosts:
        - contfu.example.com

postgresql:
  instances: 2
  storage:
    size: 20Gi

resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    memory: 1Gi
```

```bash
helm install contfu . -f values-prod.yaml
```

### External secret management

If you manage secrets with Vault, Sealed Secrets, or External Secrets Operator, create the Secret yourself and reference it:

```bash
helm install contfu . \
  --set secrets.existingSecret=my-contfu-secret
```

Your secret must contain at minimum the `BETTER_AUTH_SECRET` key.

## What Gets Created

| Resource         | Name             | Notes                                                                         |
| ---------------- | ---------------- | ----------------------------------------------------------------------------- |
| ServiceAccount   | `<release>`      |                                                                               |
| ConfigMap        | `<release>`      | Non-secret env vars                                                           |
| Secret           | `<release>`      | Skipped if `existingSecret` is set                                            |
| Deployment       | `<release>`      | App container + init container                                                |
| Service          | `<release>`      | ClusterIP on port 3000                                                        |
| Ingress          | `<release>`      | Only if `ingress.enabled`                                                     |
| CNPG Cluster     | `<release>-pg`   | Creates `-rw`, `-ro`, `-r` services and `<release>-pg-app` credentials secret |
| NATS StatefulSet | `<release>-nats` | Via subchart                                                                  |
| HPA              | `<release>`      | Only if `autoscaling.enabled`                                                 |

## Deployment Flow

1. Helm creates all resources (ServiceAccount, ConfigMap, Secret, CNPG Cluster CR, NATS, Deployment, Service)
2. The CNPG operator reconciles the Cluster CR into PostgreSQL pods and a credentials secret (`<release>-pg-app`)
3. The init container waits for the `-rw` service to become available (TCP check)
4. The app container starts, runs database migrations, and serves on port 3000

## Operations

### Upgrading

```bash
helm upgrade contfu . -f values-prod.yaml
```

Config or secret changes automatically trigger a rolling restart via checksum annotations.

### Checking status

```bash
# App pods
kubectl get pods -l app.kubernetes.io/name=contfu

# PostgreSQL cluster
kubectl get clusters.postgresql.cnpg.io

# NATS
kubectl get pods -l app.kubernetes.io/name=nats
```

### Running Helm tests

```bash
helm test contfu
```

### Validating before install

```bash
# Lint
helm lint .

# Dry-run template render
helm template contfu . \
  --set image.repository=ghcr.io/OWNER/contfu-app \
  --set secrets.betterAuthSecret=test
```

### Uninstalling

```bash
helm uninstall contfu
```

Note: The chart-managed Secret has `helm.sh/resource-policy: keep` and will not be deleted on uninstall. Delete it manually if needed:

```bash
kubectl delete secret contfu
```

CNPG PVCs are also retained by default. Clean them up manually after verifying backups.
