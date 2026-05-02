# KubeOps Deployment Guide — Private VPC EKS Cluster

## Pre-built Images
- `neelinihal/kubeops-frontend:0.2`
- `neelinihal/kubeops-backend:0.2`

---

## Prerequisites

| # | Requirement | Details |
|---|-------------|---------|
| 1 | AWS CLI installed & configured | `aws configure` with access to the target account |
| 2 | kubectl installed | v1.28+ recommended |
| 3 | EKS cluster created | Private or public VPC |
| 4 | PostgreSQL RDS accessible from VPC | Same VPC or VPC-peered |
| 5 | Metrics Server installed on cluster | Required for `kubectl top` commands |
| 6 | Network access to cluster API | Must be inside VPC (bastion/VPN) for private clusters |

---

## Step 1: Configure AWS CLI

```bash
aws configure
```
Enter your Access Key, Secret Key, Region, and output format (`json`).

---

## Step 2: Update kubeconfig

```bash
aws eks update-kubeconfig --name <CLUSTER-NAME> --region <REGION>
```

Verify connectivity:
```bash
kubectl get nodes
```

> **Private VPC Note:** If the EKS API is private, you must run these commands from inside the VPC — e.g., from a bastion host, VPN-connected machine, or EC2 instance in the same VPC.

---

## Step 3: Create namespace

```bash
kubectl create namespace kubeops
```

---

## Step 4: Create database secret

```bash
kubectl create secret generic kubeops-db-secret \
  --namespace kubeops \
  --from-literal=url="jdbc:postgresql://<RDS-ENDPOINT>:5432/<DB-NAME>" \
  --from-literal=username="<DB-USER>" \
  --from-literal=password="<DB-PASSWORD>"
```

Replace:
- `<RDS-ENDPOINT>` — your RDS endpoint (e.g., `mydb.abc123.eu-north-1.rds.amazonaws.com`)
- `<DB-NAME>` — database name (e.g., `postgres`)
- `<DB-USER>` — database username
- `<DB-PASSWORD>` — database password

> **Important:** RDS security group must allow inbound on port **5432** from the EKS cluster's node security group.

---

## Step 5: Create RBAC (ServiceAccount + ClusterRole)

Create file `rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kubeops-sa
  namespace: kubeops
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubeops-role
rules:
  - apiGroups: ["", "apps", "batch", "autoscaling", "networking.k8s.io"]
    resources: ["pods", "services", "deployments", "replicasets", "nodes",
                "namespaces", "events", "configmaps", "secrets", "ingresses",
                "horizontalpodautoscalers", "persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "delete", "update", "patch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubeops-role-binding
subjects:
  - kind: ServiceAccount
    name: kubeops-sa
    namespace: kubeops
roleRef:
  kind: ClusterRole
  name: kubeops-role
  apiGroup: rbac.authorization.k8s.io
```

Apply:
```bash
kubectl apply -f rbac.yaml
```

---

## Step 6: Create nginx ConfigMap (frontend proxy fix)

The frontend needs to proxy `/api/` calls to the backend **Kubernetes service** instead of Docker's `backend` hostname.

Create file `nginx-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: kubeops
data:
  default.conf: |
    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://kubeops-backend.kubeops.svc.cluster.local:9090;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 120s;
        }
    }
```

Apply:
```bash
kubectl apply -f nginx-configmap.yaml
```

---

## Step 7: Deploy backend

Create file `backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubeops-backend
  namespace: kubeops
  labels:
    app: kubeops-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubeops-backend
  template:
    metadata:
      labels:
        app: kubeops-backend
    spec:
      serviceAccountName: kubeops-sa
      containers:
        - name: backend
          image: neelinihal/kubeops-backend:0.2
          imagePullPolicy: Always
          ports:
            - containerPort: 9090
          env:
            - name: SPRING_DATASOURCE_URL
              valueFrom:
                secretKeyRef:
                  name: kubeops-db-secret
                  key: url
            - name: SPRING_DATASOURCE_USERNAME
              valueFrom:
                secretKeyRef:
                  name: kubeops-db-secret
                  key: username
            - name: SPRING_DATASOURCE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: kubeops-db-secret
                  key: password
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /api/kubectl/cluster-info
              port: 9090
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/kubectl/cluster-info
              port: 9090
            initialDelaySeconds: 60
            periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: kubeops-backend
  namespace: kubeops
spec:
  selector:
    app: kubeops-backend
  ports:
    - port: 9090
      targetPort: 9090
  type: ClusterIP
```

Apply:
```bash
kubectl apply -f backend-deployment.yaml
```

---

## Step 8: Deploy frontend

Create file `frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubeops-frontend
  namespace: kubeops
  labels:
    app: kubeops-frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kubeops-frontend
  template:
    metadata:
      labels:
        app: kubeops-frontend
    spec:
      containers:
        - name: frontend
          image: neelinihal/kubeops-frontend:0.2
          imagePullPolicy: Always
          ports:
            - containerPort: 80
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: default.conf
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
      volumes:
        - name: nginx-config
          configMap:
            name: nginx-config
---
apiVersion: v1
kind: Service
metadata:
  name: kubeops-frontend
  namespace: kubeops
spec:
  selector:
    app: kubeops-frontend
  ports:
    - port: 80
      targetPort: 80
  type: LoadBalancer
```

Apply:
```bash
kubectl apply -f frontend-deployment.yaml
```

---

## Step 9: Verify deployment

```bash
# Check all pods are running
kubectl get pods -n kubeops

# Check services
kubectl get svc -n kubeops

# Check backend logs
kubectl logs -l app=kubeops-backend -n kubeops --tail=50

# Check frontend logs
kubectl logs -l app=kubeops-frontend -n kubeops --tail=20
```

---

## Step 10: Access the application

```bash
kubectl get svc kubeops-frontend -n kubeops
```

Copy the **EXTERNAL-IP** from the LoadBalancer output and open it in your browser.

> It may take 2-3 minutes for the LoadBalancer DNS to propagate.

---

## Quick Apply (All at once)

If you have all YAML files ready:

```bash
kubectl apply -f rbac.yaml
kubectl apply -f nginx-configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend pod CrashLoopBackOff | Check logs: `kubectl logs -l app=kubeops-backend -n kubeops` — likely DB connection issue |
| Cannot connect to RDS | Verify RDS security group allows port 5432 from cluster node SG |
| `kubectl top` not working | Install Metrics Server: `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml` |
| Frontend shows but API fails | Check nginx config is mounted: `kubectl exec -it <frontend-pod> -n kubeops -- cat /etc/nginx/conf.d/default.conf` |
| LoadBalancer stuck in Pending | Ensure your VPC has public subnets tagged with `kubernetes.io/role/elb: 1` |
| Private cluster — can't run kubectl | Use a bastion host or AWS Systems Manager Session Manager to access a node in the VPC |

---

## Updating to a new version

```bash
# Build and push new images
docker build -t neelinihal/kubeops-backend:<NEW-TAG> ./backend
docker build -t neelinihal/kubeops-frontend:<NEW-TAG> ./frontend
docker push neelinihal/kubeops-backend:<NEW-TAG>
docker push neelinihal/kubeops-frontend:<NEW-TAG>

# Update deployments
kubectl set image deployment/kubeops-backend backend=neelinihal/kubeops-backend:<NEW-TAG> -n kubeops
kubectl set image deployment/kubeops-frontend frontend=neelinihal/kubeops-frontend:<NEW-TAG> -n kubeops
```
