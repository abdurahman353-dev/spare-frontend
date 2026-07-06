type ApiId = string | number | null | undefined;

export const API_ENDPOINTS = {
  admins: {
    base: "/admins",
    logs: "/admins/logs",
    byId: (id: ApiId) => `/admins/${id}`,
    toggleStatus: (id: ApiId) => `/admins/${id}/toggle-status`,
  },
  auth: {
    changePassword: "/change-password",
    forgotPassword: "/forgot-password",
    login: "/login",
    logout: "/logout",
    logoutAll: "/logout-all",
    register: "/register",
    resetPassword: "/reset-password",
    user: "/user",
  },
  brands: {
    base: "/brands",
    byId: (id: ApiId) => `/brands/${id}`,
  },
  categories: {
    base: "/categories",
    byId: (id: ApiId) => `/categories/${id}`,
  },
  contact: {
    inquiry: "/contact-inquiry",
  },
  customers: {
    base: "/customers",
    byId: (id: ApiId) => `/customers/${id}`,
    toggleStatus: (id: ApiId) => `/customers/${id}/toggle-status`,
  },
  dashboard: {
    base: "/dashboard",
  },
  delivery: {
    notifications: "/delivery/notifications",
    orders: "/delivery/orders",
    stats: "/delivery/stats",
    assignDriver: (orderId: ApiId) => `/delivery/orders/${orderId}/assign-driver`,
    deliver: (orderId: ApiId) => `/delivery/orders/${orderId}/deliver`,
    markArrived: (orderId: ApiId) => `/delivery/orders/${orderId}/mark-arrived`,
  },
  inventory: {
    base: "/inventory",
    byId: (id: ApiId) => `/inventory/${id}`,
    replenish: "/inventory/replenish",
    transfer: "/inventory/transfer",
  },
  locations: {
    countries: "/locations/countries",
    country: (countryId: ApiId) => `/locations/countries/${countryId}`,
    countryCitiesBulk: (countryId: ApiId) => `/locations/countries/${countryId}/cities/bulk`,
    city: (cityId: ApiId) => `/locations/cities/${cityId}`,
    unique: "/locations/unique",
  },
  notifications: {
    base: "/notifications",
  },
  orders: {
    base: "/orders",
    bulkStatus: "/orders/bulk-status",
    byId: (id: ApiId) => `/orders/${id}`,
    approveCancel: (id: ApiId) => `/orders/${id}/approve-cancel`,
    completeRefund: (id: ApiId) => `/orders/${id}/complete-refund`,
    requestCancel: (id: ApiId) => `/orders/${id}/request-cancel`,
    verifyMpesaCode: (id: ApiId) => `/orders/${id}/verify-mpesa-code`,
    voidRefund: (id: ApiId) => `/orders/${id}/void-refund`,
  },
  payments: {
    checkout: "/checkout",
    mpesaCheckout: "/mpesa/checkout",
    mpesaQuery: "/mpesa/query",
  },
  products: {
    base: "/products",
    bulkOffers: "/products/bulk-offers",
    byId: (id: ApiId) => `/products/${id}`,
  },
  profile: {
    user: "/user/profile",
  },
  reports: {
    ordersAll: "/orders",
    inventoryAll: "/inventory",
    customersAll: "/customers",
    warehouses: "/warehouses",
  },
  returns: {
    base: "/returns",
    allPages: "/returns?per_page=-1",
    mine: "/returns/my-returns",
    submit: "/returns/submit",
    approve: (id: ApiId) => `/returns/${id}/approve`,
    reject: (id: ApiId) => `/returns/${id}/reject`,
  },
  settings: {
    base: "/settings",
    public: "/settings/public",
  },
  shipments: {
    base: "/shipments",
    byId: (id: ApiId) => `/shipments/${id}`,
    unassignedOrders: "/shipments/unassigned-orders",
  },
  shippingDestinations: {
    base: "/shipping-destinations",
    active: "/shipping-destinations/active",
    byId: (id: ApiId) => `/shipping-destinations/${id}`,
  },
  suppliers: {
    base: "/suppliers",
    byId: (id: ApiId) => `/suppliers/${id}`,
  },
  userOrders: {
    mine: "/my-orders",
  },
  warehouses: {
    base: "/warehouses",
    byId: (id: ApiId) => `/warehouses/${id}`,
  },
} as const;
