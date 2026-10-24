# DevOps and Cloud Infrastructure Setup

## Required Tooling
Platform engineers and DevOps team members require:
1. AWS CLI v2 configured with AWS SSO (`aws configure sso`)
2. Terraform v1.7+ or OpenTofu
3. `kubectl` and `helm` v3+
4. `k9s` terminal UI for Kubernetes debugging

## Kubernetes Staging Access
Request staging cluster credentials:
```bash
aws eks update-kubeconfig --region us-east-1 --name staging-eks-cluster
kubectl get nodes
```
All infrastructure changes must be made via Terraform modules in `github.com/company/infra-iac`. Direct edits in the AWS web console are strictly prohibited by compliance.

## CI/CD Pipeline Automation
We use GitHub Actions with self-hosted runner groups. Workflow templates are stored in `.github/workflows/reusable-build.yml`.
Every service build produces an image tagged with the commit SHA and pushes to Amazon ECR.
