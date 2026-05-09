import { Check, ExternalLink, Github, Mail, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// ISR: pricing rarely changes — revalidate every 24 hours
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Pricing — RAG Starter Kit',
  description:
    'RAG Starter Kit is free and open-source forever under the MIT license. Self-host with zero cost using free-tier AI providers.',
};

const features = {
  selfHosted: [
    'Full RAG pipeline (ingest, embed, retrieve, generate)',
    'Streaming SSE responses',
    'Voice input & output',
    'Multi-user workspaces with RBAC',
    'Admin dashboard & document management',
    'Agent mode (web search, calculator, code)',
    'Background job processing (Inngest)',
    'Rate limiting & audit logging',
    'OAuth (GitHub, Google) + credentials auth',
    'SAML 2.0 SSO (Okta, Azure AD)',
    'API key authentication',
    'PWA support (offline, installable)',
    'Chrome extension for browser-based RAG',
    'Multi-source ingestion (GitHub, Google Drive, Notion, Slack)',
    'E2E tests + CI/CD pipelines',
    'One-click deploy to Vercel / Railway / Render',
    'MIT License — own it completely',
  ],
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 mb-6 text-sm font-medium border border-green-500/20">
          <Zap className="h-4 w-4" />
          <span>Open Source &middot; MIT License</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
          Free Forever.
          <br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            No Strings Attached.
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          RAG Starter Kit is not a SaaS product. It&apos;s an MIT-licensed codebase you clone,
          customize, and deploy on your own infrastructure. You own the code, the data, and the
          deployment — always.
        </p>
      </div>

      {/* Pricing Card */}
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border-2 border-green-500/30 bg-card p-8 flex flex-col relative shadow-[0_0_60px_-15px_rgba(34,197,94,0.2)]">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-green-500 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
              Everything Included
            </span>
          </div>

          <div className="mb-6 mt-2">
            <h2 className="text-2xl font-bold text-foreground mb-2">Self-Hosted</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Clone the repo, configure two free API keys, and deploy. No feature gates, no trial
              periods, no vendor lock-in.
            </p>
          </div>

          <div className="mb-8">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-foreground">$0</span>
              <span className="text-muted-foreground pb-1">/ forever</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Free AI via OpenRouter + Google Gemini &middot; Run on your own infra
            </p>
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {features.selfHosted.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-3 mt-auto">
            <Button asChild className="w-full rounded-xl h-11 bg-green-600 hover:bg-green-700">
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                Clone on GitHub
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-xl h-11">
              <Link href="/demo">Try the live demo first</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Deployment Options */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">Deploy Anywhere</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              name: 'Vercel',
              description: 'One-click deploy with serverless functions and edge caching.',
              href: 'https://vercel.com',
            },
            {
              name: 'Railway',
              description: 'Managed PostgreSQL and Redis included. Deploy in minutes.',
              href: 'https://railway.app',
            },
            {
              name: 'Docker',
              description: 'Self-contained deployment with docker-compose for full control.',
              href: 'https://github.com/rejisterjack/rag-starter-kit',
            },
          ].map((option) => (
            <div
              key={option.name}
              className="rounded-xl border border-border bg-card p-6 text-center"
            >
              <h3 className="font-bold text-foreground mb-2">{option.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{option.description}</p>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href={option.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Deploy
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Need Help */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pb-24">
        <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center">
          <h3 className="text-xl font-bold text-foreground mb-3">
            Need help deploying or customizing?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Open a GitHub Discussion for community support, or reach out for paid consulting on
            custom deployments, integrations, and enterprise setups.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" className="rounded-xl h-11">
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit/discussions"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                GitHub Discussions
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl h-11">
              <Link href="mailto:hello@ragstarterkit.com">
                <Mail className="mr-2 h-4 w-4" />
                Contact for Consulting
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-8">
          {[
            {
              q: 'Is it really free?',
              a: 'Yes. The entire codebase is MIT-licensed. You clone it, deploy it to your own infrastructure, and owe nothing. The AI models it uses by default (OpenRouter free tier, Google Gemini free tier) are also free for development and moderate production usage.',
            },
            {
              q: 'What AI providers does it support?',
              a: 'By default it uses OpenRouter (free models: DeepSeek, Mistral, Llama, Gemma) for chat and Google Gemini for embeddings. You can switch to OpenAI, Anthropic Claude, or a self-hosted Ollama instance by changing a single environment variable.',
            },
            {
              q: 'Why no cloud-hosted tier?',
              a: 'RAG Starter Kit is a developer tool, not a SaaS product. The goal is to give you full ownership of your data, infrastructure, and AI pipeline. If you need managed infrastructure, the deploy guides cover Vercel, Railway, and Docker setups.',
            },
            {
              q: 'Can I use this commercially?',
              a: 'Yes. The MIT license has no restrictions on commercial use. You can build products on top of it, charge your clients for it, and white-label the UI. The only requirement is that you retain the MIT license notice in the codebase.',
            },
            {
              q: 'Is there a hosted demo I can try?',
              a: 'Yes — click "Try the live demo first" above. It\'s a fully functional instance pre-loaded with project documentation. No sign-up required. Rate-limited to 20 requests per 15 minutes.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-border/50 pb-8">
              <h3 className="font-semibold text-foreground mb-3">{q}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
