import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { fetchAnalytics } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const CHART_COLORS = ['#EF3333','#059669','#3b82f6','#f59e0b','#7c3aed','#ea580c'];
const BASE_OPTS    = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

const Analytics = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="spinner-wrap"><div className="spinner" /></div></Layout>;
  if (!data)   return <Layout><div className="alert alert--error">Failed to load analytics.</div></Layout>;

  const { dailyRequests, byType, byStatus, byPriority, topShelters, avgResponseMinutes, fulfillmentRate } = data;

  // ── Chart datasets ────────────────────────────────────────────────
  const dailyChart = {
    labels:   dailyRequests.map((d) => new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Requests per Day',
      data:  dailyRequests.map((d) => d.count),
      borderColor: '#EF3333',
      backgroundColor: 'rgba(239,51,51,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#EF3333',
    }],
  };

  const typeChart = {
    labels:   byType.map((t) => t.type.toUpperCase()),
    datasets: [{ data: byType.map((t) => t.count), backgroundColor: CHART_COLORS, borderWidth: 0 }],
  };

  const statusChart = {
    labels:   byStatus.map((s) => s.status),
    datasets: [{
      label: 'Count',
      data:  byStatus.map((s) => s.count),
      backgroundColor: byStatus.map((s) => ({
        pending: '#f59e0b', assigned: '#3b82f6', accepted: '#059669',
        fulfilled: '#7c3aed', unresolved: '#EF3333', cancelled: '#9ca3af',
      }[s.status] || '#e5e7eb')),
      borderRadius: 6,
    }],
  };

  const shelterChart = {
    labels:   topShelters.map((s) => s.shelter_name),
    datasets: [
      { label: 'Fulfilled',      data: topShelters.map((s) => s.fulfilled),     backgroundColor: '#059669', borderRadius: 4 },
      { label: 'Accepted',       data: topShelters.map((s) => s.accepted),      backgroundColor: '#3b82f6', borderRadius: 4 },
      { label: 'Total Assigned', data: topShelters.map((s) => s.total_assigned),backgroundColor: '#e5e7eb', borderRadius: 4 },
    ],
  };

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">System-wide performance metrics and trends.</p>
          </div>
        </div>

        {/* KPI row */}
        <div className="stat-row" style={{ marginBottom: '2rem' }}>
          <div className="stat-card stat-card--purple">
            <div className="stat-number">{fulfillmentRate?.rate_pct ?? 0}%</div>
            <div className="stat-label">Fulfillment Rate</div>
          </div>
          <div className="stat-card stat-card--green">
            <div className="stat-number">{fulfillmentRate?.fulfilled ?? 0}</div>
            <div className="stat-label">Fulfilled</div>
          </div>
          <div className="stat-card stat-card--red">
            <div className="stat-number">{fulfillmentRate?.unresolved ?? 0}</div>
            <div className="stat-label">Unresolved</div>
          </div>
          <div className="stat-card stat-card--blue">
            <div className="stat-number">
              {avgResponseMinutes != null ? `${avgResponseMinutes}m` : '—'}
            </div>
            <div className="stat-label">Avg Response Time</div>
          </div>
        </div>

        {/* Daily requests line chart */}
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header"><h2 className="panel-title">Requests — Last 30 Days</h2></div>
          <div className="panel-body" style={{ height: '260px' }}>
            <Line data={dailyChart} options={BASE_OPTS} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* By type */}
          <div className="panel">
            <div className="panel-header"><h2 className="panel-title">By Request Type</h2></div>
            <div className="panel-body" style={{ height: '260px' }}>
              <Doughnut data={typeChart} options={{ ...BASE_OPTS, cutout: '65%' }} />
            </div>
          </div>

          {/* By status */}
          <div className="panel">
            <div className="panel-header"><h2 className="panel-title">By Status</h2></div>
            <div className="panel-body" style={{ height: '260px' }}>
              <Bar data={statusChart} options={{ ...BASE_OPTS, plugins: { ...BASE_OPTS.plugins, legend: { display: false } } }} />
            </div>
          </div>
        </div>

        {/* Top shelters */}
        {topShelters.length > 0 && (
          <div className="panel">
            <div className="panel-header"><h2 className="panel-title">Top Performing Shelters</h2></div>
            <div className="panel-body" style={{ height: '280px' }}>
              <Bar data={shelterChart} options={{ ...BASE_OPTS, scales: { x: { stacked: false }, y: { beginAtZero: true } } }} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Analytics;
