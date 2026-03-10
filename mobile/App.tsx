import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { startTransition, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ApiError,
  confirmTenantPayment,
  fetchLandlordDashboard,
  fetchTenantDashboard,
  login,
  type AuthUser,
  type InitiatePaymentInput,
  initiateTenantPayment,
  type LandlordDashboard,
  type TenantDashboard,
} from "./src/api";
import { launchJuspayPayment } from "./src/juspay";

const initialPaymentForm: InitiatePaymentInput = {
  bank_account_id: 0,
  rent_month: "",
  amount: "",
};

export default function App() {
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("owner123");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [landlordData, setLandlordData] = useState<LandlordDashboard | null>(null);
  const [tenantData, setTenantData] = useState<TenantDashboard | null>(null);
  const [paymentForm, setPaymentForm] = useState<InitiatePaymentInput>(initialPaymentForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Use the demo landlord or tenant credentials to sign in.");
  const [isInitialized, setIsInitialized] = useState(false);

  // Load token and user from persistent storage on app startup
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("authToken");
        const storedUser = await AsyncStorage.getItem("authUser");
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          startTransition(() => {
            setToken(storedToken);
            setUser(parsedUser);
          });
        }
      } catch (error) {
        console.error("Failed to load auth from storage:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    void loadStoredAuth();
  }, []);

  // Save token and user to persistent storage whenever they change
  useEffect(() => {
    if (!isInitialized) return;
    
    const saveAuth = async () => {
      try {
        if (token && user) {
          await AsyncStorage.setItem("authToken", token);
          await AsyncStorage.setItem("authUser", JSON.stringify(user));
        } else {
          await AsyncStorage.removeItem("authToken");
          await AsyncStorage.removeItem("authUser");
        }
      } catch (error) {
        console.error("Failed to save auth to storage:", error);
      }
    };
    void saveAuth();
  }, [token, user, isInitialized]);

  // Fetch dashboard data when token or user changes
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    setBusy(true);
    const load = async () => {
      try {
        if (user.role === "landlord") {
          const data = await fetchLandlordDashboard(token);
          startTransition(() => {
            setLandlordData(data);
            setTenantData(null);
          });
        } else {
          const data = await fetchTenantDashboard(token);
          startTransition(() => {
            setTenantData(data);
            setLandlordData(null);
            setPaymentForm({
              bank_account_id: data.bank_accounts[0]?.id ?? 0,
              rent_month: data.current_month,
              amount: data.current_month_balance || data.tenancy.monthly_rent,
            });
          });
        }
      } catch (error) {
        setMessage(readError(error));
      } finally {
        setBusy(false);
      }
    };

    void load();
  }, [token, user]);

  async function handleLogin() {
    setBusy(true);
    setMessage("Signing in...");
    try {
      const auth = await login(username, password);
      startTransition(() => {
        setToken(auth.token);
        setUser(auth.user);
      });
      setMessage(`Signed in as ${auth.user.role}.`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setLandlordData(null);
    setTenantData(null);
    setUsername("owner");
    setPassword("owner123");
    setPaymentForm(initialPaymentForm);
    setMessage("Signed out.");
  }

  async function handleTenantPayment() {
    if (!tenantData) {
      return;
    }
    setBusy(true);
    setMessage("Creating Juspay payment session...");
    try {
      const initiated = await initiateTenantPayment(token, paymentForm);
      const result = await launchJuspayPayment(initiated);

      if (result.status === "cancelled") {
        setMessage("Payment was cancelled.");
        setBusy(false);
        return;
      }

      await confirmTenantPayment(token, {
        order_id: initiated.order_id,
        status: result.status === "succeeded" ? "succeeded" : "failed",
        provider_payment_id: result.providerPaymentId,
        provider_payload: result.providerPayload,
      });

      const refreshed = await fetchTenantDashboard(token);
      setTenantData(refreshed);
      setPaymentForm({
        bank_account_id: refreshed.bank_accounts[0]?.id ?? 0,
        rent_month: refreshed.current_month,
        amount: refreshed.current_month_balance || refreshed.tenancy.monthly_rent,
      });
      setMessage(
        result.mode === "mock"
          ? "Mock Juspay payment completed. Configure merchant credentials for live checkout."
          : "Payment completed and synced from Juspay.",
      );
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.eyebrow}>Cross-platform rent tracking</Text>
            <Text style={styles.title}>RentFlow</Text>
            <Text style={styles.subtitle}>
              One React Native app for iOS, Android, and web, backed by Django and ready for Juspay checkout.
            </Text>
            <Text style={styles.note}>
              API base URL: {Platform.OS === "web" ? "http://localhost:8000/api" : "Set EXPO_PUBLIC_API_URL"}
            </Text>
          </View>
          <View style={styles.roleCard}>
            <Text style={styles.roleTitle}>{user ? `${user.role.toUpperCase()} SESSION` : "DEMO LOGINS"}</Text>
            <Text style={styles.roleText}>Landlord: owner / owner123</Text>
            <Text style={styles.roleText}>Tenant: riya / tenant123</Text>
          </View>
        </View>

        {!user ? (
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Access</Text>
            <Text style={styles.panelTitle}>Sign in</Text>
            <View style={styles.formGrid}>
              <Field label="Username" value={username} onChangeText={setUsername} />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            <PrimaryButton label={busy ? "Signing in..." : "Login"} onPress={handleLogin} disabled={busy} />
          </View>
        ) : (
          <View style={styles.sessionBar}>
            <Text style={styles.sessionText}>
              Signed in as {user.first_name || user.username} ({user.role})
            </Text>
            <PrimaryButton label="Logout" onPress={logout} variant="secondary" />
          </View>
        )}

        <View style={[styles.banner, busy && styles.bannerBusy]}>
          {busy ? <ActivityIndicator color="#6e2d19" /> : null}
          <Text style={styles.bannerText}>{message}</Text>
        </View>

        {user?.role === "landlord" && landlordData ? <LandlordView data={landlordData} /> : null}
        {user?.role === "tenant" && tenantData ? (
          <TenantView
            data={tenantData}
            paymentForm={paymentForm}
            setPaymentForm={setPaymentForm}
            onSubmit={handleTenantPayment}
            busy={busy}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LandlordView({ data }: { data: LandlordDashboard }) {
  return (
    <View style={styles.stack}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Buildings" value={String(data.summary.building_count)} note={`${data.summary.unit_count} units`} />
        <SummaryCard label="Tenants" value={String(data.summary.tenant_count)} note="Active occupancies" />
        <SummaryCard label="Due" value={money(data.summary.monthly_due)} note={`For ${data.current_month}`} />
        <SummaryCard label="Outstanding" value={money(data.summary.monthly_outstanding)} note={`${money(data.summary.monthly_collected)} collected`} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Owner View</Text>
        <Text style={styles.panelTitle}>Tenant payment status</Text>
        <View style={styles.tableLike}>
          {data.tenants.map((tenant) => (
            <View key={tenant.id} style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>{tenant.tenant_name}</Text>
                <Text style={styles.rowMeta}>
                  {tenant.building_name} / {tenant.unit_label}
                </Text>
              </View>
              <View style={styles.tableNumbers}>
                <Text style={styles.rowValue}>{money(tenant.paid_this_month)}</Text>
                <Text style={styles.rowMeta}>Balance {money(tenant.balance)}</Text>
              </View>
              <StatusBadge status={tenant.status} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Ledger</Text>
        <Text style={styles.panelTitle}>Recent payments</Text>
        <View style={styles.tableLike}>
          {data.payments.map((payment) => (
            <View key={payment.id} style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>{payment.tenant_name}</Text>
                <Text style={styles.rowMeta}>
                  {payment.building_name} / {payment.unit_label} • {payment.rent_month}
                </Text>
              </View>
              <View style={styles.tableNumbers}>
                <Text style={styles.rowValue}>{money(payment.amount)}</Text>
                <Text style={styles.rowMeta}>{payment.bank_name}</Text>
              </View>
              <StatusBadge status={payment.status} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function TenantView({
  data,
  paymentForm,
  setPaymentForm,
  onSubmit,
  busy,
}: {
  data: TenantDashboard;
  paymentForm: InitiatePaymentInput;
  setPaymentForm: (value: InitiatePaymentInput) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Unit" value={data.tenancy.unit_label} note={data.tenancy.building_name} />
        <SummaryCard label="Monthly rent" value={money(data.tenancy.monthly_rent)} note={data.current_month} />
        <SummaryCard label="Paid" value={money(data.current_month_paid)} note="This month" />
        <SummaryCard label="Balance" value={money(data.current_month_balance)} note="Remaining" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Juspay</Text>
        <Text style={styles.panelTitle}>Pay rent inside the app</Text>
        <View style={styles.formGrid}>
          <Field
            label="Rent month"
            value={paymentForm.rent_month}
            onChangeText={(rent_month) => setPaymentForm({ ...paymentForm, rent_month })}
          />
          <Field
            label="Amount"
            value={String(paymentForm.amount)}
            onChangeText={(amount) => setPaymentForm({ ...paymentForm, amount })}
            keyboardType="numeric"
          />
          <Field
            label="Bank account id"
            value={String(paymentForm.bank_account_id)}
            onChangeText={(bank_account_id) => setPaymentForm({ ...paymentForm, bank_account_id: Number(bank_account_id) || 0 })}
            keyboardType="numeric"
          />
        </View>
        <Text style={styles.helper}>
          Available accounts: {data.bank_accounts.map((account) => `${account.id}: ${account.bank_name}`).join(" • ")}
        </Text>
        <PrimaryButton label={busy ? "Processing..." : "Pay with Juspay"} onPress={onSubmit} disabled={busy} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>History</Text>
        <Text style={styles.panelTitle}>Your payments</Text>
        <View style={styles.tableLike}>
          {data.payments.map((payment) => (
            <View key={payment.id} style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>{payment.rent_month}</Text>
                <Text style={styles.rowMeta}>
                  {payment.bank_name} ({payment.account_number})
                </Text>
              </View>
              <View style={styles.tableNumbers}>
                <Text style={styles.rowValue}>{money(payment.amount)}</Text>
                <Text style={styles.rowMeta}>{payment.paid_on}</Text>
              </View>
              <StatusBadge status={payment.status} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryNote}>{note}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid" || status === "succeeded"
      ? styles.goodBadge
      : status === "part_paid" || status === "pending" || status === "initiated"
        ? styles.neutralBadge
        : styles.warnBadge;
  return (
    <View style={[styles.badge, tone]}>
      <Text style={styles.badgeText}>{status.replaceAll("_", " ")}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      style={[styles.button, variant === "secondary" ? styles.secondaryButton : styles.primaryButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function readError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

function money(value: string | number) {
  const amount = Number(value || 0);
  return `INR ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4efe4",
  },
  page: {
    padding: 18,
    gap: 18,
  },
  hero: {
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#fff8ef",
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.12)",
  },
  eyebrow: {
    color: "#6e2d19",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "#1e1a17",
  },
  subtitle: {
    color: "#74695c",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  note: {
    marginTop: 10,
    color: "#a35f00",
    fontSize: 13,
  },
  roleCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#f2e0d4",
    gap: 6,
  },
  roleTitle: {
    fontWeight: "800",
    color: "#6e2d19",
    fontSize: 12,
  },
  roleText: {
    color: "#433123",
  },
  panel: {
    backgroundColor: "rgba(255,250,242,0.86)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.12)",
    padding: 18,
    gap: 14,
  },
  sectionKicker: {
    color: "#6e2d19",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  panelTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e1a17",
  },
  formGrid: {
    gap: 12,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontWeight: "700",
    color: "#433123",
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.18)",
    backgroundColor: "#fff",
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#b85c38",
  },
  secondaryButton: {
    backgroundColor: "rgba(110,45,25,0.1)",
  },
  buttonText: {
    color: "#fff8f3",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#6e2d19",
  },
  disabledButton: {
    opacity: 0.5,
  },
  sessionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fff8ef",
  },
  sessionText: {
    color: "#433123",
    fontWeight: "700",
  },
  banner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f2e0d4",
  },
  bannerBusy: {
    backgroundColor: "#f6eadc",
  },
  bannerText: {
    flex: 1,
    color: "#433123",
  },
  stack: {
    gap: 18,
  },
  summaryGrid: {
    gap: 12,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,250,242,0.86)",
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.12)",
  },
  summaryLabel: {
    color: "#6e2d19",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#1e1a17",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 10,
  },
  summaryNote: {
    color: "#74695c",
    marginTop: 8,
  },
  tableLike: {
    gap: 12,
  },
  tableRow: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.08)",
    gap: 10,
  },
  tableMain: {
    gap: 4,
  },
  tableNumbers: {
    gap: 4,
  },
  rowTitle: {
    color: "#1e1a17",
    fontWeight: "800",
    fontSize: 16,
  },
  rowMeta: {
    color: "#74695c",
  },
  rowValue: {
    color: "#1e1a17",
    fontWeight: "800",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goodBadge: {
    backgroundColor: "rgba(28,124,84,0.12)",
  },
  neutralBadge: {
    backgroundColor: "rgba(90,81,71,0.12)",
  },
  warnBadge: {
    backgroundColor: "rgba(163,95,0,0.12)",
  },
  badgeText: {
    textTransform: "capitalize",
    color: "#433123",
    fontWeight: "800",
  },
  helper: {
    color: "#74695c",
    lineHeight: 20,
  },
});
