---
name: tf-destroy
description: Safely tear down all AWS infrastructure for this project (site bucket, CloudFront, GitHub OIDC role) to stop costs. Optional "all" also removes the Terraform state backend. Requires explicit typed confirmation.
argument-hint: "[all]"
allowed-tools: Bash, Read, AskUserQuestion
disable-model-invocation: true
---

Tear down this project's AWS infrastructure. This is IRREVERSIBLE: the site goes offline and the CloudFront URL is lost forever.

Arguments: `$ARGUMENTS`
- empty → destroy Terraform-managed resources only (keep the state bucket + lock table, so you can re-apply later)
- `all` → also delete the state bucket and DynamoDB lock table (full cleanup, ~$0 left behind)

If `aws` fails with a `pyexpat` / `libexpat` error, prefix AWS commands with `DYLD_LIBRARY_PATH=/opt/homebrew/opt/expat/lib`.

## 1. Preflight (read-only)
- [ ] `aws sts get-caller-identity` — show the account ID
- [ ] `cd terraform && terraform init -input=false` then `terraform output -json` — capture `s3_bucket_name`, `cloudfront_distribution_id`, `cloudfront_domain_name`
- [ ] Read the backend bucket / table names from `terraform/backend.tf`
- [ ] `terraform plan -destroy -no-color` — list every resource that will be destroyed and the total count
- [ ] Count objects in the site bucket: `aws s3 ls s3://<bucket> --recursive --summarize`

If outputs are empty or state has 0 resources, report "nothing to destroy" and stop.

## 2. Confirmation (MANDATORY — never skip)
Show a summary: account ID, region, every resource to be destroyed, object count, and whether the backend will be removed (`all`).

Then ask the engineer to type the exact phrase **`destroy <s3_bucket_name>`** (use AskUserQuestion; they type it via "Other"). Proceed ONLY if the reply matches exactly. Anything else → abort and say nothing was changed.

## 3. Teardown (stop at the first failure — do NOT retry automatically)
- [ ] Disable CI so a push can't redeploy into a half-deleted stack: `gh workflow disable Deploy` (warn and continue if `gh` is unavailable)
- [ ] Empty the site bucket: `aws s3 rm s3://<s3_bucket_name> --recursive`
- [ ] `cd terraform && terraform destroy -auto-approve -no-color` (CloudFront disable + delete takes ~5–15 min; this is normal)
- [ ] Verify: `terraform state list` returns nothing; `aws cloudfront get-distribution --id <id>` returns NoSuchDistribution; `aws s3api head-bucket --bucket <bucket>` returns 404

## 4. Backend removal (only when argument is `all`, and only after step 3 succeeded)
The state bucket is versioned, so every object version and delete marker must be removed:
```bash
B=<state-bucket>
aws s3api list-object-versions --bucket $B --output json \
  --query '{Objects: [Versions, DeleteMarkers][][].{Key: Key, VersionId: VersionId}}' > /tmp/tf-versions.json
aws s3api delete-objects --bucket $B --delete file:///tmp/tf-versions.json   # skip if Objects is null/empty
aws s3api delete-bucket --bucket $B --region <region>
aws dynamodb delete-table --table-name <lock-table> --region <region>
```
Then re-comment the `backend "s3"` block in `terraform/backend.tf` (the bucket it points to no longer exists) and run `cd terraform && terraform init -reconfigure -input=false` so a future `/tf-apply` starts from local state.

## 5. Report
- [ ] What was destroyed (with counts), what was kept (backend, if not `all`)
- [ ] Anything left that could still cost money (should be none)
- [ ] How to rebuild: `/tf-plan` → `/tf-apply` → `/deploy`, re-enable CI with `gh workflow enable Deploy`, and update `.github/workflows/deploy.yml` with the new distribution ID (it changes on every rebuild)
