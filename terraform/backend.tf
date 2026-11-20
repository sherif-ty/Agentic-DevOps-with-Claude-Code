# ---------------------------------------------------------------------------
# Remote state backend (S3 + DynamoDB locking)
#
# Backend is ACTIVE (migrated). Original bootstrap steps, for reference:
#   1. Leave this block commented out and run `terraform init` (local state).
#   2. Create the state bucket and lock table, e.g.:
#        aws s3api create-bucket --bucket <state-bucket> --region ap-south-1 \
#          --create-bucket-configuration LocationConstraint=ap-south-1
#        aws s3api put-bucket-versioning --bucket <state-bucket> \
#          --versioning-configuration Status=Enabled
#        aws dynamodb create-table --table-name <lock-table> \
#          --attribute-definitions AttributeName=LockID,AttributeType=S \
#          --key-schema AttributeName=LockID,KeyType=HASH \
#          --billing-mode PAY_PER_REQUEST --region ap-south-1
#   3. Uncomment the block below, fill in the names, and run:
#        terraform init -migrate-state
# ---------------------------------------------------------------------------

terraform {
  backend "s3" {
    bucket         = "portfolio-site-tfstate-995725180171"
    key            = "portfolio-site/production/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "portfolio-site-tflock"
    encrypt        = true
  }
}
