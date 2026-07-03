// ============================================================
// Industry Knowledge Base — pre-built industry templates
// Each industry defines:
//   - agentRoster: recommended agent roles for this industry
//   - complianceRules: must-have checks (e.g. HIPAA, PCI)
//   - techStackHints: typical stack, used when context is sparse
//   - promptSuffix: extra instructions appended to each agent's
//     system prompt so all agents respect industry constraints
// ============================================================

export interface IndustryAgent {
  label: string;
  agent: string;
  role: 'leader' | 'worker' | 'reviewer' | 'security' | 'tester' | 'doc-writer' | 'router' | 'specialist' | 'merge';
  description: string;
}

export interface IndustryTemplate {
  id: string;
  name: string;
  keywords: string[];          // for matching
  agentRoster: IndustryAgent[];
  complianceRules: string[];
  techStackHints: string[];
  promptSuffix: string;        // appended to every agent prompt in this industry
  recommendedPatterns: string[]; // pattern ids that fit this industry
}

const TEMPLATES: IndustryTemplate[] = [
  // ---------- Financial ----------
  {
    id: 'financial',
    name: 'Financial / Fintech',
    keywords: ['financial', 'fintech', 'banking', 'payment', 'trading', 'audit', 'pci', 'sox'],
    agentRoster: [
      { label: 'Compliance Officer', agent: 'compliance-officer', role: 'reviewer', description: 'PCI-DSS, SOX, KYC checks' },
      { label: 'Transaction Engineer', agent: 'transaction-engineer', role: 'worker', description: 'Idempotent payment flows, ledger' },
      { label: 'Security Auditor', agent: 'security-auditor', role: 'security', description: 'Encryption at rest/in transit, key rotation' },
      { label: 'Audit Logger', agent: 'audit-logger', role: 'worker', description: 'Immutable audit trails, tamper detection' },
      { label: 'Risk Analyst', agent: 'risk-analyst', role: 'specialist', description: 'Fraud detection, rate limits, exposure' },
      { label: 'Orchestrator', agent: 'orchestrator', role: 'leader', description: 'Plan + dispatch + assemble' },
    ],
    complianceRules: [
      'Never log full card numbers or CVVs — mask to last 4',
      'All money operations must be idempotent (use idempotency keys)',
      'Audit log every state change with actor + timestamp + before/after',
      'Encrypt PII at rest with AES-256, keys in KMS not env vars',
      'Rate-limit sensitive endpoints (auth, transfer, withdrawal)',
    ],
    techStackHints: ['PostgreSQL', 'Redis', 'Kafka', 'Vault', 'TypeScript'],
    promptSuffix:
      'INDUSTRY: Financial. Treat every change as money-moving. ' +
      'Prefer idempotency keys, audit logs, and explicit error handling over silent retries. ' +
      'Never suggest storing raw card data — always tokenize.',
    recommendedPatterns: ['pipeline', 'worker-leader'],
  },

  // ---------- Ecommerce ----------
  {
    id: 'ecommerce',
    name: 'Ecommerce / Retail',
    keywords: ['ecommerce', 'e-commerce', 'shop', 'store', 'cart', 'checkout', 'merch', 'inventory'],
    agentRoster: [
      { label: 'Catalog Engineer', agent: 'catalog-engineer', role: 'worker', description: 'Product schema, search, facets' },
      { label: 'Cart & Checkout', agent: 'checkout-engineer', role: 'worker', description: 'Cart state, payment, order lifecycle' },
      { label: 'Inventory Sync', agent: 'inventory-sync', role: 'worker', description: 'Stock levels, reservations, warehouse' },
      { label: 'Performance Engineer', agent: 'perf-engineer', role: 'specialist', description: 'Caching, CDN, slow query hunting' },
      { label: 'A/B Test Runner', agent: 'ab-test-runner', role: 'tester', description: 'Experiment setup, metric tracking' },
      { label: 'Orchestrator', agent: 'orchestrator', role: 'leader', description: 'Plan + dispatch + assemble' },
    ],
    complianceRules: [
      'Cache invalidation must cover CDN + app + search index',
      'Cart must survive session expiry (persist server-side)',
      'Inventory reservations must expire (no permanent holds)',
      'Payment failures must roll back inventory reservations',
    ],
    techStackHints: ['Next.js', 'Redis', 'Elasticsearch', 'Stripe', 'PostgreSQL'],
    promptSuffix:
      'INDUSTRY: Ecommerce. Optimize for conversion and speed. ' +
      'Cache aggressively but invalidate correctly. Treat checkout as the critical path — every ms costs revenue.',
    recommendedPatterns: ['worker-leader', 'parallel'],
  },

  // ---------- IoT ----------
  {
    id: 'iot',
    name: 'IoT / Embedded',
    keywords: ['iot', 'device', 'sensor', 'mqtt', 'edge', 'embedded', 'firmware'],
    agentRoster: [
      { label: 'Device Protocol Engineer', agent: 'device-protocol', role: 'worker', description: 'MQTT, CoAP, binary protocols' },
      { label: 'Edge Runtime Engineer', agent: 'edge-runtime', role: 'worker', description: 'Device code, OTA updates' },
      { label: 'Data Pipeline Engineer', agent: 'data-pipeline', role: 'worker', description: 'Telemetry ingestion, time-series' },
      { label: 'Security Auditor', agent: 'security-auditor', role: 'security', description: 'Device auth, cert rotation' },
      { label: 'Connectivity Specialist', agent: 'connectivity-specialist', role: 'specialist', description: 'Offline queueing, reconnect' },
      { label: 'Orchestrator', agent: 'orchestrator', role: 'leader', description: 'Plan + dispatch + assemble' },
    ],
    complianceRules: [
      'Devices must authenticate with per-device certs, not shared keys',
      'Telemetry must buffer locally when offline, sync on reconnect',
      'OTA updates must be signed and rollback-safe',
      'Time-series data must handle out-of-order arrival',
    ],
    techStackHints: ['MQTT', 'InfluxDB', 'Rust', 'C++', 'Python'],
    promptSuffix:
      'INDUSTRY: IoT. Devices are unreliable: assume flaky network, limited memory, slow clock. ' +
      'Design for offline-first, batched sync, and graceful degradation.',
    recommendedPatterns: ['pipeline', 'worker-leader'],
  },

  // ---------- Healthcare ----------
  {
    id: 'healthcare',
    name: 'Healthcare / HIPAA',
    keywords: ['healthcare', 'medical', 'hipaa', 'patient', 'clinic', 'hospital', 'phi', 'ehr'],
    agentRoster: [
      { label: 'HIPAA Compliance Officer', agent: 'hipaa-officer', role: 'reviewer', description: 'PHI handling, access logs' },
      { label: 'Clinical Data Engineer', agent: 'clinical-data', role: 'worker', description: 'FHIR, HL7, EHR integration' },
      { label: 'Security Auditor', agent: 'security-auditor', role: 'security', description: 'Encryption, access control, BAAs' },
      { label: 'Audit Logger', agent: 'audit-logger', role: 'worker', description: 'Access logs, break-glass tracking' },
      { label: 'Patient Privacy Specialist', agent: 'privacy-specialist', role: 'specialist', description: 'De-identification, consent' },
      { label: 'Orchestrator', agent: 'orchestrator', role: 'leader', description: 'Plan + dispatch + assemble' },
    ],
    complianceRules: [
      'PHI must be encrypted at rest and in transit — no exceptions',
      'Every PHI access must be logged with user, purpose, timestamp',
      'Minimum necessary: agents should request only the fields they need',
      'Break-glass access must trigger alert + post-hoc review',
      'De-identification must follow Safe Harbor or Expert Determination',
    ],
    techStackHints: ['FHIR', 'PostgreSQL', 'Vault', 'HL7', 'Node.js'],
    promptSuffix:
      'INDUSTRY: Healthcare (HIPAA). PHI is sacred. ' +
      'Log every access, encrypt everything, request minimum necessary. ' +
      'When in doubt, deny access and ask the compliance officer.',
    recommendedPatterns: ['pipeline', 'worker-leader'],
  },

  // ---------- Data / ML ----------
  {
    id: 'data',
    name: 'Data / ML / Analytics',
    keywords: ['data', 'analytics', 'pipeline', 'etl', 'warehouse', 'ml', 'machine learning', 'model', 'training'],
    agentRoster: [
      { label: 'Data Engineer', agent: 'data-engineer', role: 'worker', description: 'ETL, schemas, partitions' },
      { label: 'ML Engineer', agent: 'ml-engineer', role: 'worker', description: 'Training, evaluation, model registry' },
      { label: 'Analyst', agent: 'analyst', role: 'specialist', description: 'Metrics, dashboards, ad-hoc SQL' },
      { label: 'Viz Designer', agent: 'viz-designer', role: 'worker', description: 'Dashboards, charts, UX' },
      { label: 'Data Quality Reviewer', agent: 'data-quality', role: 'reviewer', description: 'Schema drift, nulls, freshness' },
      { label: 'Orchestrator', agent: 'orchestrator', role: 'leader', description: 'Plan + dispatch + assemble' },
    ],
    complianceRules: [
      'Pipelines must be idempotent — re-runs produce the same output',
      'Schema changes must be backward-compatible or staged',
      'Model artifacts must be versioned with their training data hash',
      'Dashboards must declare their data freshness SLA',
    ],
    techStackHints: ['Python', 'dbt', 'Airflow', 'Spark', 'DuckDB', 'Pandas'],
    promptSuffix:
      'INDUSTRY: Data/ML. Prefer idempotent pipelines and explicit schemas. ' +
      'Version every artifact (data, model, dashboard). Never silently drop rows — log and alert.',
    recommendedPatterns: ['pipeline', 'parallel'],
  },

  // ---------- Generic Web (fallback) ----------
  {
    id: 'web',
    name: 'General Web App',
    keywords: ['web', 'app', 'saas', 'dashboard', 'admin'],
    agentRoster: [
      { label: 'Frontend Worker', agent: 'frontend-architect', role: 'worker', description: 'UI components + state' },
      { label: 'Backend Worker', agent: 'backend-api', role: 'worker', description: 'API routes + data layer' },
      { label: 'Test Engineer', agent: 'test-engineer', role: 'tester', description: 'Test plan + execution' },
      { label: 'Doc Writer', agent: 'doc-writer', role: 'doc-writer', description: 'API + user docs' },
      { label: 'Orchestrator', agent: 'orchestrator', role: 'leader', description: 'Plan + dispatch + assemble' },
    ],
    complianceRules: [
      'All user input must be validated and sanitized',
      'Auth checks must cover every protected route',
      'Error responses must not leak stack traces in production',
    ],
    techStackHints: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    promptSuffix: '',
    recommendedPatterns: ['worker-leader', 'pipeline'],
  },
];

/** Match an industry by free text. Returns null if no match. */
export function matchIndustry(text: string): IndustryTemplate | null {
  const lower = text.toLowerCase();
  let best: { tpl: IndustryTemplate; score: number } | null = null;
  for (const tpl of TEMPLATES) {
    let score = 0;
    for (const kw of tpl.keywords) {
      if (lower.includes(kw)) score += kw.length; // longer match = stronger
    }
    if (score > 0 && (!best || score > best.score)) best = { tpl, score };
  }
  return best?.tpl ?? null;
}

export function getIndustry(id: string): IndustryTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export function listIndustries(): IndustryTemplate[] {
  return TEMPLATES;
}

export function fallbackIndustry(): IndustryTemplate {
  return TEMPLATES.find((t) => t.id === 'web')!;
}
