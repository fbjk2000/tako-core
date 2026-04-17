import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '../App';

export function useTokenUsage(token) {
  const [usage, setUsage] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/ai/token-usage`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setUsage(res.data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  return { usage, refresh };
}
