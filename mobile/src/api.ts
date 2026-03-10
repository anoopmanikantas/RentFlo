const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8085/api";

export class ApiError extends Error {}

export type AuthUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "landlord" | "tenant";
  tenant_code: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type LandlordDashboard = {
  summary: {
    building_count: number;
    unit_count: number;
    tenant_count: number;
    monthly_due: string;
    monthly_collected: string;
    monthly_outstanding: string;
  };
  bank_accounts: Array<{ id: number; bank_name: string; account_name: string; account_number: string; ifsc: string }>;
  buildings: Array<{ id: number; name: string; address: string }>;
  units: Array<{ id: number; building: number; building_name: string; label: string; monthly_rent: string }>;
  tenants: Array<{
    id: number;
    tenant_name: string;
    tenant_email: string;
    tenant_phone: string;
    tenant_code: string;
    building_name: string;
    unit_label: string;
    monthly_rent: string;
    paid_this_month: string;
    balance: string;
    status: string;
    start_date: string;
  }>;
  payments: Array<{
    id: number;
    tenant_name: string;
    building_name: string;
    unit_label: string;
    rent_month: string;
    paid_on: string;
    bank_name: string;
    account_number: string;
    amount: string;
    reference: string;
    status: string;
    provider_payment_id: string;
  }>;
  current_month: string;
};

export type TenantDashboard = {
  tenancy: {
    id: number;
    tenant_name: string;
    tenant_email: string;
    tenant_phone: string;
    building_name: string;
    unit_label: string;
    monthly_rent: string;
    paid_this_month: string;
    balance: string;
    status: string;
    start_date: string;
  } | null;
  bank_accounts: Array<{ id: number; bank_name: string; account_name: string; account_number: string; ifsc: string }>;
  payments: LandlordDashboard["payments"];
  current_month: string;
  current_month_paid: string;
  current_month_balance: string;
};

export type InitiatePaymentInput = {
  bank_account_id: number;
  rent_month: string;
  amount: string;
};

export type InitiatedPayment = {
  order_id: string;
  mode: "mock" | "live";
  provider: "razorpay";
  razorpay_order_id: string;
  sdk_payload: Record<string, unknown>;
};

export type ConfirmPaymentInput = {
  order_id: string;
  status: "succeeded" | "failed";
  provider_payment_id?: string;
  razorpay_signature?: string;
  provider_payload?: Record<string, unknown>;
};

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.detail || body.error || "Request failed.");
  }
  return body as T;
}

export function login(username: string, password: string) {
  return request<AuthResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export type SignupInput = {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: "landlord" | "tenant";
};

export function signup(data: SignupInput) {
  return request<AuthResponse>("/auth/signup/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function googleLogin(idToken: string) {
  return request<AuthResponse & { is_new: boolean }>("/auth/google/", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export function fetchLandlordDashboard(token: string) {
  return request<LandlordDashboard>("/landlord/dashboard/", undefined, token);
}

export function fetchTenantDashboard(token: string) {
  return request<TenantDashboard>("/tenant/dashboard/", undefined, token);
}

export function initiateTenantPayment(token: string, payload: InitiatePaymentInput) {
  return request<InitiatedPayment>(
    "/tenant/payments/initiate/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function confirmTenantPayment(token: string, payload: ConfirmPaymentInput) {
  return request<{ detail: string }>(
    "/tenant/payments/confirm/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateRole(token: string, role: "landlord" | "tenant") {
  return request<AuthUser>("/auth/me/", { method: "PATCH", body: JSON.stringify({ role }) }, token);
}

export function createBuilding(token: string, data: { name: string; address: string }) {
  return request<{ id: number; name: string; address: string }>(
    "/landlord/buildings/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
}

export function createUnit(token: string, data: { building_id: number; label: string; monthly_rent: string }) {
  return request<{ id: number; building: number; building_name: string; label: string; monthly_rent: string }>(
    "/landlord/units/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
}

export function createBankAccount(
  token: string,
  data: { bank_name: string; account_name: string; account_number: string; ifsc?: string },
) {
  return request<{ id: number; bank_name: string; account_name: string; account_number: string; ifsc: string }>(
    "/landlord/bank-accounts/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
}

export function createTenancy(token: string, data: { tenant_identifier: string; unit_id: number }) {
  return request<Record<string, unknown>>(
    "/landlord/tenancies/",
    { method: "POST", body: JSON.stringify(data) },
    token,
  );
}
export function endTenancy(token: string, tenancyId: number) {
  return request<{ detail: string }>(
    `/landlord/tenancies/${tenancyId}/end/`,
    { method: "POST" },
    token,
  );
}

// ---------------------------------------------------------------------------
// Subscription & Billing types
// ---------------------------------------------------------------------------

export type SubscriptionInfo = {
  tier: "free" | "pro" | "business";
  max_units: number;
  max_tenants: number;
  units_used: number;
  tenants_used: number;
  valid_until: string | null;
  is_active: boolean;
  has_analytics: boolean;
  has_reports: boolean;
  add_ons: Array<{ feature: string; is_active: boolean }>;
};

export type Plan = {
  tier: string;
  name: string;
  price_monthly: number;
  max_units: number;
  max_tenants: number;
  features: string[];
};

export type AddOnCatalogItem = {
  feature: string;
  name: string;
  price_monthly: number;
  is_active: boolean;
  included_in_tier: boolean;
};

export type SubscriptionResponse = {
  subscription: SubscriptionInfo;
  plans: Plan[];
  addons_catalog: AddOnCatalogItem[];
};

export type AnalyticsData = {
  revenue_trend: Array<{ month: string; collected: string }>;
  occupancy_rate: number;
  total_units: number;
  occupied_units: number;
  collection_rate: number;
  monthly_due: string;
  monthly_collected: string;
  top_tenants: Array<{ name: string; total_paid: string }>;
  current_month: string;
};

export function fetchSubscription(token: string) {
  return request<SubscriptionResponse>("/landlord/subscription/", undefined, token);
}

export function upgradeSubscription(token: string, tier: "pro" | "business") {
  return request<{
    target_tier: string;
    price_monthly: number;
    mode: string;
    provider: string;
    order_id: string;
    razorpay_order_id: string;
    sdk_payload: Record<string, unknown>;
  }>("/landlord/subscription/upgrade/", { method: "POST", body: JSON.stringify({ tier }) }, token);
}

export function confirmUpgrade(token: string, tier: string, razorpaySubscriptionId?: string) {
  return request<{ detail: string; tier: string; max_units: number; max_tenants: number }>(
    "/landlord/subscription/confirm/",
    { method: "POST", body: JSON.stringify({ tier, razorpay_subscription_id: razorpaySubscriptionId || "" }) },
    token,
  );
}

export function activateAddOn(token: string, feature: string) {
  return request<{
    feature: string;
    price_monthly: number;
    mode: string;
    provider: string;
    order_id: string;
    razorpay_order_id: string;
    sdk_payload: Record<string, unknown>;
  }>("/landlord/addons/activate/", { method: "POST", body: JSON.stringify({ feature }) }, token);
}

export function confirmAddOn(token: string, feature: string, razorpaySubscriptionId?: string) {
  return request<{ detail: string; feature: string; is_active: boolean }>(
    "/landlord/addons/confirm/",
    { method: "POST", body: JSON.stringify({ feature, razorpay_subscription_id: razorpaySubscriptionId || "" }) },
    token,
  );
}

export function fetchAnalytics(token: string) {
  return request<AnalyticsData>("/landlord/analytics/", undefined, token);
}

export function exportPayments(token: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("format", "json");
  return request<Array<Record<string, unknown>>>(`/landlord/reports/export/?${params.toString()}`, undefined, token);
}

// Premium analytics endpoints
export function fetchDelinquencyAnalytics(token: string) {
  return request<{
    total_delinquent: number;
    delinquent_count: number;
    overdue_30_days: Array<{ tenant: string; unit: string; days_overdue: number; amount: number }>;
    overdue_60_days: Array<{ tenant: string; unit: string; days_overdue: number; amount: number }>;
    overdue_90_days: Array<{ tenant: string; unit: string; days_overdue: number; amount: number }>;
    collection_effectiveness: number;
  }>("/landlord/analytics/delinquency/", undefined, token);
}

export function fetchCashFlowForecast(token: string) {
  return request<{
    forecast: Array<{
      month: string;
      expected_collection: number;
      confidence: number;
    }>;
  }>("/landlord/analytics/cash-flow/", undefined, token);
}

export function fetchPropertyROI(token: string) {
  return request<{
    properties: Array<{
      property: string;
      total_collected: number;
      maintenance_cost: number;
      net_income: number;
      occupancy_rate: number;
      units: number;
    }>;
  }>("/landlord/analytics/roi/", undefined, token);
}

export function fetchTenantRiskScoring(token: string) {
  return request<{
    tenants: Array<{
      tenant: string;
      unit: string;
      payment_reliability: number;
      on_time_payments: number;
      late_payments: number;
      risk_level: "low" | "medium" | "high";
    }>;
  }>("/landlord/analytics/tenant-risk/", undefined, token);
}

export function fetchMaintenanceIntelligence(token: string) {
  return request<{
    preventative_spending: number;
    preventative_count: number;
    reactive_spending: number;
    reactive_count: number;
    total_maintenance: number;
    preventative_percentage: number;
    top_costs: Array<{ description: string; total: number }>;
  }>("/landlord/analytics/maintenance/", undefined, token);
}

export function fetchTaxComplianceReport(token: string) {
  return request<{
    gross_income: number;
    expenses: Record<string, number>;
    total_expenses: number;
    net_profit: number;
    profit_margin: number;
  }>("/landlord/analytics/tax-report/", undefined, token);
}