import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET method to fetch inventory items with optional search and status filtering.
 * 
 * @param request - The incoming HTTP request with query parameters.
 * @returns JSON response containing the list of inventory items.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');

  // Build the WHERE clause based on filters
  const where: Prisma.InventoryItemWhereInput = {};

  if (search) {
    where.itemName = {
      contains: search
    };
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  try {
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: {
        id: 'asc' // Default order by ID ascending
      }
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

/**
 * POST method to create a new inventory item.
 * Expects a JSON body with item details.
 * 
 * @param request - The incoming HTTP request.
 * @returns JSON response with the newly created item.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemName, sellingPrice, currentQuantity, unitType, expiryDate, status } = body;

    // Validate required fields
    if (!itemName || sellingPrice === undefined || currentQuantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields: itemName, sellingPrice, and currentQuantity are required.' }, { status: 400 });
    }

    const newItem = await prisma.inventoryItem.create({
      data: {
        itemName,
        sellingPrice: Number(sellingPrice),
        currentQuantity: Number(currentQuantity),
        unitType: unitType || '',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: status || 'not yet',
      },
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

/**
 * DELETE method for bulk deletion of inventory items.
 * Expects a JSON body with an array of IDs: { ids: number[] }
 * 
 * @param request - The incoming HTTP request.
 * @returns JSON response with the count of deleted items.
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ids } = body;

    // Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty IDs array' }, { status: 400 });
    }

    // Perform bulk delete
    const result = await prisma.inventoryItem.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    return NextResponse.json({ message: `${result.count} items deleted successfully`, count: result.count });
  } catch (error) {
    console.error('Error deleting items:', error);
    return NextResponse.json({ error: 'Failed to delete items' }, { status: 500 });
  }
}
