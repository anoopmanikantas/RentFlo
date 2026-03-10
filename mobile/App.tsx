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
  createBankAccount,
  createBuilding,
  createTenancy,
  createUnit,
  fetchLandlordDashboard,
  fetchTenantDashboard,
  googleLogin,
  login,
  signup,
  updateRole,
  type AuthUser,
  type InitiatePaymentInput,
  type SignupInput,
  initiateTenantPayment,
  type LandlordDashboard,
  type TenantDashboard,
} from "./src/api";
import { launchRazorpayPayment } from "./src/razorpay";

const initialPaymentForm: InitiatePaymentInput = {
  bank_account_id: 0,
  rent_month: "",
  amount: "",
};

export default function App() {
  const [authScreen, setAuthScreen] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("owner123");
  // Signup fields
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupRole, setSignupRole] = useState<"landlord" | "tenant">("tenant");
  const [showRolePicker, setShowRolePicker] = useState(false);

  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [landlordData, setLandlordData] = useState<LandlordDashboard | null>(null);
  const [tenantData, setTenantData] = useState<TenantDashboard | null>(null);
  const [paymentForm, setPaymentForm] = useState<InitiatePaymentInput>(initialPaymentForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Sign in with your account, create one, or continue with Google.");
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
            if (data.tenancy) {
              setPaymentForm({
                bank_account_id: data.bank_accounts[0]?.id ?? 0,
                rent_month: data.current_month,
                amount: data.current_month_balance || data.tenancy.monthly_rent,
              });
            }
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

  async function handleSignup() {
    setBusy(true);
    setMessage("Creating account...");
    try {
      const data: SignupInput = {
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        first_name: signupFirstName,
        last_name: signupLastName,
        phone: signupPhone,
        role: signupRole,
      };
      const auth = await signup(data);
      startTransition(() => {
        setToken(auth.token);
        setUser(auth.user);
      });
      setMessage(`Account created! Signed in as ${auth.user.role}.`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setMessage("Signing in with Google...");
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
        if (!googleClientId) {
          setMessage("Set EXPO_PUBLIC_GOOGLE_CLIENT_ID to enable Google Sign-In.");
          setBusy(false);
          return;
        }
        // Use Google's GSI (Sign In With Google) JavaScript API
        const idToken = await new Promise<string>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.onload = () => {
            (window as any).google.accounts.id.initialize({
              client_id: googleClientId,
              callback: (response: any) => {
                if (response.credential) {
                  resolve(response.credential);
                } else {
                  reject(new Error("Google Sign-In returned no credential."));
                }
              },
            });
            (window as any).google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // Fallback: render a temporary button
                const container = document.createElement("div");
                container.id = "g_id_signin_tmp";
                container.style.position = "fixed";
                container.style.top = "50%";
                container.style.left = "50%";
                container.style.transform = "translate(-50%, -50%)";
                container.style.zIndex = "10000";
                container.style.background = "#fff";
                container.style.padding = "24px";
                container.style.borderRadius = "16px";
                container.style.boxShadow = "0 4px 24px rgba(0,0,0,0.15)";
                document.body.appendChild(container);
                (window as any).google.accounts.id.renderButton(container, {
                  theme: "outline",
                  size: "large",
                  text: "continue_with",
                  width: 300,
                });
                // Cleanup after 60s
                setTimeout(() => {
                  container.remove();
                  reject(new Error("Google Sign-In timed out."));
                }, 60000);
              }
            });
          };
          script.onerror = () => reject(new Error("Failed to load Google Sign-In SDK."));
          document.head.appendChild(script);
        });
        const auth = await googleLogin(idToken);
        // Clean up any leftover prompt container
        document.getElementById("g_id_signin_tmp")?.remove();
        if (auth.is_new) {
          // New user – save token & user, then show role picker
          startTransition(() => {
            setToken(auth.token);
            setUser(auth.user);
            setShowRolePicker(true);
          });
          setMessage("Welcome! Choose your role to get started.");
        } else {
          startTransition(() => {
            setToken(auth.token);
            setUser(auth.user);
          });
          setMessage(`Signed in with Google as ${auth.user.role}.`);
        }
      } else {
        setMessage("Google Sign-In on native requires Expo AuthSession setup. Use web for now.");
      }
    } catch (error) {
      document.getElementById("g_id_signin_tmp")?.remove();
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
    setSignupUsername("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupFirstName("");
    setSignupLastName("");
    setSignupPhone("");
    setSignupRole("tenant");
    setAuthScreen("login");
    setShowRolePicker(false);
    setPaymentForm(initialPaymentForm);
    setMessage("Signed out.");
  }

  async function handleRoleSelect(role: "landlord" | "tenant") {
    setBusy(true);
    setMessage(`Setting role to ${role}...`);
    try {
      const updatedUser = await updateRole(token, role);
      startTransition(() => {
        setUser(updatedUser);
        setShowRolePicker(false);
      });
      setMessage(`You're now a ${role}. Loading your dashboard...`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleTenantPayment() {
    if (!tenantData) {
      return;
    }
    setBusy(true);
    setMessage("Launching Razorpay checkout...");
    try {
      const initiated = await initiateTenantPayment(token, paymentForm);
      const result = await launchRazorpayPayment(initiated);

      if (result.status === "cancelled") {
        setMessage("Payment was cancelled.");
        setBusy(false);
        return;
      }

      await confirmTenantPayment(token, {
        order_id: initiated.order_id,
        status: result.status === "succeeded" ? "succeeded" : "failed",
        provider_payment_id: result.providerPaymentId,
        razorpay_signature: result.razorpaySignature,
        provider_payload: result.providerPayload,
      });

      const refreshed = await fetchTenantDashboard(token);
      setTenantData(refreshed);
      if (refreshed.tenancy) {
        setPaymentForm({
          bank_account_id: refreshed.bank_accounts[0]?.id ?? 0,
          rent_month: refreshed.current_month,
          amount: refreshed.current_month_balance || refreshed.tenancy.monthly_rent,
        });
      }
      setMessage(
        result.mode === "mock"
          ? "Mock payment completed. Set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET for live UPI/card checkout."
          : "Payment completed via Razorpay.",
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
            <Text style={styles.title}>RentFlo</Text>
            <Text style={styles.subtitle}>
              One React Native app for iOS, Android, and web, backed by Django and ready for Razorpay checkout.
            </Text>
            <Text style={styles.note}>
              API base URL: {Platform.OS === "web" ? "http://localhost:8085/api" : "Set EXPO_PUBLIC_API_URL"}
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
            <View style={styles.authTabs}>
              <Pressable
                style={[styles.authTab, authScreen === "login" && styles.authTabActive]}
                onPress={() => setAuthScreen("login")}
              >
                <Text style={[styles.authTabText, authScreen === "login" && styles.authTabTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable
                style={[styles.authTab, authScreen === "signup" && styles.authTabActive]}
                onPress={() => setAuthScreen("signup")}
              >
                <Text style={[styles.authTabText, authScreen === "signup" && styles.authTabTextActive]}>Sign up</Text>
              </Pressable>
            </View>

            {authScreen === "login" ? (
              <>
                <View style={styles.formGrid}>
                  <Field label="Username" value={username} onChangeText={setUsername} />
                  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                </View>
                <PrimaryButton label={busy ? "Signing in..." : "Login"} onPress={handleLogin} disabled={busy} />
              </>
            ) : (
              <>
                <View style={styles.formGrid}>
                  <Field label="Username" value={signupUsername} onChangeText={setSignupUsername} />
                  <Field label="Email" value={signupEmail} onChangeText={setSignupEmail} />
                  <Field label="Password" value={signupPassword} onChangeText={setSignupPassword} secureTextEntry />
                  <Field label="First name" value={signupFirstName} onChangeText={setSignupFirstName} />
                  <Field label="Last name" value={signupLastName} onChangeText={setSignupLastName} />
                  <Field label="Phone" value={signupPhone} onChangeText={setSignupPhone} />
                  <View style={styles.roleToggle}>
                    <Text style={styles.fieldLabel}>Role</Text>
                    <View style={styles.roleOptions}>
                      <Pressable
                        style={[styles.roleOption, signupRole === "tenant" && styles.roleOptionActive]}
                        onPress={() => setSignupRole("tenant")}
                      >
                        <Text style={[styles.roleOptionText, signupRole === "tenant" && styles.roleOptionTextActive]}>
                          Tenant
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleOption, signupRole === "landlord" && styles.roleOptionActive]}
                        onPress={() => setSignupRole("landlord")}
                      >
                        <Text style={[styles.roleOptionText, signupRole === "landlord" && styles.roleOptionTextActive]}>
                          Landlord
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
                <PrimaryButton label={busy ? "Creating account..." : "Create account"} onPress={handleSignup} disabled={busy} />
              </>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <PrimaryButton label="Continue with Google" onPress={handleGoogleLogin} disabled={busy} variant="google" />
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

        {user?.role === "landlord" && landlordData ? <LandlordView data={landlordData} token={token} onRefresh={async () => {
          const data = await fetchLandlordDashboard(token);
          setLandlordData(data);
        }} /> : null}
        {user?.role === "tenant" && tenantData ? (
          tenantData.tenancy ? (
            <TenantView
              data={tenantData as TenantDashboard & { tenancy: NonNullable<TenantDashboard["tenancy"]> }}
              paymentForm={paymentForm}
              setPaymentForm={setPaymentForm}
              onSubmit={handleTenantPayment}
              busy={busy}
            />
          ) : (
            <TenantWelcome user={user} />
          )
        ) : null}

        {showRolePicker && user ? (
          <RolePicker onSelect={handleRoleSelect} busy={busy} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LandlordView({ data, token, onRefresh }: { data: LandlordDashboard; token: string; onRefresh: () => void }) {
  type FormType = null | "building" | "unit" | "bank" | "tenancy";
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  // Building form
  const [bName, setBName] = useState("");
  const [bAddress, setBAddress] = useState("");
  // Unit form
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [uLabel, setULabel] = useState("");
  const [uRent, setURent] = useState("");
  // Bank form
  const [bankName, setBankName] = useState("");
  const [accName, setAccName] = useState("");
  const [accNumber, setAccNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  // Tenancy form
  const [tenantEmail, setTenantEmail] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  function openForm(form: FormType) {
    setActiveForm(activeForm === form ? null : form);
    setFormMsg("");
  }

  const unoccupiedUnits = data.units.filter(
    (u) => !data.tenants.some((t) => t.unit_label === u.label && t.building_name === u.building_name),
  );

  return (
    <View style={styles.stack}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Buildings" value={String(data.summary.building_count)} note={`${data.summary.unit_count} units`} />
        <SummaryCard label="Tenants" value={String(data.summary.tenant_count)} note="Active occupancies" />
        <SummaryCard label="Due" value={money(data.summary.monthly_due)} note={`For ${data.current_month}`} />
        <SummaryCard label="Outstanding" value={money(data.summary.monthly_outstanding)} note={`${money(data.summary.monthly_collected)} collected`} />
      </View>

      {/* Quick actions bar */}
      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Manage</Text>
        <Text style={styles.panelTitle}>Quick actions</Text>
        {formMsg ? (
          <View style={[styles.banner, { marginBottom: 2 }]}>
            <Text style={styles.bannerText}>{formMsg}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ActionChip icon="🏢" label="Building" active={activeForm === "building"} onPress={() => openForm("building")} />
          <ActionChip icon="🚪" label="Unit" active={activeForm === "unit"} onPress={() => openForm("unit")} disabled={data.buildings.length === 0} />
          <ActionChip icon="🏦" label="Bank account" active={activeForm === "bank"} onPress={() => openForm("bank")} />
          <ActionChip icon="👤" label="Assign tenant" active={activeForm === "tenancy"} onPress={() => openForm("tenancy")} disabled={unoccupiedUnits.length === 0} />
        </View>

        {/* Building form */}
        {activeForm === "building" && (
          <View style={styles.inlineForm}>
            <Text style={styles.inlineFormTitle}>New building</Text>
            <Field label="Name" value={bName} onChangeText={setBName} />
            <Field label="Address" value={bAddress} onChangeText={setBAddress} />
            <PrimaryButton
              label={formBusy ? "Creating..." : "Create building"}
              disabled={formBusy || !bName.trim()}
              onPress={async () => {
                setFormBusy(true);
                try {
                  await createBuilding(token, { name: bName, address: bAddress });
                  setFormMsg(`✓ Building "${bName}" created`);
                  setBName(""); setBAddress(""); setActiveForm(null);
                  onRefresh();
                } catch (e) { setFormMsg(readError(e)); }
                setFormBusy(false);
              }}
            />
          </View>
        )}

        {/* Unit form — pick building visually */}
        {activeForm === "unit" && (
          <View style={styles.inlineForm}>
            <Text style={styles.inlineFormTitle}>New unit</Text>
            <Text style={styles.fieldLabel}>Select building</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.buildings.map((b) => (
                <Pressable
                  key={b.id}
                  style={[styles.selectChip, selectedBuildingId === b.id && styles.selectChipActive]}
                  onPress={() => setSelectedBuildingId(b.id)}
                >
                  <Text style={[styles.selectChipText, selectedBuildingId === b.id && styles.selectChipTextActive]}>
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field label="Unit label (e.g. 2B, Ground Floor)" value={uLabel} onChangeText={setULabel} />
            <Field label="Monthly rent (₹)" value={uRent} onChangeText={setURent} keyboardType="numeric" />
            <PrimaryButton
              label={formBusy ? "Creating..." : "Create unit"}
              disabled={formBusy || !selectedBuildingId || !uLabel.trim() || !uRent.trim()}
              onPress={async () => {
                setFormBusy(true);
                try {
                  await createUnit(token, { building_id: selectedBuildingId!, label: uLabel, monthly_rent: uRent });
                  setFormMsg(`✓ Unit "${uLabel}" created`);
                  setSelectedBuildingId(null); setULabel(""); setURent(""); setActiveForm(null);
                  onRefresh();
                } catch (e) { setFormMsg(readError(e)); }
                setFormBusy(false);
              }}
            />
          </View>
        )}

        {/* Bank account form */}
        {activeForm === "bank" && (
          <View style={styles.inlineForm}>
            <Text style={styles.inlineFormTitle}>New bank account</Text>
            <Field label="Bank name" value={bankName} onChangeText={setBankName} />
            <Field label="Account holder name" value={accName} onChangeText={setAccName} />
            <Field label="Account number" value={accNumber} onChangeText={setAccNumber} keyboardType="numeric" />
            <Field label="IFSC code (optional)" value={ifsc} onChangeText={setIfsc} />
            <PrimaryButton
              label={formBusy ? "Creating..." : "Add bank account"}
              disabled={formBusy || !bankName.trim() || !accNumber.trim()}
              onPress={async () => {
                setFormBusy(true);
                try {
                  await createBankAccount(token, { bank_name: bankName, account_name: accName, account_number: accNumber, ifsc });
                  setFormMsg(`✓ Bank account added`);
                  setBankName(""); setAccName(""); setAccNumber(""); setIfsc(""); setActiveForm(null);
                  onRefresh();
                } catch (e) { setFormMsg(readError(e)); }
                setFormBusy(false);
              }}
            />
          </View>
        )}

        {/* Assign tenant — pick unit visually */}
        {activeForm === "tenancy" && (
          <View style={styles.inlineForm}>
            <Text style={styles.inlineFormTitle}>Assign tenant to unit</Text>
            <Text style={styles.helper}>The tenant must have signed up on RentFlo first.</Text>
            <Field label="Tenant's email" value={tenantEmail} onChangeText={setTenantEmail} />
            <Text style={styles.fieldLabel}>Select vacant unit</Text>
            <View style={{ gap: 6 }}>
              {unoccupiedUnits.length === 0 ? (
                <Text style={styles.helper}>All units are occupied. Add a new unit first.</Text>
              ) : (
                unoccupiedUnits.map((u) => (
                  <Pressable
                    key={u.id}
                    style={[styles.selectChip, selectedUnitId === u.id && styles.selectChipActive, { paddingVertical: 10 }]}
                    onPress={() => setSelectedUnitId(u.id)}
                  >
                    <Text style={[styles.selectChipText, selectedUnitId === u.id && styles.selectChipTextActive]}>
                      {u.building_name} / {u.label} — {money(u.monthly_rent)}/mo
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
            <PrimaryButton
              label={formBusy ? "Assigning..." : "Assign tenant"}
              disabled={formBusy || !tenantEmail.trim() || !selectedUnitId}
              onPress={async () => {
                setFormBusy(true);
                try {
                  await createTenancy(token, { tenant_email: tenantEmail, unit_id: selectedUnitId! });
                  setFormMsg(`✓ Tenant assigned successfully`);
                  setTenantEmail(""); setSelectedUnitId(null); setActiveForm(null);
                  onRefresh();
                } catch (e) { setFormMsg(readError(e)); }
                setFormBusy(false);
              }}
            />
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Owner View</Text>
        <Text style={styles.panelTitle}>Tenant payment status</Text>
        {data.tenants.length === 0 ? (
          <Text style={styles.helper}>No tenants yet. Add a building, a unit, and assign a tenant above.</Text>
        ) : (
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
        )}
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
  data: TenantDashboard & { tenancy: NonNullable<TenantDashboard["tenancy"]> };
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
        <Text style={styles.sectionKicker}>Razorpay</Text>
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
        <PrimaryButton label={busy ? "Processing..." : "Pay rent"} onPress={onSubmit} disabled={busy} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>History</Text>
        <Text style={styles.panelTitle}>Your payments</Text>
        {data.payments.length === 0 ? (
          <Text style={styles.helper}>No payments yet.</Text>
        ) : (
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
        )}
      </View>
    </View>
  );
}

function RolePicker({ onSelect, busy }: { onSelect: (role: "landlord" | "tenant") => void; busy: boolean }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionKicker}>Welcome</Text>
      <Text style={styles.panelTitle}>How will you use RentFlo?</Text>
      <Text style={styles.helper}>
        Choose your role. You can change this later from your profile.
      </Text>
      <View style={{ gap: 10, marginTop: 4 }}>
        <Pressable
          style={[styles.roleOption, { paddingVertical: 18, paddingHorizontal: 16, borderRadius: 18 }]}
          onPress={() => onSelect("landlord")}
          disabled={busy}
        >
          <Text style={[styles.rowTitle, { textAlign: "center" }]}>I'm a Landlord</Text>
          <Text style={[styles.helper, { textAlign: "center", marginTop: 4 }]}>
            Manage buildings, units, and collect rent from tenants.
          </Text>
        </Pressable>
        <Pressable
          style={[styles.roleOption, { paddingVertical: 18, paddingHorizontal: 16, borderRadius: 18 }]}
          onPress={() => onSelect("tenant")}
          disabled={busy}
        >
          <Text style={[styles.rowTitle, { textAlign: "center" }]}>I'm a Tenant</Text>
          <Text style={[styles.helper, { textAlign: "center", marginTop: 4 }]}>
            View your rent details and pay online via UPI or card.
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TenantWelcome({ user }: { user: AuthUser }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionKicker}>Almost there</Text>
      <Text style={styles.panelTitle}>Welcome, {user.first_name || user.username}!</Text>
      <Text style={styles.helper}>
        Your account is set up, but your landlord hasn't assigned you to a unit yet.
      </Text>
      <Text style={styles.helper}>
        Share your email ({user.email}) with your landlord so they can link you to your apartment.
        Once they do, you'll see your rent details and payment options here.
      </Text>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>What to do</Text>
        <Text style={[styles.helper, { marginTop: 8 }]}>1. Ask your landlord to add you on RentFlo</Text>
        <Text style={styles.helper}>2. They'll enter your email and assign a unit</Text>
        <Text style={styles.helper}>3. Refresh this page to see your dashboard</Text>
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
  variant?: "primary" | "secondary" | "google";
}) {
  const variantStyle =
    variant === "google"
      ? styles.googleButton
      : variant === "secondary"
        ? styles.secondaryButton
        : styles.primaryButton;
  const textStyle =
    variant === "google"
      ? styles.googleButtonText
      : variant === "secondary"
        ? styles.secondaryButtonText
        : styles.buttonText;
  return (
    <Pressable
      style={[styles.button, variantStyle, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

function ActionChip({ icon, label, active, onPress, disabled }: { icon: string; label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.actionChip, active && styles.actionChipActive, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[styles.actionChipText, active && styles.actionChipTextActive]}>{label}</Text>
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
  googleButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.18)",
  },
  buttonText: {
    color: "#fff8f3",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#6e2d19",
  },
  googleButtonText: {
    color: "#433123",
    fontWeight: "800",
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
  authTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  authTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(110,45,25,0.06)",
  },
  authTabActive: {
    backgroundColor: "#b85c38",
  },
  authTabText: {
    fontWeight: "800",
    color: "#6e2d19",
  },
  authTabTextActive: {
    color: "#fff",
  },
  roleToggle: {
    gap: 8,
  },
  roleOptions: {
    flexDirection: "row",
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.18)",
    backgroundColor: "#fff",
  },
  roleOptionActive: {
    backgroundColor: "#b85c38",
    borderColor: "#b85c38",
  },
  roleOptionText: {
    fontWeight: "700",
    color: "#433123",
  },
  roleOptionTextActive: {
    color: "#fff",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(67,49,35,0.12)",
  },
  dividerText: {
    color: "#74695c",
    fontWeight: "700",
    fontSize: 13,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.18)",
    backgroundColor: "#fff",
  },
  actionChipActive: {
    backgroundColor: "#b85c38",
    borderColor: "#b85c38",
  },
  actionChipText: {
    fontWeight: "700",
    color: "#433123",
    fontSize: 14,
  },
  actionChipTextActive: {
    color: "#fff",
  },
  selectChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.18)",
    backgroundColor: "#fff",
  },
  selectChipActive: {
    backgroundColor: "#b85c38",
    borderColor: "#b85c38",
  },
  selectChipText: {
    fontWeight: "700",
    color: "#433123",
    fontSize: 14,
  },
  selectChipTextActive: {
    color: "#fff",
  },
  inlineForm: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(67,49,35,0.08)",
  },
  inlineFormTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e1a17",
  },
});
