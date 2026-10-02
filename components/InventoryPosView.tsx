'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/hooks/useTranslation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Portal } from '@/components/Portal';
import {
  generateUniqueSku,
  validateSkuFormat,
} from '@/lib/sku-generator';
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Trash,
  QrCode,
  Money,
  Receipt,
  CheckCircle,
  Warning,
  Tag,
  Package,
  User,
  MagnifyingGlass,
  Printer,
  X,
  Percent,
  ClockCounterClockwise,
  Storefront,
  ArrowsClockwise,
  FileArrowDown,
  Funnel,
  SortAscending,
  CaretDown,
  Check,
  Barcode,
  ClipboardText,
  PencilSimple,
  GridFour,
  List,
  Pause,
  Play,
  ChatCenteredText,
  CaretRight,
  Sparkle
} from '@phosphor-icons/react';

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
  payment_status: 'PENDING' | 'PAID' | 'REFUNDED' | 'VOID';
  order_status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED';
  student_notes?: string;
  admin_notes?: string;
  created_at: string;
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
    quantity: number;
    unit_price_usd: number;
    total_price_usd: number;
  }[];
}

const STORAGE_CATALOG_KEY = 'infinity_pos_catalog_v2';
const STORAGE_SALES_KEY = 'infinity_pos_sales_v2';

const INITIAL_CATALOG: ProductItem[] = [];

const DEFAULT_CATEGORIES = ['All', 'Uniforms', 'Sparring Gear', 'Belts', 'Kicking Pads', 'Apparel'] as const;

// Taekwondo & Dojang Variation Presets
const UNIFORM_COLLAR_PRESETS = [
  'White V-Neck',
  'Black/Red V-Neck (Poom)',
  'Black V-Neck (Dan)'
] as const;

const SPARRING_COLOR_PRESETS = [
  'Red',
  'Blue'
] as const;

const TKD_KIDS_SIZES = ['100', '110', '120', '130', '140', '150'] as const;
const TKD_ADULT_SIZES = ['160', '170', '180', '190', '200'] as const;
const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export function InventoryPosView() {
  const { state, showNotification, showConfirm, can } = useAppStore();
  const t = useT();

  const canCreateOrder = can('action:pos_create_order');
  const canManageInventory = can('action:pos_manage_inventory');
  const isPosReadOnly = !canCreateOrder;

  // Navigation: 4 Core Tabs
  const [activeMainTab, setActiveMainTab] = useState<'terminal' | 'orders' | 'inventory' | 'history'>('terminal');

  // Core Data State: Pure Live Supabase Database
  const [catalog, setCatalog] = useState<ProductItem[]>(INITIAL_CATALOG);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [salesHistory, setSalesHistory] = useState<PosSaleTransaction[]>([]);
  const [studentOrders, setStudentOrders] = useState<StudentOrderRecord[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  // Terminal Catalog Filters & Sort
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'name-asc'>('default');

  // Customer Tagging Combobox State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const studentComboboxRef = useRef<HTMLDivElement>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'ABA Bank KHQR' | 'Cash'>('ABA Bank KHQR');

  // POS Terminal Layout & Parked Cart Tools
  const [posViewMode, setPosViewMode] = useState<'grid' | 'compact'>('grid');
  const [parkedCart, setParkedCart] = useState<{
    cart: CartItem[];
    selectedStudentId: string;
    discountPercent: number;
    paymentMethod: 'ABA Bank KHQR' | 'Cash';
    orderNotes: string;
    parkedAt: number;
  } | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(false);

  // Cash Register Tools
  const [cashTendered, setCashTendered] = useState<string>('');

  // Modals
  const [completedTx, setCompletedTx] = useState<PosSaleTransaction | null>(null);
  const [isKhqrModalOpen, setIsKhqrModalOpen] = useState(false);
  const [packingSlipOrder, setPackingSlipOrder] = useState<StudentOrderRecord | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductItem | null>(null);
  const [adjustingVariant, setAdjustingVariant] = useState<ProductVariantItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(5);
  const [adjustReason, setAdjustReason] = useState<'RESTOCK' | 'DAMAGE_WRITE_OFF' | 'AUDIT_ADJUSTMENT'>('RESTOCK');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);

  // Quick Variant Selector Modal for POS Terminal
  const [selectedVariantModalProduct, setSelectedVariantModalProduct] = useState<ProductItem | null>(null);
  const [modalSelectedColor, setModalSelectedColor] = useState<string>('');
  const [modalSelectedSize, setModalSelectedSize] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<number>(1);

  // Inventory Table Expandable Variant Rows
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    sku: string;
    category: string;
    price: number;
    stock: number;
    minStockThreshold: number;
    size: string;
  }>({
    name: '',
    sku: '',
    category: 'Uniforms',
    price: 0,
    stock: 0,
    minStockThreshold: 5,
    size: '',
  });

  // Student Orders Queue Filter & Search
  const [ordersFilter, setOrdersFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'READY' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [ordersSearch, setOrdersSearch] = useState<string>('');

  // Inventory Table Filter & Search
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryCategory, setInventoryCategory] = useState<string>('All');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'HEALTHY'>('ALL');

  // Sales Records Filter
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [salesMethodFilter, setSalesMethodFilter] = useState<'All' | 'ABA Bank KHQR' | 'Cash'>('All');
  const [salesPeriodFilter, setSalesPeriodFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Add Item Form State
  const [newItem, setNewItem] = useState<{
    name: string;
    sku: string;
    category: string;
    price: number;
    stock: number;
    minStockThreshold: number;
    size: string;
  }>({
    name: '',
    sku: '',
    category: 'Uniforms',
    price: 25,
    stock: 10,
    minStockThreshold: 5,
    size: ''
  });
  const [isNewItemSkuManual, setIsNewItemSkuManual] = useState(false);

  // Variant Matrix Generator State
  const [hasNewItemVariants, setHasNewItemVariants] = useState<boolean>(false);
  const [variantStyles, setVariantStyles] = useState<string[]>([]);
  const [customStyleInput, setCustomStyleInput] = useState<string>('');
  const [variantSizes, setVariantSizes] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState<string>('');
  const [matrixVariants, setMatrixVariants] = useState<{
    id?: string;
    sku: string;
    size: string;
    color: string;
    stock: number;
    price_override: number | null;
  }[]>([]);
  const [batchStockValue, setBatchStockValue] = useState<number>(10);

  // Auto-detection & Collision Protection Engine
  const existingSkusList = useMemo(() => catalog.map(p => p.sku), [catalog]);

  const newItemSkuConflict = useMemo(() => {
    if (!newItem.sku.trim()) return null;
    return catalog.find(p => p.sku.toUpperCase() === newItem.sku.toUpperCase().trim()) || null;
  }, [catalog, newItem.sku]);

  const newItemSkuFormatValid = useMemo(() => {
    if (!newItem.sku.trim()) return { isValid: true };
    return validateSkuFormat(newItem.sku);
  }, [newItem.sku]);

  const editItemSkuConflict = useMemo(() => {
    if (!editFormData.sku.trim() || !editingProduct) return null;
    return catalog.find(p => p.id !== editingProduct.id && p.sku.toUpperCase() === editFormData.sku.toUpperCase().trim()) || null;
  }, [catalog, editFormData.sku, editingProduct]);

  const editItemSkuFormatValid = useMemo(() => {
    if (!editFormData.sku.trim()) return { isValid: true };
    return validateSkuFormat(editFormData.sku);
  }, [editFormData.sku]);

  const handleNewItemNameChange = (name: string) => {
    if (!isNewItemSkuManual) {
      const generated = generateUniqueSku({
        name,
        category: newItem.category,
        size: newItem.size,
        existingSkus: existingSkusList,
      });
      setNewItem(prev => ({ ...prev, name, sku: generated }));
    } else {
      setNewItem(prev => ({ ...prev, name }));
    }

    if (hasNewItemVariants && matrixVariants.length > 0) {
      setMatrixVariants(prev => prev.map(v => ({
        ...v,
        sku: generateUniqueSku({
          name: name || 'ITEM',
          category: newItem.category,
          size: v.size || undefined,
          style: v.color || undefined,
          existingSkus: existingSkusList,
        })
      })));
    }
  };

  const handleNewItemCategoryChange = (category: string) => {
    if (!isNewItemSkuManual && newItem.name.trim()) {
      const generated = generateUniqueSku({
        name: newItem.name,
        category,
        size: newItem.size,
        existingSkus: existingSkusList,
      });
      setNewItem(prev => ({ ...prev, category, sku: generated }));
    } else {
      setNewItem(prev => ({ ...prev, category }));
    }

    if (hasNewItemVariants && matrixVariants.length > 0) {
      setMatrixVariants(prev => prev.map(v => ({
        ...v,
        sku: generateUniqueSku({
          name: newItem.name || 'ITEM',
          category,
          size: v.size || undefined,
          style: v.color || undefined,
          existingSkus: existingSkusList,
        })
      })));
    }
  };

  const handleNewItemSizeChange = (size: string) => {
    if (!isNewItemSkuManual && newItem.name.trim()) {
      const generated = generateUniqueSku({
        name: newItem.name,
        category: newItem.category,
        size,
        existingSkus: existingSkusList,
      });
      setNewItem(prev => ({ ...prev, size, sku: generated }));
    } else {
      setNewItem(prev => ({ ...prev, size }));
    }
  };

  const handleGenerateNewItemSku = () => {
    const generated = generateUniqueSku({
      name: newItem.name || 'ITEM',
      category: newItem.category,
      size: newItem.size,
      existingSkus: existingSkusList,
    });
    setNewItem(prev => ({ ...prev, sku: generated }));
    setIsNewItemSkuManual(false);
  };

  const handleGenerateEditItemSku = () => {
    if (!editingProduct) return;
    const generated = generateUniqueSku({
      name: editFormData.name || editingProduct.name,
      category: editFormData.category,
      size: editFormData.size,
      existingSkus: existingSkusList,
      excludeSku: editingProduct.sku,
    });
    setEditFormData(prev => ({ ...prev, sku: generated }));
  };

  // Matrix generation engine for multi-size & collar variations
  const regenerateMatrix = (
    styles: string[],
    sizes: string[],
    baseName: string,
    baseCat: string,
    currentMatrix: {
      id?: string;
      sku: string;
      size: string;
      color: string;
      stock: number;
      price_override: number | null;
    }[]
  ) => {
    const effStyles = styles.length > 0 ? styles : [''];
    const effSizes = sizes.length > 0 ? sizes : [''];

    const result: typeof matrixVariants = [];
    for (const style of effStyles) {
      for (const size of effSizes) {
        if (!style && !size) continue;
        const existing = currentMatrix.find(p => p.color === style && p.size === size);
        if (existing) {
          result.push(existing);
        } else {
          const sku = generateUniqueSku({
            name: baseName || 'ITEM',
            category: baseCat,
            size: size || undefined,
            style: style || undefined,
            existingSkus: [...existingSkusList, ...result.map(r => r.sku)]
          });
          result.push({
            sku,
            color: style,
            size,
            stock: batchStockValue > 0 ? batchStockValue : 10,
            price_override: null
          });
        }
      }
    }
    return result;
  };

  const totalMatrixStock = useMemo(() => {
    return matrixVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }, [matrixVariants]);

  const openAddItemModal = () => {
    setIsNewItemSkuManual(false);
    setNewItem({
      name: '',
      sku: '',
      category: 'Uniforms',
      price: 25,
      stock: 10,
      minStockThreshold: 5,
      size: ''
    });
    setHasNewItemVariants(false);
    setVariantStyles([]);
    setCustomStyleInput('');
    setVariantSizes([]);
    setCustomSizeInput('');
    setMatrixVariants([]);
    setBatchStockValue(10);
    setIsAddItemOpen(true);
  };

  const toggleStyle = (style: string) => {
    const next = variantStyles.includes(style)
      ? variantStyles.filter(s => s !== style)
      : [...variantStyles, style];
    setVariantStyles(next);
    setMatrixVariants(prev => regenerateMatrix(next, variantSizes, newItem.name, newItem.category, prev));
  };

  const addCustomStyle = () => {
    const val = customStyleInput.trim();
    if (!val || variantStyles.includes(val)) return;
    const next = [...variantStyles, val];
    setVariantStyles(next);
    setCustomStyleInput('');
    setMatrixVariants(prev => regenerateMatrix(next, variantSizes, newItem.name, newItem.category, prev));
  };

  const removeStyle = (style: string) => {
    const next = variantStyles.filter(s => s !== style);
    setVariantStyles(next);
    setMatrixVariants(prev => regenerateMatrix(next, variantSizes, newItem.name, newItem.category, prev));
  };

  const toggleSize = (size: string) => {
    const next = variantSizes.includes(size)
      ? variantSizes.filter(s => s !== size)
      : [...variantSizes, size];
    setVariantSizes(next);
    setMatrixVariants(prev => regenerateMatrix(variantStyles, next, newItem.name, newItem.category, prev));
  };

  const addSizePreset = (presetSizes: readonly string[]) => {
    const combined = Array.from(new Set([...variantSizes, ...presetSizes]));
    setVariantSizes(combined);
    setMatrixVariants(prev => regenerateMatrix(variantStyles, combined, newItem.name, newItem.category, prev));
  };

  const addCustomSize = () => {
    const val = customSizeInput.trim();
    if (!val || variantSizes.includes(val)) return;
    const next = [...variantSizes, val];
    setVariantSizes(next);
    setCustomSizeInput('');
    setMatrixVariants(prev => regenerateMatrix(variantStyles, next, newItem.name, newItem.category, prev));
  };

  const removeSize = (size: string) => {
    const next = variantSizes.filter(s => s !== size);
    setVariantSizes(next);
    setMatrixVariants(prev => regenerateMatrix(variantStyles, next, newItem.name, newItem.category, prev));
  };

  const clearAllSizes = () => {
    setVariantSizes([]);
    setMatrixVariants(prev => regenerateMatrix(variantStyles, [], newItem.name, newItem.category, prev));
  };

  const applyBatchStockToAll = (qty: number) => {
    const val = Math.max(0, qty);
    setMatrixVariants(prev => prev.map(v => ({ ...v, stock: val })));
  };

  const updateMatrixVariant = (index: number, patch: Partial<{ sku: string; stock: number; price_override: number | null }>) => {
    setMatrixVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const removeMatrixVariant = (index: number) => {
    setMatrixVariants(prev => prev.filter((_, i) => i !== index));
  };

  const applyUniformQuickTemplate = () => {
    const styles = ['White V-Neck', 'Black/Red V-Neck (Poom)', 'Black V-Neck (Dan)'];
    const sizes = ['110', '120', '130', '140', '150', '160', '170', '180'];
    setHasNewItemVariants(true);
    setVariantStyles(styles);
    setVariantSizes(sizes);
    setNewItem(prev => ({
      ...prev,
      category: 'Uniforms',
      name: prev.name.trim() || 'Infinity TKD Uniform',
      price: prev.price > 0 ? prev.price : 35
    }));
    setMatrixVariants(regenerateMatrix(styles, sizes, newItem.name.trim() || 'Infinity TKD Uniform', 'Uniforms', []));
  };

  const applySparringGearQuickTemplate = () => {
    const styles = ['Red', 'Blue'];
    const sizes = ['S', 'M', 'L', 'XL'];
    setHasNewItemVariants(true);
    setVariantStyles(styles);
    setVariantSizes(sizes);
    setNewItem(prev => ({
      ...prev,
      category: 'Sparring Gear',
      name: prev.name.trim() || 'Competition Sparring Gear',
      price: prev.price > 0 ? prev.price : 45
    }));
    setMatrixVariants(regenerateMatrix(styles, sizes, newItem.name.trim() || 'Competition Sparring Gear', 'Sparring Gear', []));
  };

  // Close student dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (studentComboboxRef.current && !studentComboboxRef.current.contains(event.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch incoming student portal orders
  const fetchStudentOrders = useCallback(async () => {
    setIsOrdersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/pos/orders?channel=STUDENT_PORTAL', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setStudentOrders(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch student orders:', err);
    } finally {
      setIsOrdersLoading(false);
    }
  }, []);

  // Fetch live product catalog from database
  const fetchCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setIsCatalogLoading(false);
        return;
      }

      const res = await fetch('/api/admin/pos/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped: ProductItem[] = json.data.map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category_name || p.categories?.name || 'General',
          price: Number(p.price_usd),
          stock: Number(p.stock),
          minStockThreshold: Number(p.min_stock_threshold),
          size: p.sizes?.[0] || undefined,
          sizes: Array.isArray(p.sizes) ? p.sizes : [],
          hasVariants: Boolean(p.has_variants || (p.variants && p.variants.length > 0)),
          variants: Array.isArray(p.variants) ? p.variants.map((v: any) => ({
            id: v.id,
            sku: v.sku,
            size: v.size || undefined,
            color: v.color || undefined,
            price_override: v.price_override != null ? Number(v.price_override) : null,
            stock: Number(v.stock),
            min_stock_threshold: v.min_stock_threshold != null ? Number(v.min_stock_threshold) : undefined,
            is_active: v.is_active !== false
          })) : []
        }));
        setCatalog(mapped);
        try {
          localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(mapped));
        } catch (e) {
          console.error('Failed to save POS catalog:', e);
        }
      }
    } catch (err) {
      console.error('Failed to fetch products from Supabase:', err);
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  // Fetch live historical sales transactions from database
  const fetchSalesHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/pos/orders?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mappedSales: PosSaleTransaction[] = json.data
          .filter((o: any) => o.payment_status === 'PAID' || o.order_status === 'COMPLETED' || o.order_channel === 'ADMIN_POS')
          .map((o: any) => {
            const studentObj = o.students;
            let custName = o.customer_name || 'Walk-in Customer';
            if (studentObj?.english_name) {
              custName = `${studentObj.english_name}${studentObj.current_belt ? ` (${studentObj.current_belt})` : ''}`;
            }
            return {
              txId: o.order_number || o.id,
              studentName: custName,
              items: Array.isArray(o.items) ? o.items.map((it: any) => ({
                name: it.product_name,
                qty: it.quantity,
                price: Number(it.unit_price_usd)
              })) : [],
              subtotal: Number(o.subtotal_usd),
              discount: Number(o.discount_usd || 0),
              total: Number(o.total_usd),
              method: o.payment_method,
              date: new Date(o.created_at).toLocaleString(),
              timestamp: new Date(o.created_at).getTime()
            };
          });

        if (mappedSales.length > 0) {
          setSalesHistory(mappedSales);
          try {
            localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(mappedSales));
          } catch (e) {
            console.error('Failed to save POS sales history:', e);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch sales history from database:', err);
    }
  }, []);

  // Real-time synchronization and local storage init
  useEffect(() => {
    try {
      // Actively purge legacy mock data caches
      localStorage.removeItem('infinity_pos_catalog_v1');

      const savedCat = localStorage.getItem(STORAGE_CATALOG_KEY);
      if (savedCat) {
        const parsed = JSON.parse(savedCat);
        const hasLegacyMock = Array.isArray(parsed) && parsed.some((p: any) => typeof p.id === 'string' && (p.id.startsWith('prod-') || p.sku === 'DOBOK-01'));
        if (hasLegacyMock) {
          localStorage.removeItem(STORAGE_CATALOG_KEY);
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          setCatalog(parsed);
          setIsCatalogLoading(false);
        }
      }
      const savedSales = localStorage.getItem(STORAGE_SALES_KEY);
      if (savedSales) {
        const parsedSales = JSON.parse(savedSales);
        if (Array.isArray(parsedSales)) setSalesHistory(parsedSales);
      }
    } catch (e) {
      console.error('Failed to load POS local data:', e);
    }

    fetchStudentOrders();
    fetchCatalog();
    fetchSalesHistory();

    let pollInterval: NodeJS.Timeout | null = null;
    const channel = supabase
      .channel('admin-pos-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_orders' },
        () => {
          fetchStudentOrders();
          fetchSalesHistory();
          fetchCatalog();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchCatalog();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!pollInterval) {
            pollInterval = setInterval(() => {
              fetchStudentOrders();
              fetchSalesHistory();
            }, 20000);
          }
        }
      });

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchStudentOrders, fetchCatalog, fetchSalesHistory]);

  const saveCatalogToStorage = (newCatalog: ProductItem[]) => {
    setCatalog(newCatalog);
    try {
      localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(newCatalog));
    } catch (e) {
      console.error('Failed to save POS catalog:', e);
    }
  };

  const saveSalesToStorage = (newSales: PosSaleTransaction[]) => {
    setSalesHistory(newSales);
    try {
      localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(newSales));
    } catch (e) {
      console.error('Failed to save POS sales history:', e);
    }
  };

  // Student Helper for Combobox
  const selectedStudent = useMemo(() => {
    return state.students.find(s => s.id === selectedStudentId);
  }, [state.students, selectedStudentId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearchTerm.trim().toLowerCase();
    if (!q) return state.students.slice(0, 30);
    return state.students.filter(s =>
      s.englishName?.toLowerCase().includes(q) ||
      s.khmerName?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.currentBelt?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [state.students, studentSearchTerm]);

  // Cart Quantities Lookup
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.product.id] = (map[item.product.id] || 0) + item.quantity;
      if (item.variant?.id) {
        map[`var_${item.variant.id}`] = (map[`var_${item.variant.id}`] || 0) + item.quantity;
      }
      if (item.variant?.sku) {
        map[`sku_${item.variant.sku}`] = (map[`sku_${item.variant.sku}`] || 0) + item.quantity;
      }
    }
    return map;
  }, [cart]);

  // Terminal Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let list = catalog.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q ||
                          p.name.toLowerCase().includes(q) ||
                          p.sku.toLowerCase().includes(q) ||
                          (p.variants && p.variants.some(v => 
                            v.sku.toLowerCase().includes(q) || 
                            (v.color && v.color.toLowerCase().includes(q)) || 
                            (v.size && v.size.toLowerCase().includes(q))
                          ));
      const matchLowStock = onlyLowStock ? (p.stock <= p.minStockThreshold) : true;
      return matchCat && matchSearch && matchLowStock;
    });

    if (sortOption === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'stock-asc') {
      list.sort((a, b) => a.stock - b.stock);
    } else if (sortOption === 'stock-desc') {
      list.sort((a, b) => b.stock - a.stock);
    } else if (sortOption === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [catalog, selectedCategory, searchQuery, onlyLowStock, sortOption]);

  const getCartItemKey = (item: { product: ProductItem; variant?: ProductVariantItem }) => {
    return `${item.product.id}_${item.variant?.id || item.variant?.sku || item.product.size || 'default'}`;
  };

  // Cart Operations
  const addToCart = (product: ProductItem, variant?: ProductVariantItem, quantityToAdd: number = 1) => {
    if (product.hasVariants && product.variants && product.variants.length > 0 && !variant) {
      setSelectedVariantModalProduct(product);
      const firstWithStock = product.variants.find(v => v.stock > 0) || product.variants[0];
      setModalSelectedColor(firstWithStock?.color || '');
      setModalSelectedSize(firstWithStock?.size || '');
      setModalQuantity(1);
      return;
    }

    const availableStock = variant ? variant.stock : product.stock;
    const itemLabel = variant
      ? `${product.name} (${[variant.color, variant.size].filter(Boolean).join(' - ')})`
      : product.name;

    if (availableStock <= 0) {
      showNotification(`${itemLabel} is out of stock!`, 'error');
      return;
    }

    const qtyToAdd = Math.max(1, quantityToAdd);

    setCart(prev => {
      const matchIndex = prev.findIndex(item => {
        if (item.product.id !== product.id) return false;
        if (variant && item.variant) {
          return (variant.id && item.variant.id)
            ? variant.id === item.variant.id
            : variant.sku === item.variant.sku;
        }
        return !variant && !item.variant;
      });

      if (matchIndex > -1) {
        const existing = prev[matchIndex];
        const newTotalQty = existing.quantity + qtyToAdd;
        if (newTotalQty > availableStock) {
          showNotification(`Cannot add ${qtyToAdd} more. Only ${Math.max(0, availableStock - existing.quantity)} additional items available in stock.`, 'error');
          return prev;
        }
        const updated = [...prev];
        updated[matchIndex] = { ...existing, quantity: newTotalQty };
        return updated;
      }

      if (qtyToAdd > availableStock) {
        showNotification(`Cannot add ${qtyToAdd}. Only ${availableStock} items available in stock.`, 'error');
        return prev;
      }

      return [...prev, { product, variant, quantity: qtyToAdd }];
    });
  };

  const updateQuantity = (cartItemKey: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        const key = getCartItemKey(item);
        if (key === cartItemKey) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const maxStock = item.variant ? item.variant.stock : item.product.stock;
          if (newQty > maxStock) {
            showNotification(`Stock limit reached (${maxStock} max).`, 'error');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartItemKey: string) => {
    setCart(prev => prev.filter(item => getCartItemKey(item) !== cartItemKey));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    showConfirm(
      'Are you sure you want to clear all items currently in the cart?',
      () => {
        setCart([]);
        setDiscountPercent(0);
        setCashTendered('');
        showNotification('Cart cleared.', 'info');
      },
      'Clear Cart'
    );
  };

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const p = item.variant?.price_override ?? item.product.price;
      return sum + p * item.quantity;
    }, 0);
  }, [cart]);

  const clampedDiscount = useMemo(() => {
    return Math.max(0, Math.min(100, discountPercent));
  }, [discountPercent]);

  const discountAmount = useMemo(() => {
    return (subtotal * clampedDiscount) / 100;
  }, [subtotal, clampedDiscount]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const tenderedAmountNumber = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedAmountNumber - grandTotal);
  const isCashInsufficient = paymentMethod === 'Cash' && tenderedAmountNumber > 0 && tenderedAmountNumber < grandTotal;

  // Dual-Currency (USD + Cambodian Riel KHR at standard 4,100 KHR / $1 USD)
  const KHR_RATE = 4100;
  const grandTotalKhr = useMemo(() => Math.round(grandTotal * KHR_RATE), [grandTotal]);
  const changeDueKhr = useMemo(() => Math.round(changeDue * KHR_RATE), [changeDue]);
  const formatKHR = (usd: number) => `${Math.round(usd * KHR_RATE).toLocaleString()} ៛`;

  // Dynamically aggregated categories from live catalog + defaults
  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const def of DEFAULT_CATEGORIES) {
      if (def !== 'All') cats.add(def);
    }
    catalog.forEach(p => {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return ['All', ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }, [catalog]);

  // Category item counts for filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: catalog.length };
    for (const cat of dynamicCategories) {
      if (cat !== 'All') {
        counts[cat] = catalog.filter(p => p.category === cat).length;
      }
    }
    return counts;
  }, [catalog, dynamicCategories]);

  // Parked / Held Cart Operations
  const parkCurrentCart = () => {
    if (cart.length === 0) return;
    setParkedCart({
      cart,
      selectedStudentId,
      discountPercent,
      paymentMethod,
      orderNotes,
      parkedAt: Date.now()
    });
    setCart([]);
    setSelectedStudentId('');
    setStudentSearchTerm('');
    setDiscountPercent(0);
    setOrderNotes('');
    setCashTendered('');
    showNotification('Active cart placed on hold. Terminal ready for next customer.', 'info');
  };

  const resumeParkedCart = () => {
    if (!parkedCart) return;
    if (cart.length > 0) {
      showConfirm(
        'Restoring held cart will replace current active cart items. Proceed?',
        () => {
          setCart(parkedCart.cart);
          setSelectedStudentId(parkedCart.selectedStudentId);
          setDiscountPercent(parkedCart.discountPercent);
          setPaymentMethod(parkedCart.paymentMethod);
          setOrderNotes(parkedCart.orderNotes);
          setParkedCart(null);
          showNotification('Held cart restored to terminal.', 'success');
        },
        'Resume Cart'
      );
      return;
    }
    setCart(parkedCart.cart);
    setSelectedStudentId(parkedCart.selectedStudentId);
    setDiscountPercent(parkedCart.discountPercent);
    setPaymentMethod(parkedCart.paymentMethod);
    setOrderNotes(parkedCart.orderNotes);
    setParkedCart(null);
    showNotification('Held cart restored to terminal.', 'success');
  };

  const discardParkedCart = () => {
    showConfirm(
      'Are you sure you want to discard the held cart?',
      () => {
        setParkedCart(null);
        showNotification('Held cart discarded.', 'info');
      },
      'Discard Held Cart'
    );
  };

  const parkedItemsCount = useMemo(() => {
    if (!parkedCart) return 0;
    return parkedCart.cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [parkedCart]);

  const parkedGrandTotal = useMemo(() => {
    if (!parkedCart) return 0;
    const sub = parkedCart.cart.reduce((s, i) => {
      const p = i.variant?.price_override ?? i.product.price;
      return s + p * i.quantity;
    }, 0);
    const disc = (sub * Math.max(0, Math.min(100, parkedCart.discountPercent))) / 100;
    return Math.max(0, sub - disc);
  }, [parkedCart]);

  // Open Edit Product Modal
  const openEditProductModal = (product: ProductItem) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      stock: product.stock,
      minStockThreshold: product.minStockThreshold,
      size: product.size || '',
    });
    setIsEditItemOpen(true);
  };

  // Edit Product Submit
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editFormData.name.trim() || !editFormData.sku.trim()) {
      showNotification('Product Name and SKU are required.', 'error');
      return;
    }
    if (editItemSkuConflict) {
      showNotification(`SKU "${editFormData.sku}" is already assigned to "${editItemSkuConflict.name}". Please provide a unique SKU.`, 'error');
      return;
    }
    const editFmt = validateSkuFormat(editFormData.sku);
    if (!editFmt.isValid) {
      showNotification(editFmt.error || 'Invalid SKU format.', 'error');
      return;
    }
    setIsEditSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showNotification('Unauthorized: Please log in.', 'error');
        return;
      }

      const res = await fetch('/api/admin/pos/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'UPDATE_PRODUCT',
          productId: editingProduct.id,
          sku: editFormData.sku.toUpperCase().trim(),
          name: editFormData.name.trim(),
          categoryName: editFormData.category,
          priceUsd: Math.max(0, Number(editFormData.price) || 0),
          stock: Math.max(0, Number(editFormData.stock) || 0),
          minStockThreshold: Math.max(1, Number(editFormData.minStockThreshold) || 5),
          sizes: editFormData.size.trim() ? [editFormData.size.trim()] : []
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update product in database');
      }

      showNotification(`Product "${editFormData.name}" updated successfully!`, 'success');
      setIsEditItemOpen(false);
      setEditingProduct(null);
      await fetchCatalog();
    } catch (err: any) {
      console.error('Failed to update product:', err);
      showNotification(err.message || 'Error updating product.', 'error');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Finalize Sale
  const executeCompleteSale = async () => {
    if (!canCreateOrder) {
      showNotification('Read-Only mode: You do not have permission to execute sales.', 'warning');
      return;
    }

    if (cart.length === 0) {
      showNotification('Cart is empty!', 'error');
      return;
    }

    if (paymentMethod === 'Cash' && tenderedAmountNumber > 0 && tenderedAmountNumber < grandTotal) {
      showNotification(`Cash tendered ($${tenderedAmountNumber.toFixed(2)}) is less than total ($${grandTotal.toFixed(2)}).`, 'error');
      return;
    }

    const studentObj = selectedStudent;
    const studentName = studentObj
      ? `${studentObj.englishName} (${studentObj.currentBelt})`
      : 'Walk-in Customer / Guest';

    let txId = `POS-${Date.now().toString().slice(-6)}`;

    // Sync with backend API
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showNotification('Unauthorized: Please log in to complete checkout.', 'error');
        return;
      }

      // Map cart items directly with verified catalog product IDs and variants
      const mappedItems = cart.map(c => ({
        productId: c.product.id,
        variantId: c.variant?.id || null,
        sku: c.variant?.sku || c.product.sku,
        name: c.product.name,
        size: c.variant?.size || c.product.size || null,
        color: c.variant?.color || null,
        price: c.variant?.price_override ?? c.product.price,
        qty: c.quantity
      }));

      const res = await fetch('/api/admin/pos/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: selectedStudentId || null,
          customerName: studentName,
          branchId: studentObj?.homeBranchId || null,
          subtotal,
          discountPercentage: clampedDiscount,
          paymentMethod,
          adminNotes: orderNotes.trim() || undefined,
          items: mappedItems
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Transaction failed to record on server');
      }

      if (json.data?.order_number) {
        txId = json.data.order_number;
      }
    } catch (e: any) {
      console.error('Backend POS order checkout error:', e);
      showNotification(e.message || 'Sale processing failed. Cart has been preserved.', 'error');
      return; // Do NOT clear cart or claim success!
    }

    // Deduct stock in catalog
    const updatedCatalog = catalog.map(p => {
      const cartItemsForProduct = cart.filter(c => c.product.id === p.id);
      if (cartItemsForProduct.length > 0) {
        const totalDeduction = cartItemsForProduct.reduce((sum, c) => sum + c.quantity, 0);
        const updatedVariants = p.variants ? p.variants.map(v => {
          const matchCart = cartItemsForProduct.find(c => (c.variant?.id && c.variant.id === v.id) || c.variant?.sku === v.sku);
          if (matchCart) {
            return { ...v, stock: Math.max(0, v.stock - matchCart.quantity) };
          }
          return v;
        }) : undefined;
        return {
          ...p,
          stock: Math.max(0, p.stock - totalDeduction),
          variants: updatedVariants
        };
      }
      return p;
    });
    saveCatalogToStorage(updatedCatalog);

    // Save transaction
    const newTx: PosSaleTransaction = {
      txId,
      studentName,
      items: cart.map(c => ({
        name: c.variant
          ? `${c.product.name} (${[c.variant.color, c.variant.size].filter(Boolean).join(' - ')})`
          : c.product.name,
        qty: c.quantity,
        price: c.variant?.price_override ?? c.product.price
      })),
      subtotal,
      discount: discountAmount,
      total: grandTotal,
      method: paymentMethod,
      date: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    setCompletedTx(newTx);
    saveSalesToStorage([newTx, ...salesHistory]);

    // Reset checkout state
    setCart([]);
    setDiscountPercent(0);
    setSelectedStudentId('');
    setCashTendered('');
    setOrderNotes('');
    setIsKhqrModalOpen(false);
    showNotification('Sale completed successfully! Official receipt generated.', 'success');
    fetchStudentOrders();
    fetchCatalog();
    fetchSalesHistory();
  };

  // Add Item to Inventory
  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.sku.trim()) {
      showNotification('Item Name and SKU are required.', 'error');
      return;
    }
    if (newItemSkuConflict) {
      showNotification(`SKU "${newItem.sku}" is already assigned to "${newItemSkuConflict.name}". Please provide a unique SKU.`, 'error');
      return;
    }
    const newFmt = validateSkuFormat(newItem.sku);
    if (!newFmt.isValid) {
      showNotification(newFmt.error || 'Invalid SKU format.', 'error');
      return;
    }

    if (hasNewItemVariants && matrixVariants.length === 0) {
      showNotification('Please add at least one collar style or size variation, or disable matrix variations.', 'error');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showNotification('Unauthorized: Please log in.', 'error');
        return;
      }

      const finalStock = hasNewItemVariants ? totalMatrixStock : Math.max(0, Number(newItem.stock) || 0);
      const finalSizes = hasNewItemVariants
        ? Array.from(new Set(matrixVariants.map(v => v.size).filter(Boolean)))
        : (newItem.size.trim() ? [newItem.size.trim()] : []);

      const payload: any = {
        action: 'CREATE_PRODUCT',
        sku: newItem.sku.toUpperCase().trim(),
        name: newItem.name.trim(),
        categoryName: newItem.category,
        priceUsd: Math.max(0, Number(newItem.price) || 0),
        stock: finalStock,
        minStockThreshold: Math.max(1, Number(newItem.minStockThreshold) || 5),
        sizes: finalSizes
      };

      if (hasNewItemVariants && matrixVariants.length > 0) {
        payload.hasVariants = true;
        payload.variants = matrixVariants.map(v => ({
          sku: v.sku.toUpperCase().trim(),
          size: v.size.trim() || undefined,
          color: v.color.trim() || undefined,
          stock: Math.max(0, Number(v.stock) || 0),
          price_override: v.price_override != null && v.price_override >= 0 ? Number(v.price_override) : null
        }));
      }

      const res = await fetch('/api/admin/pos/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create product');
      }

      showNotification(
        hasNewItemVariants
          ? `Product "${newItem.name}" created with ${matrixVariants.length} variations (${finalStock} total stock)!`
          : 'New product added to inventory and synced to database!',
        'success'
      );
      setIsAddItemOpen(false);
      setIsNewItemSkuManual(false);
      setNewItem({ name: '', sku: '', category: 'Uniforms', price: 25, stock: 10, minStockThreshold: 5, size: '' });
      setHasNewItemVariants(false);
      setVariantStyles([]);
      setVariantSizes([]);
      setMatrixVariants([]);
      await fetchCatalog();
    } catch (err: any) {
      console.error('Failed to create product:', err);
      showNotification(err.message || 'Error creating product.', 'error');
    }
  };

  // Adjust Stock Action
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setIsAdjustSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showNotification('Unauthorized: Please log in.', 'error');
        return;
      }

      const delta = adjustReason === 'DAMAGE_WRITE_OFF' ? -Math.abs(adjustQty) : Math.abs(adjustQty);
      const res = await fetch('/api/admin/pos/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'ADJUST_STOCK',
          productId: adjustingProduct.id,
          variantId: adjustingVariant?.id || undefined,
          changeQty: delta,
          reason: adjustReason,
          notes: adjustNotes || `Stock adjusted via Admin Portal (${adjustReason})`
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Stock adjustment failed on server');
      }

      showNotification(`Inventory adjusted! New balance: ${json.data?.new_balance ?? 'synced'}`, 'success');
      setAdjustingProduct(null);
      setAdjustingVariant(null);
      setAdjustQty(5);
      setAdjustNotes('');
      await fetchCatalog();
    } catch (err: any) {
      console.error('Stock adjustment failed:', err);
      showNotification(err.message || 'Error adjusting stock.', 'error');
    } finally {
      setIsAdjustSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = (productId: string, productName: string) => {
    showConfirm(
      `Are you sure you want to remove "${productName}" from the inventory ledger?`,
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            const res = await fetch('/api/admin/pos/products', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                action: 'DELETE_PRODUCT',
                productId
              })
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              throw new Error(json.error?.message || 'Failed to remove product from database');
            }
          }
          saveCatalogToStorage(catalog.filter(p => p.id !== productId));
          await fetchCatalog();
          if (editingProduct?.id === productId) {
            setIsEditItemOpen(false);
            setEditingProduct(null);
          }
          showNotification(`Product "${productName}" removed from inventory.`, 'info');
        } catch (e: any) {
          console.error('Product removal failed:', e);
          showNotification(e.message || 'Failed to remove product.', 'error');
        }
      },
      'Remove Product'
    );
  };

  // Order Status Updates
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED',
    paymentStatus?: 'PAID'
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showNotification('Unauthorized: Please log in.', 'error');
        return;
      }

      const res = await fetch('/api/admin/pos/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId,
          newOrderStatus: newStatus,
          paymentStatus
        })
      });
      const json = await res.json();
      if (json.success) {
        showNotification(`Order updated to ${newStatus}!`, 'success');
        fetchStudentOrders();
        fetchCatalog();
      } else {
        showNotification(json.error?.message || 'Failed to update order status.', 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error updating order.', 'error');
    }
  };

  const handleCancelStudentOrder = (orderId: string, orderNumber: string) => {
    showConfirm(
      `Cancel order ${orderNumber}? Reserved stock will automatically be returned to inventory.`,
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) return;

          const res = await fetch('/api/admin/pos/orders/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              orderId,
              reason: 'Order cancelled by academy front desk admin'
            })
          });
          const json = await res.json();
          if (json.success) {
            showNotification(`Order ${orderNumber} cancelled and stock restored!`, 'info');
            fetchStudentOrders();
            fetchCatalog();
          } else {
            showNotification(json.error?.message || 'Failed to cancel order.', 'error');
          }
        } catch (err: any) {
          showNotification(err.message || 'Error cancelling order.', 'error');
        }
      },
      'Cancel Order & Restore Stock'
    );
  };

  const handleVoidSale = (txId: string) => {
    showConfirm(
      `Void transaction ${txId}? This will remove it from the historical sales records.`,
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            await fetch('/api/admin/pos/orders/cancel', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                orderId: txId,
                reason: 'Voided from admin sales records'
              })
            });
            fetchCatalog();
            fetchStudentOrders();
          }
        } catch (e) {
          console.warn('Supabase void sync failed:', e);
        }

        saveSalesToStorage(salesHistory.filter(tx => tx.txId !== txId));
        showNotification(`Transaction ${txId} voided.`, 'info');
      },
      'Void Transaction'
    );
  };

  // CSV Export: Inventory
  const exportInventoryCsv = () => {
    if (catalog.length === 0) {
      showNotification('Inventory catalog is empty.', 'warning');
      return;
    }
    const headers = ['SKU', 'Product Name', 'Category', 'Size / Variation', 'Unit Price ($)', 'Current Stock', 'Min Threshold', 'Total Valuation ($)'];
    const rows = catalog.map(p => [
      `"${p.sku.replace(/"/g, '""')}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.size || 'Standard'}"`,
      p.price.toFixed(2),
      p.stock,
      p.minStockThreshold,
      (p.price * p.stock).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinity_tkd_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Inventory CSV downloaded successfully!', 'success');
  };

  // CSV Export: Sales
  const exportSalesCsv = () => {
    if (salesHistory.length === 0) {
      showNotification('Sales history is empty.', 'warning');
      return;
    }
    const headers = ['Transaction ID', 'Date & Time', 'Customer', 'Items Summary', 'Payment Method', 'Subtotal ($)', 'Discount ($)', 'Grand Total ($)'];
    const rows = filteredSales.map(tx => [
      `"${tx.txId}"`,
      `"${tx.date}"`,
      `"${tx.studentName.replace(/"/g, '""')}"`,
      `"${tx.items.map(it => `${it.qty}x ${it.name}`).join('; ').replace(/"/g, '""')}"`,
      `"${tx.method}"`,
      tx.subtotal.toFixed(2),
      tx.discount.toFixed(2),
      tx.total.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinity_tkd_sales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Sales records CSV downloaded successfully!', 'success');
  };

  // Inventory Table Filtered Items
  const filteredInventory = useMemo(() => {
    return catalog.filter(p => {
      const matchCat = inventoryCategory === 'All' || p.category === inventoryCategory;
      const q = inventorySearch.trim().toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);

      let matchStock = true;
      if (inventoryStockFilter === 'LOW') matchStock = p.stock <= p.minStockThreshold && p.stock > 0;
      else if (inventoryStockFilter === 'OUT') matchStock = p.stock <= 0;
      else if (inventoryStockFilter === 'HEALTHY') matchStock = p.stock > p.minStockThreshold;

      return matchCat && matchSearch && matchStock;
    });
  }, [catalog, inventoryCategory, inventorySearch, inventoryStockFilter]);

  // Inventory Metrics
  const totalInventoryValuation = useMemo(() => {
    return catalog.reduce((sum, p) => sum + (p.price * p.stock), 0);
  }, [catalog]);

  const lowStockCount = useMemo(() => {
    return catalog.filter(p => p.stock <= p.minStockThreshold && p.stock > 0).length;
  }, [catalog]);

  const outOfStockCount = useMemo(() => {
    return catalog.filter(p => p.stock <= 0).length;
  }, [catalog]);

  const healthyStockCount = useMemo(() => {
    return catalog.filter(p => p.stock > p.minStockThreshold).length;
  }, [catalog]);

  const inventoryStockCounts = useMemo(() => {
    return {
      ALL: catalog.length,
      LOW: lowStockCount,
      OUT: outOfStockCount,
      HEALTHY: healthyStockCount,
    };
  }, [catalog.length, lowStockCount, outOfStockCount, healthyStockCount]);

  const orderStatusCounts = useMemo(() => {
    return {
      ALL: studentOrders.length,
      PENDING: studentOrders.filter(o => o.order_status === 'PENDING_CONFIRMATION').length,
      CONFIRMED: studentOrders.filter(o => o.order_status === 'CONFIRMED' || o.order_status === 'PREPARING').length,
      READY: studentOrders.filter(o => o.order_status === 'READY_FOR_PICKUP').length,
      COMPLETED: studentOrders.filter(o => o.order_status === 'COMPLETED').length,
      CANCELLED: studentOrders.filter(o => o.order_status === 'CANCELLED').length,
    };
  }, [studentOrders]);

  // Orders Filtered Items
  const filteredStudentOrders = useMemo(() => {
    return studentOrders.filter(order => {
      let matchStatus = true;
      if (ordersFilter === 'PENDING') matchStatus = order.order_status === 'PENDING_CONFIRMATION';
      else if (ordersFilter === 'CONFIRMED') matchStatus = order.order_status === 'CONFIRMED' || order.order_status === 'PREPARING';
      else if (ordersFilter === 'READY') matchStatus = order.order_status === 'READY_FOR_PICKUP';
      else if (ordersFilter === 'COMPLETED') matchStatus = order.order_status === 'COMPLETED';
      else if (ordersFilter === 'CANCELLED') matchStatus = order.order_status === 'CANCELLED';

      const q = ordersSearch.trim().toLowerCase();
      const matchSearch = !q ||
        order.order_number.toLowerCase().includes(q) ||
        order.customer_name?.toLowerCase().includes(q) ||
        order.customer_phone?.toLowerCase().includes(q) ||
        order.students?.english_name?.toLowerCase().includes(q);

      return matchStatus && matchSearch;
    });
  }, [studentOrders, ordersFilter, ordersSearch]);

  const pendingOrdersCount = useMemo(() => {
    return studentOrders.filter(
      (o) => o.order_status === 'PENDING_CONFIRMATION' || o.order_status === 'CONFIRMED'
    ).length;
  }, [studentOrders]);

  // Sales Records Filtered & Metrics
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);

    return salesHistory.filter(tx => {
      const matchMethod = salesMethodFilter === 'All' || tx.method === salesMethodFilter;
      const query = salesSearch.trim().toLowerCase();
      const matchSearch = !query ||
        tx.txId.toLowerCase().includes(query) ||
        tx.studentName.toLowerCase().includes(query) ||
        tx.items.some(it => it.name.toLowerCase().includes(query));

      let matchPeriod = true;
      if (salesPeriodFilter !== 'ALL') {
        const txTime = tx.timestamp || new Date(tx.date).getTime();
        if (salesPeriodFilter === 'TODAY') {
          const txDateStr = new Date(txTime).toISOString().split('T')[0];
          matchPeriod = txDateStr === todayStr;
        } else if (salesPeriodFilter === 'WEEK') {
          matchPeriod = txTime >= oneWeekAgo.getTime();
        } else if (salesPeriodFilter === 'MONTH') {
          matchPeriod = txTime >= oneMonthAgo.getTime();
        }
      }

      return matchMethod && matchSearch && matchPeriod;
    });
  }, [salesHistory, salesMethodFilter, salesSearch, salesPeriodFilter]);

  const totalSalesRevenue = useMemo(() => {
    return filteredSales.reduce((sum, tx) => sum + tx.total, 0);
  }, [filteredSales]);

  const totalItemsSold = useMemo(() => {
    return filteredSales.reduce((sum, tx) => sum + tx.items.reduce((s, it) => s + it.qty, 0), 0);
  }, [filteredSales]);

  const averageOrderValue = useMemo(() => {
    if (filteredSales.length === 0) return 0;
    return totalSalesRevenue / filteredSales.length;
  }, [filteredSales, totalSalesRevenue]);

  // High-Contrast Belt Badges (Fully optimized for Light Mode & Dark Mode)
  const getBeltColorClass = (belt: string) => {
    const lower = (belt || '').toLowerCase();
    if (lower.includes('white')) {
      return 'bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700';
    }
    if (lower.includes('yellow')) {
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40';
    }
    if (lower.includes('green')) {
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/40';
    }
    if (lower.includes('blue')) {
      return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40';
    }
    if (lower.includes('brown')) {
      return 'bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40';
    }
    if (lower.includes('red')) {
      return 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40';
    }
    if (lower.includes('poom')) {
      return 'bg-gradient-to-r from-red-600 to-slate-900 text-white border-red-700 shadow-sm';
    }
    if (lower.includes('dan') || lower.includes('black')) {
      return 'bg-slate-900 text-white border-slate-950 dark:bg-black dark:text-white dark:border-red-500/50 shadow-sm';
    }
    return 'bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-[#262626] dark:text-neutral-300 dark:border-[#333]';
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 pb-16 text-neutral-900 dark:text-[#E4E4E4] font-sans antialiased">

      {/* Top Header & 4 Tab Switcher */}
      <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Storefront className="w-5 h-5 text-[#EF2F38] shrink-0" />
            <h1 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white tracking-tight">
              Dojang Pro-Shop & POS Terminal
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px] bg-red-500/10 text-[#EF2F38] border border-red-500/20 shrink-0">
              PROD v2.0
            </span>
            {isPosReadOnly && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                👁️ Read-Only Mode
              </span>
            )}
          </div>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono tracking-wider sm:tracking-widest mt-0.5 truncate">
            EQUIPMENT INVENTORY // CHECKOUT TERMINAL & STUDENT ORDER FULFILLMENT
          </p>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full xl:w-auto">
          {/* 4 Main Mode Tabs */}
          <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-1 overflow-x-auto no-scrollbar flex-nowrap max-w-full gap-1 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => setActiveMainTab('terminal')}
              className={cn(
                "px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-[6px] flex items-center justify-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 touch-manipulation",
                activeMainTab === 'terminal'
                  ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/80 dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50"
              )}
            >
              <Storefront size={14} weight="bold" />
              TERMINAL
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('orders')}
              className={cn(
                "px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-[6px] flex items-center justify-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 touch-manipulation",
                activeMainTab === 'orders'
                  ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/80 dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50"
              )}
            >
              <Package size={14} weight="bold" />
              STUDENT ORDERS
              {pendingOrdersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[9px] bg-[#EF2F38] text-white rounded-full font-bold">
                  {pendingOrdersCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('inventory')}
              className={cn(
                "px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-[6px] flex items-center justify-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 touch-manipulation",
                activeMainTab === 'inventory'
                  ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/80 dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50"
              )}
            >
              <Tag size={14} weight="bold" />
              INVENTORY
              {lowStockCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 rounded-full font-bold">
                  {lowStockCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab('history')}
              className={cn(
                "px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-[6px] flex items-center justify-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 touch-manipulation",
                activeMainTab === 'history'
                  ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/80 dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50"
              )}
            >
              <ClockCounterClockwise size={14} weight="bold" />
              SALES ({salesHistory.length})
            </button>
          </div>

          {/* Quick Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {(activeMainTab === 'terminal' || activeMainTab === 'inventory') && (
              <button
                type="button"
                onClick={openAddItemModal}
                className="flex-1 sm:flex-initial px-3.5 py-2 min-h-[38px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation"
              >
                <Plus size={14} weight="bold" />
                ADD ITEM
              </button>
            )}

            {activeMainTab === 'inventory' && (
              <button
                type="button"
                onClick={exportInventoryCsv}
                className="flex-1 sm:flex-initial px-3 py-2 min-h-[38px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-[#E4E4E4] dark:border-[#262626] text-xs font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation"
              >
                <FileArrowDown size={14} weight="bold" />
                EXPORT CSV
              </button>
            )}

            {activeMainTab === 'history' && (
              <button
                type="button"
                onClick={exportSalesCsv}
                className="flex-1 sm:flex-initial px-3 py-2 min-h-[38px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-[#E4E4E4] dark:border-[#262626] text-xs font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation"
              >
                <FileArrowDown size={14} weight="bold" />
                EXPORT CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: POS CHECKOUT TERMINAL                                             */}
      {/* ========================================================================= */}
      {activeMainTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-start">

          {/* CATALOG SECTION (8 Columns) */}
          <div className="lg:col-span-8 flex flex-col space-y-3.5">

            {/* Category Filter Pills, Search Bar & Quick Controls */}
            <div className="flex flex-col gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3.5 sm:p-4 rounded-[8px] shadow-sm">
              {/* LINE 1: Primary Search Input & Terminal Action Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search Bar (takes flexible available space) */}
                <div className="relative flex-1">
                  <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search product name, SKU code..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-9 pr-8 py-2 min-h-[38px] rounded-[8px] focus:outline-none focus:border-[#EF2F38] focus:ring-1 focus:ring-[#EF2F38]/20 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 font-mono transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer p-1.5 active:scale-90 touch-manipulation"
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Right Controls: Low Stock Toggle + Sort Dropdown + Grid/List View Toggle + Refresh */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap pb-1 sm:pb-0 shrink-0">
                  {/* Low Stock Toggle */}
                  <button
                    type="button"
                    onClick={() => setOnlyLowStock(!onlyLowStock)}
                    className={cn(
                      "px-3 py-1.5 min-h-[38px] text-[11px] font-mono rounded-[8px] border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 touch-manipulation",
                      onlyLowStock
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-bold shadow-xs"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:text-neutral-900 hover:bg-neutral-100 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] dark:hover:text-white"
                    )}
                    title="Filter only low stock or out of stock items"
                  >
                    <Warning size={13} weight={onlyLowStock ? "fill" : "regular"} className={onlyLowStock ? "text-amber-500" : ""} />
                    <span>Low Stock</span>
                  </button>

                  {/* Sort By Dropdown */}
                  <div className="flex items-center bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] px-2 py-1 min-h-[38px] gap-1.5 shrink-0">
                    <SortAscending size={13} className="text-neutral-400 shrink-0" />
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as any)}
                      aria-label="Sort product catalog"
                      className="bg-transparent text-neutral-800 dark:text-[#ccc] text-[11px] font-mono focus:outline-none cursor-pointer py-1"
                    >
                      <option value="default">Default</option>
                      <option value="name-asc">Name: A to Z</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="stock-asc">Stock: Low to High</option>
                      <option value="stock-desc">Stock: High to Low</option>
                    </select>
                  </div>

                  {/* Grid / List Mode Switcher */}
                  <div className="flex items-center bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] p-0.5 border border-neutral-200 dark:border-[#262626] shrink-0 min-h-[38px]">
                    <button
                      type="button"
                      onClick={() => setPosViewMode('grid')}
                      className={cn(
                        "px-2.5 py-1 min-h-[32px] rounded-[6px] transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold active:scale-95 touch-manipulation",
                        posViewMode === 'grid'
                          ? "bg-white dark:bg-[#222] text-neutral-900 dark:text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                      title="Card Grid View"
                    >
                      <GridFour size={13} weight={posViewMode === 'grid' ? "fill" : "regular"} />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosViewMode('compact')}
                      className={cn(
                        "px-2.5 py-1 min-h-[32px] rounded-[6px] transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold active:scale-95 touch-manipulation",
                        posViewMode === 'compact'
                          ? "bg-white dark:bg-[#222] text-neutral-900 dark:text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                      title="Compact Rapid List View"
                    >
                      <List size={13} weight={posViewMode === 'compact' ? "bold" : "regular"} />
                      <span>List</span>
                    </button>
                  </div>

                  {/* Manual Refresh Sync Button */}
                  <button
                    type="button"
                    onClick={() => fetchCatalog()}
                    disabled={isCatalogLoading}
                    className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] cursor-pointer disabled:opacity-50 transition-colors shrink-0 active:scale-95 touch-manipulation"
                    title="Refresh live catalog from database"
                  >
                    <ArrowsClockwise size={14} className={isCatalogLoading ? "animate-spin text-[#EF2F38]" : ""} />
                  </button>
                </div>
              </div>

              {/* LINE 2: DEDICATED FULL-WIDTH CATEGORY FILTER ROW */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-neutral-100 dark:border-[#202020]">
                {/* Horizontal Scrolling Pill Category Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap min-w-0">
                  {dynamicCategories.map(cat => {
                    const isSelected = selectedCategory === cat;
                    const count = categoryCounts[cat] ?? 0;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-3 py-1.5 min-h-[34px] text-[11px] font-mono rounded-[8px] border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 select-none active:scale-95 touch-manipulation",
                          isSelected
                            ? "bg-[#EF2F38] text-white font-bold border-[#EF2F38] shadow-sm shadow-red-500/20 ring-1 ring-[#EF2F38]"
                            : "bg-neutral-100/80 text-neutral-700 border-neutral-200/90 hover:bg-neutral-200/70 hover:text-neutral-900 dark:bg-[#1a1a1a] dark:text-neutral-300 dark:border-[#262626] dark:hover:bg-[#222] dark:hover:text-white"
                        )}
                      >
                        <span>{cat}</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] rounded-full font-mono font-bold leading-none tabular-nums",
                            isSelected
                              ? "bg-white/25 text-white"
                              : "bg-neutral-200 dark:bg-[#292929] text-neutral-600 dark:text-neutral-400"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Filter Status & Reset Action */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0 self-end sm:self-center">
                  <span>
                    Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{filteredProducts.length}</span> of {catalog.length}
                  </span>
                  {(selectedCategory !== 'All' || searchQuery || onlyLowStock) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('All');
                        setSearchQuery('');
                        setOnlyLowStock(false);
                      }}
                      className="text-[#EF2F38] hover:underline font-bold cursor-pointer ml-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* PRODUCT CATALOG DISPLAY (Grid vs Compact List) */}
            {isCatalogLoading && catalog.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 flex-1">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="animate-pulse border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 bg-white dark:bg-[#141414] space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-neutral-200 dark:bg-[#222] rounded w-20" />
                      <div className="h-4 bg-neutral-200 dark:bg-[#222] rounded w-16" />
                    </div>
                    <div className="h-5 bg-neutral-200 dark:bg-[#222] rounded w-3/4" />
                    <div className="h-4 bg-neutral-200 dark:bg-[#222] rounded w-1/3" />
                    <div className="h-8 bg-neutral-200 dark:bg-[#222] rounded mt-4" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-[#262626] rounded-[8px] bg-neutral-50 dark:bg-[#0F0F0F] space-y-2">
                <Storefront size={28} className="mx-auto text-neutral-400 dark:text-neutral-500 mb-1" />
                <p className="font-bold text-neutral-700 dark:text-neutral-300">No products found</p>
                <p className="text-[11px] text-neutral-500">
                  {catalog.length === 0
                    ? 'No products available in the database. Use "+ ADD ITEM" to create one.'
                    : 'No items match your active search or category filters.'}
                </p>
                {(selectedCategory !== 'All' || searchQuery || onlyLowStock) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                      setOnlyLowStock(false);
                    }}
                    className="mt-2 px-3 py-1.5 bg-[#EF2F38] text-white text-[11px] rounded-[6px] font-bold cursor-pointer hover:bg-[#d6242c] transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : posViewMode === 'grid' ? (
              /* MODE A: CARD GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 flex-1">
                {filteredProducts.map(product => {
                  const inCartQty = cartQuantities[product.id] || 0;
                  const isLowStock = product.stock <= product.minStockThreshold && product.stock > 0;
                  const isOutOfStock = product.stock <= 0;
                  const stockRatio = Math.min(100, Math.max(0, (product.stock / Math.max(product.minStockThreshold * 2, 10)) * 100));

                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "group relative border rounded-[8px] p-3.5 flex flex-col justify-between transition-all duration-200 shadow-sm",
                        inCartQty > 0
                          ? "border-[#EF2F38]/60 ring-1 ring-[#EF2F38]/20 bg-red-50/40 dark:bg-red-950/15"
                          : isOutOfStock
                          ? "bg-neutral-50 dark:bg-[#111] border-neutral-200 dark:border-[#262626] opacity-65"
                          : "bg-white dark:bg-[#141414] border-neutral-200 dark:border-[#262626] hover:border-[#EF2F38]/40 hover:shadow-md"
                      )}
                    >
                      <div>
                        {/* Header: SKU Badge + Stock Badge */}
                        <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                          <span className="bg-neutral-100 dark:bg-[#0F0F0F] px-2 py-0.5 rounded-[6px] border border-neutral-200 dark:border-[#262626] font-bold text-neutral-700 dark:text-neutral-300">
                            {product.sku}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-[6px] border border-rose-200 dark:border-rose-500/20">
                              <Warning size={10} weight="fill" /> OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-[6px] border border-amber-200 dark:border-amber-500/20">
                              <Warning size={10} weight="fill" /> LOW: {product.stock} LEFT
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-[6px] border border-emerald-200 dark:border-emerald-500/20">
                              {product.stock} IN STOCK
                            </span>
                          )}
                        </div>

                        {/* Visual Stock Meter Bar */}
                        <div className="w-full bg-neutral-100 dark:bg-[#202020] h-1 rounded-full overflow-hidden mb-2.5">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              isOutOfStock
                                ? "bg-rose-500"
                                : isLowStock
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${isOutOfStock ? 0 : Math.max(8, stockRatio)}%` }}
                          />
                        </div>

                        {/* Product Title & Metadata */}
                        <h3 className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-[#EF2F38] transition-colors leading-snug">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 flex-wrap">
                          <span>{product.category}</span>
                          {product.hasVariants && product.variants && product.variants.length > 0 ? (
                            <>
                              <span>•</span>
                              <span className="bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 px-1.5 py-0.2 rounded font-bold">
                                {product.variants.length} Variations
                              </span>
                              {product.sizes && product.sizes.length > 0 && (
                                <span className="text-[9px] text-neutral-400 truncate max-w-[140px]">
                                  ({product.sizes.join(', ')})
                                </span>
                              )}
                            </>
                          ) : product.size ? (
                            <>
                              <span>•</span>
                              <span className="bg-neutral-100 dark:bg-[#1a1a1a] px-1.5 py-0.2 rounded border border-neutral-200 dark:border-[#262626] font-bold text-neutral-700 dark:text-neutral-300">
                                Size {product.size}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Card Footer: Price, Inventory Actions & Cart Controls */}
                      <div className="flex items-center justify-between border-t border-neutral-200 dark:border-[#262626] pt-3 mt-3">
                        {/* Price Tag with KHR estimate */}
                        <div className="flex flex-col">
                          <span className="text-sm font-black font-mono text-neutral-900 dark:text-white">
                            ${product.price.toFixed(2)}
                          </span>
                          <span className="text-[9px] font-mono text-neutral-500 dark:text-neutral-400 leading-none">
                            ≈ {formatKHR(product.price)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {product.hasVariants && product.variants && product.variants.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              {inCartQty > 0 && (
                                <span className="text-[10px] font-mono font-bold text-[#EF2F38] bg-red-50 dark:bg-red-950/30 border border-red-500/30 px-1.5 py-0.5 rounded">
                                  {inCartQty} in cart
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={isOutOfStock}
                                onClick={() => addToCart(product)}
                                className={cn(
                                  "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation cursor-pointer",
                                  isOutOfStock
                                    ? "bg-neutral-100 text-neutral-400 border border-neutral-200 dark:bg-[#1a1a1a] dark:text-[#555] dark:border-[#262626] cursor-not-allowed"
                                    : "bg-[#EF2F38] hover:bg-[#d6242c] text-white shadow-xs"
                                )}
                              >
                                <Tag size={13} weight="bold" /> Choose Size
                              </button>
                            </div>
                          ) : inCartQty > 0 ? (
                            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-red-500/40 rounded-[8px] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(getCartItemKey({ product }), -1)}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#1f1f1f] text-neutral-800 dark:text-white rounded-[6px] transition cursor-pointer active:scale-90 touch-manipulation"
                                title="Decrease"
                              >
                                <Minus size={13} weight="bold" />
                              </button>
                              <span className="text-xs font-mono font-bold text-[#EF2F38] px-1.5 min-w-[22px] text-center">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                disabled={inCartQty >= product.stock}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#1f1f1f] text-neutral-800 dark:text-white rounded-[6px] transition cursor-pointer disabled:opacity-30 active:scale-90 touch-manipulation"
                                title="Increase"
                              >
                                <Plus size={13} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation",
                                isOutOfStock
                                  ? "bg-neutral-100 text-neutral-400 border border-neutral-200 dark:bg-[#1a1a1a] dark:text-[#555] dark:border-[#262626] cursor-not-allowed"
                                  : "bg-[#EF2F38]/10 text-[#EF2F38] border border-[#EF2F38]/20 hover:bg-[#EF2F38] hover:text-white cursor-pointer"
                              )}
                            >
                              <Plus size={13} weight="bold" /> ADD
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODE B: COMPACT LIST VIEW (RAPID RETAIL SCANNER) */
              <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-[10px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-[#262626]">
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Product Name & Sizing</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Stock Status</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3 text-right">Quick Checkout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-[#1f1f1f]">
                      {filteredProducts.map(product => {
                        const inCartQty = cartQuantities[product.id] || 0;
                        const isLowStock = product.stock <= product.minStockThreshold && product.stock > 0;
                        const isOutOfStock = product.stock <= 0;

                        return (
                          <tr
                            key={product.id}
                            className={cn(
                              "transition-colors",
                              inCartQty > 0
                                ? "bg-red-50/50 dark:bg-red-950/20"
                                : isOutOfStock
                                ? "opacity-60 bg-neutral-50/50 dark:bg-[#111]"
                                : "hover:bg-neutral-50 dark:hover:bg-[#1a1a1a]"
                            )}
                          >
                            <td className="py-2.5 px-3 font-bold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                              {product.sku}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-neutral-900 dark:text-white">
                                  {product.name}
                                </span>
                                {product.hasVariants && product.variants && product.variants.length > 0 ? (
                                  <span className="text-[9px] bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 px-1.5 py-0.2 rounded font-bold whitespace-nowrap">
                                    {product.variants.length} Variants
                                  </span>
                                ) : product.size ? (
                                  <span className="text-[9px] bg-neutral-100 dark:bg-[#222] px-1.5 py-0.2 rounded border border-neutral-200 dark:border-[#333] text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                    Size {product.size}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                              {product.category}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isOutOfStock ? (
                                <span className="text-rose-700 dark:text-rose-400 font-bold text-[10px] flex items-center gap-1">
                                  <Warning size={10} weight="fill" /> OUT
                                </span>
                              ) : isLowStock ? (
                                <span className="text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1">
                                  <Warning size={10} weight="fill" /> LOW ({product.stock})
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                  {product.stock} in stock
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-black text-neutral-900 dark:text-white">
                                ${product.price.toFixed(2)}
                              </span>
                              <span className="block text-[9px] text-neutral-500 dark:text-neutral-400 leading-none">
                                ≈ {formatKHR(product.price)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end">
                                {product.hasVariants && product.variants && product.variants.length > 0 ? (
                                  <button
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => addToCart(product)}
                                    className={cn(
                                      "px-2.5 py-1 text-[10px] font-mono font-bold rounded-[6px] flex items-center gap-1 transition active:scale-95 touch-manipulation cursor-pointer",
                                      isOutOfStock
                                        ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                        : "bg-[#EF2F38] text-white hover:bg-[#d6242c]"
                                    )}
                                  >
                                    <Tag size={11} weight="bold" /> {inCartQty > 0 ? `(${inCartQty}) Choose` : 'Choose'}
                                  </button>
                                ) : inCartQty > 0 ? (
                                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-red-500/40 rounded-[6px] p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(getCartItemKey({ product }), -1)}
                                      className="p-1 hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer active:scale-90 touch-manipulation"
                                    >
                                      <Minus size={10} weight="bold" />
                                    </button>
                                    <span className="text-xs font-bold text-[#EF2F38] px-1.5 min-w-[18px] text-center">
                                      {inCartQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addToCart(product)}
                                      disabled={inCartQty >= product.stock}
                                      className="p-1 hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer disabled:opacity-30 active:scale-90 touch-manipulation"
                                    >
                                      <Plus size={10} weight="bold" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => addToCart(product)}
                                    className={cn(
                                      "px-2.5 py-1 text-[10px] font-mono font-bold rounded-[6px] flex items-center gap-1 transition active:scale-95 touch-manipulation",
                                      isOutOfStock
                                        ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                        : "bg-[#EF2F38]/10 text-[#EF2F38] hover:bg-[#EF2F38] hover:text-white cursor-pointer"
                                    )}
                                  >
                                    <Plus size={10} weight="bold" /> ADD
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Rapid Row Scanner List */}
                <div className="md:hidden divide-y divide-neutral-200 dark:divide-[#1f1f1f]">
                  {filteredProducts.map(product => {
                    const inCartQty = cartQuantities[product.id] || 0;
                    const isLowStock = product.stock <= product.minStockThreshold && product.stock > 0;
                    const isOutOfStock = product.stock <= 0;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          "p-3 flex items-center justify-between gap-3 transition-colors",
                          inCartQty > 0
                            ? "bg-red-50/50 dark:bg-red-950/20"
                            : isOutOfStock
                            ? "opacity-60 bg-neutral-50/50 dark:bg-[#111]"
                            : ""
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#0F0F0F] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626]">
                              {product.sku}
                            </span>
                            {product.hasVariants && product.variants && product.variants.length > 0 ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 font-bold">
                                {product.variants.length} Variations
                              </span>
                            ) : product.size ? (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-[#222] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-[#333]">
                                {product.size}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate mt-1">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono">
                            <span className="font-bold text-[#EF2F38]">${product.price.toFixed(2)}</span>
                            <span>•</span>
                            {isOutOfStock ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">OUT</span>
                            ) : isLowStock ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{product.stock} left</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">{product.stock} in stock</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Touch Controls */}
                        <div className="shrink-0 flex items-center">
                          {product.hasVariants && product.variants && product.variants.length > 0 ? (
                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1 transition active:scale-95 touch-manipulation cursor-pointer",
                                isOutOfStock
                                  ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                  : "bg-[#EF2F38] text-white shadow-xs"
                              )}
                            >
                              <Tag size={12} weight="bold" /> {inCartQty > 0 ? `(${inCartQty}) Choose` : 'Choose'}
                            </button>
                          ) : inCartQty > 0 ? (
                            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#0F0F0F] border border-red-500/40 rounded-[8px] p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(getCartItemKey({ product }), -1)}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer active:scale-90 touch-manipulation"
                              >
                                <Minus size={12} weight="bold" />
                              </button>
                              <span className="text-xs font-bold font-mono text-[#EF2F38] px-1.5 min-w-[20px] text-center">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                disabled={inCartQty >= product.stock}
                                className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-[#222] text-neutral-800 dark:text-white rounded transition cursor-pointer disabled:opacity-30 active:scale-90 touch-manipulation"
                              >
                                <Plus size={12} weight="bold" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => addToCart(product)}
                              className={cn(
                                "px-3 py-1.5 min-h-[36px] text-xs font-mono font-bold rounded-[8px] flex items-center gap-1 transition active:scale-95 touch-manipulation",
                                isOutOfStock
                                  ? "bg-neutral-100 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] cursor-not-allowed"
                                  : "bg-[#EF2F38]/10 text-[#EF2F38] hover:bg-[#EF2F38] hover:text-white cursor-pointer"
                              )}
                            >
                              <Plus size={12} weight="bold" /> ADD
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile/Tablet Fixed Cart Quick Bar */}
            {cart.length > 0 && (
              <div className="lg:hidden fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-80 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 p-2.5 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2.5 pl-2">
                  <ShoppingCart size={18} className="text-[#EF2F38]" />
                  <div>
                    <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white block">
                      {cart.reduce((s, i) => s + i.quantity, 0)} items
                    </span>
                    <span className="text-xs font-mono font-black text-[#EF2F38]">
                      ${grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cartEl = document.getElementById('pos-checkout-cart');
                    cartEl?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 min-h-[44px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-mono font-bold uppercase rounded-[8px] transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation flex items-center justify-center gap-1"
                >
                  Checkout →
                </button>
              </div>
            )}
          </div>

          {/* CART & CHECKOUT TERMINAL (4 Columns) - STICKY PANEL */}
          <div
            id="pos-checkout-cart"
            className="lg:col-span-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-90px)] flex flex-col bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 sm:p-4 shadow-sm relative"
          >
            {/* Parked / Held Cart Notification Banner */}
            {parkedCart && (
              <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-[8px] p-2.5 flex items-center justify-between text-xs font-mono text-amber-900 dark:text-amber-300 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Pause size={14} weight="bold" className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold">Hold: {parkedItemsCount} item{parkedItemsCount > 1 ? 's' : ''} (${parkedGrandTotal.toFixed(2)})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={resumeParkedCart}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] font-bold text-[10px] cursor-pointer transition flex items-center gap-1 shadow-sm"
                  >
                    <Play size={10} weight="fill" /> Resume
                  </button>
                  <button
                    type="button"
                    onClick={discardParkedCart}
                    className="p-1 hover:bg-amber-200 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 rounded-[6px] cursor-pointer transition"
                    title="Discard held cart"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#EF2F38]" />
                <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-900 dark:text-white">
                  CHECKOUT TERMINAL
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {cart.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={parkCurrentCart}
                      className="px-2 py-0.5 text-[9px] font-mono text-neutral-700 hover:text-amber-600 dark:text-neutral-300 dark:hover:text-amber-400 border border-neutral-200 dark:border-[#262626] bg-neutral-100 dark:bg-[#0F0F0F] rounded-[6px] transition cursor-pointer flex items-center gap-1"
                      title="Hold current cart to serve next customer"
                    >
                      <Pause size={10} weight="bold" /> Hold
                    </button>
                    <button
                      type="button"
                      onClick={clearCart}
                      className="px-2 py-0.5 text-[9px] font-mono text-neutral-700 hover:text-[#EF2F38] dark:text-neutral-300 dark:hover:text-[#EF2F38] border border-neutral-200 dark:border-[#262626] bg-neutral-100 dark:bg-[#0F0F0F] rounded-[6px] transition cursor-pointer flex items-center gap-1"
                      title="Clear Cart"
                    >
                      <Trash size={10} /> Clear
                    </button>
                  </>
                )}
                <span className="text-[10px] font-mono bg-neutral-100 dark:bg-[#0F0F0F] px-2 py-0.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 font-bold">
                  {cart.reduce((s, i) => s + i.quantity, 0)} ITEMS
                </span>
              </div>
            </div>

            {/* Customer Tagging: Searchable Combobox with Belt Badges */}
            <div className="mb-3 shrink-0 relative" ref={studentComboboxRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] font-mono font-bold uppercase text-neutral-600 dark:text-neutral-400">
                  CUSTOMER / STUDENT
                </label>
                {selectedStudentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId('');
                      setStudentSearchTerm('');
                    }}
                    className="text-[9px] font-mono text-amber-700 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <X size={10} /> Switch to Walk-in
                  </button>
                )}
              </div>

              {selectedStudent ? (
                /* Selected Student Card */
                <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px] flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#202020] border-2 border-red-500/40 flex items-center justify-center font-bold text-xs text-neutral-800 dark:text-neutral-200 shrink-0">
                      {selectedStudent.englishName ? selectedStudent.englishName.slice(0, 2).toUpperCase() : 'ST'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {selectedStudent.englishName}
                        </p>
                        {selectedStudent.khmerName && (
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                            ({selectedStudent.khmerName})
                          </span>
                        )}
                        <span className={cn("text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-bold", getBeltColorClass(selectedStudent.currentBelt))}>
                          {selectedStudent.currentBelt}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {state.branches.find(b => b.id === selectedStudent.homeBranchId)?.name || 'Dojang Member'} • {selectedStudent.phone || selectedStudent.id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId('')}
                    className="p-1 text-neutral-400 hover:text-[#EF2F38] dark:text-neutral-500 dark:hover:text-[#EF2F38] cursor-pointer transition ml-2"
                    title="Remove Tag"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                /* Searchable Combobox Input */
                <div className="relative">
                  <div className="relative">
                    <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search student by name, belt, or phone..."
                      value={studentSearchTerm}
                      onFocus={() => setIsStudentDropdownOpen(true)}
                      onChange={e => {
                        setStudentSearchTerm(e.target.value);
                        setIsStudentDropdownOpen(true);
                      }}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-2 rounded-[8px] focus:outline-none focus:border-[#EF2F38] font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                    {studentSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setStudentSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Options */}
                  {isStudentDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] shadow-2xl max-h-56 overflow-y-auto scrollbar-thin">
                      <div
                        onClick={() => {
                          setSelectedStudentId('');
                          setStudentSearchTerm('');
                          setIsStudentDropdownOpen(false);
                        }}
                        className="px-3 py-2.5 min-h-[44px] text-xs font-mono text-amber-700 dark:text-amber-400 hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] cursor-pointer border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between active:bg-neutral-200 dark:active:bg-[#202020] touch-manipulation"
                      >
                        <span className="font-bold">-- Walk-in Customer / Parent (No Tag) --</span>
                        <User size={14} />
                      </div>

                      {filteredStudents.length === 0 ? (
                        <div className="p-4 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400">
                          No students found matching "{studentSearchTerm}".
                        </div>
                      ) : (
                        filteredStudents.map(s => {
                          const branchName = state.branches.find(b => b.id === s.homeBranchId)?.name;
                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setIsStudentDropdownOpen(false);
                                setStudentSearchTerm('');
                              }}
                              className="px-3 py-2.5 min-h-[44px] text-xs font-mono hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] cursor-pointer border-b border-neutral-100 dark:border-[#1f1f1f] last:border-none flex items-center justify-between active:bg-neutral-200 dark:active:bg-[#202020] touch-manipulation"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-neutral-900 dark:text-white truncate">{s.englishName}</span>
                                  {s.khmerName && <span className="text-[10px] text-neutral-500 dark:text-neutral-400">({s.khmerName})</span>}
                                </div>
                                <p className="text-[9px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                  {branchName || 'Dojang'} • {s.phone || s.id}
                                </p>
                              </div>
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded border uppercase shrink-0 font-bold", getBeltColorClass(s.currentBelt))}>
                                {s.currentBelt}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List - SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-[120px] max-h-[240px] space-y-2 mb-3">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-[#262626] rounded-[8px] flex flex-col items-center justify-center bg-neutral-50 dark:bg-transparent">
                  <ShoppingCart size={24} className="text-neutral-400 dark:text-[#444] mb-2" />
                  Cart is empty. Click items to add.
                </div>
              ) : (
                cart.map(item => {
                  const itemKey = getCartItemKey(item);
                  const itemPrice = item.variant?.price_override ?? item.product.price;
                  return (
                    <div key={itemKey} className="flex items-center justify-between bg-neutral-50 dark:bg-[#0F0F0F] p-2.5 rounded-[8px] border border-neutral-200 dark:border-[#262626] shadow-sm">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[11px] font-bold text-neutral-900 dark:text-white truncate">
                            {item.product.name}
                          </p>
                          {item.variant ? (
                            <>
                              {item.variant.color && (
                                <span className="text-[9px] font-mono bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/30 px-1 rounded font-bold">
                                  {item.variant.color}
                                </span>
                              )}
                              {item.variant.size && (
                                <span className="text-[9px] font-mono bg-neutral-200 dark:bg-[#202020] px-1 rounded text-neutral-700 dark:text-neutral-300 font-bold">
                                  {item.variant.size}
                                </span>
                              )}
                            </>
                          ) : item.product.size ? (
                            <span className="text-[9px] font-mono bg-neutral-200 dark:bg-[#202020] px-1 rounded text-neutral-600 dark:text-neutral-400">
                              {item.product.size}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[9px] font-mono text-neutral-600 dark:text-neutral-400 mt-0.5">
                          <span className="text-neutral-400 mr-1">SKU: {item.variant?.sku || item.product.sku}</span>
                          • ${itemPrice.toFixed(2)} × {item.quantity} = <strong className="text-[#EF2F38]">${(itemPrice * item.quantity).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(itemKey, -1)}
                          className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1a1a1a] dark:hover:bg-[#262626] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[6px] cursor-pointer active:scale-90 touch-manipulation"
                          title="Decrease"
                        >
                          <Minus size={11} weight="bold" />
                        </button>
                        <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(itemKey, 1)}
                          className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center bg-neutral-200 hover:bg-neutral-300 dark:bg-[#1a1a1a] dark:hover:bg-[#262626] border border-neutral-300 dark:border-[#262626] text-neutral-800 dark:text-white rounded-[6px] cursor-pointer active:scale-90 touch-manipulation"
                          title="Increase"
                        >
                          <Plus size={11} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(itemKey)}
                          className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center text-neutral-400 hover:text-[#EF2F38] dark:text-neutral-500 dark:hover:text-[#EF2F38] ml-0.5 cursor-pointer transition-colors active:scale-90 touch-manipulation"
                          title="Remove"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Order Notes Collapsible Section */}
            <div className="mb-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                className="text-[10px] font-mono text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1 touch-manipulation"
              >
                <ChatCenteredText size={12} weight={orderNotes ? "fill" : "regular"} className={orderNotes ? "text-[#EF2F38]" : ""} />
                <span>Order Notes {orderNotes ? `("${orderNotes.slice(0, 15)}...")` : ''}</span>
                <span className="text-[9px] text-neutral-400">({isNotesExpanded ? 'Hide' : 'Add'})</span>
              </button>
              {isNotesExpanded && (
                <div className="mt-1.5 animate-in fade-in">
                  <textarea
                    rows={2}
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    placeholder="Embroidery name, uniform size swap, pickup notes..."
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] p-2 rounded-[6px] focus:outline-none focus:border-[#EF2F38] font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Financial Calculations & Checkout Tools */}
            <div className="border-t border-neutral-200 dark:border-[#262626] pt-3 space-y-3 shrink-0">

              {/* Discount Controls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
                  <span>DISCOUNT ({clampedDiscount}%):</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-12 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-1.5 py-0.5 text-center text-[10px] font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-[#EF2F38]"
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="flex gap-1">
                  {[0, 5, 10, 15, 20].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiscountPercent(d)}
                      className={cn(
                        "flex-1 py-1 min-h-[34px] text-[10px] font-mono rounded-[6px] border transition cursor-pointer font-bold active:scale-95 touch-manipulation",
                        discountPercent === d
                          ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm"
                          : "bg-neutral-100 dark:bg-[#0F0F0F] border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtotal & Dual-Currency Grand Total */}
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[#EF2F38]">
                    <span>Discount ({clampedDiscount}%):</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-1.5 border-t border-neutral-200 dark:border-[#262626]">
                  <div>
                    <span className="text-xs font-bold text-neutral-900 dark:text-white block">GRAND TOTAL:</span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Exchange @ 4,100 KHR</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-[#EF2F38] block leading-tight">
                      ${grandTotal.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 font-mono">
                      ≈ {formatKHR(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ABA Bank KHQR')}
                  className={cn(
                    "p-2.5 min-h-[44px] text-xs font-mono rounded-[8px] border flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95 touch-manipulation",
                    paymentMethod === 'ABA Bank KHQR'
                      ? "bg-red-50 text-[#EF2F38] border-[#EF2F38] dark:bg-red-500/10 dark:text-[#EF2F38] dark:border-[#EF2F38] font-bold shadow-sm"
                      : "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  <QrCode size={16} weight="bold" /> ABA KHQR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={cn(
                    "p-2.5 min-h-[44px] text-xs font-mono rounded-[8px] border flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95 touch-manipulation",
                    paymentMethod === 'Cash'
                      ? "bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500 font-bold shadow-sm"
                      : "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] hover:text-neutral-900 dark:hover:text-white"
                  )}
                >
                  <Money size={16} weight="bold" /> CASH DRAWER
                </button>
              </div>

              {/* CASH REGISTER TOOLS: Tendered & Change Calculator with KHR */}
              {paymentMethod === 'Cash' && cart.length > 0 && (
                <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2.5 rounded-[8px] space-y-2 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
                    <span>CASH TENDERED (USD):</span>
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-900 dark:text-white font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        className="w-20 bg-white dark:bg-[#141414] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2 py-1 text-right text-xs font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Preset Bills */}
                  <div className="flex gap-1">
                    {[10, 20, 50, 100].map(bill => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => setCashTendered(String(bill))}
                        className="flex-1 py-1.5 min-h-[36px] bg-white hover:bg-neutral-100 dark:bg-[#141414] dark:hover:bg-[#202020] border border-neutral-200 dark:border-[#262626] text-xs font-mono text-neutral-800 dark:text-[#ccc] rounded-[6px] transition cursor-pointer font-bold active:scale-95 touch-manipulation"
                      >
                        ${bill}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotal.toFixed(2))}
                      className="px-2.5 py-1.5 min-h-[36px] bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-xs font-mono text-emerald-800 dark:text-emerald-400 font-bold rounded-[6px] transition cursor-pointer active:scale-95 touch-manipulation"
                      title="Exact amount"
                    >
                      Exact
                    </button>
                  </div>

                  {/* Change Due Display in USD and KHR */}
                  <div className="flex items-center justify-between text-xs font-mono pt-1.5 border-t border-neutral-200 dark:border-[#1f1f1f]">
                    <span className="text-neutral-600 dark:text-neutral-400">CHANGE DUE:</span>
                    <div className="text-right">
                      <span className={cn("font-black block", isCashInsufficient ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
                        {isCashInsufficient ? `Short by $${(grandTotal - tenderedAmountNumber).toFixed(2)}` : `$${changeDue.toFixed(2)}`}
                      </span>
                      {!isCashInsufficient && changeDue > 0 && (
                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block">
                          ≈ {formatKHR(changeDue)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Checkout Actions */}
              {paymentMethod === 'ABA Bank KHQR' ? (
                <button
                  type="button"
                  onClick={() => setIsKhqrModalOpen(true)}
                  disabled={cart.length === 0}
                  className={cn(
                    "w-full py-3.5 min-h-[48px] text-xs sm:text-sm font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 touch-manipulation",
                    cart.length === 0
                      ? "bg-neutral-200 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] border border-neutral-300 dark:border-[#262626] cursor-not-allowed"
                      : "bg-[#EF2F38] hover:bg-[#d6242c] text-white cursor-pointer shadow-red-500/20"
                  )}
                >
                  <QrCode size={18} weight="bold" />
                  PREVIEW KHQR & PAY (${grandTotal.toFixed(2)})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={executeCompleteSale}
                  disabled={cart.length === 0 || isCashInsufficient}
                  className={cn(
                    "w-full py-3.5 min-h-[48px] text-xs sm:text-sm font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 touch-manipulation",
                    cart.length === 0 || isCashInsufficient
                      ? "bg-neutral-200 text-neutral-400 dark:bg-[#1a1a1a] dark:text-[#555] border border-neutral-300 dark:border-[#262626] cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-500/20"
                  )}
                >
                  <CheckCircle size={18} weight="bold" />
                  COMPLETE CASH SALE (${grandTotal.toFixed(2)})
                </button>
              )}

            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: INCOMING STUDENT PORTAL ORDERS QUEUE                              */}
      {/* ========================================================================= */}
      {activeMainTab === 'orders' && (
        <div className="flex flex-col space-y-4 flex-1">
          {/* Top Control Bar & Filters */}
          <div className="flex flex-col gap-2.5 sm:gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3 sm:p-3.5 rounded-[8px] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Status Filter Pills with Real-time Count Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap max-w-full pb-1 lg:pb-0">
                {(['ALL', 'PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setOrdersFilter(f)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-mono rounded-[8px] border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0",
                      ordersFilter === f
                        ? "bg-[#EF2F38] text-white font-bold border-[#EF2F38] shadow-sm"
                        : "bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200 dark:bg-[#0F0F0F] dark:text-neutral-400 dark:border-[#262626] dark:hover:text-white"
                    )}
                  >
                    <span>{f === 'CONFIRMED' ? 'CONFIRMED / PREP' : f}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 text-[9px] rounded-full font-mono font-bold leading-none",
                        ordersFilter === f
                          ? "bg-white/25 text-white"
                          : "bg-neutral-200 dark:bg-[#222] text-neutral-600 dark:text-neutral-400"
                      )}
                    >
                      {orderStatusCounts[f] ?? 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right Side: Search Bar & Sync Queue Button */}
              <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                <div className="relative flex-1 sm:w-64">
                  <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search order #, student, phone..."
                    value={ordersSearch}
                    onChange={e => setOrdersSearch(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-1.5 rounded-[8px] focus:outline-none focus:border-[#EF2F38] placeholder:text-neutral-400 dark:placeholder:text-neutral-600 font-mono"
                  />
                  {ordersSearch && (
                    <button
                      type="button"
                      onClick={() => setOrdersSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fetchStudentOrders()}
                  disabled={isOrdersLoading}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:border-[#262626] rounded-[8px] text-xs font-mono font-bold flex items-center gap-1.5 dark:text-[#E4E4E4] dark:hover:bg-[#1a1a1a] cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowsClockwise size={13} className={isOrdersLoading ? 'animate-spin' : ''} />
                  <span>SYNC QUEUE</span>
                </button>
              </div>
            </div>

            {/* Sub-bar: Showing Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626] text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>
                Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{filteredStudentOrders.length}</span> of {studentOrders.length} orders
              </span>
              <span className="hidden sm:inline text-neutral-400 dark:text-neutral-600">
                Filter by status or search by customer detail
              </span>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {filteredStudentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] text-center shadow-sm">
              <Package size={40} className="text-neutral-400 dark:text-[#555] mb-3" />
              <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white">NO ORDERS IN QUEUE</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1">Student portal pre-orders will appear here automatically in real time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStudentOrders.map((order) => {
                const isPending = order.order_status === 'PENDING_CONFIRMATION';
                const isConfirmed = order.order_status === 'CONFIRMED' || order.order_status === 'PREPARING';
                const isReady = order.order_status === 'READY_FOR_PICKUP';
                const isCompleted = order.order_status === 'COMPLETED';
                const isCancelled = order.order_status === 'CANCELLED';

                // Stepper index
                let currentStep = 1;
                if (isConfirmed) currentStep = 2;
                else if (isReady) currentStep = 3;
                else if (isCompleted) currentStep = 4;

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black font-mono text-neutral-900 dark:text-white">
                            {order.order_number}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-[8px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-neutral-700 dark:text-neutral-300 font-bold">
                            {order.order_channel}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPackingSlipOrder(order)}
                          className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:border-[#262626] dark:text-[#ccc] rounded-[6px] text-[10px] font-mono flex items-center gap-1 cursor-pointer transition font-bold"
                          title="Print Bag Packing Slip"
                        >
                          <Printer size={12} />
                          SLIP
                        </button>
                        <span
                          className={cn(
                            "text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border",
                            isPending
                              ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 animate-pulse"
                              : isConfirmed
                              ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"
                              : isReady
                              ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30"
                              : isCompleted
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                              : "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30"
                          )}
                        >
                          {order.order_status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Visual Order Pipeline Progress Stepper */}
                    {!isCancelled && (
                      <div className="bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#1f1f1f] rounded-[8px] p-2.5">
                        <div className="grid grid-cols-4 gap-1 text-center">
                          {[
                            { step: 1, label: 'Received' },
                            { step: 2, label: 'Confirmed' },
                            { step: 3, label: 'Ready' },
                            { step: 4, label: 'Handover' }
                          ].map(s => {
                            const isPast = currentStep >= s.step;
                            const isCurrent = currentStep === s.step;
                            return (
                              <div key={s.step} className="flex flex-col items-center">
                                <div className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold mb-1 transition-all",
                                  isPast
                                    ? "bg-[#EF2F38] text-white"
                                    : "bg-neutral-200 text-neutral-500 dark:bg-[#1f1f1f] dark:text-[#666]"
                                )}>
                                  {isPast ? <Check size={10} weight="bold" /> : s.step}
                                </div>
                                <span className={cn(
                                  "text-[9px] font-mono uppercase tracking-wider",
                                  isCurrent ? "text-neutral-900 dark:text-white font-bold" : isPast ? "text-neutral-700 dark:text-[#ccc]" : "text-neutral-400 dark:text-[#666]"
                                )}>
                                  {s.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Student Details & Payment */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-3 rounded-[8px]">
                      <div>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase">Customer / Athlete</span>
                        <p className="font-bold text-neutral-900 dark:text-white">
                          {order.students?.english_name || order.customer_name}
                        </p>
                        {order.students?.current_belt && (
                          <span className={cn("inline-block text-[9px] px-1.5 py-0.2 rounded border uppercase font-bold mt-0.5", getBeltColorClass(order.students.current_belt))}>
                            {order.students.current_belt}
                          </span>
                        )}
                        {order.customer_phone && (
                          <p className="text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5">{order.customer_phone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase">Payment ({order.payment_status})</span>
                        <p className="font-black text-[#EF2F38] text-sm">${order.total_usd.toFixed(2)}</p>
                        <p className="text-[10px] text-neutral-600 dark:text-neutral-400">{order.payment_method}</p>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase text-neutral-600 dark:text-neutral-400">Order Items</span>
                      <div className="space-y-1 bg-neutral-50 dark:bg-[#0A0A0A] p-2.5 rounded-[8px] border border-neutral-200 dark:border-[#262626]">
                        {order.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-xs font-mono py-1 border-b border-neutral-200 dark:border-[#1f1f1f] last:border-none"
                          >
                            <span className="text-neutral-800 dark:text-[#ccc]">
                              {item.product_name} {item.size ? `(${item.size})` : ''} × {item.quantity}
                            </span>
                            <span className="font-bold text-neutral-900 dark:text-white">
                              ${item.total_price_usd.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Student Notes */}
                    {order.student_notes && (
                      <p className="text-[11px] font-mono italic text-neutral-700 dark:text-neutral-300 bg-amber-50/50 dark:bg-[#0F0F0F] border border-amber-200/50 dark:border-[#262626] p-2 rounded-[8px]">
                        Note: {order.student_notes}
                      </p>
                    )}

                    {/* Action Controls */}
                    <div className="pt-2 border-t border-neutral-200 dark:border-[#262626] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCancelStudentOrder(order.id, order.order_number)}
                            className="flex-1 sm:flex-initial px-3.5 py-2.5 min-h-[42px] text-xs font-mono font-bold text-rose-700 hover:bg-rose-50 border border-rose-300 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/20 rounded-[8px] transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order.id, 'CONFIRMED', 'PAID')}
                            className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold rounded-[8px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 touch-manipulation"
                          >
                            <CheckCircle size={16} weight="bold" /> Confirm & Mark Paid
                          </button>
                        </>
                      )}

                      {isConfirmed && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCancelStudentOrder(order.id, order.order_number)}
                            className="flex-1 sm:flex-initial px-3.5 py-2.5 min-h-[42px] text-xs font-mono font-bold text-rose-700 hover:bg-rose-50 border border-rose-300 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:border-rose-500/20 rounded-[8px] transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center justify-center"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateOrderStatus(order.id, 'READY_FOR_PICKUP')}
                            className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 text-white text-xs font-mono font-bold rounded-[8px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 touch-manipulation"
                          >
                            <Package size={16} weight="bold" /> Mark Ready for Pickup
                          </button>
                        </>
                      )}

                      {isReady && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'COMPLETED')}
                          className="w-full py-3 min-h-[46px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-mono font-bold uppercase rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 touch-manipulation"
                        >
                          <CheckCircle size={16} weight="bold" /> Complete Handover at Desk
                        </button>
                      )}

                      {isCompleted && (
                        <p className="w-full text-center text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold py-1">
                          ✓ Handover Completed
                        </p>
                      )}

                      {isCancelled && (
                        <p className="w-full text-center text-xs font-mono text-rose-700 dark:text-rose-400 font-bold py-1">
                          ✕ Order Cancelled
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: INVENTORY CATALOG & STOCK LEDGER                                   */}
      {/* ========================================================================= */}
      {activeMainTab === 'inventory' && (
        <div className="flex flex-col space-y-4 flex-1">

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Total SKUs</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-neutral-900 dark:text-white mt-1">
                {catalog.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Low Stock</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                {lowStockCount}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Out of Stock</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {outOfStockCount}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Valuation</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                ${totalInventoryValuation.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Table Filter Controls */}
          <div className="flex flex-col gap-2.5 sm:gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3 sm:p-3.5 rounded-[8px] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Category & Stock Health Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap max-w-full pb-1 lg:pb-0">
                {/* Category Filter */}
                <select
                  value={inventoryCategory}
                  onChange={e => setInventoryCategory(e.target.value)}
                  className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-1.5 min-h-[38px] focus:outline-none focus:border-[#EF2F38] font-mono cursor-pointer shrink-0"
                >
                  {dynamicCategories.map(c => (
                    <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
                  ))}
                </select>

                {/* Stock Health Filter Pills with Real-time Count Badges */}
                <div className="flex items-center bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 shrink-0 min-h-[38px]">
                  {(['ALL', 'LOW', 'OUT', 'HEALTHY'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setInventoryStockFilter(f)}
                      className={cn(
                        "px-2.5 py-1 min-h-[34px] text-[10px] font-mono rounded-[6px] transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation",
                        inventoryStockFilter === f
                          ? "bg-white text-neutral-900 shadow-sm font-bold border border-neutral-200/80 dark:bg-[#222] dark:text-white dark:border-neutral-700"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                    >
                      <span>{f}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.2 text-[9px] rounded-full font-mono font-bold leading-none",
                          f === 'LOW' && (inventoryStockCounts.LOW > 0)
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
                            : f === 'OUT' && (inventoryStockCounts.OUT > 0)
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400"
                            : f === 'HEALTHY'
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-neutral-200 dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-400"
                        )}
                      >
                        {inventoryStockCounts[f]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side: Search Input with Clear Button */}
              <div className="relative w-full lg:w-64 shrink-0">
                <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search SKU or product name..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-2 min-h-[38px] rounded-[8px] focus:outline-none focus:border-[#EF2F38] font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                />
                {inventorySearch && (
                  <button
                    type="button"
                    onClick={() => setInventorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer p-1.5 active:scale-90 touch-manipulation"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-bar: Showing Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626] text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>
                Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{filteredInventory.length}</span> of {catalog.length} SKUs
              </span>
              <span className="hidden sm:inline text-neutral-400 dark:text-neutral-600">
                Live inventory tracking with real-time stock thresholds
              </span>
            </div>
          </div>

          {/* Desktop Inventory Ledger Table */}
          <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm flex-1">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-left text-xs font-mono">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock Health</th>
                    <th className="py-3 px-4 text-right">Valuation</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                        No inventory records match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map(prod => {
                      const isLowStock = prod.stock <= prod.minStockThreshold && prod.stock > 0;
                      const isOutOfStock = prod.stock <= 0;
                      const maxBar = Math.max(prod.minStockThreshold * 2.5, 20);
                      const percent = Math.min(100, Math.round((prod.stock / maxBar) * 100));

                      const isExpanded = expandedProductIds.has(prod.id);
                      const hasVar = Boolean(prod.hasVariants && prod.variants && prod.variants.length > 0);

                      return (
                        <React.Fragment key={prod.id}>
                          <tr className="hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors">
                            <td className="py-3 px-4 font-bold text-[#EF2F38]">{prod.sku}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-neutral-900 dark:text-white">{prod.name}</span>
                                {hasVar && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedProductIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(prod.id)) next.delete(prod.id);
                                        else next.add(prod.id);
                                        return next;
                                      });
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 cursor-pointer flex items-center gap-1 transition-colors"
                                    title="View sizes and collar variations"
                                  >
                                    <Sparkle size={10} className="text-[#EF2F38]" />
                                    <span>{prod.variants!.length} Variations</span>
                                    <CaretDown size={11} className={cn("transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{prod.category}</td>
                            <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                              {hasVar ? (
                                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                                  {prod.sizes && prod.sizes.length > 0 ? prod.sizes.join(', ') : 'Multi-size'}
                                </span>
                              ) : (
                                prod.size || '—'
                              )}
                            </td>
                            <td className="py-3 px-4 text-neutral-900 dark:text-white font-bold">${prod.price.toFixed(2)}</td>

                            {/* Stock Health Progress Bar */}
                            <td className="py-3 px-4 min-w-[150px]">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className={cn(
                                  "font-bold",
                                  isOutOfStock ? "text-rose-600 dark:text-rose-400" : isLowStock ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                                )}>
                                  {prod.stock} units
                                </span>
                                <span className="text-neutral-500 dark:text-neutral-500">min: {prod.minStockThreshold}</span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-200 dark:bg-[#262626] rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                />
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-black text-neutral-900 dark:text-white">
                              ${(prod.price * prod.stock).toFixed(2)}
                            </td>

                            {/* Actions: Edit, Adjust Stock & Delete */}
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openEditProductModal(prod)}
                                  title="Edit Product Details"
                                  className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-neutral-300 dark:hover:text-[#EF2F38] dark:border-[#262626] rounded-[6px] transition cursor-pointer"
                                >
                                  <PencilSimple size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setAdjustingProduct(prod);
                                    setAdjustingVariant(null);
                                  }}
                                  title="Adjust Stock / Restock"
                                  className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:hover:text-[#EF2F38] dark:text-[#ccc] dark:border-[#262626] rounded-[6px] transition cursor-pointer text-[10px] font-bold"
                                >
                                  Restock
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                  title="Remove Product"
                                  className="p-1.5 bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-[#888] dark:border-[#262626] rounded-[6px] transition cursor-pointer"
                                >
                                  <Trash size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Variant Sub-Ledger */}
                          {isExpanded && hasVar && (
                            <tr className="bg-neutral-50/80 dark:bg-[#0D0D0D]">
                              <td colSpan={8} className="py-2.5 px-4 sm:px-6 border-y border-neutral-200 dark:border-[#262626]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                                    <span className="flex items-center gap-1.5">
                                      <Sparkle size={12} className="text-[#EF2F38]" />
                                      {prod.name} — Size & Style Variation Ledger
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono">
                                      {prod.variants!.length} active combinations
                                    </span>
                                  </div>

                                  <div className="border border-neutral-200 dark:border-[#222] rounded-[6px] overflow-hidden bg-white dark:bg-[#141414]">
                                    <table className="w-full text-left text-xs font-mono">
                                      <thead className="bg-neutral-100 dark:bg-[#1A1A1A] text-[9px] uppercase font-bold text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
                                        <tr>
                                          <th className="py-1.5 px-3">Variant SKU</th>
                                          <th className="py-1.5 px-3">Collar / Style</th>
                                          <th className="py-1.5 px-3">Size</th>
                                          <th className="py-1.5 px-3">Price</th>
                                          <th className="py-1.5 px-3">Stock Units</th>
                                          <th className="py-1.5 px-3 text-right">Quick Restock</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-neutral-100 dark:divide-[#202020]">
                                        {prod.variants!.map(v => (
                                          <tr key={v.sku} className="hover:bg-neutral-50 dark:hover:bg-[#181818] transition-colors">
                                            <td className="py-1.5 px-3 font-bold text-[#EF2F38] text-[11px]">{v.sku}</td>
                                            <td className="py-1.5 px-3 text-neutral-800 dark:text-neutral-200">
                                              {v.color ? (
                                                <span className="px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950/30 text-[#EF2F38] border border-red-500/20 font-bold text-[10px]">
                                                  {v.color}
                                                </span>
                                              ) : 'Standard'}
                                            </td>
                                            <td className="py-1.5 px-3 text-neutral-800 dark:text-neutral-200">
                                              {v.size ? (
                                                <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-[#222] text-neutral-700 dark:text-neutral-300 font-bold text-[10px] border border-neutral-200 dark:border-[#333]">
                                                  {v.size}
                                                </span>
                                              ) : 'Standard'}
                                            </td>
                                            <td className="py-1.5 px-3 font-bold text-neutral-900 dark:text-white text-[11px]">
                                              ${(v.price_override ?? prod.price).toFixed(2)}
                                            </td>
                                            <td className="py-1.5 px-3 text-[11px]">
                                              <span className={cn(
                                                "font-bold px-1.5 py-0.2 rounded text-[10px]",
                                                v.stock <= 0
                                                  ? "bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                                                  : v.stock <= (v.min_stock_threshold || prod.minStockThreshold)
                                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                              )}>
                                                {v.stock} units
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-3 text-right">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAdjustingProduct(prod);
                                                  setAdjustingVariant(v);
                                                }}
                                                className="px-2 py-0.5 text-[10px] font-bold font-mono bg-neutral-100 hover:bg-neutral-200 text-neutral-800 dark:bg-[#222] dark:hover:bg-[#2a2a2a] dark:text-[#E4E4E4] border border-neutral-300 dark:border-[#333] rounded-[4px] cursor-pointer transition active:scale-95"
                                              >
                                                Restock
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Inventory Cards View */}
          <div className="md:hidden space-y-3">
            {filteredInventory.length === 0 ? (
              <div className="py-10 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                No inventory records match the current filters.
              </div>
            ) : (
              filteredInventory.map(prod => {
                const isLowStock = prod.stock <= prod.minStockThreshold && prod.stock > 0;
                const isOutOfStock = prod.stock <= 0;
                const maxBar = Math.max(prod.minStockThreshold * 2.5, 20);
                const percent = Math.min(100, Math.round((prod.stock / maxBar) * 100));

                return (
                  <div
                    key={prod.id}
                    className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-3 font-mono"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-[#EF2F38] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-1.5 py-0.5 rounded">
                            {prod.sku}
                          </span>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            {prod.category}
                          </span>
                          {prod.size && (
                            <span className="text-[9px] bg-neutral-100 dark:bg-[#202020] px-1.5 py-0.2 rounded text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-[#262626]">
                              {prod.size}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white mt-1 leading-snug">
                          {prod.name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-neutral-900 dark:text-white">${prod.price.toFixed(2)}</div>
                        <div className="text-[9px] text-neutral-500 dark:text-neutral-400">Val: ${(prod.price * prod.stock).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Stock Health Bar */}
                    <div className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[6px] p-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={cn(
                          "font-bold",
                          isOutOfStock ? "text-rose-600 dark:text-rose-400" : isLowStock ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        )}>
                          {prod.stock} units in stock
                        </span>
                        <span className="text-neutral-500">Min: {prod.minStockThreshold}</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-200 dark:bg-[#262626] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                          )}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#202020]">
                      <button
                        type="button"
                        onClick={() => openEditProductModal(prod)}
                        className="flex-1 py-2 min-h-[38px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                      >
                        <PencilSimple size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustingProduct(prod)}
                        className="flex-1 py-2 min-h-[38px] bg-[#EF2F38]/10 hover:bg-[#EF2F38] text-[#EF2F38] hover:text-white border border-[#EF2F38]/20 rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                      >
                        <ArrowsClockwise size={13} />
                        <span>Restock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-[#888] dark:border-[#262626] rounded-[8px] transition cursor-pointer active:scale-90 touch-manipulation"
                        title="Delete product"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: SALES RECORDS & FINANCIAL AUDIT                                    */}
      {/* ========================================================================= */}
      {activeMainTab === 'history' && (
        <div className="flex flex-col space-y-4 flex-1">

          {/* Summary Metric Cards with AOV */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Total Revenue</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-neutral-900 dark:text-white mt-1">
                ${totalSalesRevenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Completed TX</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {filteredSales.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Items Sold</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-[#EF2F38] mt-1">
                {totalItemsSold}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 sm:p-4 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400">Avg Order (AOV)</span>
              <p className="text-lg sm:text-2xl font-black font-mono text-purple-700 dark:text-purple-400 mt-1">
                ${averageOrderValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Period Filter Pills, Method Filter & Search */}
          <div className="flex flex-col gap-2.5 sm:gap-3 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] p-3 sm:p-3.5 rounded-[8px] shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
              {/* Period Filter & Payment Method */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap max-w-full pb-1 lg:pb-0">
                {/* Period Filter Pills */}
                <div className="flex bg-neutral-100 dark:bg-[#0F0F0F] rounded-[8px] border border-neutral-200 dark:border-[#262626] p-0.5 shrink-0 min-h-[38px] items-center">
                  {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map(period => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSalesPeriodFilter(period)}
                      className={cn(
                        "px-2.5 py-1 min-h-[32px] text-[10px] font-mono rounded-[6px] transition cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation",
                        salesPeriodFilter === period
                          ? "bg-[#EF2F38] text-white font-bold shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      )}
                    >
                      {period === 'ALL' ? 'All Time' : period === 'TODAY' ? 'Today' : period === 'WEEK' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>

                {/* Payment Method Filter */}
                <select
                  value={salesMethodFilter}
                  onChange={e => setSalesMethodFilter(e.target.value as any)}
                  className="bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] rounded-[8px] px-3 py-1.5 min-h-[38px] focus:outline-none focus:border-[#EF2F38] font-mono cursor-pointer shrink-0"
                >
                  <option value="All">All Payment Methods</option>
                  <option value="ABA Bank KHQR">ABA Bank KHQR</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              {/* Right Side: Search Input with Clear Button & Clear History */}
              <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                <div className="relative flex-1 sm:w-64">
                  <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search TX #, customer, item..."
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] text-xs text-neutral-900 dark:text-[#E4E4E4] pl-8 pr-7 py-2 min-h-[38px] rounded-[8px] focus:outline-none focus:border-[#EF2F38] font-mono placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                  />
                  {salesSearch && (
                    <button
                      type="button"
                      onClick={() => setSalesSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer p-1.5 active:scale-90 touch-manipulation"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {salesHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      showConfirm(
                        'Are you sure you want to clear all POS sales history logs? This action cannot be undone.',
                        () => {
                          saveSalesToStorage([]);
                          showNotification('Sales history cleared.', 'info');
                        },
                        'Clear Sales History'
                      );
                    }}
                    className="px-3 py-2 min-h-[38px] text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 rounded-[8px] font-mono border border-rose-300 dark:border-rose-500/20 cursor-pointer transition-colors whitespace-nowrap font-bold shrink-0 active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    Clear Logs
                  </button>
                )}
              </div>
            </div>

            {/* Sub-bar: Showing Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626] text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>
                Showing <span className="font-bold text-neutral-900 dark:text-neutral-100">{filteredSales.length}</span> of {salesHistory.length} transactions
              </span>
              <span className="hidden sm:inline text-neutral-400 dark:text-neutral-600">
                Audited transactional ledger with payment method verification
              </span>
            </div>
          </div>

          {/* Desktop Sales History Table */}
          <div className="hidden md:block bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden shadow-sm flex-1">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-left text-xs font-mono">
                <thead className="bg-neutral-50 dark:bg-[#0F0F0F] text-[10px] uppercase font-bold text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
                  <tr>
                    <th className="py-3 px-4">TX ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer / Athlete</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-[#262626]">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                        No sales transactions recorded matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(tx => (
                      <tr key={tx.txId} className="hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors">
                        <td className="py-3 px-4 font-bold text-[#EF2F38]">{tx.txId}</td>
                        <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{tx.date}</td>
                        <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">{tx.studentName}</td>
                        <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300 max-w-xs truncate">
                          {tx.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-[6px] text-[10px] font-bold border",
                            tx.method === 'Cash'
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                              : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-[#EF2F38] dark:border-red-500/20"
                          )}>
                            {tx.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-neutral-900 dark:text-white">
                          ${tx.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setCompletedTx(tx)}
                              title="Re-print Thermal Receipt"
                              className="p-1.5 bg-neutral-100 hover:bg-[#EF2F38] hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#EF2F38] dark:hover:text-white dark:text-neutral-400 dark:border-[#262626] rounded-[6px] transition cursor-pointer"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleVoidSale(tx.txId)}
                              title="Void Transaction"
                              className="p-1.5 bg-neutral-100 hover:bg-red-600 hover:text-white text-neutral-600 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-neutral-400 dark:border-[#262626] rounded-[6px] transition cursor-pointer"
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Sales Cards View */}
          <div className="md:hidden space-y-3">
            {filteredSales.length === 0 ? (
              <div className="py-10 text-center text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                No sales transactions recorded matching criteria.
              </div>
            ) : (
              filteredSales.map(tx => (
                <div
                  key={tx.txId}
                  className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3.5 shadow-sm space-y-2.5 font-mono"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-[#202020] pb-2">
                    <div>
                      <span className="text-xs font-bold text-[#EF2F38]">{tx.txId}</span>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{tx.date}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-[6px] text-[10px] font-bold border",
                      tx.method === 'Cash'
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-[#EF2F38] dark:border-red-500/20"
                    )}>
                      {tx.method}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block uppercase">Customer</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{tx.studentName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block uppercase">Total</span>
                      <span className="text-sm font-black text-neutral-900 dark:text-white">${tx.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] p-2 rounded-[6px]">
                    <span className="text-[9px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block mb-0.5">Purchased Items:</span>
                    {tx.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#202020]">
                    <button
                      type="button"
                      onClick={() => setCompletedTx(tx)}
                      className="flex-1 py-2 min-h-[38px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-[#1a1a1a] dark:text-neutral-200 dark:border-[#262626] rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                    >
                      <Printer size={13} />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVoidSale(tx.txId)}
                      className="px-3 py-2 min-h-[38px] bg-neutral-100 hover:bg-red-600 hover:text-white text-rose-700 border border-neutral-300 dark:bg-[#0F0F0F] dark:hover:bg-red-600 dark:hover:text-white dark:text-rose-400 dark:border-[#262626] rounded-[8px] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                    >
                      <Trash size={13} />
                      <span>Void</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INTERACTIVE ABA KHQR CUSTOMER DISPLAY MODAL                       */}
      {/* ========================================================================= */}
      {isKhqrModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-white w-full max-w-sm rounded-[12px] p-4 sm:p-6 font-mono shadow-2xl flex flex-col items-center text-center space-y-4 my-auto max-h-[92dvh] overflow-y-auto animate-in zoom-in-95">
              <div className="w-full flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#EF2F38]">
                  <QrCode size={16} />
                  <span>ABA BANK KHQR DIGITAL PAYMENT</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKhqrModalOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Merchant Brand Header */}
              <div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Merchant Name</p>
                <h3 className="text-xs font-black text-neutral-900 dark:text-white mt-0.5">INFINITY TAEKWONDO ACADEMY</h3>
                <p className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">BAKONG ACCOUNT: info@infinitytkd</p>
              </div>

              {/* High-Contrast QR Code Card */}
              <div className="bg-white p-4 rounded-[12px] shadow-md border-2 border-red-500/40 flex flex-col items-center">
                <div className="w-48 h-48 bg-white flex flex-col items-center justify-center p-2 border border-neutral-200 rounded-[8px] relative">
                  {/* SVG Simulated KHQR Grid with Bakong Emblem */}
                  <svg className="w-full h-full text-black" viewBox="0 0 100 100" fill="currentColor">
                    {/* Outer corner markers */}
                    <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
                    <rect x="10" y="10" width="15" height="15" />
                    <rect x="70" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
                    <rect x="75" y="10" width="15" height="15" />
                    <rect x="5" y="70" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
                    <rect x="10" y="75" width="15" height="15" />
                    {/* Pattern clusters */}
                    <rect x="35" y="10" width="8" height="8" />
                    <rect x="48" y="15" width="14" height="6" />
                    <rect x="15" y="40" width="15" height="8" />
                    <rect x="40" y="35" width="20" height="20" fill="#EF2F38" rx="4" />
                    <rect x="70" y="40" width="10" height="15" />
                    <rect x="35" y="65" width="12" height="12" />
                    <rect x="55" y="70" width="18" height="10" />
                    <rect x="80" y="75" width="10" height="10" />
                    <rect x="35" y="85" width="25" height="6" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-black text-white bg-[#EF2F38] px-1.5 py-0.5 rounded font-sans tracking-tight shadow text-white-on-red">
                      KHQR
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-neutral-900 mt-2">Scan with any Mobile Banking App</span>
                <span className="text-[9px] text-neutral-600">ABA Mobile, Wing, Acleda, Bakong</span>
              </div>

              {/* Total Due Callout with Dual Currency */}
              <div className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px] p-3 space-y-1">
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-mono">Payable Amount</span>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-black text-[#EF2F38]">${grandTotal.toFixed(2)} USD</p>
                  <p className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400">≈ {formatKHR(grandTotal)}</p>
                </div>
                <p className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">Ref: {selectedStudent ? selectedStudent.englishName : 'Walk-in Counter POS'}</p>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={executeCompleteSale}
                  className="w-full py-2.5 min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-[8px] flex items-center justify-center gap-2 cursor-pointer shadow-sm transition active:scale-95 touch-manipulation"
                >
                  <CheckCircle size={16} weight="bold" />
                  Confirm Payment Received
                </button>
                <button
                  type="button"
                  onClick={() => setIsKhqrModalOpen(false)}
                  className="w-full py-2 min-h-[42px] bg-neutral-100 hover:bg-neutral-200 dark:bg-[#0F0F0F] dark:hover:bg-[#1f1f1f] text-neutral-700 dark:text-neutral-400 dark:hover:text-white text-xs rounded-[8px] border border-neutral-300 dark:border-[#262626] cursor-pointer transition font-bold active:scale-95 touch-manipulation"
                >
                  Cancel / Return to Cart
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STUDENT GEAR BAG PACKING SLIP MODAL                               */}
      {/* ========================================================================= */}
      {packingSlipOrder && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white text-neutral-900 w-full max-w-md rounded-[10px] p-4 sm:p-6 font-mono shadow-2xl flex flex-col justify-between space-y-4 my-auto max-h-[92dvh] overflow-y-auto">
              <div id="printable-packing-slip">
                {/* Slip Header */}
                <div className="text-center border-b-2 border-neutral-900 pb-3 mb-3">
                  <h2 className="text-sm font-black tracking-widest text-[#EF2F38]">INFINITY TAEKWONDO ACADEMY</h2>
                  <p className="text-[10px] text-neutral-700 font-bold uppercase tracking-wider">
                    STUDENT GEAR BAG PACKING SLIP
                  </p>
                  <p className="text-[9px] text-neutral-500 mt-1">
                    ORDER #: {packingSlipOrder.order_number} // {new Date(packingSlipOrder.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Student Details */}
                <div className="bg-neutral-100 p-2.5 rounded text-[10px] space-y-1 mb-3 border border-neutral-300 text-neutral-900">
                  <div className="flex justify-between">
                    <span className="font-bold">Student:</span>
                    <span>{packingSlipOrder.students?.english_name || packingSlipOrder.customer_name}</span>
                  </div>
                  {packingSlipOrder.students?.current_belt && (
                    <div className="flex justify-between">
                      <span className="font-bold">Belt Rank:</span>
                      <span>{packingSlipOrder.students.current_belt}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-bold">Pickup Branch:</span>
                    <span>{packingSlipOrder.branches?.branch_name || 'Main Academy'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Contact Phone:</span>
                    <span>{packingSlipOrder.customer_phone || '—'}</span>
                  </div>
                </div>

                {/* Packing Checklist */}
                <div className="space-y-1 mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-700">ITEMS TO PACK</p>
                  <div className="border border-neutral-300 rounded overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-neutral-200 text-neutral-800 uppercase font-bold">
                        <tr>
                          <th className="p-1.5 text-center w-8">Pack</th>
                          <th className="p-1.5">SKU / Item Description</th>
                          <th className="p-1.5 text-center">Size</th>
                          <th className="p-1.5 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 text-neutral-900">
                        {packingSlipOrder.items?.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-1.5 text-center">
                              <span className="inline-block w-3.5 h-3.5 border border-neutral-400 rounded-sm" />
                            </td>
                            <td className="p-1.5 font-semibold">
                              {it.product_name}
                              <span className="block text-[8px] text-neutral-600">{it.sku}</span>
                            </td>
                            <td className="p-1.5 text-center">{it.size || '—'}</td>
                            <td className="p-1.5 text-right font-bold">{it.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Student Notes */}
                {packingSlipOrder.student_notes && (
                  <div className="text-[9px] bg-neutral-50 border border-dashed border-neutral-300 p-2 rounded mb-3 text-neutral-800">
                    <strong>Notes:</strong> {packingSlipOrder.student_notes}
                  </div>
                )}

                {/* Signatures */}
                <div className="border-t border-neutral-300 pt-3 text-[9px] grid grid-cols-2 gap-4 text-neutral-600">
                  <div>
                    <p>Packed By: ________________</p>
                    <p className="mt-1">Date: ________________</p>
                  </div>
                  <div className="text-right">
                    <p>Received By: ________________</p>
                    <p className="mt-1">Date: ________________</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-neutral-300 pt-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white text-white-on-red text-[10px] font-bold rounded-[8px] flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors active:scale-95 touch-manipulation"
                >
                  <Printer size={14} /> PRINT PACKING SLIP
                </button>
                <button
                  type="button"
                  onClick={() => setPackingSlipOrder(null)}
                  className="px-4 py-2 min-h-[42px] bg-neutral-200 hover:bg-neutral-300 text-neutral-900 text-[10px] font-bold rounded-[8px] cursor-pointer active:scale-95 touch-manipulation"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: OFFICIAL THERMAL SALES RECEIPT MODAL                              */}
      {/* ========================================================================= */}
      {completedTx && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white text-neutral-900 w-full max-w-sm rounded-[10px] p-4 sm:p-6 font-mono shadow-2xl flex flex-col justify-between space-y-4 my-auto max-h-[92dvh] overflow-y-auto">
              <div id="printable-receipt">
                <div className="text-center border-b border-neutral-300 pb-3 mb-3">
                  <h2 className="text-sm font-black tracking-widest text-[#EF2F38]">INFINITY TAEKWONDO ACADEMY</h2>
                  <p className="text-[9px] text-neutral-700 uppercase font-bold">PRO-SHOP OFFICIAL SALES RECEIPT</p>
                  <p className="text-[9px] text-neutral-500 mt-1">TX #: {completedTx.txId} // {completedTx.date}</p>
                </div>

                <div className="text-[10px] space-y-1 mb-3 text-neutral-800">
                  <p><strong>Customer:</strong> {completedTx.studentName}</p>
                  <p><strong>Payment Method:</strong> {completedTx.method}</p>
                </div>

                {/* Items List */}
                <div className="border-t border-b border-neutral-300 py-2 space-y-1 text-[10px] text-neutral-900">
                  {completedTx.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.qty}x {item.name}</span>
                      <span>${(item.qty * item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="pt-2 text-[10px] space-y-1">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal:</span>
                    <span>${completedTx.subtotal.toFixed(2)}</span>
                  </div>
                  {completedTx.discount > 0 && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>Discount:</span>
                      <span>-${completedTx.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-neutral-400 text-neutral-900">
                    <span>TOTAL PAID:</span>
                    <div className="text-right">
                      <div>${completedTx.total.toFixed(2)}</div>
                      <div className="text-[9px] font-normal text-neutral-600 font-mono">≈ {formatKHR(completedTx.total)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-neutral-300 pt-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white text-white-on-red text-[10px] font-bold rounded-[8px] flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors active:scale-95 touch-manipulation"
                >
                  <Printer size={14} /> PRINT RECEIPT
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedTx(null)}
                  className="px-4 py-2 min-h-[42px] bg-neutral-200 hover:bg-neutral-300 text-neutral-900 text-[10px] font-bold rounded-[8px] cursor-pointer active:scale-95 touch-manipulation"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD NEW PRODUCT MODAL (VARIANT MATRIX BUILDER)                     */}
      {/* ========================================================================= */}
      {isAddItemOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form
              onSubmit={handleAddNewItem}
              className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] w-full max-w-2xl sm:max-w-3xl rounded-[10px] p-4 sm:p-6 font-mono space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-[#EF2F38]" />
                  <h3 className="text-xs font-bold tracking-wider text-[#EF2F38]">// ADD NEW INVENTORY ITEM</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Basic Product Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                      PRODUCT / UNIFORM NAME <span className="text-[#EF2F38]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Infinity TKD Grandmaster Uniform"
                      value={newItem.name}
                      onChange={e => handleNewItemNameChange(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">CATEGORY</label>
                    <select
                      value={newItem.category}
                      onChange={e => handleNewItemCategoryChange(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                    >
                      {dynamicCategories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400">
                        BASE SKU CODE <span className="text-[#EF2F38]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateNewItemSku}
                        className="text-[10px] font-mono font-bold text-[#EF2F38] hover:underline flex items-center gap-1 cursor-pointer py-0.5 active:scale-95 touch-manipulation"
                        title="Auto-detect item and generate unique barcode-compatible SKU"
                      >
                        <Barcode size={13} /> Auto Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ITKD-UNI-01"
                      value={newItem.sku}
                      onChange={e => {
                        setIsNewItemSkuManual(true);
                        setNewItem({ ...newItem, sku: e.target.value.toUpperCase().replace(/\s+/g, '-') });
                      }}
                      className={cn(
                        "w-full bg-neutral-50 dark:bg-[#0F0F0F] border rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none font-mono text-xs",
                        newItemSkuConflict
                          ? "border-rose-500 focus:border-rose-500"
                          : newItem.sku
                          ? "border-emerald-500/60 focus:border-emerald-500"
                          : "border-neutral-300 dark:border-[#262626] focus:border-[#EF2F38]"
                      )}
                    />
                    {newItem.sku && (
                      <div className="mt-1 text-[9px] font-mono flex items-center gap-1">
                        {newItemSkuConflict ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                            <Warning size={10} weight="fill" /> Duplicate: Used by "{newItemSkuConflict.name}"
                          </span>
                        ) : !newItemSkuFormatValid.isValid ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Warning size={10} /> {newItemSkuFormatValid.error}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle size={10} weight="fill" /> Unique Base SKU
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variation Toggle Card */}
                <div className="p-3 sm:p-3.5 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Tag size={15} className="text-[#EF2F38]" /> Multi-Size & Collar Matrix Variations
                    </span>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Enable for uniforms, sparring gear, or apparel with sizes (100–200, S–XL) & collar styles (White, Poom, Dan)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hasNewItemVariants;
                      setHasNewItemVariants(next);
                      if (next && variantSizes.length === 0 && variantStyles.length === 0) {
                        applyUniformQuickTemplate();
                      }
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none touch-manipulation",
                      hasNewItemVariants ? "bg-[#EF2F38]" : "bg-neutral-300 dark:bg-neutral-700"
                    )}
                    role="switch"
                    aria-checked={hasNewItemVariants}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        hasNewItemVariants ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Non-Variant Single Item Form */}
                {!hasNewItemVariants && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">PRICE ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={newItem.price}
                          onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">STOCK QTY</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={newItem.stock}
                          onChange={e => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                          className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">MIN THRESHOLD</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newItem.minStockThreshold}
                          onChange={e => setNewItem({ ...newItem, minStockThreshold: parseInt(e.target.value) || 5 })}
                          className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">SIZE / VARIATION (OPTIONAL)</label>
                      <input
                        type="text"
                        placeholder="e.g. One Size / Free Size"
                        value={newItem.size}
                        onChange={e => handleNewItemSizeChange(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                      />
                    </div>
                  </div>
                )}

                {/* Variant Matrix Builder Form */}
                {hasNewItemVariants && (
                  <div className="space-y-4 pt-1">
                    {/* Defaults Bar & Quick Templates */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                            BASE PRICE ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={newItem.price}
                            onChange={e => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                            MIN THRESHOLD
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={newItem.minStockThreshold}
                            onChange={e => setNewItem({ ...newItem, minStockThreshold: parseInt(e.target.value) || 5 })}
                            className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                            TOTAL MATRIX STOCK
                          </label>
                          <div className="w-full min-h-[40px] flex items-center px-3 bg-neutral-100 dark:bg-[#181818] border border-neutral-300 dark:border-[#262626] rounded-[8px] font-bold text-neutral-900 dark:text-white">
                            {totalMatrixStock} units ({matrixVariants.length} items)
                          </div>
                        </div>
                      </div>

                      {/* Quick 1-Click Templates */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-neutral-500">1-Click Presets:</span>
                        <button
                          type="button"
                          onClick={applyUniformQuickTemplate}
                          className="text-[10px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-[6px] border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                        >
                          <Sparkle size={12} className="text-[#EF2F38]" /> TKD Uniform (Poom, Dan, White • 110-180)
                        </button>
                        <button
                          type="button"
                          onClick={applySparringGearQuickTemplate}
                          className="text-[10px] px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-[6px] border border-neutral-300 dark:border-neutral-700 flex items-center gap-1 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                        >
                          <Sparkle size={12} className="text-blue-500" /> Sparring Gear (Red, Blue • S-XL)
                        </button>
                      </div>
                    </div>

                    {/* Step 1: Collar Styles / Colors */}
                    <div className="p-3 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300">
                          1. Collar Styles / Colors (Optional)
                        </span>
                        {variantStyles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setVariantStyles([]);
                              setMatrixVariants(prev => regenerateMatrix([], variantSizes, newItem.name, newItem.category, prev));
                            }}
                            className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                          >
                            Clear Styles
                          </button>
                        )}
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {[...UNIFORM_COLLAR_PRESETS, ...SPARRING_COLOR_PRESETS].map(style => {
                          const isSelected = variantStyles.includes(style);
                          return (
                            <button
                              key={style}
                              type="button"
                              onClick={() => toggleStyle(style)}
                              className={cn(
                                "px-2.5 py-1 rounded-[6px] text-[10px] font-bold border transition-colors cursor-pointer active:scale-95 touch-manipulation",
                                isSelected
                                  ? "bg-[#EF2F38] text-white border-[#EF2F38]"
                                  : "bg-white dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-[#262626] hover:border-neutral-400"
                              )}
                            >
                              {isSelected ? `✓ ${style}` : `+ ${style}`}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Style Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Or type custom collar/color (e.g. Master Gold Collar)..."
                          value={customStyleInput}
                          onChange={e => setCustomStyleInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomStyle();
                            }
                          }}
                          className="flex-1 bg-white dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                        <button
                          type="button"
                          onClick={addCustomStyle}
                          disabled={!customStyleInput.trim()}
                          className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 rounded-[6px] text-xs font-bold disabled:opacity-40 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          Add Style
                        </button>
                      </div>

                      {/* Active Style Chips */}
                      {variantStyles.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-200 dark:border-[#262626]">
                          {variantStyles.map(st => (
                            <span
                              key={st}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-800 dark:text-neutral-200"
                            >
                              {st}
                              <button
                                type="button"
                                onClick={() => removeStyle(st)}
                                className="hover:text-rose-500 cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 2: Sizes */}
                    <div className="p-3 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300">
                          2. Sizes (Multi-Select)
                        </span>
                        {variantSizes.length > 0 && (
                          <button
                            type="button"
                            onClick={clearAllSizes}
                            className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                          >
                            Clear Sizes
                          </button>
                        )}
                      </div>

                      {/* Size Batch Buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => addSizePreset(TKD_KIDS_SIZES)}
                          className="px-2 py-1 bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-[#262626] rounded-[6px] text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          + TKD Kids (100–150)
                        </button>
                        <button
                          type="button"
                          onClick={() => addSizePreset(TKD_ADULT_SIZES)}
                          className="px-2 py-1 bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-[#262626] rounded-[6px] text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          + TKD Adult (160–200)
                        </button>
                        <button
                          type="button"
                          onClick={() => addSizePreset(APPAREL_SIZES)}
                          className="px-2 py-1 bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-[#262626] rounded-[6px] text-[10px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          + Apparel (XS–XXL)
                        </button>
                      </div>

                      {/* Quick Individual Size Pills */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[...TKD_KIDS_SIZES, ...TKD_ADULT_SIZES].map(sz => {
                          const isSelected = variantSizes.includes(sz);
                          return (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => toggleSize(sz)}
                              className={cn(
                                "w-9 h-7 rounded-[4px] text-[10px] font-bold border transition-colors flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation",
                                isSelected
                                  ? "bg-[#EF2F38] text-white border-[#EF2F38]"
                                  : "bg-white dark:bg-[#141414] text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-[#262626]"
                              )}
                            >
                              {sz}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Size Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Or type custom size (e.g. Size 0, Free, 210)..."
                          value={customSizeInput}
                          onChange={e => setCustomSizeInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomSize();
                            }
                          }}
                          className="flex-1 bg-white dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[6px] px-2.5 py-1.5 text-xs text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                        />
                        <button
                          type="button"
                          onClick={addCustomSize}
                          disabled={!customSizeInput.trim()}
                          className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-800 dark:text-neutral-200 rounded-[6px] text-xs font-bold disabled:opacity-40 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          Add Size
                        </button>
                      </div>

                      {/* Active Size Chips */}
                      {variantSizes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-200 dark:border-[#262626]">
                          {variantSizes.map(sz => (
                            <span
                              key={sz}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-800 dark:text-neutral-200"
                            >
                              {sz}
                              <button
                                type="button"
                                onClick={() => removeSize(sz)}
                                className="hover:text-rose-500 cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Step 3: Matrix Combinations Table & Stock Batch Setting */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-[#262626] pb-2">
                        <span className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                          <span>3. Matrix Combinations</span>
                          <span className="px-2 py-0.5 bg-[#EF2F38]/10 text-[#EF2F38] rounded-full text-[10px] font-bold">
                            {matrixVariants.length} Combinations
                          </span>
                        </span>

                        {matrixVariants.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500">Batch Stock:</span>
                            <input
                              type="number"
                              min="0"
                              value={batchStockValue}
                              onChange={e => setBatchStockValue(parseInt(e.target.value) || 0)}
                              className="w-16 bg-white dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded px-2 py-1 text-xs text-neutral-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => applyBatchStockToAll(batchStockValue)}
                              className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 text-neutral-900 dark:text-white text-[10px] font-bold rounded cursor-pointer active:scale-95 touch-manipulation"
                            >
                              Apply to All
                            </button>
                          </div>
                        )}
                      </div>

                      {matrixVariants.length === 0 ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-[8px] text-amber-700 dark:text-amber-300 text-center text-xs">
                          Select collar styles or sizes above to generate variation combinations.
                        </div>
                      ) : (
                        <div className="border border-neutral-200 dark:border-[#262626] rounded-[8px] overflow-hidden max-h-[260px] overflow-y-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-neutral-100 dark:bg-[#181818] sticky top-0 text-[10px] text-neutral-500 uppercase border-b border-neutral-200 dark:border-[#262626]">
                              <tr>
                                <th className="px-3 py-2">Collar / Style</th>
                                <th className="px-3 py-2">Size</th>
                                <th className="px-3 py-2">SKU</th>
                                <th className="px-3 py-2 w-20">Stock</th>
                                <th className="px-3 py-2 w-24">Price ($)</th>
                                <th className="px-2 py-2 text-center w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-[#262626] bg-white dark:bg-[#101010]">
                              {matrixVariants.map((v, idx) => (
                                <tr key={`${v.color}_${v.size}_${idx}`} className="hover:bg-neutral-50 dark:hover:bg-[#151515]">
                                  <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-200">
                                    {v.color || <span className="text-neutral-400 italic">Default</span>}
                                  </td>
                                  <td className="px-3 py-2 font-bold text-neutral-900 dark:text-white">
                                    {v.size || <span className="text-neutral-400 italic">Free</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={v.sku}
                                      onChange={e => updateMatrixVariant(idx, { sku: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                                      className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded px-2 py-1 text-[10px] font-mono text-neutral-900 dark:text-[#E4E4E4]"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      value={v.stock}
                                      onChange={e => updateMatrixVariant(idx, { stock: Math.max(0, parseInt(e.target.value) || 0) })}
                                      className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded px-2 py-1 text-[11px] font-bold text-neutral-900 dark:text-[#E4E4E4]"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder={`$${newItem.price.toFixed(2)}`}
                                      value={v.price_override ?? ''}
                                      onChange={e => {
                                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                        updateMatrixVariant(idx, { price_override: isNaN(val as number) ? null : val });
                                      }}
                                      className="w-full bg-neutral-50 dark:bg-[#0A0A0A] border border-neutral-200 dark:border-[#262626] rounded px-2 py-1 text-[11px] text-neutral-900 dark:text-[#E4E4E4]"
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeMatrixVariant(idx)}
                                      className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer"
                                      title="Remove this variation"
                                    >
                                      <Trash size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors font-bold active:scale-95 touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !newItem.name.trim() ||
                    !newItem.sku.trim() ||
                    Boolean(newItemSkuConflict) ||
                    !newItemSkuFormatValid.isValid ||
                    (hasNewItemVariants && matrixVariants.length === 0)
                  }
                  className="px-5 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-50 transition-colors active:scale-95 touch-manipulation flex items-center gap-2"
                >
                  <Plus size={14} weight="bold" />
                  <span>
                    {hasNewItemVariants
                      ? `Create Product (${matrixVariants.length} Variations)`
                      : 'Add Single Item'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADJUST STOCK / BULK RESTOCK MODAL                                 */}
      {/* ========================================================================= */}
      {adjustingProduct && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form
              onSubmit={handleAdjustStock}
              className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-[10px] max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl font-mono text-neutral-900 dark:text-[#E4E4E4] my-auto max-h-[92dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    ADJUST INVENTORY STOCK
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-[260px]">{adjustingProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustingProduct(null);
                    setAdjustingVariant(null);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {adjustingProduct.hasVariants && adjustingProduct.variants && adjustingProduct.variants.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                      SELECT SPECIFIC VARIATION / SIZE
                    </label>
                    <select
                      value={adjustingVariant?.id || ''}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const found = adjustingProduct.variants?.find(v => v.id === vId) || null;
                        setAdjustingVariant(found);
                      }}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                    >
                      <option value="">-- Product Base (Aggregate) --</option>
                      {adjustingProduct.variants.map((v) => (
                        <option key={v.id || v.sku} value={v.id || ''}>
                          {[v.color, v.size ? `Size: ${v.size}` : '', `(${v.stock} in stock)`, v.sku].filter(Boolean).join(' • ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {adjustingVariant ? `Variant Stock (${[adjustingVariant.color, adjustingVariant.size].filter(Boolean).join(' - ')}):` : 'Current Product Stock:'}
                  </span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    {adjustingVariant ? adjustingVariant.stock : adjustingProduct.stock} units
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">REASON FOR ADJUSTMENT</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value as any)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                  >
                    <option value="RESTOCK">Restock (Adding incoming shipment)</option>
                    <option value="DAMAGE_WRITE_OFF">Damage / Defect Write-off (Deduct stock)</option>
                    <option value="AUDIT_ADJUSTMENT">Physical Audit Correction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">
                    QUANTITY ({adjustReason === 'DAMAGE_WRITE_OFF' ? 'TO DEDUCT' : 'TO ADD'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">NOTES (OPTIONAL)</label>
                  <input
                    type="text"
                    placeholder="e.g. Supplier Batch #49 Shipment"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustingProduct(null);
                    setAdjustingVariant(null);
                  }}
                  className="px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors font-bold active:scale-95 touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjustSubmitting}
                  className="px-5 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-50 transition-colors active:scale-95 touch-manipulation"
                >
                  {isAdjustSubmitting ? 'Updating...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: EDIT INVENTORY ITEM MODAL                                        */}
      {/* ========================================================================= */}
      {isEditItemOpen && editingProduct && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form onSubmit={handleEditProduct} className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] w-full max-w-md rounded-[10px] p-4 sm:p-5 font-mono space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                <div>
                  <h3 className="text-xs font-bold tracking-wider text-[#EF2F38]">// EDIT INVENTORY ITEM</h3>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate max-w-[260px]">{editingProduct.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditItemOpen(false);
                    setEditingProduct(null);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">PRODUCT NAME</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400">SKU CODE</label>
                      <button
                        type="button"
                        onClick={handleGenerateEditItemSku}
                        className="text-[10px] font-mono font-bold text-[#EF2F38] hover:underline flex items-center gap-1 cursor-pointer py-0.5 active:scale-95 touch-manipulation"
                        title="Auto-generate standardized unique SKU"
                      >
                        <Barcode size={13} /> Auto Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={editFormData.sku}
                      onChange={e => setEditFormData({ ...editFormData, sku: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                      className={cn(
                        "w-full bg-neutral-50 dark:bg-[#0F0F0F] border rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none font-mono text-xs",
                        editItemSkuConflict
                          ? "border-rose-500 focus:border-rose-500"
                          : editFormData.sku
                          ? "border-emerald-500/60 focus:border-emerald-500"
                          : "border-neutral-300 dark:border-[#262626] focus:border-[#EF2F38]"
                      )}
                    />
                    {editFormData.sku && (
                      <div className="mt-1 text-[9px] font-mono flex items-center gap-1">
                        {editItemSkuConflict ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                            <Warning size={10} weight="fill" /> Duplicate: Used by "{editItemSkuConflict.name}"
                          </span>
                        ) : !editItemSkuFormatValid.isValid ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Warning size={10} /> {editItemSkuFormatValid.error}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle size={10} weight="fill" /> Unique • 1D/2D Hardware Ready
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">CATEGORY</label>
                    <select
                      value={editFormData.category}
                      onChange={e => setEditFormData({ ...editFormData, category: e.target.value as any })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38] cursor-pointer"
                    >
                      {dynamicCategories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">PRICE ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editFormData.price}
                      onChange={e => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">STOCK QTY</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editFormData.stock}
                      onChange={e => setEditFormData({ ...editFormData, stock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1 truncate">THRESHOLD</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editFormData.minStockThreshold}
                      onChange={e => setEditFormData({ ...editFormData, minStockThreshold: parseInt(e.target.value) || 5 })}
                      className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-2.5 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400 mb-1">SIZE / VARIATION (OPTIONAL)</label>
                  <input
                    type="text"
                    placeholder="e.g. Size 3 (160cm) or Medium"
                    value={editFormData.size}
                    onChange={e => setEditFormData({ ...editFormData, size: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] rounded-[8px] px-3 py-2 min-h-[40px] text-neutral-900 dark:text-[#E4E4E4] focus:outline-none focus:border-[#EF2F38]"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteProduct(editingProduct.id, editingProduct.name);
                  }}
                  className="px-3 py-2 min-h-[42px] bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs rounded-[8px] cursor-pointer transition-colors font-bold flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
                  title="Delete this product from catalog"
                >
                  <Trash size={14} />
                  <span>Delete Product</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditItemOpen(false);
                      setEditingProduct(null);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors font-bold active:scale-95 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEditSubmitting || !editFormData.name.trim() || !editFormData.sku.trim() || Boolean(editItemSkuConflict) || !editItemSkuFormatValid.isValid}
                    className="flex-1 sm:flex-initial px-5 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-50 transition-colors active:scale-95 touch-manipulation"
                  >
                    {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Portal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: QUICK VARIANT SELECTOR MODAL (POS TERMINAL)                      */}
      {/* ========================================================================= */}
      {selectedVariantModalProduct && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {(() => {
              const product = selectedVariantModalProduct;
              const variants = product.variants || [];
              const distinctColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
              const distinctSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];

              // Find active selected variant
              const activeVariant = variants.find(v => {
                const colorMatch = distinctColors.length === 0 || v.color === modalSelectedColor;
                const sizeMatch = distinctSizes.length === 0 || v.size === modalSelectedSize;
                return colorMatch && sizeMatch;
              }) || variants.find(v => distinctColors.length === 0 || v.color === modalSelectedColor) || variants[0];

              const unitPrice = activeVariant?.price_override ?? product.price;
              const inStock = activeVariant?.stock ?? 0;
              const inCart = activeVariant
                ? ((activeVariant.id ? cartQuantities['var_' + activeVariant.id] : 0) ||
                   (activeVariant.sku ? cartQuantities['sku_' + activeVariant.sku] : 0) || 0)
                : 0;
              const maxAddable = Math.max(0, inStock - inCart);

              return (
                <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] text-neutral-900 dark:text-[#E4E4E4] w-full max-w-lg rounded-[10px] p-4 sm:p-5 font-mono space-y-4 shadow-2xl my-auto max-h-[92dvh] overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#262626] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#EF2F38]/10 text-[#EF2F38]">
                          {product.category}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {variants.length} variations
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">
                        {product.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedVariantModalProduct(null)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[8px] text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:scale-90 touch-manipulation transition-colors"
                      aria-label="Close modal"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Collar Style / Color Selector */}
                  {distinctColors.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400">
                        1. COLLAR STYLE / COLOR
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {distinctColors.map(c => {
                          const isSelected = modalSelectedColor === c;
                          const totalStockForColor = variants
                            .filter(v => v.color === c)
                            .reduce((sum, v) => sum + v.stock, 0);

                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setModalSelectedColor(c);
                                // If the current size doesn't exist for this new color, choose the first available size
                                const hasCurrentSize = variants.some(v => v.color === c && v.size === modalSelectedSize);
                                if (!hasCurrentSize) {
                                  const firstForColor = variants.find(v => v.color === c && v.stock > 0) || variants.find(v => v.color === c);
                                  if (firstForColor?.size) {
                                    setModalSelectedSize(firstForColor.size);
                                  }
                                }
                              }}
                              className={cn(
                                "px-3 py-2 rounded-[8px] text-xs font-bold border transition-all cursor-pointer active:scale-95 touch-manipulation flex items-center gap-1.5",
                                isSelected
                                  ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm"
                                  : "bg-neutral-50 dark:bg-[#181818] text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-[#262626] hover:border-neutral-400"
                              )}
                            >
                              {isSelected && <Check size={13} weight="bold" />}
                              <span>{c}</span>
                              <span
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded-full font-mono",
                                  isSelected ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-[#262626] text-neutral-500"
                                )}
                              >
                                {totalStockForColor} left
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Size Selector */}
                  {distinctSizes.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase text-neutral-600 dark:text-neutral-400">
                        2. SELECT SIZE
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {distinctSizes.map(sz => {
                          const isSelected = modalSelectedSize === sz;
                          const matchingVar = variants.find(
                            v => (distinctColors.length === 0 || v.color === modalSelectedColor) && v.size === sz
                          );
                          const stockForVariant = matchingVar ? matchingVar.stock : 0;
                          const isOutOfStock = stockForVariant <= 0;

                          return (
                            <button
                              key={sz}
                              type="button"
                              disabled={!matchingVar || isOutOfStock}
                              onClick={() => {
                                setModalSelectedSize(sz);
                                setModalQuantity(1);
                              }}
                              className={cn(
                                "p-2.5 rounded-[8px] border text-center transition-all cursor-pointer active:scale-95 touch-manipulation flex flex-col items-center justify-center min-h-[52px]",
                                isSelected
                                  ? "bg-[#EF2F38] text-white border-[#EF2F38] shadow-sm ring-2 ring-[#EF2F38]/20"
                                  : isOutOfStock
                                  ? "opacity-35 bg-neutral-100 dark:bg-[#141414] border-neutral-200 dark:border-neutral-800 text-neutral-400 cursor-not-allowed line-through"
                                  : "bg-neutral-50 dark:bg-[#181818] text-neutral-900 dark:text-white border-neutral-300 dark:border-[#262626] hover:border-[#EF2F38]"
                              )}
                            >
                              <span className="font-bold text-xs">{sz}</span>
                              <span
                                className={cn(
                                  "text-[9px] mt-0.5",
                                  isSelected ? "text-white/80" : isOutOfStock ? "text-rose-500" : "text-neutral-500 dark:text-neutral-400"
                                )}
                              >
                                {isOutOfStock ? 'Out of stock' : `${stockForVariant} available`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Summary Card for Selected Variant */}
                  <div className="p-3 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-mono block">Selected Variant SKU</span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {activeVariant?.sku || product.sku}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-neutral-500 uppercase font-mono block">Unit Price</span>
                        <span className="font-bold text-base text-[#EF2F38]">${unitPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200 dark:border-[#262626] text-[11px]">
                      <span className="text-neutral-600 dark:text-neutral-400">Inventory Status:</span>
                      <span
                        className={cn(
                          "font-bold",
                          inStock <= 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {inStock > 0 ? `${inStock} units in stock` : 'Out of Stock'}
                        {inCart > 0 && ` (${inCart} currently in cart)`}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-[#262626] rounded-[8px]">
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Quantity to Add:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={modalQuantity <= 1}
                        onClick={() => setModalQuantity(prev => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded-[6px] bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer active:scale-90 touch-manipulation"
                      >
                        <Minus size={13} weight="bold" />
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-neutral-900 dark:text-white font-mono">
                        {modalQuantity}
                      </span>
                      <button
                        type="button"
                        disabled={modalQuantity >= maxAddable || maxAddable <= 0}
                        onClick={() => setModalQuantity(prev => Math.min(maxAddable, prev + 1))}
                        className="w-8 h-8 rounded-[6px] bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer active:scale-90 touch-manipulation"
                      >
                        <Plus size={13} weight="bold" />
                      </button>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-[#262626]">
                    <button
                      type="button"
                      onClick={() => setSelectedVariantModalProduct(null)}
                      className="px-4 py-2 min-h-[42px] bg-neutral-100 dark:bg-[#0F0F0F] border border-neutral-300 dark:border-[#262626] text-neutral-700 dark:text-[#888] text-xs rounded-[8px] hover:text-neutral-900 dark:hover:text-white cursor-pointer font-bold active:scale-95 touch-manipulation"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!activeVariant || inStock <= 0 || maxAddable <= 0}
                      onClick={() => {
                        if (!activeVariant) return;
                        addToCart(product, activeVariant, modalQuantity);
                        setSelectedVariantModalProduct(null);
                        showNotification(
                          `Added ${modalQuantity}x ${product.name} (${[activeVariant.color, activeVariant.size].filter(Boolean).join(' - ')}) to cart!`,
                          'success'
                        );
                      }}
                      className="px-5 py-2 min-h-[42px] bg-[#EF2F38] hover:bg-[#d6242c] text-white text-xs font-bold rounded-[8px] shadow-sm cursor-pointer disabled:opacity-40 transition-colors active:scale-95 touch-manipulation flex items-center gap-1.5"
                    >
                      <ShoppingCart size={15} weight="bold" />
                      <span>
                        Add to Cart • ${(unitPrice * modalQuantity).toFixed(2)}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </Portal>
      )}

      {/* Embedded Print Isolation Style */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-packing-slip, #printable-packing-slip * {
            visibility: visible;
          }
          #printable-receipt, #printable-packing-slip {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}} />

    </div>
  );
}
