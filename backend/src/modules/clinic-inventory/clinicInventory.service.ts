import prisma from '../../config/database.js';
import { generateId } from '../../common/utils/uuid.js';
import { AppError } from '../../common/middleware/errorHandler.js';

export async function getInventoryItems() {
  return await prisma.inventoryItem.findMany({
    where: { location: 'Clinic' }, // Authoritative Clinic scope
    include: {
      updates: {
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { first_name: true, last_name: true, id: true } }
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });
}

export async function createInventoryItem(data: {
  name: string;
  category: string;
  description?: string | null;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
  reorder_level?: number | null;
}, authUserId: string) {
  if (!['Medicine', 'Supplies', 'Equipment'].includes(data.category)) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid clinic category.');
  }

  const itemId = generateId();
  return await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        id: itemId,
        name: data.name,
        category: data.category,
        description: data.description || null,
        quantity: data.quantity,
        unit: data.unit,
        expiry_date: data.expiry_date ? new Date(data.expiry_date) : null,
        reorder_level: data.reorder_level ?? null,
        condition: 'Good',
        location: 'Clinic', // FORCED server-side
        status: 'Good',
      }
    });
    
    await tx.inventoryUpdate.create({
      data: {
        id: generateId(),
        item_id: itemId,
        user_id: authUserId,
        action: 'Added',
        details: `Initial stock: ${data.quantity} ${data.unit}`
      }
    });
    
    return item;
  });
}

export async function consumeInventoryStock(id: string, quantity: number, reason: string, authUserId: string) {
  return await prisma.$transaction(async (tx) => {
    // Fetch for existence and authorization checks
    const existing = await tx.inventoryItem.findUnique({ where: { id } });
    
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }
    
    // Strict Clinic Scope Verification (ID Tampering test)
    if (existing.location !== 'Clinic') {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to non-clinic inventory.');
    }
    
    // Atomic Conditional Decrement
    const updateResult = await tx.inventoryItem.updateMany({
      where: { 
        id: id,
        quantity: { gte: quantity } 
      },
      data: { 
        quantity: { decrement: quantity } 
      }
    });
    
    if (updateResult.count === 0) {
      // If it exists but updateMany returned 0, stock is insufficient for concurrent or sequential requests
      throw new AppError(400, 'BAD_REQUEST', 'Insufficient stock.');
    }

    const updatedItem = await tx.inventoryItem.findUnique({ where: { id } });
    
    await tx.inventoryUpdate.create({
      data: {
        id: generateId(),
        item_id: id,
        user_id: authUserId,
        action: 'Stock Consumed',
        details: `Used ${quantity} ${existing.unit}. Reason: ${reason}`
      }
    });
    
    return updatedItem;
  });
}
