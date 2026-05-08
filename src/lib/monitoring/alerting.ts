/**
 * Alerting Module
 *
 * Handles anomaly alerts by logging CRITICAL audit events
 * and optionally sending email/webhook notifications.
 *
 * Extended with:
 * - Multi-channel alert dispatching (Slack, Email, PagerDuty, generic webhook)
 * - SLA threshold monitoring and compliance checks
 * - Alert severity-based routing
 * - Structured alert types for operational and provider-level incidents
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import type { AnomalyAlert } from './anomaly-detector';

// =============================================================================
// Existing types and configuration (preserved for backward compatibility)
// =============================================================================

export interface AlertConfig {
  webhookUrl?: string;
  emailRecipients?: string[];
}

// =============================================================================
// Alert severity & type enums
// =============================================================================

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum AlertType {
  LATENCY_DEGRADATION = 'LATENCY_DEGRADATION',
  ERROR_RATE_SPIKE = 'ERROR_RATE_SPIKE',
  EMBEDDING_PROVIDER_DOWN = 'EMBEDDING_PROVIDER_DOWN',
  LLM_PROVIDER_DOWN = 'LLM_PROVIDER_DOWN',
  COST_ANOMALY = 'COST_ANOMALY',
  SLA_BREACH = 'SLA_BREACH',
}

// =============================================================================
// Alert channel types
// =============================================================================

export enum AlertChannel {
  AUDIT_LOG = 'AUDIT_LOG',
  WEBHOOK = 'WEBHOOK',
  SLACK = 'SLACK',
  EMAIL = 'EMAIL',
  PAGERDUTY = 'PAGERDUTY',
}

// =============================================================================
// SLA threshold configuration
// =============================================================================

export interface SLAThreshold {
  /** Human-readable name of the SLA metric */
  name: string;
  /** Unique key used to look up the measured value in SLAMetrics */
  metricKey: string;
  /** Comparison operator: "lt" means the metric must be BELOW the threshold */
  operator: 'lt' | 'gt';
  /** Threshold value (compared against the metric using the operator) */
  threshold: number;
  /** Unit label for logging and alert messages */
  unit: string;
  /** Which AlertType to fire when this SLA is breached */
  alertType: AlertType;
}

export const DEFAULT_SLA_THRESHOLDS: SLAThreshold[] = [
  {
    name: 'Chat p95 Latency',
    metricKey: 'chatP95LatencyMs',
    operator: 'lt',
    threshold: 3000,
    unit: 'ms',
    alertType: AlertType.LATENCY_DEGRADATION,
  },
  {
    name: 'Ingestion p99 Latency',
    metricKey: 'ingestionP99LatencyMs',
    operator: 'lt',
    threshold: 10000,
    unit: 'ms',
    alertType: AlertType.LATENCY_DEGRADATION,
  },
  {
    name: 'Error Rate',
    metricKey: 'errorRatePercent',
    operator: 'lt',
    threshold: 1,
    unit: '%',
    alertType: AlertType.ERROR_RATE_SPIKE,
  },
  {
    name: 'Uptime',
    metricKey: 'uptimePercent',
    operator: 'gt',
    threshold: 99.5,
    unit: '%',
    alertType: AlertType.SLA_BREACH,
  },
];

// =============================================================================
// SLA metrics & compliance result types
// =============================================================================

export interface SLAMetrics {
  chatP95LatencyMs: number;
  ingestionP99LatencyMs: number;
  errorRatePercent: number;
  uptimePercent: number;
}

export interface SLABreach {
  threshold: SLAThreshold;
  currentValue: number;
  message: string;
}

export interface SLAComplianceResult {
  compliant: boolean;
  breaches: SLABreach[];
  checkedAt: Date;
}

// =============================================================================
// Structured alert type
// =============================================================================

export interface StructuredAlert {
  type: AlertType | string;
  severity: AlertSeverity;
  title: string;
  description: string;
  channel: AlertChannel;
  metadata?: Record<string, unknown>;
  userId?: string;
  workspaceId?: string;
  detectedAt: Date;
}

// =============================================================================
// Channel routing map
// =============================================================================

const SEVERITY_CHANNEL_MAP: Record<AlertSeverity, AlertChannel[]> = {
  [AlertSeverity.CRITICAL]: [AlertChannel.PAGERDUTY, AlertChannel.SLACK, AlertChannel.EMAIL],
  [AlertSeverity.HIGH]: [AlertChannel.SLACK, AlertChannel.EMAIL],
  [AlertSeverity.MEDIUM]: [AlertChannel.SLACK],
  [AlertSeverity.LOW]: [AlertChannel.AUDIT_LOG],
};

// =============================================================================
// Environment variable helpers
// =============================================================================

function getSlackWebhookUrl(): string | undefined {
  return process.env.SLACK_WEBHOOK_URL;
}

function getEmailConfig(): { apiKey: string; from: string; recipients: string[] } | undefined {
  const apiKey = process.env.EMAIL_ALERT_API_KEY; // Resend or SendGrid API key
  const from = process.env.EMAIL_ALERT_FROM || 'alerts@rag-starter-kit.example.com';
  const recipients = process.env.EMAIL_ALERT_RECIPIENTS?.split(',').map((s) => s.trim()) ?? [];
  if (!apiKey || recipients.length === 0) return undefined;
  return { apiKey, from, recipients };
}

function getPagerDutyConfig(): { routingKey: string; severity: string } | undefined {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) return undefined;
  return { routingKey, severity: 'critical' };
}

// =============================================================================
// Channel dispatchers (private)
// =============================================================================

async function dispatchToAuditLog(alert: StructuredAlert): Promise<void> {
  await logAuditEvent({
    event: AuditEvent.SUSPICIOUS_ACTIVITY,
    userId: alert.userId,
    workspaceId: alert.workspaceId,
    severity: mapAlertSeverityToAuditSeverity(alert.severity),
    metadata: {
      activity: `alert:${alert.type}`,
      title: alert.title,
      description: alert.description,
      channel: alert.channel,
      ...alert.metadata,
    },
  });
}

async function dispatchToWebhook(alert: StructuredAlert): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity}] ${alert.type}: ${alert.title}`,
        description: alert.description,
        alert,
      }),
    });
  } catch (error) {
    logger.error('Failed to send alert webhook', {
      type: alert.type,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

async function dispatchToSlack(alert: StructuredAlert): Promise<void> {
  const slackUrl = getSlackWebhookUrl();
  if (!slackUrl) {
    logger.debug('Slack webhook not configured, skipping Slack dispatch');
    return;
  }

  const emojiMap: Record<AlertSeverity, string> = {
    [AlertSeverity.CRITICAL]: ':rotating_light:',
    [AlertSeverity.HIGH]: ':warning:',
    [AlertSeverity.MEDIUM]: ':large_yellow_circle:',
    [AlertSeverity.LOW]: ':information_source:',
  };

  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emojiMap[alert.severity]} [${alert.severity}] ${alert.title}`,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: alert.description },
    },
  ];

  if (alert.metadata && Object.keys(alert.metadata).length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Details:*\n\`\`\`${JSON.stringify(alert.metadata, null, 2)}\`\`\``,
      },
    });
  }

  blocks.push({
    type: 'section' as const,
    text: {
      type: 'mrkdwn',
      text: `*Type:* ${alert.type} | *Channel:* ${alert.channel} | *Time:* ${alert.detectedAt.toISOString()}`,
    },
  });

  try {
    await fetch(slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
  } catch (error) {
    logger.error('Failed to send Slack alert', {
      type: alert.type,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

async function dispatchToEmail(alert: StructuredAlert): Promise<void> {
  const config = getEmailConfig();
  if (!config) {
    logger.debug('Email alert not configured, skipping email dispatch');
    return;
  }

  const subject = `[${alert.severity}] ${alert.title}`;
  const body = [
    `Alert Type: ${alert.type}`,
    `Severity: ${alert.severity}`,
    `Description: ${alert.description}`,
    `Time: ${alert.detectedAt.toISOString()}`,
    '',
    alert.metadata ? `Metadata:\n${JSON.stringify(alert.metadata, null, 2)}` : '',
  ].join('\n');

  try {
    // Resend API (compatible with SendGrid's send endpoint pattern)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: config.recipients,
        subject,
        text: body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Email alert delivery failed', {
        status: response.status,
        body: errorBody,
      });
    }
  } catch (error) {
    logger.error('Failed to send email alert', {
      type: alert.type,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

async function dispatchToPagerDuty(alert: StructuredAlert): Promise<void> {
  const config = getPagerDutyConfig();
  if (!config) {
    logger.debug('PagerDuty not configured, skipping PagerDuty dispatch');
    return;
  }

  try {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: config.routingKey,
        event_action: 'trigger',
        payload: {
          summary: `[${alert.severity}] ${alert.title}: ${alert.description}`,
          severity: config.severity,
          source: 'rag-starter-kit',
          component: alert.type,
          custom_details: alert.metadata ?? {},
          timestamp: alert.detectedAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    logger.error('Failed to send PagerDuty alert', {
      type: alert.type,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// =============================================================================
// Multi-channel dispatcher
// =============================================================================

const CHANNEL_DISPATCHERS: Record<AlertChannel, (alert: StructuredAlert) => Promise<void>> = {
  [AlertChannel.AUDIT_LOG]: dispatchToAuditLog,
  [AlertChannel.WEBHOOK]: dispatchToWebhook,
  [AlertChannel.SLACK]: dispatchToSlack,
  [AlertChannel.EMAIL]: dispatchToEmail,
  [AlertChannel.PAGERDUTY]: dispatchToPagerDuty,
};

/**
 * Dispatch a structured alert to all channels configured for its severity level.
 * Every alert is always written to the audit log regardless of severity.
 */
export async function dispatchStructuredAlert(alert: StructuredAlert): Promise<void> {
  const channels = SEVERITY_CHANNEL_MAP[alert.severity] ?? [AlertChannel.AUDIT_LOG];

  // Always include audit log
  const uniqueChannels = Array.from(new Set([AlertChannel.AUDIT_LOG, ...channels]));

  const results = await Promise.allSettled(
    uniqueChannels.map((channel) => {
      const dispatcher = CHANNEL_DISPATCHERS[channel];
      return dispatcher(alert);
    })
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.error('Some alert channels failed', {
      type: alert.type,
      severity: alert.severity,
      failedChannels: failures.length,
      totalChannels: uniqueChannels.length,
    });
  }

  logger.info('Structured alert dispatched', {
    type: alert.type,
    severity: alert.severity,
    channels: uniqueChannels,
    title: alert.title,
  });
}

// =============================================================================
// SLA compliance check
// =============================================================================

/**
 * Evaluate current metrics against SLA thresholds and return a compliance result.
 *
 * The `thresholds` parameter defaults to `DEFAULT_SLA_THRESHOLDS` when omitted,
 * allowing callers to supply custom thresholds for testing or per-workspace configs.
 */
export function checkSLACompliance(
  metrics: SLAMetrics,
  thresholds: SLAThreshold[] = DEFAULT_SLA_THRESHOLDS
): SLAComplianceResult {
  const breaches: SLABreach[] = [];
  const checkedAt = new Date();

  for (const sla of thresholds) {
    const currentValue = metrics[sla.metricKey as keyof SLAMetrics];
    if (currentValue === undefined) continue;

    const isBreached =
      sla.operator === 'lt'
        ? currentValue >= sla.threshold // e.g. latency must be BELOW threshold
        : currentValue < sla.threshold; // e.g. uptime must be ABOVE threshold

    if (isBreached) {
      breaches.push({
        threshold: sla,
        currentValue,
        message: `${sla.name} breached: current ${currentValue}${sla.unit}, threshold ${sla.operator === 'lt' ? '<' : '>'} ${sla.threshold}${sla.unit}`,
      });
    }
  }

  return {
    compliant: breaches.length === 0,
    breaches,
    checkedAt,
  };
}

/**
 * Run an SLA compliance check and dispatch alerts for any breaches.
 */
export async function evaluateAndAlertSLA(
  metrics: SLAMetrics,
  thresholds?: SLAThreshold[]
): Promise<SLAComplianceResult> {
  const result = checkSLACompliance(metrics, thresholds);

  if (!result.compliant) {
    for (const breach of result.breaches) {
      const alert: StructuredAlert = {
        type: breach.threshold.alertType,
        severity: AlertSeverity.HIGH,
        title: `SLA Breach: ${breach.threshold.name}`,
        description: breach.message,
        channel: AlertChannel.AUDIT_LOG,
        metadata: {
          metricKey: breach.threshold.metricKey,
          currentValue: breach.currentValue,
          thresholdValue: breach.threshold.threshold,
          unit: breach.threshold.unit,
          checkedAt: result.checkedAt.toISOString(),
        },
        detectedAt: result.checkedAt,
      };

      // Escalate to CRITICAL if multiple SLAs are breached simultaneously
      if (result.breaches.length >= 3) {
        alert.severity = AlertSeverity.CRITICAL;
      }

      await dispatchStructuredAlert(alert);
    }

    logger.warn('SLA compliance check completed with breaches', {
      breachCount: result.breaches.length,
      breachedMetrics: result.breaches.map((b) => b.threshold.metricKey),
    });
  } else {
    logger.info('SLA compliance check passed', { checkedAt: result.checkedAt.toISOString() });
  }

  return result;
}

// =============================================================================
// Severity mapping helpers
// =============================================================================

function mapAlertSeverityToAuditSeverity(
  severity: AlertSeverity
): 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return 'CRITICAL';
    case AlertSeverity.HIGH:
      return 'ERROR';
    case AlertSeverity.MEDIUM:
      return 'WARNING';
    default:
      return 'INFO';
  }
}

// =============================================================================
// Original dispatchAlert (preserved for backward compatibility)
// =============================================================================

/**
 * Process and dispatch an anomaly alert.
 *
 * Kept unchanged for backward compatibility. New code should prefer
 * `dispatchStructuredAlert` which supports multi-channel routing.
 */
export async function dispatchAlert(alert: AnomalyAlert): Promise<void> {
  // Always log as a CRITICAL audit event for the immutable trail
  await logAuditEvent({
    event: AuditEvent.SUSPICIOUS_ACTIVITY,
    userId: alert.userId,
    workspaceId: alert.workspaceId,
    severity: alert.severity,
    metadata: {
      activity: `anomaly:${alert.type}`,
      description: alert.description,
      ...alert.metadata,
    },
  });

  // Send webhook notification if configured
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${alert.severity}] ${alert.type}: ${alert.description}`,
          alert,
        }),
      });
    } catch (error) {
      logger.error('Failed to send alert webhook', {
        type: alert.type,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  logger.warn('Security alert dispatched', {
    type: alert.type,
    severity: alert.severity,
    description: alert.description,
  });
}
