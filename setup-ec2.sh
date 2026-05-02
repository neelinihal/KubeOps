#!/bin/bash
# ============================================
# KubeOps EC2 Setup Script
# Run this on a fresh Amazon Linux 2023 EC2
# ============================================

set -e

echo "=== 1. Installing Docker ==="
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

echo "=== 2. Installing Docker Compose ==="
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "=== 3. Installing kubectl ==="
curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

echo "=== 4. Installing AWS CLI (if not present) ==="
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

echo "=== 5. Configure AWS credentials ==="
echo "Run: aws configure"
echo "Then connect to your EKS cluster(s):"
echo "  aws eks update-kubeconfig --name my-eks --region eu-north-1"
echo ""

echo "=== 6. Clone and deploy ==="
echo "After configuring AWS:"
echo "  git clone <your-repo-url> kubeops"
echo "  cd kubeops/devops"
echo "  docker-compose up -d --build"
echo ""
echo "App will be available at http://<EC2-PUBLIC-IP>"
echo ""
echo "=== IMPORTANT ==="
echo "EC2 Security Group needs:"
echo "  - Port 80  (HTTP)  - for the app"
echo "  - Port 443 (HTTPS) - if using SSL"
echo "  - Port 22  (SSH)   - for management"
echo ""
echo "EC2 IAM Role needs:"
echo "  - AmazonEKSClusterPolicy"
echo "  - AmazonEKSWorkerNodePolicy"
echo "  - Or a custom policy with eks:DescribeCluster + sts:GetCallerIdentity"
