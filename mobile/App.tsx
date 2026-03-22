import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Appearance,
  Easing,
  type LayoutChangeEvent,
  Platform,
  Pressable as RNPressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFonts, ModernAntiqua_400Regular } from "@expo-google-fonts/modern-antiqua";

import {
  ApiError,
  confirmTenantPayment,
  createBankAccount,
  createBuilding,
  createTenancy,
  createUnit,
  endTenancy,
  firebaseLandlordAuth,
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
  // Subscription & billing
  fetchSubscription,
  upgradeSubscription,
  confirmUpgrade,
  activateAddOn,
  confirmAddOn,
  fetchAnalytics,
  exportPayments,
  fetchDelinquencyAnalytics,
  fetchCashFlowForecast,
  fetchPropertyROI,
  fetchTenantRiskScoring,
  fetchMaintenanceIntelligence,
  fetchTaxComplianceReport,
  type SubscriptionResponse,
  type SubscriptionInfo,
  type Plan,
  type AddOnCatalogItem,
  type AnalyticsData,
  type PaymentReportFormat,
  // Onboarding
  fetchOnboardingStatus,
  uploadDocument,
  verifyDocument,
  createDeposit,
  payDeposit,
  createAgreement,
  signAgreement,
  type OnboardingStatus,
  type TenantDocumentItem,
  type DepositInfo,
  type AgreementInfo,
  // Tickets
  fetchTickets,
  createTicket,
  updateTicket,
  type TicketItem,
  // Offboarding
  initiateOffboarding,
  fetchOffboardingDetail,
  settleDeposit,
  completeHandoff,
  confirmMaintenanceDone,
  type OffboardingInfo,
} from "./src/api";
import { getFirebaseAuth, getFirebaseConfigError, isFirebaseLandlordAuthEnabled } from "./src/firebase";
import { launchRazorpayPayment } from "./src/razorpay";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as signOutFirebase,
  updateProfile,
} from "firebase/auth";

// ─── Theme system ───────────────────────────────────────────────────────────

type Theme = {
  mode: "light" | "dark";
  bg: string;
  surface: string;
  card: string;
  cardAlt: string;
  primary: string;
  primaryMuted: string;
  primaryText: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
  borderStrong: string;
  inputBg: string;
  inputBorder: string;
  bannerBg: string;
  bannerBusy: string;
  success: string;
  successText: string;
  warning: string;
  warningText: string;
  neutral: string;
  danger: string;
  dangerText: string;
  badgeText: string;
  shadow: string;
};

const lightTheme: Theme = {
  mode: "light",
  bg: "#f6f2eb",
  surface: "rgba(255,252,247,0.88)",
  card: "#ffffff",
  cardAlt: "#fff9f2",
  primary: "#c45a32",
  primaryMuted: "rgba(196,90,50,0.08)",
  primaryText: "#ffffff",
  text: "#1a1714",
  textSecondary: "#6b6053",
  accent: "#7a3219",
  border: "rgba(67,49,35,0.08)",
  borderStrong: "rgba(67,49,35,0.16)",
  inputBg: "#ffffff",
  inputBorder: "rgba(67,49,35,0.14)",
  bannerBg: "#f0ddd0",
  bannerBusy: "#f6eadc",
  success: "rgba(28,124,84,0.10)",
  successText: "#1c7c54",
  warning: "rgba(163,95,0,0.10)",
  warningText: "#a35f00",
  neutral: "rgba(90,81,71,0.10)",
  danger: "rgba(180,40,40,0.08)",
  dangerText: "#b42828",
  badgeText: "#433123",
  shadow: "rgba(0,0,0,0.06)",
};

const darkTheme: Theme = {
  mode: "dark",
  bg: "#0f0f17",
  surface: "rgba(25,25,38,0.85)",
  card: "#1a1a26",
  cardAlt: "#1e1e2c",
  primary: "#e07a4f",
  primaryMuted: "rgba(224,122,79,0.12)",
  primaryText: "#ffffff",
  text: "#eae6e0",
  textSecondary: "#7d7670",
  accent: "#e8915e",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  inputBg: "#1a1a24",
  inputBorder: "rgba(255,255,255,0.08)",
  bannerBg: "rgba(224,122,79,0.08)",
  bannerBusy: "rgba(224,122,79,0.05)",
  success: "rgba(72,187,120,0.14)",
  successText: "#48bb78",
  warning: "rgba(236,201,75,0.14)",
  warningText: "#ecc94b",
  neutral: "rgba(160,148,138,0.10)",
  danger: "rgba(220,80,80,0.12)",
  dangerText: "#fc6b6b",
  badgeText: "#cfc8bf",
  shadow: "rgba(0,0,0,0.4)",
};

type ThemeCtx = {
  t: Theme;
  s: ReturnType<typeof makeStyles>;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeCtx>(null!);

function useT() {
  return useContext(ThemeContext);
}

const PRESS_ANIMATION_DURATION_MS = 250;
const PRESS_SCALE = 0.985;
const PRESS_OPACITY = 0.92;
const AnimatedRNPressable = Animated.createAnimatedComponent(RNPressable);

function Pressable({ style, onPressIn, onPressOut, children, ...props }: ComponentProps<typeof RNPressable>) {
  const pressAnim = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const animatePress = useCallback(
    (toValue: number) => {
      Animated.timing(pressAnim, {
        toValue,
        duration: PRESS_ANIMATION_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    },
    [pressAnim],
  );

  const handlePressIn = useCallback<NonNullable<ComponentProps<typeof RNPressable>["onPressIn"]>>(
    (event) => {
      setPressed(true);
      animatePress(1);
      onPressIn?.(event);
    },
    [animatePress, onPressIn],
  );

  const handlePressOut = useCallback<NonNullable<ComponentProps<typeof RNPressable>["onPressOut"]>>(
    (event) => {
      setPressed(false);
      animatePress(0);
      onPressOut?.(event);
    },
    [animatePress, onPressOut],
  );

  const resolvedStyle = typeof style === "function" ? style({ pressed }) : style;
  const animatedStyle = {
    opacity: pressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, PRESS_OPACITY],
    }),
    transform: [
      {
        scale: pressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, PRESS_SCALE],
        }),
      },
    ],
  };

  return (
    <AnimatedRNPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[resolvedStyle, animatedStyle]}
    >
      {typeof children === "function" ? children({ pressed }) : children}
    </AnimatedRNPressable>
  );
}

function AppearOnMount({
  children,
  style,
  visible = true,
  unmountOnExit = false,
  onExitComplete,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof Animated.View>["style"];
  visible?: boolean;
  unmountOnExit?: boolean;
  onExitComplete?: () => void;
}) {
  const appearAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible || !unmountOnExit);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setDisplayChildren(children);
    }
  }, [children, visible]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (!nextHeight) {
      return;
    }
    setMeasuredHeight((currentHeight) => (Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight));
  }, []);

  useEffect(() => {
    if (visible && !shouldRender) {
      appearAnim.setValue(0);
      heightAnim.setValue(0);
      setShouldRender(true);
      return;
    }

    if (!shouldRender) {
      return;
    }

    if (visible && measuredHeight === 0) {
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(appearAnim, {
        toValue: visible ? 1 : 0,
        duration: PRESS_ANIMATION_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue: visible ? measuredHeight : 0,
        duration: PRESS_ANIMATION_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]);

    animation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      if (visible) {
        heightAnim.setValue(measuredHeight);
        return;
      }
      if (unmountOnExit) {
        setShouldRender(false);
      }
      onExitComplete?.();
    });

    return () => {
      animation.stop();
    };
  }, [appearAnim, heightAnim, measuredHeight, onExitComplete, shouldRender, unmountOnExit, visible]);

  if (!shouldRender && unmountOnExit) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        style,
        {
          height: heightAnim,
          overflow: "hidden",
          opacity: appearAnim,
          transform: [
            {
              translateY: appearAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
            {
              scale: appearAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View onLayout={handleLayout}>
        {displayChildren}
      </View>
    </Animated.View>
  );
}

function useRetainedNullableValue<T>(value: T | null) {
  const retainedValue = useRef<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      retainedValue.current = value;
    }
  }, [value]);

  return value ?? retainedValue.current;
}

// ─── Dynamic styles ─────────────────────────────────────────────────────────

const webTransition = Platform.select({
  web: { transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)" } as any,
  default: {},
});

const webGlass = Platform.select({
  web: { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any,
  default: {},
});

function makeStyles(t: Theme, isWideWeb: boolean, isMediumWeb: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.bg,
      ...webTransition,
    },
    pageOuter: {
      alignItems: isWideWeb ? "stretch" : "center",
      paddingVertical: 28,
      paddingHorizontal: isWideWeb ? 28 : 16,
    },
    pageInner: {
      width: "100%",
      maxWidth: Platform.OS === "web" ? (isWideWeb ? 1480 : 980) : 520,
      alignSelf: "center",
      gap: 20,
    },
    landingGrid: {
      flexDirection: isWideWeb ? ("row" as const) : ("column" as const),
      gap: 20,
      alignItems: "stretch",
    },
    landingMain: {
      flex: isWideWeb ? 1.35 : undefined,
      minWidth: 0,
    },
    landingAside: {
      width: isWideWeb ? 420 : "100%",
      gap: 16,
      flexShrink: 0,
    },
    hero: {
      flexDirection: isWideWeb ? ("row" as const) : ("column" as const),
      alignItems: isWideWeb ? ("stretch" as const) : ("flex-start" as const),
      gap: 16,
      padding: isWideWeb ? 32 : 26,
      borderRadius: 24,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
      ...webTransition,
    },
    heroBody: {
      flex: 1,
      minWidth: 0,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    eyebrow: {
      color: t.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    title: {
      fontSize: 42,
      fontFamily: "ModernAntiqua_400Regular",
      fontWeight: "400",
      color: t.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: t.textSecondary,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 8,
    },
    note: {
      marginTop: 10,
      color: t.warningText,
      fontSize: 13,
    },
    roleCard: {
      width: isWideWeb ? 320 : "100%",
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.primaryMuted,
      gap: 6,
      ...webTransition,
    },
    roleTitle: {
      fontWeight: "800",
      color: t.accent,
      fontSize: 12,
    },
    roleText: {
      color: t.text,
    },
    themeToggle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.primaryMuted,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 8,
      ...webTransition,
    },
    themeToggleIcon: {
      fontSize: 20,
    },
    panel: {
      backgroundColor: t.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.border,
      padding: isWideWeb ? 24 : 22,
      gap: 16,
      ...webGlass,
      ...webTransition,
    },
    sectionKicker: {
      color: t.accent,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.4,
    },
    panelTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: t.text,
      letterSpacing: -0.3,
    },
    formGrid: {
      flexDirection: isMediumWeb ? ("row" as const) : ("column" as const),
      flexWrap: isMediumWeb ? ("wrap" as const) : ("nowrap" as const),
      alignItems: "stretch",
      gap: 14,
    },
    field: {
      ...(isMediumWeb ? { flexGrow: 1, flexBasis: 280 } : {}),
      gap: 8,
    },
    fieldLabel: {
      fontWeight: "700",
      color: t.text,
      fontSize: 14,
    },
    input: {
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: t.inputBorder,
      backgroundColor: t.inputBg,
      fontSize: 15,
      color: t.text,
      ...webTransition,
    },
    button: {
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 14,
      alignItems: "center",
      alignSelf: "flex-start",
    },
    primaryButton: {
      backgroundColor: t.primary,
    },
    secondaryButton: {
      backgroundColor: t.primaryMuted,
    },
    googleButton: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderStrong,
    },
    buttonText: {
      color: t.primaryText,
      fontWeight: "800",
      fontSize: 15,
    },
    secondaryButtonText: {
      color: t.accent,
      fontWeight: "700",
    },
    googleButtonText: {
      color: t.text,
      fontWeight: "800",
    },
    disabledButton: {
      opacity: 0.4,
    },
    sessionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: 14,
      paddingHorizontal: 18,
      borderRadius: 16,
      backgroundColor: t.cardAlt,
      borderWidth: 1,
      borderColor: t.border,
      ...webTransition,
    },
    sessionText: {
      color: t.text,
      fontWeight: "700",
    },
    banner: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      padding: 14,
      borderRadius: 18,
      backgroundColor: t.bannerBg,
      ...webTransition,
    },
    bannerBusy: {
      backgroundColor: t.bannerBusy,
    },
    bannerText: {
      flex: 1,
      color: t.text,
      fontSize: 14,
    },
    stack: {
      gap: 20,
    },
    dashboardGrid: {
      flexDirection: isWideWeb ? ("row" as const) : ("column" as const),
      alignItems: "stretch",
      gap: 20,
    },
    dashboardMainColumn: {
      flex: isWideWeb ? 1.3 : undefined,
      minWidth: 0,
      gap: 20,
    },
    dashboardSideColumn: {
      flex: isWideWeb ? 0.95 : undefined,
      minWidth: isWideWeb ? 340 : 0,
      gap: 20,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isWideWeb ? 16 : 12,
    },
    summaryCard: {
      flex: 1,
      minWidth: isWideWeb ? 220 : 140,
      padding: 18,
      borderRadius: 22,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      ...webGlass,
      ...webTransition,
    },
    summaryCardInteractive: {
      cursor: Platform.OS === "web" ? ("pointer" as const) : undefined,
    },
    summaryCardActive: {
      borderColor: t.primary,
      backgroundColor: t.primaryMuted,
    },
    summaryLabel: {
      color: t.accent,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    summaryValue: {
      color: t.text,
      fontSize: 26,
      fontWeight: "900",
      marginTop: 10,
    },
    summaryNote: {
      color: t.textSecondary,
      marginTop: 8,
      fontSize: 13,
    },
    summaryActionText: {
      color: t.accent,
      marginTop: 10,
      fontSize: 12,
      fontWeight: "800",
    },
    detailGroupCard: {
      padding: 18,
      borderRadius: 18,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      gap: 12,
      ...webTransition,
    },
    detailGroupHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    detailGroupTitle: {
      color: t.text,
      fontSize: 18,
      fontWeight: "800",
      flex: 1,
    },
    detailGroupTotal: {
      color: t.accent,
      fontSize: 16,
      fontWeight: "900",
    },
    tableLike: {
      gap: 12,
    },
    tableRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      padding: 14,
      borderRadius: 18,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      gap: 10,
      ...webTransition,
    },
    tableMain: {
      flex: 1,
      minWidth: 120,
      gap: 4,
    },
    tableNumbers: {
      alignItems: "flex-end",
      gap: 4,
    },
    rowTitle: {
      color: t.text,
      fontWeight: "800",
      fontSize: 16,
    },
    rowMeta: {
      color: t.textSecondary,
      fontSize: 13,
    },
    rowValue: {
      color: t.text,
      fontWeight: "800",
    },
    badge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    goodBadge: {
      backgroundColor: t.success,
    },
    neutralBadge: {
      backgroundColor: t.neutral,
    },
    warnBadge: {
      backgroundColor: t.warning,
    },
    badgeText: {
      textTransform: "capitalize",
      color: t.badgeText,
      fontWeight: "800",
      fontSize: 12,
    },
    removeButton: {
      alignSelf: "flex-start",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: t.danger,
    },
    removeButtonText: {
      color: t.dangerText,
      fontSize: 13,
      fontWeight: "700",
    },
    helper: {
      color: t.textSecondary,
      lineHeight: 20,
      fontSize: 14,
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
      backgroundColor: t.primaryMuted,
      ...webTransition,
    },
    authTabActive: {
      backgroundColor: t.primary,
    },
    authTabText: {
      fontWeight: "800",
      color: t.accent,
    },
    authTabTextActive: {
      color: t.primaryText,
    },
    roleToggle: {
      gap: 8,
      marginBottom: 4,
    },
    roleOptions: {
      flexDirection: "row",
      gap: 8,
    },
    roleOption: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.card,
      ...webTransition,
    },
    roleOptionActive: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    roleOptionText: {
      fontWeight: "700",
      color: t.text,
    },
    roleOptionTextActive: {
      color: t.primaryText,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.border,
    },
    dividerText: {
      color: t.textSecondary,
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
      borderColor: t.borderStrong,
      backgroundColor: t.card,
      ...webTransition,
    },
    actionChipActive: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    actionChipText: {
      fontWeight: "700",
      color: t.text,
      fontSize: 14,
    },
    actionChipTextActive: {
      color: t.primaryText,
    },
    selectChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.card,
      ...webTransition,
    },
    selectChipActive: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    selectChipText: {
      fontWeight: "700",
      color: t.text,
      fontSize: 14,
    },
    selectChipTextActive: {
      color: t.primaryText,
    },
    inlineForm: {
      gap: 14,
      padding: 18,
      borderRadius: 18,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      ...webTransition,
    },
    inlineFormTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: t.text,
    },
    addressDropdown: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      zIndex: 50,
      marginTop: 4,
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.mode === "dark" ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 6,
      overflow: "hidden",
    },
    addressItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    addressItemIcon: {
      fontSize: 14,
      marginTop: 2,
    },
    addressItemText: {
      flex: 1,
      fontSize: 13,
      color: t.text,
      lineHeight: 18,
    },
    locationButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: t.primaryMuted,
      marginTop: 2,
    },
    locationButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: t.accent,
    },
    // Subscription & Plans styles
    planCard: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: t.card,
      borderWidth: 2,
      borderColor: t.border,
      gap: 10,
      ...webTransition,
    },
    planCardActive: {
      borderColor: t.primary,
      backgroundColor: t.primaryMuted,
    },
    planName: {
      fontSize: 22,
      fontWeight: "900",
      color: t.text,
    },
    planPrice: {
      fontSize: 28,
      fontWeight: "900",
      color: t.accent,
    },
    planPriceSuffix: {
      fontSize: 14,
      fontWeight: "600",
      color: t.textSecondary,
    },
    planFeature: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 20,
    },
    planLimit: {
      fontSize: 14,
      fontWeight: "700",
      color: t.text,
    },
    usageBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.border,
      overflow: "hidden" as const,
      ...webTransition,
    },
    usageBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: t.primary,
      ...webTransition,
    },
    tierBadge: {
      alignSelf: "flex-start" as const,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: t.primaryMuted,
    },
    tierBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      color: t.accent,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    addonCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      ...webTransition,
    },
    addonInfo: {
      flex: 1,
      gap: 2,
    },
    addonName: {
      fontSize: 15,
      fontWeight: "700",
      color: t.text,
    },
    addonPrice: {
      fontSize: 13,
      color: t.textSecondary,
    },
    lockedOverlay: {
      padding: 24,
      borderRadius: 20,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center" as const,
      gap: 12,
      ...webGlass,
      ...webTransition,
    },
    lockedIcon: {
      fontSize: 36,
    },
    lockedText: {
      fontSize: 15,
      color: t.textSecondary,
      textAlign: "center" as const,
    },
    analyticsValue: {
      fontSize: 32,
      fontWeight: "900",
      color: t.text,
    },
    analyticsLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: t.accent,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    barChartRow: {
      flexDirection: "row" as const,
      alignItems: "flex-end" as const,
      gap: 8,
      height: 120,
    },
    barChartBar: {
      flex: 1,
      borderRadius: 6,
      backgroundColor: t.primary,
      minHeight: 4,
      ...webTransition,
    },
    barChartLabel: {
      fontSize: 10,
      color: t.textSecondary,
      textAlign: "center" as const,
      marginTop: 4,
    },
    navChips: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
      marginBottom: 4,
    },
  });
}

// ─── Constants ──────────────────────────────────────────────────────────────

const initialPaymentForm: InitiatePaymentInput = {
  bank_account_id: 0,
  rent_month: "",
  amount: "",
};

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  // Theme
  const [isDark, setIsDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [fontsLoaded] = useFonts({ ModernAntiqua_400Regular });
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= 1180;
  const isMediumWeb = Platform.OS === "web" && width >= 760;

  useEffect(() => {
    AsyncStorage.getItem("theme").then((stored) => {
      if (stored) {
        setIsDark(stored === "dark");
      } else {
        const sys = Appearance?.getColorScheme?.();
        if (sys === "dark") setIsDark(true);
      }
      setThemeReady(true);
    });
  }, []);

  const t = isDark ? darkTheme : lightTheme;
  const styles = useMemo(() => makeStyles(t, isWideWeb, isMediumWeb), [t, isWideWeb, isMediumWeb]);
  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }, []);
  const themeCtx = useMemo(() => ({ t, s: styles, toggle: toggleTheme }), [t, styles, toggleTheme]);

  // Auth state
  const [authScreen, setAuthScreen] = useState<"login" | "signup">("login");
  const [loginRole, setLoginRole] = useState<"landlord" | "tenant">("landlord");
  const [username, setUsername] = useState("owner");
  const [loginEmail, setLoginEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("owner123");
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
  const firebaseLandlordAuthEnabled = isFirebaseLandlordAuthEnabled();
  const [message, setMessage] = useState(
    firebaseLandlordAuthEnabled
      ? "Landlords use Firebase email/password. Tenants can keep using RentFlo credentials or Google."
      : "Firebase landlord auth is off. Landlords and tenants can use RentFlo credentials for now.",
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const firebaseConfigError = getFirebaseConfigError();
  const useFirebaseLandlordLogin = firebaseLandlordAuthEnabled && loginRole === "landlord";
  const useFirebaseLandlordSignup = firebaseLandlordAuthEnabled && signupRole === "landlord";

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
    if (!token || !user) return;
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

  async function handleTenantLogin() {
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

  async function handleLandlordLogin() {
    setBusy(true);
    setMessage("Signing landlord in with Firebase...");
    try {
      const configError = getFirebaseConfigError();
      if (configError) {
        throw new Error(`${configError} Add the EXPO_PUBLIC_FIREBASE_* variables to continue.`);
      }

      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), loginEmail.trim(), password);
      const idToken = await credential.user.getIdToken();
      const auth = await firebaseLandlordAuth({ id_token: idToken });
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
    setMessage(signupRole === "landlord" ? "Creating landlord account..." : "Creating account...");
    try {
      if (useFirebaseLandlordSignup) {
        const configError = getFirebaseConfigError();
        if (configError) {
          throw new Error(`${configError} Add the EXPO_PUBLIC_FIREBASE_* variables to continue.`);
        }

        const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), signupEmail.trim(), signupPassword);
        const displayName = [signupFirstName.trim(), signupLastName.trim()].filter(Boolean).join(" ");
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }

        const auth = await firebaseLandlordAuth({
          id_token: await credential.user.getIdToken(true),
          first_name: signupFirstName.trim(),
          last_name: signupLastName.trim(),
          phone: signupPhone.trim(),
        });
        startTransition(() => {
          setToken(auth.token);
          setUser(auth.user);
        });
        setMessage(`Account created! Signed in as ${auth.user.role}.`);
        return;
      }

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
        document.getElementById("g_id_signin_tmp")?.remove();
        if (auth.is_new) {
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

  async function logout() {
    try {
      if (firebaseLandlordAuthEnabled) {
        await signOutFirebase(getFirebaseAuth());
      }
    } catch (error) {
      console.error("Failed to sign out of Firebase:", error);
    }

    setToken("");
    setUser(null);
    setLandlordData(null);
    setTenantData(null);
    setLoginRole("landlord");
    setUsername("owner");
    setLoginEmail("owner@example.com");
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
    if (!tenantData) return;
    setBusy(true);
    setMessage("Launching Razorpay checkout...");
    try {
      const initiated = await initiateTenantPayment(token, paymentForm);
      const result = await launchRazorpayPayment(initiated);

      if (result.status === "cancelled") {
        await confirmTenantPayment(token, {
          order_id: initiated.order_id,
          status: "failed",
          provider_payload: { reason: "cancelled_by_user" },
        }).catch(() => {});
        setMessage("Payment was cancelled.");
        setBusy(false);
        return;
      }

      if (result.status === "failed") {
        await confirmTenantPayment(token, {
          order_id: initiated.order_id,
          status: "failed",
          provider_payment_id: result.providerPaymentId,
          provider_payload: result.providerPayload,
        }).catch(() => {});
        setMessage("Payment failed. Please try again.");
        setBusy(false);
        return;
      }

      await confirmTenantPayment(token, {
        order_id: initiated.order_id,
        status: "succeeded",
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
          ? "Mock payment recorded. Set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET for live UPI/card checkout."
          : "Payment completed via Razorpay.",
      );
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemeContext.Provider value={themeCtx}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ScrollView contentContainerStyle={styles.pageOuter}>
          <View style={styles.pageInner}>
            <View style={styles.landingGrid}>
              <View style={styles.landingMain}>
                <View style={styles.hero}>
                  <View style={styles.heroBody}>
                    <View style={styles.heroTop}>
                      <Text style={styles.eyebrow}>Cross-platform rent tracking</Text>
                      <ThemeToggle />
                    </View>
                    <Text style={[styles.title, !fontsLoaded && { fontFamily: undefined }]}>{'RentFlo'}</Text>
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
              </View>

              <View style={styles.landingAside}>
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
                        <View style={styles.roleToggle}>
                          <Text style={styles.fieldLabel}>I am signing in as</Text>
                          <View style={styles.roleOptions}>
                            <Pressable
                              style={[styles.roleOption, loginRole === "landlord" && styles.roleOptionActive]}
                              onPress={() => setLoginRole("landlord")}
                            >
                              <Text style={{ fontSize: 22, marginBottom: 2 }}>🏠</Text>
                              <Text style={[styles.roleOptionText, loginRole === "landlord" && styles.roleOptionTextActive]}>
                                Landlord
                              </Text>
                              <Text style={[styles.helper, loginRole === "landlord" && { color: "rgba(255,255,255,0.7)" }, { fontSize: 11, marginTop: 2, textAlign: "center" as const }]}>
                                {firebaseLandlordAuthEnabled ? "Firebase email & password" : "RentFlo username & password"}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[styles.roleOption, loginRole === "tenant" && styles.roleOptionActive]}
                              onPress={() => setLoginRole("tenant")}
                            >
                              <Text style={{ fontSize: 22, marginBottom: 2 }}>🔑</Text>
                              <Text style={[styles.roleOptionText, loginRole === "tenant" && styles.roleOptionTextActive]}>
                                Tenant
                              </Text>
                              <Text style={[styles.helper, loginRole === "tenant" && { color: "rgba(255,255,255,0.7)" }, { fontSize: 11, marginTop: 2, textAlign: "center" as const }]}>
                                RentFlo username & password
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.formGrid}>
                          {useFirebaseLandlordLogin ? (
                            <>
                              <Field label="Email" value={loginEmail} onChangeText={setLoginEmail} />
                              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                            </>
                          ) : (
                            <>
                              <Field label="Username" value={username} onChangeText={setUsername} />
                              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
                            </>
                          )}
                        </View>
                        <Text style={styles.helper}>
                          {loginRole === "landlord"
                            ? (
                              useFirebaseLandlordLogin
                                ? firebaseConfigError || "We authenticate with Firebase first, then connect you to your landlord workspace."
                                : "Firebase landlord auth is disabled. Use your RentFlo landlord username and password for now."
                            )
                            : "Tenants can continue using their existing RentFlo credentials."}
                        </Text>
                        <PrimaryButton
                          label={busy ? "Signing in..." : `Login as ${loginRole}`}
                          onPress={useFirebaseLandlordLogin ? handleLandlordLogin : handleTenantLogin}
                          disabled={busy || (useFirebaseLandlordLogin && !!firebaseConfigError)}
                          fullWidth
                        />
                      </>
                    ) : (
                      <>
                        <View style={styles.roleToggle}>
                          <Text style={styles.fieldLabel}>I am a</Text>
                          <View style={styles.roleOptions}>
                            <Pressable
                              style={[styles.roleOption, signupRole === "landlord" && styles.roleOptionActive]}
                              onPress={() => setSignupRole("landlord")}
                            >
                              <Text style={{ fontSize: 22, marginBottom: 2 }}>🏠</Text>
                              <Text style={[styles.roleOptionText, signupRole === "landlord" && styles.roleOptionTextActive]}>
                                Landlord
                              </Text>
                              <Text style={[styles.helper, signupRole === "landlord" && { color: "rgba(255,255,255,0.7)" }, { fontSize: 11, marginTop: 2, textAlign: "center" as const }]}>
                                Manage properties & collect rent
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[styles.roleOption, signupRole === "tenant" && styles.roleOptionActive]}
                              onPress={() => setSignupRole("tenant")}
                            >
                              <Text style={{ fontSize: 22, marginBottom: 2 }}>🔑</Text>
                              <Text style={[styles.roleOptionText, signupRole === "tenant" && styles.roleOptionTextActive]}>
                                Tenant
                              </Text>
                              <Text style={[styles.helper, signupRole === "tenant" && { color: "rgba(255,255,255,0.7)" }, { fontSize: 11, marginTop: 2, textAlign: "center" as const }]}>
                                Pay rent & track payments
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.formGrid}>
                          {!useFirebaseLandlordSignup ? (
                            <Field label="Username" value={signupUsername} onChangeText={setSignupUsername} />
                          ) : null}
                          <Field label="Email" value={signupEmail} onChangeText={setSignupEmail} />
                          <Field label="Password" value={signupPassword} onChangeText={setSignupPassword} secureTextEntry />
                          <Field label="First name" value={signupFirstName} onChangeText={setSignupFirstName} />
                          <Field label="Last name" value={signupLastName} onChangeText={setSignupLastName} />
                          <Field label="Phone" value={signupPhone} onChangeText={setSignupPhone} keyboardType="phone-pad" />
                        </View>
                        <Text style={styles.helper}>
                          {signupRole === "landlord"
                            ? (
                              useFirebaseLandlordSignup
                                ? firebaseConfigError || "We will create your Firebase login and connect it to a landlord account in RentFlo."
                                : "Firebase landlord auth is disabled. Landlord accounts will be created directly in RentFlo for now."
                            )
                            : "Tenant accounts are created directly in RentFlo."}
                        </Text>
                        <PrimaryButton
                          label={busy ? "Creating account..." : `Create ${signupRole} account`}
                          onPress={handleSignup}
                          disabled={busy || (useFirebaseLandlordSignup && !!firebaseConfigError)}
                          fullWidth
                        />
                      </>
                    )}

                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <PrimaryButton label="Continue with Google" onPress={handleGoogleLogin} disabled={busy} variant="google" fullWidth />
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
                  {busy ? <ActivityIndicator color={t.accent} /> : null}
                  <Text style={styles.bannerText}>{message}</Text>
                </View>
              </View>
            </View>

            {user?.role === "landlord" && landlordData ? (
              <LandlordView
                data={landlordData}
                token={token}
                onRefresh={async () => {
                  const data = await fetchLandlordDashboard(token);
                  setLandlordData(data);
                }}
              />
            ) : null}
            {user?.role === "tenant" && tenantData ? (
              tenantData.tenancy ? (
                <TenantView
                  user={user}
                  data={tenantData as TenantDashboard & { tenancy: NonNullable<TenantDashboard["tenancy"]> }}
                  paymentForm={paymentForm}
                  setPaymentForm={setPaymentForm}
                  onSubmit={handleTenantPayment}
                  busy={busy}
                  token={token}
                />
              ) : (
                <TenantWelcome user={user} />
              )
            ) : null}

            <RolePicker onSelect={handleRoleSelect} busy={busy} visible={showRolePicker && !!user} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ThemeToggle() {
  const { t, s, toggle } = useT();
  return (
    <Pressable onPress={toggle} style={s.themeToggle}>
      <Text style={s.themeToggleIcon}>{t.mode === "dark" ? "☀️" : "🌙"}</Text>
    </Pressable>
  );
}

function LandlordView({ data, token, onRefresh }: { data: LandlordDashboard; token: string; onRefresh: () => void }) {
  const { t, s: styles } = useT();
  type FormType = null | "building" | "unit" | "bank" | "tenancy";
  type ScreenType = "dashboard" | "plans" | "analytics" | "delinquency" | "cashflow" | "roi" | "tenant-risk" | "maintenance" | "tax-report" | "onboarding" | "tickets" | "offboarding";
  type SummaryDetailType = null | "due" | "outstanding";
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [screen, setScreen] = useState<ScreenType>("dashboard");
  const [screenVisible, setScreenVisible] = useState(true);
  const [summaryDetail, setSummaryDetail] = useState<SummaryDetailType>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState<number | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const pendingScreenTransition = useRef<null | (() => void)>(null);
  const summaryDetailForDisplay = useRetainedNullableValue(summaryDetail);

  const [bName, setBName] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [uLabel, setULabel] = useState("");
  const [uRent, setURent] = useState("");
  const [bankName, setBankName] = useState("");
  const [accName, setAccName] = useState("");
  const [accNumber, setAccNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [tenantIdentifier, setTenantIdentifier] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  // Subscription data from dashboard payload
  const sub = (data as any).subscription as SubscriptionInfo | undefined;

  function openForm(form: FormType) {
    setActiveForm(activeForm === form ? null : form);
    setFormMsg("");
  }

  const transitionScreen = useCallback(
    (nextScreen: ScreenType, options?: { selectedTenancyId?: number | null }) => {
      const nextTenancyId = options?.selectedTenancyId;
      if (
        nextScreen === screen &&
        (nextTenancyId === undefined || nextTenancyId === selectedTenancyId)
      ) {
        return;
      }

      pendingScreenTransition.current = () => {
        if (nextTenancyId !== undefined) {
          setSelectedTenancyId(nextTenancyId);
        }
        setScreen(nextScreen);
      };
      setScreenVisible(false);
    },
    [screen, selectedTenancyId],
  );

  useEffect(() => {
    if (screenVisible || !pendingScreenTransition.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const applyTransition = pendingScreenTransition.current;
      pendingScreenTransition.current = null;
      applyTransition?.();
      setScreenVisible(true);
    }, PRESS_ANIMATION_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [screenVisible]);

  async function handleExportPayments(format: PaymentReportFormat) {
    setExportBusy(true);
    setExportMessage("");
    try {
      const report = await exportPayments(token, format);
      setExportMessage(`Downloaded ${report.filename}`);
      setShowExportOptions(false);
    } catch (e) {
      setExportMessage(readError(e));
    } finally {
      setExportBusy(false);
    }
  }

  const unoccupiedUnits = data.units.filter(
    (u) => !data.tenants.some((tt) => tt.unit_label === u.label && tt.building_name === u.building_name),
  );

  const isUpgradePrompt = formMsg.includes("Upgrade");
  const dueGroups = useMemo(() => {
    const grouped = new Map<string, {
      buildingName: string;
      totalDue: number;
      totalOutstanding: number;
      rows: Array<{
        id: number;
        tenantName: string;
        unitLabel: string;
        monthlyRent: number;
        paidThisMonth: number;
        balance: number;
      }>;
    }>();

    for (const tenant of data.tenants) {
      const building = grouped.get(tenant.building_name) || {
        buildingName: tenant.building_name,
        totalDue: 0,
        totalOutstanding: 0,
        rows: [],
      };
      const monthlyRent = Number(tenant.monthly_rent || 0);
      const paidThisMonth = Number(tenant.paid_this_month || 0);
      const balance = Number(tenant.balance || 0);
      building.totalDue += monthlyRent;
      building.totalOutstanding += balance;
      building.rows.push({
        id: tenant.id,
        tenantName: tenant.tenant_name,
        unitLabel: tenant.unit_label,
        monthlyRent,
        paidThisMonth,
        balance,
      });
      grouped.set(tenant.building_name, building);
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        rows: group.rows.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel) || a.tenantName.localeCompare(b.tenantName)),
      }))
      .sort((a, b) => a.buildingName.localeCompare(b.buildingName));
  }, [data.tenants]);

  const summaryGroups = summaryDetailForDisplay === "outstanding"
    ? dueGroups
        .map((group) => ({
          ...group,
          rows: group.rows.filter((row) => row.balance > 0),
        }))
        .filter((group) => group.rows.length > 0)
    : dueGroups;

  if (screen === "plans") {
    return <PlansScreen token={token} onBack={() => transitionScreen("dashboard")} onRefresh={onRefresh} visible={screenVisible} />;
  }
  if (screen === "analytics") {
    return <AnalyticsScreen token={token} onBack={() => transitionScreen("dashboard")} onNavigate={(s: any) => transitionScreen(s)} visible={screenVisible} />;
  }
  if (screen === "delinquency") {
    return <DelinquencyAnalyticsScreen token={token} onBack={() => transitionScreen("analytics")} visible={screenVisible} />;
  }
  if (screen === "cashflow") {
    return <CashFlowForecastScreen token={token} onBack={() => transitionScreen("analytics")} visible={screenVisible} />;
  }
  if (screen === "roi") {
    return <PropertyROIScreen token={token} onBack={() => transitionScreen("analytics")} visible={screenVisible} />;
  }
  if (screen === "tenant-risk") {
    return <TenantRiskScoringScreen token={token} onBack={() => transitionScreen("analytics")} visible={screenVisible} />;
  }
  if (screen === "maintenance") {
    return <MaintenanceIntelligenceScreen token={token} onBack={() => transitionScreen("analytics")} visible={screenVisible} />;
  }
  if (screen === "tax-report") {
    return <TaxComplianceReportScreen token={token} onBack={() => transitionScreen("analytics")} visible={screenVisible} />;
  }
  if (screen === "onboarding" && selectedTenancyId) {
    return <OnboardingScreen token={token} tenancyId={selectedTenancyId} isLandlord={true} onBack={() => transitionScreen("dashboard", { selectedTenancyId: null })} onRefresh={onRefresh} visible={screenVisible} />;
  }
  if (screen === "tickets") {
    return <TicketsScreen token={token} isLandlord={true} onBack={() => transitionScreen("dashboard")} visible={screenVisible} />;
  }
  if (screen === "offboarding" && selectedTenancyId) {
    return <OffboardingScreen token={token} tenancyId={selectedTenancyId} isLandlord={true} onBack={() => transitionScreen("dashboard", { selectedTenancyId: null })} onRefresh={onRefresh} visible={screenVisible} />;
  }

  return (
    <AppearOnMount visible={screenVisible}>
      <View style={styles.stack}>
      {/* Navigation chips */}
      <View style={styles.navChips}>
        <ActionChip icon="📊" label="Dashboard" active={true} onPress={() => {}} />
        <ActionChip icon="💎" label="Plans" active={false} onPress={() => transitionScreen("plans")} />
        <ActionChip icon="📈" label="Analytics" active={false} onPress={() => transitionScreen("analytics")} />
        <ActionChip icon="🎫" label="Tickets" active={false} onPress={() => transitionScreen("tickets")} />
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="Buildings" value={String(data.summary.building_count)} note={`${data.summary.unit_count} units`} />
        <SummaryCard label="Tenants" value={String(data.summary.tenant_count)} note="Active occupancies" />
        <SummaryCard
          label="Due"
          value={money(data.summary.monthly_due)}
          note={`For ${data.current_month}`}
          actionText="Tap for rent roll"
          active={summaryDetail === "due"}
          onPress={() => setSummaryDetail((current) => (current === "due" ? null : "due"))}
        />
        <SummaryCard
          label="Outstanding"
          value={money(data.summary.monthly_outstanding)}
          note={`${money(data.summary.monthly_collected)} collected`}
          actionText="Tap for due details"
          active={summaryDetail === "outstanding"}
          onPress={() => setSummaryDetail((current) => (current === "outstanding" ? null : "outstanding"))}
        />
      </View>

      <AppearOnMount visible={Boolean(summaryDetail)} unmountOnExit>
        {summaryDetailForDisplay ? (
          <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionKicker}>
                {summaryDetailForDisplay === "due" ? "Rent Roll" : "Outstanding Dues"}
              </Text>
              <Text style={styles.panelTitle}>
                {summaryDetailForDisplay === "due" ? `Due for ${data.current_month}` : "Amount yet to be received"}
              </Text>
              <Text style={styles.helper}>
                {summaryDetailForDisplay === "due"
                  ? "Grouped by building with each unit, tenant, total due, amount collected, and remaining balance."
                  : "Grouped by building with only tenants who still have an unpaid balance this month."}
              </Text>
            </View>
            <PrimaryButton label="Close" onPress={() => setSummaryDetail(null)} variant="secondary" />
          </View>

          {summaryGroups.length === 0 ? (
            <Text style={styles.helper}>No outstanding balances right now.</Text>
          ) : (
            <View style={styles.stack}>
              {summaryGroups.map((group) => (
                <View key={group.buildingName} style={styles.detailGroupCard}>
                  <View style={styles.detailGroupHeader}>
                    <Text style={styles.detailGroupTitle}>{group.buildingName}</Text>
                    <Text style={styles.detailGroupTotal}>
                      {money(summaryDetailForDisplay === "due" ? group.totalDue : group.totalOutstanding)}
                    </Text>
                  </View>
                  <View style={styles.tableLike}>
                    {group.rows.map((row) => (
                      <View key={row.id} style={styles.tableRow}>
                        <View style={styles.tableMain}>
                          <Text style={styles.rowTitle}>{row.unitLabel}</Text>
                          <Text style={styles.rowMeta}>{row.tenantName}</Text>
                        </View>
                        <View style={styles.tableNumbers}>
                          <Text style={styles.rowValue}>
                            {money(summaryDetailForDisplay === "due" ? row.monthlyRent : row.balance)}
                          </Text>
                          <Text style={styles.rowMeta}>
                            {summaryDetailForDisplay === "due"
                              ? `Paid ${money(row.paidThisMonth)} • Balance ${money(row.balance)}`
                              : `Rent ${money(row.monthlyRent)} • Paid ${money(row.paidThisMonth)}`}
                          </Text>
                        </View>
                        <StatusBadge status={row.balance > 0 ? (row.paidThisMonth > 0 ? "part_paid" : "not_paid") : "paid"} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
          </View>
        ) : null}
      </AppearOnMount>

      <View style={styles.dashboardGrid}>
        <View style={styles.dashboardMainColumn}>
          {/* Quick actions bar */}
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Manage</Text>
            <Text style={styles.panelTitle}>Quick actions</Text>
            {formMsg ? (
              <View style={[styles.banner, { marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                <Text style={[styles.bannerText, { flex: 1 }]}>{formMsg}</Text>
                {isUpgradePrompt && (
                  <Pressable
                    style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.accent, borderRadius: 4 }}
                    onPress={() => transitionScreen("plans")}
                  >
                    <Text style={{ color: t.bg, fontWeight: "700", fontSize: 12 }}>View Plans</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <ActionChip icon="🏢" label="Building" active={activeForm === "building"} onPress={() => openForm("building")} />
              <ActionChip icon="🚪" label="Unit" active={activeForm === "unit"} onPress={() => openForm("unit")} disabled={data.buildings.length === 0} />
              <ActionChip icon="🏦" label="Bank account" active={activeForm === "bank"} onPress={() => openForm("bank")} />
              <ActionChip icon="👤" label="Assign tenant" active={activeForm === "tenancy"} onPress={() => openForm("tenancy")} />
            </View>

            <AppearOnMount visible={activeForm === "building"} unmountOnExit>
              {activeForm === "building" ? (
                <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>New building</Text>
                <Field label="Name" value={bName} onChangeText={setBName} />
                <AddressSearch value={bAddress} onSelect={setBAddress} />
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
              ) : null}
            </AppearOnMount>

            <AppearOnMount visible={activeForm === "unit"} unmountOnExit>
              {activeForm === "unit" ? (
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
                    } catch (e) {
                      const err = readError(e);
                      if (err.includes("Upgrade")) {
                        setFormMsg(err);
                      } else {
                        setFormMsg(err);
                      }
                    }
                    setFormBusy(false);
                  }}
                />
                </View>
              ) : null}
            </AppearOnMount>

            <AppearOnMount visible={activeForm === "bank"} unmountOnExit>
              {activeForm === "bank" ? (
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
              ) : null}
            </AppearOnMount>

            <AppearOnMount visible={activeForm === "tenancy"} unmountOnExit>
              {activeForm === "tenancy" ? (
                <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>Assign tenant to unit</Text>
                <Text style={styles.helper}>Enter the tenant's code (e.g. RF-A3K9) or email address.</Text>
                <Field label="Tenant code or email" value={tenantIdentifier} onChangeText={setTenantIdentifier} />
                <Text style={styles.fieldLabel}>Select vacant unit</Text>
                <View style={{ gap: 6 }}>
                  {unoccupiedUnits.length === 0 ? (
                    <View style={{ gap: 10 }}>
                      <Text style={styles.helper}>All {data.units.length} units are currently occupied.</Text>
                      <PrimaryButton
                        label="+ Create a new unit first"
                        variant="secondary"
                        onPress={() => { setActiveForm("unit"); setFormMsg(""); }}
                      />
                    </View>
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
                {unoccupiedUnits.length > 0 && (
                  <PrimaryButton
                    label={formBusy ? "Assigning..." : "Assign tenant"}
                    disabled={formBusy || !tenantIdentifier.trim() || !selectedUnitId}
                    onPress={async () => {
                      setFormBusy(true);
                      try {
                        await createTenancy(token, { tenant_identifier: tenantIdentifier, unit_id: selectedUnitId! });
                        setFormMsg(`✓ Tenant assigned successfully`);
                        setTenantIdentifier(""); setSelectedUnitId(null); setActiveForm(null);
                        onRefresh();
                      } catch (e) {
                        const err = readError(e);
                        if (err.includes("Upgrade")) {
                          setFormMsg(err);
                        } else {
                          setFormMsg(err);
                        }
                      }
                      setFormBusy(false);
                    }}
                  />
                )}
                </View>
              ) : null}
            </AppearOnMount>
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
                        {tenant.building_name} / {tenant.unit_label} • <Text style={{ fontWeight: "700", color: t.accent }}>{tenant.tenant_code}</Text>
                      </Text>
                    </View>
                    <View style={styles.tableNumbers}>
                      <Text style={styles.rowValue}>{money(tenant.paid_this_month)}</Text>
                      <Text style={styles.rowMeta}>Balance {money(tenant.balance)}</Text>
                    </View>
                    <StatusBadge status={tenant.status} />
                    <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                      <Pressable
                        style={[styles.removeButton, { backgroundColor: t.primaryMuted }]}
                        onPress={() => transitionScreen("onboarding", { selectedTenancyId: tenant.id })}
                      >
                        <Text style={[styles.removeButtonText, { color: t.primary }]}>Onboard</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.removeButton, { backgroundColor: "rgba(163,95,0,0.10)" }]}
                        onPress={() => transitionScreen("offboarding", { selectedTenancyId: tenant.id })}
                      >
                        <Text style={[styles.removeButtonText, { color: "#a35f00" }]}>Offboard</Text>
                      </Pressable>
                      <Pressable
                        style={styles.removeButton}
                        onPress={async () => {
                          try {
                            await endTenancy(token, tenant.id);
                            onRefresh();
                          } catch (e) { /* ignore */ }
                        }}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.dashboardSideColumn}>
          {sub && (
            <View style={[styles.panel, { gap: 12 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.tierBadge}>
                  <Text style={styles.tierBadgeText}>{sub.tier} plan</Text>
                </View>
                {sub.tier === "free" && (
                  <Pressable onPress={() => transitionScreen("plans")}>
                    <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>Upgrade →</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: t.textSecondary, fontWeight: "600" }}>Units</Text>
                  <Text style={{ fontSize: 13, color: t.text, fontWeight: "700" }}>{sub.units_used}/{sub.max_units >= 9999 ? "∞" : sub.max_units}</Text>
                </View>
                <View style={styles.usageBar}>
                  <View style={[styles.usageBarFill, { width: `${Math.min((sub.units_used / (sub.max_units >= 9999 ? 100 : sub.max_units)) * 100, 100)}%` }]} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ fontSize: 13, color: t.textSecondary, fontWeight: "600" }}>Tenants</Text>
                  <Text style={{ fontSize: 13, color: t.text, fontWeight: "700" }}>{sub.tenants_used}/{sub.max_tenants >= 9999 ? "∞" : sub.max_tenants}</Text>
                </View>
                <View style={styles.usageBar}>
                  <View style={[styles.usageBarFill, { width: `${Math.min((sub.tenants_used / (sub.max_tenants >= 9999 ? 100 : sub.max_tenants)) * 100, 100)}%` }]} />
                </View>
              </View>
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Ledger</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.panelTitle}>Recent payments</Text>
              {sub?.has_reports && (
                <Pressable
                  style={{ padding: 8, backgroundColor: t.accent, borderRadius: 4 }}
                  onPress={() => {
                    setShowExportOptions((current) => !current);
                    setExportMessage("");
                  }}
                  disabled={exportBusy}
                >
                  <Text style={{ color: t.bg, fontWeight: "700", fontSize: 12 }}>
                    {exportBusy ? "Exporting..." : showExportOptions ? "Close" : "📥 Export"}
                  </Text>
                </Pressable>
              )}
            </View>
            {exportMessage ? (
              <Text
                style={[
                  styles.helper,
                  {
                    marginBottom: 12,
                    color: exportMessage.startsWith("Downloaded") ? t.successText : t.dangerText,
                  },
                ]}
              >
                {exportMessage}
              </Text>
            ) : null}
            <AppearOnMount visible={showExportOptions} unmountOnExit>
              {showExportOptions ? (
                <View style={[styles.banner, { marginBottom: 12 }]}>
                  <Text style={styles.bannerText}>Choose the export format for your payment report.</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <ActionChip
                      icon="📊"
                      label={exportBusy ? "Exporting..." : "Excel (.xlsx)"}
                      active={false}
                      onPress={() => handleExportPayments("excel")}
                      disabled={exportBusy}
                    />
                    <ActionChip
                      icon="📄"
                      label={exportBusy ? "Exporting..." : "PDF"}
                      active={false}
                      onPress={() => handleExportPayments("pdf")}
                      disabled={exportBusy}
                    />
                  </View>
                </View>
              ) : null}
            </AppearOnMount>
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
      </View>
      </View>
    </AppearOnMount>
  );
}

function TenantView({
  user,
  data,
  paymentForm,
  setPaymentForm,
  onSubmit,
  busy,
  token,
}: {
  user: AuthUser;
  data: TenantDashboard & { tenancy: NonNullable<TenantDashboard["tenancy"]> };
  paymentForm: InitiatePaymentInput;
  setPaymentForm: (value: InitiatePaymentInput) => void;
  onSubmit: () => void;
  busy: boolean;
  token: string;
}) {
  const { t, s: styles } = useT();
  const [tenantScreen, setTenantScreen] = useState<"dashboard" | "onboarding" | "tickets">("dashboard");
  const [tenantScreenVisible, setTenantScreenVisible] = useState(true);
  const pendingTenantScreenTransition = useRef<null | (() => void)>(null);

  const transitionTenantScreen = useCallback((nextScreen: "dashboard" | "onboarding" | "tickets") => {
    if (nextScreen === tenantScreen) {
      return;
    }
    pendingTenantScreenTransition.current = () => {
      setTenantScreen(nextScreen);
    };
    setTenantScreenVisible(false);
  }, [tenantScreen]);

  useEffect(() => {
    if (tenantScreenVisible || !pendingTenantScreenTransition.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const applyTransition = pendingTenantScreenTransition.current;
      pendingTenantScreenTransition.current = null;
      applyTransition?.();
      setTenantScreenVisible(true);
    }, PRESS_ANIMATION_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [tenantScreenVisible]);

  if (tenantScreen === "onboarding") {
    return <OnboardingScreen token={token} tenancyId={data.tenancy.id} isLandlord={false} onBack={() => transitionTenantScreen("dashboard")} onRefresh={() => {}} visible={tenantScreenVisible} />;
  }
  if (tenantScreen === "tickets") {
    return <TicketsScreen token={token} isLandlord={false} onBack={() => transitionTenantScreen("dashboard")} visible={tenantScreenVisible} />;
  }

  return (
    <AppearOnMount visible={tenantScreenVisible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="🏠" label="Dashboard" active={tenantScreen === "dashboard"} onPress={() => {}} />
        <ActionChip icon="📋" label="Onboarding" active={false} onPress={() => transitionTenantScreen("onboarding")} />
        <ActionChip icon="🎫" label="Tickets" active={false} onPress={() => transitionTenantScreen("tickets")} />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Your code" value={user.tenant_code || "—"} note="Share with landlord" />
        <SummaryCard label="Unit" value={data.tenancy.unit_label} note={data.tenancy.building_name} />
        <SummaryCard label="Monthly rent" value={money(data.tenancy.monthly_rent)} note={data.current_month} />
        <SummaryCard label="Paid" value={money(data.current_month_paid)} note="This month" />
        <SummaryCard label="Balance" value={money(data.current_month_balance)} note="Remaining" />
      </View>

      <View style={styles.dashboardGrid}>
        <View style={styles.dashboardMainColumn}>
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
            <PrimaryButton label={busy ? "Processing..." : "Pay rent"} onPress={onSubmit} disabled={busy} fullWidth />
          </View>
        </View>

        <View style={styles.dashboardSideColumn}>
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
      </View>
      </View>
    </AppearOnMount>
  );
}

// ---------------------------------------------------------------------------
// Plans & Billing screen
// ---------------------------------------------------------------------------

function PlansScreen({ token, onBack, onRefresh, visible = true }: { token: string; onBack: () => void; onRefresh: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<SubscriptionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchSubscription(token)
      .then(setSubData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleUpgrade(tier: "pro" | "business") {
    setBusy(true);
    setMsg(`Upgrading to ${tier}...`);
    try {
      const checkout = await upgradeSubscription(token, tier);
      if (checkout.mode === "mock") {
        await confirmUpgrade(token, tier);
        setMsg(`✓ Upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`);
        const refreshed = await fetchSubscription(token);
        setSubData(refreshed);
        onRefresh();
      } else {
        const result = await launchRazorpayPayment(checkout as any);
        if (result.status === "succeeded") {
          await confirmUpgrade(token, tier, result.providerPaymentId);
          setMsg(`✓ Upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`);
          const refreshed = await fetchSubscription(token);
          setSubData(refreshed);
          onRefresh();
        } else {
          setMsg("Payment cancelled or failed.");
        }
      }
    } catch (e) {
      setMsg(readError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleActivateAddOn(feature: string) {
    setBusy(true);
    setMsg(`Activating ${feature}...`);
    try {
      const checkout = await activateAddOn(token, feature);
      if (checkout.mode === "mock") {
        await confirmAddOn(token, feature);
        setMsg(`✓ ${feature.replace("_", " ")} activated!`);
        const refreshed = await fetchSubscription(token);
        setSubData(refreshed);
        onRefresh();
      } else {
        const result = await launchRazorpayPayment(checkout as any);
        if (result.status === "succeeded") {
          await confirmAddOn(token, feature, result.providerPaymentId);
          setMsg(`✓ ${feature.replace("_", " ")} activated!`);
          const refreshed = await fetchSubscription(token);
          setSubData(refreshed);
          onRefresh();
        } else {
          setMsg("Payment cancelled or failed.");
        }
      }
    } catch (e) {
      setMsg(readError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
        <ActivityIndicator color={t.accent} size="large" />
        <Text style={[styles.helper, { marginTop: 12 }]}>Loading plans...</Text>
      </View>
    );
  }

  const sub = subData?.subscription;
  const plans = subData?.plans || [];
  const addonsCatalog = subData?.addons_catalog || [];

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Dashboard" active={false} onPress={onBack} />
        <ActionChip icon="💎" label="Plans" active={true} onPress={() => {}} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Subscription</Text>
        <Text style={styles.panelTitle}>Plans & Billing</Text>
        {msg ? (
          <View style={[styles.banner, { marginBottom: 4 }]}>
            <Text style={styles.bannerText}>{msg}</Text>
          </View>
        ) : null}

        <View style={{ gap: 14 }}>
          {plans.map((plan) => {
            const isCurrent = sub?.tier === plan.tier;
            const isUpgrade =
              ({ free: 0, pro: 1, business: 2 }[plan.tier] ?? 0) >
              ({ free: 0, pro: 1, business: 2 }[sub?.tier ?? "free"] ?? 0);
            return (
              <View key={plan.tier} style={[styles.planCard, isCurrent && styles.planCardActive]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {isCurrent && (
                    <View style={styles.tierBadge}>
                      <Text style={styles.tierBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                  <Text style={styles.planPrice}>
                    {plan.price_monthly === 0 ? "Free" : `₹${plan.price_monthly}`}
                  </Text>
                  {plan.price_monthly > 0 && <Text style={styles.planPriceSuffix}>/month</Text>}
                </View>
                <Text style={styles.planLimit}>
                  {plan.max_units >= 9999 ? "Unlimited" : `Up to ${plan.max_units}`} units • {plan.max_tenants >= 9999 ? "Unlimited" : `Up to ${plan.max_tenants}`} tenants
                </Text>
                {plan.features.length > 0 && (
                  <View style={{ gap: 2 }}>
                    {plan.features.map((f) => (
                      <Text key={f} style={styles.planFeature}>✓ {f}</Text>
                    ))}
                  </View>
                )}
                {isUpgrade && (
                  <PrimaryButton
                    label={busy ? "Processing..." : `Upgrade to ${plan.name}`}
                    onPress={() => handleUpgrade(plan.tier as "pro" | "business")}
                    disabled={busy}
                    fullWidth
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Add-ons section */}
      <View style={styles.panel}>
        <Text style={styles.sectionKicker}>Add-ons</Text>
        <Text style={styles.panelTitle}>Premium tools</Text>
        <Text style={styles.helper}>Purchase individual tools to enhance your experience.</Text>
        <View style={{ gap: 10-2 }}>
          {addonsCatalog.map((addon) => {
            const active = addon.is_active || addon.included_in_tier;
            return (
              <View key={addon.feature} style={styles.addonCard}>
                <Text style={{ fontSize: 24 }}>{addon.feature === "analytics" ? "📈" : "📥"}</Text>
                <View style={styles.addonInfo}>
                  <Text style={styles.addonName}>{addon.name}</Text>
                  <Text style={styles.addonPrice}>
                    {addon.included_in_tier
                      ? "Included in your plan"
                      : active
                        ? "Active"
                        : `₹${addon.price_monthly}/month`}
                  </Text>
                </View>
                {!active && (
                  <PrimaryButton
                    label={busy ? "..." : "Activate"}
                    onPress={() => handleActivateAddOn(addon.feature)}
                    disabled={busy}
                  />
                )}
                {active && (
                  <View style={[styles.badge, styles.goodBadge]}>
                    <Text style={styles.badgeText}>Active</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
      </View>
    </AppearOnMount>
  );
}

// ---------------------------------------------------------------------------
// Analytics screen (premium)
// ---------------------------------------------------------------------------

function AnalyticsScreen({ token, onBack, onNavigate, visible = true }: { token: string; onBack: () => void; onNavigate?: (screen: string) => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchAnalytics(token)
      .then((data) => {
        setAnalyticsData(data);
        setLocked(false);
      })
      .catch((e) => {
        const err = readError(e);
        if (err.includes("Analytics requires") || err.includes("add-on")) {
          setLocked(true);
        } else {
          setMsg(err);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Dashboard" active={false} onPress={onBack} />
        <ActionChip icon="📈" label="Analytics" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : locked ? (
        <View style={styles.lockedOverlay}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={[styles.panelTitle, { textAlign: "center" }]}>Analytics Dashboard</Text>
          <Text style={styles.lockedText}>
            The analytics dashboard requires the Pro plan or the Analytics add-on.
          </Text>
          <PrimaryButton label="View Plans" onPress={onBack} />
        </View>
      ) : analyticsData ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Insights</Text>
            <Text style={styles.panelTitle}>Analytics Dashboard</Text>
            {msg ? <Text style={styles.helper}>{msg}</Text> : null}
          </View>

          {/* Key metrics */}
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Occupancy rate"
              value={`${analyticsData.occupancy_rate}%`}
              note={`${analyticsData.occupied_units}/${analyticsData.total_units} units`}
            />
            <SummaryCard
              label="Collection rate"
              value={`${analyticsData.collection_rate}%`}
              note={`${analyticsData.current_month}`}
            />
            <SummaryCard
              label="Monthly due"
              value={money(analyticsData.monthly_due)}
              note={analyticsData.current_month}
            />
            <SummaryCard
              label="Collected"
              value={money(analyticsData.monthly_collected)}
              note={analyticsData.current_month}
            />
          </View>

          {/* Premium analytics drilldowns */}
          <View style={styles.panel}>
            <Text style={[styles.analyticsLabel, { marginBottom: 12 }]}>Deep Dive Analytics</Text>
            <View style={{ gap: 8 }}>
              <Pressable
                style={[styles.actionChip, { paddingHorizontal: 12, paddingVertical: 10, width: "100%" }]}
                onPress={() => onNavigate?.("delinquency")}
              >
                <Text style={{ fontSize: 14 }}>⚠️ Delinquency & Collections</Text>
              </Pressable>
              <Pressable
                style={[styles.actionChip, { paddingHorizontal: 12, paddingVertical: 10, width: "100%" }]}
                onPress={() => onNavigate?.("cashflow")}
              >
                <Text style={{ fontSize: 14 }}>💰 Cash Flow Forecasting</Text>
              </Pressable>
              <Pressable
                style={[styles.actionChip, { paddingHorizontal: 12, paddingVertical: 10, width: "100%" }]}
                onPress={() => onNavigate?.("roi")}
              >
                <Text style={{ fontSize: 14 }}>🏆 Property ROI Analysis</Text>
              </Pressable>
              <Pressable
                style={[styles.actionChip, { paddingHorizontal: 12, paddingVertical: 10, width: "100%" }]}
                onPress={() => onNavigate?.("tenant-risk")}
              >
                <Text style={{ fontSize: 14 }}>👥 Tenant Risk Scoring</Text>
              </Pressable>
              <Pressable
                style={[styles.actionChip, { paddingHorizontal: 12, paddingVertical: 10, width: "100%" }]}
                onPress={() => onNavigate?.("maintenance")}
              >
                <Text style={{ fontSize: 14 }}>🔧 Maintenance Intelligence</Text>
              </Pressable>
              <Pressable
                style={[styles.actionChip, { paddingHorizontal: 12, paddingVertical: 10, width: "100%" }]}
                onPress={() => onNavigate?.("tax-report")}
              >
                <Text style={{ fontSize: 14 }}>📋 Tax Compliance Reports</Text>
              </Pressable>
            </View>
          </View>

          {/* Revenue trend bar chart */}
          <View style={styles.panel}>
            <Text style={styles.analyticsLabel}>Revenue trend (last 6 months)</Text>
            {(() => {
              const maxVal = Math.max(
                ...analyticsData.revenue_trend.map((r) => Number(r.collected)),
                1,
              );
              return (
                <>
                  <View style={styles.barChartRow}>
                    {analyticsData.revenue_trend.map((r) => {
                      const pct = (Number(r.collected) / maxVal) * 100;
                      return (
                        <View key={r.month} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                          <View
                            style={[
                              styles.barChartBar,
                              { height: `${Math.max(pct, 3)}%`, flex: 0, width: "100%" },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {analyticsData.revenue_trend.map((r) => (
                      <View key={r.month} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={styles.barChartLabel}>{r.month.slice(5)}</Text>
                        <Text style={[styles.barChartLabel, { fontWeight: "700", color: t.text }]}>
                          {money(r.collected)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              );
            })()}
          </View>

          {/* Top paying tenants */}
          <View style={styles.panel}>
            <Text style={styles.analyticsLabel}>Top tenants by payment</Text>
            <View style={styles.tableLike}>
              {analyticsData.top_tenants.map((tenant, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={styles.tableMain}>
                    <Text style={styles.rowTitle}>{tenant.name}</Text>
                  </View>
                  <View style={styles.tableNumbers}>
                    <Text style={styles.rowValue}>{money(tenant.total_paid)}</Text>
                    <Text style={styles.rowMeta}>total paid</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg || "Unable to load analytics."}</Text>
        </View>
      )}
      </View>
    </AppearOnMount>
  );
}

function RolePicker({ onSelect, busy, visible = true }: { onSelect: (role: "landlord" | "tenant") => void; busy: boolean; visible?: boolean }) {
  const { s: styles } = useT();
  return (
    <AppearOnMount visible={visible} unmountOnExit>
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
    </AppearOnMount>
  );
}

function TenantWelcome({ user }: { user: AuthUser }) {
  const { t, s: styles } = useT();
  return (
    <AppearOnMount>
      <View style={styles.panel}>
      <Text style={styles.sectionKicker}>Almost there</Text>
      <Text style={styles.panelTitle}>Welcome, {user.first_name || user.username}!</Text>
      <Text style={styles.helper}>
        Your account is set up, but your landlord hasn't assigned you to a unit yet.
      </Text>

      <View style={[styles.summaryCard, { alignItems: "center", paddingVertical: 20 }]}>
        <Text style={styles.summaryLabel}>Your Tenant Code</Text>
        <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: 2, color: t.accent, marginTop: 8 }}>
          {user.tenant_code}
        </Text>
        <Text style={[styles.helper, { marginTop: 6, textAlign: "center" }]}>
          Share this code with your landlord so they can link you to your unit.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>What to do</Text>
        <Text style={[styles.helper, { marginTop: 8 }]}>1. Share your code <Text style={{ fontWeight: "700" }}>{user.tenant_code}</Text> with your landlord</Text>
        <Text style={styles.helper}>2. They'll enter the code and assign a unit</Text>
        <Text style={styles.helper}>3. Refresh this page to see your dashboard</Text>
      </View>
      </View>
    </AppearOnMount>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "phone-pad" | "number-pad";
  placeholder?: string;
}) {
  const { t, s: styles } = useT();
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
        placeholder={props.placeholder}
        placeholderTextColor={t.textSecondary}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// OSM Nominatim address search + current-location reverse geocode
// ---------------------------------------------------------------------------
type NominatimResult = { place_id: number; display_name: string; lat: string; lon: string };

function AddressSearch({ value, onSelect }: { value: string; onSelect: (address: string) => void }) {
  const { t, s: styles } = useT();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (text: string) => {
    if (text.length < 3) { setResults([]); return; }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, { headers: { "User-Agent": "RentFlo/1.0" } });
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch { setResults([]); }
  }, []);

  function handleChangeText(text: string) {
    setQuery(text);
    onSelect(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  }

  function pickResult(r: NominatimResult) {
    setQuery(r.display_name);
    onSelect(r.display_name);
    setOpen(false);
    setResults([]);
  }

  async function useCurrentLocation() {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
            const res = await fetch(url, { headers: { "User-Agent": "RentFlo/1.0" } });
            const data = await res.json();
            const addr = data.display_name || `${pos.coords.latitude}, ${pos.coords.longitude}`;
            setQuery(addr);
            onSelect(addr);
          } catch {
            const fallback = `${pos.coords.latitude}, ${pos.coords.longitude}`;
            setQuery(fallback);
            onSelect(fallback);
          } finally { setLocating(false); }
        },
        () => { setLocating(false); },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Address</Text>
      <View style={{ position: "relative" as const }}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder="Search address or area..."
          placeholderTextColor={t.textSecondary}
          autoCapitalize="none"
        />
        {open && results.length > 0 && (
          <View style={styles.addressDropdown}>
            {results.map((r) => (
              <Pressable key={r.place_id} style={styles.addressItem} onPress={() => pickResult(r)}>
                <Text style={styles.addressItemIcon}>📍</Text>
                <Text style={styles.addressItemText} numberOfLines={2}>{r.display_name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Pressable
        style={styles.locationButton}
        onPress={useCurrentLocation}
        disabled={locating}
      >
        <Text style={{ fontSize: 14 }}>{locating ? "⏳" : "📍"}</Text>
        <Text style={styles.locationButtonText}>{locating ? "Locating..." : "Use current location"}</Text>
      </Pressable>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  note,
  actionText,
  active = false,
  onPress,
}: {
  label: string;
  value: string;
  note: string;
  actionText?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { s: styles } = useT();
  const content = (
    <>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryNote}>{note}</Text>
      {actionText ? <Text style={styles.summaryActionText}>{actionText}</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.summaryCard, styles.summaryCardInteractive, active && styles.summaryCardActive]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.summaryCard, active && styles.summaryCardActive]}>
      {content}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { s: styles } = useT();
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
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "google";
  fullWidth?: boolean;
}) {
  const { s: styles } = useT();
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
      style={[
        styles.button,
        variantStyle,
        fullWidth && { alignSelf: "stretch" as const },
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

function ActionChip({ icon, label, active, onPress, disabled }: { icon: string; label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  const { s: styles } = useT();
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

// ============================================================================
// PREMIUM ANALYTICS DETAIL SCREENS
// ============================================================================

function DelinquencyAnalyticsScreen({ token, onBack, visible = true }: { token: string; onBack: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchDelinquencyAnalytics(token)
      .then(setData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Analytics" active={false} onPress={onBack} />
        <ActionChip icon="⚠️" label="Delinquency" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : msg ? (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg}</Text>
        </View>
      ) : data ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Insights</Text>
            <Text style={styles.panelTitle}>Delinquency & Collection Intelligence</Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard label="At Risk" value={`${data.delinquent_count}`} note="overdue units" />
            <SummaryCard label="Total Overdue" value={money(data.total_delinquent)} note="amount" />
            <SummaryCard label="Collection Rate" value={`${data.collection_effectiveness.toFixed(1)}%`} note="effectiveness" />
          </View>

          {data.overdue_90_days.length > 0 && (
            <View style={styles.panel}>
              <Text style={[styles.analyticsLabel, { color: t.danger }]}>90+ Days Overdue</Text>
              <View style={styles.tableLike}>
                {data.overdue_90_days.map((item: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <View style={styles.tableMain}>
                      <Text style={styles.rowTitle}>{item.tenant}</Text>
                      <Text style={styles.rowMeta}>{item.unit}</Text>
                    </View>
                    <View style={styles.tableNumbers}>
                      <Text style={[styles.rowValue, { color: t.danger }]}>{item.days_overdue}d</Text>
                      <Text style={styles.rowMeta}>{money(item.amount)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {data.overdue_60_days.length > 0 && (
            <View style={styles.panel}>
              <Text style={[styles.analyticsLabel, { color: t.warning }]}>60+ Days Overdue</Text>
              <View style={styles.tableLike}>
                {data.overdue_60_days.map((item: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <View style={styles.tableMain}>
                      <Text style={styles.rowTitle}>{item.tenant}</Text>
                      <Text style={styles.rowMeta}>{item.unit}</Text>
                    </View>
                    <View style={styles.tableNumbers}>
                      <Text style={[styles.rowValue, { color: t.warning }]}>{item.days_overdue}d</Text>
                      <Text style={styles.rowMeta}>{money(item.amount)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {data.overdue_30_days.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.analyticsLabel}>30+ Days Overdue</Text>
              <View style={styles.tableLike}>
                {data.overdue_30_days.map((item: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <View style={styles.tableMain}>
                      <Text style={styles.rowTitle}>{item.tenant}</Text>
                      <Text style={styles.rowMeta}>{item.unit}</Text>
                    </View>
                    <View style={styles.tableNumbers}>
                      <Text style={styles.rowValue}>{item.days_overdue}d</Text>
                      <Text style={styles.rowMeta}>{money(item.amount)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      ) : null}
      </View>
    </AppearOnMount>
  );
}

function CashFlowForecastScreen({ token, onBack, visible = true }: { token: string; onBack: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchCashFlowForecast(token)
      .then(setData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Analytics" active={false} onPress={onBack} />
        <ActionChip icon="💰" label="Cash Flow" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : msg ? (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg}</Text>
        </View>
      ) : data?.forecast ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Forecast</Text>
            <Text style={styles.panelTitle}>6-Month Cash Flow Projection</Text>
          </View>

          {(() => {
            const maxVal = Math.max(...data.forecast.map((m: any) => m.expected_collection), 1);
            return (
              <>
                <View style={styles.barChartRow}>
                  {data.forecast.map((m: any) => {
                    const pct = (m.expected_collection / maxVal) * 100;
                    return (
                      <View key={m.month} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                        <View style={[styles.barChartBar, { height: `${Math.max(pct, 3)}%` }]} />
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {data.forecast.map((m: any) => (
                    <View key={m.month} style={{ flex: 1, alignItems: "center" }}>
                      <Text style={styles.barChartLabel}>{m.month.slice(5)}</Text>
                      <Text style={[styles.barChartLabel, { fontWeight: "700", color: t.text }]}>
                        {money(m.expected_collection)}
                      </Text>
                      <Text style={[styles.barChartLabel, { fontSize: 10, color: t.textSecondary }]}>
                        {m.confidence}% confidence
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            );
          })()}
        </>
      ) : null}
      </View>
    </AppearOnMount>
  );
}

function PropertyROIScreen({ token, onBack, visible = true }: { token: string; onBack: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchPropertyROI(token)
      .then(setData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Analytics" active={false} onPress={onBack} />
        <ActionChip icon="🏆" label="ROI Analysis" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : msg ? (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg}</Text>
        </View>
      ) : data?.properties ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Performance</Text>
            <Text style={styles.panelTitle}>Property ROI & Metrics</Text>
          </View>

          <View style={styles.tableLike}>
            {data.properties.map((prop: any, i: number) => (
              <View key={i} style={styles.panel}>
                <Text style={styles.rowTitle}>{prop.property}</Text>
                <View style={{ marginTop: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.rowMeta}>Collected</Text>
                    <Text style={styles.rowValue}>{money(prop.total_collected)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.rowMeta}>Maintenance cost</Text>
                    <Text style={styles.rowValue}>{money(prop.maintenance_cost)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: t.border }}>
                    <Text style={[styles.rowMeta, { fontWeight: "700" }]}>Net income</Text>
                    <Text style={[styles.rowValue, { fontWeight: "700", color: prop.net_income > 0 ? t.success : t.danger }]}>
                      {money(prop.net_income)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                    <Text style={styles.rowMeta}>Occupancy</Text>
                    <Text style={styles.rowValue}>{prop.occupancy_rate.toFixed(0)}% ({prop.units} units)</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
      </View>
    </AppearOnMount>
  );
}

function TenantRiskScoringScreen({ token, onBack, visible = true }: { token: string; onBack: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchTenantRiskScoring(token)
      .then(setData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  function getRiskColor(level: string) {
    if (level === "low") return t.success;
    if (level === "medium") return t.warning;
    return t.danger;
  }

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Analytics" active={false} onPress={onBack} />
        <ActionChip icon="👥" label="Tenant Risk" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : msg ? (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg}</Text>
        </View>
      ) : data?.tenants ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Reliability</Text>
            <Text style={styles.panelTitle}>Tenant Risk Scoring</Text>
          </View>

          <View style={styles.tableLike}>
            {data.tenants.map((tenant: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <View style={styles.tableMain}>
                  <Text style={styles.rowTitle}>{tenant.tenant}</Text>
                  <Text style={styles.rowMeta}>{tenant.unit}</Text>
                </View>
                <View style={styles.tableNumbers}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Text style={[styles.rowValue, { color: getRiskColor(tenant.risk_level) }]}>
                      {tenant.payment_reliability}%
                    </Text>
                    <View style={[styles.badge, { backgroundColor: getRiskColor(tenant.risk_level) + "20" }]}>
                      <Text style={[styles.badgeText, { color: getRiskColor(tenant.risk_level) }]}>
                        {tenant.risk_level}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowMeta}>{tenant.on_time_payments} on-time, {tenant.late_payments} late</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
      </View>
    </AppearOnMount>
  );
}

function MaintenanceIntelligenceScreen({ token, onBack, visible = true }: { token: string; onBack: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchMaintenanceIntelligence(token)
      .then(setData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Analytics" active={false} onPress={onBack} />
        <ActionChip icon="🔧" label="Maintenance" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : msg ? (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg}</Text>
        </View>
      ) : data ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Insights</Text>
            <Text style={styles.panelTitle}>Maintenance Intelligence</Text>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Total Spending"
              value={money(data.total_maintenance)}
              note="all maintenance"
            />
            <SummaryCard
              label="Preventative"
              value={`${data.preventative_percentage}%`}
              note={`${data.preventative_count} tasks`}
            />
            <SummaryCard
              label="Reactive"
              value={`${(100 - data.preventative_percentage).toFixed(1)}%`}
              note={`${data.reactive_count} tasks`}
            />
          </View>

          {data.top_costs?.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.analyticsLabel}>Top Maintenance Items</Text>
              <View style={styles.tableLike}>
                {data.top_costs.map((item: any, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.rowTitle}>{item.description}</Text>
                    <Text style={styles.rowValue}>{money(item.total)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      ) : null}
      </View>
    </AppearOnMount>
  );
}

function TaxComplianceReportScreen({ token, onBack, visible = true }: { token: string; onBack: () => void; visible?: boolean }) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchTaxComplianceReport(token)
      .then(setData)
      .catch((e) => setMsg(readError(e)))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Analytics" active={false} onPress={onBack} />
        <ActionChip icon="📋" label="Tax Report" active={true} onPress={() => {}} />
      </View>

      {loading ? (
        <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      ) : msg ? (
        <View style={styles.panel}>
          <Text style={styles.helper}>{msg}</Text>
        </View>
      ) : data ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Filing Ready</Text>
            <Text style={styles.panelTitle}>Tax Compliance P&L</Text>
          </View>

          <View style={styles.panel}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={styles.rowTitle}>Gross Income</Text>
              <Text style={[styles.rowValue, { color: t.success }]}>{money(data.gross_income)}</Text>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12 }}>
              <Text style={[styles.rowMeta, { marginBottom: 12, fontWeight: "600" }]}>Expenses Breakdown</Text>
              {Object.entries(data.expenses).map(([cat, amount]: [string, any]) => (
                <View key={cat} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={styles.rowMeta}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                  <Text style={styles.rowValue}>{money(amount)}</Text>
                </View>
              ))}
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: t.border, marginTop: 12, paddingTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.rowTitle, { fontWeight: "700" }]}>Total Expenses</Text>
                <Text style={[styles.rowValue, { fontWeight: "700" }]}>{money(data.total_expenses)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={[styles.rowTitle, { fontWeight: "700" }]}>Net Profit</Text>
                <Text style={[styles.rowValue, { fontWeight: "700", color: data.net_profit > 0 ? t.success : t.danger }]}>
                  {money(data.net_profit)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={styles.rowMeta}>Profit Margin</Text>
                <Text style={[styles.rowValue, { color: t.accent }]}>{data.profit_margin}%</Text>
              </View>
            </View>
          </View>
        </>
      ) : null}
      </View>
    </AppearOnMount>
  );
}

// ─── Onboarding Screen ──────────────────────────────────────────────────────

function OnboardingScreen({
  token,
  tenancyId,
  isLandlord,
  onBack,
  onRefresh,
  visible = true,
}: {
  token: string;
  tenancyId: number;
  isLandlord: boolean;
  onBack: () => void;
  onRefresh: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OnboardingStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state
  const [docType, setDocType] = useState<string>("aadhar");
  const [docNumber, setDocNumber] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [agreementFee, setAgreementFee] = useState("");
  const [agreementDocUrl, setAgreementDocUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchOnboardingStatus(token, tenancyId);
      setData(d);
    } catch (e) {
      setMsg(readError(e));
    } finally {
      setLoading(false);
    }
  }, [token, tenancyId]);

  useEffect(() => { void load(); }, [load]);

  const statusSteps = [
    { key: "pending_documents", label: "Upload Documents" },
    { key: "pending_deposit", label: "Pay Deposit" },
    { key: "pending_agreement", label: "Sign Agreement" },
    { key: "pending_first_rent", label: "Pay First Rent" },
    { key: "completed", label: "Completed" },
  ];

  const currentStepIndex = data ? statusSteps.findIndex((s) => s.key === data.onboarding_status) : 0;

  async function handleUploadDoc() {
    setBusy(true);
    setMsg("");
    try {
      await uploadDocument(token, tenancyId, { doc_type: docType, doc_number: docNumber, file_url: docFileUrl || undefined });
      setMsg("Document uploaded.");
      setDocNumber("");
      setDocFileUrl("");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleVerifyDoc(docId: number) {
    setBusy(true);
    try {
      await verifyDocument(token, tenancyId, docId);
      setMsg("Document verified.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleCreateDeposit() {
    setBusy(true);
    setMsg("");
    try {
      await createDeposit(token, { tenancy_id: tenancyId, amount: depositAmount });
      setMsg("Deposit configured.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handlePayDeposit() {
    setBusy(true);
    try {
      await payDeposit(token, tenancyId);
      setMsg("Deposit marked as paid.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleCreateAgreement() {
    setBusy(true);
    setMsg("");
    try {
      await createAgreement(token, { tenancy_id: tenancyId, agreement_fee: agreementFee, document_url: agreementDocUrl || undefined });
      setMsg("Agreement created.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleSignAgreement() {
    setBusy(true);
    try {
      await signAgreement(token, tenancyId);
      setMsg("Agreement signed.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Back" active={false} onPress={onBack} />
        <ActionChip icon="📋" label="Onboarding" active={true} onPress={() => {}} />
      </View>
      <Text style={styles.panelTitle}>Tenant Onboarding</Text>
      {data && <Text style={styles.helper}>{data.tenant_name} • {data.building_name} / {data.unit_label}</Text>}

      {loading ? <ActivityIndicator color={t.accent} /> : null}
      {msg ? <Text style={[styles.helper, { marginTop: 8 }]}>{msg}</Text> : null}

      {data && (
        <>
          {/* Progress steps */}
          <View style={[styles.panel, { marginTop: 16 }]}>
            <Text style={styles.sectionKicker}>Progress</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {statusSteps.map((step, i) => (
                <View
                  key={step.key}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                    backgroundColor: i < currentStepIndex ? t.success : i === currentStepIndex ? t.primaryMuted : t.border,
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: "600",
                    color: i < currentStepIndex ? t.successText : i === currentStepIndex ? t.primary : t.textSecondary,
                  }}>
                    {i < currentStepIndex ? "✓ " : ""}{step.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Step 1: Documents */}
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Step 1</Text>
            <Text style={styles.panelTitle}>ID & Work Proof</Text>
            {data.documents.length > 0 && (
              <View style={styles.tableLike}>
                {data.documents.map((doc) => (
                  <View key={doc.id} style={styles.tableRow}>
                    <View style={styles.tableMain}>
                      <Text style={styles.rowTitle}>{doc.doc_type.replace("_", " ").toUpperCase()}</Text>
                      <Text style={styles.rowMeta}>{doc.doc_number || "No number"}</Text>
                    </View>
                    <StatusBadge status={doc.verified ? "verified" : "pending"} />
                    {isLandlord && !doc.verified && (
                      <Pressable style={[styles.removeButton, { backgroundColor: t.success }]} onPress={() => handleVerifyDoc(doc.id)}>
                        <Text style={[styles.removeButtonText, { color: t.successText }]}>Verify</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
            <View style={styles.formGrid}>
              <View>
                <Text style={styles.fieldLabel}>Document type</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {(["aadhar", "pan", "work_proof", "student_proof"] as const).map((dt) => (
                    <Pressable
                      key={dt}
                      onPress={() => setDocType(dt)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: docType === dt ? t.primary : t.inputBg, borderWidth: 1, borderColor: docType === dt ? t.primary : t.inputBorder }}
                    >
                      <Text style={{ color: docType === dt ? t.primaryText : t.text, fontSize: 12, fontWeight: "600" }}>{dt.replace("_", " ").toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Field label="Document number" value={docNumber} onChangeText={setDocNumber} placeholder="e.g. XXXX-XXXX-XXXX" />
              <Field label="File URL (optional)" value={docFileUrl} onChangeText={setDocFileUrl} placeholder="https://..." />
            </View>
            <PrimaryButton label={busy ? "Uploading..." : "Upload Document"} onPress={handleUploadDoc} disabled={busy} fullWidth />
          </View>

          {/* Step 2: Deposit */}
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Step 2</Text>
            <Text style={styles.panelTitle}>Security Deposit (Refundable)</Text>
            {data.deposit ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.rowValue}>{money(data.deposit.amount)}</Text>
                <StatusBadge status={data.deposit.status} />
                {data.deposit.status === "pending" && (
                  <PrimaryButton label={busy ? "Processing..." : "Mark Deposit Paid"} onPress={handlePayDeposit} disabled={busy} fullWidth />
                )}
              </View>
            ) : isLandlord ? (
              <View style={styles.formGrid}>
                <Field label="Deposit amount" value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" placeholder="e.g. 25000" />
                <PrimaryButton label={busy ? "Saving..." : "Set Deposit"} onPress={handleCreateDeposit} disabled={busy} fullWidth />
              </View>
            ) : <Text style={styles.helper}>Waiting for landlord to set deposit amount.</Text>}
          </View>

          {/* Step 3: Agreement */}
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Step 3</Text>
            <Text style={styles.panelTitle}>Rental Agreement</Text>
            <Text style={styles.helper}>Agreement fees to be paid by tenant</Text>
            {data.agreement ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.rowMeta}>Fee: {money(data.agreement.agreement_fee)} • {data.agreement.fee_paid ? "Paid" : "Unpaid"}</Text>
                <StatusBadge status={data.agreement.status.replace("_", " ")} />
                {data.agreement.document_url ? <Text style={[styles.rowMeta, { marginTop: 4 }]}>Doc: {data.agreement.document_url}</Text> : null}
                {data.agreement.status === "pending_signature" && (
                  <PrimaryButton label={busy ? "Signing..." : "Sign Agreement & Pay Fee"} onPress={handleSignAgreement} disabled={busy} fullWidth />
                )}
              </View>
            ) : isLandlord ? (
              <View style={styles.formGrid}>
                <Field label="Agreement fee" value={agreementFee} onChangeText={setAgreementFee} keyboardType="numeric" placeholder="e.g. 2000" />
                <Field label="Document URL (optional)" value={agreementDocUrl} onChangeText={setAgreementDocUrl} placeholder="https://..." />
                <PrimaryButton label={busy ? "Creating..." : "Create Agreement"} onPress={handleCreateAgreement} disabled={busy} fullWidth />
              </View>
            ) : <Text style={styles.helper}>Waiting for landlord to create agreement.</Text>}
          </View>

          {/* Step 4: First Rent */}
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Step 4</Text>
            <Text style={styles.panelTitle}>First Month Rent</Text>
            <Text style={styles.helper}>
              {data.onboarding_status === "pending_first_rent"
                ? "Pay your first month's rent via Card / UPI / Cash from the dashboard."
                : data.onboarding_status === "completed"
                ? "✓ Onboarding complete! You're all set."
                : "Complete the previous steps first."}
            </Text>
          </View>
        </>
      )}
      </View>
    </AppearOnMount>
  );
}

// ─── Tickets Screen ─────────────────────────────────────────────────────────

function TicketsScreen({
  token,
  isLandlord,
  onBack,
  visible = true,
}: {
  token: string;
  isLandlord: boolean;
  onBack: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Update form (landlord)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReceipt, setEditReceipt] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchTickets(token);
      setTickets(data);
    } catch (e) { setMsg(readError(e)); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    if (!subject.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await createTicket(token, { subject, description });
      setMsg("Ticket created.");
      setSubject("");
      setDescription("");
      setShowCreate(false);
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleUpdate(ticketId: number) {
    setBusy(true);
    setMsg("");
    try {
      const update: any = {};
      if (editStatus) update.status = editStatus;
      if (editProvider) update.resolution_provider = editProvider;
      if (editNotes) update.resolution_notes = editNotes;
      if (editReceipt) update.receipt_url = editReceipt;
      await updateTicket(token, ticketId, update);
      setMsg("Ticket updated.");
      setEditingId(null);
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  const statusColors: Record<string, string> = {
    open: t.warningText,
    in_progress: t.primary,
    resolved: t.successText,
    closed: t.textSecondary,
  };

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Back" active={false} onPress={onBack} />
        <ActionChip icon="🎫" label="Tickets" active={true} onPress={() => {}} />
      </View>
      <Text style={styles.panelTitle}>Support Tickets</Text>
      {msg ? <Text style={[styles.helper, { marginTop: 4 }]}>{msg}</Text> : null}

      {!isLandlord && (
        <View style={{ marginTop: 8 }}>
          <AppearOnMount visible={showCreate} unmountOnExit>
            {showCreate ? (
              <View style={styles.panel}>
                <Text style={styles.sectionKicker}>New Ticket</Text>
                <View style={styles.formGrid}>
                  <Field label="Subject" value={subject} onChangeText={setSubject} placeholder="e.g. Leaking tap in bathroom" />
                  <Field label="Description" value={description} onChangeText={setDescription} placeholder="Detailed description..." />
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <PrimaryButton label={busy ? "Creating..." : "Submit Ticket"} onPress={handleCreate} disabled={busy} />
                  <Pressable onPress={() => setShowCreate(false)} style={styles.removeButton}><Text style={styles.removeButtonText}>Cancel</Text></Pressable>
                </View>
              </View>
            ) : null}
          </AppearOnMount>
          {!showCreate ? (
            <PrimaryButton label="+ Raise a Ticket" onPress={() => setShowCreate(true)} fullWidth />
          ) : null}
        </View>
      )}

      {loading ? <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} /> : null}

      {tickets.length === 0 && !loading ? (
        <Text style={[styles.helper, { marginTop: 16 }]}>No tickets yet.</Text>
      ) : (
        <View style={[styles.tableLike, { marginTop: 16 }]}>
          {tickets.map((ticket) => (
            <View key={ticket.id} style={[styles.panel, { marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.rowTitle}>#{ticket.id} – {ticket.subject}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: (statusColors[ticket.status] || t.textSecondary) + "18" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: statusColors[ticket.status] || t.textSecondary }}>
                    {ticket.status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowMeta}>{ticket.building_name} / {ticket.unit_label} • {ticket.tenant_name}</Text>
              <Text style={[styles.helper, { marginTop: 4 }]}>{ticket.description}</Text>
              {ticket.resolution_provider ? <Text style={styles.rowMeta}>Provider: {ticket.resolution_provider.replace("_", " ")}</Text> : null}
              {ticket.resolution_notes ? <Text style={styles.rowMeta}>Notes: {ticket.resolution_notes}</Text> : null}
              {ticket.receipt_url ? <Text style={styles.rowMeta}>Receipt: {ticket.receipt_url}</Text> : null}

              {/* Landlord can update ticket */}
              {isLandlord && ticket.status !== "closed" && (
                <>
                  <AppearOnMount visible={editingId === ticket.id} unmountOnExit>
                    {editingId === ticket.id ? (
                    <View style={[styles.formGrid, { marginTop: 8 }]}>
                      <View>
                        <Text style={styles.fieldLabel}>Status</Text>
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {(["in_progress", "resolved", "closed"] as const).map((s) => (
                            <Pressable
                              key={s}
                              onPress={() => setEditStatus(s)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: editStatus === s ? t.primary : t.inputBg, borderWidth: 1, borderColor: editStatus === s ? t.primary : t.inputBorder }}
                            >
                              <Text style={{ color: editStatus === s ? t.primaryText : t.text, fontSize: 12, fontWeight: "600" }}>{s.replace("_", " ").toUpperCase()}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Resolution by</Text>
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {(["urban_clap", "owner", "tenant"] as const).map((p) => (
                            <Pressable
                              key={p}
                              onPress={() => setEditProvider(p)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: editProvider === p ? t.primary : t.inputBg, borderWidth: 1, borderColor: editProvider === p ? t.primary : t.inputBorder }}
                            >
                              <Text style={{ color: editProvider === p ? t.primaryText : t.text, fontSize: 12, fontWeight: "600" }}>{p === "urban_clap" ? "Urban Clap" : p === "owner" ? "Owner" : "Tenant"}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <Field label="Resolution notes" value={editNotes} onChangeText={setEditNotes} placeholder="What was done..." />
                      <Field label="Receipt URL (optional)" value={editReceipt} onChangeText={setEditReceipt} placeholder="https://..." />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <PrimaryButton label={busy ? "Saving..." : "Save"} onPress={() => handleUpdate(ticket.id)} disabled={busy} />
                        <Pressable onPress={() => setEditingId(null)} style={styles.removeButton}><Text style={styles.removeButtonText}>Cancel</Text></Pressable>
                      </View>
                    </View>
                    ) : null}
                  </AppearOnMount>
                  {editingId !== ticket.id ? (
                    <Pressable
                      style={[styles.removeButton, { marginTop: 8, backgroundColor: t.primaryMuted }]}
                      onPress={() => { setEditingId(ticket.id); setEditStatus(ticket.status); setEditProvider(ticket.resolution_provider); setEditNotes(ticket.resolution_notes); setEditReceipt(ticket.receipt_url); }}
                    >
                      <Text style={[styles.removeButtonText, { color: t.primary }]}>Update Ticket</Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {/* Tenant can upload receipt */}
              {!isLandlord && ticket.status !== "closed" && (
                <>
                  <AppearOnMount visible={editingId === ticket.id} unmountOnExit>
                    {editingId === ticket.id ? (
                    <View style={[styles.formGrid, { marginTop: 8 }]}>
                      <Field label="Receipt URL" value={editReceipt} onChangeText={setEditReceipt} placeholder="https://receipt..." />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <PrimaryButton label={busy ? "Saving..." : "Upload Receipt"} onPress={() => handleUpdate(ticket.id)} disabled={busy} />
                        <Pressable onPress={() => setEditingId(null)} style={styles.removeButton}><Text style={styles.removeButtonText}>Cancel</Text></Pressable>
                      </View>
                    </View>
                    ) : null}
                  </AppearOnMount>
                  {editingId !== ticket.id ? (
                    <Pressable
                      style={[styles.removeButton, { marginTop: 8, backgroundColor: t.primaryMuted }]}
                      onPress={() => { setEditingId(ticket.id); setEditReceipt(ticket.receipt_url); }}
                    >
                      <Text style={[styles.removeButtonText, { color: t.primary }]}>Add Receipt</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          ))}
        </View>
      )}
      </View>
    </AppearOnMount>
  );
}

// ─── Offboarding Screen ─────────────────────────────────────────────────────

function OffboardingScreen({
  token,
  tenancyId,
  isLandlord,
  onBack,
  onRefresh,
  visible = true,
}: {
  token: string;
  tenancyId: number;
  isLandlord: boolean;
  onBack: () => void;
  onRefresh: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OffboardingInfo | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [notStarted, setNotStarted] = useState(false);

  // Form state
  const [deductions, setDeductions] = useState("");
  const [deductionReasons, setDeductionReasons] = useState("");
  const [handoffDocUrl, setHandoffDocUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchOffboardingDetail(token, tenancyId);
      setData(d);
      setNotStarted(false);
    } catch (e) {
      if (readError(e).includes("not initiated")) {
        setNotStarted(true);
      } else {
        setMsg(readError(e));
      }
    } finally { setLoading(false); }
  }, [token, tenancyId]);

  useEffect(() => { void load(); }, [load]);

  async function handleInitiate() {
    setBusy(true);
    setMsg("");
    try {
      await initiateOffboarding(token, { tenancy_id: tenancyId, deductions: deductions || undefined, deduction_reasons: deductionReasons || undefined });
      setMsg("Offboarding initiated.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleSettleDeposit() {
    setBusy(true);
    setMsg("");
    try {
      const result = await settleDeposit(token, { tenancy_id: tenancyId, deductions: deductions || undefined, deduction_reasons: deductionReasons || undefined });
      const extra = Number(result.extra_owed_by_tenant);
      setMsg(extra > 0 ? `Deposit settled. Tenant owes extra: ${money(extra)}` : "Deposit settled & refund calculated.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleHandoff() {
    setBusy(true);
    setMsg("");
    try {
      await completeHandoff(token, { tenancy_id: tenancyId, handoff_document_url: handoffDocUrl || undefined });
      setMsg("Handoff complete. Unit is under maintenance.");
      await load();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  async function handleMaintenanceDone() {
    setBusy(true);
    setMsg("");
    try {
      const result = await confirmMaintenanceDone(token, tenancyId);
      setMsg(result.detail);
      await load();
      onRefresh();
    } catch (e) { setMsg(readError(e)); } finally { setBusy(false); }
  }

  const statusSteps = [
    { key: "initiated", label: "Initiated" },
    { key: "deposit_settled", label: "Deposit Settled" },
    { key: "final_rent_paid", label: "Final Rent Paid" },
    { key: "handoff_complete", label: "Handoff" },
    { key: "under_maintenance", label: "Maintenance" },
    { key: "completed", label: "Unit Available" },
  ];
  const currentStep = data ? statusSteps.findIndex((s) => s.key === data.status) : -1;

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
      <View style={styles.navChips}>
        <ActionChip icon="←" label="Back" active={false} onPress={onBack} />
        <ActionChip icon="🚪" label="Offboarding" active={true} onPress={() => {}} />
      </View>
      <Text style={styles.panelTitle}>Offboarding</Text>
      {msg ? <Text style={[styles.helper, { marginTop: 4 }]}>{msg}</Text> : null}

      {loading ? <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} /> : null}

      <AppearOnMount visible={notStarted && isLandlord} unmountOnExit>
        {notStarted && isLandlord ? (
          <View style={styles.panel}>
            <Text style={styles.sectionKicker}>Start offboarding</Text>
            <Text style={styles.helper}>Optionally specify deposit deductions upfront.</Text>
            <View style={styles.formGrid}>
              <Field label="Deductions" value={deductions} onChangeText={setDeductions} keyboardType="numeric" placeholder="e.g. 5000" />
              <Field label="Deduction reasons" value={deductionReasons} onChangeText={setDeductionReasons} placeholder="Damages, cleaning, etc." />
            </View>
            <PrimaryButton label={busy ? "Processing..." : "Initiate Offboarding"} onPress={handleInitiate} disabled={busy} fullWidth />
          </View>
        ) : null}
      </AppearOnMount>

      <AppearOnMount visible={notStarted && !isLandlord} unmountOnExit>
        {notStarted && !isLandlord ? (
          <View style={styles.panel}><Text style={styles.helper}>Offboarding has not been initiated by the landlord yet.</Text></View>
        ) : null}
      </AppearOnMount>

      {data && (
        <>
          {/* Progress */}
          <View style={[styles.panel, { marginTop: 12 }]}>
            <Text style={styles.sectionKicker}>Progress</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {statusSteps.map((step, i) => (
                <View
                  key={step.key}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                    backgroundColor: i < currentStep ? t.success : i === currentStep ? t.primaryMuted : t.border,
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: "600",
                    color: i < currentStep ? t.successText : i === currentStep ? t.primary : t.textSecondary,
                  }}>
                    {i < currentStep ? "✓ " : ""}{step.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Deposit summary */}
          {data.deposit && (
            <View style={styles.panel}>
              <Text style={styles.sectionKicker}>Deposit Summary</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
                <View><Text style={styles.rowMeta}>Original</Text><Text style={styles.rowValue}>{money(data.deposit.amount)}</Text></View>
                <View><Text style={styles.rowMeta}>Deductions</Text><Text style={styles.rowValue}>{money(data.deposit.deductions)}</Text></View>
                <View><Text style={styles.rowMeta}>Refund</Text><Text style={styles.rowValue}>{money(data.deposit.refund_amount)}</Text></View>
              </View>
              {data.deposit.deduction_reasons ? <Text style={[styles.rowMeta, { marginTop: 8 }]}>Reasons: {data.deposit.deduction_reasons}</Text> : null}
              <StatusBadge status={data.deposit.status} />
            </View>
          )}

          {/* Settle deposit (landlord) */}
          <AppearOnMount visible={isLandlord && data.status === "initiated"} unmountOnExit>
            {isLandlord && data.status === "initiated" ? (
              <View style={styles.panel}>
                <Text style={styles.sectionKicker}>Settle Deposit</Text>
                <Text style={styles.helper}>Apply deductions and calculate refund. Deductions greater than deposit means tenant pays extra.</Text>
                <View style={styles.formGrid}>
                  <Field label="Deductions" value={deductions} onChangeText={setDeductions} keyboardType="numeric" placeholder="e.g. 5000" />
                  <Field label="Reasons" value={deductionReasons} onChangeText={setDeductionReasons} placeholder="Damages, painting, etc." />
                </View>
                <PrimaryButton label={busy ? "Settling..." : "Settle Deposit"} onPress={handleSettleDeposit} disabled={busy} fullWidth />
              </View>
            ) : null}
          </AppearOnMount>

          {/* Handoff (landlord) */}
          <AppearOnMount visible={isLandlord && (data.status === "deposit_settled" || data.status === "final_rent_paid")} unmountOnExit>
            {isLandlord && (data.status === "deposit_settled" || data.status === "final_rent_paid") ? (
              <View style={styles.panel}>
                <Text style={styles.sectionKicker}>Handoff</Text>
                <Text style={styles.helper}>Upload the handoff letter/document and complete the handoff. Unit will be marked under maintenance.</Text>
                <View style={styles.formGrid}>
                  <Field label="Handoff document URL" value={handoffDocUrl} onChangeText={setHandoffDocUrl} placeholder="https://..." />
                </View>
                <PrimaryButton label={busy ? "Processing..." : "Complete Handoff"} onPress={handleHandoff} disabled={busy} fullWidth />
              </View>
            ) : null}
          </AppearOnMount>

          {/* Maintenance done (landlord) */}
          <AppearOnMount visible={isLandlord && data.status === "under_maintenance"} unmountOnExit>
            {isLandlord && data.status === "under_maintenance" ? (
              <View style={styles.panel}>
                <Text style={styles.sectionKicker}>Maintenance</Text>
                <Text style={styles.helper}>Once maintenance is complete, confirm to make the unit available for new tenants.</Text>
                <Text style={[styles.helper, { fontStyle: "italic" }]}>TODO: Auto-publish to NoBroker.com once available</Text>
                <PrimaryButton label={busy ? "Processing..." : "Confirm Maintenance Done"} onPress={handleMaintenanceDone} disabled={busy} fullWidth />
              </View>
            ) : null}
          </AppearOnMount>

          <AppearOnMount visible={data.status === "completed"} unmountOnExit>
            {data.status === "completed" ? (
              <View style={styles.panel}>
                <Text style={[styles.panelTitle, { color: t.successText }]}>✓ Offboarding Complete</Text>
                <Text style={styles.helper}>The unit is now available for rent.</Text>
              </View>
            ) : null}
          </AppearOnMount>
        </>
      )}
      </View>
    </AppearOnMount>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

function money(value: string | number) {
  const amount = Number(value || 0);
  return `INR ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
