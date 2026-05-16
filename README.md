<div align="center">

# ⚙️ KubeOps

### Browser-Based Kubernetes Operations Platform — Powered by AI

[![Java](https://img.shields.io/badge/Java-Spring%20Boot%203-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Angular](https://img.shields.io/badge/Angular-17-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.io)
[![AWS EKS](https://img.shields.io/badge/AWS-EKS-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/eks/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Java%20Client-326CE5?style=flat-square&logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?style=flat-square&logo=docker&logoColor=white)](https://hub.docker.com/u/neelinihal)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Execute kubectl commands, monitor pods, diagnose issues with NVIDIA NIM AI — all from your browser.**

[Live Demo](https://neelinihal.github.io/KubeOps/) · [Deployment Guide](DEPLOYMENT-GUIDE.md) · [Docker Hub](https://hub.docker.com/u/neelinihal)

</div>

---

## 📌 Overview

**KubeOps** is a production-grade Kubernetes operations dashboard that replaces terminal-based kubectl workflows with a secure, browser-based control plane. Built on **Spring Boot 3** and **Angular 17**, it runs inside a private AWS VPC on EKS — giving your team real-time cluster visibility, AI-powered root-cause analysis, and a full command audit trail without exposing the API server.

---

## 📊 Key Metrics

| Metric | Result |
|---|---|
| API server load reduction | **↓ 70%** |
| Ops round-trip latency | **< 200ms** |
| AI root-cause accuracy | **~70%** |
| Commands audited | **283+** |

---

## ✨ Features

- **🖥️ Command Center** — Execute kubectl commands from the browser with one click; no terminal required
- **🚀 Deployment Control** — Scale replicas, restart pods, and trigger rollouts instantly
- **📈 Resource Monitor** — Live CPU & memory usage per pod via Kubernetes Metrics Server
- **📋 Events Timeline** — Full cluster event stream (Normal + Warning) with timestamps
- **🤖 AI Diagnostics** — NVIDIA NIM-powered root-cause analysis for pod failures and anomalies
- **🗂️ Execution History** — Every command logged to PostgreSQL/RDS with user, timestamp, and output
- **🔒 RBAC Security** — Fine-grained Kubernetes ServiceAccount + ClusterRole with least-privilege access
- **⚡ Hazelcast Cache** — In-memory caching layer to cut repeated API server calls by 70%

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Private AWS VPC                      │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │   Angular    │───▶│  Spring Boot │───▶│  AWS EKS  │  │
│  │  Frontend    │    │   Backend    │    │  Cluster  │  │
│  │  (NGINX)     │    │  Port 9090   │    │           │  │
│  └──────────────┘    └──────┬───────┘    └───────────┘  │
│                             │                            │
│                    ┌────────┴────────┐                   │
│                    │                 │                   │
│             ┌──────▼─────┐   ┌──────▼─────┐             │
│             │ PostgreSQL │   │ Hazelcast  │             │
│             │    RDS     │   │   Cache    │             │
│             └────────────┘   └────────────┘             │
└─────────────────────────────────────────────────────────┘
                         │
               ┌─────────▼─────────┐
               │    NVIDIA NIM     │
               │  AI Diagnostics   │
               └───────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Spring Boot 3, Kubernetes Java Client |
| **Frontend** | Angular 17, TypeScript, SCSS |
| **AI** | NVIDIA NIM (LLM-based root-cause analysis) |
| **Cache** | Hazelcast (in-memory distributed cache) |
| **Database** | PostgreSQL on AWS RDS |
| **Infrastructure** | AWS EKS, Private VPC, NGINX |
| **Containers** | Docker, Kubernetes (RBAC, Metrics Server) |

---

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with EKS access
- `kubectl` v1.28+
- EKS cluster with Metrics Server installed
- PostgreSQL RDS accessible from VPC

### Deploy in 3 commands

```bash
# 1. Clone the repo
git clone https://github.com/neelinihal/KubeOps.git && cd KubeOps

# 2. Set your DB credentials
kubectl create secret generic kubeops-db-secret --namespace kubeops \
  --from-literal=url="jdbc:postgresql://<RDS-ENDPOINT>:5432/<DB>" \
  --from-literal=username="<USER>" \
  --from-literal=password="<PASS>"

# 3. Apply all manifests
kubectl apply -f rbac.yaml
kubectl apply -f nginx-configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
```

> For the full step-by-step guide including RBAC setup, ConfigMaps, and troubleshooting, see [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md).

### Pre-built Docker Images

```bash
docker pull neelinihal/kubeops-backend:0.2
docker pull neelinihal/kubeops-frontend:0.2
```

### Local Development (Docker Compose)

```bash
docker-compose up
```

Open `http://localhost` in your browser.

---

## 📁 Project Structure

```
KubeOps/
├── backend/                  # Spring Boot 3 application
│   ├── src/
│   ├── Dockerfile
│   └── pom.xml
├── frontend/                 # Angular 17 application
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml        # Local development setup
├── DEPLOYMENT-GUIDE.md       # Full EKS deployment guide
└── setup-ec2.sh              # EC2 bootstrap script
```

---

## 🔐 Security

- All kubectl execution is proxied through the Spring Boot backend — the browser never touches the Kubernetes API directly
- RBAC enforces least-privilege: only necessary verbs on necessary resources
- DB credentials stored as Kubernetes Secrets, never in environment variables or source code
- NGINX acts as the sole ingress, routing `/api/` calls internally via cluster DNS

---

## 📄 License

MIT © [Nihal Neeli](https://github.com/neelinihal)
