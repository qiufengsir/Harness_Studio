'use client';

// ============================================================
// Demo Page — The "aha moment": See AI improve before your eyes
// Shows side-by-side comparison of AI responses with/without Harness configs
// ============================================================
import { useState } from 'react';
import { Bot, Sparkles, Check, X, AlertTriangle, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import { Card, CardSection, Button, Chip } from '@/components/ui';
import { useI18n } from '@/components/i18n/I18nProvider';

interface ChatMessage {
  without: string;
  with: string;
  withScore?: number;
  withoutScore?: number;
}

const PRESET_QUESTIONS = [
  { q: 'Write a React component for a user profile card', cat: 'frontend' },
  { q: 'How should I implement rate limiting for this API endpoint?', cat: 'backend' },
  { q: 'Find security vulnerabilities in this authentication code', cat: 'security' },
  { q: 'Help me refactor this legacy JavaScript to TypeScript', cat: 'refactor' },
];

const DEMO_RESPONSES: Record<string, ChatMessage> = {
  'Write a React component for a user profile card': {
    without: `function UserProfile({ user }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <img src={user.avatar} />
    </div>
  );
}`,
    with: `interface User {
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'viewer';
}

interface UserProfileProps {
  user: User;
  showRole?: boolean;
}

export function UserProfile({ user, showRole = true }: UserProfileProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">
          {user.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
          {showRole && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
              {user.role}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}`,
    withScore: 92,
    withoutScore: 45,
  },
  'How should I implement rate limiting for this API endpoint?': {
    without: `function rateLimit(req, res, next) {
  if (req.count > 100) {
    res.status(429).send('Too many requests');
  }
  next();
}`,
    with: `import { createRateLimiter } from '@/lib/rate-limiter';

const limiter = createRateLimiter({
  max: 100,
  windowMs: 60000,
  standardHeaders: true,
});

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const { success, remaining, resetTime } = await limiter.consume(req.ip);
  
  if (!success) {
    res.setHeader('Retry-After', Math.ceil((resetTime - Date.now()) / 1000));
    return res.status(429).json({
      error: 'Rate limit exceeded',
      remaining: 0,
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    });
  }
  
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
  next();
}

// Security note: Use Redis-backed store for distributed environments`,
    withScore: 88,
    withoutScore: 25,
  },
  'Find security vulnerabilities in this authentication code': {
    without: 'The code looks fine to me.',
    with: `## Security Vulnerabilities Found

### Critical: SQL Injection
\`\`\`javascript
const query = \`SELECT * FROM users WHERE email = '\${email}'\`;
\`\`\`
**Fix:** Use parameterized queries or ORM.

### High: Plaintext Password Storage
\`\`\`javascript
user.password = password;
\`\`\`
**Fix:** Use bcrypt with 12+ rounds: \`await bcrypt.hash(password, 12)\`

### Medium: Missing Rate Limiting
No protection against brute force attacks.
**Fix:** Add rate limiting middleware.

### Low: No Session Expiry
Refresh token never expires.
**Fix:** Implement refresh token rotation.

---
**Recommended fix implemented according to your team's security standards.**`,
    withScore: 95,
    withoutScore: 10,
  },
  'Help me refactor this legacy JavaScript to TypeScript': {
    without: `interface Config {
  url: string;
}

function fetchData(config) {
  return fetch(config.url);
}`,
    with: `interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

type ApiResponse<T> = {
  data: T;
  status: number;
} | {
  error: string;
  status: number;
};

export async function fetchData<T>(
  config: ApiConfig,
  endpoint: string
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? 30000);
  
  try {
    const response = await fetch(\`\${config.baseUrl}\${endpoint}\`, {
      signal: controller.signal,
      headers: config.headers,
    });
    
    if (!response.ok) {
      return { error: response.statusText, status: response.status };
    }
    
    return { data: await response.json(), status: response.status };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error', status: 500 };
  } finally {
    clearTimeout(timeoutId);
  }
}`,
    withScore: 90,
    withoutScore: 35,
  },
};

export default function DemoPage() {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0].q);
  const [customQuestion, setCustomQuestion] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<'compare' | 'before' | 'after'>('compare');

  const handleAsk = async () => {
    const q = customQuestion.trim() || question;
    if (!q) return;
    
    setLoading(true);
    setShowResult(false);
    setElapsed(0);
    
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);
    
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    
    clearInterval(timer);
    setLoading(false);
    setShowResult(true);
    setQuestion(q);
    setCustomQuestion('');
  };

  const response = DEMO_RESPONSES[question];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 chip chip-accent mb-2">
            <Sparkles size={11} />
            <span>{t('demo.badge')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">{t('demo.title')}</h1>
          <p className="text-ink2 text-sm mt-1">{t('demo.desc')}</p>
        </div>
      </div>

      {/* Before/After Stats */}
      <Card className="mb-6 border-accent">
        <CardSection className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-bad mb-1">50%</div>
              <div className="text-xs text-ink3">{t('demo.stat.bugs')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent mb-1">80%</div>
              <div className="text-xs text-ink3">{t('demo.stat.review')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-good mb-1">3x</div>
              <div className="text-xs text-ink3">{t('demo.stat.faster')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple mb-1">90%</div>
              <div className="text-xs text-ink3">{t('demo.stat.coverage')}</div>
            </div>
          </div>
        </CardSection>
      </Card>

      {/* Input Section */}
      <Card className="mb-6">
        <CardSection>
          <h3 className="text-sm font-semibold text-ink mb-3">{t('demo.ask')}</h3>
          
          {/* Preset questions */}
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_QUESTIONS.map((pq) => (
              <button
                key={pq.q}
                onClick={() => { setQuestion(pq.q); setShowResult(false); }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  question === pq.q 
                    ? 'border-black bg-black text-white' 
                    : 'border-line hover:border-ink3'
                }`}
              >
                {pq.q}
              </button>
            ))}
          </div>
          
          {/* Custom input */}
          <div className="flex gap-2">
            <input
              className="flex-1 input"
              placeholder={t('demo.customPh')}
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <Button
              variant="primary"
              icon={loading ? RefreshCw : Sparkles}
              onClick={handleAsk}
              disabled={loading}
              className={loading ? 'animate-spin' : ''}
            >
              {loading ? t('demo.asking') : t('demo.askBtn')}
            </Button>
          </div>
          
          {/* Loading indicator */}
          {loading && (
            <div className="mt-3 text-xs text-ink3 flex items-center gap-2">
              <Clock size={12} />
              {t('demo.thinking')}... {elapsed}s
            </div>
          )}
        </CardSection>
      </Card>

      {/* Result Section */}
      {showResult && response && (
        <>
          {/* Tab switch */}
          <div className="flex gap-1 mb-4 border-b border-line">
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'compare' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
              }`}
            >
              {t('demo.tab.compare')}
            </button>
            <button
              onClick={() => setActiveTab('before')}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'before' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
              }`}
            >
              {t('demo.tab.before')}
            </button>
            <button
              onClick={() => setActiveTab('after')}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'after' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
              }`}
            >
              {t('demo.tab.after')}
            </button>
          </div>

          {/* Compare view */}
          {activeTab === 'compare' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Without */}
              <Card className="border-bad">
                <CardSection>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-bad/10 flex items-center justify-center">
                      <X size={14} className="text-bad" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-bad">{t('demo.without.title')}</h3>
                      <p className="text-xs text-ink3">{t('demo.without.desc')}</p>
                    </div>
                    <div className="ml-auto">
                      <Chip tone="bad">{response.withoutScore}%</Chip>
                    </div>
                  </div>
                  <pre className="text-xs text-ink2 bg-bg2 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                    {response.without}
                  </pre>
                </CardSection>
              </Card>

              {/* With */}
              <Card className="border-good">
                <CardSection>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-good/10 flex items-center justify-center">
                      <Check size={14} className="text-good" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-good">{t('demo.with.title')}</h3>
                      <p className="text-xs text-ink3">{t('demo.with.desc')}</p>
                    </div>
                    <div className="ml-auto">
                      <Chip tone="good">{response.withScore}%</Chip>
                    </div>
                  </div>
                  <pre className="text-xs text-ink2 bg-bg2 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                    {response.with}
                  </pre>
                </CardSection>
              </Card>
            </div>
          )}

          {/* Single view */}
          {(activeTab === 'before' || activeTab === 'after') && (
            <Card className={activeTab === 'before' ? 'border-bad' : 'border-good'}>
              <CardSection>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    activeTab === 'before' ? 'bg-bad/10' : 'bg-good/10'
                  }`}>
                    {activeTab === 'before' ? (
                      <X size={14} className="text-bad" />
                    ) : (
                      <Check size={14} className="text-good" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${activeTab === 'before' ? 'text-bad' : 'text-good'}`}>
                      {activeTab === 'before' ? t('demo.without.title') : t('demo.with.title')}
                    </h3>
                    <p className="text-xs text-ink3">
                      {activeTab === 'before' ? t('demo.without.desc') : t('demo.with.desc')}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <Chip tone={activeTab === 'before' ? 'bad' : 'good'}>
                      {activeTab === 'before' ? response.withoutScore : response.withScore}%
                    </Chip>
                  </div>
                </div>
                <pre className="text-xs text-ink2 bg-bg2 rounded-lg p-3 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                  {activeTab === 'before' ? response.without : response.with}
                </pre>
              </CardSection>
            </Card>
          )}

          {/* Key differences */}
          <Card className="mt-4">
            <CardSection>
              <h3 className="text-sm font-semibold text-ink mb-3">{t('demo.diffs.title')}</h3>
              <div className="space-y-2">
                {[
                  { icon: Check, label: t('demo.diffs.type'), desc: t('demo.diffs.typeDesc') },
                  { icon: Check, label: t('demo.diffs.safety'), desc: t('demo.diffs.safetyDesc') },
                  { icon: Check, label: t('demo.diffs.best'), desc: t('demo.diffs.bestDesc') },
                  { icon: Check, label: t('demo.diffs.error'), desc: t('demo.diffs.errorDesc') },
                ].map((diff, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-good/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <diff.icon size={10} className="text-good" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-ink">{diff.label}</span>
                      <p className="text-xs text-ink3 mt-0.5">{diff.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardSection>
          </Card>

          {/* CTA */}
          <Card className="mt-4 bg-accent/5 border-accent">
            <CardSection className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-accent">{t('demo.cta.title')}</h3>
                <p className="text-xs text-ink3 mt-1">{t('demo.cta.desc')}</p>
              </div>
              <Button variant="primary" icon={ArrowRight} onClick={() => window.location.href = '/reverse'}>
                {t('demo.cta.btn')}
              </Button>
            </CardSection>
          </Card>
        </>
      )}

      {/* Why this matters */}
      {!showResult && (
        <Card className="mb-6">
          <CardSection>
            <h3 className="text-sm font-semibold text-ink mb-3">{t('demo.why.title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-bg2">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-bad" />
                  <span className="text-xs font-semibold text-bad">{t('demo.why.p1')}</span>
                </div>
                <p className="text-xs text-ink3">{t('demo.why.p1Desc')}</p>
              </div>
              <div className="p-3 rounded-lg bg-bg2">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={14} className="text-accent" />
                  <span className="text-xs font-semibold text-accent">{t('demo.why.p2')}</span>
                </div>
                <p className="text-xs text-ink3">{t('demo.why.p2Desc')}</p>
              </div>
              <div className="p-3 rounded-lg bg-bg2">
                <div className="flex items-center gap-2 mb-2">
                  <Check size={14} className="text-good" />
                  <span className="text-xs font-semibold text-good">{t('demo.why.p3')}</span>
                </div>
                <p className="text-xs text-ink3">{t('demo.why.p3Desc')}</p>
              </div>
            </div>
          </CardSection>
        </Card>
      )}
    </div>
  );
}
