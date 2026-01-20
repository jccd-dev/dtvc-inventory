import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * Interface representing a row in the imported Excel file.
 * Keys are dynamic because Excel column headers might vary slightly in casing/spacing.
 */
interface ExcelRow {
  [key: string]: string | number | undefined;
}

/**
 * POST handler for importing inventory items from an Excel file.
 *
 * Logic Flow:
 * 1. Parses the uploaded Excel file.
 * 2. Iterates through each row.
 * 3. Fuzzy matches column names (e.g., "Item Name", "itemname") to map data correctly.
 * 4. Checks if an item with the same name already exists in the database.
 * 5. If exists: Updates the existing item (merging logic: keeps existing quantity if import is 0).
 * 6. If new: Creates a new inventory item.
 *
 * @param request - The HTTP request containing the file in 'formData'.
 * @returns JSON response with a success message and count of processed items.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Read the Excel workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Assume data is in the first sheet
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON array
    const jsonData = XLSX.utils.sheet_to_json(sheet) as ExcelRow[];

    let count = 0;
    for (const row of jsonData) {
      // Helper to find a key in the row object case-insensitively
      const getKey = (key: string) => Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());

      // Extract values using flexible key matching
      const itemName = row[getKey('item name') || getKey('itemname') || ''];

      if (!itemName) continue; // Skip rows without a name

      const sellingPriceRaw = row[getKey('selling price') || getKey('price') || ''];
      const currentQuantityRaw = row[getKey('current quantity') || getKey('current qty') || getKey('quantity') || ''];
      const unitType = row[getKey('unit type') || getKey('unit') || ''];
      const expiryDateRaw = row[getKey('expiry date') || getKey('expiry') || ''];
      const statusRaw = row[getKey('status') || ''];

      // Parse numeric values safely
      const sellingPrice = parseFloat(String(sellingPriceRaw)) || 0;
      const currentQuantity = parseInt(String(currentQuantityRaw)) || 0;
      const status = String(statusRaw || 'not yet');

      // Parse date: Handle both Excel serial dates (numbers) and string dates
      let expiryDate = null;
      if (expiryDateRaw) {
        if (typeof expiryDateRaw === 'number') {
             // Excel stores dates as serial numbers (days since 1900-01-01)
             // We adjust for the epoch difference to convert to JS Date
             expiryDate = new Date(Math.round((expiryDateRaw - 25569)*86400*1000));
        } else {
             expiryDate = new Date(String(expiryDateRaw));
        }
      }

      // Check if item already exists in DB to decide between UPDATE or CREATE
      const existingItem = await prisma.inventoryItem.findFirst({
        where: { itemName: String(itemName) }
      });

      if (existingItem) {
        // UPDATE LOGIC:
        // - Use new quantity from import, unless it's 0, then keep existing.
        // - Use new status if provided, else keep existing.

        let newQuantity = currentQuantity;
        if (currentQuantity === 0) {
           newQuantity = existingItem.currentQuantity;
        }

        const newStatus = statusRaw ? String(statusRaw) : existingItem.status;

        await prisma.inventoryItem.update({
          where: { id: existingItem.id },
          data: {
            sellingPrice,
            currentQuantity: newQuantity,
            unitType: String(unitType || existingItem.unitType || ''),
            // Only update expiry date if a valid one is provided
            expiryDate: expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate : existingItem.expiryDate,
            status: newStatus.toLowerCase(),
          }
        });
      } else {
        // CREATE LOGIC:
        // - Create a fresh entry with all provided data.
        await prisma.inventoryItem.create({
          data: {
            itemName: String(itemName),
            sellingPrice,
            currentQuantity,
            unitType: String(unitType || ''),
            expiryDate: expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate : null,
            status: String(status).toLowerCase(),
          }
        });
      }
      count++;
    }

    return NextResponse.json({ message: `Processed ${count} items successfully`, count });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import data: ' + (error as Error).message }, { status: 500 });
  }
}
