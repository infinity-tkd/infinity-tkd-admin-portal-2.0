export interface ProductVariantItem {
  id?: string;
  sku: string;
  size?: string;
  color?: string; // Collar style or color note (e.g. 'White V-Neck', 'Black/Red V-Neck (Poom)', 'Black V-Neck (Dan)')
  price_override?: number | null;
  stock: number;
  min_stock_threshold?: number;
  is_active?: boolean;
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStockThreshold: number;
  cost?: number;
  imageUrl?: string;
  description?: string;
  isActive?: boolean;
  allowStudentOrders?: boolean;
  updatedAt?: string;
  size?: string;
  sizes?: string[];
  hasVariants?: boolean;
  variants?: ProductVariantItem[];
}

export interface CartItem {
  product: ProductItem;
  variant?: ProductVariantItem;
  quantity: number;
}

export interface PosSaleTransaction {
  paymentStatus?: string;
  orderStatus?: string;
  txId: string;
  studentName: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  method: string;
  date: string;
  timestamp?: number;
}

export interface StudentOrderRecord {
  id: string;
  order_number: string;
  order_channel: 'STUDENT_PORTAL' | 'ADMIN_POS';
  student_id?: string;
  customer_name: string;
  customer_phone?: string;
  branch_id?: number;
  subtotal_usd: number;
  discount_usd: number;
  total_usd: number;
  payment_method: string;
  payment_status: 'PENDING' | 'PAID' | 'REFUND_PENDING' | 'REFUNDED' | 'VOID';
  order_status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';
  student_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
  payment_recorded_at?: string|null;
  cancelled_at?: string;
  cancellation_reason?: string;
  confirmed_at?: string;
  fulfilled_at?: string;
  branches?: { branch_name: string };
  students?: {
    english_name: string;
    khmer_name: string;
    current_belt: string;
    phone: string;
  };
  items?: {
    id: string;
    product_name: string;
    sku: string;
    size?: string;
    color?: string;
    quantity: number;
    unit_price_usd: number;
    total_price_usd: number;
  }[];
}

