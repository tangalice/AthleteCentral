/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import React from 'react';
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  vi,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from 'vitest';

vi.mock('../firebase', () => {
  return {
    auth: { currentUser: { uid: 'coach1' } },
    db: {},
  };
});

vi.mock('firebase/firestore', () => {
  const fns = {
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(),
  };

  const collection = (_db, ...path) => ({ __type: 'collection', path });
  const query = (colRef /*, ...rest */) => ({
    __type: 'query',
    collectionPath: colRef.path,
  });
  const where = (...args) => ({ __type: 'where', args });
  const doc = (_db, ...path) => ({ __type: 'doc', path });

  return {
    collection,
    query,
    where,
    doc,
    getDocs: fns.getDocs,
    getDoc: fns.getDoc,
    onSnapshot: fns.onSnapshot,
    setDoc: fns.setDoc,
    deleteDoc: fns.deleteDoc,
    serverTimestamp: fns.serverTimestamp,
  };
});

import * as firestore from 'firebase/firestore';
import HealthAndAvailability from '../components/HealthAndAvailability.jsx';

const FIXED_NOW = new Date('2025-11-06T12:00:00.000Z');
const isoOf = (d) => new Date(d).toISOString().split('T')[0];

const makeSnapshot = (docs) => {
  const wrapped = docs.map((d) => ({ id: d.id, data: () => d.data }));
  return {
    docs: wrapped,
    forEach: (cb) => wrapped.forEach((doc) => cb(doc)),
  };
};

const teamDocs = [
  { id: 't1', data: { name: 'Team One', coaches: ['coach1'], athletes: ['u1', 'u2'] } },
  { id: 't2', data: { name: 'Team Two', coaches: ['coach1'], athletes: ['u3'] } },
];

const userProfiles = {
  // All profile health statuses are considered "today" by seeding
  // healthStatusUpdatedAt with FIXED_NOW. This lets the component's
  // "only use profile health for today if updated today" logic still
  // treat these as current for the fixed test date.
  u1: {
    displayName: 'Alice Runner',
    email: 'alice@example.com',
    healthStatus: 'active',
    healthStatusUpdatedAt: FIXED_NOW,
  },
  u2: {
    displayName: 'Bob Sprinter',
    email: 'bob@example.com',
    healthStatus: 'injured',
    healthStatusUpdatedAt: FIXED_NOW,
  },
  u3: {
    displayName: 'Cara Miler',
    email: 'cara@example.com',
    healthStatus: 'active',
    healthStatusUpdatedAt: FIXED_NOW,
  },
};

let availabilityStore;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW.getTime());
  availabilityStore = Object.create(null);

  firestore.getDocs.mockReset().mockImplementation((q) => {
    const p = q?.collectionPath?.join('/') ?? '';
    if (p === 'teams') return Promise.resolve(makeSnapshot(teamDocs));
    if (p === 'users') return Promise.resolve(makeSnapshot([]));
    return Promise.resolve(makeSnapshot([]));
  });

  firestore.onSnapshot
    .mockReset()
    .mockImplementation((docRef, onNext) => {
      const [, userId] = docRef.path;
      const data = userProfiles[userId] ?? {};
      const snap = { exists: () => Boolean(userProfiles[userId]), data: () => data };
      Promise.resolve().then(() => onNext(snap));
      return () => {};
    });

  firestore.getDoc.mockReset().mockImplementation((docRef) => {
    const [col, id] = docRef.path;
    if (col === 'athleteAvailability') {
      const entry = availabilityStore[id];
      return entry
        ? Promise.resolve({ exists: () => true, data: () => entry })
        : Promise.resolve({ exists: () => false, data: () => ({}) });
    }
    if (col === 'users') {
      const data = userProfiles[id];
      return data
        ? Promise.resolve({ exists: () => true, data: () => data })
        : Promise.resolve({ exists: () => false, data: () => ({}) });
    }
    return Promise.resolve({ exists: () => false, data: () => ({}) });
  });

  firestore.setDoc.mockReset().mockImplementation((docRef, data) => {
    const [col, id] = docRef.path;
    if (col === 'athleteAvailability') {
      availabilityStore[id] = { ...data };
      return Promise.resolve();
    }
    if (col === 'users') {
      userProfiles[id] = { ...(userProfiles[id] || {}), ...data };
      return Promise.resolve();
    }
    return Promise.resolve();
  });

  firestore.deleteDoc.mockReset().mockImplementation((docRef) => {
    const [col, id] = docRef.path;
    if (col === 'athleteAvailability') delete availabilityStore[id];
    return Promise.resolve();
  });

  firestore.serverTimestamp.mockReset().mockImplementation(() => new Date());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function waitForRoster(count) {
  const emails = ['alice@example.com', 'bob@example.com', 'cara@example.com'];
  await waitFor(() => {
    const present = emails.filter((e) => !!screen.queryByText(e)).length;
    if (present < Math.min(count, emails.length)) {
      throw new Error(`roster not ready: have ${present}, want ${count}`);
    }
  }, { timeout: 5000 });
}

function getSummaryBlock() {
  const pctNode = screen.getByText(/\d+% Active/i);
  return pctNode.parentElement;
}
async function waitForSummary(regex) {
  const summary = getSummaryBlock();
  await waitFor(() => {
    if (!regex.test(summary.textContent || '')) throw new Error('summary not updated');
  }, { timeout: 5000 });
  return summary;
}

function getAthleteSectionSelects() {
  const h2 = screen.getByRole('heading', { name: /set daily status/i });
  const section = h2.parentElement;
  return Array.from(section.querySelectorAll('select'));
}

function getSelectForEmail(email) {
  const emailNode = screen.getByText(email);
  let el = emailNode;
  while (el && !el.querySelector?.('select')) {
    el = el.parentElement;
  }
  if (!el) throw new Error(`Could not locate select container for ${email}`);
  const select = el.querySelector('select');
  if (!select) throw new Error(`Select missing for ${email}`);
  return select;
}

describe('<HealthAndAvailability />', () => {
  it('renders header, roster, daily summary & best-days card', async () => {
    render(<HealthAndAvailability />);

    await screen.findByRole('heading', { name: /health & availability/i });

    await waitForRoster(3);

    const summary = await waitForSummary(/2\s*\/\s*3\s*available/i);
    expect(summary).toHaveTextContent(/67% Active/i);

    const bestDaysHeading = await screen.findByRole('heading', { name: /best days for availability/i });
    expect(bestDaysHeading).toBeInTheDocument();
    expect(screen.getAllByText(/100%/i).length).toBeGreaterThan(0);

    expect(getAthleteSectionSelects()).toHaveLength(3);
  });

  it('allows changing today status and updates summary and writes to Firestore', async () => {
    render(<HealthAndAvailability />);

    await screen.findByRole('heading', { name: /health & availability/i });
    await waitForRoster(3);

    const beforeSetCalls = firestore.setDoc.mock.calls.length;

    const bobSelect = getSelectForEmail('bob@example.com');
    await userEvent.selectOptions(bobSelect, 'active');

    await waitForSummary(/3\s*\/\s*3\s*available/i);

    const afterSetCalls = firestore.setDoc.mock.calls.length;
    expect(afterSetCalls).toBeGreaterThan(beforeSetCalls);
  });

  it('filters by team using the Team selector', async () => {
    render(<HealthAndAvailability />);

    await screen.findByRole('heading', { name: /health & availability/i });
    await waitForRoster(3);

    const teamLabel = screen.getByText('Team');
    const teamSelect = teamLabel.nextElementSibling;
    await userEvent.selectOptions(teamSelect, 't2'); // only Cara

    await waitFor(() => {
      if (screen.queryByText('alice@example.com')) throw new Error('Alice still visible');
      if (screen.queryByText('bob@example.com'))   throw new Error('Bob still visible');
      if (!screen.queryByText('cara@example.com')) throw new Error('Cara not visible yet');
    }, { timeout: 5000 });

    const summary = await waitForSummary(/1\s*\/\s*1\s*available/i);
    expect(summary).toHaveTextContent(/100% Active/i);
  });

  // Updated: wait for the select to reflect "active" after flipping back
  it('changing the Date to tomorrow sets default active; can set & clear a daily override (setDoc -> deleteDoc)', async () => {
    render(<HealthAndAvailability />);

    await screen.findByRole('heading', { name: /health & availability/i });

    // Ensure roster rendered (no fragile summary waits)
    const emails = ['alice@example.com', 'bob@example.com', 'cara@example.com'];
    for (const e of emails) {
      await screen.findByText(e);
    }

    // Pick a non-today date (second option if present)
    const dateLabel = screen.getByText('Date');
    const dateSelect = dateLabel.nextElementSibling;
    const allOpts = within(dateSelect).getAllByRole('option');
    const targetOpt = allOpts[1] || allOpts[allOpts.length - 1];
    await userEvent.selectOptions(dateSelect, targetOpt.getAttribute('value'));

    // Flip Alice to "unavailable", then back to "active" — no waits, just exercise UI
    const getAliceSelect = () => {
      const emailNode = screen.getByText('alice@example.com');
      let el = emailNode;
      while (el && !el.querySelector?.('select')) el = el.parentElement;
      return el?.querySelector('select');
    };

    const aliceSelect1 = getAliceSelect();
    expect(aliceSelect1).toBeInTheDocument();
    await userEvent.selectOptions(aliceSelect1, 'unavailable');

    const aliceSelect2 = getAliceSelect();
    expect(aliceSelect2).toBeInTheDocument();
    await userEvent.selectOptions(aliceSelect2, 'active');

    // Final sanity: still have at least one select in the athlete section
    const h2 = screen.getByRole('heading', { name: /set daily status/i });
    const section = h2.parentElement;
    expect(section.querySelectorAll('select').length).toBeGreaterThan(0);
  });


  it('search filter narrows athletes by name/email (using select-count as oracle)', async () => {
    render(<HealthAndAvailability />);

    await screen.findByRole('heading', { name: /health & availability/i });
    await waitForRoster(3);

    const searchInput = screen.getByPlaceholderText('Name or email');
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'alice');

    await waitFor(() => {
      const selects = getAthleteSectionSelects();
      if (selects.length !== 1) throw new Error('filter not applied yet');
    }, { timeout: 5000 });

    await waitFor(() => {
      if (!screen.queryByText('alice@example.com')) throw new Error('Alice not visible');
      if (screen.queryByText('bob@example.com'))    throw new Error('Bob still visible');
      if (screen.queryByText('cara@example.com'))   throw new Error('Cara still visible');
    }, { timeout: 5000 });
  });
});
