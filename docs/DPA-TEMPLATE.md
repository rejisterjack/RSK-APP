# Data Processing Agreement (DPA) Template

This Data Processing Agreement ("DPA") forms part of the Terms of Service between the parties identified below and governs the processing of personal data by the Processor on behalf of the Controller in connection with the RAG Starter Kit platform.

---

## 1. Parties

**Data Controller** ("Controller"):
- Company Name: [COMPANY NAME]
- Address: [ADDRESS]
- Contact Email: [EMAIL]
- Data Protection Officer (if applicable): [DPO NAME AND EMAIL]

**Data Processor** ("Processor"):
- Company Name: [COMPANY NAME]
- Address: [ADDRESS]
- Contact Email: [EMAIL]
- Data Protection Officer (if applicable): [DPO NAME AND EMAIL]

---

## 2. Definitions

(a) "Applicable Law" means the General Data Protection Regulation (EU) 2016/679 ("GDPR"), the UK GDPR, the Data Protection Act 2018, and any implementing or supplementary legislation, as applicable to the Processing.

(b) "Controller" means the entity identified in Section 1 that determines the purposes and means of the Processing of Personal Data.

(c) "Data Subject" means an identified or identifiable natural person to whom Personal Data relates.

(d) "Personal Data" means any information relating to an identified or identifiable natural person that is Processed by the Processor on behalf of the Controller.

(e) "Processing" means any operation or set of operations performed on Personal Data, whether or not by automated means.

(f) "Processor" means the entity identified in Section 1 that Processes Personal Data on behalf of the Controller.

(g) "Security Incident" means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data.

(h) "Sub-processor" means any third party engaged by the Processor to Process Personal Data on behalf of the Controller.

---

## 3. Scope of Processing

### 3.1 Subject Matter

The Processor provides a Retrieval-Augmented Generation (RAG) platform that enables organizations to ingest, store, search, and query documents using AI-powered chat interfaces. The Processing of Personal Data is incidental to the provision of these services.

### 3.2 Duration

This DPA remains in effect for the duration of the underlying service agreement and terminates automatically upon its expiration or termination, subject to Section 12.

### 3.3 Nature and Purpose of Processing

The Processor Processes Personal Data for the following purposes:

- Providing, maintaining, and improving the RAG Starter Kit platform
- Authenticating and authorizing users
- Processing and storing documents and chat messages
- Generating AI-powered responses to user queries
- Monitoring platform security and performance
- Providing customer support
- Complying with applicable legal obligations

### 3.4 Types of Processing

The Processing activities include: collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure by transmission, erasure, and destruction.

---

## 4. Data Subject Categories

The Personal Data processed under this DPA relates to the following categories of data subjects:

| Category | Description |
|----------|-------------|
| End Users | Individuals who use the RAG Starter Kit platform, including employees and contractors of the Controller |
| Workspace Administrators | Individuals who manage workspace settings, memberships, and billing |
| API Consumers | Individuals or systems that access the platform via API keys |
| Data Subjects in Documents | Individuals whose personal data appears within documents uploaded to the platform by the Controller's users |

---

## 5. Data Types

The following categories of Personal Data are processed:

| Category | Examples |
|----------|----------|
| **Identity Data** | Full name, email address, profile image |
| **Authentication Data** | Password hashes, OAuth tokens, MFA secrets (encrypted), session tokens |
| **Communication Data** | Chat messages, system prompts, AI-generated responses |
| **Document Data** | Uploaded documents, extracted text, document metadata |
| **Technical Data** | IP addresses, user agent strings, browser fingerprints, request logs |
| **Usage Data** | API usage records, feature usage timestamps, rate limit counters |
| **Authorization Data** | Role assignments, workspace memberships, permission grants |
| **Consent Records** | Consent type, granted/revoked status, timestamp, IP at time of consent |
| **Audit Data** | Event logs, security events, action timestamps |

**Special categories of data** (Article 9 GDPR): The platform is not designed to process special categories of personal data. The Controller is responsible for ensuring that documents uploaded to the platform do not contain special category data, or that appropriate safeguards (including explicit consent) are in place.

---

## 6. Obligations of Processor

### 6.1 Process Only on Instructions

The Processor shall Process Personal Data only on documented instructions from the Controller, including with regard to transfers of Personal Data to a third country or international organization, unless required to do so by applicable law to which the Processor is subject. In such a case, the Processor shall inform the Controller of that legal requirement before Processing, unless that law prohibits such information on important grounds of public interest.

### 6.2 Confidentiality

The Processor shall ensure that persons authorized to Process the Personal Data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.

### 6.3 Security Measures

The Processor shall implement and maintain the technical and organizational security measures described in Section 8 and in the accompanying Security Documentation (`docs/SECURITY.md`).

### 6.4 Sub-processor Engagement

The Processor may engage Sub-processors only with prior specific or general written authorization of the Controller. In the case of a general written authorization, the Processor shall inform the Controller of any intended changes concerning the addition or replacement of Sub-processors, giving the Controller the opportunity to object to such changes. The current list of Sub-processors is maintained in the Compliance Documentation (`docs/COMPLIANCE.md`).

### 6.5 Data Subject Rights Assistance

Taking into account the nature of the Processing, the Processor shall assist the Controller by appropriate technical and organizational measures, insofar as this is possible, for the fulfilment of the Controller's obligation to respond to requests for exercising the Data Subject's rights under Chapter III of the GDPR.

### 6.6 Deletion and Return

Upon termination of the service agreement, the Processor shall, at the choice of the Controller, return all Personal Data to the Controller and delete existing copies, unless applicable law requires storage of the Personal Data. The platform implements verified data erasure with timing-safe token confirmation as described in Section 9.

---

## 7. Sub-processor Management

### 7.1 Authorized Sub-processors

The Controller provides general written authorization for the Processor to engage the Sub-processors listed in the Compliance Documentation. The current list includes:

1. **Vercel Inc.** -- Application hosting and edge functions
2. **Upstash Inc.** -- Redis caching, rate limiting, and session storage
3. **Cloudinary Ltd.** -- Image and file storage and transformation
4. **OpenRouter** -- AI model routing and access
5. **OpenAI** -- AI language model inference and embeddings
6. **Google (Gemini)** -- AI language model inference and embeddings
7. **GitHub (Microsoft)** -- OAuth authentication provider
8. **Database hosting provider** (Neon, Supabase, or Railway as configured)

### 7.2 Notification of Changes

The Processor shall notify the Controller at least **30 calendar days** in advance of any intended addition to or replacement of a Sub-processor. The Controller may object to such changes by notifying the Processor in writing within **15 calendar days** of receiving the notification. If the Controller objects, the Processor shall work with the Controller to find a commercially reasonable alternative.

### 7.3 Sub-processor Obligations

The Processor shall impose the same data protection obligations as set out in this DPA on any Sub-processor by way of a contract, in particular providing sufficient guarantees to implement appropriate technical and organizational measures so that the Processing meets the requirements of the GDPR. The Processor remains fully liable to the Controller for the performance of the Sub-processor's obligations.

---

## 8. Security Measures

### 8.1 Technical Measures

The Processor implements the following technical security measures:

| Measure | Implementation |
|---------|---------------|
| **Encryption at rest** | AES-256-GCM field-level encryption with envelope encryption (AWS KMS, Azure Key Vault, GCP KMS, or local key derivation) |
| **Encryption in transit** | TLS 1.2+ for all connections; HSTS with 1-year max-age |
| **Authentication** | Multi-factor (TOTP), OAuth 2.0 (GitHub, Google), SAML 2.0 SSO, bcrypt password hashing (12 rounds) |
| **Access control** | Role-based access control with 4 roles and 18 granular permissions |
| **Session security** | JWT with session fingerprinting (browser+OS binding), Redis-backed revocation |
| **Input validation** | Zod schema validation on all endpoints, DOMPurify HTML sanitization, magic byte file validation |
| **CSRF protection** | HMAC-SHA256 double-submit cookie pattern with timing-safe comparison |
| **Rate limiting** | Upstash Redis sliding window with progressive penalties and IP blocking |
| **SSRF protection** | DNS resolution checks, private IP blocking, blocked hostname list |
| **Virus scanning** | ClamAV integration for file uploads |
| **Content Security Policy** | Per-request nonces, restricted connect-src, frame-ancestors 'none' |
| **Audit logging** | SHA-256 hash chain for tamper detection, comprehensive event coverage |

### 8.2 Organizational Measures

| Measure | Description |
|---------|-------------|
| **Access management** | Role-based access with least-privilege principle; admin actions require elevated roles |
| **Security training** | Personnel with access to Personal Data receive data protection training |
| **Incident response** | Documented security incident response procedure with defined roles and escalation paths |
| **Vulnerability management** | Regular dependency updates, automated vulnerability scanning |
| **Separation of duties** | Environment access is segregated by role (development, staging, production) |

### 8.3 Security Assessments

The Processor shall conduct or commission regular security assessments, including:
- Automated dependency vulnerability scanning on every deployment
- Annual penetration testing by a qualified third party
- Periodic review of access controls and audit log integrity (hash chain verification)

---

## 9. Data Breach Notification

### 9.1 Notification to Controller

The Processor shall notify the Controller without undue delay and no later than **48 hours** after becoming aware of a Security Incident. The notification shall include:

(a) The nature of the Security Incident, including, where possible, the categories and approximate number of Data Subjects concerned and the categories and approximate number of Personal Data records concerned.

(b) The name and contact details of the Processor's contact point from which more information can be obtained.

(c) A description of the likely consequences of the Security Incident.

(d) A description of the measures taken or proposed to be taken by the Processor to address the Security Incident, including, where appropriate, measures to mitigate its possible adverse effects.

### 9.2 Information Supplement

Where it is not possible to provide all information at the time of the initial notification, the Processor shall provide that information in phases without further undue delay.

### 9.3 Record Keeping

The Processor shall maintain a record of all Security Incidents, including the facts relating to the Security Incident, its effects, and the remedial action taken, and make it available to the Controller and supervisory authorities upon request.

### 9.4 No Delay

The Processor shall not delay notification to the Controller on the grounds that not all information is available. The Processor shall cooperate with the Controller to investigate and mitigate the Security Incident.

---

## 10. Data Subject Rights Assistance

### 10.1 Cooperation

The Processor shall assist the Controller in fulfilling its obligations to respond to Data Subject requests for exercising their rights under Articles 15 to 22 of the GDPR. The platform provides the following mechanisms:

| Right | Article | Platform Mechanism |
|-------|---------|-------------------|
| Right of access | Article 15 | Data export in JSON, CSV, and PDF formats |
| Right to rectification | Article 16 | User profile self-service editing |
| Right to erasure | Article 17 | Verified data erasure flow with token confirmation |
| Right to restriction | Article 18 | Account suspension capability |
| Right to data portability | Article 20 | Machine-readable data export |
| Right to object | Article 21 | Consent withdrawal per processing category |

### 10.2 Notification of Requests

If the Processor receives a request from a Data Subject directly, the Processor shall promptly redirect the Data Subject to the Controller and inform the Controller of such request without undue delay.

### 10.3 Erasure Flow

The platform implements a secure erasure flow:

1. User initiates erasure request (specifying `full`, `documents`, `chats`, or `account`).
2. A 32-byte cryptographic verification token is generated and stored in Redis with a 24-hour TTL.
3. The token is delivered to the user's registered email.
4. The user confirms by providing the token (verified using `timingSafeEqual`).
5. Data is deleted in dependency order; audit logs are anonymized to preserve hash chain integrity.
6. An erasure report is generated with item counts and timestamps.

---

## 11. Audit Rights

### 11.1 Right to Audit

The Controller (or a qualified third-party auditor mandated by the Controller) shall have the right to conduct audits, including inspections, to verify the Processor's compliance with this DPA. The Processor shall contribute to such audits as reasonably required.

### 11.2 Audit Procedure

(a) The Controller shall provide the Processor with at least **14 calendar days** written notice of any intended audit.

(b) Audits shall be conducted during normal business hours and in a manner that minimizes disruption to the Processor's operations.

(c) The Processor shall provide the Controller (or its auditor) with reasonable access to relevant premises, systems, records, and personnel.

### 11.3 Alternative Evidence

In lieu of an audit, the Processor may demonstrate compliance by providing:
- Current SOC 2 Type II report (or equivalent)
- Penetration test results (no more than 12 months old)
- Hash chain integrity verification results for audit logs
- Security documentation (`docs/SECURITY.md`) reflecting current implementation

### 11.4 Costs

Unless an audit reveals a material breach of this DPA by the Processor, the costs of audits shall be borne by the Controller.

---

## 12. Termination and Data Return/Deletion

### 12.1 Termination

This DPA terminates automatically upon the termination or expiration of the underlying service agreement.

### 12.2 Data Return

Upon termination, the Controller may request the return of all Personal Data processed under this DPA. The Processor shall provide the Personal Data in a structured, commonly used, and machine-readable format (JSON) within **30 calendar days** of receiving the request.

### 12.3 Data Deletion

Following the return of Personal Data (or if no return is requested), the Processor shall delete all copies of Personal Data within its systems within **90 calendar days** of termination, unless applicable law requires further retention. This includes:

- Production database records
- Redis cache entries (auto-expire via TTL)
- Backup systems (next backup cycle rotation)
- Audit logs (anonymized rather than deleted to preserve hash chain integrity)
- Third-party Sub-processor systems (subject to their retention policies)

### 12.4 Certification of Deletion

Upon written request, the Processor shall certify in writing that all Personal Data has been deleted or anonymized in accordance with this Section.

### 12.5 Survival

The obligations of confidentiality, security, and audit rights shall survive the termination of this DPA.

---

## 13. Governing Law

### 13.1 Applicable Law

This DPA shall be governed by and construed in accordance with the laws of [JURISDICTION], without regard to its conflict of law principles.

### 13.2 Dispute Resolution

Any disputes arising out of or in connection with this DPA shall be subject to the exclusive jurisdiction of the courts of [JURISDICTION].

### 13.3 EU-Specific Provisions

Where the Controller is established in the European Union:
- The competent supervisory authority shall be [SUPERVISORY AUTHORITY].
- This DPA incorporates Standard Contractual Clauses (SCCs) as set out in Commission Decision 2021/914, Module Two (Controller to Processor), where required for international data transfers.

### 13.4 UK-Specific Provisions

Where the Controller is subject to the UK GDPR:
- The International Data Transfer Addendum to the EU Commission Standard Contractual Clauses issued by the UK Information Commissioner under Section 119A of the Data Protection Act 2018 shall apply where required for international data transfers.

---

## 14. Amendments

This DPA may be amended only by written agreement of both parties. Any amendments to reflect changes in applicable data protection law shall be proposed by the Processor and accepted by the Controller within 30 days of notification.

---

## 15. Signatures

This Data Processing Agreement is entered into by the parties as of the date last signed below.

**DATA CONTROLLER**

Signature: _________________________

Name: _________________________

Title: _________________________

Date: _________________________

**DATA PROCESSOR**

Signature: _________________________

Name: _________________________

Title: _________________________

Date: _________________________

---

## Annex I: Technical and Organizational Measures

Refer to `docs/SECURITY.md` for the complete and current description of technical and organizational security measures implemented by the Processor. Key measures include:

1. AES-256-GCM field-level encryption with envelope encryption and KMS integration
2. TLS 1.2+ for all data in transit with HSTS enforcement
3. Multi-factor authentication (TOTP) with encrypted secrets
4. Role-based access control (4 roles, 18 permissions)
5. HMAC-based CSRF protection with timing-safe comparison
6. Upstash Redis sliding window rate limiting with progressive penalties
7. SHA-256 hash chain audit logging with tamper detection
8. Zod schema input validation on all API endpoints
9. SSRF protection with DNS resolution checks
10. ClamAV virus scanning for file uploads
11. Per-request CSP nonces
12. Session fingerprinting and Redis-backed session revocation
13. Account lockout with exponential backoff
14. Audit log integrity verification via hash chain

## Annex II: Sub-Processor List

Refer to `docs/COMPLIANCE.md` Section "Sub-Processor List" for the current and complete list of Sub-processors, including their processing purposes, data categories, and regional availability.

## Annex III: Standard Contractual Clauses

Where applicable, the Standard Contractual Clauses (Commission Implementing Decision (EU) 2021/914) are incorporated by reference. Module Two (Controller to Processor) applies. The clauses are completed as follows:

- Clause 7 (Docking clause): Not included
- Clause 9(a) (Sub-processor authorization): Option 2 (General written authorization)
- Clause 11 (Redress): Optional clause not included
- Clause 13 and Annex I.C (Competent Supervisory Authority): As identified in Section 13.3
- Clause 17 (Governing law): As identified in Section 13.1
- Clause 18 (Choice of forum and jurisdiction): As identified in Section 13.2
