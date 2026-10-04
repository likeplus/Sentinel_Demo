import { clone, nonnegative } from './validation.js';
/** @typedef {{cash:number, forecastRevenue:number, operatingCostToDate:number, emergencyPurchases:Object[], transactions:Object[]}} FinanceState */
export function createFinance(input = {}) {
  const state = clone({ cash: 0, forecastRevenue: 0, operatingCostToDate: 0, emergencyPurchases: [], transactions: [], ...input });
  for (const key of ['cash', 'forecastRevenue', 'operatingCostToDate']) nonnegative(state[key], key);
  return state;
}
/** Idempotent operation ledger; negative cash after costs represents debt, not an automatic purchase. */
export function recordExpense(finance, { id, date, amount, sourceId, emergency = false }) {
  nonnegative(amount, 'amount');
  if (finance.transactions.some(t => t.id === id)) return clone(finance);
  const transaction = { id, date, amount: -amount, sourceId, type: emergency ? 'emergency_purchase' : 'operating_cost' };
  return { ...clone(finance), cash: finance.cash - amount,
    operatingCostToDate: finance.operatingCostToDate + amount,
    emergencyPurchases: emergency ? [...finance.emergencyPurchases, transaction] : clone(finance.emergencyPurchases),
    transactions: [...finance.transactions, transaction] };
}
