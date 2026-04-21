import { useEffect, useRef } from 'react';

export default function StatusFeed({ statuses }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [statuses]);

  if (!statuses.length) return null;

  return (
    <div className="glass status-feed">
      <div className="section-title">
        <span className="icon">📡</span> Live Status
      </div>
      {statuses.map((s, i) => {
        const isLast = i === statuses.length - 1;
        const isDone = s.step === 'complete';
        const isError = s.step === 'error';

        return (
          <div key={i} className="status-item">
            <div className={`status-dot ${isError ? 'error' : isDone ? 'done' : isLast ? 'active' : 'done'}`} />
            <span className="status-message">{s.message}</span>
            <span className="status-time">{s.time}</span>
          </div>
        );
      })}

      {statuses.length > 0 && statuses[statuses.length - 1].progress != null && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${statuses[statuses.length - 1].progress}%` }}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
