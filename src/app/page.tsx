'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, FileDown, Edit, RefreshCw, Loader2, Upload, CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from "@/components/ui/checkbox";

// --- Types ---
/**
 * Represents an inventory item in the system.
 */
interface InventoryItem {
  id: number;
  itemName: string;
  sellingPrice: number;
  currentQuantity: number;
  unitType: string;
  expiryDate: string | null;
  status: string;
}

/**
 * Configuration for sorting the inventory table.
 */
type SortConfig = {
  key: keyof InventoryItem;
  direction: 'asc' | 'desc';
} | null;

const UNIT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pcs', label: 'pcs (pieces)' },
  { value: 'kg', label: 'kg (kilogram)' },
  { value: 'g', label: 'g (gram)' },
  { value: 'mg', label: 'mg (milligram)' },
  { value: 'l', label: 'l (liter)' },
  { value: 'ml', label: 'ml (milliliter)' },
  { value: 'bot', label: 'bot (bottle)' },
  { value: 'tabs', label: 'tabs (tablets)' },
  { value: 'cap', label: 'cap (capsules)' },
  { value: 'box', label: 'box' },
  { value: 'pack', label: 'pack' },
  { value: 'sachet', label: 'sachet' },
  { value: 'vial', label: 'vial' }
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'checked', label: 'Checked' },
  { value: 'updated', label: 'Updated' },
  { value: 'not yet', label: 'Not Yet' }
];

const getUnitTypeOptions = (currentValue: unknown): Array<{ value: string; label: string }> => {
  const current = typeof currentValue === 'string' ? currentValue.trim() : '';
  const hasCustom = current.length > 0 && !UNIT_TYPE_OPTIONS.some((opt) => opt.value === current);
  if (!hasCustom) return UNIT_TYPE_OPTIONS;
  return [{ value: current, label: current }, ...UNIT_TYPE_OPTIONS];
};

// --- API Helper Functions ---

/**
 * Fetches inventory items from the API.
 * Used by TanStack Query's useQuery.
 *
 * @param search - Search term for filtering by item name.
 * @param status - Status filter (all, checked, updated, not yet).
 * @returns Promise resolving to an array of InventoryItems.
 */
const fetchInventoryItems = async (): Promise<InventoryItem[]> => {
  const res = await fetch('/api/inventory');
  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }
  return res.json();
};

/**
 * Creates a new inventory item via API.
 * Used by TanStack Query's useMutation.
 *
 * @param newItem - The item data to create.
 * @returns Promise resolving to the created item.
 */
const createInventoryItem = async (newItem: Partial<InventoryItem>) => {
  const res = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newItem),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create item');
  }
  return res.json();
};

// --- Sub-Components ---

/**
 * Table cell component for editing quantity inline.
 * It manages its own local state to allow typing, and commits the change on blur or Enter key.
 */
const QuantityCell = memo(({
  itemId,
  currentQuantity,
  onUpdate
}: {
  itemId: number;
  currentQuantity: number;
  onUpdate: (itemId: number, quantity: number) => void;
}) => {
  const [value, setValue] = useState(currentQuantity.toString());

  // Sync local state when prop changes (e.g., after successful API update)
  useEffect(() => {
    setValue(currentQuantity.toString());
  }, [currentQuantity]);

  const handleBlur = () => {
    if (value.trim() === '') {
      setValue(currentQuantity.toString());
      return;
    }
    const newQty = parseInt(value, 10);
    if (!isNaN(newQty) && newQty !== currentQuantity) {
      onUpdate(itemId, newQty);
      return;
    }
    setValue(currentQuantity.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      setValue(currentQuantity.toString());
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      className="w-20 h-8"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      type="number"
      min={0}
      onClick={(e) => e.stopPropagation()}
    />
  );
});
QuantityCell.displayName = 'QuantityCell';

// --- Main Page Component ---

/**
 * InventoryPage Component
 *
 * The main view for the Inventory Management application.
 *
 * Features:
 * - Data Fetching: Uses TanStack Query for efficient server state management.
 * - Filtering: Search by name and filter by status.
 * - Sorting & Pagination: Client-side sorting and pagination for responsiveness.
 * - CRUD Operations: Add, Edit (Inline & Modal), Delete (Single & Bulk).
 * - Import/Export: Excel file support.
 */
export default function InventoryPage() {
  const queryClient = useQueryClient();

  // --- Local State ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Selection State (for Bulk Actions)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [isBulkStatusUpdating, setIsBulkStatusUpdating] = useState(false);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  // Change type to allow empty string for inputs
  const [editFormData, setEditFormData] = useState<Partial<Omit<InventoryItem, 'currentQuantity'> & { currentQuantity: number | string | null }>>({});

  // Add Modal State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addFormData, setAddFormData] = useState<Partial<InventoryItem>>({});

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Confirmation Dialog State (Generic for Delete actions)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => void;
    isLoading?: boolean;
  }>({ isOpen: false, title: '', description: '', action: () => {} });

  // Calendar State (reused for both dialogs)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // --- TanStack Query Hooks ---

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  /**
   * useQuery hook to fetch inventory items.
   * It automatically handles caching, refetching, and loading states.
   * The queryKey includes dependencies (search, statusFilter) so it refetches when they change.
   */
  const { data: items = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: fetchInventoryItems,
    placeholderData: (previousData) => previousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const filteredItems = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.itemName.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'all' ||
        item.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, items, statusFilter]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  /**
   * useMutation hook for adding a new item.
   * On success, it invalidates the 'inventory' query to trigger a refetch.
   */
  const addItemMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Item added successfully');
      setIsAddDialogOpen(false);
      setAddFormData({}); // Reset form
    },
    onError: (err: Error) => {
      toast.error(`Error adding item: ${err.message}`);
    },
  });

  // --- Handlers ---

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.warning('Please select a file first');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json.error || 'Import failed');
        } catch {
          throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
      }

      const data = await res.json();
      toast.success(data.message);
      setIsImportOpen(false);
      setSelectedFile(null);
      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error) {
      toast.error('Import failed: ' + (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setEditFormData({ ...item });
    setIsEditDialogOpen(true);
  };

  const updateCachedItem = useCallback(
    (updated: InventoryItem) => {
      queryClient.setQueriesData({ queryKey: ['inventory'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((it) => (it.id === updated.id ? updated : it));
      });
    },
    [queryClient]
  );

  const removeCachedItems = useCallback(
    (ids: Set<number>) => {
      queryClient.setQueriesData({ queryKey: ['inventory'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((it) => !ids.has(it.id));
      });
    },
    [queryClient]
  );

  const handleUpdate = async () => {
    if (!editingItem) return;

    try {
      setIsUpdatingItem(true);
      const payload = {
        ...editingItem,
        ...editFormData,
        sellingPrice: Number(editFormData.sellingPrice ?? editingItem.sellingPrice),
        currentQuantity: Number(editFormData.currentQuantity ?? editingItem.currentQuantity),
        unitType: String(editFormData.unitType ?? editingItem.unitType ?? ''),
        itemName: String(editFormData.itemName ?? editingItem.itemName ?? ''),
        status: String(editFormData.status ?? editingItem.status ?? 'not yet')
      };
      const res = await fetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
         throw new Error('Update failed');
      }

      const updated = (await res.json()) as InventoryItem;
      updateCachedItem(updated);
      toast.success('Item updated successfully');
      setIsEditDialogOpen(false);
    } catch {
      toast.error('Failed to update item');
    } finally {
      setIsUpdatingItem(false);
    }
  };

  const handleQuickUpdate = useCallback(
    async (itemId: number, newQuantity: number) => {
      const item = itemsById.get(itemId);
      if (!item) return;
      try {
        const res = await fetch(`/api/inventory/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item,
            currentQuantity: newQuantity
          })
        });

        if (!res.ok) {
           throw new Error('Update failed');
        }

        const updated = (await res.json()) as InventoryItem;
        updateCachedItem(updated);
        toast.success('Quantity updated');
      } catch {
        toast.error('Failed to update quantity');
      }
    },
    [itemsById, updateCachedItem]
  );

  const handleQuickStatusUpdate = useCallback(
    async (itemId: number, newStatus: string) => {
      const item = itemsById.get(itemId);
      if (!item || item.status.toLowerCase() === newStatus.toLowerCase()) return;
      try {
        const res = await fetch(`/api/inventory/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item,
            status: newStatus
          })
        });

        if (!res.ok) {
           throw new Error('Update failed');
        }

        const updated = (await res.json()) as InventoryItem;
        updateCachedItem(updated);
        toast.success('Status updated');
      } catch {
        toast.error('Failed to update status');
      }
    },
    [itemsById, updateCachedItem]
  );

  const handleBulkStatusUpdate = useCallback(async () => {
    if (!bulkStatus) {
      toast.warning('Select a status first');
      return;
    }
    if (selectedItems.size === 0) return;
    setIsBulkStatusUpdating(true);
    const ids = Array.from(selectedItems);
    try {
      const responses = await Promise.all(
        ids.map(async (id) => {
          const item = itemsById.get(id);
          if (!item) return null;
          const res = await fetch(`/api/inventory/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...item,
              status: bulkStatus
            })
          });
          if (!res.ok) throw new Error('Bulk update failed');
          return res.json() as Promise<InventoryItem>;
        })
      );
      responses.filter(Boolean).forEach((updated) => {
        if (updated) updateCachedItem(updated);
      });
      toast.success('Status updated for selected items');
      setSelectedItems(new Set());
      setBulkStatus('');
    } catch {
      toast.error('Failed to update selected items');
    } finally {
      setIsBulkStatusUpdating(false);
    }
  }, [bulkStatus, itemsById, selectedItems, updateCachedItem]);

  const handleAddSubmit = () => {
    // Basic client-side validation
    if (!addFormData.itemName || !addFormData.sellingPrice || !addFormData.currentQuantity) {
      toast.warning('Please fill in all required fields (Name, Price, Quantity)');
      return;
    }
    addItemMutation.mutate(addFormData);
  };

  // Helper for inputs in Edit Form
  const handleEditInputChange = (field: keyof InventoryItem, value: string | number | null) => {
    // Cast value to match the state type manually to avoid 'any'
    setEditFormData(prev => {
      if (field === 'currentQuantity') {
        return { ...prev, [field]: value };
      }
      return { ...prev, [field]: value };
    });
  };

  // Helper for inputs in Add Form
  const handleAddInputChange = (field: keyof InventoryItem, value: string | number | null) => {
    setAddFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- Delete Logic ---

  /**
   * Toggles selection for a single item.
   */
  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  /**
   * Toggles selection for all items on the current page.
   */
  const toggleAll = (paginatedItems: InventoryItem[]) => {
    if (selectedItems.size === paginatedItems.length && paginatedItems.length > 0) {
      setSelectedItems(new Set());
    } else {
      const newSelection = new Set<number>();
      paginatedItems.forEach(item => newSelection.add(item.id));
      setSelectedItems(newSelection);
    }
  };

  /**
   * Initiates the deletion process for a single item.
   */
  const initiateDelete = (item: InventoryItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      description: `Are you sure you want to delete "${item.itemName}"? This action cannot be undone.`,
      action: () => handleDelete(item.id)
    });
  };

  /**
   * Performs the API call to delete a single item.
   */
  const handleDelete = async (id: number) => {
    setConfirmDialog(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Delete failed');

      toast.success('Item deleted successfully');
      removeCachedItems(new Set([id]));

      // Remove from selection if present
      const newSelection = new Set(selectedItems);
      newSelection.delete(id);
      setSelectedItems(newSelection);
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  /**
   * Initiates the bulk deletion process.
   */
  const initiateBulkDelete = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Selected Items',
      description: `Are you sure you want to delete ${selectedItems.size} items? This action cannot be undone.`,
      action: () => handleBulkDelete()
    });
  };

  /**
   * Performs the API call to delete multiple items.
   */
  const handleBulkDelete = async () => {
    setConfirmDialog(prev => ({ ...prev, isLoading: true }));
    try {
      const ids = Array.from(selectedItems);
      const res = await fetch('/api/inventory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      if (!res.ok) throw new Error('Bulk delete failed');

      const data = await res.json();
      toast.success(data.message);
      removeCachedItems(new Set(ids));
      setSelectedItems(new Set());
    } catch {
      toast.error('Failed to delete items');
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-violet-600 hover:bg-violet-700 border-transparent text-white';
      case 'checked':
        return 'bg-amber-500 hover:bg-amber-600 border-transparent text-white';
      case 'updated':
        return 'bg-emerald-500 hover:bg-emerald-600 border-transparent text-white';
      case 'not yet':
      default:
        return 'bg-red-600 hover:bg-red-700 border-transparent text-white';
    }
  };

  const handleSort = useCallback((key: keyof InventoryItem) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  }, []);

  const handleCopyName = useCallback(async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  // --- Client-side Processing (Sort & Pagination) ---
  // Note: We are sorting/paginating the data returned from the server on the client side
  // because the dataset is relatively small. For large datasets, move this to server.

  const sortedItems = useMemo(() => {
    if (!sortConfig) return filteredItems;
    const copy = [...filteredItems];
    copy.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (sortConfig.direction === 'asc') {
        return aValue < bValue ? -1 : 1;
      }
      return aValue > bValue ? -1 : 1;
    });
    return copy;
  }, [filteredItems, sortConfig]);

  const totalPages = useMemo(() => Math.ceil(sortedItems.length / itemsPerPage), [sortedItems.length, itemsPerPage]);

  const paginatedItems = useMemo(
    () =>
      sortedItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      ),
    [currentPage, itemsPerPage, sortedItems]
  );

  const handleExport = useCallback(() => {
    try {
      const exportData = sortedItems.map(item => ({
        'Item Name': item.itemName,
        'Selling Price': item.sellingPrice,
        'Current Quantity': item.currentQuantity,
        'Unit Type': item.unitType,
        'Expiry Date': item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '',
        'Status': item.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      XLSX.writeFile(wb, `Inventory_export_${dateStr}.xlsx`);

      toast.success('Export completed successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export data');
    }
  }, [sortedItems]);

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Inventory Management</CardTitle>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <>
                <Button onClick={initiateBulkDelete} variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedItems.size})
                </Button>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Bulk status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleBulkStatusUpdate} disabled={isBulkStatusUpdating || !bulkStatus}>
                  {isBulkStatusUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Apply Status
                </Button>
              </>
            )}
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
            <Button
              onClick={handleExport}
              disabled={items.length === 0}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setIsImportOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              Import from Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4 text-sm text-muted-foreground">
            Showing {sortedItems.length} items
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        paginatedItems.length > 0 &&
                        paginatedItems.every(item => selectedItems.has(item.id))
                      }
                      onCheckedChange={() => toggleAll(paginatedItems)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('itemName')}>
                    Item Name {sortConfig?.key === 'itemName' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('sellingPrice')}>
                    Selling Price {sortConfig?.key === 'sellingPrice' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('currentQuantity')}>
                    Current Qty {sortConfig?.key === 'currentQuantity' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead>Unit Type</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('expiryDate')}>
                    Expiry Date {sortConfig?.key === 'expiryDate' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                    Status {sortConfig?.key === 'status' && <ArrowUpDown className="inline h-4 w-4" />}
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow>
                   <TableCell colSpan={9} className="text-center py-8">
                     <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                     <span className="sr-only">Loading...</span>
                   </TableCell>
                 </TableRow>
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No items found. Try importing data or adding a new item.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => (
                    <TableRow key={item.id} data-state={selectedItems.has(item.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                          aria-label={`Select ${item.itemName}`}
                        />
                      </TableCell>
                      <TableCell
                        className="font-medium"
                        onDoubleClick={() => handleCopyName(item.itemName)}
                      >
                        {item.itemName}
                      </TableCell>
                      <TableCell>{item.sellingPrice}</TableCell>
                      <TableCell>
                        <QuantityCell
                          itemId={item.id}
                          currentQuantity={item.currentQuantity}
                          onUpdate={handleQuickUpdate}
                        />
                      </TableCell>
                      <TableCell>{item.unitType}</TableCell>
                      <TableCell>
                        {item.expiryDate ? format(new Date(item.expiryDate), "PPP") : '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.status.toLowerCase()}
                          onValueChange={(val) => handleQuickStatusUpdate(item.id, val)}
                        >
                          <SelectTrigger className={cn("h-8 w-[130px] justify-center", getStatusColor(item.status))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => initiateDelete(item)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDialog.action} disabled={confirmDialog.isLoading}>
              {confirmDialog.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Make changes to the inventory item here. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Item Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Item Name</Label>
              <Input
                id="edit-name"
                value={editFormData.itemName || ''}
                onChange={(e) => handleEditInputChange('itemName', e.target.value)}
                className="col-span-3"
              />
            </div>
            {/* Price */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-price" className="text-right">Price</Label>
              <Input
                id="edit-price"
                type="number"
                value={editFormData.sellingPrice || 0}
                onChange={(e) => handleEditInputChange('sellingPrice', e.target.value)}
                className="col-span-3"
              />
            </div>
            {/* Current Qty */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-current" className="text-right">Current Qty</Label>
              <div className="col-span-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="px-3"
                  onClick={() => {
                    const current = Number(editFormData.currentQuantity || 0);
                    handleEditInputChange('currentQuantity', Math.max(0, current - 1));
                  }}
                >
                  -
                </Button>
                <Input
                  id="edit-current"
                  type="number"
                  value={editFormData.currentQuantity === undefined || editFormData.currentQuantity === null ? '' : editFormData.currentQuantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleEditInputChange('currentQuantity', val === '' ? '' : parseInt(val));
                  }}
                  className="text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="px-3"
                  onClick={() => {
                    const current = Number(editFormData.currentQuantity || 0);
                    handleEditInputChange('currentQuantity', current + 1);
                  }}
                >
                  +
                </Button>
              </div>
            </div>
            {/* Unit Type */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-unit" className="text-right">Unit Type</Label>
              <Select
                value={typeof editFormData.unitType === 'string' && editFormData.unitType.length > 0 ? editFormData.unitType : undefined}
                onValueChange={(val) => handleEditInputChange('unitType', val)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select unit type" />
                </SelectTrigger>
                <SelectContent>
                  {getUnitTypeOptions(editFormData.unitType).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Expiry Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Expiry Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !editFormData.expiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editFormData.expiryDate ? format(new Date(editFormData.expiryDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editFormData.expiryDate ? new Date(editFormData.expiryDate) : undefined}
                    defaultMonth={editFormData.expiryDate ? new Date(editFormData.expiryDate) : undefined}
                    captionLayout="dropdown"
                    startMonth={new Date(2020, 0)}
                    endMonth={new Date(2050, 12)}
                    onSelect={(date) => {
                      handleEditInputChange('expiryDate', date ? date.toISOString() : null);
                      setIsCalendarOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">Status</Label>
              <Select
                value={editFormData.status?.toLowerCase()}
                onValueChange={(val) => handleEditInputChange('status', val)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdate} disabled={isUpdatingItem}>
              {isUpdatingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
            <DialogDescription>
              Fill in the details for the new inventory item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Item Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-name" className="text-right">Item Name</Label>
              <Input
                id="add-name"
                value={addFormData.itemName || ''}
                onChange={(e) => handleAddInputChange('itemName', e.target.value)}
                className="col-span-3"
              />
            </div>
            {/* Price */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-price" className="text-right">Price</Label>
              <Input
                id="add-price"
                type="number"
                value={addFormData.sellingPrice || ''}
                onChange={(e) => handleAddInputChange('sellingPrice', e.target.value)}
                className="col-span-3"
              />
            </div>
            {/* Current Qty */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-current" className="text-right">Current Qty</Label>
              <Input
                id="add-current"
                type="number"
                value={addFormData.currentQuantity || ''}
                onChange={(e) => handleAddInputChange('currentQuantity', e.target.value)}
                className="col-span-3"
              />
            </div>
            {/* Unit Type */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-unit" className="text-right">Unit Type</Label>
              <Select
                value={typeof addFormData.unitType === 'string' && addFormData.unitType.length > 0 ? addFormData.unitType : undefined}
                onValueChange={(val) => handleAddInputChange('unitType', val)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select unit type" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Expiry Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Expiry Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !addFormData.expiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {addFormData.expiryDate ? format(new Date(addFormData.expiryDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={addFormData.expiryDate ? new Date(addFormData.expiryDate) : undefined}
                    defaultMonth={addFormData.expiryDate ? new Date(addFormData.expiryDate) : undefined}
                    captionLayout="dropdown"
                    startMonth={new Date(2020, 0)}
                    endMonth={new Date(2050, 12)}
                    onSelect={(date) => {
                      handleAddInputChange('expiryDate', date ? date.toISOString() : null);
                      setIsCalendarOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="add-status" className="text-right">Status</Label>
              <Select
                value={addFormData.status?.toLowerCase() || 'not yet'}
                onValueChange={(val) => handleAddInputChange('status', val)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddSubmit} disabled={addItemMutation.isPending}>
              {addItemMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Inventory</DialogTitle>
            <DialogDescription>
              Select an Excel file (.xlsx) to import inventory items.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="file">Excel File</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button onClick={handleFileUpload} disabled={importing || !selectedFile}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
