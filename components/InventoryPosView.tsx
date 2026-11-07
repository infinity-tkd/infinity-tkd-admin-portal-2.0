'use client';
import { productVariantPayloads } from '@/lib/pos-product';
import { inventoryAdjustmentQuantity, stockAlertThreshold, inventoryRetailValue, sellableProductStock, inventoryStockStatus } from '@/lib/pos-catalog';
import { newProductForm, type ProductFormData } from './pos/ProductCatalogFields';
import { OrderDecisionDialog } from './pos/OrderDecisionDialog';
import type { OrderAdvanceStatus, OrderDecisionKind } from './pos/StudentOrderCard';
import type { OrderQueueFilter } from './pos/StudentOrdersPanel';
import dynamic from 'next/dynamic';
import { ManualBankPaymentDialog } from './pos/ManualBankPaymentDialog';
import { PackingSlipDialog } from './pos/PackingSlipDialog';
import { SaleReceiptDialog } from './pos/SaleReceiptDialog';
import { posCartTotals, posCartItemKey, addPosCartItem, changePosCartQuantity, POS_MAX_ORDER_NOTES } from '@/lib/pos-cart';

import { toCsv } from '@/lib/csv';
import { fetchApiRows } from '@/lib/data-access';
import { createReadRecovery } from '@/lib/read-recovery';
import { isCollectedSale, collectionTimestamp, saleWithinPeriod } from '@/lib/pos-reporting';
import { academyDate } from '@/lib/dates';
import { useNotificationTarget } from '@/hooks/use-notification-target';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';

import { supabase } from '@/lib/supabase';
import { PageHeader, SegmentedTabs } from './ui/PageHeader';
import { buttonClass } from './ui/styles';

import { generateUniqueSku, validateSkuFormat } from '@/lib/sku-generator';


import { Plus } from '@phosphor-icons/react/dist/csr/Plus';







import { Tag } from '@phosphor-icons/react/dist/csr/Tag';
import { Package } from '@phosphor-icons/react/dist/csr/Package';





import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
import { Storefront } from '@phosphor-icons/react/dist/csr/Storefront';

import { FileArrowDown } from '@phosphor-icons/react/dist/csr/FileArrowDown';















import type { ProductVariantItem, ProductItem, CartItem, PosSaleTransaction, StudentOrderRecord } from '@/lib/pos-types';
export type { ProductVariantItem, ProductItem, CartItem, PosSaleTransaction, StudentOrderRecord } from '@/lib/pos-types';
const STORAGE_CATALOG_KEY = 'infinity_pos_catalog_v2';
const STORAGE_SALES_KEY = 'infinity_pos_sales_v2';

const INITIAL_CATALOG: ProductItem[] = [];

const DEFAULT_CATEGORIES = ['All', 'Uniforms', 'Sparring Gear', 'Belts', 'Kicking Pads', 'Apparel'] as const;

// Taekwondo & Dojang Variation Presets








const InventoryCatalogPanel = dynamic(() => import('@/components/pos/InventoryCatalogPanel').then(module => module.InventoryCatalogPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StudentOrdersPanel = dynamic(() => import('@/components/pos/StudentOrdersPanel').then(module => module.StudentOrdersPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const SalesHistoryPanel = dynamic(() => import('@/components/pos/SalesHistoryPanel').then(module => module.SalesHistoryPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const ProductCreateDialog = dynamic(() => import('@/components/pos/ProductCreateDialog').then(module => module.ProductCreateDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const ProductEditDialog = dynamic(() => import('@/components/pos/ProductEditDialog').then(module => module.ProductEditDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const StockAdjustmentDialog = dynamic(() => import('@/components/pos/StockAdjustmentDialog').then(module => module.StockAdjustmentDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

const CounterTerminalPanel = dynamic(() => import('@/components/pos/CounterTerminalPanel').then(module => module.CounterTerminalPanel), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });
const ProductVariantDialog = dynamic(() => import('@/components/pos/ProductVariantDialog').then(module => module.ProductVariantDialog), { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-neutral-500">Loading…</p> });

export function InventoryPosView() {
  const { state, showNotification, showConfirm, can } = useAppStore();


  const pendingCheckout = React.useRef<{signature:string;key:string}|null>(null);
  const canCreateOrder = can('action:pos_create_order');
  const canCancelOrder = can('action:pos_cancel_order');
  const canManageInventory = can('action:pos_manage_inventory');
  const isPosReadOnly = !canCreateOrder && !canManageInventory && !canCancelOrder;

  // Navigation: 4 Core Tabs
  const [activeMainTab, setActiveMainTab] = useState<'terminal' | 'orders' | 'inventory' | 'history'>('terminal');

  // Core Data State: Pure Live Supabase Database
  const [catalog, setCatalog] = useState<ProductItem[]>(INITIAL_CATALOG);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [salesHistory, setSalesHistory] = useState<PosSaleTransaction[]>([]);
  const [studentOrders, setStudentOrders] = useState<StudentOrderRecord[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const checkoutInFlight = useRef(false);
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({});
  const clearDataError = useCallback((dataset: string) => setDataErrors(previous => {
    if (!previous[dataset]) return previous;
    const next = { ...previous }; delete next[dataset]; return next;
  }), []);

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
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const productCreateInFlight = React.useRef(false);
  const productEditInFlight = React.useRef(false);
  const stockAdjustmentInFlight = React.useRef(false);
  const pendingStockAdjustment = useRef<{ signature: string; key: string } | null>(null);
  const orderMutations = useRef(new Set<string>());
  const [busyOrderIds, setBusyOrderIds] = useState<Set<string>>(new Set());
  const [orderDecision, setOrderDecision] = useState<{ order: StudentOrderRecord; kind: OrderDecisionKind } | null>(null);
  const [orderActionError, setOrderActionError] = useState('');
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
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
  const [editFormData, setEditFormData] = useState<ProductFormData>(newProductForm);

  // Student Orders Queue Filter & Search
  const [ordersFilter, setOrdersFilter] = useState<OrderQueueFilter>('ALL');
  const [ordersSearch, setOrdersSearch] = useState<string>('');
  useNotificationTarget(url=>{if(url.searchParams.get('orders')==='open'){setActiveMainTab('orders');setOrdersFilter('PENDING');}});

  // Inventory Table Filter & Search
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryCategory, setInventoryCategory] = useState<string>('All');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'HEALTHY'>('ALL');
  const [inventoryVisibility, setInventoryVisibility] = useState<'ALL' | 'STUDENT' | 'COUNTER' | 'INACTIVE'>('ALL');

  // Sales Records Filter
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [salesMethodFilter, setSalesMethodFilter] = useState<'All' | 'ABA Bank KHQR' | 'Cash'>('All');
  const [salesPeriodFilter, setSalesPeriodFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Add Item Form State
  const [newItem, setNewItem] = useState<ProductFormData>(newProductForm);
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
  const [batchStockValue, setBatchStockValue] = useState<number>(0);

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
    if (!editingProduct || productEditInFlight.current) return;
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
            stock: Number.isInteger(batchStockValue) && batchStockValue >= 0 ? batchStockValue : 0,
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
    if (!canManageInventory) return;
    setIsNewItemSkuManual(false);
    setNewItem(newProductForm());
    setHasNewItemVariants(false);
    setVariantStyles([]);
    setCustomStyleInput('');
    setVariantSizes([]);
    setCustomSizeInput('');
    setMatrixVariants([]);
    setBatchStockValue(0);
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
      if (!token) throw new Error('Session unavailable');

      const json = {success:true,data:await fetchApiRows('/api/admin/pos/orders?channel=STUDENT_PORTAL', token)};
      if (json.success && Array.isArray(json.data)) {
        setStudentOrders(json.data);
        clearDataError('orders');
      }
    } catch (err) {
      console.error('Failed to fetch student orders:', err);
      setDataErrors(previous => ({ ...previous, orders: 'Incoming orders could not be refreshed.' }));
    } finally {
      setIsOrdersLoading(false);
    }
  }, [clearDataError]);

  // Fetch live product catalog from database
  const fetchCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Session unavailable');
      }

      const res = await fetch('/api/admin/pos/products?include_inactive=true', {
        headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: 'no-store'
      });
      const json = await res.json();
      if (!res.ok || json.success !== true || !Array.isArray(json.data)) throw new Error('Catalog unavailable');
      if (json.success && Array.isArray(json.data)) {
        const mapped: ProductItem[] = json.data.map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category_name || p.categories?.name || 'General',
          price: Number(p.price_usd),
          cost: Number(p.cost_usd ?? 0),
          imageUrl: p.image_url || '',
          description: p.description || '',
          isActive: p.is_active === true,
          allowStudentOrders: p.allow_student_orders === true,
          updatedAt: p.updated_at,
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
            is_active: v.is_active === true
          })) : []
        }));
        setCatalog(mapped);
        clearDataError('catalog');
        return mapped;
      }
    } catch (err) {
      console.error('Failed to fetch products from Supabase:', err);
      setDataErrors(previous => ({ ...previous, catalog: 'Product prices and stock could not be refreshed.' }));
    } finally {
      setIsCatalogLoading(false);
    }
  }, [clearDataError]);

  // Fetch live historical sales transactions from database
  const fetchSalesHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session unavailable');

      const json = {success:true,data:await fetchApiRows('/api/admin/pos/orders', token)};
      if (json.success && Array.isArray(json.data)) {
        const mappedSales: PosSaleTransaction[] = json.data
          .filter((o: any) => ['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(o.payment_status) || o.order_status === 'COMPLETED' || o.order_channel === 'ADMIN_POS')
          .map((o: any) => {
            const recordedAt = collectionTimestamp(o);
            const studentObj = o.students;
            let custName = o.customer_name || 'Walk-in Customer';
            if (studentObj?.english_name) {
              custName = `${studentObj.english_name}${studentObj.current_belt ? ` (${studentObj.current_belt})` : ''}`;
            }
            return {
              txId: o.order_number || o.id,
              paymentStatus: o.payment_status,
              orderStatus: o.order_status,
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
              date: recordedAt === null ? 'Collection date needs review' : new Date(recordedAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' }),
              timestamp: recordedAt ?? undefined
            };
          }).sort((a: PosSaleTransaction, b: PosSaleTransaction) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || a.txId.localeCompare(b.txId));

        {
          setSalesHistory(mappedSales);
          clearDataError('sales');
          try {
          } catch (e) {
            console.error('Failed to save POS sales history:', e);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch sales history from database:', err);
      setDataErrors(previous => ({ ...previous, sales: 'Sales history could not be refreshed. Totals may be incomplete.' }));
    }
  }, [clearDataError]);

  // Reconcile complete order/catalog reads after bursts and missed events.
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_CATALOG_KEY);
      localStorage.removeItem(STORAGE_SALES_KEY);
    } catch { /* Disabled browser storage must not break POS initialization. */ }
    let active = true;
    let reconnecting = false;
    const refresh = async () => { await Promise.all([fetchStudentOrders(), fetchCatalog(), fetchSalesHistory()]); };
    const recovery = createReadRecovery(refresh,
      () => active && navigator.onLine !== false && document.visibilityState !== 'hidden');
    recovery.request();
    const channel = supabase.channel('admin-pos-realtime-channel');
    for (const table of ['pos_orders', 'products', 'product_variants', 'product_categories']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, recovery.request);
    }
    channel.subscribe(status => {
      if (!active) return;
      if (status === 'SUBSCRIBED') {
        if (reconnecting) recovery.request();
        reconnecting = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reconnecting = true;
      }
    });
    const visible = () => {
      if (document.visibilityState !== 'hidden') recovery.request();
    };
    const interval = setInterval(recovery.request, 60000);
    window.addEventListener('online', recovery.request);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; recovery.dispose(); clearInterval(interval);
      window.removeEventListener('online', recovery.request);
      document.removeEventListener('visibilitychange', visible);
      void supabase.removeChannel(channel).catch(() => {});
    };
  }, [fetchStudentOrders, fetchCatalog, fetchSalesHistory]);

  const saveCatalogToStorage = (newCatalog: ProductItem[]) => {
    setCatalog(newCatalog);
    try {
    } catch (e) {
      console.error('Failed to save POS catalog:', e);
    }
  };

  const saveSalesToStorage = (newSales: PosSaleTransaction[]) => {
    setSalesHistory(newSales);
    try {
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
  const terminalCatalog = useMemo(() => catalog.filter(product => product.isActive !== false).map(product => ({
    ...product, stock: sellableProductStock(product), variants: product.variants?.filter(variant => variant.is_active !== false),
  })), [catalog]);
  const filteredProducts = useMemo(() => {
    const list = terminalCatalog.filter(p => {
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
      const matchLowStock = !onlyLowStock || inventoryStockStatus(p) !== 'HEALTHY';
      return p.isActive !== false && matchCat && matchSearch && matchLowStock;
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
  }, [terminalCatalog, selectedCategory, searchQuery, onlyLowStock, sortOption]);

  const getCartItemKey = posCartItemKey;

  const addToCart = (product: ProductItem, variant?: ProductVariantItem, quantityToAdd = 1) => {
    if(checkoutInFlight.current || product.isActive === false || variant?.is_active === false)return;
    if (product.hasVariants && product.variants && product.variants.length > 0 && !variant) {
      setSelectedVariantModalProduct(product);
      const firstWithStock = product.variants.find(item => item.is_active !== false && item.stock > 0) || product.variants.find(item => item.is_active !== false);
      setModalSelectedColor(firstWithStock?.color || '');
      setModalSelectedSize(firstWithStock?.size || '');
      setModalQuantity(1);
      return;
    }
    const change = addPosCartItem(cart, product, variant, quantityToAdd);
    if (change.ok) setCart(change.cart);
    else showNotification(change.message, 'warning');
  };

  const updateQuantity = (key: string, delta: number) => {
    if(checkoutInFlight.current)return;
    const change = changePosCartQuantity(cart, key, delta);
    if (change.ok) setCart(change.cart);
    else showNotification(change.message, 'warning');
  };

  const removeFromCart = (cartItemKey: string) => {
    if(checkoutInFlight.current)return;
    setCart(prev => prev.filter(item => getCartItemKey(item) !== cartItemKey));
  };

  const clearCart = () => {
    if(checkoutInFlight.current)return;
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
  const totals=useMemo(()=>posCartTotals(cart,discountPercent),[cart,discountPercent]);
  const { subtotal, discountPercent:clampedDiscount, discount:discountAmount, total:grandTotal }=totals;

  const tenderedAmountNumber = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedAmountNumber - grandTotal);
  const isCashInsufficient = paymentMethod === 'Cash' && tenderedAmountNumber > 0 && tenderedAmountNumber < grandTotal;

  // Dual-Currency (USD + Cambodian Riel KHR at standard 4,100 KHR / $1 USD)




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
    const counts: Record<string, number> = { All: terminalCatalog.length };
    for (const cat of dynamicCategories) {
      if (cat !== 'All') {
        counts[cat] = terminalCatalog.filter(p => p.category === cat).length;
      }
    }
    return counts;
  }, [terminalCatalog, dynamicCategories]);

  // Parked / Held Cart Operations
  const parkCurrentCart = () => {
    if(checkoutInFlight.current)return;
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
    if(checkoutInFlight.current)return;
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
    if(checkoutInFlight.current)return;
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

  const parkedGrandTotal = useMemo(()=>parkedCart?posCartTotals(parkedCart.cart,parkedCart.discountPercent).total:0,[parkedCart]);

  // Open Edit Product Modal
  const openEditProductModal = (product: ProductItem) => {
    if (!canManageInventory) return;
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      cost: product.cost ?? 0,
      imageUrl: product.imageUrl ?? '',
      description: product.description ?? '',
      isActive: product.isActive !== false,
      allowStudentOrders: product.allowStudentOrders !== false,
      variantMetadata: (product.variants || []).map(variant => ({ ...variant })),
      stock: product.stock,
      minStockThreshold: product.minStockThreshold,
      size: product.size || '',
    });
    setIsEditItemOpen(true);
  };

  // Edit Product Submit
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInventory) return;
    if (!editingProduct || productEditInFlight.current) return;
    if (editingProduct.hasVariants && editFormData.variantMetadata.some(variant => !variant.id)) {
      showNotification('Variant identities could not be verified. Refresh the catalog before editing this product.', 'warning');
      return;
    }
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
    productEditInFlight.current = true;
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
          expectedUpdatedAt: editingProduct.updatedAt,
          sku: editFormData.sku.toUpperCase().trim(),
          name: editFormData.name.trim(),
          categoryName: editFormData.category,
          priceUsd: Math.max(0, Number(editFormData.price) || 0),
          costUsd: editFormData.cost,
          description: editFormData.description.trim(),
          imageUrl: editFormData.imageUrl.trim(),
          isActive: editFormData.isActive,
          allowStudentOrders: editFormData.allowStudentOrders,
          ...(editingProduct.hasVariants && editFormData.variantMetadata.length > 0 ? { variants: editFormData.variantMetadata.map(variant => ({ id: variant.id, sku: variant.sku, size: variant.size || null, color: variant.color || null, priceOverride: variant.price_override ?? null, minStockThreshold: variant.min_stock_threshold ?? 3, isActive: variant.is_active !== false })) } : {}),
          minStockThreshold: stockAlertThreshold(editFormData.minStockThreshold),
          ...(!editingProduct.hasVariants ? { sizes: editFormData.size.trim() ? [editFormData.size.trim()] : [] } : {})
        }),
        signal: AbortSignal.timeout(20000),
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
      productEditInFlight.current = false;
      setIsEditSubmitting(false);
    }
  };

  // Finalize Sale
  const executeCompleteSale = async (bankReference?:string) => {
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setIsCheckoutPending(true);
    try {
    if (dataErrors.catalog || isCatalogLoading) {
      showNotification('Refresh product prices and stock before completing this sale.', 'warning');
      return;
    }
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

    if(paymentMethod!=='Cash'&&(!bankReference||bankReference.trim().length<3)){showNotification('Enter the verified bank reference before recording a bank payment.','warning');return;}
    const verifiedNotes=[orderNotes.trim(),bankReference?'Verified bank reference: '+bankReference.trim():''].filter(Boolean).join(' · ');
    if(verifiedNotes.length>POS_MAX_ORDER_NOTES){showNotification('Shorten the order notes so the verified payment reference fits in the 500-character record.','warning');return;}
    const studentObj = selectedStudent;
    const studentName = studentObj
      ? `${studentObj.englishName} (${studentObj.currentBelt})`
      : 'Walk-in Customer / Guest';

    let txId = `POS-${Date.now().toString().slice(-6)}`;

    let savedTotals: any;
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

      const signature = JSON.stringify({items:mappedItems, studentId:selectedStudentId, discount:clampedDiscount, paymentMethod, notes:orderNotes,bankReference});
      if (pendingCheckout.current?.signature !== signature) pendingCheckout.current = {signature,key:crypto.randomUUID()};
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
          adminNotes: verifiedNotes || undefined,
          requestKey: pendingCheckout.current.key,
          items: mappedItems
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error?.code === 'POS_QUOTE_CHANGED') {
          setIsKhqrModalOpen(false);
          const fresh = await fetchCatalog();
          if (fresh) setCart(previous => previous.map(item => {
            const product = fresh.find(row => row.id === item.product.id);
            if (!product) return item;
            const variant = item.variant ? product.variants?.find(row => row.id === item.variant?.id || row.sku === item.variant?.sku) : undefined;
            if (item.variant && !variant) return item;
            return { ...item, product, variant };
          }));
          pendingCheckout.current = null;
          showNotification(fresh
            ? 'Prices changed; this sale was not recorded. Review the refreshed cart and confirm the received amount again.'
            : 'Prices changed; this sale was not recorded. Retry the catalog refresh before checking out again.', 'warning');
          return;
        }
        throw new Error(json.error?.message || 'Transaction failed to record on server');
      }

      savedTotals = json.data;
      pendingCheckout.current = null;
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
    const recordedAt = collectionTimestamp(savedTotals);
    const newTx: PosSaleTransaction = {
      paymentStatus: savedTotals.payment_status,
      orderStatus: savedTotals.order_status,
      txId,
      studentName,
      items: savedTotals.items.map((i:any) => ({name:i.product_name,qty:i.quantity,price:Number(i.unit_price_usd)})),
      subtotal: Number(savedTotals.subtotal_usd),
      discount: Number(savedTotals.discount_usd),
      total: Number(savedTotals.total_usd),
      method: paymentMethod,
      date: recordedAt === null ? 'Collection date needs review' : new Date(recordedAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' }),
      timestamp: recordedAt ?? undefined
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
    } finally {
      checkoutInFlight.current = false;
      setIsCheckoutPending(false);
    }
  };

  // Add Item to Inventory
  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInventory || productCreateInFlight.current) return;
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

    productCreateInFlight.current = true;
    setIsAddSubmitting(true);
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
        costUsd: newItem.cost,
        description: newItem.description.trim(),
        imageUrl: newItem.imageUrl.trim(),
        isActive: newItem.isActive,
        allowStudentOrders: newItem.allowStudentOrders,
        stock: finalStock,
        minStockThreshold: stockAlertThreshold(newItem.minStockThreshold),
        sizes: finalSizes
      };

      if (hasNewItemVariants) {
        payload.hasVariants = true;
        payload.variants = productVariantPayloads(matrixVariants);
      }

      const res = await fetch('/api/admin/pos/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
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
      setNewItem(newProductForm());
      setHasNewItemVariants(false);
      setVariantStyles([]);
      setVariantSizes([]);
      setMatrixVariants([]);
      await fetchCatalog();
    } catch (err: any) {
      console.error('Failed to create product:', err);
      showNotification(err.message || 'Error creating product.', 'error');
    } finally { productCreateInFlight.current = false; setIsAddSubmitting(false); }
  };

  // Adjust Stock Action
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInventory) return;
    if (!adjustingProduct || stockAdjustmentInFlight.current) return;
    if (adjustingProduct.hasVariants && !adjustingVariant?.id) {
      showNotification('Choose the size or style whose stock is changing.', 'warning');
      return;
    }
    stockAdjustmentInFlight.current = true;
    setIsAdjustSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showNotification('Unauthorized: Please log in.', 'error');
        return;
      }

      const delta = inventoryAdjustmentQuantity(adjustReason, adjustQty);
      const stockPayload = {
        action: 'ADJUST_STOCK', productId: adjustingProduct.id, variantId: adjustingVariant?.id || undefined,
        changeQty: delta, reason: adjustReason, notes: adjustNotes.trim() || `Stock adjusted via Admin Portal (${adjustReason})`,
      };
      const signature = JSON.stringify(stockPayload);
      if (!pendingStockAdjustment.current || pendingStockAdjustment.current.signature !== signature) pendingStockAdjustment.current = { signature, key: crypto.randomUUID() };
      const res = await fetch('/api/admin/pos/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...stockPayload, requestKey: pendingStockAdjustment.current.key }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Stock adjustment failed on server');
      }

      showNotification(json.data?.replayed ? 'Previously recorded adjustment confirmed. The inventory is being refreshed.' : 'Stock adjustment recorded. The inventory is being refreshed.', 'success');
      pendingStockAdjustment.current = null;
      setAdjustingProduct(null);
      setAdjustingVariant(null);
      setAdjustQty(5);
      setAdjustNotes('');
      await fetchCatalog();
    } catch (err: any) {
      console.error('Stock adjustment failed:', err);
      showNotification(err.message || 'Error adjusting stock.', 'error');
    } finally {
      stockAdjustmentInFlight.current = false;
      setIsAdjustSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = (productId: string, productName: string) => {
    if (!canManageInventory) return;
    showConfirm(
      `Archive "${productName}"? It will stop selling at the counter and in the student shop. Stock and order history will be kept.`,
      async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error('Your session expired. Sign in again before removing a product.');
          {
            const res = await fetch('/api/admin/pos/products', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                action: 'DELETE_PRODUCT',
                productId
              }),
              signal: AbortSignal.timeout(20000),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              throw new Error(json.error?.message || 'Failed to remove product from database');
            }
          }
          saveCatalogToStorage(catalog.map(product => product.id === productId ? { ...product, isActive: false, allowStudentOrders: false } : product));
          await fetchCatalog();
          if (editingProduct?.id === productId) {
            setIsEditItemOpen(false);
            setEditingProduct(null);
          }
          showNotification(`Product "${productName}" archived. Reopen it from the inactive catalog to restore it.`, 'info');
        } catch (e: any) {
          console.error('Product removal failed:', e);
          showNotification(e.message || 'Failed to remove product.', 'error');
        }
      },
      'Archive Product'
    );
  };

  const beginOrderMutation = (orderId: string) => {
    if (orderMutations.current.has(orderId)) return false;
    orderMutations.current.add(orderId);
    setBusyOrderIds(new Set(orderMutations.current));
    return true;
  };
  const finishOrderMutation = (orderId: string) => {
    orderMutations.current.delete(orderId);
    setBusyOrderIds(new Set(orderMutations.current));
  };

  const handleUpdateOrderStatus = async (order: StudentOrderRecord, newStatus: OrderAdvanceStatus, paymentStatus?: 'PAID', paymentReference?: string): Promise<boolean> => {
    if (!canCreateOrder || !beginOrderMutation(order.id)) return false;
    setOrderActionError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in again before updating this order.');
      const response = await fetch('/api/admin/pos/orders', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ orderId: order.id, newOrderStatus: newStatus, paymentStatus, paymentReference, expectedUpdatedAt: order.updated_at }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        if (response.status === 409) setOrderDecision(null);
        throw new Error(result.error?.message || 'This order update was not confirmed. Refresh before trying again.');
      }
      await Promise.all([fetchStudentOrders(), fetchCatalog(), fetchSalesHistory()]);
      setOrderFeedback({ type: 'success', message: `${order.order_number}: ${paymentStatus === 'PAID' ? 'Verified payment recorded.' : 'Fulfillment updated.'}` });
      return true;
    } catch (error) {
      await fetchStudentOrders();
      const message = error instanceof Error && !['AbortError', 'TimeoutError'].includes(error.name) ? error.message : 'The order update could not be confirmed. Review the refreshed order before retrying.';
      setOrderActionError(message);
      setOrderFeedback({ type: 'error', message });
      return false;
    } finally { finishOrderMutation(order.id); }
  };

  const handleCancelStudentOrder = async (order: StudentOrderRecord, reason: string): Promise<boolean> => {
    if (!canCancelOrder || !beginOrderMutation(order.id)) return false;
    setOrderActionError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in again before cancelling this order.');
      const response = await fetch('/api/admin/pos/orders/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ orderId: order.id, reason }), signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error?.message || 'Cancellation was not confirmed.');
      await Promise.all([fetchStudentOrders(), fetchCatalog(), fetchSalesHistory()]);
      setOrderFeedback({ type: 'info', message: `${order.order_number}: ${order.payment_status === 'PAID' ? 'Cancelled and stock restored. Record the verified refund separately.' : 'Cancelled and reserved stock restored.'}` });
      return true;
    } catch (error) {
      await fetchStudentOrders();
      const message = error instanceof Error && !['AbortError', 'TimeoutError'].includes(error.name) ? error.message : 'Cancellation could not be confirmed. Review the refreshed order before retrying.';
      setOrderActionError(message);
      setOrderFeedback({ type: 'error', message });
      return false;
    } finally { finishOrderMutation(order.id); }
  };

  const submitOrderDecision = async (value: string) => {
    if (!orderDecision) return;
    const { order, kind } = orderDecision;
    const next = kind === 'cancel' ? await handleCancelStudentOrder(order, value)
      : kind === 'handover' ? await handleUpdateOrderStatus(order, 'COMPLETED')
      : ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.order_status)
        ? await handleUpdateOrderStatus(order, order.order_status as OrderAdvanceStatus, 'PAID', value) : false;
    if (next) setOrderDecision(null);
  };

  const handleVoidSale = async (txId:string) => {
    if(!can('action:pos_cancel_order'))return;
    const reference=window.prompt('First complete the actual cash/bank refund. Enter its verified reference to record it:');
    if(!reference?.trim())return;
    const reason=window.prompt('Reason for the reviewed return/refund:');
    if(!reason?.trim())return;
    const restock=window.confirm('Have the physical items been returned and checked as sellable? Choose OK to restock them, Cancel to leave inventory unchanged.');
    try{
      const { data:{session} }=await supabase.auth.getSession();if(!session)throw new Error('Please sign in again.');
      const found=await fetch('/api/admin/pos/orders?search='+encodeURIComponent(txId),{headers:{Authorization:'Bearer '+session.access_token}});
      const list=await found.json();const order=list.data?.find((o:any)=>o.order_number===txId || o.id===txId);if(!order)throw new Error('Order not found. Refresh the sales history.');
      const response=await fetch('/api/admin/pos/orders/refund',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({orderId:order.id,reference:reference.trim(),reason:reason.trim(),restock})});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.message || 'Refund was not recorded.');
      await Promise.all([fetchCatalog(),fetchStudentOrders(),fetchSalesHistory()]);
      showNotification('Verified refund recorded. The order remains in the audit history.','success');
    }catch(e){showNotification(e instanceof Error ? e.message : 'Refund was not recorded.','error');}
  };

  // CSV Export: Inventory
  const exportInventoryCsv = () => {
    if (catalog.length === 0) {
      showNotification('Inventory catalog is empty.', 'warning');
      return;
    }
    const headers = ['SKU', 'Product Name', 'Category', 'Size / Variation', 'Unit Price ($)', 'Current Stock', 'Min Threshold', 'Retail Stock Value ($)', 'Active', 'Student Shop'];
    const rows = catalog.map(p => [
      p.sku,
      p.name,
      p.category,
      p.size || 'Standard',
      p.price.toFixed(2),
      p.stock,
      p.minStockThreshold,
      inventoryRetailValue(p).toFixed(2),
      p.isActive !== false ? 'Yes' : 'No',
      p.isActive !== false && p.allowStudentOrders !== false ? 'Yes' : 'No',
    ]);

    const csvContent = toCsv(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinity_tkd_inventory_${academyDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Inventory CSV downloaded successfully!', 'success');
  };

  // CSV Export: Sales
  const exportSalesCsv = () => {
    if (salesHistory.length === 0) {
      showNotification('Sales history is empty.', 'warning');
      return;
    }
    const headers = ['Transaction ID', 'Collection Recorded (Academy Time)', 'Customer', 'Items Summary', 'Payment Method', 'Subtotal ($)', 'Discount ($)', 'Grand Total ($)', 'Payment Status', 'Order Status'];
    const rows = filteredSales.map(tx => [
      tx.txId,
      tx.date,
      tx.studentName,
      tx.items.map(it => `${it.qty}x ${it.name}`).join('; '),
      tx.method,
      tx.subtotal.toFixed(2),
      tx.discount.toFixed(2),
      tx.total.toFixed(2), tx.paymentStatus || 'UNKNOWN', tx.orderStatus || 'UNKNOWN'
    ]);

    const csvContent = toCsv(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinity_tkd_sales_${academyDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Sales records CSV downloaded successfully!', 'success');
  };

  // Inventory Table Filtered Items
  const filteredInventory = useMemo(() => {
    return catalog.filter(p => {
      const matchCat = inventoryCategory === 'All' || p.category === inventoryCategory;
      const q = inventorySearch.trim().toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.variants?.some(variant => [variant.sku, variant.size, variant.color].some(value => value?.toLowerCase().includes(q)));
      const matchVisibility = inventoryVisibility === 'ALL'
        || (inventoryVisibility === 'INACTIVE' ? p.isActive === false
          : p.isActive !== false && (inventoryVisibility === 'STUDENT' ? p.allowStudentOrders !== false : p.allowStudentOrders === false));

      let matchStock = true;
      if (inventoryStockFilter === 'LOW') matchStock = inventoryStockStatus(p) === 'LOW';
      else if (inventoryStockFilter === 'OUT') matchStock = inventoryStockStatus(p) === 'OUT';
      else if (inventoryStockFilter === 'HEALTHY') matchStock = inventoryStockStatus(p) === 'HEALTHY';
      if (inventoryStockFilter !== 'ALL' && p.isActive === false) matchStock = false;

      return matchCat && matchSearch && matchStock && matchVisibility;
    });
  }, [catalog, inventoryCategory, inventorySearch, inventoryStockFilter, inventoryVisibility]);

  // Inventory Metrics
  const totalInventoryValuation = useMemo(() => {
    return catalog.reduce((sum, product) => sum + inventoryRetailValue(product), 0);
  }, [catalog]);

  const lowStockCount = useMemo(() => {
    return catalog.filter(p => p.isActive !== false && inventoryStockStatus(p) === 'LOW').length;
  }, [catalog]);

  const outOfStockCount = useMemo(() => {
    return catalog.filter(p => p.isActive !== false && inventoryStockStatus(p) === 'OUT').length;
  }, [catalog]);

  const healthyStockCount = useMemo(() => {
    return catalog.filter(p => p.isActive !== false && inventoryStockStatus(p) === 'HEALTHY').length;
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
      CONFIRMED: studentOrders.filter(o => o.order_status === 'CONFIRMED').length,
      PREPARING: studentOrders.filter(o => o.order_status === 'PREPARING').length,
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
      else if (ordersFilter === 'CONFIRMED') matchStatus = order.order_status === 'CONFIRMED';
      else if (ordersFilter === 'PREPARING') matchStatus = order.order_status === 'PREPARING';
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

    return salesHistory.filter(tx => {
      const matchMethod = salesMethodFilter === 'All' || tx.method === salesMethodFilter;
      const query = salesSearch.trim().toLowerCase();
      const matchSearch = !query ||
        tx.txId.toLowerCase().includes(query) ||
        tx.studentName.toLowerCase().includes(query) ||
        tx.items.some(it => it.name.toLowerCase().includes(query));

      const matchPeriod=saleWithinPeriod(tx,salesPeriodFilter,now);

      return matchMethod && matchSearch && matchPeriod;
    });
  }, [salesHistory, salesMethodFilter, salesSearch, salesPeriodFilter]);

  const collectedSales = useMemo(() => filteredSales.filter(isCollectedSale), [filteredSales]);
  const totalSalesRevenue = useMemo(() => {
    return collectedSales.reduce((sum, tx) => sum + tx.total, 0);
  }, [collectedSales]);

  const totalItemsSold = useMemo(() => {
    return collectedSales.reduce((sum, tx) => sum + tx.items.reduce((s, it) => s + it.qty, 0), 0);
  }, [collectedSales]);

  const averageOrderValue = useMemo(() => {
    if (collectedSales.length === 0) return 0;
    return totalSalesRevenue / collectedSales.length;
  }, [collectedSales, totalSalesRevenue]);

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
    <div inert={isCheckoutPending} aria-busy={isCheckoutPending} className="w-full max-w-[1600px] mx-auto space-y-4 pb-16 text-neutral-900 dark:text-[#E4E4E4] font-sans antialiased">
      {Object.keys(dataErrors).length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Some POS records are unavailable</p>
          {Object.values(dataErrors).map(message => <p key={message} className="mt-1">{message}</p>)}
          <button type="button" disabled={isCatalogLoading || isOrdersLoading}
            onClick={() => { void Promise.all([fetchCatalog(), fetchStudentOrders(), fetchSalesHistory()]); }}
            className="mt-2 min-h-11 rounded-lg border border-amber-500 px-4 py-2 font-semibold disabled:opacity-60">
            Retry POS records
          </button>
        </div>
      )}

      <PageHeader
        icon={<Storefront weight="bold" />}
        eyebrow="Shop management"
        title="Pro-Shop"
        description="Counter sales, student orders and product catalog"
        actions={<>
          {(activeMainTab === 'terminal' || activeMainTab === 'inventory') && (
            <button type="button" onClick={openAddItemModal} className={buttonClass({ variant: 'primary' })} disabled={!canManageInventory}>
              <Plus size={14} weight="bold" />
              ADD ITEM
            </button>
          )}
          {activeMainTab === 'inventory' && (
            <button type="button" onClick={exportInventoryCsv} className={buttonClass()}>
              <FileArrowDown size={14} weight="bold" />
              EXPORT CSV
            </button>
          )}
          {activeMainTab === 'history' && (
            <button type="button" onClick={exportSalesCsv} className={buttonClass()}>
              <FileArrowDown size={14} weight="bold" />
              EXPORT CSV
            </button>
          )}
        </>}
      >
        {isPosReadOnly && (
          <span className="mt-2 inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-700 dark:text-blue-400">
            Read-only access
          </span>
        )}
      </PageHeader>

      <SegmentedTabs label="Shop workspace" stacked value={activeMainTab} onChange={setActiveMainTab} className="grid grid-cols-4 sm:flex" items={[
        { id: 'terminal', ariaLabel: 'TERMINAL', icon: <Storefront weight="bold" />, label: 'TERMINAL' },
        { id: 'orders', ariaLabel: 'STUDENT ORDERS', icon: <Package weight="bold" />, label: <><span className="sm:hidden">Orders</span><span className="hidden sm:inline">Student orders</span></>,
          badge: pendingOrdersCount > 0 ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 rounded-full bg-brand px-1.5 text-[9px] font-bold text-on-brand sm:static">{pendingOrdersCount}</span> : undefined },
        { id: 'inventory', ariaLabel: 'INVENTORY', icon: <Tag weight="bold" />, label: 'INVENTORY',
          badge: lowStockCount > 0 ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 text-[9px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 sm:static">{lowStockCount}</span> : undefined },
        { id: 'history', ariaLabel: 'SALES (' + salesHistory.length + ')', icon: <ClockCounterClockwise weight="bold" />, label: <><span className="sm:hidden">Sales</span><span className="hidden sm:inline">Sales ({salesHistory.length})</span></> },
      ]} />

      {/* ========================================================================= */}
      {/* VIEW 1: POS CHECKOUT TERMINAL                                             */}
      {/* ========================================================================= */}
      {activeMainTab === 'terminal' && <CounterTerminalPanel searchQuery={searchQuery} setSearchQuery={setSearchQuery} setOnlyLowStock={setOnlyLowStock} onlyLowStock={onlyLowStock} sortOption={sortOption} setSortOption={setSortOption} setPosViewMode={setPosViewMode} posViewMode={posViewMode} fetchCatalog={fetchCatalog} isCatalogLoading={isCatalogLoading} dynamicCategories={dynamicCategories} selectedCategory={selectedCategory} categoryCounts={categoryCounts} setSelectedCategory={setSelectedCategory} filteredProducts={filteredProducts} catalog={terminalCatalog} cartQuantities={cartQuantities} canCreateOrder={canCreateOrder} addToCart={addToCart} updateQuantity={updateQuantity} getCartItemKey={getCartItemKey} cart={cart} grandTotal={grandTotal} parkedCart={parkedCart} parkedItemsCount={parkedItemsCount} parkedGrandTotal={parkedGrandTotal} resumeParkedCart={resumeParkedCart} discardParkedCart={discardParkedCart} parkCurrentCart={parkCurrentCart} clearCart={clearCart} studentComboboxRef={studentComboboxRef} selectedStudentId={selectedStudentId} setSelectedStudentId={setSelectedStudentId} setStudentSearchTerm={setStudentSearchTerm} selectedStudent={selectedStudent} getBeltColorClass={getBeltColorClass} state={state} studentSearchTerm={studentSearchTerm} setIsStudentDropdownOpen={setIsStudentDropdownOpen} isStudentDropdownOpen={isStudentDropdownOpen} filteredStudents={filteredStudents} removeFromCart={removeFromCart} setIsNotesExpanded={setIsNotesExpanded} isNotesExpanded={isNotesExpanded} orderNotes={orderNotes} setOrderNotes={setOrderNotes} clampedDiscount={clampedDiscount} discountPercent={discountPercent} setDiscountPercent={setDiscountPercent} subtotal={subtotal} discountAmount={discountAmount} setPaymentMethod={setPaymentMethod} paymentMethod={paymentMethod} cashTendered={cashTendered} setCashTendered={setCashTendered} isCashInsufficient={isCashInsufficient} tenderedAmountNumber={tenderedAmountNumber} changeDue={changeDue} setIsKhqrModalOpen={setIsKhqrModalOpen} executeCompleteSale={executeCompleteSale} dataErrors={dataErrors} isCheckoutPending={isCheckoutPending} />}

      {/* ========================================================================= */}
      {/* VIEW 2: INCOMING STUDENT PORTAL ORDERS QUEUE                              */}
      {/* ========================================================================= */}
      {activeMainTab === 'orders' && <StudentOrdersPanel canCreateOrder={canCreateOrder} canCancelOrder={canCancelOrder} setOrdersFilter={setOrdersFilter} ordersFilter={ordersFilter} orderStatusCounts={orderStatusCounts} ordersSearch={ordersSearch} setOrdersSearch={setOrdersSearch} fetchStudentOrders={fetchStudentOrders} isOrdersLoading={isOrdersLoading} filteredStudentOrders={filteredStudentOrders} studentOrders={studentOrders} setPackingSlipOrder={setPackingSlipOrder} busyOrderIds={busyOrderIds} feedback={orderFeedback} onDismissFeedback={() => setOrderFeedback(null)} onDecision={(order, kind) => { setOrderActionError(''); setOrderDecision({ order, kind }); }} handleUpdateOrderStatus={handleUpdateOrderStatus} />}

      {/* ========================================================================= */}
      {/* VIEW 3: INVENTORY CATALOG & STOCK LEDGER                                   */}
      {/* ========================================================================= */}
      {activeMainTab === 'inventory' && <InventoryCatalogPanel canManageInventory={canManageInventory} catalog={catalog} lowStockCount={lowStockCount} outOfStockCount={outOfStockCount} totalInventoryValuation={totalInventoryValuation} inventoryCategory={inventoryCategory} setInventoryCategory={setInventoryCategory} dynamicCategories={dynamicCategories} setInventoryStockFilter={setInventoryStockFilter} inventoryStockFilter={inventoryStockFilter} inventoryStockCounts={inventoryStockCounts} inventoryVisibility={inventoryVisibility} setInventoryVisibility={setInventoryVisibility} inventorySearch={inventorySearch} setInventorySearch={setInventorySearch} filteredInventory={filteredInventory} expandedProductIds={expandedProductIds} setExpandedProductIds={setExpandedProductIds} openEditProductModal={openEditProductModal} setAdjustingProduct={setAdjustingProduct} setAdjustingVariant={setAdjustingVariant} handleDeleteProduct={handleDeleteProduct} />}

      {/* ========================================================================= */}
      {/* VIEW 4: SALES RECORDS & FINANCIAL AUDIT                                    */}
      {/* ========================================================================= */}
      {activeMainTab === 'history' && <SalesHistoryPanel canCancelOrder={canCancelOrder} onRefresh={fetchSalesHistory} totalSalesRevenue={totalSalesRevenue} collectedSales={collectedSales} totalItemsSold={totalItemsSold} averageOrderValue={averageOrderValue} setSalesPeriodFilter={setSalesPeriodFilter} salesPeriodFilter={salesPeriodFilter} salesMethodFilter={salesMethodFilter} setSalesMethodFilter={setSalesMethodFilter} salesSearch={salesSearch} setSalesSearch={setSalesSearch} salesHistory={salesHistory} filteredSales={filteredSales} setCompletedTx={setCompletedTx} handleVoidSale={handleVoidSale} />}

      {/* ========================================================================= */}
      {/* MODAL 1: INTERACTIVE ABA KHQR CUSTOMER DISPLAY MODAL                       */}
      {/* ========================================================================= */}
      {orderDecision && <OrderDecisionDialog key={orderDecision.order.id + orderDecision.kind} order={orderDecision.order} kind={orderDecision.kind} error={orderActionError} busy={busyOrderIds.has(orderDecision.order.id)} onClose={() => { if (!busyOrderIds.has(orderDecision.order.id)) setOrderDecision(null); }} onSubmit={submitOrderDecision} />}
      {isKhqrModalOpen && <ManualBankPaymentDialog total={grandTotal} customer={selectedStudent?.englishName??'Walk-in customer'} busy={isCheckoutPending||isCatalogLoading||Boolean(dataErrors.catalog)} onClose={()=>setIsKhqrModalOpen(false)} onConfirm={executeCompleteSale}/>}
      {/* ========================================================================= */}
      {/* MODAL 2: STUDENT GEAR BAG PACKING SLIP MODAL                               */}
      {/* ========================================================================= */}
      <PackingSlipDialog packingSlipOrder={packingSlipOrder} onClose={()=>setPackingSlipOrder(null)} />
      {/* ========================================================================= */}
      {/* MODAL 3: OFFICIAL THERMAL SALES RECEIPT MODAL                              */}
      {/* ========================================================================= */}
      <SaleReceiptDialog completedTx={completedTx} onClose={()=>setCompletedTx(null)} />
      {/* ========================================================================= */}
      {/* MODAL 4: ADD NEW PRODUCT MODAL (VARIANT MATRIX BUILDER)                     */}
      {/* ========================================================================= */}
      {isAddItemOpen && <ProductCreateDialog isAddSubmitting={isAddSubmitting} handleAddNewItem={handleAddNewItem} setIsAddItemOpen={setIsAddItemOpen} newItem={newItem} handleNewItemNameChange={handleNewItemNameChange} handleNewItemCategoryChange={handleNewItemCategoryChange} dynamicCategories={dynamicCategories} handleGenerateNewItemSku={handleGenerateNewItemSku} setIsNewItemSkuManual={setIsNewItemSkuManual} setNewItem={setNewItem} newItemSkuConflict={newItemSkuConflict} newItemSkuFormatValid={newItemSkuFormatValid} hasNewItemVariants={hasNewItemVariants} setHasNewItemVariants={setHasNewItemVariants} variantSizes={variantSizes} variantStyles={variantStyles} applyUniformQuickTemplate={applyUniformQuickTemplate} handleNewItemSizeChange={handleNewItemSizeChange} totalMatrixStock={totalMatrixStock} matrixVariants={matrixVariants} applySparringGearQuickTemplate={applySparringGearQuickTemplate} setVariantStyles={setVariantStyles} setMatrixVariants={setMatrixVariants} regenerateMatrix={regenerateMatrix} toggleStyle={toggleStyle} customStyleInput={customStyleInput} setCustomStyleInput={setCustomStyleInput} addCustomStyle={addCustomStyle} removeStyle={removeStyle} clearAllSizes={clearAllSizes} addSizePreset={addSizePreset} toggleSize={toggleSize} customSizeInput={customSizeInput} setCustomSizeInput={setCustomSizeInput} addCustomSize={addCustomSize} removeSize={removeSize} batchStockValue={batchStockValue} setBatchStockValue={setBatchStockValue} applyBatchStockToAll={applyBatchStockToAll} updateMatrixVariant={updateMatrixVariant} removeMatrixVariant={removeMatrixVariant} />}

      {/* ========================================================================= */}
      {/* MODAL 5: ADJUST STOCK / BULK RESTOCK MODAL                                 */}
      {/* ========================================================================= */}
      {adjustingProduct && <StockAdjustmentDialog handleAdjustStock={handleAdjustStock} adjustingProduct={adjustingProduct} setAdjustingProduct={setAdjustingProduct} setAdjustingVariant={setAdjustingVariant} adjustingVariant={adjustingVariant} adjustReason={adjustReason} setAdjustReason={setAdjustReason} adjustQty={adjustQty} setAdjustQty={setAdjustQty} adjustNotes={adjustNotes} setAdjustNotes={setAdjustNotes} isAdjustSubmitting={isAdjustSubmitting} />}

      {/* ========================================================================= */}
      {/* MODAL 6: EDIT INVENTORY ITEM MODAL                                        */}
      {/* ========================================================================= */}
      {isEditItemOpen && editingProduct && <ProductEditDialog handleEditProduct={handleEditProduct} editingProduct={editingProduct} setIsEditItemOpen={setIsEditItemOpen} setEditingProduct={setEditingProduct} editFormData={editFormData} setEditFormData={setEditFormData} handleGenerateEditItemSku={handleGenerateEditItemSku} editItemSkuConflict={editItemSkuConflict} editItemSkuFormatValid={editItemSkuFormatValid} dynamicCategories={dynamicCategories} handleDeleteProduct={handleDeleteProduct} isEditSubmitting={isEditSubmitting} />}

      {/* ========================================================================= */}
      {/* MODAL 7: QUICK VARIANT SELECTOR MODAL (POS TERMINAL)                      */}
      {/* ========================================================================= */}
      {selectedVariantModalProduct && <ProductVariantDialog selectedVariantModalProduct={selectedVariantModalProduct} modalSelectedColor={modalSelectedColor} modalSelectedSize={modalSelectedSize} cartQuantities={cartQuantities} setSelectedVariantModalProduct={setSelectedVariantModalProduct} setModalSelectedColor={setModalSelectedColor} setModalSelectedSize={setModalSelectedSize} setModalQuantity={setModalQuantity} modalQuantity={modalQuantity} canCreateOrder={canCreateOrder} addToCart={addToCart} showNotification={showNotification} />}

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
