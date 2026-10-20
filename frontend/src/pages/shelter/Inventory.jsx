import { useEffect, useState } from 'react';
import { fetchInventory, updateInventory } from '../../api/axios';
import Layout from '../../components/Layout';
import '../../styles/layout.css';

const ITEMS = [
  { type: 'food',      label: 'Food Supplies',    unit: 'meals' },
  { type: 'water',     label: 'Drinking Water',   unit: 'litres' },
  { type: 'medicine',  label: 'Medicine/First Aid',unit: 'kits' },
  { type: 'clothing',  label: 'Clothing',         unit: 'sets' },
  { type: 'other',     label: 'Other Supplies',   unit: 'units' },
];

const LOW_THRESHOLD = 20;

const Inventory = () => {
  const [inventory, setInventory] = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState('');
  const [error, setError]         = useState('');

  useEffect(() => {
    fetchInventory()
      .then((r) => {
        const map = {};
        r.data.data.inventory.forEach((i) => { map[i.item_type] = i; });
        setInventory(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleQtyChange = (type, val) => {
    setInventory((prev) => ({
      ...prev,
      [type]: { ...(prev[type] || { item_type: type }), quantity: parseInt(val) || 0 },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const items = ITEMS.map((i) => ({
        item_type: i.type,
        quantity:  inventory[i.type]?.quantity ?? 0,
        unit:      i.unit,
      }));
      await updateInventory({ items });
      setSuccess('Inventory updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="animate-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Inventory Management</h1>
            <p className="page-subtitle">Update your shelter's available resource stock levels.</p>
          </div>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Inventory'}
          </button>
        </div>

        {success && <div className="alert alert--success"><span className="alert-mark">✓</span> {success}</div>}
        {error   && <div className="alert alert--error"><span className="alert-mark">!</span> {error}</div>}

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {ITEMS.map((item) => {
              const qty   = inventory[item.type]?.quantity ?? 0;
              const isLow = qty < LOW_THRESHOLD;
              return (
                <div
                  key={item.type}
                  className="panel"
                  style={{ marginBottom: 0, borderTop: `3px solid ${isLow ? '#EF3333' : '#059669'}` }}
                >
                  <div className="panel-header">
                    <h3 className="panel-title">{item.label}</h3>
                    {isLow && (
                      <span className="badge badge--unresolved">Low Stock</span>
                    )}
                  </div>
                  <div className="panel-body">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        value={qty}
                        onChange={(e) => handleQtyChange(item.type, e.target.value)}
                        style={{ flex: 1, fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', padding: '0.75rem' }}
                      />
                      <span style={{ color: '#9ca3af', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {item.unit}
                      </span>
                    </div>
                    {isLow && (
                      <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: '#EF3333', fontWeight: 600 }}>
                        Below minimum threshold ({LOW_THRESHOLD} {item.unit})
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Inventory;
