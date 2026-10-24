import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  Calendar,
  Settings,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Share2,
  RotateCcw,
  ShieldCheck,
  Bell,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Edit3,
  Check,
  X,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Sliders,
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Lock,
  Unlock,
  Info,
  Users,
  Clock,
  Calculator,
  Table,
  ArrowRightLeft,
  AlertTriangle
} from 'lucide-react';

/**
 * ============================================================================
 * 1. DEXIE.JS-COMPATIBLE INDEXEDDB ENGINE & STORAGE SAFEGUARDS
 * ============================================================================
 */
class DexieTable {
  constructor(dbName, tableName, schema, onMutate) {
    this.dbName = dbName;
    this.tableName = tableName;
    this.schema = schema;
    this.onMutate = onMutate;
    this.storageKey = `${dbName}__${tableName}`;
  }

  _openIDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(this.dbName, 3);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          ['accounts', 'monthly_budgets', 'annual_expenses', 'transactions', 'settings'].forEach((t) => {
            if (!db.objectStoreNames.contains(t)) {
              db.createObjectStore(t, { keyPath: 'id' });
            }
          });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  _readFallback() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  _writeFallback(rows) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rows));
    } catch (e) {
      // Ignore quota errors in private browsing
    }
  }

  async toArray() {
    const idb = await this._openIDB();
    if (idb) {
      try {
        const items = await new Promise((resolve, reject) => {
          const tx = idb.transaction(this.tableName, 'readonly');
          const store = tx.objectStore(this.tableName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        if (items && items.length > 0) {
          this._writeFallback(items);
          return items;
        }
      } catch (e) {
        // Fallback to localStorage mirror
      }
    }
    return this._readFallback();
  }

  async get(id) {
    const all = await this.toArray();
    return all.find((item) => item.id === id) || null;
  }

  async put(item) {
    const record = {
      ...item,
      id: item.id || `${this.tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      updatedAt: item.updatedAt || new Date().toISOString()
    };
    const all = await this.toArray();
    const idx = all.findIndex((r) => r.id === record.id);
    const updated = idx >= 0 ? all.map((r, i) => (i === idx ? record : r)) : [...all, record];
    this._writeFallback(updated);

    const idb = await this._openIDB();
    if (idb) {
      try {
        await new Promise((resolve) => {
          const tx = idb.transaction(this.tableName, 'readwrite');
          tx.objectStore(this.tableName).put(record);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        // Fallback already persisted
      }
    }
    if (this.onMutate) this.onMutate(this.tableName);
    return record.id;
  }

  async add(item) {
    return this.put(item);
  }

  async update(id, changes) {
    const existing = await this.get(id);
    if (!existing) return 0;
    await this.put({ ...existing, ...changes, id, updatedAt: new Date().toISOString() });
    return 1;
  }

  async bulkPut(items) {
    const existing = await this.toArray();
    const map = new Map(existing.map((i) => [i.id, i]));
    for (const raw of items) {
      const id = raw.id || `${this.tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const current = map.get(id);
      if (!current || !current.updatedAt || !raw.updatedAt || new Date(raw.updatedAt) >= new Date(current.updatedAt)) {
        map.set(id, { ...current, ...raw, id, updatedAt: raw.updatedAt || new Date().toISOString() });
      }
    }
    const merged = Array.from(map.values());
    this._writeFallback(merged);

    const idb = await this._openIDB();
    if (idb) {
      try {
        await new Promise((resolve) => {
          const tx = idb.transaction(this.tableName, 'readwrite');
          const store = tx.objectStore(this.tableName);
          merged.forEach((rec) => store.put(rec));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        // Fallback already persisted
      }
    }
    if (this.onMutate) this.onMutate(this.tableName);
    return merged.length;
  }

  async delete(id) {
    const all = await this.toArray();
    const filtered = all.filter((r) => r.id !== id);
    this._writeFallback(filtered);

    const idb = await this._openIDB();
    if (idb) {
      try {
        await new Promise((resolve) => {
          const tx = idb.transaction(this.tableName, 'readwrite');
          tx.objectStore(this.tableName).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        // Fallback already persisted
      }
    }
    if (this.onMutate) this.onMutate(this.tableName);
  }

  async clear() {
    this._writeFallback([]);
    const idb = await this._openIDB();
    if (idb) {
      try {
        await new Promise((resolve) => {
          const tx = idb.transaction(this.tableName, 'readwrite');
          tx.objectStore(this.tableName).clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        // Fallback already cleared
      }
    }
    if (this.onMutate) this.onMutate(this.tableName);
  }
}

class DexieDatabase {
  constructor(name) {
    this.name = name;
    this.listeners = new Set();
    const notify = () => this.listeners.forEach((fn) => fn());
    this.accounts = new DexieTable(name, 'accounts', 'id, name, type, institution, owner, balance, interestRate, isUntouchable, lastUpdatedDate, updatedAt', notify);
    this.monthly_budgets = new DexieTable(name, 'monthly_budgets', 'id, month, flow, category, owner, planned, actual, destinationAccountId, notes, updatedAt', notify);
    this.annual_expenses = new DexieTable(name, 'annual_expenses', 'id, year, category, title, amount, date, status, notes, updatedAt', notify);
    this.transactions = new DexieTable(name, 'transactions', 'id, type, year, month, weekStart, category, amount, date, note, deductFromSavings, updatedAt', notify);
    this.settings = new DexieTable(name, 'settings', 'id, key, value, updatedAt', notify);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const db = new DexieDatabase('HouseholdFinanceDB_v3');

/**
 * ============================================================================
 * 2. INITIAL DEMO DATA (Real Partner Names, Multi-Month Savings History for Auto-Velocity)
 * ============================================================================
 */
const DEFAULT_WIDGET_LAYOUT = [
  { id: 'total_savings', title: 'Total Savings & Asset Allocation', colSpan: 7, minHeight: 280, order: 0 },
  { id: 'savings_velocity', title: 'Savings Velocity & Future Predictor', colSpan: 5, minHeight: 280, order: 1 },
  { id: 'upcoming_annual', title: 'Upcoming Annual Payments & Coverage', colSpan: 12, minHeight: 230, order: 2 },
  { id: 'annual_expenditures', title: 'Annual / One-Time Expenditures', colSpan: 7, minHeight: 400, order: 3 },
  { id: 'weekly_adjustment', title: 'Weekly Variance Adjustment', colSpan: 5, minHeight: 400, order: 4 }
];

const INITIAL_ACCOUNTS = [
  {
    id: 'acc_monzo_safety',
    name: 'Monzo Cash ISA (Emergency Fund)',
    institution: 'Monzo',
    type: 'Cash ISA',
    owner: 'Alex',
    balance: 18500,
    interestRate: 4.6,
    isUntouchable: true,
    lastUpdatedDate: '2026-10-18',
    color: '#10b981',
    updatedAt: '2026-10-18T09:00:00.000Z'
  },
  {
    id: 'acc_vanguard_isa',
    name: 'Vanguard FTSE Global Shares ISA',
    institution: 'Vanguard',
    type: 'Shares ISA',
    owner: 'Sam',
    balance: 36400,
    interestRate: 7.2,
    isUntouchable: true,
    lastUpdatedDate: '2026-09-12',
    color: '#6366f1',
    updatedAt: '2026-09-12T09:00:00.000Z'
  },
  {
    id: 'acc_monzo_annual',
    name: 'Monzo Annual Sinking & Car Pot',
    institution: 'Monzo',
    type: 'Cash Pot',
    owner: 'Joint',
    balance: 6850,
    interestRate: 4.1,
    isUntouchable: false,
    lastUpdatedDate: '2026-10-22',
    color: '#06b6d4',
    updatedAt: '2026-10-22T09:00:00.000Z'
  },
  {
    id: 'acc_joint_bills',
    name: 'Starling Joint Household Reserve',
    institution: 'Starling',
    type: 'Joint Account',
    owner: 'Joint',
    balance: 4920,
    interestRate: 3.25,
    isUntouchable: false,
    lastUpdatedDate: '2026-10-24',
    color: '#f59e0b',
    updatedAt: '2026-10-24T09:00:00.000Z'
  }
];

const INITIAL_MONTHLY_BUDGETS = [
  // Prior FY 2026 Months (Apr–Sep 2026) so YTD Savings Till Date is 100% auto-computed from actual sheet data!
  { id: 'mb_apr_sav', month: '2026-04', flow: 'savings_transfer', category: 'April Combined ISA & Pot Transfers', owner: 'Joint', planned: 2550, actual: 2550, destinationAccountId: 'acc_vanguard_isa', notes: 'FY26 Month 1', updatedAt: '2026-04-25T09:00:00.000Z' },
  { id: 'mb_may_sav', month: '2026-05', flow: 'savings_transfer', category: 'May Combined ISA & Pot Transfers', owner: 'Joint', planned: 2600, actual: 2600, destinationAccountId: 'acc_vanguard_isa', notes: 'FY26 Month 2', updatedAt: '2026-05-25T09:00:00.000Z' },
  { id: 'mb_jun_sav', month: '2026-06', flow: 'savings_transfer', category: 'June Combined ISA & Pot Transfers', owner: 'Joint', planned: 2600, actual: 2600, destinationAccountId: 'acc_vanguard_isa', notes: 'FY26 Month 3', updatedAt: '2026-06-25T09:00:00.000Z' },
  { id: 'mb_jul_sav', month: '2026-07', flow: 'savings_transfer', category: 'July Combined ISA & Pot Transfers', owner: 'Joint', planned: 2650, actual: 2650, destinationAccountId: 'acc_vanguard_isa', notes: 'FY26 Month 4', updatedAt: '2026-07-25T09:00:00.000Z' },
  { id: 'mb_aug_sav', month: '2026-08', flow: 'savings_transfer', category: 'August Combined ISA & Pot Transfers', owner: 'Joint', planned: 2650, actual: 2650, destinationAccountId: 'acc_vanguard_isa', notes: 'FY26 Month 5', updatedAt: '2026-08-25T09:00:00.000Z' },
  { id: 'mb_sep_sav', month: '2026-09', flow: 'savings_transfer', category: 'September Combined ISA & Pot Transfers', owner: 'Joint', planned: 2650, actual: 2650, destinationAccountId: 'acc_vanguard_isa', notes: 'FY26 Month 6 (Last Month)', updatedAt: '2026-09-25T09:00:00.000Z' },

  // October 2026 (Current Month)
  { id: 'mb_savings_core', month: '2026-10', flow: 'income', category: 'Alex Net Salary', owner: 'Alex', planned: 3600, actual: 3600, destinationAccountId: 'acc_joint_bills', notes: 'Paid 24th', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_groceries', month: '2026-10', flow: 'income', category: 'Sam Net Salary', owner: 'Sam', planned: 3150, actual: 3150, destinationAccountId: 'acc_joint_bills', notes: 'Paid 28th', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_mortgage', month: '2026-10', flow: 'fixed_outflow', category: 'Mortgage & Council Tax', owner: 'Joint', planned: 1950, actual: 1950, destinationAccountId: 'acc_joint_bills', notes: '1st of month DD', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_utilities', month: '2026-10', flow: 'fixed_outflow', category: 'Energy, Fibre, Water & Nursery', owner: 'Joint', planned: 820, actual: 810, destinationAccountId: 'acc_joint_bills', notes: 'Direct debits', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_oct_var_1', month: '2026-10', flow: 'variable_outflow', category: 'Groceries, Fuel & Household', owner: 'Joint', planned: 780, actual: 780, destinationAccountId: 'acc_joint_bills', notes: 'Weekly budget £195/wk', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_oct_sav_1', month: '2026-10', flow: 'savings_transfer', category: 'Vanguard Shares ISA Transfer', owner: 'Sam', planned: 1400, actual: 1400, destinationAccountId: 'acc_vanguard_isa', notes: 'Long-term wealth (Untouchable)', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_oct_sav_2', month: '2026-10', flow: 'savings_transfer', category: 'Monzo Annual Sinking Pot Transfer', owner: 'Joint', planned: 750, actual: 750, destinationAccountId: 'acc_monzo_annual', notes: 'Spendable annual pool', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_oct_sav_3', month: '2026-10', flow: 'savings_transfer', category: 'Monzo Cash ISA Top-up', owner: 'Alex', planned: 500, actual: 500, destinationAccountId: 'acc_monzo_safety', notes: 'Emergency reserve', updatedAt: '2026-10-01T09:00:00.000Z' },

  // November 2026
  { id: 'mb_nov_inc_1', month: '2026-11', flow: 'income', category: 'Alex Net Salary', owner: 'Alex', planned: 3600, actual: 3600, destinationAccountId: 'acc_joint_bills', notes: 'Projected Nov payday', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_nov_inc_2', month: '2026-11', flow: 'income', category: 'Sam Net Salary', owner: 'Sam', planned: 3150, actual: 3150, destinationAccountId: 'acc_joint_bills', notes: 'Projected Nov payday', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_nov_fix_1', month: '2026-11', flow: 'fixed_outflow', category: 'Mortgage & Council Tax', owner: 'Joint', planned: 1950, actual: 1950, destinationAccountId: 'acc_joint_bills', notes: '1st of month DD', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_nov_fix_2', month: '2026-11', flow: 'fixed_outflow', category: 'Energy, Fibre, Water & Nursery', owner: 'Joint', planned: 840, actual: 840, destinationAccountId: 'acc_joint_bills', notes: 'Winter tariff adjustment', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_nov_var_1', month: '2026-11', flow: 'variable_outflow', category: 'Groceries, Fuel & Household', owner: 'Joint', planned: 800, actual: 800, destinationAccountId: 'acc_joint_bills', notes: 'November allocation', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_nov_sav_1', month: '2026-11', flow: 'savings_transfer', category: 'Vanguard Shares ISA Transfer', owner: 'Sam', planned: 1400, actual: 1400, destinationAccountId: 'acc_vanguard_isa', notes: 'Automated after payday', updatedAt: '2026-10-01T09:00:00.000Z' },
  { id: 'mb_nov_sav_2', month: '2026-11', flow: 'savings_transfer', category: 'Monzo Annual Sinking Pot Transfer', owner: 'Joint', planned: 850, actual: 850, destinationAccountId: 'acc_monzo_annual', notes: 'Pre-funding winter car & gifts', updatedAt: '2026-10-01T09:00:00.000Z' }
];

const INITIAL_ANNUAL_EXPENSES = [
  { id: 'ae_baby_1', year: 2026, category: 'Baby Spending', title: 'Nappies & Bulk Wipes', amount: 10, date: '2026-01-01', status: 'paid', notes: 'Costco bulk pack', updatedAt: '2026-01-01T10:00:00.000Z' },
  { id: 'ae_baby_2', year: 2026, category: 'Baby Spending', title: 'Winter Sleepsuits & Clothes', amount: 20, date: '2026-01-05', status: 'paid', notes: 'Next baby bundle', updatedAt: '2026-01-05T10:00:00.000Z' },
  { id: 'ae_baby_3', year: 2026, category: 'Baby Spending', title: 'Formula Top-up', amount: 1, date: '2026-02-02', status: 'paid', notes: 'Voucher redemption difference', updatedAt: '2026-02-02T10:00:00.000Z' },
  { id: 'ae_baby_4', year: 2026, category: 'Baby Spending', title: 'ISOFIX Car Seat Stage 2', amount: 300, date: '2026-03-14', status: 'paid', notes: 'John Lewis nursery', updatedAt: '2026-03-14T10:00:00.000Z' },

  { id: 'ae_car_1', year: 2026, category: 'Car Maintenance', title: 'Annual Full Service & MOT', amount: 285, date: '2026-02-18', status: 'paid', notes: 'Local garage', updatedAt: '2026-02-18T10:00:00.000Z' },
  { id: 'ae_car_2', year: 2026, category: 'Car Maintenance', title: '2x Michelin All-Season Tyres', amount: 260, date: '2026-06-09', status: 'paid', notes: 'Front axle replacement', updatedAt: '2026-06-09T10:00:00.000Z' },

  { id: 'ae_car_3', year: 2026, category: 'Car Maintenance', title: 'Comprehensive Multi-Car Insurance Renewal', amount: 640, date: '2026-11-12', status: 'upcoming', notes: 'Pay annually to save 14% APR', updatedAt: '2026-10-01T10:00:00.000Z' },
  { id: 'ae_home_1', year: 2026, category: 'Home & Property', title: 'Annual Gas Safe Boiler & Heating Service', amount: 115, date: '2026-11-28', status: 'upcoming', notes: 'Before December freeze', updatedAt: '2026-10-01T10:00:00.000Z' },
  { id: 'ae_home_2', year: 2026, category: 'Seasonal & Family', title: 'Christmas Hosting, Flights & Family Gifts', amount: 850, date: '2026-12-18', status: 'upcoming', notes: 'Planned annual festive pot', updatedAt: '2026-10-01T10:00:00.000Z' },

  { id: 'ae_travel_1', year: 2027, category: 'Home & Property', title: 'Buildings & Contents Insurance Annual Policy', amount: 410, date: '2027-01-15', status: 'upcoming', notes: 'Annual policy renewal', updatedAt: '2026-10-01T10:00:00.000Z' },
  { id: 'ae_travel_2', year: 2027, category: 'Family Holidays', title: 'Summer Family Villa Balance', amount: 1850, date: '2027-05-01', status: 'upcoming', notes: 'Early bird booking', updatedAt: '2026-10-01T10:00:00.000Z' },
  { id: 'ae_2028_1', year: 2028, category: 'Home & Property', title: '5-Year Fixed Mortgage Product Fee & Valuation', amount: 995, date: '2028-12-01', status: 'upcoming', notes: 'Remortgage window Dec 2028', updatedAt: '2026-10-01T10:00:00.000Z' }
];

const INITIAL_TRANSACTIONS = [
  {
    id: 'tx_var_1',
    type: 'weekly_variance',
    year: 2026,
    month: '2026-10',
    weekStart: '2026-10-05',
    category: 'Groceries Overspend (Sunday Family Roast)',
    amount: 65,
    date: '2026-10-08',
    note: 'Hosted family dinner',
    deductFromSavings: true,
    updatedAt: '2026-10-08T18:00:00.000Z'
  },
  {
    id: 'tx_var_2',
    type: 'weekly_variance',
    year: 2026,
    month: '2026-10',
    weekStart: '2026-10-12',
    category: 'Dining Out & Pharmacy Variance',
    amount: 48,
    date: '2026-10-16',
    note: 'Mid-week takeaway + baby calpol',
    deductFromSavings: true,
    updatedAt: '2026-10-16T20:00:00.000Z'
  },
  {
    id: 'tx_sal_1',
    type: 'salary_allocation',
    year: 2026,
    month: '2026-10',
    weekStart: '2026-09-28',
    category: 'Combined Household Payday Allocation',
    amount: 2650,
    date: '2026-10-01',
    note: 'Split across Vanguard ISA, Monzo Cash ISA & Sinking Pot',
    deductFromSavings: false,
    updatedAt: '2026-10-01T08:00:00.000Z'
  }
];

const INITIAL_SETTINGS = {
  my_name: 'Alex',
  partner_name: 'Sam',
  pay_date: new Date().getDate(),
  partner_pay_date: 28,
  fy_start_month: 4,
  fm_start_day: 24,
  available_years: [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035],
  custom_account_types: ['Cash ISA', 'Shares ISA', 'Cash Pot', 'Joint Account', 'Pension / SIPP', 'Premium Bonds'],
  custom_owners: ['Joint'],
  custom_expense_categories: ['Baby Spending', 'Car Maintenance', 'Home & Property', 'Seasonal & Family', 'Family Holidays'],
  custom_variance_categories: ['Groceries & Household', 'Dining Out & Takeaway', 'Fuel & Commute', 'Kids & Nursery', 'Unexpected Repair'],
  demo_cleared: false,
  layout: DEFAULT_WIDGET_LAYOUT
};

/**
 * ============================================================================
 * 3. HELPER UTILITIES & REUSABLE UI COMPONENTS
 * ============================================================================
 */
function formatGBP(value, showDecimals = false) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(num);
}

function daysBetween(dateStr) {
  if (!dateStr) return 999;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return 999;
  const diff = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getMondayOfCurrentWeek(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Smart Select with "+ Custom..." inline input option
 * Satisfies: "every drop down to add an type or a name should have a custom option for user input."
 */
function CreatableSelect({ value, onChange, options = [], onAddCustomOption, placeholder = 'Select or add custom...', className = '' }) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const normalizedOptions = useMemo(() => {
    const set = new Set(options.filter(Boolean));
    if (value && !set.has(value)) set.add(value);
    return Array.from(set);
  }, [options, value]);

  const handleCommitCustom = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      if (onAddCustomOption) onAddCustomOption(trimmed);
      onChange(trimmed);
    }
    setCustomText('');
    setIsCustomMode(false);
  };

  if (isCustomMode) {
    return (
      <div className="flex items-center gap-1 w-full">
        <input
          type="text"
          autoFocus
          value={customText}
          placeholder="Type custom name/type..."
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommitCustom();
            } else if (e.key === 'Escape') {
              setIsCustomMode(false);
            }
          }}
          className={`flex-1 bg-zinc-950 border border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none ${className}`}
        />
        <button
          type="button"
          onClick={handleCommitCustom}
          className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shrink-0"
          title="Save custom option"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsCustomMode(false)}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs shrink-0"
          title="Cancel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === '__CUSTOM_INPUT__') {
          setIsCustomMode(true);
        } else {
          onChange(e.target.value);
        }
      }}
      className={className || 'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500'}
    >
      {normalizedOptions.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value="__CUSTOM_INPUT__">+ Custom {placeholder}...</option>
    </select>
  );
}

/**
 * Scrollable Wheel / Drum Dropdown Picker for Unlimited Expandable Years
 * Satisfies: "The annual slider sucks, I meant like a drop down but a slider. Also why does it stop at 2030. Needs to be expandable"
 */
function ExpandableYearWheelDropdown({ selectedYear, availableYears = [], onSelectYear, onAddYear }) {
  const [open, setOpen] = useState(false);
  const [customYearInput, setCustomYearInput] = useState('');
  const listRef = useRef(null);

  const sortedYears = useMemo(() => {
    const set = new Set([...availableYears, Number(selectedYear)]);
    return Array.from(set).sort((a, b) => a - b);
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active-year="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [open]);

  const stepYear = (delta) => {
    const nextYr = Number(selectedYear) + delta;
    if (!sortedYears.includes(nextYr)) {
      onAddYear(nextYr);
    }
    onSelectYear(nextYr);
  };

  return (
    <div className="relative inline-flex items-center">
      <div className="inline-flex items-center rounded-xl bg-zinc-950 border border-zinc-700 p-0.5 shadow-inner">
        <button
          type="button"
          onClick={() => stepYear(-1)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Previous Year"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="px-3 py-1 rounded-lg hover:bg-zinc-900 font-mono text-xs font-bold text-emerald-400 inline-flex items-center gap-1.5"
        >
          <span>Year: {selectedYear}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        <button
          type="button"
          onClick={() => stepYear(1)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Next Year (Auto-expands)"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2.5 space-y-2">
          <div className="flex items-center justify-between px-1 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            <span>Scrollable Year Wheel</span>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Vertical Drum / Slider Wheel */}
          <div
            ref={listRef}
            className="max-h-44 overflow-y-auto snap-y snap-mandatory space-y-1 pr-1 py-2 border-y border-zinc-800"
          >
            {sortedYears.map((yr) => {
              const isSelected = Number(selectedYear) === Number(yr);
              return (
                <button
                  key={yr}
                  type="button"
                  data-active-year={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    onSelectYear(Number(yr));
                    setOpen(false);
                  }}
                  className={`w-full snap-center py-1.5 px-3 rounded-xl font-mono text-xs flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-md scale-[1.02]'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>{yr}</span>
                  {isSelected && <span className="text-[10px] uppercase">Active</span>}
                </button>
              );
            })}
          </div>

          {/* Expandable Year Actions: +5 Years or Any Custom Year */}
          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const maxYr = sortedYears[sortedYears.length - 1] || 2035;
                for (let y = maxYr + 1; y <= maxYr + 5; y++) {
                  onAddYear(y);
                }
              }}
              className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Expand +5 Future Years ({sortedYears[sortedYears.length - 1] + 1}–{sortedYears[sortedYears.length - 1] + 5})</span>
            </button>

            <div className="flex items-center gap-1">
              <input
                type="number"
                min="2000"
                max="2100"
                placeholder="Jump to year (e.g. 2042)"
                value={customYearInput}
                onChange={(e) => setCustomYearInput(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
              />
              <button
                type="button"
                onClick={() => {
                  const yr = parseInt(customYearInput, 10);
                  if (!isNaN(yr) && yr >= 2000 && yr <= 2100) {
                    onAddYear(yr);
                    onSelectYear(yr);
                    setCustomYearInput('');
                    setOpen(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INFO_EXPLAINERS = {
  total_savings: {
    title: 'Total SavingsTill Date (Auto-Computed from Accounts)',
    what: 'Automatically sums the live balances of all your household accounts and pots, broken down by Spendable Annual Pool vs. Untouchable Reserves and by Partner Name.',
    formula: 'Total Savings Till Date = Sum(All Account Balances)\nSpendable Annual Pool = Total Savings − Sum(Untouchable Accounts)',
    howToChange: 'Update any account balance inline or in Settings. No manual total input is ever required.'
  },
  savings_velocity: {
    title: '100% Data-Driven Savings Velocity & Future Predictor',
    what: 'Automatically derives your Monthly Savings and Annual Savings YTD directly from your Monthly Cashflow Sheet and logged payday allocations — you never have to type a generic monthly savings number.',
    formula: 'Active Monthly Savings = Sum(Savings Transfers in Selected Month, or Last Month if current month is £0)\nAnnual Savings YTD = Sum(All Monthly Sheet Savings Transfers + Payday Allocations in Year) − Sum(Weekly Overspend Variances in Year)',
    howToChange: 'Add or edit savings transfer rows in the Monthly Cashflow tab (e.g. Oct 2026 or Sep 2026). The velocity and Future Predictor automatically use your real sheet numbers.'
  },
  upcoming_annual: {
    title: 'Upcoming Annual Payments & Coverage Check',
    what: 'Orders all upcoming annual bills chronologically and verifies whether your Spendable Annual Pool (excluding Untouchable ISAs/Emergency funds) covers them.',
    formula: 'Cumulative Needed = Running Sum(Upcoming Unpaid Bills)\nCoverage = Spendable Annual Pool ≥ Cumulative Needed',
    howToChange: 'Schedule future bills or click "Mark Paid" when a renewal clears.'
  },
  annual_expenditures: {
    title: 'Annual / One-Time Expenditures & Expandable Year Wheel',
    what: 'Tracks irregular annual costs by year using the scrollable Year Wheel dropdown (expandable to any future year like 2035 or 2045).',
    formula: 'Category Total = Sum(Line Items in Selected Year)',
    howToChange: 'Use the Year Wheel dropdown to switch or add years, or toggle Compact / Expanded mode on the card header.'
  },
  weekly_adjustment: {
    title: 'Time-Scoped Weekly Variance Adjustment',
    what: 'Logs weekly budget overspends under a specific Year, Month, and Week Starting Monday and automatically deducts them from your data-driven Annual Savings YTD.',
    formula: 'Net Annual Savings YTD = Gross YTD Savings from Sheet − Sum(Weekly Variances in Year)',
    howToChange: 'Pick the Week Starting date, choose or type a custom category, and log the variance.'
  },
  monthly_planner: {
    title: 'Monthly Cashflow & Post-Payday Router',
    what: 'Your month-by-month sheet for both partners’ incomes, fixed bills, variable budgets, and post-payday savings transfers. Feeds Savings Velocity automatically.',
    formula: 'Left to Route = Combined Income − Fixed Bills − Variable Budgets − Savings Transfers',
    howToChange: 'Switch to any month/year, add custom categories or owners from any dropdown, or clone a month forward.'
  }
};

async function initializePWASafeguards() {
  let persisted = false;
  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (typeof navigator.storage.persisted === 'function') {
        persisted = await navigator.storage.persisted();
      }
      if (!persisted && typeof navigator.storage.persist === 'function') {
        persisted = await navigator.storage.persist();
      }
    } catch (e) {
      persisted = false;
    }
  }
  return { persisted };
}

/**
 * ============================================================================
 * 4. MAIN APPLICATION COMPONENT
 * ============================================================================
 */
export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);

  // Database State
  const [accounts, setAccounts] = useState([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState([]);
  const [annualExpenses, setAnnualExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settingsMap, setSettingsMap] = useState(INITIAL_SETTINGS);

  // Compact vs. Expanded Mode per Segment + Global Toggle
  // Satisfies: "Every segment needs to have either a compact or expanded mode"
  const [segmentModes, setSegmentModes] = useState({
    total_savings: 'expanded',
    savings_velocity: 'expanded',
    upcoming_annual: 'expanded',
    annual_expenditures: 'expanded',
    weekly_adjustment: 'expanded',
    monthly_planner: 'expanded',
    data_ledger: 'expanded'
  });

  const toggleSegmentMode = (key) => {
    setSegmentModes((prev) => ({
      ...prev,
      [key]: prev[key] === 'compact' ? 'expanded' : 'compact'
    }));
  };

  const setAllSegmentsMode = (mode) => {
    setSegmentModes({
      total_savings: mode,
      savings_velocity: mode,
      upcoming_annual: mode,
      annual_expenditures: mode,
      weekly_adjustment: mode,
      monthly_planner: mode,
      data_ledger: mode
    });
  };

  // Global Horizon & Temporal Filters
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState('2026-10');

  // Future Savings Predictor Target State
  const [predictorMonth, setPredictorMonth] = useState(12);
  const [predictorYear, setPredictorYear] = useState(2028);
  const [velocitySourceMode, setVelocitySourceMode] = useState('selected_or_last'); // 'selected_or_last' | 'last_month' | 'fy_average'

  // Info Explainer Modal State
  const [activeExplainerKey, setActiveExplainerKey] = useState(null);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [partnersModalOpen, setPartnersModalOpen] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);

  // Asset Allocation Filter State
  const [ownerFilter, setOwnerFilter] = useState('ALL');

  // Annual Expenditures Accordion & Inline Add State
  const [expandedCategories, setExpandedCategories] = useState({ 'Baby Spending': true });
  const [inlineAddCategory, setInlineAddCategory] = useState(null);
  const [inlineItemForm, setInlineItemForm] = useState({
    title: '',
    amount: '',
    date: '2026-10-24',
    status: 'paid',
    notes: ''
  });
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    year: 2026,
    category: 'Baby Spending',
    title: '',
    amount: '',
    date: '2026-11-15',
    status: 'upcoming',
    notes: ''
  });

  // Dual Partner Pay Day Modal State
  const [payDayModalOpen, setPayDayModalOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    earner: 'Alex',
    month: '2026-10',
    netSalary: '3600',
    primaryTransfer: '1400',
    targetAccountId: 'acc_vanguard_isa',
    secondaryTransfer: '750',
    secondaryAccountId: 'acc_monzo_annual'
  });

  // Weekly Variance Form State
  const [varianceForm, setVarianceForm] = useState({
    category: 'Groceries & Household',
    amount: '',
    date: '2026-10-24',
    weekStart: '2026-10-19',
    note: ''
  });

  // Monthly Planner New Line Form
  const [newBudgetRow, setNewBudgetRow] = useState({
    flow: 'fixed_outflow',
    category: '',
    owner: 'Joint',
    planned: '',
    actual: '',
    destinationAccountId: '',
    notes: ''
  });

  // Full Data Sheet Filters (Including Month Dropdown!)
  const [ledgerSectionFilter, setLedgerSectionFilter] = useState('ALL');
  const [ledgerYearFilter, setLedgerYearFilter] = useState('ALL');
  const [ledgerMonthFilter, setLedgerMonthFilter] = useState('ALL'); // 'ALL' | '01' .. '12' or specific YYYY-MM
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Settings Account CRUD Form
  const [accountForm, setAccountForm] = useState({
    id: null,
    name: '',
    institution: '',
    type: 'Cash ISA',
    owner: 'Alex',
    balance: '',
    interestRate: '4.5',
    isUntouchable: false,
    lastUpdatedDate: new Date().toISOString().slice(0, 10),
    color: '#10b981'
  });
  const [editingAccountId, setEditingAccountId] = useState(null);

  // Confirm Clear Demo Data Modal
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  // Grid Customization State
  const [editGridMode, setEditGridMode] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null);

  // Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Refresh all state from Dexie IndexedDB
  const refreshFromDexie = useCallback(async () => {
    const [acc, mb, ae, tx, setRows] = await Promise.all([
      db.accounts.toArray(),
      db.monthly_budgets.toArray(),
      db.annual_expenses.toArray(),
      db.transactions.toArray(),
      db.settings.toArray()
    ]);

    setAccounts(acc);
    setMonthlyBudgets(mb);
    setAnnualExpenses(ae);
    setTransactions(
      [...tx].sort((a, b) => new Date(b.date || b.updatedAt) - new Date(a.date || a.updatedAt))
    );

    const nextSettings = { ...INITIAL_SETTINGS };
    setRows.forEach((r) => {
      if (r.id in nextSettings) {
        nextSettings[r.id] = r.value;
      }
    });
    setSettingsMap(nextSettings);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const safeguard = await initializePWASafeguards();
      if (mounted) setStoragePersisted(safeguard.persisted);

      const existingSettings = await db.settings.toArray();
      const isCleared = existingSettings.find((s) => s.id === 'demo_cleared')?.value === true;
      const existingAccounts = await db.accounts.toArray();

      if (existingAccounts.length === 0 && !isCleared) {
        await db.accounts.bulkPut(INITIAL_ACCOUNTS);
        await db.monthly_budgets.bulkPut(INITIAL_MONTHLY_BUDGETS);
        await db.annual_expenses.bulkPut(INITIAL_ANNUAL_EXPENSES);
        await db.transactions.bulkPut(INITIAL_TRANSACTIONS);
        await db.settings.bulkPut(
          Object.entries(INITIAL_SETTINGS).map(([key, value]) => ({
            id: key,
            key,
            value,
            updatedAt: new Date().toISOString()
          }))
        );
      }

      await refreshFromDexie();
      if (mounted) setIsLoaded(true);
    }

    boot();
    const unsub = db.subscribe(() => {
      refreshFromDexie();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [refreshFromDexie]);

  // Helper to persist a setting key
  const saveSettingKey = async (key, value) => {
    setSettingsMap((prev) => ({ ...prev, [key]: value }));
    await db.settings.put({
      id: key,
      key,
      value,
      updatedAt: new Date().toISOString()
    });
  };

  // Dynamic list of all owner/holder names (Partner 1, Partner 2, Joint + any custom names)
  const ownerOptions = useMemo(() => {
    const p1 = settingsMap.my_name || 'Alex';
    const p2 = settingsMap.partner_name || 'Sam';
    const custom = Array.isArray(settingsMap.custom_owners) ? settingsMap.custom_owners : ['Joint'];
    const fromAccounts = accounts.map((a) => a.owner).filter(Boolean);
    return Array.from(new Set([p1, p2, 'Joint', ...custom, ...fromAccounts]));
  }, [settingsMap.my_name, settingsMap.partner_name, settingsMap.custom_owners, accounts]);

  const accountTypeOptions = useMemo(() => {
    const base = Array.isArray(settingsMap.custom_account_types)
      ? settingsMap.custom_account_types
      : INITIAL_SETTINGS.custom_account_types;
    const fromAcc = accounts.map((a) => a.type).filter(Boolean);
    return Array.from(new Set([...base, ...fromAcc]));
  }, [settingsMap.custom_account_types, accounts]);

  const expenseCategoryOptions = useMemo(() => {
    const base = Array.isArray(settingsMap.custom_expense_categories)
      ? settingsMap.custom_expense_categories
      : INITIAL_SETTINGS.custom_expense_categories;
    const fromExp = annualExpenses.map((e) => e.category).filter(Boolean);
    return Array.from(new Set([...base, ...fromExp]));
  }, [settingsMap.custom_expense_categories, annualExpenses]);

  const varianceCategoryOptions = useMemo(() => {
    const base = Array.isArray(settingsMap.custom_variance_categories)
      ? settingsMap.custom_variance_categories
      : INITIAL_SETTINGS.custom_variance_categories;
    const fromTx = transactions.filter((t) => t.type === 'weekly_variance').map((t) => t.category).filter(Boolean);
    return Array.from(new Set([...base, ...fromTx]));
  }, [settingsMap.custom_variance_categories, transactions]);

  // Expandable Available Years list (auto-includes any year in data + user-added years)
  const allAvailableYears = useMemo(() => {
    const base = Array.isArray(settingsMap.available_years) ? settingsMap.available_years : INITIAL_SETTINGS.available_years;
    const fromAnnual = annualExpenses.map((e) => Number(e.year || (e.date || '').slice(0, 4))).filter((n) => !isNaN(n) && n > 2000);
    const fromMonthly = monthlyBudgets.map((m) => Number((m.month || '').slice(0, 4))).filter((n) => !isNaN(n) && n > 2000);
    const fromTx = transactions.map((t) => Number(t.year || (t.date || '').slice(0, 4))).filter((n) => !isNaN(n) && n > 2000);
    return Array.from(new Set([...base, ...fromAnnual, ...fromMonthly, ...fromTx, Number(selectedYear), Number(predictorYear)])).sort((a, b) => a - b);
  }, [settingsMap.available_years, annualExpenses, monthlyBudgets, transactions, selectedYear, predictorYear]);

  const handleAddYearToWheel = async (newYear) => {
    const yr = Number(newYear);
    if (isNaN(yr)) return;
    const updated = Array.from(new Set([...allAvailableYears, yr])).sort((a, b) => a - b);
    await saveSettingKey('available_years', updated);
  };

  /**
   * ============================================================================
   * 5. 100% DATA-DRIVEN SAVINGS VELOCITY & TOTAL SAVINGS TILL DATE COMPUTATIONS
   * Satisfies: "Savings velocity doesnt make sense when I have to input the generic
   * savings per month. Any way to use the data from sheet like last month's savings.
   * Also compute the savings till date from the data dont ask me"
   * ============================================================================
   */
  const totalSavingsTillDate = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const untouchableSavingsTotal = useMemo(() => {
    return accounts
      .filter((a) => a.isUntouchable)
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const spendableSavingsPool = useMemo(() => {
    return accounts
      .filter((a) => !a.isUntouchable)
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  // Ownership totals by actual partner names + custom holders
  const ownershipBreakdown = useMemo(() => {
    const groups = {};
    ownerOptions.forEach((o) => {
      groups[o] = 0;
    });
    accounts.forEach((a) => {
      const ownerKey = a.owner || 'Joint';
      groups[ownerKey] = (groups[ownerKey] || 0) + (Number(a.balance) || 0);
    });
    return groups;
  }, [accounts, ownerOptions]);

  // Compute Monthly Savings directly from the Monthly Cashflow Sheet!
  const sheetSavingsMetrics = useMemo(() => {
    // Helper: sum of savings_transfer rows for a given YYYY-MM
    const sumForMonth = (ym) => {
      const rows = monthlyBudgets.filter((r) => r.month === ym && r.flow === 'savings_transfer');
      if (rows.length > 0) {
        return rows.reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
      }
      // If no savings_transfer rows exist, check if income & outflows exist to compute implied savings
      const allMonthRows = monthlyBudgets.filter((r) => r.month === ym);
      if (allMonthRows.length === 0) return 0;
      const inc = allMonthRows.filter((r) => r.flow === 'income').reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
      const out = allMonthRows.filter((r) => r.flow === 'fixed_outflow' || r.flow === 'variable_outflow').reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
      return Math.max(0, inc - out);
    };

    const [selY, selM] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(selY, selM - 2, 1);
    const lastMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const selectedMonthSavings = sumForMonth(selectedMonth);
    const lastMonthSavings = sumForMonth(lastMonthStr);

    // All months in selectedYear that have sheet savings
    const monthsInSelectedYear = Array.from(
      new Set(
        monthlyBudgets
          .filter((r) => (r.month || '').startsWith(String(selectedYear)))
          .map((r) => r.month)
      )
    ).sort();

    const grossSheetSavingsYTD = monthsInSelectedYear.reduce((sum, ym) => sum + sumForMonth(ym), 0);
    const averageMonthlySavingsYTD = monthsInSelectedYear.length > 0
      ? grossSheetSavingsYTD / monthsInSelectedYear.length
      : 0;

    // Also include any standalone salary_allocation transactions logged for months not already in monthly_budgets
    const extraPaydayAllocations = transactions
      .filter((t) => {
        const txYear = Number(t.year) || Number((t.date || '').slice(0, 4));
        const txMonth = t.month || (t.date || '').slice(0, 7);
        return t.type === 'salary_allocation' && txYear === Number(selectedYear) && !monthsInSelectedYear.includes(txMonth);
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const totalGrossAnnualSavingsYTD = grossSheetSavingsYTD + extraPaydayAllocations;

    // Determine active monthly velocity based on user's chosen source mode
    let activeMonthlyVelocity = selectedMonthSavings || lastMonthSavings || averageMonthlySavingsYTD;
    let activeSourceLabel = selectedMonthSavings > 0 ? `${selectedMonth} Sheet` : `Last Month (${lastMonthStr}) Sheet`;

    if (velocitySourceMode === 'last_month' && lastMonthSavings > 0) {
      activeMonthlyVelocity = lastMonthSavings;
      activeSourceLabel = `Last Month (${lastMonthStr}) Sheet`;
    } else if (velocitySourceMode === 'fy_average' && averageMonthlySavingsYTD > 0) {
      activeMonthlyVelocity = averageMonthlySavingsYTD;
      activeSourceLabel = `${selectedYear} Monthly Sheet Avg (${monthsInSelectedYear.length} mos)`;
    }

    return {
      selectedMonthSavings,
      lastMonthStr,
      lastMonthSavings,
      averageMonthlySavingsYTD,
      monthsCountInYear: monthsInSelectedYear.length,
      totalGrossAnnualSavingsYTD,
      activeMonthlyVelocity,
      activeSourceLabel
    };
  }, [monthlyBudgets, transactions, selectedMonth, selectedYear, velocitySourceMode]);

  // Year-scoped Weekly Variances
  const yearTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const txYear = Number(t.year) || Number((t.date || '').slice(0, 4)) || 2026;
      return txYear === Number(selectedYear);
    });
  }, [transactions, selectedYear]);

  const totalWeeklyVariancesSelectedYear = useMemo(() => {
    return yearTransactions
      .filter((t) => t.type === 'weekly_variance' && t.deductFromSavings !== false)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [yearTransactions]);

  // Net Annual Savings YTD = 100% auto-computed from Monthly Cashflow Sheet minus Weekly Variances!
  const annualSavingsYTD = useMemo(() => {
    return Math.max(0, sheetSavingsMetrics.totalGrossAnnualSavingsYTD - totalWeeklyVariancesSelectedYear);
  }, [sheetSavingsMetrics.totalGrossAnnualSavingsYTD, totalWeeklyVariancesSelectedYear]);

  // Weighted average AER % and Annual Interest Generated
  const interestMetrics = useMemo(() => {
    let annualInterest = 0;
    accounts.forEach((a) => {
      const bal = Number(a.balance) || 0;
      const rate = Number(a.interestRate) || 0;
      annualInterest += bal * (rate / 100);
    });
    const weightedAER = totalSavingsTillDate > 0 ? (annualInterest / totalSavingsTillDate) * 100 : 0;
    return {
      annualInterest,
      monthlyInterest: annualInterest / 12,
      weightedAER
    };
  }, [accounts, totalSavingsTillDate]);

  const staleAccountsCount = useMemo(() => {
    return accounts.filter((a) => daysBetween(a.lastUpdatedDate) > 30).length;
  }, [accounts]);

  // Filtered Annual Expenses for Selected Year
  const yearAnnualExpenses = useMemo(() => {
    return annualExpenses.filter((item) => {
      const itemYear = Number(item.year) || Number((item.date || '').slice(0, 4)) || 2026;
      return itemYear === Number(selectedYear);
    });
  }, [annualExpenses, selectedYear]);

  const totalAnnualExpendituresSelectedYear = useMemo(() => {
    return yearAnnualExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [yearAnnualExpenses]);

  const groupedAnnualExpenses = useMemo(() => {
    const groups = {};
    yearAnnualExpenses.forEach((item) => {
      const cat = item.category || 'Uncategorized';
      if (!groups[cat]) {
        groups[cat] = { category: cat, total: 0, items: [] };
      }
      groups[cat].total += Number(item.amount) || 0;
      groups[cat].items.push(item);
    });
    Object.values(groups).forEach((g) => {
      g.items.sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    return Object.values(groups);
  }, [yearAnnualExpenses]);

  // Upcoming Annual Payments Queue
  const upcomingPaymentsQueue = useMemo(() => {
    const upcoming = annualExpenses
      .filter((item) => item.status === 'upcoming' || new Date(item.date) >= new Date('2026-10-24'))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningTotal = 0;
    return upcoming.map((item) => {
      const amt = Number(item.amount) || 0;
      runningTotal += amt;
      const isFullyFunded = spendableSavingsPool >= runningTotal;
      const shortfall = isFullyFunded ? 0 : runningTotal - spendableSavingsPool;
      return {
        ...item,
        cumulativeRequired: runningTotal,
        isFullyFunded,
        shortfall
      };
    });
  }, [annualExpenses, spendableSavingsPool]);

  // Future Savings & Compound Interest Predictor (Driven by Auto-Computed Sheet Monthly Savings!)
  const futureProjection = useMemo(() => {
    const now = new Date(2026, 9, 24);
    const target = new Date(Number(predictorYear), Number(predictorMonth) - 1, 24);
    const monthsAhead = Math.max(
      0,
      (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    );

    const monthlyContribution = sheetSavingsMetrics.activeMonthlyVelocity;
    let projectedTotal = 0;
    let projectedUntouchable = 0;
    const totalPrincipalAdded = monthlyContribution * monthsAhead;

    accounts.forEach((acc) => {
      let bal = Number(acc.balance) || 0;
      const aer = Number(acc.interestRate) || 0;
      const monthlyRate = aer / 100 / 12;
      const weight = totalSavingsTillDate > 0 ? bal / totalSavingsTillDate : 1 / Math.max(1, accounts.length);
      const monthlyAddForAcc = monthlyContribution * weight;

      for (let m = 0; m < monthsAhead; m++) {
        bal = bal * (1 + monthlyRate) + monthlyAddForAcc;
      }
      projectedTotal += bal;
      if (acc.isUntouchable) projectedUntouchable += bal;
    });

    const compoundInterestEarned = Math.max(
      0,
      projectedTotal - totalSavingsTillDate - totalPrincipalAdded
    );

    return {
      monthsAhead,
      projectedTotal,
      projectedUntouchable,
      projectedSpendable: Math.max(0, projectedTotal - projectedUntouchable),
      totalPrincipalAdded,
      compoundInterestEarned
    };
  }, [accounts, predictorMonth, predictorYear, sheetSavingsMetrics.activeMonthlyVelocity, totalSavingsTillDate]);

  // Dual Partner Payday Detection
  const todayDay = new Date().getDate();
  const isMyPayDay = Number(settingsMap.pay_date) === todayDay;
  const isPartnerPayDay = Number(settingsMap.partner_pay_date) === todayDay;

  const financialYearLabel = useMemo(() => {
    const startMonthName = MONTH_NAMES[(Number(settingsMap.fy_start_month || 4) - 1) % 12]?.slice(0, 3) || 'Apr';
    const endMonthName = MONTH_NAMES[(Number(settingsMap.fy_start_month || 4) + 10) % 12]?.slice(0, 3) || 'Mar';
    if (Number(settingsMap.fy_start_month) === 1) {
      return `Jan ${selectedYear} – Dec ${selectedYear}`;
    }
    return `${startMonthName} ${selectedYear} – ${endMonthName} ${Number(selectedYear) + 1}`;
  }, [selectedYear, settingsMap.fy_start_month]);

  /**
   * ============================================================================
   * 6. MUTATION HANDLERS
   * ============================================================================
   */
  const handleRenamePartner = async (whichKey, oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await saveSettingKey(whichKey, trimmed);

    // Also update any accounts & monthly budget rows holding the old partner name so data stays consistent
    if (oldName && oldName !== trimmed) {
      const accToUpdate = accounts.filter((a) => a.owner === oldName);
      for (const a of accToUpdate) {
        await db.accounts.update(a.id, { owner: trimmed });
      }
      const mbToUpdate = monthlyBudgets.filter((m) => m.owner === oldName);
      for (const m of mbToUpdate) {
        await db.monthly_budgets.update(m.id, { owner: trimmed });
      }
    }
  };

  const handleClearAllDemoData = async () => {
    await Promise.all([
      db.accounts.clear(),
      db.monthly_budgets.clear(),
      db.annual_expenses.clear(),
      db.transactions.clear()
    ]);
    await saveSettingKey('demo_cleared', true);
    setConfirmClearModal(false);
    await refreshFromDexie();
    showToast('All demo data permanently cleared. Your blank slate is ready.');
  };

  const handleMarkAccountVerifiedToday = async (acc) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    await db.accounts.update(acc.id, { lastUpdatedDate: todayISO });
    showToast(`Marked "${acc.name}" balance & ${acc.interestRate || 0}% AER as verified today.`);
  };

  const handleToggleUntouchable = async (acc) => {
    const nextVal = !acc.isUntouchable;
    await db.accounts.update(acc.id, {
      isUntouchable: nextVal,
      lastUpdatedDate: new Date().toISOString().slice(0, 10)
    });
    showToast(
      nextVal
        ? `"${acc.name}" locked as Untouchable (excluded from Spendable Annual Pool).`
        : `"${acc.name}" unlocked and included in Spendable Annual Pool.`
    );
  };

  const handleQuickAdjustBalance = async (acc, delta) => {
    const nextBalance = Math.max(0, (Number(acc.balance) || 0) + delta);
    await db.accounts.update(acc.id, {
      balance: nextBalance,
      lastUpdatedDate: new Date().toISOString().slice(0, 10)
    });
    showToast(`Updated ${acc.name} to ${formatGBP(nextBalance)} (stamped today).`);
  };

  const handleAddInlineExpense = async (e, categoryName) => {
    e.preventDefault();
    const amountNum = parseFloat(inlineItemForm.amount);
    if (!inlineItemForm.title.trim() || isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a description and valid amount.', 'error');
      return;
    }
    const itemYear = Number((inlineItemForm.date || '').slice(0, 4)) || selectedYear;
    await handleAddYearToWheel(itemYear);
    await db.annual_expenses.add({
      id: `ae_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      year: itemYear,
      category: categoryName,
      title: inlineItemForm.title.trim(),
      amount: amountNum,
      date: inlineItemForm.date || new Date().toISOString().slice(0, 10),
      status: inlineItemForm.status || 'paid',
      notes: inlineItemForm.notes.trim(),
      updatedAt: new Date().toISOString()
    });
    setInlineItemForm({
      title: '',
      amount: '',
      date: `${selectedYear}-10-24`,
      status: 'paid',
      notes: ''
    });
    setInlineAddCategory(null);
    showToast(`Added ${formatGBP(amountNum)} to ${categoryName} (${itemYear}).`);
  };

  const handleToggleAnnualStatus = async (item) => {
    const nextStatus = item.status === 'upcoming' ? 'paid' : 'upcoming';
    await db.annual_expenses.update(item.id, { status: nextStatus });
    showToast(`Marked "${item.title}" as ${nextStatus}.`);
  };

  const handleCreateNewExpenseCategory = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(newCategoryForm.amount);
    if (!newCategoryForm.category.trim() || !newCategoryForm.title.trim() || isNaN(amountNum) || amountNum <= 0) {
      showToast('Complete category name, item title, and amount.', 'error');
      return;
    }
    const catName = newCategoryForm.category.trim();
    const itemYear = Number(newCategoryForm.year) || selectedYear;
    await handleAddYearToWheel(itemYear);
    if (!expenseCategoryOptions.includes(catName)) {
      await saveSettingKey('custom_expense_categories', [...expenseCategoryOptions, catName]);
    }
    await db.annual_expenses.add({
      id: `ae_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      year: itemYear,
      category: catName,
      title: newCategoryForm.title.trim(),
      amount: amountNum,
      date: newCategoryForm.date || `${itemYear}-11-01`,
      status: newCategoryForm.status || 'upcoming',
      notes: newCategoryForm.notes.trim(),
      updatedAt: new Date().toISOString()
    });
    setSelectedYear(itemYear);
    setExpandedCategories((prev) => ({ ...prev, [catName]: true }));
    setNewCategoryModalOpen(false);
    showToast(`Added "${catName}" (${formatGBP(amountNum)}) to ${itemYear}.`);
  };

  const handleLogWeeklyVariance = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(varianceForm.amount);
    if (!varianceForm.category.trim() || isNaN(amountNum) || amountNum <= 0) {
      showToast('Enter a valid overspend amount.', 'error');
      return;
    }
    const derivedMonth = (varianceForm.date || selectedMonth).slice(0, 7);
    const derivedYear = Number(derivedMonth.slice(0, 4)) || selectedYear;
    const derivedWeek = varianceForm.weekStart || getMondayOfCurrentWeek(varianceForm.date);
    await handleAddYearToWheel(derivedYear);

    await db.transactions.add({
      id: `tx_var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'weekly_variance',
      year: derivedYear,
      month: derivedMonth,
      weekStart: derivedWeek,
      category: varianceForm.category.trim(),
      amount: amountNum,
      date: varianceForm.date || new Date().toISOString().slice(0, 10),
      note: varianceForm.note.trim() || `Week of ${derivedWeek} rebalance`,
      deductFromSavings: true,
      updatedAt: new Date().toISOString()
    });

    setVarianceForm((prev) => ({ ...prev, amount: '', note: '' }));
    showToast(`Logged ${formatGBP(amountNum)} variance under Week of ${derivedWeek} (${derivedMonth}).`);
  };

  const handleLogSalaryAndAllocations = async (e) => {
    e.preventDefault();
    const primaryAdd = Number(salaryForm.primaryTransfer) || 0;
    const secondaryAdd = Number(salaryForm.secondaryTransfer) || 0;
    const todayISO = new Date().toISOString().slice(0, 10);

    if (primaryAdd > 0 && salaryForm.targetAccountId) {
      const targetAcc = accounts.find((a) => a.id === salaryForm.targetAccountId);
      if (targetAcc) {
        await db.accounts.update(targetAcc.id, {
          balance: (Number(targetAcc.balance) || 0) + primaryAdd,
          lastUpdatedDate: todayISO
        });
      }
    }

    if (secondaryAdd > 0 && salaryForm.secondaryAccountId) {
      const secAcc = accounts.find((a) => a.id === salaryForm.secondaryAccountId);
      if (secAcc) {
        await db.accounts.update(secAcc.id, {
          balance: (Number(secAcc.balance) || 0) + secondaryAdd,
          lastUpdatedDate: todayISO
        });
      }
    }

    const totalAdded = primaryAdd + secondaryAdd;

    // Also log into monthly_budgets if not already there so sheet savings velocity updates automatically!
    await db.monthly_budgets.add({
      id: `mb_${salaryForm.month}_payday_${Date.now()}`,
      month: salaryForm.month,
      flow: 'savings_transfer',
      category: `${salaryForm.earner} Payday Savings Allocation`,
      owner: salaryForm.earner,
      planned: totalAdded,
      actual: totalAdded,
      destinationAccountId: salaryForm.targetAccountId || '',
      notes: `Logged from Pay Day modal (${todayISO})`,
      updatedAt: new Date().toISOString()
    });

    await db.transactions.add({
      id: `tx_payday_${Date.now()}`,
      type: 'salary_allocation',
      year: Number(salaryForm.month.slice(0, 4)) || selectedYear,
      month: salaryForm.month,
      weekStart: getMondayOfCurrentWeek(todayISO),
      category: `${salaryForm.earner} Pay Day Salary & Allocation`,
      amount: totalAdded,
      date: todayISO,
      note: `${salaryForm.earner} net salary ${formatGBP(salaryForm.netSalary)} logged; ${formatGBP(totalAdded)} routed to pots.`,
      deductFromSavings: false,
      updatedAt: new Date().toISOString()
    });

    setPayDayModalOpen(false);
    showToast(`${salaryForm.earner} payday logged: ${formatGBP(totalAdded)} allocated & added to ${salaryForm.month} sheet.`);
  };

  // Monthly Cashflow Planner Computations & Handlers
  const currentMonthRows = useMemo(() => {
    return monthlyBudgets.filter((row) => row.month === selectedMonth);
  }, [monthlyBudgets, selectedMonth]);

  const monthlySummary = useMemo(() => {
    const income = currentMonthRows
      .filter((r) => r.flow === 'income')
      .reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
    const fixedOut = currentMonthRows
      .filter((r) => r.flow === 'fixed_outflow')
      .reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
    const variableOut = currentMonthRows
      .filter((r) => r.flow === 'variable_outflow')
      .reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
    const savingsTransfers = currentMonthRows
      .filter((r) => r.flow === 'savings_transfer')
      .reduce((s, r) => s + (Number(r.actual ?? r.planned) || 0), 0);
    const unallocated = income - fixedOut - variableOut - savingsTransfers;
    return { income, fixedOut, variableOut, savingsTransfers, unallocated };
  }, [currentMonthRows]);

  const handleAddMonthlyBudgetRow = async (e) => {
    e.preventDefault();
    const plannedNum = parseFloat(newBudgetRow.planned) || 0;
    const actualNum = newBudgetRow.actual !== '' ? parseFloat(newBudgetRow.actual) : plannedNum;
    if (!newBudgetRow.category.trim() || plannedNum <= 0) {
      showToast('Enter a category name and planned amount.', 'error');
      return;
    }
    const yr = Number(selectedMonth.slice(0, 4));
    await handleAddYearToWheel(yr);

    await db.monthly_budgets.add({
      id: `mb_${selectedMonth}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      month: selectedMonth,
      flow: newBudgetRow.flow,
      category: newBudgetRow.category.trim(),
      owner: newBudgetRow.owner,
      planned: plannedNum,
      actual: actualNum,
      destinationAccountId: newBudgetRow.destinationAccountId || '',
      notes: newBudgetRow.notes.trim(),
      updatedAt: new Date().toISOString()
    });
    setNewBudgetRow({
      flow: 'fixed_outflow',
      category: '',
      owner: 'Joint',
      planned: '',
      actual: '',
      destinationAccountId: '',
      notes: ''
    });
    showToast(`Added "${newBudgetRow.category}" to ${selectedMonth}.`);
  };

  const handleCloneMonthToNext = async () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    await handleAddYearToWheel(nextDate.getFullYear());

    if (currentMonthRows.length === 0) {
      showToast('Current month has no rows to clone.', 'error');
      return;
    }

    const clonedRows = currentMonthRows.map((row) => ({
      ...row,
      id: `mb_${nextMonthStr}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      month: nextMonthStr,
      notes: row.notes || `Cloned from ${selectedMonth}`,
      updatedAt: new Date().toISOString()
    }));

    await db.monthly_budgets.bulkPut(clonedRows);
    setSelectedMonth(nextMonthStr);
    setSelectedYear(nextDate.getFullYear());
    showToast(`Cloned ${clonedRows.length} rows into ${nextMonthStr}.`);
  };

  const handleExecutePostPaydayTransfers = async () => {
    const transferRows = currentMonthRows.filter(
      (r) => r.flow === 'savings_transfer' && r.destinationAccountId && (Number(r.actual ?? r.planned)) > 0
    );
    if (transferRows.length === 0) {
      showToast('Assign a destination account to at least one Savings Transfer row first.', 'error');
      return;
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    let totalMoved = 0;

    for (const row of transferRows) {
      const amt = Number(row.actual ?? row.planned) || 0;
      const acc = accounts.find((a) => a.id === row.destinationAccountId);
      if (acc && amt > 0) {
        await db.accounts.update(acc.id, {
          balance: (Number(acc.balance) || 0) + amt,
          lastUpdatedDate: todayISO
        });
        totalMoved += amt;
      }
    }

    showToast(`Routed ${formatGBP(totalMoved)} into destination pots for ${selectedMonth}.`);
  };

  // Account CRUD in Settings
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const bal = parseFloat(accountForm.balance);
    const rate = parseFloat(accountForm.interestRate) || 0;
    if (!accountForm.name.trim() || isNaN(bal)) {
      showToast('Provide an account name and valid balance.', 'error');
      return;
    }
    const id = editingAccountId || `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.accounts.put({
      id,
      name: accountForm.name.trim(),
      institution: accountForm.institution.trim() || 'Direct',
      type: accountForm.type || 'Cash ISA',
      owner: accountForm.owner || settingsMap.my_name || 'Alex',
      balance: bal,
      interestRate: rate,
      isUntouchable: Boolean(accountForm.isUntouchable),
      lastUpdatedDate: accountForm.lastUpdatedDate || new Date().toISOString().slice(0, 10),
      color: accountForm.color || '#10b981',
      updatedAt: new Date().toISOString()
    });
    setAccountForm({
      id: null,
      name: '',
      institution: '',
      type: 'Cash ISA',
      owner: settingsMap.my_name || 'Alex',
      balance: '',
      interestRate: '4.5',
      isUntouchable: false,
      lastUpdatedDate: new Date().toISOString().slice(0, 10),
      color: '#10b981'
    });
    setEditingAccountId(null);
    showToast(editingAccountId ? 'Asset updated.' : 'New asset location added.');
  };

  const startEditAccount = (acc) => {
    setEditingAccountId(acc.id);
    setAccountForm({
      id: acc.id,
      name: acc.name,
      institution: acc.institution || '',
      type: acc.type || 'Cash ISA',
      owner: acc.owner || settingsMap.my_name || 'Alex',
      balance: String(acc.balance),
      interestRate: String(acc.interestRate ?? 0),
      isUntouchable: Boolean(acc.isUntouchable),
      lastUpdatedDate: acc.lastUpdatedDate || new Date().toISOString().slice(0, 10),
      color: acc.color || '#10b981'
    });
  };

  // Peer-to-Peer Sync & Google Sheets CSV Export
  const handleGenerateSyncFile = async () => {
    const payload = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        accounts: await db.accounts.toArray(),
        monthly_budgets: await db.monthly_budgets.toArray(),
        annual_expenses: await db.annual_expenses.toArray(),
        transactions: await db.transactions.toArray(),
        settings: await db.settings.toArray()
      }
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const fileName = `household-finance-sync-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([jsonString], { type: 'application/json' });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Household Finance Sync File',
            text: `Database snapshot (${new Date().toLocaleDateString()})`,
            files: [file]
          });
          showToast('Shared via native Share Sheet.');
          return;
        }
      } catch (err) {
        // Fallback to download
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded sync file "${fileName}".`);
  };

  const handleImportSyncFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.tables) {
        showToast('Invalid sync file.', 'error');
        return;
      }
      const { accounts: inAcc, monthly_budgets: inMb, annual_expenses: inAe, transactions: inTx, settings: inSet } = parsed.tables;
      let count = 0;
      if (Array.isArray(inAcc)) { await db.accounts.bulkPut(inAcc); count += inAcc.length; }
      if (Array.isArray(inMb)) { await db.monthly_budgets.bulkPut(inMb); count += inMb.length; }
      if (Array.isArray(inAe)) { await db.annual_expenses.bulkPut(inAe); count += inAe.length; }
      if (Array.isArray(inTx)) { await db.transactions.bulkPut(inTx); count += inTx.length; }
      if (Array.isArray(inSet)) { await db.settings.bulkPut(inSet); }
      await refreshFromDexie();
      showToast(`Merged ${count} records without duplicates.`);
    } catch (err) {
      showToast('Could not parse JSON sync file.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleExportCSV = async () => {
    const headers = [
      'Record ID',
      'Year',
      'Month / Period',
      'Week Starting',
      'Date / Updated',
      'Section',
      'Owner / Holder',
      'Category / Institution',
      'Item / Account Name',
      'Status / Flow',
      'AER % / Untouchable',
      'Amount (GBP)',
      'Notes'
    ];
    const escapeCSV = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const rows = [];

    accounts.forEach((acc) => {
      rows.push([
        acc.id,
        new Date().getFullYear(),
        (acc.lastUpdatedDate || '').slice(0, 7),
        '',
        acc.lastUpdatedDate || '',
        'Asset Allocation',
        acc.owner || 'Joint',
        acc.institution || '',
        acc.name,
        acc.type || '',
        `${acc.interestRate || 0}% AER | ${acc.isUntouchable ? 'Untouchable' : 'Spendable'}`,
        Number(acc.balance).toFixed(2),
        ''
      ]);
    });

    monthlyBudgets.forEach((mb) => {
      rows.push([
        mb.id,
        (mb.month || '').slice(0, 4),
        mb.month || '',
        '',
        mb.month || '',
        'Monthly Cashflow Sheet',
        mb.owner || 'Joint',
        mb.flow,
        mb.category,
        `Planned: £${mb.planned}`,
        '',
        Number(mb.actual ?? mb.planned).toFixed(2),
        mb.notes || ''
      ]);
    });

    annualExpenses.forEach((exp) => {
      rows.push([
        exp.id,
        exp.year || (exp.date || '').slice(0, 4),
        (exp.date || '').slice(0, 7),
        '',
        exp.date || '',
        'Annual / One-Time Expenditure',
        'Household',
        exp.category,
        exp.title,
        exp.status || 'paid',
        '',
        Number(exp.amount).toFixed(2),
        exp.notes || ''
      ]);
    });

    transactions.forEach((tx) => {
      rows.push([
        tx.id,
        tx.year || (tx.date || '').slice(0, 4),
        tx.month || (tx.date || '').slice(0, 7),
        tx.weekStart || '',
        tx.date || '',
        tx.type === 'weekly_variance' ? 'Weekly Variance' : 'Salary Allocation',
        'Household',
        tx.category,
        tx.note || tx.category,
        tx.deductFromSavings ? 'Savings Pool Deduction' : 'Allocation Inflow',
        '',
        Number(tx.amount).toFixed(2),
        tx.note || ''
      ]);
    });

    const csvContent = [headers.map(escapeCSV).join(','), ...rows.map((r) => r.map(escapeCSV).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `finance-ledger-export-${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} rows to Google Sheets CSV.`);
  };

  /**
   * Reusable `i` Info Button & Segment Compact/Expanded Toggle Button
   */
  const renderInfoButton = (explainerKey) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setActiveExplainerKey(explainerKey);
      }}
      className="w-6 h-6 rounded-full bg-zinc-800/90 hover:bg-emerald-500/20 border border-zinc-700 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-300 inline-flex items-center justify-center transition-colors shrink-0"
      title="What is this, how is it calculated, and how do I change it?"
    >
      <Info className="w-3.5 h-3.5" />
    </button>
  );

  const renderModeToggleButton = (segmentKey) => {
    const isCompact = segmentModes[segmentKey] === 'compact';
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleSegmentMode(segmentKey);
        }}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
          isCompact
            ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:text-white'
            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
        }`}
        title="Switch between Compact and Expanded mode for this segment"
      >
        {isCompact ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
        <span>{isCompact ? 'Expand' : 'Compact'}</span>
      </button>
    );
  };

  /**
   * ============================================================================
   * 7. DASHBOARD WIDGET RENDERERS (Each supports Compact & Expanded Modes)
   * ============================================================================
   */
  const renderTotalSavingsWidget = () => {
    const isCompact = segmentModes.total_savings === 'compact';
    const filteredAccounts = accounts.filter((a) => ownerFilter === 'ALL' || a.owner === ownerFilter);
    const spendablePct = totalSavingsTillDate > 0 ? ((spendableSavingsPool / totalSavingsTillDate) * 100).toFixed(0) : '0';

    if (isCompact) {
      return (
        <div className="flex flex-col justify-between h-full space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                Total Savings: <span className="font-mono text-emerald-400">{formatGBP(totalSavingsTillDate)}</span>
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {spendablePct}% liquid • +{interestMetrics.weightedAER.toFixed(1)}% AER
              </span>
              {renderInfoButton('total_savings')}
            </div>
            {renderModeToggleButton('total_savings')}
          </div>

          {/* Compact Multi-Entry Tile Grid: Each Asset shown as a small tile with Header + Number + % */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {accounts.map((acc) => {
              const sharePct = totalSavingsTillDate > 0 ? ((Number(acc.balance) / totalSavingsTillDate) * 100).toFixed(0) : '0';
              return (
                <div
                  key={acc.id}
                  onClick={() => toggleSegmentMode('total_savings')}
                  className="cursor-pointer p-3 rounded-xl bg-zinc-950/85 border border-zinc-800/90 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold text-zinc-300 truncate" title={acc.name}>
                      {acc.name}
                    </span>
                    {acc.isUntouchable && <Lock className="w-3 h-3 text-indigo-400 shrink-0" />}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-1">
                    <span className="font-mono text-base sm:text-lg font-bold text-white">
                      {formatGBP(acc.balance)}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-800">
                      {sharePct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Wallet className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">
                Total Savings Till Date
              </h2>
              {renderInfoButton('total_savings')}
            </div>

            <div className="flex items-center gap-2">
              {staleAccountsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" />
                  {staleAccountsCount} due check-in
                </span>
              )}
              {renderModeToggleButton('total_savings')}
            </div>
          </div>

          {/* Auto-Computed Total Hero Number */}
          <div
            onClick={() => toggleSegmentMode('total_savings')}
            className="cursor-pointer group rounded-xl p-3 -mx-3 hover:bg-zinc-800/40 transition-all"
          >
            <div className="flex items-baseline justify-between flex-wrap gap-3">
              <div>
                <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  {formatGBP(totalSavingsTillDate)}
                </div>
                <div className="text-[11px] text-emerald-400 font-mono mt-1">
                  Auto-computed from {accounts.length} active accounts • +{formatGBP(interestMetrics.annualInterest)}/yr interest ({interestMetrics.weightedAER.toFixed(2)}% weighted AER)
                </div>
              </div>
            </div>
          </div>

          {/* Summary Strip (Always visible in both Compact and Expanded modes) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/25">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Spendable Annual Pool</span>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-mono text-lg font-bold text-emerald-400 mt-0.5">
                {formatGBP(spendableSavingsPool)}
              </div>
              <div className="text-[11px] text-zinc-400">Available for annual expenses</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-indigo-500/25">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Untouchable Reserves</span>
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="font-mono text-lg font-bold text-indigo-300 mt-0.5">
                {formatGBP(untouchableSavingsTotal)}
              </div>
              <div className="text-[11px] text-zinc-400">ISAs & Emergency (Protected)</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>By Partner Name</span>
                <button
                  type="button"
                  onClick={() => setPartnersModalOpen(true)}
                  className="text-cyan-400 hover:underline text-[10px] font-semibold"
                >
                  Edit Names
                </button>
              </div>
              <div className="text-xs font-mono text-zinc-200 mt-1 space-y-0.5">
                {ownerOptions.slice(0, 3).map((holder) => (
                  <div key={holder} className="flex justify-between">
                    <span className="text-zinc-400 truncate max-w-[90px]">{holder}:</span>
                    <span className="font-semibold">{formatGBP(ownershipBreakdown[holder] || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* EXPANDED MODE: Full Asset Allocation Breakdown with Partner Filter, AER%, Last Updated & Lock Toggle */}
        {!isCompact && (
          <div className="mt-4 pt-3 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs flex-wrap">
                {['ALL', ...ownerOptions].map((holder) => (
                  <button
                    key={holder}
                    type="button"
                    onClick={() => setOwnerFilter(holder)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      ownerFilter === holder ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {holder === 'ALL' ? 'All Holders' : holder}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveView('settings')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Edit Accounts</span>
              </button>
            </div>

            {filteredAccounts.map((acc) => {
              const ageDays = daysBetween(acc.lastUpdatedDate);
              const isStale = ageDays > 30;
              const annualYieldGBP = ((Number(acc.balance) || 0) * (Number(acc.interestRate) || 0)) / 100;

              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/90 hover:border-zinc-700 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                        style={{ backgroundColor: acc.color || '#10b981' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-sm font-semibold text-zinc-100">{acc.name}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            {acc.owner || 'Joint'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleUntouchable(acc)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                              acc.isUntouchable
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                            }`}
                          >
                            {acc.isUntouchable ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            <span>{acc.isUntouchable ? 'Untouchable' : 'Spendable'}</span>
                          </button>
                        </div>

                        <div className="text-xs text-zinc-400 mt-1 flex items-center flex-wrap gap-2">
                          <span>{acc.institution} ({acc.type})</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-mono">
                            {acc.interestRate || 0}% AER (+{formatGBP(annualYieldGBP)}/yr)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-base font-bold text-white">{formatGBP(acc.balance)}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustBalance(acc, -100)}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                        >
                          -£100
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustBalance(acc, 100)}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800"
                        >
                          +£100
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock className={`w-3 h-3 ${isStale ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span className={isStale ? 'text-amber-300 font-medium' : 'text-zinc-400'}>
                        Updated: <strong className="font-mono">{acc.lastUpdatedDate || 'Never'}</strong> ({ageDays}d ago)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMarkAccountVerifiedToday(acc)}
                      className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium"
                    >
                      Verified Today
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSavingsVelocityWidget = () => {
    const isCompact = segmentModes.savings_velocity === 'compact';
    const netRetentionPct = sheetSavingsMetrics.totalGrossAnnualSavingsYTD > 0
      ? ((annualSavingsYTD / sheetSavingsMetrics.totalGrossAnnualSavingsYTD) * 100).toFixed(1)
      : '100.0';

    if (isCompact) {
      const projGrowthPct = totalSavingsTillDate > 0
        ? (((futureProjection.projectedTotal - totalSavingsTillDate) / totalSavingsTillDate) * 100).toFixed(0)
        : '0';
      return (
        <div className="flex flex-col justify-between h-full space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                Savings Velocity & Forecast
              </h2>
              {renderInfoButton('savings_velocity')}
            </div>
            {renderModeToggleButton('savings_velocity')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              onClick={() => toggleSegmentMode('savings_velocity')}
              className="cursor-pointer p-3 rounded-xl bg-zinc-950/85 border border-zinc-800/90 hover:border-indigo-500/40 transition-all"
            >
              <div className="text-xs font-semibold text-zinc-400 truncate">Net YTD ({selectedYear})</div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="font-mono text-base sm:text-lg font-bold text-white">{formatGBP(annualSavingsYTD)}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                  {netRetentionPct}% kept
                </span>
              </div>
            </div>

            <div
              onClick={() => toggleSegmentMode('savings_velocity')}
              className="cursor-pointer p-3 rounded-xl bg-zinc-950/85 border border-zinc-800/90 hover:border-emerald-500/40 transition-all"
            >
              <div className="text-xs font-semibold text-zinc-400 truncate">Monthly Velocity</div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="font-mono text-base sm:text-lg font-bold text-emerald-400">
                  {formatGBP(sheetSavingsMetrics.activeMonthlyVelocity)}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                  +{interestMetrics.weightedAER.toFixed(1)}% AER
                </span>
              </div>
            </div>

            <div
              onClick={() => toggleSegmentMode('savings_velocity')}
              className="cursor-pointer p-3 rounded-xl bg-zinc-950/85 border border-zinc-800/90 hover:border-cyan-500/40 transition-all"
            >
              <div className="text-xs font-semibold text-zinc-400 truncate">
                Est. {MONTH_NAMES[predictorMonth - 1].slice(0, 3)} {predictorYear}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="font-mono text-base sm:text-lg font-bold text-white">
                  {formatGBP(futureProjection.projectedTotal)}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                  +{projGrowthPct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col justify-between h-full space-y-4">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">
                Savings Velocity (Auto-Computed)
              </h2>
              {renderInfoButton('savings_velocity')}
            </div>
            {renderModeToggleButton('savings_velocity')}
          </div>

          {/* 100% Data-Driven Cards — No manual generic input needed! */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/90">
              <div className="text-xs text-zinc-400">
                Net Annual Savings YTD ({selectedYear})
              </div>
              <div className="font-mono text-2xl font-bold text-white mt-1">
                {formatGBP(annualSavingsYTD)}
              </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-1">
                Sheet Gross: {formatGBP(sheetSavingsMetrics.totalGrossAnnualSavingsYTD)} ({sheetSavingsMetrics.monthsCountInYear} mos)
              </div>
              {totalWeeklyVariancesSelectedYear > 0 && (
                <div className="text-[11px] text-amber-400 font-mono">
                  −{formatGBP(totalWeeklyVariancesSelectedYear)} weekly variances
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/90">
              <div className="text-xs text-zinc-400">
                Sheet Monthly Savings Velocity
              </div>
              <div className="font-mono text-2xl font-bold text-emerald-400 mt-1">
                {formatGBP(sheetSavingsMetrics.activeMonthlyVelocity)}
                <span className="text-xs text-zinc-400 font-normal">/mo</span>
              </div>
              <div className="text-[11px] text-emerald-300/90 font-mono mt-1 truncate">
                Source: {sheetSavingsMetrics.activeSourceLabel}
              </div>
              <div className="text-[11px] text-indigo-300 font-mono">
                +{formatGBP(interestMetrics.annualInterest)}/yr interest
              </div>
            </div>
          </div>

          {/* Velocity Data Source Selector (Current Month vs. Last Month's Sheet vs. YTD Average) */}
          {!isCompact && (
            <div className="mt-3 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400 font-medium">Velocity Data Basis:</span>
              <select
                value={velocitySourceMode}
                onChange={(e) => setVelocitySourceMode(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium"
              >
                <option value="selected_or_last">
                  {selectedMonth} Sheet ({formatGBP(sheetSavingsMetrics.selectedMonthSavings)}) / Fallback Last Month
                </option>
                <option value="last_month">
                  Last Month ({sheetSavingsMetrics.lastMonthStr}) Sheet ({formatGBP(sheetSavingsMetrics.lastMonthSavings)})
                </option>
                <option value="fy_average">
                  {selectedYear} Monthly Sheet Average ({formatGBP(sheetSavingsMetrics.averageMonthlySavingsYTD)}/mo)
                </option>
              </select>
            </div>
          )}
        </div>

        {/* EXPANDED MODE: FUTURE SAVINGS & COMPOUND INTEREST PREDICTOR */}
        {!isCompact && (
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/50 via-zinc-950 to-zinc-950 border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Future Savings Predictor (Compound AER)
                </span>
              </div>
              {renderInfoButton('future_predictor')}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <select
                value={predictorMonth}
                onChange={(e) => setPredictorMonth(Number(e.target.value))}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-medium"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <ExpandableYearWheelDropdown
                selectedYear={predictorYear}
                availableYears={allAvailableYears}
                onSelectYear={(yr) => setPredictorYear(yr)}
                onAddYear={handleAddYearToWheel}
              />
            </div>

            <div className="pt-1 flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[11px] text-zinc-400">
                  Projected Total by {MONTH_NAMES[predictorMonth - 1].slice(0, 3)} {predictorYear} ({futureProjection.monthsAhead} mos)
                </div>
                <div className="font-mono text-2xl font-bold text-white">
                  {formatGBP(futureProjection.projectedTotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-emerald-400 font-mono">
                  +{formatGBP(futureProjection.compoundInterestEarned)} compound interest
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  +{formatGBP(futureProjection.totalPrincipalAdded)} from sheet velocity
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUpcomingAnnualWidget = () => {
    const isCompact = segmentModes.upcoming_annual === 'compact';
    const totalUpcomingCost = upcomingPaymentsQueue.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const coveragePct = totalUpcomingCost > 0
      ? Math.min(999, (spendableSavingsPool / totalUpcomingCost) * 100).toFixed(0)
      : '100';

    if (isCompact) {
      return (
        <div className="flex flex-col justify-between h-full space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                Upcoming Annual Payments: <span className="font-mono text-cyan-400">{formatGBP(totalUpcomingCost)}</span>
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {coveragePct}% pool coverage
              </span>
              {renderInfoButton('upcoming_annual')}
            </div>
            {renderModeToggleButton('upcoming_annual')}
          </div>

          {/* Each upcoming payment shown as a compact tile: Header + Number + % of liquid pool */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {upcomingPaymentsQueue.map((item) => {
              const itemPoolPct = spendableSavingsPool > 0
                ? ((Number(item.amount) / spendableSavingsPool) * 100).toFixed(1)
                : '0.0';
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSegmentMode('upcoming_annual')}
                  className={`cursor-pointer p-3 rounded-xl bg-zinc-950/85 border transition-all flex flex-col justify-between ${
                    item.isFullyFunded
                      ? 'border-zinc-800/90 hover:border-cyan-500/40'
                      : 'border-rose-500/40 bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-zinc-200 truncate" title={item.title}>
                      {item.title}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-1">
                    <span className="font-mono text-base font-bold text-white">{formatGBP(item.amount)}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-cyan-300 border border-zinc-800">
                      {itemPoolPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">
                  Upcoming Annual Payments & Coverage
                </h2>
                {renderInfoButton('upcoming_annual')}
              </div>
              <p className="text-xs text-zinc-400">
                {upcomingPaymentsQueue.length} scheduled bills ({formatGBP(totalUpcomingCost)}) checked against your <strong>Spendable Pool ({formatGBP(spendableSavingsPool)})</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewCategoryModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 border border-zinc-700 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Schedule Payment</span>
            </button>
            {renderModeToggleButton('upcoming_annual')}
          </div>
        </div>

        {isCompact ? (
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-zinc-200">
                Next up:{' '}
                {upcomingPaymentsQueue[0] ? (
                  <strong>
                    {upcomingPaymentsQueue[0].title} ({formatGBP(upcomingPaymentsQueue[0].amount)} on {upcomingPaymentsQueue[0].date})
                  </strong>
                ) : (
                  'None queued'
                )}
              </span>
            </div>
            <span className="font-mono text-emerald-400 font-semibold">
              Spendable Surplus after all upcoming: {formatGBP(spendableSavingsPool - totalUpcomingCost)}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingPaymentsQueue.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl bg-zinc-950/80 border flex flex-col justify-between gap-2 ${
                  item.isFullyFunded ? 'border-zinc-800/90' : 'border-rose-500/40 bg-rose-950/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900 text-cyan-300 border border-zinc-800">
                      Due: {item.date}
                    </span>
                    {item.isFullyFunded ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Funds Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        Shortfall: {formatGBP(item.shortfall)}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold text-white mt-2">{item.title}</div>
                  <div className="text-xs text-zinc-400">{item.category} • {item.notes || 'Scheduled outlay'}</div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-base font-bold text-white">{formatGBP(item.amount)}</div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      Cumul. needed: {formatGBP(item.cumulativeRequired)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAnnualStatus(item)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-xs font-medium transition-colors"
                  >
                    Mark Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAnnualExpendituresWidget = () => {
    const isCompact = segmentModes.annual_expenditures === 'compact';
    const poolSharePct = spendableSavingsPool > 0
      ? ((totalAnnualExpendituresSelectedYear / spendableSavingsPool) * 100).toFixed(1)
      : '0.0';

    if (isCompact) {
      return (
        <div className="flex flex-col justify-between h-full space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                Annual Expenditures ({selectedYear}): <span className="font-mono text-white">{formatGBP(totalAnnualExpendituresSelectedYear)}</span>
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {poolSharePct}% of liquid pool
              </span>
              {renderInfoButton('annual_expenditures')}
            </div>
            <div className="flex items-center gap-2">
              <ExpandableYearWheelDropdown
                selectedYear={selectedYear}
                availableYears={allAvailableYears}
                onSelectYear={(yr) => {
                  setSelectedYear(yr);
                  setSelectedMonth(`${yr}-${selectedMonth.slice(5, 7)}`);
                }}
                onAddYear={handleAddYearToWheel}
              />
              {renderModeToggleButton('annual_expenditures')}
            </div>
          </div>

          {/* Category Summary Tiles (Header + Sum + % of Year) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {groupedAnnualExpenses.map((g) => {
              const catPct = totalAnnualExpendituresSelectedYear > 0
                ? ((g.total / totalAnnualExpendituresSelectedYear) * 100).toFixed(0)
                : '0';
              return (
                <div
                  key={g.category}
                  onClick={() => {
                    setExpandedCategories((p) => ({ ...p, [g.category]: true }));
                    toggleSegmentMode('annual_expenditures');
                  }}
                  className="cursor-pointer p-3 rounded-xl bg-zinc-950/90 border border-cyan-500/30 hover:border-cyan-400 transition-all flex flex-col justify-between"
                >
                  <div className="text-xs font-bold text-cyan-300 truncate">{g.category}</div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-1">
                    <span className="font-mono text-base sm:text-lg font-bold text-white">{formatGBP(g.total)}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                      {catPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Individual Line-Item Compact Tiles (Each item as Header + Number + %) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1 border-t border-zinc-800/80">
            {yearAnnualExpenses.map((item) => {
              const itemPct = totalAnnualExpendituresSelectedYear > 0
                ? ((Number(item.amount) / totalAnnualExpendituresSelectedYear) * 100).toFixed(0)
                : '0';
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSegmentMode('annual_expenditures')}
                  className="cursor-pointer p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                  <div className="text-[11px] font-medium text-zinc-300 truncate" title={`${item.category}: ${item.title}`}>
                    {item.title}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="font-mono text-sm font-bold text-white">{formatGBP(item.amount)}</span>
                    <span className="text-[10px] font-mono text-zinc-400">{itemPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">
                    Annual / One-Time Expenditures
                  </h2>
                  {renderInfoButton('annual_expenditures')}
                </div>
                <p className="text-xs text-zinc-400">
                  FY Window: <span className="text-zinc-200 font-mono">{financialYearLabel}</span> • Total: <strong className="font-mono text-white">{formatGBP(totalAnnualExpendituresSelectedYear)}</strong>
                </p>
              </div>
            </div>

            {/* Expandable Year Wheel Dropdown + Add Category + Compact/Expanded Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <ExpandableYearWheelDropdown
                selectedYear={selectedYear}
                availableYears={allAvailableYears}
                onSelectYear={(yr) => {
                  setSelectedYear(yr);
                  setSelectedMonth(`${yr}-${selectedMonth.slice(5, 7)}`);
                }}
                onAddYear={handleAddYearToWheel}
              />

              <button
                type="button"
                onClick={() => {
                  setNewCategoryForm((p) => ({ ...p, year: selectedYear, date: `${selectedYear}-11-15` }));
                  setNewCategoryModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 border border-zinc-700 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Add</span>
              </button>

              {renderModeToggleButton('annual_expenditures')}
            </div>
          </div>

          {isCompact ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {groupedAnnualExpenses.map((g) => (
                <div
                  key={g.category}
                  onClick={() => {
                    setExpandedCategories((p) => ({ ...p, [g.category]: true }));
                    toggleSegmentMode('annual_expenditures');
                  }}
                  className="cursor-pointer p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-cyan-500/40 transition-all"
                >
                  <div className="text-xs font-semibold text-zinc-200 truncate">{g.category}</div>
                  <div className="font-mono text-lg font-bold text-white mt-1">{formatGBP(g.total)}</div>
                  <div className="text-[10px] text-zinc-400">{g.items.length} items in {selectedYear}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {groupedAnnualExpenses.length === 0 ? (
                <div className="p-6 rounded-xl bg-zinc-950/50 border border-zinc-800/80 text-center text-xs text-zinc-400">
                  No annual expenditures logged for <strong>{selectedYear}</strong> yet. Click "+ Add" above to add {selectedYear} entries.
                </div>
              ) : (
                groupedAnnualExpenses.map((group) => {
                  const isExpanded = !!expandedCategories[group.category];
                  const isAddingHere = inlineAddCategory === group.category;

                  return (
                    <div
                      key={group.category}
                      className="rounded-xl bg-zinc-950/70 border border-zinc-800/90 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/60 transition-colors">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCategories((prev) => ({
                              ...prev,
                              [group.category]: !prev[group.category]
                            }))
                          }
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-zinc-100 truncate">{group.category}</div>
                            <div className="text-[11px] text-zinc-400">
                              {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'} in {selectedYear}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-lg font-bold text-white">{formatGBP(group.total)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedCategories((prev) => ({ ...prev, [group.category]: true }));
                              setInlineAddCategory(isAddingHere ? null : group.category);
                            }}
                            className="w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 flex items-center justify-center"
                            title={`Add line item to ${group.category}`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-3.5 pt-2 border-t border-zinc-800/80 space-y-2">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-zinc-900/70 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[11px] text-zinc-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 shrink-0">
                                  {item.date}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    item.status === 'upcoming'
                                      ? 'bg-amber-500/15 text-amber-300'
                                      : 'bg-emerald-500/15 text-emerald-300'
                                  }`}
                                >
                                  {item.status === 'upcoming' ? 'Upcoming' : 'Paid'}
                                </span>
                                <span className="text-zinc-100 font-medium truncate">{item.title}</span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-semibold text-white">{formatGBP(item.amount)}</span>
                                <button
                                  type="button"
                                  onClick={() => db.annual_expenses.delete(item.id)}
                                  className="text-zinc-500 hover:text-rose-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {isAddingHere && (
                            <form
                              onSubmit={(e) => handleAddInlineExpense(e, group.category)}
                              className="mt-2 pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-12 gap-2"
                            >
                              <input
                                type="date"
                                value={inlineItemForm.date}
                                onChange={(e) => setInlineItemForm((p) => ({ ...p, date: e.target.value }))}
                                className="sm:col-span-3 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                              />
                              <input
                                type="text"
                                placeholder="Description"
                                value={inlineItemForm.title}
                                onChange={(e) => setInlineItemForm((p) => ({ ...p, title: e.target.value }))}
                                className="sm:col-span-4 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white"
                              />
                              <input
                                type="number"
                                step="0.01"
                                placeholder="£"
                                value={inlineItemForm.amount}
                                onChange={(e) => setInlineItemForm((p) => ({ ...p, amount: e.target.value }))}
                                className="sm:col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                              />
                              <select
                                value={inlineItemForm.status}
                                onChange={(e) => setInlineItemForm((p) => ({ ...p, status: e.target.value }))}
                                className="sm:col-span-2 bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1.5 text-xs text-white"
                              >
                                <option value="paid">Paid</option>
                                <option value="upcoming">Upcoming</option>
                              </select>
                              <button
                                type="submit"
                                className="sm:col-span-1 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center justify-center"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeeklyAdjustmentWidget = () => {
    const isCompact = segmentModes.weekly_adjustment === 'compact';
    const varianceTransactions = yearTransactions.filter((t) => t.type === 'weekly_variance');
    const varianceDragPct = sheetSavingsMetrics.totalGrossAnnualSavingsYTD > 0
      ? ((totalWeeklyVariancesSelectedYear / sheetSavingsMetrics.totalGrossAnnualSavingsYTD) * 100).toFixed(1)
      : '0.0';

    if (isCompact) {
      return (
        <div className="flex flex-col justify-between h-full space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                Weekly Variances ({selectedYear}): <span className="font-mono text-amber-400">−{formatGBP(totalWeeklyVariancesSelectedYear)}</span>
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                −{varianceDragPct}% of YTD
              </span>
              {renderInfoButton('weekly_adjustment')}
            </div>
            {renderModeToggleButton('weekly_adjustment')}
          </div>

          {varianceTransactions.length === 0 ? (
            <div className="text-xs text-zinc-500 py-2">No weekly variances logged in {selectedYear}.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {varianceTransactions.map((tx) => {
                const txSharePct = totalWeeklyVariancesSelectedYear > 0
                  ? ((Number(tx.amount) / totalWeeklyVariancesSelectedYear) * 100).toFixed(0)
                  : '0';
                return (
                  <div
                    key={tx.id}
                    onClick={() => toggleSegmentMode('weekly_adjustment')}
                    className="cursor-pointer p-3 rounded-xl bg-zinc-950/85 border border-zinc-800/90 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                  >
                    <div className="text-xs font-semibold text-zinc-200 truncate" title={tx.category}>
                      {tx.category}
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between gap-1">
                      <span className="font-mono text-base font-bold text-amber-400">−{formatGBP(tx.amount)}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                        {txSharePct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100">
                    Weekly Variance ({selectedYear})
                  </h2>
                  {renderInfoButton('weekly_adjustment')}
                </div>
                <p className="text-xs text-zinc-400">
                  Total deducted in {selectedYear}: <strong className="font-mono text-amber-400">−{formatGBP(totalWeeklyVariancesSelectedYear)}</strong>
                </p>
              </div>
            </div>
            {renderModeToggleButton('weekly_adjustment')}
          </div>

          <form onSubmit={handleLogWeeklyVariance} className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Week Starting (Monday)</label>
                <input
                  type="date"
                  value={varianceForm.weekStart}
                  onChange={(e) => setVarianceForm((p) => ({ ...p, weekStart: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Date</label>
                <input
                  type="date"
                  value={varianceForm.date}
                  onChange={(e) =>
                    setVarianceForm((p) => ({
                      ...p,
                      date: e.target.value,
                      weekStart: getMondayOfCurrentWeek(e.target.value)
                    }))
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-7">
                <CreatableSelect
                  value={varianceForm.category}
                  options={varianceCategoryOptions}
                  placeholder="Variance Category"
                  onChange={(val) => setVarianceForm((p) => ({ ...p, category: val }))}
                  onAddCustomOption={(newCat) =>
                    saveSettingKey('custom_variance_categories', [...varianceCategoryOptions, newCat])
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="£ Overspend"
                value={varianceForm.amount}
                onChange={(e) => setVarianceForm((p) => ({ ...p, amount: e.target.value }))}
                className="sm:col-span-5 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </div>

            {!isCompact && (
              <input
                type="text"
                placeholder="Context note (e.g. Week 3 October family guests)"
                value={varianceForm.note}
                onChange={(e) => setVarianceForm((p) => ({ ...p, note: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            )}

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Log under Week of {varianceForm.weekStart}</span>
            </button>
          </form>

          {!isCompact && (
            <div className="mt-3 space-y-1.5">
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {varianceTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-amber-300 border border-zinc-800">
                          Wk: {tx.weekStart || tx.date}
                        </span>
                        <span className="text-zinc-100 font-medium truncate">{tx.category}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {tx.month || tx.date?.slice(0, 7)} • {tx.note}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-semibold text-amber-400">-{formatGBP(tx.amount)}</span>
                      <button
                        type="button"
                        onClick={() => db.transactions.delete(tx.id)}
                        className="text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWidgetById = (id) => {
    switch (id) {
      case 'total_savings':
        return renderTotalSavingsWidget();
      case 'savings_velocity':
        return renderSavingsVelocityWidget();
      case 'upcoming_annual':
        return renderUpcomingAnnualWidget();
      case 'annual_expenditures':
        return renderAnnualExpendituresWidget();
      case 'weekly_adjustment':
        return renderWeeklyAdjustmentWidget();
      default:
        return null;
    }
  };

  const orderedLayout = useMemo(() => {
    const list = Array.isArray(settingsMap.layout) && settingsMap.layout.length > 0
      ? [...settingsMap.layout]
      : [...DEFAULT_WIDGET_LAYOUT];
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [settingsMap.layout]);

  const getColSpanClass = (span) => {
    if (span === 12) return 'lg:col-span-12';
    if (span === 7) return 'lg:col-span-7';
    if (span === 6) return 'lg:col-span-6';
    return 'lg:col-span-5';
  };

  const allCompact = Object.values(segmentModes).every((m) => m === 'compact');

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-zinc-400 font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Loading Household Financial Ledger...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 pb-16">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-zinc-950/90 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeView === 'dashboard' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveView('monthly_planner')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeView === 'monthly_planner' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Monthly Cashflow ({selectedMonth})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('data_ledger')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeView === 'data_ledger' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Data Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeView === 'settings' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Settings & Sync</span>
            </button>
          </div>

          {/* Right Quick Actions: Partner Names Pill, Global Compact/Expand, Clear Demo Data, iPhone Guide */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Clickable Partner Names Badge */}
            <button
              type="button"
              onClick={() => setPartnersModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors"
              title="Click to customize your name and your partner's name"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{settingsMap.my_name} & {settingsMap.partner_name}</span>
            </button>

            {/* Global Compact / Expanded Mode Toggle */}
            <button
              type="button"
              onClick={() => setAllSegmentsMode(allCompact ? 'expanded' : 'compact')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800"
              title="Toggle all segments between Compact and Expanded view"
            >
              {allCompact ? <Maximize2 className="w-3.5 h-3.5 text-emerald-400" /> : <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{allCompact ? 'Expand All' : 'Compact All'}</span>
            </button>

            {!settingsMap.demo_cleared && (
              <button
                type="button"
                onClick={() => setConfirmClearModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Demo Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIosGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">iPhone Ready</span>
            </button>

            {activeView === 'dashboard' && editGridMode && (
              <button
                type="button"
                onClick={async () => {
                  await saveSettingKey('layout', DEFAULT_WIDGET_LAYOUT);
                  showToast('Dashboard layout reset to default.');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Default Grid
              </button>
            )}

            {activeView === 'dashboard' && (
              <button
                type="button"
                onClick={() => setEditGridMode((p) => !p)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  editGridMode
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{editGridMode ? 'Done' : 'Layout'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* DUAL PARTNER PAY DAY REMINDER BAR */}
        {(isMyPayDay || isPartnerPayDay) ? (
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/90 via-zinc-900 to-zinc-900 border border-emerald-500/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-semibold">
                  Pay Day Alert • {isMyPayDay ? `${settingsMap.my_name} (Day ${settingsMap.pay_date})` : ''}{' '}
                  {isMyPayDay && isPartnerPayDay ? '& ' : ''}
                  {isPartnerPayDay ? `${settingsMap.partner_name} (Day ${settingsMap.partner_pay_date})` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSalaryForm((p) => ({
                      ...p,
                      earner: isMyPayDay ? settingsMap.my_name : settingsMap.partner_name
                    }));
                    setPayDayModalOpen(true);
                  }}
                  className="text-left text-sm sm:text-base font-bold text-white hover:text-emerald-300"
                >
                  It is Pay Day. Tap here to log salary or route monthly allocations.
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPayDayModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs"
              >
                Log Salary Now
              </button>
              <button
                type="button"
                onClick={() => setActiveView('monthly_planner')}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-xs border border-zinc-700"
              >
                Open {selectedMonth} Cashflow
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/70 text-xs text-zinc-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                <strong>{settingsMap.my_name} Pay Day:</strong> Day {settingsMap.pay_date}
              </span>
              <span>•</span>
              <span>
                <strong>{settingsMap.partner_name} Pay Day:</strong> Day {settingsMap.partner_pay_date}
              </span>
              <span>•</span>
              <span>
                <strong>FY:</strong> {financialYearLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPayDayModalOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Log Payday Manually
            </button>
          </div>
        )}

        {/* ====================================================================
            VIEW 1: DASHBOARD
           ==================================================================== */}
        {activeView === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {orderedLayout.map((widget) => {
              const isSegCompact = segmentModes[widget.id] === 'compact';
              return (
                <div
                  key={widget.id}
                  draggable={editGridMode}
                  onDragStart={() => setDraggedWidgetId(widget.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedWidgetId && draggedWidgetId !== widget.id) setDragOverWidgetId(widget.id);
                  }}
                  onDragLeave={() => setDragOverWidgetId(null)}
                  onDrop={async () => {
                    if (!draggedWidgetId || draggedWidgetId === widget.id) return;
                    const items = [...orderedLayout];
                    const fromIdx = items.findIndex((w) => w.id === draggedWidgetId);
                    const toIdx = items.findIndex((w) => w.id === widget.id);
                    if (fromIdx < 0 || toIdx < 0) return;
                    const [moved] = items.splice(fromIdx, 1);
                    items.splice(toIdx, 0, moved);
                    setDraggedWidgetId(null);
                    setDragOverWidgetId(null);
                    const normalized = items.map((it, i) => ({ ...it, order: i }));
                    await saveSettingKey('layout', normalized);
                  }}
                  style={{ minHeight: isSegCompact ? 'auto' : `${widget.minHeight || 240}px` }}
                  className={`col-span-1 ${getColSpanClass(widget.colSpan)} ${isSegCompact ? 'p-4' : 'p-5'} relative rounded-2xl bg-zinc-900/75 border border-zinc-800/90 hover:border-zinc-700 flex flex-col justify-between shadow-xl transition-all`}
                >
                  {editGridMode && (
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800 text-xs">
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <GripHorizontal className="w-4 h-4" /> Drag Card
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const spans = [5, 6, 7, 12];
                          const next = orderedLayout.map((w) =>
                            w.id === widget.id ? { ...w, colSpan: spans[(spans.indexOf(w.colSpan) + 1) % spans.length] } : w
                          );
                          await saveSettingKey('layout', next);
                        }}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono text-[11px]"
                      >
                        Width: {widget.colSpan}/12
                      </button>
                    </div>
                  )}
                  {renderWidgetById(widget.id)}
                </div>
              );
            })}
          </div>
        )}

        {/* ====================================================================
            VIEW 2: MONTHLY CASHFLOW & POST-PAYDAY ROUTER
           ==================================================================== */}
        {activeView === 'monthly_planner' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white">
                      Monthly Cashflow & Post-Payday Router
                    </h1>
                    {renderInfoButton('monthly_planner')}
                    {renderModeToggleButton('monthly_planner')}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Savings transfers logged here automatically power your <strong>Savings Velocity</strong> and <strong>Annual Savings YTD</strong> on the Dashboard.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = selectedMonth.split('-').map(Number);
                      const prev = new Date(y, m - 2, 1);
                      const str = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
                      setSelectedMonth(str);
                      setSelectedYear(prev.getFullYear());
                    }}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedMonth(e.target.value);
                        setSelectedYear(Number(e.target.value.slice(0, 4)));
                      }
                    }}
                    className="bg-transparent px-3 py-1 text-sm font-mono font-bold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = selectedMonth.split('-').map(Number);
                      const next = new Date(y, m, 1);
                      const str = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
                      setSelectedMonth(str);
                      setSelectedYear(next.getFullYear());
                    }}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCloneMonthToNext}
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 border border-zinc-700"
                >
                  Clone {selectedMonth} → Next Month
                </button>

                <button
                  type="button"
                  onClick={handleExecutePostPaydayTransfers}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Execute {selectedMonth} Pot Transfers</span>
                </button>
              </div>
            </div>

            {/* 5-Card Cashflow Equation Summary (Compact KPI tiles with header + number + % of income) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-zinc-400">Inflows</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">100%</span>
                </div>
                <div className="font-mono text-xl font-bold text-emerald-400 mt-2">
                  +{formatGBP(monthlySummary.income)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-zinc-400">Fixed Bills</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {monthlySummary.income > 0 ? ((monthlySummary.fixedOut / monthlySummary.income) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-white mt-2">
                  −{formatGBP(monthlySummary.fixedOut)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-zinc-400">Variable</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                    {monthlySummary.income > 0 ? ((monthlySummary.variableOut / monthlySummary.income) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-amber-300 mt-2">
                  −{formatGBP(monthlySummary.variableOut)}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-zinc-400">Savings</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                    {monthlySummary.income > 0 ? ((monthlySummary.savingsTransfers / monthlySummary.income) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-indigo-300 mt-2">
                  −{formatGBP(monthlySummary.savingsTransfers)}
                </div>
              </div>
              <div
                className={`col-span-2 sm:col-span-1 p-3.5 rounded-2xl border flex flex-col justify-between ${
                  monthlySummary.unallocated === 0
                    ? 'bg-emerald-950/30 border-emerald-500/40'
                    : 'bg-zinc-900/80 border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-zinc-300">Unrouted</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {monthlySummary.income > 0 ? ((monthlySummary.unallocated / monthlySummary.income) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-white mt-2">
                  {formatGBP(monthlySummary.unallocated)}
                </div>
              </div>
            </div>

            {segmentModes.monthly_planner === 'compact' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {currentMonthRows.map((row) => {
                  const rowAmt = Number(row.actual ?? row.planned) || 0;
                  const pctOfInc = monthlySummary.income > 0 ? ((rowAmt / monthlySummary.income) * 100).toFixed(0) : '0';
                  return (
                    <div
                      key={row.id}
                      onClick={() => toggleSegmentMode('monthly_planner')}
                      className="cursor-pointer p-3.5 rounded-xl bg-zinc-900/85 border border-zinc-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-zinc-200 truncate" title={row.category}>
                          {row.category}
                        </span>
                        <span className="text-[10px] text-zinc-400 shrink-0">{row.owner}</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-1">
                        <span
                          className={`font-mono text-base sm:text-lg font-bold ${
                            row.flow === 'income'
                              ? 'text-emerald-400'
                              : row.flow === 'savings_transfer'
                              ? 'text-indigo-300'
                              : 'text-white'
                          }`}
                        >
                          {row.flow === 'income' ? '+' : '−'}{formatGBP(rowAmt)}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800">
                          {pctOfInc}% inc
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Add New Monthly Row Form with Custom Owner Option */}
                <form
                  onSubmit={handleAddMonthlyBudgetRow}
                  className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-400 mb-1">Flow Type</label>
                    <select
                      value={newBudgetRow.flow}
                      onChange={(e) => setNewBudgetRow((p) => ({ ...p, flow: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      <option value="income">Income / Salary (+)</option>
                      <option value="fixed_outflow">Fixed Bill (-)</option>
                      <option value="variable_outflow">Variable Budget (-)</option>
                      <option value="savings_transfer">Savings Transfer (-)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-zinc-400 mb-1">Category / Line Item</label>
                    <input
                      type="text"
                      placeholder="e.g. Sam Salary, Nursery, ISA Transfer"
                      value={newBudgetRow.category}
                      onChange={(e) => setNewBudgetRow((p) => ({ ...p, category: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-400 mb-1">Owner / Earner</label>
                    <CreatableSelect
                      value={newBudgetRow.owner}
                      options={ownerOptions}
                      placeholder="Person/Owner"
                      onChange={(val) => setNewBudgetRow((p) => ({ ...p, owner: val }))}
                      onAddCustomOption={(newOwner) =>
                        saveSettingKey('custom_owners', [...ownerOptions, newOwner])
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-400 mb-1">Planned (£)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="e.g. 850"
                      value={newBudgetRow.planned}
                      onChange={(e) => setNewBudgetRow((p) => ({ ...p, planned: e.target.value, actual: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-400 mb-1">Target Account / Pot</label>
                    <select
                      value={newBudgetRow.destinationAccountId}
                      onChange={(e) => setNewBudgetRow((p) => ({ ...p, destinationAccountId: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-2 text-xs text-white"
                    >
                      <option value="">None / General</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.owner})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </form>

                {/* Monthly Cashflow Table */}
                <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400">
                          <th className="py-3 px-4">Flow</th>
                          <th className="py-3 px-4">Category / Description</th>
                          <th className="py-3 px-4">Owner</th>
                          <th className="py-3 px-4">Target Pot / Account</th>
                          <th className="py-3 px-4 text-right">Planned (£)</th>
                          <th className="py-3 px-4 text-right">Actual (£)</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {currentMonthRows.map((row) => {
                          const destAcc = accounts.find((a) => a.id === row.destinationAccountId);
                          return (
                            <tr key={row.id} className="hover:bg-zinc-800/40">
                              <td className="py-2.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    row.flow === 'income'
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : row.flow === 'savings_transfer'
                                      ? 'bg-indigo-500/15 text-indigo-300'
                                      : row.flow === 'fixed_outflow'
                                      ? 'bg-zinc-800 text-zinc-300'
                                      : 'bg-amber-500/15 text-amber-300'
                                  }`}
                                >
                                  {row.flow.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-zinc-100">
                                {row.category}
                                {row.notes && <span className="block text-[11px] text-zinc-400 font-normal">{row.notes}</span>}
                              </td>
                              <td className="py-2.5 px-4 text-zinc-300">{row.owner || 'Joint'}</td>
                              <td className="py-2.5 px-4 text-zinc-400">
                                {destAcc ? `${destAcc.name} (${destAcc.owner})` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-zinc-300">
                                {formatGBP(row.planned)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <input
                                  type="number"
                                  value={row.actual ?? row.planned}
                                  onChange={(e) =>
                                    db.monthly_budgets.update(row.id, { actual: parseFloat(e.target.value) || 0 })
                                  }
                                  className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-right font-mono text-white"
                                />
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => db.monthly_budgets.delete(row.id)}
                                  className="text-zinc-500 hover:text-rose-400"
                                >
                                  <Trash2 className="w-4 h-4 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ====================================================================
            VIEW 3: FULL DATA SHEET (Now with Month Dropdown & Compact/Expanded Mode)
           ==================================================================== */}
        {activeView === 'data_ledger' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Table className="w-5 h-5 text-cyan-400" />
                  <h1 className="text-xl font-bold text-white">
                    Simplified Master Data Sheet (All Years & Months)
                  </h1>
                  {renderModeToggleButton('data_ledger')}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Filter by Section, Year, and Month across every asset, monthly budget row, annual expenditure, and weekly variance.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download as CSV / Excel</span>
              </button>
            </div>

            {/* Filter Bar with Section, Year Dropdown, AND Month Dropdown */}
            <div className="flex flex-wrap items-center gap-3 bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
              <select
                value={ledgerSectionFilter}
                onChange={(e) => setLedgerSectionFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="ALL">All Data Sections</option>
                <option value="Assets">Assets & ISAs</option>
                <option value="Monthly">Monthly Cashflow Rows</option>
                <option value="Annual">Annual / One-Time Expenses</option>
                <option value="Weekly">Weekly Variances & Allocations</option>
              </select>

              <select
                value={ledgerYearFilter}
                onChange={(e) => setLedgerYearFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              >
                <option value="ALL">All Years</option>
                {allAvailableYears.map((y) => (
                  <option key={y} value={String(y)}>
                    Year {y}
                  </option>
                ))}
              </select>

              {/* Dedicated Month Dropdown in Full Data Sheet */}
              <select
                value={ledgerMonthFilter}
                onChange={(e) => setLedgerMonthFilter(e.target.value)}
                className="bg-zinc-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs font-medium text-emerald-300"
              >
                <option value="ALL">All Months (Jan–Dec)</option>
                {MONTH_NAMES.map((mName, idx) => {
                  const mm = String(idx + 1).padStart(2, '0');
                  return (
                    <option key={mm} value={mm}>
                      {mm} — {mName}
                    </option>
                  );
                })}
              </select>

              <input
                type="text"
                placeholder="Search category, item, holder, week..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="flex-1 min-w-[180px] bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/90 text-[11px] uppercase tracking-wider text-zinc-400">
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4">Year / Month</th>
                      {segmentModes.data_ledger !== 'compact' && <th className="py-3 px-4">Week / Date</th>}
                      <th className="py-3 px-4">Holder / Scope</th>
                      <th className="py-3 px-4">Category</th>
                      {segmentModes.data_ledger !== 'compact' && <th className="py-3 px-4">Item / Account</th>}
                      <th className="py-3 px-4 text-right">Amount (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {[
                      ...accounts.map((a) => ({
                        id: a.id,
                        section: 'Assets',
                        year: String((a.lastUpdatedDate || '2026').slice(0, 4)),
                        monthNum: (a.lastUpdatedDate || '2026-10').slice(5, 7),
                        period: (a.lastUpdatedDate || '2026-10').slice(0, 7),
                        date: `Updated: ${a.lastUpdatedDate || '—'}`,
                        holder: `${a.owner || 'Joint'} (${a.isUntouchable ? 'Untouchable' : 'Spendable'})`,
                        category: a.institution,
                        title: `${a.name} (${a.interestRate || 0}% AER)`,
                        amount: a.balance
                      })),
                      ...monthlyBudgets.map((m) => ({
                        id: m.id,
                        section: 'Monthly',
                        year: (m.month || '').slice(0, 4),
                        monthNum: (m.month || '').slice(5, 7),
                        period: m.month,
                        date: m.flow,
                        holder: m.owner || 'Joint',
                        category: m.category,
                        title: m.notes || m.flow,
                        amount: m.actual ?? m.planned
                      })),
                      ...annualExpenses.map((e) => ({
                        id: e.id,
                        section: 'Annual',
                        year: String(e.year || (e.date || '').slice(0, 4)),
                        monthNum: (e.date || '').slice(5, 7),
                        period: (e.date || '').slice(0, 7),
                        date: `${e.date} (${e.status || 'paid'})`,
                        holder: 'Household',
                        category: e.category,
                        title: e.title,
                        amount: e.amount
                      })),
                      ...transactions.map((t) => ({
                        id: t.id,
                        section: 'Weekly',
                        year: String(t.year || (t.date || '').slice(0, 4)),
                        monthNum: (t.month || t.date || '').slice(5, 7),
                        period: t.month || (t.date || '').slice(0, 7),
                        date: t.weekStart ? `Wk ${t.weekStart}` : t.date,
                        holder: t.type === 'weekly_variance' ? 'Variance (-)' : 'Payday (+)',
                        category: t.category,
                        title: t.note || '',
                        amount: t.amount
                      }))
                    ]
                      .filter((r) => ledgerSectionFilter === 'ALL' || r.section === ledgerSectionFilter)
                      .filter((r) => ledgerYearFilter === 'ALL' || r.year === ledgerYearFilter)
                      .filter((r) => ledgerMonthFilter === 'ALL' || r.monthNum === ledgerMonthFilter)
                      .filter(
                        (r) =>
                          !ledgerSearch.trim() ||
                          `${r.category} ${r.title} ${r.holder} ${r.period} ${r.date}`
                            .toLowerCase()
                            .includes(ledgerSearch.toLowerCase())
                      )
                      .map((row) => (
                        <tr key={row.id} className="hover:bg-zinc-800/40">
                          <td className="py-2 px-4 font-semibold text-cyan-300">{row.section}</td>
                          <td className="py-2 px-4 font-mono text-zinc-300">{row.period}</td>
                          {segmentModes.data_ledger !== 'compact' && (
                            <td className="py-2 px-4 font-mono text-zinc-400">{row.date}</td>
                          )}
                          <td className="py-2 px-4 text-zinc-300">{row.holder}</td>
                          <td className="py-2 px-4 text-zinc-200 font-medium">{row.category}</td>
                          {segmentModes.data_ledger !== 'compact' && (
                            <td className="py-2 px-4 text-zinc-300">{row.title}</td>
                          )}
                          <td className="py-2 px-4 text-right font-mono font-bold text-white">
                            {formatGBP(row.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            VIEW 4: SETTINGS, PARTNER NAMES, DUAL PAYDAYS & CUSTOMIZABLE DROPDOWNS
           ==================================================================== */}
        {activeView === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              {/* Partner Names & Dual Pay Dates */}
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Your Name, Partner Name & Pay Dates</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Renaming either partner automatically updates their name across all accounts, ISAs, and monthly cashflow rows.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={settingsMap.my_name}
                      onChange={(e) => handleRenamePartner('my_name', settingsMap.my_name, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">{settingsMap.my_name}'s Pay Day (1–31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={settingsMap.pay_date}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(31, Number(e.target.value) || 1));
                        saveSettingKey('pay_date', val);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Partner's Name</label>
                    <input
                      type="text"
                      value={settingsMap.partner_name}
                      onChange={(e) => handleRenamePartner('partner_name', settingsMap.partner_name, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">{settingsMap.partner_name}'s Pay Day (1–31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={settingsMap.partner_pay_date}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(31, Number(e.target.value) || 1));
                        saveSettingKey('partner_pay_date', val);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Year & Financial Month Boundaries */}
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Financial Year & Month Boundaries</span>
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Financial Year Starts In</label>
                    <select
                      value={settingsMap.fy_start_month}
                      onChange={(e) => saveSettingKey('fy_start_month', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m} (ends {MONTH_NAMES[(i + 11) % 12]})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Financial Month Start Day</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={settingsMap.fm_start_day}
                      onChange={(e) => saveSettingKey('fm_start_day', Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sync, Backup & Reset */}
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  <span>Peer-to-Peer Sync, CSV & Demo Reset</span>
                </h2>

                <button
                  type="button"
                  onClick={handleGenerateSyncFile}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Generate Sync File (JSON + Native Share)</span>
                </button>

                <label className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-xs flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Import Partner Sync File (Merge by UUID)</span>
                  <input type="file" accept=".json,application/json" onChange={handleImportSyncFile} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 border border-zinc-800"
                >
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>Export to CSV (Google Sheets Columns)</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await saveSettingKey('layout', DEFAULT_WIDGET_LAYOUT);
                    showToast('Dashboard layout reset to default.');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 border border-zinc-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Dashboard Layout to Default
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmClearModal(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 border border-rose-500/30"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All Demo Data (Start Fresh)</span>
                </button>
              </div>
            </div>

            {/* Right Column: Asset CRUD with Custom Type & Custom Owner Dropdowns */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Asset Locations, Holder Names & Interest Rates (AER %)
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Every dropdown below includes a <strong>+ Custom...</strong> option so you can add any custom account type or holder name.
                  </p>
                </div>

                <form onSubmit={handleSaveAccount} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Account / Pot Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Vanguard Shares ISA"
                        value={accountForm.name}
                        onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Institution</label>
                      <input
                        type="text"
                        placeholder="e.g. Monzo, Vanguard, Chase"
                        value={accountForm.institution}
                        onChange={(e) => setAccountForm((p) => ({ ...p, institution: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Whose Name Is It On?</label>
                      <CreatableSelect
                        value={accountForm.owner}
                        options={ownerOptions}
                        placeholder="Holder Name"
                        onChange={(val) => setAccountForm((p) => ({ ...p, owner: val }))}
                        onAddCustomOption={(newOwner) =>
                          saveSettingKey('custom_owners', [...ownerOptions, newOwner])
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Account Type (+ Custom)</label>
                      <CreatableSelect
                        value={accountForm.type}
                        options={accountTypeOptions}
                        placeholder="Account Type"
                        onChange={(val) => setAccountForm((p) => ({ ...p, type: val }))}
                        onAddCustomOption={(newType) =>
                          saveSettingKey('custom_account_types', [...accountTypeOptions, newType])
                        }
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Balance (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={accountForm.balance}
                        onChange={(e) => setAccountForm((p) => ({ ...p, balance: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Interest (AER %)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={accountForm.interestRate}
                        onChange={(e) => setAccountForm((p) => ({ ...p, interestRate: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Last Updated Date</label>
                      <input
                        type="date"
                        value={accountForm.lastUpdatedDate}
                        onChange={(e) => setAccountForm((p) => ({ ...p, lastUpdatedDate: e.target.value }))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={accountForm.isUntouchable}
                        onChange={(e) => setAccountForm((p) => ({ ...p, isUntouchable: e.target.checked }))}
                        className="rounded accent-indigo-500"
                      />
                      <span>
                        <strong>Untouchable Asset</strong> (Include in Total Savings, exclude from Spendable Annual Pool)
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs"
                    >
                      {editingAccountId ? 'Save Changes' : 'Add Account'}
                    </button>
                  </div>
                </form>

                <div className="space-y-2.5">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{acc.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300">
                            {acc.owner || 'Joint'}
                          </span>
                          {acc.isUntouchable && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300">
                              Untouchable
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {acc.institution} • {acc.type} • <strong className="text-emerald-400">{acc.interestRate || 0}% AER</strong> • Updated {acc.lastUpdatedDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-white">{formatGBP(acc.balance)}</span>
                        <button
                          type="button"
                          onClick={() => startEditAccount(acc)}
                          className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => db.accounts.delete(acc.id)}
                          className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================================
          MODAL: QUICK PARTNER NAMES & PAY DATES EDITOR (Accessible from Top Bar)
         ====================================================================== */}
      {partnersModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Customize Your & Your Partner's Names</h3>
              </div>
              <button type="button" onClick={() => setPartnersModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Set specific names for you and your partner. Every account, ISA, and monthly cashflow dropdown will immediately use your real names.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Your Name</label>
                <input
                  type="text"
                  value={settingsMap.my_name}
                  onChange={(e) => handleRenamePartner('my_name', settingsMap.my_name, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">{settingsMap.my_name}'s Pay Day</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settingsMap.pay_date}
                  onChange={(e) => saveSettingKey('pay_date', Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Partner's Name</label>
                <input
                  type="text"
                  value={settingsMap.partner_name}
                  onChange={(e) => handleRenamePartner('partner_name', settingsMap.partner_name, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">{settingsMap.partner_name}'s Pay Day</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settingsMap.partner_pay_date}
                  onChange={(e) => saveSettingKey('partner_pay_date', Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPartnersModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs"
              >
                Save Names
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: `i` INFO EXPLAINER */}
      {activeExplainerKey && INFO_EXPLAINERS[activeExplainerKey] && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {INFO_EXPLAINERS[activeExplainerKey].title}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveExplainerKey(null)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold mb-1">What This Is</div>
                <p className="text-zinc-200 leading-relaxed">{INFO_EXPLAINERS[activeExplainerKey].what}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-[11px] uppercase tracking-wider text-indigo-400 font-bold mb-1">How It Is Computed</div>
                <pre className="font-mono text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {INFO_EXPLAINERS[activeExplainerKey].formula}
                </pre>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold mb-1">How To Change It</div>
                <p className="text-zinc-200 leading-relaxed">{INFO_EXPLAINERS[activeExplainerKey].howToChange}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveExplainerKey(null)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: iPHONE GUIDE */}
      {iosGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">iPhone & Safari Setup</h3>
              </div>
              <button type="button" onClick={() => setIosGuideOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="font-bold text-emerald-400">1. Protected Against 7-Day Safari Eviction</div>
                <p>
                  Calls <code className="font-mono text-zinc-100">navigator.storage.persist()</code> ({storagePersisted ? 'Granted' : 'Active'}) on startup and mirrors IndexedDB so iOS Safari does not clear your multi-year records.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="font-bold text-cyan-400">2. Install to iPhone Home Screen</div>
                <p>Tap <strong>Share</strong> in Safari → <strong>Add to Home Screen</strong> for full-screen standalone mode.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIosGuideOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAY DAY SALARY & ALLOCATION */}
      {payDayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Log Salary & Post-Payday Allocations</h3>
              <button type="button" onClick={() => setPayDayModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogSalaryAndAllocations} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Earner (+ Custom)</label>
                  <CreatableSelect
                    value={salaryForm.earner}
                    options={ownerOptions}
                    placeholder="Earner Name"
                    onChange={(val) => setSalaryForm((p) => ({ ...p, earner: val }))}
                    onAddCustomOption={(newOwner) =>
                      saveSettingKey('custom_owners', [...ownerOptions, newOwner])
                    }
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Budget Month</label>
                  <input
                    type="month"
                    value={salaryForm.month}
                    onChange={(e) => setSalaryForm((p) => ({ ...p, month: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Net Salary Received (£)</label>
                <input
                  type="number"
                  value={salaryForm.netSalary}
                  onChange={(e) => setSalaryForm((p) => ({ ...p, netSalary: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Primary Savings Transfer (£)</label>
                  <input
                    type="number"
                    value={salaryForm.primaryTransfer}
                    onChange={(e) => setSalaryForm((p) => ({ ...p, primaryTransfer: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Target Account</label>
                  <select
                    value={salaryForm.targetAccountId}
                    onChange={(e) => setSalaryForm((p) => ({ ...p, targetAccountId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.owner})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Secondary Pot Transfer (£)</label>
                  <input
                    type="number"
                    value={salaryForm.secondaryTransfer}
                    onChange={(e) => setSalaryForm((p) => ({ ...p, secondaryTransfer: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Secondary Pot</label>
                  <select
                    value={salaryForm.secondaryAccountId}
                    onChange={(e) => setSalaryForm((p) => ({ ...p, secondaryAccountId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.owner})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayDayModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold"
                >
                  Confirm & Allocate Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / SCHEDULE ANNUAL EXPENDITURE (With Custom Category Dropdown & Expandable Year) */}
      {newCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Add / Schedule Annual Expenditure</h3>
              <button type="button" onClick={() => setNewCategoryModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewExpenseCategory} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Year (Any Future Year)</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={newCategoryForm.year}
                    onChange={(e) => setNewCategoryForm((p) => ({ ...p, year: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Status</label>
                  <select
                    value={newCategoryForm.status}
                    onChange={(e) => setNewCategoryForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="upcoming">Upcoming (Queue & Check Funds)</option>
                    <option value="paid">Already Paid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Category (+ Custom)</label>
                <CreatableSelect
                  value={newCategoryForm.category}
                  options={expenseCategoryOptions}
                  placeholder="Expenditure Category"
                  onChange={(val) => setNewCategoryForm((p) => ({ ...p, category: val }))}
                  onAddCustomOption={(newCat) =>
                    saveSettingKey('custom_expense_categories', [...expenseCategoryOptions, newCat])
                  }
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Line Item Description</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Multi-Car Policy Renewal"
                  value={newCategoryForm.title}
                  onChange={(e) => setNewCategoryForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCategoryForm.amount}
                    onChange={(e) => setNewCategoryForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Due / Payment Date</label>
                  <input
                    type="date"
                    value={newCategoryForm.date}
                    onChange={(e) =>
                      setNewCategoryForm((p) => ({
                        ...p,
                        date: e.target.value,
                        year: Number(e.target.value.slice(0, 4)) || p.year
                      }))
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ONE-TIME CLEAR DEMO DATA */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-rose-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Clear All Demo Data?</h3>
              </div>
              <button type="button" onClick={() => setConfirmClearModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              This wipes all demo accounts, sample monthly budgets, annual expenses, and weekly variances so you and {settingsMap.partner_name} can start from a clean slate.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-xs text-zinc-300"
              >
                Keep Demo Data
              </button>
              <button
                type="button"
                onClick={handleClearAllDemoData}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold text-xs"
              >
                Yes, Wipe Demo Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-zinc-900/95 border border-zinc-700 px-4 py-3 shadow-2xl flex items-center gap-3">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs text-zinc-100 font-medium">{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}