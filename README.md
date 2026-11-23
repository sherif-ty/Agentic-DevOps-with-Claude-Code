# Ultimate Agentic DevOps with Claude Code

**Manage real AWS infrastructure end to end with Claude Code: custom skills, specialized subagents, and MCP servers.**

This repo shows how to run the whole DevOps lifecycle of a production-style AWS stack (Terraform → S3 + CloudFront → GitHub Actions with OIDC) through Claude Code. Instead of typing `terraform` and `aws` commands by hand, you run slash commands like `/tf-plan`, `/tf-apply`, `/deploy` and `/infra-audit`. Claude carries out each one following a written, reviewable playbook, with guardrails built in.

The app being deployed is a small static **weather app** (HTML/CSS/JS). It's intentionally simple: the infrastructure and the agentic workflow around it are what this repo is about.

---

## What this repo demonstrates

| Concept | How it's used here |
|---|---|
| **Skills** (`.claude/skills/`) | One skill per lifecycle step: scaffold, plan, apply, deploy, status, audit, destroy |
| **Subagents** (`.claude/agents/`) | Specialists with their own model, tools and memory: Terraform writer, security auditor, cost optimizer, drift detector |
| **Parallel agents** | `/infra-audit` forks its context and runs 3 agents at the same time, then merges their reports |
| **MCP servers** | Terraform MCP server (Docker) and AWS API MCP server give Claude direct tool access |
| **Guardrails** | Manual-only action skills, read-only auditors, typed confirmation before destroy, keyless OIDC CI |
| **Project memory** | `CLAUDE.md` gives Claude the architecture and conventions; agents keep their own `memory: project` |

---

## The agentic lifecycle

```
 /scaffold-terraform ──► /tf-plan ──► /tf-apply ──► /deploy ──► /infra-status
   (tf-writer agent)     (risk         (apply +       (S3 sync +    (health
                          analysis)     verify)        CF invalidate) dashboard)
                                                            │
                     git push to main ──► GitHub Actions ───┘  (same deploy, keyless OIDC)

 /infra-audit ──┬── security-auditor (Sonnet, read-only) ──┐
   (forked)     ├── cost-optimizer   (Haiku,  read-only) ──┼──► unified report
                └── drift-detector   (Haiku,  bash)     ───┘

 /tf-destroy  ──► preflight ──► type "destroy <bucket>" ──► disable CI ──► empty bucket ──► terraform destroy
```

---

## Skills

All action skills have `disable-model-invocation: true`: Claude never runs them on its own, only when you type the command.

| Command | What it does |
|---|---|
| `/scaffold-terraform [region] [name]` | Generates the full `terraform/` config from `template-spec.md` (S3, CloudFront OAC, outputs, backend) |
| `/tf-plan` | Runs `terraform plan`, summarizes add/change/destroy counts, flags risky replacements and blast radius |
| `/tf-apply` | Applies, shows outputs, checks that CloudFront reaches `Deployed`. Never retries on failure by itself |
| `/deploy` | Reads Terraform outputs, syncs the site to S3, invalidates CloudFront, reports the URL |
| `/infra-status` | Health dashboard: Terraform state, bucket contents, distribution status, HTTP 200 on the site |
| `/infra-audit` | Runs the security, cost and drift agents in parallel in a forked context, then merges the results into one report |
| `/setup-gh-actions [create\|validate]` | Creates or validates the deploy workflow (OIDC role, bucket, distribution ID, triggers) |
| `/tf-destroy [all]` | Safe teardown: preflight, **typed confirmation**, disables CI, empties the bucket, destroys. `all` also removes the state backend |

## Subagents

| Agent | Model | Tools | Role |
|---|---|---|---|
| `tf-writer` | inherit | Read, Write, Edit + Terraform MCP | Writes production-grade Terraform following project conventions |
| `security-auditor` | Sonnet | Read-only | Public buckets, OAC vs OAI, least-privilege IAM, OIDC scoping, HTTPS, headers. Reports CRITICAL→LOW findings with fixes |
| `cost-optimizer` | Haiku | Read-only | CloudFront price class, caching TTLs, storage class, unused resources |
| `drift-detector` | Haiku | Bash | Runs `terraform plan -detailed-exitcode` and explains any drift and its likely cause |

Each agent gets the cheapest model that does its job well, and only the tools it needs. The auditors can't change anything.

## MCP servers (`mcp.json`)

- **terraform**: `hashicorp/terraform-mcp-server` in Docker, with `terraform/` mounted at `/workspace`
- **aws**: `awslabs.aws-api-mcp-server` for direct AWS API queries

AWS credentials and region stay in `.claude/settings.local.json` (gitignored), never in the repo.

---

## The infrastructure

Provisioned by Terraform in `terraform/`:

```
Browser ──HTTPS──► CloudFront ──OAC──► S3 bucket (private)
                                         ▲
GitHub Actions ──OIDC──► IAM role ───────┘  (s3 sync + cloudfront invalidation only)
```

- **S3**: private site bucket with all public access blocked, readable only through CloudFront Origin Access Control
- **CloudFront**: HTTPS redirect, `CachingOptimized` policy, `index.html` as the root and fallback
- **GitHub OIDC**: keyless CI. The trust policy is scoped to this repo's `main` branch, and the deploy policy only allows syncing this bucket and invalidating this distribution
- **State**: S3 backend with DynamoDB locking
- All resources are tagged with `Project` and `Environment`

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main` (or manually through `workflow_dispatch`). It assumes the deploy role through OIDC, syncs the site to S3, and invalidates CloudFront. No AWS access keys are stored in GitHub.

---

## Getting started

Prerequisites: [Claude Code](https://claude.com/claude-code), Terraform ≥ 1.5, AWS CLI, Docker (for the Terraform MCP server), `gh` CLI.

```bash
git clone https://github.com/sherif-ty/Ultimate-Agentic-DevOps-with-Claude-Code.git
cd Ultimate-Agentic-DevOps-with-Claude-Code
claude
```

Then, inside Claude Code:

```
/tf-plan                 # review what will be created
/tf-apply                # create S3, CloudFront, OIDC role
/setup-gh-actions validate   # make sure the workflow matches the new outputs
/deploy                  # push the site live
/infra-status            # confirm everything is healthy
/infra-audit             # security + cost + drift report
/tf-destroy              # tear it all down when you're done
```

After a rebuild, the CloudFront distribution ID changes. Update it in `.github/workflows/deploy.yml` (`/setup-gh-actions validate` will catch it).

---

## The demo app

A static weather app in `index.html`, `style.css`, `app.js` and `images/`. Search for a city to see its current temperature, humidity, wind and conditions. It calls [Open-Meteo](https://open-meteo.com/) straight from the browser, so it needs no backend and no API key, which keeps hosting pure S3 + CloudFront. To preview it locally, run `open index.html`.

## Repository layout

```
.
├── .claude/
│   ├── agents/          # tf-writer, security-auditor, cost-optimizer, drift-detector
│   └── skills/          # scaffold-terraform, tf-plan, tf-apply, deploy, infra-status,
│                        # infra-audit, setup-gh-actions, tf-destroy
├── .github/workflows/   # deploy.yml (OIDC → S3 sync → CloudFront invalidation)
├── terraform/           # main.tf, github-oidc.tf, variables.tf, outputs.tf, backend.tf, providers.tf
├── CLAUDE.md            # project context Claude loads every session
├── mcp.json             # MCP server definitions
├── index.html, style.css, app.js, images/   # the demo weather app
└── README.md
```

## Credits

- Weather app UI adapted from [devaalfred/weather_flask_app](https://github.com/devaalfred/weather_flask_app)
- Weather data: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
