# Weather App on AWS (S3 + CloudFront, Terraform, GitHub Actions)

A simple weather web app that shows the current temperature, humidity, wind speed and conditions for any city. It is a fully **static** site (HTML + CSS + vanilla JS) hosted on **Amazon S3**, served through **CloudFront**, provisioned with **Terraform**, and deployed by **GitHub Actions** using OIDC (no stored AWS keys).

The app was converted from a Flask (Python) app into a static, browser-only app so it can run on S3/CloudFront with no servers.

---

## Features

- Search weather by city name
- Current temperature, humidity, wind speed, and condition with icon
- Day/night icons
- Responsive UI, works on mobile
- No backend and no API key: data comes from [Open-Meteo](https://open-meteo.com/) (geocoding + forecast APIs)

---

## Project Structure

```
.
├── index.html              # App markup
├── style.css               # Styling
├── app.js                  # Fetches geocoding + weather from Open-Meteo and renders results
├── images/                 # Background images
├── terraform/              # S3 bucket, CloudFront distribution, GitHub OIDC role
├── .github/workflows/      # deploy.yml: sync to S3 + invalidate CloudFront on push to main
└── .claude/                # Claude Code skills, agents, hooks
```

---

## Run Locally

No build step. Open the page directly:

```bash
open index.html
```

Or serve it locally:

```bash
python3 -m http.server 8000
# then browse to http://localhost:8000
```

---

## Architecture

```
Browser ──HTTPS──> CloudFront ──OAC──> S3 (private bucket)
   │
   └──fetch──> Open-Meteo APIs (geocoding + current weather)
```

- **S3**: private bucket, reachable only through CloudFront Origin Access Control
- **CloudFront**: CDN, HTTPS redirect, `index.html` as the default root object
- **Terraform state**: S3 backend with DynamoDB locking
- **CI/CD**: GitHub Actions assumes an IAM role through GitHub OIDC

---

## Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Claude Code skills cover the full workflow: `/tf-plan`, `/tf-apply`, `/deploy`, `/infra-status`, `/infra-audit`, `/tf-destroy`. See [CLAUDE.md](CLAUDE.md).

---

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`, which:

1. Authenticates to AWS with OIDC
2. Runs `aws s3 sync` on the site files (`index.html`, `style.css`, `app.js`, `images/`)
3. Invalidates the CloudFront cache

---

## Credits

- Original Flask weather app UI by Deva Alfred ([devaalfred/weather_flask_app](https://github.com/devaalfred/weather_flask_app))
- Weather data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
