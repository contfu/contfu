{{/*
Expand the name of the chart.
*/}}
{{- define "contfu.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "contfu.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "contfu.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "contfu.labels" -}}
helm.sh/chart: {{ include "contfu.chart" . }}
{{ include "contfu.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "contfu.selectorLabels" -}}
app.kubernetes.io/name: {{ include "contfu.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "contfu.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "contfu.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL (CNPG) cluster name
*/}}
{{- define "contfu.postgresql.fullname" -}}
{{- printf "%s-pg" (include "contfu.fullname" .) }}
{{- end }}

{{/*
NATS service name
*/}}
{{- define "contfu.nats.fullname" -}}
{{- printf "%s-nats" .Release.Name }}
{{- end }}

{{/*
DATABASE_URL using Kubernetes env var expansion for the password.
The password comes from the CNPG-generated secret (<cluster>-app).
*/}}
{{- define "contfu.databaseUrl" -}}
{{- $pgName := include "contfu.postgresql.fullname" . -}}
{{- $db := .Values.postgresql.database -}}
{{- $owner := .Values.postgresql.owner -}}
{{- printf "postgres://%s:$(DATABASE_PASSWORD)@%s-rw:5432/%s" $owner $pgName $db -}}
{{- end }}
