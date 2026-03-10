const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {}

export type AuthUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "landlord" | "tenant";
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
  };
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
  payment_id: number;
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
  return request<AuthResponse>("/auth/google/", {
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
