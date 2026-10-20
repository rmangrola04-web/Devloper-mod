import React, { useMemo } from 'react';
import { LoadUnloadEntry, PlanEntry, SecurityGateEntry, TrackingRecord } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsViewProps {
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  trackingRecords: TrackingRecord[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  loadEntries,
  securityLogs,
}) => {
  // Chart A: Supervisor Workload (Bar Chart)
  const supervisorWorkloadData = useMemo(() => {
    const counts: Record<string, number> = {};
    loadEntries.forEach(entry => {
      const sup = entry.operator || 'Unknown';
      counts[sup] = (counts[sup] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [
        {
          label: 'Total Vehicles Handled',
          data: Object.values(counts),
          backgroundColor: 'rgba(59, 130, 246, 0.7)', // blue-500
          borderColor: 'rgba(37, 99, 235, 1)', // blue-600
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [loadEntries]);

  // Chart B: Supervisor Efficiency & TAT (Line or Bar Chart)
  const supervisorTATData = useMemo(() => {
    const getMinutes = (timeStr?: string) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const stats: Record<string, { totalTime: number; count: number }> = {};
    
    loadEntries.forEach(entry => {
      if (entry.startTime && entry.endTime) {
        const start = getMinutes(entry.startTime);
        const end = getMinutes(entry.endTime);
        let diff = end - start;
        if (diff < 0) diff += 24 * 60; // handle midnight rollover
        
        const sup = entry.operator || 'Unknown';
        if (!stats[sup]) stats[sup] = { totalTime: 0, count: 0 };
        stats[sup].totalTime += diff;
        stats[sup].count += 1;
      }
    });

    const labels = Object.keys(stats);
    const data = labels.map(sup => {
      const s = stats[sup];
      return s.count > 0 ? Math.round(s.totalTime / s.count) : 0;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Average TAT (Minutes)',
          data,
          backgroundColor: 'rgba(16, 185, 129, 0.2)', // emerald-500
          borderColor: 'rgba(16, 185, 129, 1)',
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2,
          tension: 0.3, // smooth line
          fill: true
        },
      ],
    };
  }, [loadEntries]);

  // Chart C: Vehicle Type Distribution (Doughnut Chart)
  const vehicleTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    securityLogs.forEach(entry => {
      const type = entry.vType || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });

    return {
      labels: Object.keys(counts),
      datasets: [
        {
          label: 'Vehicle Types',
          data: Object.values(counts),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)', // blue
            'rgba(16, 185, 129, 0.8)', // emerald
            'rgba(245, 158, 11, 0.8)', // amber
            'rgba(139, 92, 246, 0.8)', // violet
            'rgba(236, 72, 153, 0.8)', // pink
            'rgba(14, 165, 233, 0.8)', // sky
            'rgba(100, 116, 139, 0.8)', // slate
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [securityLogs]);

  // Chart D: Transporter Volume (Bar Chart)
  const transporterVolumeData = useMemo(() => {
    const counts: Record<string, number> = {};
    loadEntries.forEach(entry => {
      const t = entry.transporter || 'Unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    
    // Sort by count descending and take top 10
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return {
      labels: sorted.map(s => s[0]),
      datasets: [
        {
          label: 'Total Vehicles',
          data: sorted.map(s => s[1]),
          backgroundColor: 'rgba(139, 92, 246, 0.7)', // violet
          borderColor: 'rgba(124, 58, 237, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [loadEntries]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#64748b'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(100, 116, 139, 0.1)' }
      },
      y: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(100, 116, 139, 0.1)' },
        beginAtZero: true
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#64748b'
        }
      }
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Chart A: Supervisor Workload */}
        <div className="bg-white dark:bg-[#242c3d] p-4 rounded-xl border border-slate-200 dark:border-[#3e4859] shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">
            Supervisor Workload
          </h3>
          <div className="h-64">
            <Bar data={supervisorWorkloadData} options={commonOptions} />
          </div>
        </div>

        {/* Chart B: Supervisor Efficiency & TAT */}
        <div className="bg-white dark:bg-[#242c3d] p-4 rounded-xl border border-slate-200 dark:border-[#3e4859] shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">
            Supervisor Efficiency (TAT)
          </h3>
          <div className="h-64">
            <Line data={supervisorTATData} options={commonOptions} />
          </div>
        </div>

        {/* Chart C: Vehicle Type Distribution */}
        <div className="bg-white dark:bg-[#242c3d] p-4 rounded-xl border border-slate-200 dark:border-[#3e4859] shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">
            Vehicle Type Distribution
          </h3>
          <div className="h-64 flex justify-center">
            <Doughnut data={vehicleTypeData} options={doughnutOptions} />
          </div>
        </div>

        {/* Chart D: Transporter Volume */}
        <div className="bg-white dark:bg-[#242c3d] p-4 rounded-xl border border-slate-200 dark:border-[#3e4859] shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider">
            Transporter Volume
          </h3>
          <div className="h-64">
            <Bar data={transporterVolumeData} options={commonOptions} />
          </div>
        </div>

      </div>
    </section>
  );
};
