import { useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);

export default function TranscriptionView({ data }) {
  const [tab, setTab] = useState('analysis');

  if (!data) return null;

  const { transcription, analysis, engine } = data;
  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'raw', label: 'Raw JSON' },
  ];

  return (
    <div className="glass transcription-view">
      <div className="section-title">
        <span className="icon">📋</span>
        {analysis?.title || 'Results'}
      </div>

      {/* Metadata badges */}
      <div className="meta-row">
        {engine && (
          <span className={`badge ${engine.includes('local') ? 'badge-local' : 'badge-cloud'}`}>
            {engine.includes('local') ? '🏠 Local' : '☁️ Cloud'} · {engine.replace(/-/g, ' ')}
          </span>
        )}
        {analysis?.type && <span className="badge badge-type">{analysis.type}</span>}
        {analysis?.duration && <span className="badge badge-type">⏱ {analysis.duration}</span>}
        {analysis?.sentiment?.overall && (
          <span className="badge badge-type">
            {analysis.sentiment.overall === 'positive' ? '😊' : analysis.sentiment.overall === 'negative' ? '😟' : '😐'}{' '}
            {analysis.sentiment.overall}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'analysis' && <AnalysisTab analysis={analysis} />}
      {tab === 'transcript' && <TranscriptTab text={transcription} />}
      {tab === 'raw' && <RawTab analysis={analysis} />}
    </div>
  );
}

function AnalysisTab({ analysis }) {
  if (!analysis) return <div className="empty-state"><div className="empty-text">No analysis available</div></div>;

  return (
    <div className="analysis-content">
      {analysis.summary && (
        <>
          <h3>📝 Summary</h3>
          <p>{analysis.summary}</p>
        </>
      )}

      {analysis.key_insights?.length > 0 && (
        <>
          <h3>💡 Key Insights</h3>
          <ul>{analysis.key_insights.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </>
      )}

      {analysis.main_points?.length > 0 && (
        <>
          <h3>📌 Main Points</h3>
          <ul>{analysis.main_points.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </>
      )}

      {analysis.action_items?.length > 0 && (
        <>
          <h3>✅ Action Items</h3>
          <ul>
            {analysis.action_items.map((item, i) => (
              <li key={i}>
                {typeof item === 'string' ? item : (
                  <>
                    <strong>[{item.priority}]</strong> {item.task}
                    {item.assignee && <em> → {item.assignee}</em>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {analysis.decisions_made?.length > 0 && (
        <>
          <h3>🎯 Decisions Made</h3>
          <ul>{analysis.decisions_made.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </>
      )}

      {analysis.follow_up_questions?.length > 0 && (
        <>
          <h3>❓ Follow-up Questions</h3>
          <ul>{analysis.follow_up_questions.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </>
      )}

      {analysis.stories_examples?.length > 0 && (
        <>
          <h3>📖 Stories & Examples</h3>
          <ul>{analysis.stories_examples.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </>
      )}

      {analysis.references?.length > 0 && (
        <>
          <h3>🔗 References</h3>
          <ul>{analysis.references.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </>
      )}

      {analysis.topics?.length > 0 && (
        <>
          <h3>🏷️ Topics</h3>
          <div className="meta-row" style={{ marginTop: 4 }}>
            {analysis.topics.map((t, i) => <span key={i} className="badge badge-type">{t}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

function TranscriptTab({ text }) {
  if (!text) return <div className="empty-state"><div className="empty-text">No transcription available</div></div>;
  return <div className="transcript-pane">{text}</div>;
}

function RawTab({ analysis }) {
  return (
    <div className="transcript-pane" style={{ padding: 0, borderRadius: '8px', maxWidth: '100%' }}>
      <SyntaxHighlighter 
        language="json" 
        style={atomOneDark}
        wrapLines={true}
        wrapLongLines={true}
        customStyle={{ margin: 0, padding: '16px', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.2)', overflowX: 'auto' }}
      >
        {JSON.stringify(analysis, null, 2)}
      </SyntaxHighlighter>
    </div>
  );
}
