export const waterLevel = value => value == null ? 'unknown' : value >= 75 ? 'severe' : value >= 50 ? 'significant' : value >= 25 ? 'mild' : 'normal';
export const statusColor = status => ({ Normal: 'normal', Warning: 'mild', 'Significant issue': 'significant', Fault: 'severe', Unknown: 'unknown' }[status] || 'unknown');
