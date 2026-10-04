/** Public forecast uses actor estimates and configured potential, not engine truth. */
export const forecastRevenue = (variety, stressEstimate = 0.2) => variety.yieldPotential * variety.marketValue * Math.max(0, 1 - stressEstimate * 0.2);
