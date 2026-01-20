import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryPage from '../src/app/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the fetch API
global.fetch = jest.fn();

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock Lucide icons
jest.mock('lucide-react', () => {
  const React = require('react')
  return new Proxy(
    {},
    {
      get: (_target, prop) => () =>
        React.createElement('div', { 'data-testid': `lucide-${String(prop)}` }),
    }
  )
})

// Mock components that might cause issues in JSDOM
jest.mock('../src/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar-component" />,
}));

// Create a client for testing
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithClient = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
};

describe('InventoryPage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    // Mock successful fetch response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it('renders the inventory management page title', async () => {
    renderWithClient(<InventoryPage />);
    expect(screen.getByText('Inventory Management')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    renderWithClient(<InventoryPage />);
    expect(screen.getByText('Export Excel')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Import from Excel')).toBeInTheDocument();
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('renders search and filter inputs', () => {
    renderWithClient(<InventoryPage />);
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders the table headers', () => {
    renderWithClient(<InventoryPage />);
    expect(screen.getByText('Item Name')).toBeInTheDocument();
    expect(screen.getByText('Selling Price')).toBeInTheDocument();
    expect(screen.getByText('Current Qty')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });
});
