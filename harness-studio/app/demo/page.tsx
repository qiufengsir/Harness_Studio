'use client';

// ============================================================
// Demo Page — The "aha moment": See AI improve before your eyes
// Shows side-by-side comparison of AI responses with/without Harness configs
// ============================================================
import { useState } from 'react';
import { Bot, Sparkles, Check, X, AlertTriangle, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import { Card, CardSection, Button, Chip } from '@/components/ui';
import { useI18n } from '@/components/i18n/I18nProvider';

// API 返回的对比结果类型
interface ChatMessage {
  without: string;
  with: string;
  withScore: number;
  withoutScore: number;
}

const PRESET_QUESTIONS = [
  { q: 'Write a React component for a user profile card', cat: 'frontend' },
  { q: 'How should I implement rate limiting for this API endpoint?', cat: 'backend' },
  { q: 'Find security vulnerabilities in this authentication code', cat: 'security' },
  { q: 'Help me refactor this legacy JavaScript to TypeScript', cat: 'refactor' },
];

export default function DemoPage() {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0].q);
  const [customQuestion, setCustomQuestion] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<'compare' | 'before' | 'after'>('compare');
  // API 返回的对比结果与错误信息
  const [response, setResponse] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    const q = customQuestion.trim() || question;
    if (!q) return;

    setLoading(true);
    setShowResult(false);
    setResponse(null);
    setError(null);
    setElapsed(0);

    // 计时器：显示思考时长
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);

    try {
      // 调用后端 LLM 对比接口（无配置 vs 有 Harness 配置）
      const res = await fetch('/api/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();

      if (!data.ok) {
        // LLM 未配置或调用失败
        setError(data.error || 'LLM 调用失败，请稍后重试。');
      } else {
        setResponse({
          without: data.without,
          with: data.with,
          withoutScore: data.withoutScore,
          withScore: data.withScore,
        });
        setShowResult(true);
        setQuestion(q);
        setCustomQuestion('');
      }
    } catch (e) {
      setError((e as Error).message || '网络错误，请检查连接后重试。');
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

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
                onClick={() => { setQuestion(pq.q); setShowResult(false); setResponse(null); setError(null); }}
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

      {/* 错误提示（LLM 未配置或调用失败时显示） */}
      {error && !loading && (
        <Card className="mb-6 border-bad">
          <CardSection className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-bad/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={14} className="text-bad" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-bad">
                  {lang === 'zh' ? 'LLM 调用失败' : 'LLM Call Failed'}
                </h3>
                <p className="text-xs text-ink2 mt-1 break-words">{error}</p>
                <Button
                  variant="ghost"
                  icon={ArrowRight}
                  onClick={() => window.location.href = '/settings'}
                  className="mt-3"
                >
                  {lang === 'zh' ? '前往设置页配置密钥' : 'Go to Settings'}
                </Button>
              </div>
            </div>
          </CardSection>
        </Card>
      )}

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
      {!showResult && !error && (
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
