# GDPR and Data Protection Compliance

This document describes how the RAG Starter Kit implements data protection controls to comply with the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and other data privacy frameworks. It covers data processing activities, data subject rights, consent management, and the compliance roadmap.

## Table of Contents

- [Data Processing Overview](#data-processing-overview)
- [Data Erasure (Article 17)](#data-erasure-article-17)
- [Data Export (Article 20)](#data-export-article-20)
- [Consent Management](#consent-management)
- [Data Retention](#data-retention)
- [Data Residency](#data-residency)
- [Sub-Processor List](#sub-processor-list)
- [DPA Contact Information](#dpa-contact-information)
- [Compliance Roadmap](#compliance-roadmap)

---

## Data Processing Overview

### Data Collected

The RAG Starter Kit processes the following categories of personal data:

| Category | Data Points | Purpose | Legal Basis |
|----------|-------------|---------|-------------|
| **Identity** | Name, email address, profile image | Account creation and identification | Contract performance (Art. 6(1)(b)) |
| **Authentication** | Password hash, OAuth tokens, MFA secrets | Secure access control | Legitimate interest (Art. 6(1)(f)) |
| **Usage Data** | Chat messages, document uploads, search queries | Service delivery (RAG pipeline) | Contract performance (Art. 6(1)(b)) |
| **Technical Data** | IP address, user agent, browser fingerprint | Security, rate limiting, fraud prevention | Legitimate interest (Art. 6(1)(f)) |
| **Workspace Data** | Workspace membership, role assignments | Authorization and collaboration | Contract performance (Art. 6(1)(b)) |
| **API Usage** | Request counts, endpoint usage, timestamps | Service monitoring and billing | Legitimate interest (Art. 6(1)(f)) |
| **Audit Logs** | User actions, security events, timestamps | Security monitoring, compliance | Legitimate interest (Art. 6(1)(f)) |
| **Consent Records** | Consent type, granted/revoked, timestamp, IP | Legal compliance | Consent (Art. 6(1)(a)) |

### Data NOT Collected

The platform does not collect:
- Precise geolocation data
- Biometric data
- Financial account numbers (payment processing is handled by Stripe/Paddle)
- Data from third-party sources not provided by the user

### Processing Principles

The platform adheres to GDPR processing principles:

1. **Lawfulness, fairness, and transparency**: All processing has a documented legal basis.
2. **Purpose limitation**: Data is processed only for the purposes described above.
3. **Data minimization**: Only data necessary for the stated purposes is collected.
4. **Accuracy**: Users can update their profile information at any time.
5. **Storage limitation**: Retention periods are enforced (see Data Retention).
6. **Integrity and confidentiality**: Data is encrypted at rest and in transit (see SECURITY.md).
7. **Accountability**: All processing is documented and auditable.

---

## Data Erasure (Article 17)

### Overview

The platform implements the right to be forgotten (GDPR Article 17) through a verified, multi-step erasure flow. Users can request erasure of specific data categories or full account deletion.

### Erasure Request Types

| Type | What Gets Deleted | What Gets Anonymized |
|------|-------------------|---------------------|
| `full` | All user data including account | Audit logs (anonymized) |
| `documents` | All uploaded documents and chunks | Nothing |
| `chats` | All chat conversations and messages | Nothing |
| `account` | Account and authentication data | Personal data (name, email, image) |

### Erasure Flow

1. **Request initiation**: The user submits an erasure request specifying the type (`full`, `documents`, `chats`, or `account`) and optional reason.
2. **Token verification**: A cryptographic verification token is generated using `crypto.randomBytes(32)` and stored in Redis with a 24-hour TTL. The token is sent to the user's registered email.
3. **Token confirmation**: The user confirms the erasure request by providing the verification token. Verification uses `timingSafeEqual` to prevent timing attacks.
4. **Data erasure**: The system processes the erasure in the correct order to respect foreign key constraints:
   - API usage records
   - Rate limit records
   - API keys
   - Document chunks (per document)
   - Documents
   - Chat messages (per chat)
   - Chats
   - Workspace memberships
   - Audit logs (anonymized, not deleted)
   - User record (for full erasure)
5. **Completion report**: An erasure report is generated with counts of all items processed, any errors encountered, and timestamps.

### What Gets Deleted vs. Anonymized

**Deleted (permanently removed):**
- User profile and authentication data
- OAuth account links
- Active sessions
- API keys and usage data
- Documents and document chunks
- Chat messages and conversations
- Workspace memberships
- Rate limit records

**Anonymized (retained with PII removed):**
- Audit log entries -- The user ID is replaced with `anonymized-<base64>`, and the IP address, user agent, and metadata fields are cleared. This preserves the tamper-evident hash chain while removing PII.

### Compliance Notes

- The 24-hour verification window balances security (preventing unauthorized erasure) with user experience (not requiring immediate action).
- Audit log anonymization (rather than deletion) ensures compliance with both GDPR Article 17 (right to erasure) and security monitoring requirements that mandate log retention.
- Full erasure is irreversible once completed.

Implementation: `src/lib/compliance/gdpr.ts`

---

## Data Export (Article 20)

### Overview

The platform implements the right to data portability (GDPR Article 20) by allowing users to export their personal data in machine-readable formats.

### Supported Export Formats

| Format | MIME Type | Use Case |
|--------|-----------|----------|
| JSON | `application/json` | Machine-readable, structured data (recommended) |
| CSV | `text/csv` | Spreadsheet import, analysis |
| PDF | `application/pdf` | Human-readable archival |

### Export Contents

Users can selectively include or exclude the following data categories:

**Profile data** (always included):
- User ID, name, email, email verification status
- Profile image URL, role
- Account creation and last update timestamps

**Documents** (optional):
- Document ID, name, content type, size
- Document metadata, status
- Creation and update timestamps

**Chats and messages** (optional):
- Chat conversations with full message history
- Message content, role (user/assistant/system), timestamps

**Usage data** (optional):
- API usage records (most recent 1,000 entries)
- Request timestamps and endpoint information

### Export Format

```json
{
  "userId": "clx...",
  "exportedAt": "2026-05-06T12:00:00.000Z",
  "version": "1.0",
  "profile": { ... },
  "documents": [ ... ],
  "chats": [ ... ],
  "usage": [ ... ]
}
```

### Rate Limiting

Data export requests are rate-limited to 10 per hour per user to prevent abuse while ensuring reasonable access.

Implementation: `src/lib/compliance/gdpr.ts`

---

## Consent Management

### Consent Types

The platform tracks consent for three distinct processing activities:

| Consent Type | Description | Default | Withdrawal Impact |
|--------------|-------------|---------|-------------------|
| `analytics` | Collection of usage analytics and performance metrics | Not granted | Analytics collection stops; core functionality unaffected |
| `marketing` | Marketing communications and product updates | Not granted | User stops receiving marketing emails |
| `data_processing` | Processing of personal data for core service delivery | Required | Account deletion required |

### Consent Recording

When consent is recorded, the following information is captured:

- User ID
- Consent type (`analytics`, `marketing`, `data_processing`)
- Granted/revoked status
- Timestamp
- IP address
- User agent
- Consent version string

This information is stored in the `Consent` database table, creating an immutable record of all consent decisions.

### Consent Withdrawal

Users can withdraw consent at any time:

1. The withdrawal is recorded with `granted: false` and the current timestamp.
2. Previous consent records are marked as revoked with the `revokedAt` timestamp.
3. The most recent consent record for each type determines the current consent status.
4. Withdrawal of consent does not affect the lawfulness of processing based on consent before withdrawal.

### Consent Checking

The system checks consent by querying the most recent unrevoked consent record for the relevant type:

```typescript
hasConsent(userId, 'analytics') // Returns true if analytics consent is currently granted
```

Implementation: `src/lib/compliance/gdpr.ts`

---

## Data Retention

### Default Retention Periods

| Data Category | Retention Period | Cleanup Method |
|---------------|-----------------|----------------|
| User accounts | Until deletion request | Manual or automated erasure |
| Documents | Until user or workspace deletion | Cascading delete |
| Chat messages | Until user or workspace deletion | Cascading delete |
| API keys | Until revocation + 30 days | Automated cleanup |
| Audit logs (INFO/WARNING) | 90 days | Automated cleanup or partition detachment |
| Audit logs (ERROR/CRITICAL) | 1 year | Automated cleanup |
| Consents | Until account deletion | Permanent record |
| Sessions | 7 days (JWT expiry) | TTL-based auto-expiry |
| Rate limit records | Current window only | TTL-based auto-expiry |
| IP reputation | 24 hours after last violation | TTL-based auto-expiry |
| Account lockout records | Until lockout expires | TTL-based auto-expiry |
| Erasure tokens | 24 hours | TTL-based auto-expiry |

### Stale Data Cleanup

The platform provides a `getDataRetentionStats()` function that returns:

- Total user count
- Total document count
- Total chat count
- Count of documents older than 2 years (stale data)

This function can be used by administrators to monitor data growth and identify candidates for cleanup.

### Audit Log Retention

Audit logs use a tiered retention strategy:

1. **Partition-based cleanup** (preferred): PostgreSQL table partitioning allows old partitions to be detached without deleting individual rows. Partitions older than 3 months are detached automatically.
2. **DELETE-based cleanup** (fallback): For non-partitioned tables, `INFO` and `WARNING` severity logs are deleted after 90 days, and `ERROR` and `CRITICAL` severity logs are deleted after 1 year.

---

## Data Residency

### Configuration Options

The RAG Starter Kit supports configurable data residency through its infrastructure choices:

| Region | Database | Redis | Application | AI Providers |
|--------|----------|-------|-------------|-------------|
| **EU** | Prisma Postgres EU, Supabase EU (Frankfurt), or Railway EU (Frankfurt) | Upstash EU (eu-west-1) | Vercel EU (eu-west-1) or Railway EU | OpenAI (no region pinning), Google Gemini (eu-west1) |
| **US** | Prisma Postgres US, Supabase US (us-east-1), or Railway US | Upstash US (us-east-1) | Vercel US (us-east-1) or Railway US | OpenAI (us-east-1), Google Gemini (us-central1) |
| **APAC** | Prisma Postgres APAC, Supabase APAC (ap-southeast-1) | Upstash APAC (ap-southeast-1) | Vercel or Railway APAC | OpenAI (no APAC region), Google Gemini (asia-east1) |

### Configuration Guidance

Data residency is configured by selecting region-specific services during deployment:

1. **Database**: Choose a managed PostgreSQL provider with the desired region.
2. **Redis**: Configure Upstash with the appropriate region.
3. **Application hosting**: Deploy to Vercel or Railway with region pinning enabled.
4. **AI providers**: Note that some AI providers (particularly OpenAI) may process data in regions outside the configured data residency. For strict data residency requirements, consider using self-hosted models (e.g., via Ollama) or providers with guaranteed data residency.

### Environment Variables for Data Residency

```env
# Database (region-specific connection string)
DATABASE_URL=postgresql://...@<region-host>:5432/ragdb

# Redis (region-specific)
UPSTASH_REDIS_REST_URL=https://<region>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>

# AI Provider (region-aware where applicable)
GOOGLE_AI_REGION=eu-west1
```

---

## Sub-Processor List

The RAG Starter Kit uses the following sub-processors to process personal data:

| Sub-Processor | Purpose | Data Processed | Region | DPA Available |
|---------------|---------|----------------|--------|---------------|
| **Vercel Inc.** | Application hosting, edge functions | Request data, environment variables, deployment logs | US, EU | [Yes](https://vercel.com/legal/dpa) |
| **Upstash Inc.** | Redis cache, rate limiting, session storage | Rate limit counters, session tokens, IP addresses | US, EU | [Yes](https://upstash.com/dpa) |
| **Cloudinary Ltd.** | Image and file storage, transformation | Uploaded images, file metadata | US, EU, APAC | [Yes](https://cloudinary.com/legal/data-processing-agreement) |
| **OpenRouter** | AI model routing and access | Chat messages, system prompts | US | Contact provider |
| **OpenAI** | AI language model inference | Chat messages, embeddings | US | [Yes](https://openai.com/policies/privacy-policy) |
| **Google (Gemini)** | AI language model inference, embeddings | Chat messages, embeddings | US, EU | [Yes](https://cloud.google.com/terms/data-processing-addendum) |
| **GitHub (Microsoft)** | OAuth authentication, source code hosting | Email, name, avatar (via OAuth) | US | [Yes](https://docs.github.com/en/site-policy/privacy-policies/github-dpa) |
| **Prisma Postgres / Supabase / Railway** | Managed PostgreSQL database | All application data | US, EU, APAC | Yes (varies by provider) |

### Sub-Processor Changes

We will notify all affected data controllers at least 30 days before adding or replacing a sub-processor. Data controllers may object to sub-processor changes in accordance with the DPA.

### Sub-Processor Due Diligence

All sub-processors are evaluated against the following criteria before engagement:
- GDPR compliance and DPA availability
- SOC 2 Type II certification (or equivalent)
- Data encryption at rest and in transit
- Data breach notification procedures
- Data residency options
- Right to audit (directly or via equivalent certifications)

---

## DPA Contact Information

For Data Processing Agreement inquiries, data subject rights requests, or compliance questions:

**Data Protection Officer**
Email: privacy@ragstarterkit.com (replace with your organization's contact)

**Security Team**
Email: security@ragstarterkit.com (replace with your organization's contact)

**Data Subject Rights Requests**
Email: dpo@ragstarterkit.com (replace with your organization's contact)
Response time: Within 30 days of receipt (as required by GDPR Article 12)

**Supervisory Authority**
The relevant supervisory authority depends on the data controller's establishment. For organizations established in the EU, the lead supervisory authority is determined by the main establishment location.

---

## Compliance Roadmap

### Implemented Controls

The following compliance controls are fully implemented and operational:

| Control | Status | Notes |
|---------|--------|-------|
| Data encryption at rest (AES-256-GCM) | Implemented | Field-level encryption with KMS support |
| Data encryption in transit (TLS) | Implemented | Enforced via HSTS |
| Authentication (MFA, OAuth, SAML) | Implemented | Multi-provider auth with TOTP MFA |
| Role-based access control | Implemented | 4 roles, 18 permissions |
| Audit logging with hash chains | Implemented | Tamper-evident, partition-aware |
| Data erasure (Right to be forgotten) | Implemented | Verified flow with token confirmation |
| Data export (Right to portability) | Implemented | JSON, CSV, PDF formats |
| Consent management | Implemented | Per-category consent tracking |
| Rate limiting | Implemented | Multi-tier with progressive penalties |
| CSRF protection | Implemented | HMAC-based double-submit cookie |
| Input validation | Implemented | Zod schemas for all endpoints |
| SSRF protection | Implemented | DNS resolution and private IP blocking |
| Account lockout | Implemented | Exponential backoff |
| Session management | Implemented | JWT with fingerprinting and revocation |
| Virus scanning | Implemented | ClamAV integration |
| CSP headers | Implemented | Per-request nonces |
| Data retention enforcement | Implemented | Tiered retention with automated cleanup |
| Sub-processor management | Implemented | Documented list with DPA tracking |

### Planned Controls

The following controls are planned for future implementation:

| Control | Status | Target | Notes |
|---------|--------|--------|-------|
| SOC 2 Type II certification | Planned | Q4 2026 | External audit engagement |
| Data Loss Prevention (DLP) | Planned | Q3 2026 | Automated PII detection in documents |
| Privacy Impact Assessment (DPIA) | In Progress | Q2 2026 | For AI-powered data processing |
| Breach notification automation | Planned | Q3 2026 | Automated 72-hour notification workflow |
| Data classification labels | Planned | Q3 2026 | Automatic sensitivity tagging |
| Consent management UI improvements | Planned | Q2 2026 | Granular consent dashboard |
| Cross-border transfer safeguards | Planned | Q3 2026 | SCCs and TIA documentation |
| Penetration testing | Planned | Q3 2026 | Annual third-party pen test |
| ISO 27001 certification | Under evaluation | 2027 | Information security management system |
