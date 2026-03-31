---
name: contfu-cluster
description: Manage and monitor the Contfu production cluster on K3S (context ce, namespace contfu). Use when checking pod health, reading logs, inspecting database or NATS state, watching Flux reconciliation, or performing cluster operations like restarting pods or resetting the database.
model: haiku
---

# Contfu Production Cluster

Manage the Contfu deployment on the `ce` K3S cluster in namespace `contfu`.

## Kubectl defaults

Always use:

```
kubectl --context ce -n contfu
```

## Read-only operations

These can be run without asking for permission.

### Pod overview

```bash
kubectl --context ce -n contfu get pods -o wide
```

### App logs

```bash
kubectl --context ce -n contfu logs deploy/contfu --tail=50
```

Add `--previous` to see logs from the last crashed container.

### Database (CNPG) logs

The PostgreSQL pod is managed by CloudNativePG. The pod name follows the pattern `contfu-pg-*`.

```bash
kubectl --context ce -n contfu logs -l cnpg.io/cluster=contfu-pg --tail=50
```

Filter for errors:

```bash
kubectl --context ce -n contfu logs -l cnpg.io/cluster=contfu-pg --tail=200 | grep -i "error_severity\":\"ERROR\|FATAL"
```

### CNPG cluster status

```bash
kubectl --context ce -n contfu get cluster contfu-pg -o jsonpath='{.status.phase}{"\n"}'
```

### NATS status

```bash
kubectl --context ce -n contfu logs contfu-nats-0 -c nats --tail=20
```

### All resources

```bash
kubectl --context ce -n contfu get all
```

### Events (recent)

```bash
kubectl --context ce -n contfu get events --sort-by='.lastTimestamp' | tail -20
```

### Flux HelmRelease status

```bash
kubectl --context ce -n contfu get helmrelease contfu -o jsonpath='{.status.conditions[0].message}{"\n"}'
```

Full reconciliation status:

```bash
kubectl --context ce -n contfu get helmrelease contfu -o yaml | grep -A5 'conditions:'
```

### Check deployed chart version

```bash
kubectl --context ce -n contfu get helmrelease contfu -o jsonpath='{.status.lastAppliedRevision}{"\n"}'
```

## Mutations

**Always ask the user for permission before running any of these commands.**

### Restart app deployment

```bash
kubectl --context ce -n contfu rollout restart deploy/contfu
```

### Watch rollout

```bash
kubectl --context ce -n contfu rollout status deploy/contfu --timeout=120s
```

### Reset CNPG database

This deletes all data. Only do this when the user explicitly confirms.

```bash
kubectl --context ce -n contfu delete cluster contfu-pg
```

CNPG will recreate the cluster from the HelmRelease spec, running `postInitSQL` on bootstrap. Wait for the pod to be ready:

```bash
kubectl --context ce -n contfu wait --for=condition=ready pod -l cnpg.io/cluster=contfu-pg --timeout=120s
```

### Force Flux reconciliation

```bash
flux reconcile helmrelease contfu -n contfu --context ce
```

### Scale deployment

```bash
kubectl --context ce -n contfu scale deploy/contfu --replicas=0
kubectl --context ce -n contfu scale deploy/contfu --replicas=1
```
