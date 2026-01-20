import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * PUT method to update an existing inventory item.
 * Expects a JSON body with fields to update.
 * 
 * @param request - The incoming HTTP request containing the update data.
 * @param params - Route parameters containing the item ID.
 * @returns JSON response with the updated item or an error message.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id);
  const body = await request.json();

  try {
    // Perform the update operation in the database
    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        itemName: body.itemName,
        sellingPrice: parseFloat(body.sellingPrice),
        currentQuantity: parseInt(body.currentQuantity),
        unitType: body.unitType,
        status: body.status,
        // Convert date string to Date object if present, else null
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null
      }
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

/**
 * DELETE method to remove a single inventory item by ID.
 * 
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the item ID.
 * @returns JSON response confirming deletion or an error message.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = parseInt(id);

  try {
    // Perform the delete operation in the database
    await prisma.inventoryItem.delete({
      where: { id: itemId },
    });
    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
