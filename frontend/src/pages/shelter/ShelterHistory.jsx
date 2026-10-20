import { useEffect, useState } from 'react';
import { fetchShelterHistory } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const ShelterHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShelterHistory()
      .then((r) => setHistory(r.data.data.history))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Request History</h1>
            <p className="page-subtitle">All past requests assigned to your shelter.</p>
          </div>
        </div>

        <div className="panel">
          {loading ? (
            <div className="spinner-wrap"><div className="spinner" /></div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No history yet</div>
              <div className="empty-state-sub">Accepted or rejected requests will appear here.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Victim</th>
                  <th>Your Response</th>
                  <th>Request Status</th>
                  <th>Responded</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.assignment_id}>
                    <td style={{ color: '#9ca3af', fontSize: '0.78rem' }}>#{h.request_id}</td>
                    <td><span className="badge badge--assigned">{h.type}</span></td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>{h.title}</td>
                    <td><span className={`priority--${h.priority}`}>{h.priority}</span></td>
                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{h.victim_name}</td>
                    <td>
                      <span className={`badge badge--${h.assignment_status === 'accepted' ? 'accepted' : 'unresolved'}`}>
                        {h.assignment_status}
                      </span>
                    </td>
                    <td><span className={`badge badge--${h.request_status}`}>{h.request_status}</span></td>
                    <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      {h.responded_at ? new Date(h.responded_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ShelterHistory;
