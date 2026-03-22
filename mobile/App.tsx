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
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

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
  canvas: string;
  surface: string;
  surfaceLowest: string;
  card: string;
  cardAlt: string;
  cardRaised: string;
  primary: string;
  primaryMuted: string;
  primaryText: string;
  primaryStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
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
  glow: string;
  heroStart: string;
  heroEnd: string;
  onHero: string;
};

const lightTheme: Theme = {
  mode: "light",
  bg: "#eef2fb",
  canvas: "#f8f9fa",
  surface: "#f3f4f5",
  surfaceLowest: "#ffffff",
  card: "#ffffff",
  cardAlt: "#e7ebf4",
  cardRaised: "#edf0f7",
  primary: "#1a237e",
  primaryMuted: "rgba(26,35,126,0.10)",
  primaryText: "#ffffff",
  primaryStrong: "#000666",
  text: "#191c1d",
  textSecondary: "#454652",
  textMuted: "#767683",
  accent: "#000666",
  border: "rgba(76,86,175,0.08)",
  borderStrong: "rgba(76,86,175,0.18)",
  inputBg: "#ffffff",
  inputBorder: "rgba(76,86,175,0.16)",
  bannerBg: "#e8ebff",
  bannerBusy: "#eef1ff",
  success: "rgba(27,109,36,0.12)",
  successText: "#1b6d24",
  warning: "rgba(255,99,91,0.14)",
  warningText: "#ff635b",
  neutral: "rgba(69,70,82,0.10)",
  danger: "rgba(186,26,26,0.10)",
  dangerText: "#ba1a1a",
  badgeText: "#191c1d",
  shadow: "rgba(26,35,126,0.10)",
  glow: "rgba(76,86,175,0.18)",
  heroStart: "#000666",
  heroEnd: "#1a237e",
  onHero: "#ffffff",
};

const darkTheme: Theme = {
  mode: "dark",
  bg: "#000000",
  canvas: "#060e20",
  surface: "#091328",
  surfaceLowest: "#000000",
  card: "#141f38",
  cardAlt: "#192540",
  cardRaised: "#1f2b49",
  primary: "#9fa7ff",
  primaryMuted: "rgba(159,167,255,0.16)",
  primaryText: "#101b8b",
  primaryStrong: "#8d98ff",
  text: "#dee5ff",
  textSecondary: "#a3aac4",
  textMuted: "#6d758c",
  accent: "#9fa7ff",
  border: "rgba(64,72,93,0.22)",
  borderStrong: "rgba(159,167,255,0.18)",
  inputBg: "#000000",
  inputBorder: "rgba(64,72,93,0.42)",
  bannerBg: "#0f1930",
  bannerBusy: "#141f38",
  success: "rgba(74,222,128,0.18)",
  successText: "#4ade80",
  warning: "rgba(251,191,36,0.18)",
  warningText: "#fbbf24",
  neutral: "rgba(163,170,196,0.16)",
  danger: "rgba(248,113,113,0.18)",
  dangerText: "#f87171",
  badgeText: "#dee5ff",
  shadow: "rgba(0,0,0,0.45)",
  glow: "rgba(159,167,255,0.28)",
  heroStart: "#1e1b4b",
  heroEnd: "#091328",
  onHero: "#dee5ff",
};

const DISPLAY_FONT = "PlusJakartaSans_800ExtraBold";
const HEADLINE_FONT = "PlusJakartaSans_700Bold";
const BODY_FONT = "Inter_400Regular";
const BODY_FONT_MEDIUM = "Inter_500Medium";
const BODY_FONT_SEMIBOLD = "Inter_600SemiBold";
const LABEL_FONT = "Inter_700Bold";

type ThemeCtx = {
  t: Theme;
  s: ReturnType<typeof makeStyles>;
  toggle: () => void;
};

type BottomTabItem = {
  key: string;
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type AppLocationCoords = {
  latitude: number;
  longitude: number;
};

type LocationGateStatus = "checking" | "granted" | "denied" | "unavailable";

type AppLocationCtx = {
  coords: AppLocationCoords | null;
  refresh: () => Promise<AppLocationCoords | null>;
  status: LocationGateStatus;
  error: string;
};

const ThemeContext = createContext<ThemeCtx>(null!);
const LocationContext = createContext<AppLocationCtx>(null!);
const BottomTabsContext = createContext<{
  items: BottomTabItem[] | null;
  setItems: (items: BottomTabItem[] | null) => void;
} | null>(null);

function useT() {
  return useContext(ThemeContext);
}

function useLocationState() {
  return useContext(LocationContext);
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
    appShell: {
      flex: 1,
    },
    pageOuter: {
      alignItems: isWideWeb ? "stretch" : "center",
      paddingVertical: isWideWeb ? 32 : 20,
      paddingHorizontal: isWideWeb ? 30 : 14,
      backgroundColor: t.canvas,
      ...(Platform.OS === "web"
        ? ({
            minHeight: "100%",
            backgroundImage:
              t.mode === "dark"
                ? "radial-gradient(circle at top right, rgba(159,167,255,0.16), transparent 30%), linear-gradient(180deg, #091328 0%, #060e20 40%, #000000 100%)"
                : "radial-gradient(circle at top right, rgba(26,35,126,0.10), transparent 30%), linear-gradient(180deg, #f8f9fa 0%, #eef2fb 100%)",
          } as any)
        : {}),
    },
    pageOuterWithBottomTabs: {
      paddingBottom: isWideWeb ? 132 : 116,
    },
    pageInner: {
      width: "100%",
      maxWidth: Platform.OS === "web" ? (isWideWeb ? 1480 : 980) : 520,
      alignSelf: "center",
      gap: 24,
    },
    landingGrid: {
      flexDirection: isWideWeb ? ("row" as const) : ("column" as const),
      gap: 24,
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
      gap: 18,
      padding: isWideWeb ? 34 : 26,
      borderRadius: 30,
      backgroundColor: t.card,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: t.mode === "dark" ? 0.42 : 0.08,
      shadowRadius: 40,
      elevation: 8,
      overflow: "hidden",
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
      fontFamily: LABEL_FONT,
      letterSpacing: 2.2,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    title: {
      fontSize: 46,
      fontFamily: "ModernAntiqua_400Regular",
      color: t.text,
      letterSpacing: -0.8,
    },
    subtitle: {
      color: t.textSecondary,
      fontSize: 15,
      fontFamily: BODY_FONT,
      lineHeight: 24,
      marginTop: 10,
    },
    note: {
      marginTop: 12,
      color: t.textMuted,
      fontSize: 13,
      fontFamily: BODY_FONT_MEDIUM,
    },
    roleCard: {
      width: isWideWeb ? 320 : "100%",
      padding: 18,
      borderRadius: 24,
      backgroundColor: t.cardAlt,
      gap: 8,
      ...webTransition,
    },
    roleTitle: {
      fontFamily: LABEL_FONT,
      color: t.accent,
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    roleText: {
      color: t.text,
      fontFamily: BODY_FONT_MEDIUM,
    },
    themeToggle: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    themeToggleIcon: {
      fontSize: 20,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      paddingHorizontal: isWideWeb ? 24 : 18,
      paddingVertical: 16,
      borderRadius: 24,
      backgroundColor: t.surface,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: t.mode === "dark" ? 0.28 : 0.06,
      shadowRadius: 26,
      elevation: 6,
      ...webTransition,
    },
    topBarBrand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      flex: 1,
      minWidth: 0,
    },
    avatarOrb: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.cardRaised,
    },
    avatarOrbText: {
      color: t.accent,
      fontFamily: HEADLINE_FONT,
      fontSize: 15,
    },
    topBarLockup: {
      gap: 2,
      minWidth: 0,
    },
    topBarTitle: {
      color: t.text,
      fontSize: 22,
      fontFamily: "ModernAntiqua_400Regular",
      letterSpacing: -0.4,
    },
    topBarMeta: {
      color: t.textSecondary,
      fontSize: 12,
      fontFamily: BODY_FONT_MEDIUM,
    },
    topBarActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    topBarPill: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: t.cardAlt,
    },
    topBarPillText: {
      color: t.text,
      fontSize: 12,
      fontFamily: LABEL_FONT,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    fixedBottomTabWrap: {
      position: Platform.OS === "web" ? ("fixed" as const) : ("absolute" as const),
      left: 0,
      right: 0,
      bottom: isWideWeb ? 18 : 14,
      paddingHorizontal: isWideWeb ? 30 : 14,
      zIndex: 300,
    },
    fixedBottomTabInner: {
      width: "100%",
      maxWidth: Platform.OS === "web" ? (isWideWeb ? 1480 : 980) : 520,
      alignSelf: "center",
    },
    heroSplit: {
      flexDirection: isWideWeb ? ("row" as const) : ("column" as const),
      gap: 16,
      alignItems: "stretch",
    },
    spotlightCard: {
      flex: 1,
      minWidth: 0,
      padding: 22,
      borderRadius: 24,
      backgroundColor: t.cardAlt,
      gap: 8,
    },
    spotlightTitle: {
      color: t.textSecondary,
      fontSize: 11,
      fontFamily: LABEL_FONT,
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    spotlightValue: {
      color: t.text,
      fontSize: 28,
      fontFamily: DISPLAY_FONT,
      letterSpacing: -0.8,
    },
    spotlightNote: {
      color: t.textSecondary,
      fontSize: 13,
      fontFamily: BODY_FONT,
      lineHeight: 20,
    },
    gradientHero: {
      borderRadius: 28,
      overflow: "hidden",
      shadowColor: t.glow,
      shadowOffset: { width: 0, height: 22 },
      shadowOpacity: t.mode === "dark" ? 0.4 : 0.18,
      shadowRadius: 28,
      elevation: 8,
    },
    gradientHeroInner: {
      padding: isWideWeb ? 28 : 24,
      gap: 16,
    },
    gradientHeroEyebrow: {
      color: t.onHero,
      opacity: 0.72,
      fontSize: 11,
      fontFamily: LABEL_FONT,
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    gradientHeroTitle: {
      color: t.onHero,
      fontSize: isWideWeb ? 42 : 34,
      fontFamily: DISPLAY_FONT,
      lineHeight: isWideWeb ? 46 : 38,
      letterSpacing: -1.1,
    },
    gradientHeroText: {
      color: t.onHero,
      opacity: 0.86,
      fontSize: 14,
      fontFamily: BODY_FONT,
      lineHeight: 22,
      maxWidth: 540,
    },
    panel: {
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: isWideWeb ? 26 : 22,
      gap: 18,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: t.mode === "dark" ? 0.32 : 0.06,
      shadowRadius: 28,
      elevation: 6,
      ...webTransition,
    },
    sectionKicker: {
      color: t.accent,
      fontSize: 11,
      fontFamily: LABEL_FONT,
      textTransform: "uppercase",
      letterSpacing: 2.2,
    },
    panelTitle: {
      fontSize: 28,
      fontFamily: DISPLAY_FONT,
      color: t.text,
      letterSpacing: -1,
    },
    formGrid: {
      flexDirection: isMediumWeb ? ("row" as const) : ("column" as const),
      flexWrap: isMediumWeb ? ("wrap" as const) : ("nowrap" as const),
      alignItems: "stretch",
      gap: 16,
    },
    field: {
      ...(isMediumWeb ? { flexGrow: 1, flexBasis: 280 } : {}),
      gap: 10,
      position: "relative",
    },
    fieldLabel: {
      fontFamily: LABEL_FONT,
      color: t.textSecondary,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    input: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderWidth: 1,
      borderColor: t.inputBorder,
      backgroundColor: t.inputBg,
      fontSize: 15,
      color: t.text,
      fontFamily: BODY_FONT_MEDIUM,
      ...webTransition,
    },
    button: {
      minHeight: 54,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      overflow: "hidden",
    },
    primaryButton: {
      backgroundColor: "transparent",
      shadowColor: t.glow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: t.mode === "dark" ? 0.45 : 0.16,
      shadowRadius: 20,
      elevation: 6,
    },
    secondaryButton: {
      backgroundColor: t.cardAlt,
    },
    googleButton: {
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.borderStrong,
    },
    buttonText: {
      color: t.primaryText,
      fontFamily: HEADLINE_FONT,
      fontSize: 15,
    },
    secondaryButtonText: {
      color: t.accent,
      fontFamily: HEADLINE_FONT,
    },
    googleButtonText: {
      color: t.text,
      fontFamily: HEADLINE_FONT,
    },
    disabledButton: {
      opacity: 0.4,
    },
    sessionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: 16,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: t.card,
      ...webTransition,
    },
    sessionText: {
      color: t.text,
      fontFamily: BODY_FONT_SEMIBOLD,
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
      fontFamily: BODY_FONT,
    },
    stack: {
      gap: 24,
    },
    dashboardGrid: {
      flexDirection: isWideWeb ? ("row" as const) : ("column" as const),
      alignItems: "stretch",
      gap: 24,
    },
    dashboardMainColumn: {
      flex: isWideWeb ? 1.3 : undefined,
      minWidth: 0,
      gap: 24,
    },
    dashboardSideColumn: {
      flex: isWideWeb ? 0.95 : undefined,
      minWidth: isWideWeb ? 340 : 0,
      gap: 24,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isWideWeb ? 18 : 12,
    },
    summaryCard: {
      flex: 1,
      minWidth: isWideWeb ? 220 : 140,
      padding: 20,
      borderRadius: 24,
      backgroundColor: t.card,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: t.mode === "dark" ? 0.25 : 0.06,
      shadowRadius: 24,
      elevation: 4,
      ...webTransition,
    },
    summaryCardInteractive: {
      cursor: Platform.OS === "web" ? ("pointer" as const) : undefined,
    },
    summaryCardActive: {
      backgroundColor: t.cardRaised,
    },
    summaryLabel: {
      color: t.accent,
      fontSize: 11,
      fontFamily: LABEL_FONT,
      textTransform: "uppercase",
      letterSpacing: 1.6,
    },
    summaryValue: {
      color: t.text,
      fontSize: 28,
      fontFamily: DISPLAY_FONT,
      marginTop: 12,
      letterSpacing: -0.8,
    },
    summaryNote: {
      color: t.textSecondary,
      marginTop: 8,
      fontSize: 13,
      fontFamily: BODY_FONT,
    },
    summaryActionText: {
      color: t.accent,
      marginTop: 12,
      fontSize: 12,
      fontFamily: LABEL_FONT,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    detailGroupCard: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: t.card,
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
      fontFamily: HEADLINE_FONT,
      flex: 1,
    },
    detailGroupTotal: {
      color: t.accent,
      fontSize: 16,
      fontFamily: HEADLINE_FONT,
    },
    tableLike: {
      gap: 12,
    },
    tableRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.cardAlt,
      gap: 12,
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
      fontFamily: HEADLINE_FONT,
      fontSize: 16,
    },
    rowMeta: {
      color: t.textSecondary,
      fontSize: 13,
      fontFamily: BODY_FONT,
    },
    rowValue: {
      color: t.text,
      fontFamily: HEADLINE_FONT,
    },
    badge: {
      alignSelf: "flex-start",
      borderRadius: 10,
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
      fontFamily: LABEL_FONT,
      fontSize: 12,
    },
    removeButton: {
      alignSelf: "flex-start",
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.danger,
    },
    removeButtonText: {
      color: t.dangerText,
      fontSize: 13,
      fontFamily: BODY_FONT_SEMIBOLD,
    },
    helper: {
      color: t.textSecondary,
      lineHeight: 21,
      fontSize: 14,
      fontFamily: BODY_FONT,
    },
    authTabs: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
    },
    authTab: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    authTabActive: {
      backgroundColor: t.cardRaised,
    },
    authTabText: {
      fontFamily: LABEL_FONT,
      color: t.textSecondary,
      letterSpacing: 0.5,
    },
    authTabTextActive: {
      color: t.accent,
    },
    roleToggle: {
      gap: 10,
      marginBottom: 6,
    },
    roleOptions: {
      flexDirection: "row",
      gap: 8,
    },
    roleOption: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 10,
      borderRadius: 20,
      alignItems: "center",
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    roleOptionActive: {
      backgroundColor: t.cardRaised,
    },
    roleOptionText: {
      fontFamily: HEADLINE_FONT,
      color: t.text,
    },
    roleOptionTextActive: {
      color: t.text,
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
      fontFamily: LABEL_FONT,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    actionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    actionChipActive: {
      backgroundColor: t.cardRaised,
    },
    actionChipText: {
      fontFamily: BODY_FONT_SEMIBOLD,
      color: t.textSecondary,
      fontSize: 14,
    },
    actionChipTextActive: {
      color: t.text,
    },
    selectChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    selectChipActive: {
      backgroundColor: t.cardRaised,
    },
    selectChipText: {
      fontFamily: BODY_FONT_SEMIBOLD,
      color: t.text,
      fontSize: 14,
    },
    selectChipTextActive: {
      color: t.text,
    },
    inlineForm: {
      gap: 16,
      padding: 18,
      borderRadius: 20,
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    inlineFormTitle: {
      fontSize: 17,
      fontFamily: HEADLINE_FONT,
      color: t.text,
    },
    addressDropdown: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      zIndex: 50,
      marginTop: 6,
      backgroundColor: t.mode === "dark" ? "#0f1930" : "#ffffff",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.borderStrong,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.mode === "dark" ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 6,
      overflow: "hidden",
      ...(Platform.OS === "web"
        ? ({
            opacity: 1,
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            isolation: "isolate",
          } as any)
        : {}),
    },
    addressItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: t.mode === "dark" ? "#0f1930" : "#ffffff",
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
      fontFamily: BODY_FONT,
    },
    locationButton: {
      position: "relative",
      zIndex: 0,
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: t.primaryMuted,
      marginTop: 2,
    },
    locationButtonText: {
      fontSize: 13,
      fontFamily: BODY_FONT_SEMIBOLD,
      color: t.accent,
    },
    // Subscription & Plans styles
    planCard: {
      padding: 20,
      borderRadius: 24,
      backgroundColor: t.card,
      gap: 10,
      ...webTransition,
    },
    planCardActive: {
      backgroundColor: t.cardRaised,
    },
    planName: {
      fontSize: 22,
      fontFamily: DISPLAY_FONT,
      color: t.text,
    },
    planPrice: {
      fontSize: 28,
      fontFamily: DISPLAY_FONT,
      color: t.accent,
    },
    planPriceSuffix: {
      fontSize: 14,
      fontFamily: BODY_FONT_SEMIBOLD,
      color: t.textSecondary,
    },
    planFeature: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 20,
      fontFamily: BODY_FONT,
    },
    planLimit: {
      fontSize: 14,
      fontFamily: BODY_FONT_SEMIBOLD,
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
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.primaryMuted,
    },
    tierBadgeText: {
      fontSize: 11,
      fontFamily: LABEL_FONT,
      color: t.accent,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    addonCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.cardAlt,
      ...webTransition,
    },
    addonInfo: {
      flex: 1,
      gap: 2,
    },
    addonName: {
      fontSize: 15,
      fontFamily: HEADLINE_FONT,
      color: t.text,
    },
    addonPrice: {
      fontSize: 13,
      color: t.textSecondary,
      fontFamily: BODY_FONT,
    },
    lockedOverlay: {
      padding: 24,
      borderRadius: 24,
      backgroundColor: t.surface,
      alignItems: "center" as const,
      gap: 12,
      ...webTransition,
    },
    lockedIcon: {
      fontSize: 36,
    },
    lockedText: {
      fontSize: 15,
      color: t.textSecondary,
      textAlign: "center" as const,
      fontFamily: BODY_FONT,
    },
    analyticsValue: {
      fontSize: 32,
      fontFamily: DISPLAY_FONT,
      color: t.text,
    },
    analyticsLabel: {
      fontSize: 12,
      fontFamily: LABEL_FONT,
      color: t.accent,
      textTransform: "uppercase" as const,
      letterSpacing: 1.2,
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
      fontFamily: BODY_FONT_MEDIUM,
    },
    navChips: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
      marginBottom: 4,
      padding: 6,
      alignSelf: "flex-start" as const,
      borderRadius: 999,
      backgroundColor: t.surfaceLowest,
    },
    buttonGradient: {
      minHeight: 54,
      borderRadius: 18,
      paddingHorizontal: 28,
      alignItems: "center",
      justifyContent: "center",
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
  const [fontsLoaded] = useFonts({
    ModernAntiqua_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
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
  const [locationStatus, setLocationStatus] = useState<LocationGateStatus>("checking");
  const [locationCoords, setLocationCoords] = useState<AppLocationCoords | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [bottomTabItems, setBottomTabItems] = useState<BottomTabItem[] | null>(null);
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
  const locationGranted = locationStatus === "granted" && !!locationCoords;

  const ensureLocationAccess = useCallback(async () => {
    setLocationBusy(true);
    setLocationError("");
    setLocationStatus("checking");
    try {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          throw new Error("Turn on location services to continue using RentFlo.");
        }
      } catch {
        // Some platforms don't expose service status. Permission request below is the source of truth.
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        const deniedMessage = "RentFlo requires location access to narrow address searches in India. Enable it to continue.";
        setLocationCoords(null);
        setLocationError(deniedMessage);
        setLocationStatus("denied");
        return null;
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Platform.OS === "web" ? Location.Accuracy.Balanced : Location.Accuracy.High,
        }).catch(async () => {
          return await Location.getLastKnownPositionAsync();
        });

      if (!position?.coords) {
        throw new Error("We couldn't read your current location.");
      }

      const nextCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLocationCoords(nextCoords);
      setLocationStatus("granted");
      return nextCoords;
    } catch (error) {
      const fallbackMessage = Platform.OS === "web"
        ? "Allow browser location access on this site to continue using RentFlo."
        : "Allow foreground location access to continue using RentFlo.";
      setLocationCoords(null);
      setLocationError(`${readError(error)} ${fallbackMessage}`.trim());
      setLocationStatus("unavailable");
      return null;
    } finally {
      setLocationBusy(false);
    }
  }, []);

  useEffect(() => {
    void ensureLocationAccess();
  }, [ensureLocationAccess]);

  const locationCtx = useMemo<AppLocationCtx>(() => ({
    coords: locationCoords,
    refresh: ensureLocationAccess,
    status: locationStatus,
    error: locationError,
  }), [ensureLocationAccess, locationCoords, locationError, locationStatus]);

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
      <LocationContext.Provider value={locationCtx}>
        <BottomTabsContext.Provider value={{ items: bottomTabItems, setItems: setBottomTabItems }}>
          <SafeAreaView style={styles.safeArea}>
            <StatusBar style={isDark ? "light" : "dark"} />
            <View style={styles.appShell}>
              <ScrollView contentContainerStyle={[styles.pageOuter, bottomTabItems ? styles.pageOuterWithBottomTabs : null]}>
                <View style={styles.pageInner}>
              <AppTopBar user={user} onLogout={user ? logout : undefined} />

              {!user ? (
                <View style={styles.landingGrid}>
                  <View style={styles.landingMain}>
                    <LinearGradient
                      colors={[t.heroStart, t.heroEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientHero}
                    >
                      <View style={styles.gradientHeroInner}>
                        <Text style={styles.gradientHeroEyebrow}>Architectural Trust</Text>
                        <Text style={[styles.title, !fontsLoaded && { fontFamily: undefined }, { color: t.onHero }]}>RentFlo</Text>
                        <Text style={styles.gradientHeroText}>
                          A single landlord and tenant workspace for properties, rent collection, onboarding, maintenance, and settlements.
                        </Text>
                        <Text style={[styles.note, { color: t.onHero, opacity: 0.72 }]}>
                          API base URL: {Platform.OS === "web" ? "http://localhost:8085/api" : "Set EXPO_PUBLIC_API_URL"}
                        </Text>

                        <View style={styles.heroSplit}>
                          <View style={styles.spotlightCard}>
                            <Text style={styles.spotlightTitle}>Landlord Flow</Text>
                            <Text style={styles.spotlightValue}>Portfolio control</Text>
                            <Text style={styles.spotlightNote}>
                              Revenue, buildings, units, tenant onboarding, due tracking, exports, and settlements in one workspace.
                            </Text>
                          </View>
                          <View style={styles.spotlightCard}>
                            <Text style={styles.spotlightTitle}>Tenant Flow</Text>
                            <Text style={styles.spotlightValue}>Tenancy clarity</Text>
                            <Text style={styles.spotlightNote}>
                              Rent due, guided onboarding, tickets, payment history, and agreement steps without jumping between screens.
                            </Text>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>

                  <View style={styles.landingAside}>
                    {!locationGranted ? (
                      <AppearOnMount>
                        <View style={styles.panel}>
                          <Text style={styles.sectionKicker}>Location Required</Text>
                          <Text style={styles.panelTitle}>Enable location services to use RentFlo</Text>
                          <Text style={styles.helper}>
                            We use your current area to narrow address search suggestions inside India before you add properties.
                          </Text>
                          <View style={[styles.summaryCard, { gap: 8 }]}>
                            <Text style={styles.summaryLabel}>Why we need this</Text>
                            <Text style={styles.helper}>1. Bias address search around your current area</Text>
                            <Text style={styles.helper}>2. Keep results focused within India</Text>
                            <Text style={styles.helper}>3. Let “Use current location” work across the app</Text>
                          </View>
                          {locationError ? (
                            <View style={[styles.banner, { backgroundColor: t.danger }]}>
                              <Text style={[styles.bannerText, { color: t.dangerText }]}>{locationError}</Text>
                            </View>
                          ) : (
                            <View style={[styles.banner, locationBusy && styles.bannerBusy]}>
                              {locationBusy || locationStatus === "checking" ? <ActivityIndicator color={t.accent} /> : null}
                              <Text style={styles.bannerText}>
                                {locationBusy || locationStatus === "checking"
                                  ? "Checking location access..."
                                  : "Allow location access to continue."}
                              </Text>
                            </View>
                          )}
                          <PrimaryButton
                            label={locationBusy || locationStatus === "checking" ? "Checking location..." : "Enable location"}
                            onPress={() => { void ensureLocationAccess(); }}
                            disabled={locationBusy || locationStatus === "checking"}
                            fullWidth
                          />
                          <Text style={styles.helper}>
                            {Platform.OS === "web"
                              ? "Use RentFlo on localhost or HTTPS and allow browser location access when prompted."
                              : "Allow foreground location access when your device asks for permission."}
                          </Text>
                        </View>
                      </AppearOnMount>
                    ) : (
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

                        <Text style={styles.sectionKicker}>{authScreen === "login" ? "Access Workspace" : "Create Workspace"}</Text>
                        <Text style={styles.panelTitle}>
                          {authScreen === "login" ? "Sign in to continue" : "Start a new landlord or tenant flow"}
                        </Text>

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
                                  <Text style={[styles.helper, { fontSize: 11, marginTop: 4, textAlign: "center" as const }]}>
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
                                  <Text style={[styles.helper, { fontSize: 11, marginTop: 4, textAlign: "center" as const }]}>
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
                                  <Text style={[styles.helper, { fontSize: 11, marginTop: 4, textAlign: "center" as const }]}>
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
                                  <Text style={[styles.helper, { fontSize: 11, marginTop: 4, textAlign: "center" as const }]}>
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

                        <View style={styles.roleCard}>
                          <Text style={styles.roleTitle}>Demo credentials</Text>
                          <Text style={styles.roleText}>Landlord: owner / owner123</Text>
                          <Text style={styles.roleText}>Tenant: riya / tenant123</Text>
                        </View>
                      </View>
                    )}

                    {locationGranted ? (
                      <View style={[styles.banner, busy && styles.bannerBusy]}>
                        {busy ? <ActivityIndicator color={t.accent} /> : null}
                        <Text style={styles.bannerText}>{message}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                <>
                  <View style={[styles.banner, busy && styles.bannerBusy]}>
                    {busy ? <ActivityIndicator color={t.accent} /> : null}
                    <Text style={styles.bannerText}>{message}</Text>
                  </View>

                  {locationGranted && user.role === "landlord" && landlordData ? (
                    <LandlordView
                      data={landlordData}
                      token={token}
                      onRefresh={async () => {
                        const refreshed = await fetchLandlordDashboard(token);
                        setLandlordData(refreshed);
                      }}
                    />
                  ) : null}

                  {locationGranted && user.role === "tenant" && tenantData ? (
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

                  {locationGranted ? <RolePicker onSelect={handleRoleSelect} busy={busy} visible={showRolePicker && !!user} /> : null}
                </>
              )}
                </View>
              </ScrollView>

              {bottomTabItems?.length ? (
                <View pointerEvents="box-none" style={styles.fixedBottomTabWrap}>
                  <View style={styles.fixedBottomTabInner}>
                    <BottomTabBarView items={bottomTabItems} />
                  </View>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </BottomTabsContext.Provider>
      </LocationContext.Provider>
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

function AppTopBar({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout?: () => void;
}) {
  const { s: styles } = useT();
  const initials = user
    ? `${user.first_name?.[0] || user.username?.[0] || "R"}${user.last_name?.[0] || ""}`.toUpperCase()
    : "RF";

  return (
    <View style={styles.topBar}>
      <View style={styles.topBarBrand}>
        <View style={styles.avatarOrb}>
          <Text style={styles.avatarOrbText}>{initials}</Text>
        </View>
        <View style={styles.topBarLockup}>
          <Text style={styles.topBarTitle}>RentFlo</Text>
          <Text style={styles.topBarMeta}>{user ? `${user.role === "landlord" ? "Landlord workspace" : "Tenant workspace"}` : "Architectural trust for rent operations"}</Text>
        </View>
      </View>
      <View style={styles.topBarActions}>
        {user ? (
          <>
            <View style={styles.topBarPill}>
              <Text style={styles.topBarPillText}>🔔</Text>
            </View>
            {onLogout ? <PrimaryButton label="Logout" onPress={onLogout} variant="secondary" /> : null}
          </>
        ) : (
          <View style={styles.topBarPill}>
            <Text style={styles.topBarPillText}>Cross-platform</Text>
          </View>
        )}
        <ThemeToggle />
      </View>
    </View>
  );
}

function LandlordView({ data, token, onRefresh }: { data: LandlordDashboard; token: string; onRefresh: () => void }) {
  const { t, s: styles } = useT();
  type FormType = null | "building" | "unit" | "bank" | "tenancy";
  type ScreenType =
    | "dashboard"
    | "properties"
    | "payments"
    | "payment-detail"
    | "payment-history"
    | "tickets"
    | "onboarding-status"
    | "invite-tenant"
    | "onboarding"
    | "unit-inspection"
    | "plans"
    | "analytics"
    | "delinquency"
    | "cashflow"
    | "roi"
    | "tenant-risk"
    | "maintenance"
    | "tax-report";
  type SummaryDetailType = null | "due" | "outstanding";
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [screen, setScreen] = useState<ScreenType>("dashboard");
  const [screenVisible, setScreenVisible] = useState(true);
  const [summaryDetail, setSummaryDetail] = useState<SummaryDetailType>(null);
  const [selectedTenancyId, setSelectedTenancyId] = useState<number | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [dashboardTicketCount, setDashboardTicketCount] = useState(0);
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
    (nextScreen: ScreenType, options?: { selectedTenancyId?: number | null; selectedPaymentId?: number | null }) => {
      const nextTenancyId = options?.selectedTenancyId;
      const nextPaymentId = options?.selectedPaymentId;
      if (
        nextScreen === screen &&
        (nextTenancyId === undefined || nextTenancyId === selectedTenancyId) &&
        (nextPaymentId === undefined || nextPaymentId === selectedPaymentId)
      ) {
        return;
      }

      pendingScreenTransition.current = () => {
        if (nextTenancyId !== undefined) {
          setSelectedTenancyId(nextTenancyId);
        }
        if (nextPaymentId !== undefined) {
          setSelectedPaymentId(nextPaymentId);
        }
        setScreen(nextScreen);
      };
      setScreenVisible(false);
    },
    [screen, selectedPaymentId, selectedTenancyId],
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

  useEffect(() => {
    let cancelled = false;
    fetchTickets(token)
      .then((items) => {
        if (!cancelled) {
          setDashboardTicketCount(items.filter((item) => item.status !== "resolved" && item.status !== "closed").length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardTicketCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
  const occupancyRate = data.summary.unit_count > 0
    ? Math.round((data.summary.tenant_count / data.summary.unit_count) * 100)
    : 0;
  const buildingSnapshots = useMemo(() => {
    return data.buildings.map((building) => {
      const units = data.units.filter((unit) => unit.building === building.id);
      const tenants = data.tenants.filter((tenant) => tenant.building_name === building.name);
      const totalRent = units.reduce((sum, unit) => sum + Number(unit.monthly_rent || 0), 0);
      const outstanding = tenants.reduce((sum, tenant) => sum + Number(tenant.balance || 0), 0);
      return {
        ...building,
        unitCount: units.length,
        occupiedCount: tenants.length,
        vacantCount: Math.max(units.length - tenants.length, 0),
        totalRent,
        outstanding,
      };
    });
  }, [data.buildings, data.tenants, data.units]);
  const collectionRate = Number(data.summary.monthly_due || 0) > 0
    ? Math.round((Number(data.summary.monthly_collected || 0) / Number(data.summary.monthly_due || 0)) * 100)
    : 0;
  const selectedPayment = data.payments.find((payment) => payment.id === selectedPaymentId) || data.payments[0] || null;
  const lateTenantsCount = data.tenants.filter((tenant) => Number(tenant.balance || 0) > 0).length;
  const recentLandlordActivity = useMemo(() => {
    const paymentItems = data.payments.slice(0, 3).map((payment) => ({
      key: `payment-${payment.id}`,
      title: payment.tenant_name,
      note: `${payment.unit_label} • ${payment.paid_on ? formatDisplayDate(payment.paid_on) : "Awaiting confirmation"}`,
      amount: money(payment.amount),
      status: payment.status === "succeeded" || payment.status === "paid"
        ? "paid"
        : payment.status === "pending"
          ? "pending"
          : "late",
      accent: payment.status === "succeeded" || payment.status === "paid"
        ? t.successText
        : payment.status === "pending"
          ? t.warningText
          : t.dangerText,
    }));
    const lateTenant = data.tenants.find((tenant) => Number(tenant.balance || 0) > 0);
    if (lateTenant) {
      paymentItems.push({
        key: `late-${lateTenant.id}`,
        title: lateTenant.tenant_name,
        note: `${lateTenant.unit_label} • Balance outstanding`,
        amount: money(lateTenant.balance),
        status: "late",
        accent: t.dangerText,
      });
    }
    return paymentItems.slice(0, 4);
  }, [data.payments, data.tenants, t.dangerText, t.successText, t.warningText]);

  if (screen === "properties") {
    return (
      <LandlordPropertiesScreen
        data={data}
        token={token}
        onBack={() => transitionScreen("dashboard")}
        onOpenDashboard={() => transitionScreen("dashboard")}
        onOpenPayments={() => transitionScreen("payments")}
        onOpenTickets={() => transitionScreen("tickets")}
        onOpenInvite={() => transitionScreen("invite-tenant")}
        onOpenOnboardingStatus={() => transitionScreen("onboarding-status")}
        visible={screenVisible}
      />
    );
  }
  if (screen === "payments") {
    return (
      <LandlordPaymentsScreen
        data={data}
        onBack={() => transitionScreen("dashboard")}
        onOpenDashboard={() => transitionScreen("dashboard")}
        onOpenProperties={() => transitionScreen("properties")}
        onOpenTickets={() => transitionScreen("tickets")}
        onOpenDetail={(paymentId) => transitionScreen("payment-detail", { selectedPaymentId: paymentId })}
        onOpenHistory={() => transitionScreen("payment-history")}
        visible={screenVisible}
      />
    );
  }
  if (screen === "payment-detail" && selectedPayment) {
    return (
      <LandlordVerifyPaymentScreen
        payment={selectedPayment}
        onBack={() => transitionScreen("payments")}
        visible={screenVisible}
      />
    );
  }
  if (screen === "payment-history") {
    return (
      <LandlordTransactionHistoryScreen
        data={data}
        onBack={() => transitionScreen("payments")}
        visible={screenVisible}
      />
    );
  }
  if (screen === "onboarding-status") {
    return (
      <LandlordOnboardingStatusScreen
        data={data}
        token={token}
        onBack={() => transitionScreen("properties")}
        onOpenTenancy={(tenancyId) => transitionScreen("onboarding", { selectedTenancyId: tenancyId })}
        onInvite={() => transitionScreen("invite-tenant")}
        visible={screenVisible}
      />
    );
  }
  if (screen === "invite-tenant") {
    return (
      <LandlordInviteTenantScreen
        data={data}
        token={token}
        onBack={() => transitionScreen("properties")}
        onRefresh={onRefresh}
        visible={screenVisible}
      />
    );
  }
  if (screen === "unit-inspection" && selectedTenancyId) {
    return (
      <LandlordUnitInspectionScreen
        token={token}
        tenancyId={selectedTenancyId}
        onBack={() => transitionScreen("dashboard", { selectedTenancyId: null })}
        onRefresh={onRefresh}
        visible={screenVisible}
      />
    );
  }
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
    return (
      <TicketsScreen
        token={token}
        isLandlord={true}
        onBack={() => transitionScreen("dashboard")}
        visible={screenVisible}
        bottomTabs={[
          { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: () => transitionScreen("dashboard") },
          { key: "properties", icon: "🏢", label: "Properties", active: false, onPress: () => transitionScreen("properties") },
          { key: "payments", icon: "₹", label: "Payments", active: false, onPress: () => transitionScreen("payments") },
          { key: "tickets", icon: "🎫", label: "Tickets", active: true, onPress: () => {} },
        ]}
      />
    );
  }

  return (
    <AppearOnMount visible={screenVisible}>
      <View style={styles.stack}>
        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gradientHeroEyebrow}>Total Rent Collected</Text>
                <Text style={styles.gradientHeroTitle}>{money(data.summary.monthly_collected)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: t.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.16)", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 }]}>
                <Text style={[styles.badgeText, { color: t.onHero, fontSize: 18 }]}>₹</Text>
              </View>
            </View>
            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ backgroundColor: "#a0f399", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#217128", fontSize: 10, fontFamily: LABEL_FONT, letterSpacing: 0.8, textTransform: "uppercase" }}>Growth</Text>
              </View>
              <Text style={[styles.gradientHeroText, { flex: 1 }]}>
                Occupancy is {occupancyRate}% and collection rate is {collectionRate}% for {data.current_month}.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.summaryGrid, { alignItems: "stretch" }]}>
          <Pressable
            onPress={() => setSummaryDetail((current) => (current === "outstanding" ? null : "outstanding"))}
            style={[styles.summaryCard, styles.summaryCardInteractive, { minWidth: 180 }, summaryDetail === "outstanding" && styles.summaryCardActive]}
          >
            <Text style={{ fontSize: 20, marginBottom: 10, color: t.warningText }}>◌</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { fontSize: 24 }]}>{money(data.summary.monthly_outstanding)}</Text>
            <Text style={styles.summaryNote}>Tap for due details</Text>
          </Pressable>
          <Pressable
            onPress={() => setSummaryDetail((current) => (current === "outstanding" ? null : "outstanding"))}
            style={[styles.summaryCard, styles.summaryCardInteractive, { minWidth: 180 }, summaryDetail === "outstanding" && styles.summaryCardActive]}
          >
            <Text style={{ fontSize: 20, marginBottom: 10, color: t.dangerText }}>!</Text>
            <Text style={styles.summaryLabel}>Late Tenants</Text>
            <Text style={[styles.summaryValue, { fontSize: 24 }]}>{String(lateTenantsCount)}</Text>
            <Text style={styles.summaryNote}>Residents with unpaid balance</Text>
          </Pressable>
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
                      ? "Grouped by building with unit, tenant, total due, amount collected, and remaining balance."
                      : "Grouped by building with only the tenants who still have an unpaid balance this month."}
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

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <Text style={styles.panelTitle}>Key Metrics</Text>
            <Pressable onPress={() => transitionScreen("tickets")}>
              <Text style={[styles.rowMeta, { color: t.textSecondary }]}>⌁</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => transitionScreen("tickets")}
            style={[styles.tableRow, { marginTop: 12, backgroundColor: t.surfaceLowest, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 16 }]}
          >
            <View style={[styles.badge, { backgroundColor: t.primaryMuted, width: 44, height: 44, borderRadius: 14, justifyContent: "center" }]}>
              <Text style={[styles.badgeText, { color: t.accent, fontSize: 18 }]}>🎫</Text>
            </View>
            <View style={styles.tableMain}>
              <Text style={styles.rowTitle}>Open Tickets</Text>
              <Text style={styles.rowMeta}>Maintenance & Queries</Text>
            </View>
            <Text style={[styles.rowValue, { color: t.accent }]}>{String(dashboardTicketCount)}</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <Text style={styles.panelTitle}>Recent Activity</Text>
            <Pressable onPress={() => transitionScreen("payments")}>
              <Text style={[styles.summaryActionText, { marginTop: 0 }]}>View All</Text>
            </Pressable>
          </View>
          <View style={[styles.tableLike, { marginTop: 12 }]}>
            {recentLandlordActivity.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => transitionScreen(item.status === "late" ? "payments" : "payment-history")}
                style={[styles.tableRow, { backgroundColor: t.surfaceLowest, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 }]}
              >
                <View style={[styles.badge, { width: 46, height: 46, borderRadius: 23, backgroundColor: `${item.accent}22`, justifyContent: "center" }]}>
                  <Text style={[styles.badgeText, { color: item.accent, fontSize: 16 }]}>{item.title.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.tableMain}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>{item.note}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={[styles.rowValue, { color: item.accent }]}>{item.amount}</Text>
                  <View
                    style={[
                      styles.badge,
                      item.status === "paid" ? styles.goodBadge : item.status === "pending" ? styles.neutralBadge : styles.warnBadge,
                    ]}
                  >
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={() => transitionScreen("tickets")}
              style={[styles.tableRow, { backgroundColor: t.cardAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 }]}
            >
              <View style={[styles.badge, { width: 46, height: 46, borderRadius: 14, backgroundColor: t.primary, justifyContent: "center" }]}>
                <Text style={[styles.badgeText, { color: t.primaryText, fontSize: 18 }]}>🛠</Text>
              </View>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>Maintenance workspace</Text>
                <Text style={styles.rowMeta}>{dashboardTicketCount > 0 ? `${dashboardTicketCount} active requests to review` : "No unresolved tickets right now"}</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Portfolio Actions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionChip icon="🏢" label="Properties" active={false} onPress={() => transitionScreen("properties")} />
            <ActionChip icon="₹" label="Payments" active={false} onPress={() => transitionScreen("payments")} />
            <ActionChip icon="👤" label="Invite Tenant" active={false} onPress={() => transitionScreen("invite-tenant")} />
            <ActionChip icon="🧾" label="Onboarding" active={false} onPress={() => transitionScreen("onboarding-status")} />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Workspace Tools</Text>
          <Text style={styles.helper}>Keep setup, exports, and account actions available without taking over the main dashboard flow.</Text>

          {formMsg ? (
            <View style={[styles.banner, { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
              <Text style={[styles.bannerText, { flex: 1 }]}>{formMsg}</Text>
              {isUpgradePrompt ? (
                <Pressable
                  style={[styles.selectChip, { backgroundColor: t.primaryMuted }]}
                  onPress={() => transitionScreen("plans")}
                >
                  <Text style={[styles.selectChipText, { color: t.accent }]}>View Plans</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <ActionChip icon="🏢" label="Building" active={activeForm === "building"} onPress={() => openForm("building")} />
            <ActionChip icon="🚪" label="Unit" active={activeForm === "unit"} onPress={() => openForm("unit")} disabled={data.buildings.length === 0} />
            <ActionChip icon="🏦" label="Bank" active={activeForm === "bank"} onPress={() => openForm("bank")} />
            <ActionChip icon="👤" label="Assign" active={activeForm === "tenancy"} onPress={() => openForm("tenancy")} />
            <ActionChip icon="◈" label="Plans" active={false} onPress={() => transitionScreen("plans")} />
            <ActionChip icon="📈" label="Analytics" active={false} onPress={() => transitionScreen("analytics")} />
          </View>

          <AppearOnMount visible={activeForm === "building"} unmountOnExit>
            {activeForm === "building" ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>Add building</Text>
                <Field label="Name" value={bName} onChangeText={setBName} />
                <AddressSearch value={bAddress} onSelect={setBAddress} />
                <PrimaryButton
                  label={formBusy ? "Creating..." : "Create Building"}
                  disabled={formBusy || !bName.trim()}
                  onPress={async () => {
                    setFormBusy(true);
                    try {
                      await createBuilding(token, { name: bName, address: bAddress });
                      setFormMsg(`✓ Building "${bName}" created`);
                      setBName("");
                      setBAddress("");
                      setActiveForm(null);
                      onRefresh();
                    } catch (e) {
                      setFormMsg(readError(e));
                    }
                    setFormBusy(false);
                  }}
                  fullWidth
                />
              </View>
            ) : null}
          </AppearOnMount>

          <AppearOnMount visible={activeForm === "unit"} unmountOnExit>
            {activeForm === "unit" ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>Add unit</Text>
                <Text style={styles.fieldLabel}>Select building</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {data.buildings.map((building) => (
                    <Pressable
                      key={building.id}
                      style={[styles.selectChip, selectedBuildingId === building.id && styles.selectChipActive]}
                      onPress={() => setSelectedBuildingId(building.id)}
                    >
                      <Text style={[styles.selectChipText, selectedBuildingId === building.id && styles.selectChipTextActive]}>
                        {building.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={[styles.formGrid, { marginTop: 10 }]}>
                  <Field label="Unit label" value={uLabel} onChangeText={setULabel} placeholder="e.g. 2B or Penthouse A" />
                  <Field label="Monthly rent (₹)" value={uRent} onChangeText={setURent} keyboardType="numeric" />
                </View>
                <PrimaryButton
                  label={formBusy ? "Creating..." : "Create Unit"}
                  disabled={formBusy || !selectedBuildingId || !uLabel.trim() || !uRent.trim()}
                  onPress={async () => {
                    setFormBusy(true);
                    try {
                      await createUnit(token, { building_id: selectedBuildingId!, label: uLabel, monthly_rent: uRent });
                      setFormMsg(`✓ Unit "${uLabel}" created`);
                      setSelectedBuildingId(null);
                      setULabel("");
                      setURent("");
                      setActiveForm(null);
                      onRefresh();
                    } catch (e) {
                      setFormMsg(readError(e));
                    }
                    setFormBusy(false);
                  }}
                  fullWidth
                />
              </View>
            ) : null}
          </AppearOnMount>

          <AppearOnMount visible={activeForm === "bank"} unmountOnExit>
            {activeForm === "bank" ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>Add bank account</Text>
                <View style={styles.formGrid}>
                  <Field label="Bank name" value={bankName} onChangeText={setBankName} />
                  <Field label="Account holder name" value={accName} onChangeText={setAccName} />
                  <Field label="Account number" value={accNumber} onChangeText={setAccNumber} keyboardType="numeric" />
                  <Field label="IFSC code" value={ifsc} onChangeText={setIfsc} />
                </View>
                <PrimaryButton
                  label={formBusy ? "Creating..." : "Add Bank Account"}
                  disabled={formBusy || !bankName.trim() || !accNumber.trim()}
                  onPress={async () => {
                    setFormBusy(true);
                    try {
                      await createBankAccount(token, { bank_name: bankName, account_name: accName, account_number: accNumber, ifsc });
                      setFormMsg("✓ Bank account added");
                      setBankName("");
                      setAccName("");
                      setAccNumber("");
                      setIfsc("");
                      setActiveForm(null);
                      onRefresh();
                    } catch (e) {
                      setFormMsg(readError(e));
                    }
                    setFormBusy(false);
                  }}
                  fullWidth
                />
              </View>
            ) : null}
          </AppearOnMount>

          <AppearOnMount visible={activeForm === "tenancy"} unmountOnExit>
            {activeForm === "tenancy" ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>Assign tenant to vacant unit</Text>
                <Text style={styles.helper}>Enter the tenant code or tenant email, then choose a vacant unit.</Text>
                <Field label="Tenant code or email" value={tenantIdentifier} onChangeText={setTenantIdentifier} />
                <Text style={styles.fieldLabel}>Vacant units</Text>
                <View style={{ gap: 8 }}>
                  {unoccupiedUnits.length === 0 ? (
                    <Text style={styles.helper}>All units are currently occupied.</Text>
                  ) : (
                    unoccupiedUnits.map((unit) => (
                      <Pressable
                        key={unit.id}
                        style={[styles.selectChip, selectedUnitId === unit.id && styles.selectChipActive, { paddingVertical: 10 }]}
                        onPress={() => setSelectedUnitId(unit.id)}
                      >
                        <Text style={[styles.selectChipText, selectedUnitId === unit.id && styles.selectChipTextActive]}>
                          {unit.building_name} / {unit.label} — {money(unit.monthly_rent)}/mo
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
                {unoccupiedUnits.length > 0 ? (
                  <PrimaryButton
                    label={formBusy ? "Assigning..." : "Assign Tenant"}
                    disabled={formBusy || !tenantIdentifier.trim() || !selectedUnitId}
                    onPress={async () => {
                      setFormBusy(true);
                      try {
                        await createTenancy(token, { tenant_identifier: tenantIdentifier, unit_id: selectedUnitId! });
                        setFormMsg("✓ Tenant assigned successfully");
                        setTenantIdentifier("");
                        setSelectedUnitId(null);
                        setActiveForm(null);
                        onRefresh();
                      } catch (e) {
                        setFormMsg(readError(e));
                      }
                      setFormBusy(false);
                    }}
                    fullWidth
                  />
                ) : null}
              </View>
            ) : null}
          </AppearOnMount>

          {sub?.has_reports ? (
            <View style={[styles.banner, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerText}>Export your payment report in the format you need.</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <ActionChip
                  icon="📊"
                  label={exportBusy ? "Exporting..." : "Excel"}
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

          {exportMessage ? (
            <Text
              style={[
                styles.helper,
                {
                  marginTop: 8,
                  color: exportMessage.startsWith("Downloaded") ? t.successText : t.dangerText,
                },
              ]}
            >
              {exportMessage}
            </Text>
          ) : null}
        </View>

        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: true, onPress: () => {} },
            { key: "properties", icon: "🏢", label: "Properties", active: false, onPress: () => transitionScreen("properties") },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: () => transitionScreen("payments") },
            { key: "tickets", icon: "🎫", label: "Tickets", active: false, onPress: () => transitionScreen("tickets") },
          ]}
        />
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
  const [tenantScreen, setTenantScreen] = useState<"dashboard" | "payments" | "maintenance" | "management">("dashboard");
  const [tenantScreenVisible, setTenantScreenVisible] = useState(true);
  const pendingTenantScreenTransition = useRef<null | (() => void)>(null);

  const transitionTenantScreen = useCallback((nextScreen: "dashboard" | "payments" | "maintenance" | "management") => {
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
  const outstandingAmount = Number(data.current_month_balance || 0);
  const totalPaidAmount = Number(data.current_month_paid || 0);
  const monthlyRentAmount = Number(data.tenancy.monthly_rent || 0);
  const paidPercent = monthlyRentAmount > 0 ? Math.round((totalPaidAmount / monthlyRentAmount) * 100) : 0;
  const recentActivity = [
    ...data.payments.slice(0, 3).map((payment) => ({
      key: `payment-${payment.id}`,
      title: payment.status === "succeeded" || payment.status === "paid" ? "Rent Payment Recorded" : "Payment Update",
      note: `${money(payment.amount)} • ${payment.rent_month}`,
      meta: payment.paid_on ? formatDisplayDate(payment.paid_on) : "Awaiting confirmation",
      accent: payment.status === "succeeded" || payment.status === "paid" ? t.successText : payment.status === "pending" ? t.warningText : t.textSecondary,
    })),
    {
      key: "move-in",
      title: "Tenancy Activated",
      note: `${data.tenancy.building_name} / ${data.tenancy.unit_label}`,
      meta: formatDisplayDate(data.tenancy.start_date),
      accent: t.accent,
    },
  ].slice(0, 4);
  const totalLifetimePaid = data.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (tenantScreen === "payments") {
    return (
      <TenantPaymentsReferenceScreen
        data={data}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        onSubmit={onSubmit}
        busy={busy}
        onBack={() => transitionTenantScreen("dashboard")}
        onOpenMaintenance={() => transitionTenantScreen("maintenance")}
        onOpenManagement={() => transitionTenantScreen("management")}
        visible={tenantScreenVisible}
      />
    );
  }
  if (tenantScreen === "maintenance") {
    return (
      <TicketsScreen
        token={token}
        isLandlord={false}
        onBack={() => transitionTenantScreen("dashboard")}
        visible={tenantScreenVisible}
        bottomTabs={[
          { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: () => transitionTenantScreen("dashboard") },
          { key: "payments", icon: "₹", label: "Payments", active: false, onPress: () => transitionTenantScreen("payments") },
          { key: "maintenance", icon: "🛠", label: "Maintenance", active: true, onPress: () => {} },
          { key: "management", icon: "📄", label: "Management", active: false, onPress: () => transitionTenantScreen("management") },
        ]}
      />
    );
  }
  if (tenantScreen === "management") {
    return (
      <TenantLeaseManagementScreen
        token={token}
        tenancyId={data.tenancy.id}
        onBack={() => transitionTenantScreen("dashboard")}
        visible={tenantScreenVisible}
      />
    );
  }

  return (
    <AppearOnMount visible={tenantScreenVisible}>
      <View style={styles.stack}>
        <View style={{ gap: 6 }}>
          <Text style={styles.helper}>Welcome back, {user.first_name || user.username}</Text>
          <Text style={[styles.panelTitle, { color: t.accent }]}>Your Tenancy</Text>
        </View>

        <LinearGradient
          colors={[t.heroStart, t.primaryStrong]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <View style={[styles.badge, { alignSelf: "flex-start", backgroundColor: outstandingAmount > 0 ? "#ff635b" : "#a0f399", marginBottom: 12 }]}>
                  <Text style={[styles.badgeText, { color: outstandingAmount > 0 ? "#ffffff" : "#217128" }]}>{outstandingAmount > 0 ? "Pending" : "Paid"}</Text>
                </View>
                <Text style={[styles.panelTitle, { color: t.onHero }]}>{outstandingAmount > 0 ? "Current Rent Due" : "Rent Cleared"}</Text>
                <Text style={[styles.gradientHeroText, { marginTop: 8 }]}>
                  {data.tenancy.building_name}, {data.tenancy.unit_label} • {outstandingAmount > 0 ? `For ${data.current_month}` : `Paid for ${data.current_month}`}
                </Text>
              </View>
              <Text style={[styles.gradientHeroTitle, { fontSize: 34 }]}>{money(outstandingAmount || monthlyRentAmount)}</Text>
            </View>
            <View style={{ marginTop: 18 }}>
              <PrimaryButton label={busy ? "Processing..." : "Pay Now →"} onPress={onSubmit} disabled={busy} fullWidth />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.summaryGrid}>
          <Pressable
            style={[styles.panel, { flexBasis: "100%", flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
            onPress={() => transitionTenantScreen("maintenance")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flex: 1 }}>
              <View style={[styles.badge, { width: 48, height: 48, borderRadius: 14, backgroundColor: t.warning, justifyContent: "center" }]}>
                <Text style={[styles.badgeText, { color: t.warningText, fontSize: 18 }]}>🛠</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Raise Maintenance Ticket</Text>
                <Text style={styles.rowMeta}>Tap to report an issue</Text>
              </View>
            </View>
            <Text style={[styles.rowMeta, { fontSize: 18 }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.summaryCard, { minWidth: 180 }]} onPress={() => transitionTenantScreen("payments")}>
            <View style={[styles.badge, { width: 40, height: 40, borderRadius: 12, backgroundColor: t.primaryMuted, justifyContent: "center", marginBottom: 14 }]}>
              <Text style={[styles.badgeText, { color: t.accent, fontSize: 16 }]}>🕘</Text>
            </View>
            <Text style={styles.rowTitle}>View Payment History</Text>
          </Pressable>

          <Pressable style={[styles.summaryCard, { minWidth: 180 }]} onPress={() => transitionTenantScreen("management")}>
            <View style={[styles.badge, { width: 40, height: 40, borderRadius: 12, backgroundColor: t.success, justifyContent: "center", marginBottom: 14 }]}>
              <Text style={[styles.badgeText, { color: t.successText, fontSize: 16 }]}>📄</Text>
            </View>
            <Text style={styles.rowTitle}>Lease Management</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Recent Activity</Text>
          <View style={{ gap: 18, marginTop: 10 }}>
            {recentActivity.map((item, index) => (
              <View key={item.key} style={{ flexDirection: "row", gap: 14 }}>
                <View style={{ alignItems: "center" }}>
                  <View style={[styles.badge, { width: 34, height: 34, borderRadius: 17, backgroundColor: `${item.accent}22`, justifyContent: "center" }]}>
                    <Text style={[styles.badgeText, { color: item.accent }]}>{index === 0 ? "✓" : index === 1 ? "•" : "○"}</Text>
                  </View>
                  {index < recentActivity.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 28, backgroundColor: t.border, marginTop: 6 }} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: index < recentActivity.length - 1 ? 8 : 0 }}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>{item.note}</Text>
                  <Text style={[styles.rowMeta, { marginTop: 2 }]}>{item.meta}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.panelTitle}>Financial Summary</Text>
            <Text style={[styles.summaryActionText, { marginTop: 0, color: t.successText }]}>Live</Text>
          </View>
          <View style={[styles.tableRow, { marginTop: 14, backgroundColor: t.cardAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 16 }]}>
            <View style={styles.tableMain}>
              <Text style={styles.summaryLabel}>Total Paid</Text>
              <Text style={[styles.summaryValue, { fontSize: 24 }]}>{money(totalLifetimePaid)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={[styles.summaryValue, { fontSize: 24, color: outstandingAmount > 0 ? t.dangerText : t.successText }]}>{money(outstandingAmount)}</Text>
            </View>
          </View>
          <Text style={styles.helper}>Your tenant code is {user.tenant_code || "not available"} and this cycle is {paidPercent}% paid.</Text>
        </View>

        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: true, onPress: () => {} },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: () => transitionTenantScreen("payments") },
            { key: "maintenance", icon: "🛠", label: "Maintenance", active: false, onPress: () => transitionTenantScreen("maintenance") },
            { key: "management", icon: "📄", label: "Management", active: false, onPress: () => transitionTenantScreen("management") },
          ]}
        />
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
          <ActionChip icon="◈" label="Plans" active={true} onPress={() => {}} />
        </View>
        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Subscription</Text>
            <Text style={styles.gradientHeroTitle}>Plans and billing</Text>
            <Text style={styles.gradientHeroText}>
              Scale from a starter landlord setup to analytics, exports, and larger portfolios without leaving the app.
            </Text>
          </View>
        </LinearGradient>

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
          <ActionChip icon="₹" label="Analytics" active={true} onPress={() => {}} />
        </View>
        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Insights</Text>
            <Text style={styles.gradientHeroTitle}>Performance analytics</Text>
            <Text style={styles.gradientHeroText}>
              Monitor revenue, occupancy, collections, and premium drilldowns through a single editorial dashboard.
            </Text>
          </View>
        </LinearGradient>

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
        <Text style={styles.panelTitle}>Welcome, {user.first_name || user.username}</Text>
        <Text style={styles.helper}>
          Your account is ready. The final step is having your landlord assign this tenant code to a unit.
        </Text>

        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Tenant Code</Text>
            <Text style={[styles.gradientHeroTitle, { fontSize: 30, lineHeight: 34 }]}>{user.tenant_code}</Text>
            <Text style={styles.gradientHeroText}>
              Share this code with your landlord so they can link you to your unit and unlock your full tenancy dashboard.
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>What happens next</Text>
          <Text style={[styles.helper, { marginTop: 8 }]}>1. Share your code {user.tenant_code} with your landlord</Text>
          <Text style={styles.helper}>2. They assign you to a specific building and unit</Text>
          <Text style={styles.helper}>3. Your dashboard updates with rent, onboarding, and payment history</Text>
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
  const location = useLocationState();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (text: string) => {
    if (text.length < 3) { setResults([]); setOpen(false); return; }
    try {
      const params = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        countrycodes: "in",
        limit: "5",
        q: text,
      });
      if (location.coords) {
        const latRadius = 0.45;
        const lonRadius = Math.max(
          0.45,
          latRadius / Math.max(Math.cos((location.coords.latitude * Math.PI) / 180), 0.35),
        );
        params.set(
          "viewbox",
          [
            location.coords.longitude - lonRadius,
            location.coords.latitude + latRadius,
            location.coords.longitude + lonRadius,
            location.coords.latitude - latRadius,
          ].join(","),
        );
      }
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const res = await fetch(url, { headers: { "User-Agent": "RentFlo/1.0" } });
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
      setOpen(false);
    }
  }, [location.coords]);

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
    setLocating(true);
    try {
      const coords = location.coords ?? await location.refresh();
      if (!coords) {
        return;
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18`;
      const res = await fetch(url, { headers: { "User-Agent": "RentFlo/1.0" } });
      const data = await res.json();
      const addr = data.display_name || `${coords.latitude}, ${coords.longitude}`;
      setQuery(addr);
      onSelect(addr);
    } catch {
      // Keep the existing input if reverse lookup fails.
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Address</Text>
      <View style={{ position: "relative" as const, zIndex: open ? 20 : 1 }}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          placeholder="Search address or area in India..."
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
      {!open ? (
        <Pressable
          style={styles.locationButton}
          onPress={useCurrentLocation}
          disabled={locating}
        >
          <Text style={{ fontSize: 14 }}>{locating ? "⏳" : "📍"}</Text>
          <Text style={styles.locationButtonText}>{locating ? "Locating..." : "Use current location"}</Text>
        </Pressable>
      ) : null}
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
  const { t, s: styles } = useT();
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
        variant === "primary" && { paddingHorizontal: 0, paddingVertical: 0 },
        fullWidth && { alignSelf: "stretch" as const },
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[t.primary, t.primaryStrong]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.buttonGradient, fullWidth && { alignSelf: "stretch" as const, width: "100%" }]}
        >
          <Text style={textStyle}>{label}</Text>
        </LinearGradient>
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
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

function ScreenTitleBlock({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { t, s: styles } = useT();
  return (
    <View style={{ gap: 10 }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={{
            alignSelf: "flex-start",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: t.cardAlt,
          }}
        >
          <Text style={[styles.rowMeta, { color: t.accent }]}>← Back</Text>
        </Pressable>
      ) : null}
      <View style={{ gap: 4 }}>
        <Text style={[styles.panelTitle, { color: t.accent }]}>{title}</Text>
        {subtitle ? <Text style={styles.helper}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function BottomTabBar({
  items,
}: {
  items: BottomTabItem[];
}) {
  const bottomTabs = useContext(BottomTabsContext);

  useEffect(() => {
    bottomTabs?.setItems(items);
    return () => {
      bottomTabs?.setItems(null);
    };
  }, [bottomTabs, items]);

  return null;
}

function BottomTabBarView({
  items,
}: {
  items: BottomTabItem[];
}) {
  const { t } = useT();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: t.surfaceLowest,
        shadowColor: t.shadow,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: t.mode === "dark" ? 0.4 : 0.12,
        shadowRadius: 24,
        elevation: 10,
        ...(Platform.OS === "web"
          ? ({
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            } as any)
          : {}),
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: item.active ? t.primaryMuted : "transparent",
          }}
        >
          <Text style={{ fontSize: 16 }}>{item.icon}</Text>
          <Text
            style={{
              color: item.active ? t.accent : t.textSecondary,
              fontSize: 11,
              fontFamily: BODY_FONT_SEMIBOLD,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LandlordPropertiesScreen({
  data,
  onBack,
  onOpenDashboard,
  onOpenPayments,
  onOpenTickets,
  onOpenInvite,
  onOpenOnboardingStatus,
  visible = true,
}: {
  data: LandlordDashboard;
  token: string;
  onBack: () => void;
  onOpenDashboard: () => void;
  onOpenPayments: () => void;
  onOpenTickets: () => void;
  onOpenInvite: () => void;
  onOpenOnboardingStatus: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const properties = useMemo(() => {
    return data.buildings.map((building) => {
      const units = data.units.filter((unit) => unit.building === building.id);
      const occupied = data.tenants.filter((tenant) => tenant.building_name === building.name).length;
      const vacant = Math.max(units.length - occupied, 0);
      return {
        ...building,
        unitCount: units.length,
        occupied,
        vacant,
        service: 0,
      };
    });
  }, [data.buildings, data.tenants, data.units]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock
          title="Properties"
          subtitle="Search your portfolio, review occupancy, and jump into rent collection or onboarding."
          onBack={onBack}
        />

        <View style={styles.panel}>
          <TextInput
            style={styles.input}
            value=""
            editable={false}
            placeholder="Search properties..."
            placeholderTextColor={t.textSecondary}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={[styles.selectChip, styles.selectChipActive]}>
              <Text style={[styles.selectChipText, styles.selectChipTextActive]}>All Units</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Occupied</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Vacant</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Maintenance</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableLike}>
          {properties.map((property) => (
            <View key={property.id} style={styles.panel}>
              <Text style={styles.panelTitle}>{property.name}</Text>
              <Text style={styles.helper}>{property.address}</Text>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, { minWidth: 110 }]}>
                  <Text style={styles.summaryLabel}>Occupied</Text>
                  <Text style={styles.summaryValue}>{String(property.occupied)}</Text>
                </View>
                <View style={[styles.summaryCard, { minWidth: 110 }]}>
                  <Text style={styles.summaryLabel}>Vacant</Text>
                  <Text style={styles.summaryValue}>{String(property.vacant)}</Text>
                </View>
                <View style={[styles.summaryCard, { minWidth: 110 }]}>
                  <Text style={styles.summaryLabel}>Units</Text>
                  <Text style={styles.summaryValue}>{String(property.unitCount)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <PrimaryButton label="Payments" onPress={onOpenPayments} />
                <PrimaryButton label="Invite Tenant" onPress={onOpenInvite} variant="secondary" />
                <PrimaryButton label="Onboarding Queue" onPress={onOpenOnboardingStatus} variant="secondary" />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Expand Portfolio</Text>
          <Text style={styles.helper}>Use the landlord dashboard operations deck to add new buildings and units, then return here to manage them.</Text>
          <PrimaryButton label="Invite New Tenant" onPress={onOpenInvite} />
        </View>

        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: onOpenDashboard },
            { key: "properties", icon: "🏢", label: "Properties", active: true, onPress: () => {} },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: onOpenPayments },
            { key: "tickets", icon: "🎫", label: "Tickets", active: false, onPress: onOpenTickets },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function LandlordPaymentsScreen({
  data,
  onBack,
  onOpenDashboard,
  onOpenProperties,
  onOpenTickets,
  onOpenDetail,
  onOpenHistory,
  visible = true,
}: {
  data: LandlordDashboard;
  onBack: () => void;
  onOpenDashboard: () => void;
  onOpenProperties: () => void;
  onOpenTickets: () => void;
  onOpenDetail: (paymentId: number) => void;
  onOpenHistory: () => void;
  visible?: boolean;
}) {
  const { s: styles } = useT();
  const pendingPayments = data.payments.filter((payment) => payment.status !== "succeeded" && payment.status !== "paid");

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock
          title="Payments"
          subtitle="Manage your cashflow and verify receipts."
          onBack={onBack}
        />

        <View style={styles.panel}>
          <TextInput style={styles.input} value="" editable={false} placeholder="Search by tenant name..." />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={[styles.selectChip, styles.selectChipActive]}>
              <Text style={[styles.selectChipText, styles.selectChipTextActive]}>All</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Paid</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Pending</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Late</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text style={styles.sectionKicker}>Pending Confirmation</Text>
            <Pressable onPress={onOpenHistory}>
              <Text style={[styles.rowMeta, { fontSize: 12 }]}>History</Text>
            </Pressable>
          </View>
          <View style={styles.tableLike}>
            {pendingPayments.length === 0 ? (
              <Text style={styles.helper}>No reported cash receipts are waiting for confirmation.</Text>
            ) : (
              pendingPayments.map((payment) => (
                <View key={payment.id} style={[styles.tableRow, { borderLeftWidth: 3, borderLeftColor: "#ff635b" }]}>
                  <View style={styles.tableMain}>
                    <Text style={styles.rowTitle}>{payment.tenant_name}</Text>
                    <Text style={styles.rowMeta}>{payment.building_name} • {payment.unit_label}</Text>
                  </View>
                  <View style={styles.tableNumbers}>
                    <Text style={styles.rowValue}>{money(payment.amount)}</Text>
                    <Text style={styles.rowMeta}>{payment.status.replaceAll("_", " ")}</Text>
                  </View>
                  <PrimaryButton label="Confirm Receipt" onPress={() => onOpenDetail(payment.id)} />
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text style={styles.sectionKicker}>Recent Transactions</Text>
            <Pressable onPress={onOpenHistory}>
              <Text style={[styles.rowMeta, { fontSize: 12 }]}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.tableLike}>
            {data.payments.slice(0, 5).map((payment) => (
              <View key={payment.id} style={styles.tableRow}>
                <View style={styles.tableMain}>
                  <Text style={styles.rowTitle}>{payment.tenant_name}</Text>
                  <Text style={styles.rowMeta}>{payment.rent_month} • {payment.bank_name}</Text>
                </View>
                <View style={styles.tableNumbers}>
                  <Text style={styles.rowValue}>{money(payment.amount)}</Text>
                  <Text style={styles.rowMeta}>{payment.paid_on || "Awaiting"}</Text>
                </View>
                <StatusBadge status={payment.status} />
              </View>
            ))}
          </View>
        </View>

        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: onOpenDashboard },
            { key: "properties", icon: "🏢", label: "Properties", active: false, onPress: onOpenProperties },
            { key: "payments", icon: "₹", label: "Payments", active: true, onPress: () => {} },
            { key: "tickets", icon: "🎫", label: "Tickets", active: false, onPress: onOpenTickets },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function LandlordVerifyPaymentScreen({
  payment,
  onBack,
  visible = true,
}: {
  payment: LandlordDashboard["payments"][number];
  onBack: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [message, setMessage] = useState("");

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Verify Payment" subtitle="Review the reported payment details before updating the ledger." onBack={onBack} />

        <View style={[styles.panel, { alignItems: "center" }]}>
          <Text style={styles.summaryLabel}>Cash Payment Reported</Text>
          <Text style={[styles.summaryValue, { marginTop: 4 }]}>{money(payment.amount)}</Text>
          <Text style={styles.summaryNote}>{payment.rent_month}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Tenant</Text>
          <Text style={styles.panelTitle}>{payment.tenant_name}</Text>
          <Text style={styles.helper}>{payment.unit_label}, {payment.building_name}</Text>
          <View style={styles.tableLike}>
            <View style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowMeta}>Payment type</Text>
              </View>
              <Text style={styles.rowValue}>{payment.bank_name || "Cash"}</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowMeta}>Reported on</Text>
              </View>
              <Text style={styles.rowValue}>{payment.paid_on || "Awaiting timestamp"}</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowMeta}>Reference</Text>
              </View>
              <Text style={styles.rowValue}>{payment.reference || "No receipt attached"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Verification Policy</Text>
          <Text style={styles.helper}>By confirming receipt, you acknowledge the physical collection of this rent amount and notify the tenant through the updated ledger.</Text>
          {message ? <Text style={[styles.helper, { color: t.accent }]}>{message}</Text> : null}
          <PrimaryButton label="Confirm Receipt" onPress={() => setMessage("Receipt confirmation UI completed. Hook this to a landlord receipt-confirmation endpoint when available.")} fullWidth />
          <PrimaryButton label="Decline & Raise Dispute" onPress={() => setMessage("Dispute flow placeholder added to match the reference flow.")} variant="secondary" fullWidth />
        </View>
      </View>
    </AppearOnMount>
  );
}

function LandlordTransactionHistoryScreen({
  data,
  onBack,
  visible = true,
}: {
  data: LandlordDashboard;
  onBack: () => void;
  visible?: boolean;
}) {
  const { s: styles } = useT();
  const totalRevenue = data.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidCount = data.payments.filter((payment) => payment.status === "succeeded" || payment.status === "paid").length;
  const pendingCount = Math.max(data.payments.length - paidCount, 0);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Transaction History" subtitle="Detailed overview of all financial activities across your portfolio." onBack={onBack} />

        <View style={styles.summaryGrid}>
          <SummaryCard label="Total Revenue" value={money(totalRevenue)} note="Across all payments" />
          <SummaryCard label="Successfully Paid" value={String(paidCount)} note="Ledger entries cleared" />
          <SummaryCard label="Awaiting Action" value={String(pendingCount)} note="Pending or late items" />
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={[styles.selectChip, styles.selectChipActive]}>
              <Text style={[styles.selectChipText, styles.selectChipTextActive]}>All</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Paid</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Pending</Text>
            </View>
            <View style={styles.selectChip}>
              <Text style={styles.selectChipText}>Late</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableLike}>
          {data.payments.map((payment) => (
            <View key={payment.id} style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>{payment.tenant_name}</Text>
                <Text style={styles.rowMeta}>{payment.unit_label} • {payment.rent_month}</Text>
              </View>
              <View style={styles.tableNumbers}>
                <Text style={styles.rowValue}>{money(payment.amount)}</Text>
                <Text style={styles.rowMeta}>{payment.status.replaceAll("_", " ")}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </AppearOnMount>
  );
}

function LandlordOnboardingStatusScreen({
  data,
  token,
  onBack,
  onOpenTenancy,
  onInvite,
  visible = true,
}: {
  data: LandlordDashboard;
  token: string;
  onBack: () => void;
  onOpenTenancy: (tenancyId: number) => void;
  onInvite: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Array<{ tenant: LandlordDashboard["tenants"][number]; status: OnboardingStatus | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      data.tenants.map(async (tenant) => {
        try {
          const status = await fetchOnboardingStatus(token, tenant.id);
          return { tenant, status };
        } catch {
          return { tenant, status: null };
        }
      }),
    )
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data.tenants, token]);

  const activeFunnel = items.filter((item) => item.status?.onboarding_status !== "completed").length;
  const idVerified = items.filter((item) => item.status?.documents.some((doc) => doc.verified)).length;
  const waitingDeposit = items.filter((item) => item.status?.onboarding_status === "pending_deposit").length;

  const progressForStatus = (status: OnboardingStatus | null) => {
    switch (status?.onboarding_status) {
      case "pending_deposit":
        return 50;
      case "pending_agreement":
        return 75;
      case "pending_first_rent":
        return 90;
      case "completed":
        return 100;
      default:
        return 25;
    }
  };

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Onboarding Status" subtitle="Monitor verification cycles, deposits, and agreement progress for upcoming residents." onBack={onBack} />

        <View style={styles.summaryGrid}>
          <SummaryCard label="Active Funnel" value={String(activeFunnel)} note="Tenants not fully onboarded" />
          <SummaryCard label="ID Verified" value={String(idVerified)} note="Document checks passed" />
          <SummaryCard label="Waiting Deposit" value={String(waitingDeposit)} note="Action required" />
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text style={styles.panelTitle}>Applicant Queue</Text>
            <PrimaryButton label="Invite New Tenant" onPress={onInvite} variant="secondary" />
          </View>
          {loading ? <ActivityIndicator color={t.accent} /> : null}
          <View style={styles.tableLike}>
            {items.map(({ tenant, status }) => {
              const progress = progressForStatus(status);
              return (
                <View key={tenant.id} style={styles.tableRow}>
                  <View style={styles.tableMain}>
                    <Text style={styles.rowTitle}>{tenant.tenant_name}</Text>
                    <Text style={styles.rowMeta}>{tenant.building_name}, {tenant.unit_label}</Text>
                    <View style={{ height: 6, borderRadius: 4, backgroundColor: t.border, marginTop: 10, overflow: "hidden" }}>
                      <View style={{ height: 6, width: `${progress}%`, backgroundColor: progress >= 100 ? t.successText : t.accent }} />
                    </View>
                    <Text style={[styles.rowMeta, { marginTop: 6 }]}>{progress}% complete</Text>
                  </View>
                  <View style={{ gap: 8, alignItems: "flex-end" }}>
                    <StatusBadge status={status?.onboarding_status || "pending_documents"} />
                    <PrimaryButton label="Open" onPress={() => onOpenTenancy(tenant.id)} variant="secondary" />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: onBack },
            { key: "properties", icon: "🏢", label: "Properties", active: true, onPress: onBack },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: onBack },
            { key: "tickets", icon: "🎫", label: "Tickets", active: false, onPress: onBack },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function LandlordInviteTenantScreen({
  data,
  token,
  onBack,
  onRefresh,
  visible = true,
}: {
  data: LandlordDashboard;
  token: string;
  onBack: () => void;
  onRefresh: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const vacantUnits = data.units.filter(
    (unit) => !data.tenants.some((tenant) => tenant.unit_label === unit.label && tenant.building_name === unit.building_name),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(vacantUnits[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedUnitId && vacantUnits[0]) {
      setSelectedUnitId(vacantUnits[0].id);
      setMonthlyRent(vacantUnits[0].monthly_rent);
    }
  }, [selectedUnitId, vacantUnits]);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Invite New Tenant" subtitle="Use an existing tenant email or tenant code to assign a vacant unit and start onboarding." onBack={onBack} />

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Identity & Contact</Text>
          <View style={styles.formGrid}>
            <Field label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Rahul Sharma" />
            <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="rahul@example.com" />
            <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="98765 43210" keyboardType="phone-pad" />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Lease & Financials</Text>
          <View style={styles.formGrid}>
            <Field label="Lease Start Date" value={leaseStart} onChangeText={setLeaseStart} placeholder="dd/mm/yyyy" />
            <Field label="Monthly Rent (₹)" value={monthlyRent} onChangeText={setMonthlyRent} keyboardType="numeric" />
            <Field label="Security Deposit (₹)" value={securityDeposit} onChangeText={setSecurityDeposit} keyboardType="numeric" />
          </View>
          <Text style={styles.fieldLabel}>Assign to vacant unit</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {vacantUnits.map((unit) => (
              <Pressable
                key={unit.id}
                style={[styles.selectChip, selectedUnitId === unit.id && styles.selectChipActive]}
                onPress={() => {
                  setSelectedUnitId(unit.id);
                  setMonthlyRent(unit.monthly_rent);
                }}
              >
                <Text style={[styles.selectChipText, selectedUnitId === unit.id && styles.selectChipTextActive]}>
                  {unit.building_name} / {unit.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {message ? <Text style={[styles.helper, { color: message.startsWith("✓") ? t.successText : t.dangerText }]}>{message}</Text> : null}
          <PrimaryButton
            label={busy ? "Sending..." : "Send Invitation"}
            disabled={busy || !email.trim() || !selectedUnitId}
            onPress={async () => {
              setBusy(true);
              setMessage("");
              try {
                await createTenancy(token, { tenant_identifier: email.trim(), unit_id: selectedUnitId! });
                setMessage("✓ Invitation flow mapped: tenant linked to the selected unit.");
                onRefresh();
              } catch (error) {
                setMessage(readError(error));
              } finally {
                setBusy(false);
              }
            }}
            fullWidth
          />
          <Text style={styles.helper}>The backend currently links an existing tenant by email or tenant code. A true magic-link invite endpoint would complete this reference flow.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Privacy & Trust</Text>
          <Text style={styles.helper}>RentFlo encrypts tenant information. You’ll be notified as they complete document checks and agreement steps.</Text>
        </View>
      </View>
    </AppearOnMount>
  );
}

function LandlordUnitInspectionScreen({
  token,
  tenancyId,
  onBack,
  onRefresh,
  visible = true,
}: {
  token: string;
  tenancyId: number;
  onBack: () => void;
  onRefresh: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<OffboardingInfo | null>(null);
  const [notStarted, setNotStarted] = useState(false);
  const [message, setMessage] = useState("");
  const [deductions, setDeductions] = useState("");
  const [reasons, setReasons] = useState("");
  const [handoffDocUrl, setHandoffDocUrl] = useState("");
  const [checklist, setChecklist] = useState({
    walls: "pass",
    plumbing: "pass",
    electrical: "pass",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOffboardingDetail(token, tenancyId);
      setDetail(result);
      setNotStarted(false);
    } catch (error) {
      if (readError(error).includes("not initiated")) {
        setNotStarted(true);
        setDetail(null);
      } else {
        setMessage(readError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [tenancyId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStart = async () => {
    setBusy(true);
    setMessage("");
    try {
      await initiateOffboarding(token, { tenancy_id: tenancyId, deductions: deductions || undefined, deduction_reasons: reasons || undefined });
      await load();
      setMessage("Inspection flow started.");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async () => {
    if (!detail) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (detail.status === "initiated") {
        await settleDeposit(token, { tenancy_id: tenancyId, deductions: deductions || undefined, deduction_reasons: reasons || undefined });
        setMessage("Inspection submitted and deposit settled.");
      } else if (detail.status === "deposit_settled" || detail.status === "final_rent_paid") {
        await completeHandoff(token, { tenancy_id: tenancyId, handoff_document_url: handoffDocUrl || undefined });
        setMessage("Unit marked under maintenance.");
      } else if (detail.status === "under_maintenance") {
        const result = await confirmMaintenanceDone(token, tenancyId);
        setMessage(result.detail);
        onRefresh();
      }
      await load();
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = notStarted
    ? "Start Inspection Flow"
    : detail?.status === "initiated"
      ? "Submit Inspection & Update Status"
      : detail?.status === "deposit_settled" || detail?.status === "final_rent_paid"
        ? "Mark Under Maintenance"
        : detail?.status === "under_maintenance"
          ? "Available for New Tenant"
          : "Inspection Complete";

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Unit Exit Inspection" subtitle="Review the unit condition, capture deductions, and move the property through handoff." onBack={onBack} />
        {loading ? <ActivityIndicator color={t.accent} /> : null}
        {message ? <Text style={[styles.helper, { color: t.accent }]}>{message}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Inspection Checklist</Text>
          <View style={styles.tableLike}>
            {([
              { key: "walls", label: "Walls & Paint" },
              { key: "plumbing", label: "Plumbing & Fixtures" },
              { key: "electrical", label: "Electrical Points" },
            ] as const).map((item) => (
              <View key={item.key} style={styles.tableRow}>
                <View style={styles.tableMain}>
                  <Text style={styles.rowTitle}>{item.label}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["pass", "fail"] as const).map((value) => (
                    <Pressable
                      key={value}
                      style={[styles.selectChip, checklist[item.key] === value && styles.selectChipActive]}
                      onPress={() => setChecklist((current) => ({ ...current, [item.key]: value }))}
                    >
                      <Text style={[styles.selectChipText, checklist[item.key] === value && styles.selectChipTextActive]}>
                        {value.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Damage Evidence</Text>
          <Text style={styles.helper}>Upload controls are represented here to match the reference flow. Connect file upload when the backend supports evidence attachments.</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[styles.summaryCard, { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 140 }]}>
              <Text style={styles.summaryLabel}>Upload</Text>
              <Text style={styles.helper}>Add photo of the issue</Text>
            </View>
            <View style={[styles.summaryCard, { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 140 }]}>
              <Text style={styles.summaryLabel}>Preview</Text>
              <Text style={styles.helper}>Damage image placeholder</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Update Unit Status</Text>
          <View style={styles.formGrid}>
            <Field label="Deductions" value={deductions} onChangeText={setDeductions} keyboardType="numeric" placeholder="e.g. 5000" />
            <Field label="Reasons" value={reasons} onChangeText={setReasons} placeholder="Painting, cleaning, repairs" />
            <Field label="Handoff Document URL" value={handoffDocUrl} onChangeText={setHandoffDocUrl} placeholder="https://..." />
          </View>
          {!detail?.status || detail.status !== "completed" ? (
            <PrimaryButton
              label={busy ? "Processing..." : actionLabel}
              onPress={notStarted ? handleStart : handleAdvance}
              disabled={busy || (!notStarted && detail?.status === "completed")}
              fullWidth
            />
          ) : (
            <Text style={[styles.helper, { color: t.successText }]}>This unit is now available for a new tenant.</Text>
          )}
        </View>
      </View>
    </AppearOnMount>
  );
}

function TenantPaymentsReferenceScreen({
  data,
  paymentForm,
  setPaymentForm,
  onSubmit,
  busy,
  onBack,
  onOpenMaintenance,
  onOpenManagement,
  visible = true,
}: {
  data: TenantDashboard & { tenancy: NonNullable<TenantDashboard["tenancy"]> };
  paymentForm: InitiatePaymentInput;
  setPaymentForm: (value: InitiatePaymentInput) => void;
  onSubmit: () => void;
  busy: boolean;
  onBack: () => void;
  onOpenMaintenance: () => void;
  onOpenManagement: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [message, setMessage] = useState("");

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Payments" subtitle="Pay rent, choose a method, and review your payment history." onBack={onBack} />

        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Rent Due</Text>
            <Text style={styles.gradientHeroTitle}>{money(paymentForm.amount || data.current_month_balance || data.tenancy.monthly_rent)}</Text>
            <Text style={styles.gradientHeroText}>Due date reflected for {paymentForm.rent_month || data.current_month}. Pay instantly with Razorpay from inside RentFlo.</Text>
            <PrimaryButton label={busy ? "Processing..." : "Pay with Razorpay"} onPress={onSubmit} disabled={busy} />
          </View>
        </LinearGradient>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Other Online Methods</Text>
          <View style={styles.tableLike}>
            <Pressable style={styles.tableRow} onPress={onSubmit}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>Pay via UPI</Text>
                <Text style={styles.rowMeta}>Instant, 0% convenience fee</Text>
              </View>
              <Text style={styles.rowMeta}>›</Text>
            </Pressable>
            <Pressable style={styles.tableRow} onPress={onSubmit}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>Pay via Card</Text>
                <Text style={styles.rowMeta}>Credit, Debit or Prepaid</Text>
              </View>
              <Text style={styles.rowMeta}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>Offline Payment</Text>
          <Text style={styles.helper}>Cash payments require landlord confirmation before they appear in your payment history.</Text>
          {message ? <Text style={[styles.helper, { color: t.accent }]}>{message}</Text> : null}
          <PrimaryButton label="Mark as Paid (Cash)" onPress={() => setMessage("Cash-payment reporting UI added to match the reference flow. Connect this to a tenant cash-report endpoint when available.")} variant="secondary" fullWidth />
        </View>

        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text style={styles.panelTitle}>Payment history</Text>
            <Text style={styles.rowMeta}>View all</Text>
          </View>
          <View style={styles.tableLike}>
            {data.payments.map((payment) => (
              <View key={payment.id} style={styles.tableRow}>
                <View style={styles.tableMain}>
                  <Text style={styles.rowTitle}>{payment.rent_month}</Text>
                  <Text style={styles.rowMeta}>Paid on {payment.paid_on || "Awaiting confirmation"}</Text>
                </View>
                <View style={styles.tableNumbers}>
                  <Text style={styles.rowValue}>{money(payment.amount)}</Text>
                  <StatusBadge status={payment.status} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Pressable
            style={[styles.tableRow, { backgroundColor: t.surfaceLowest, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 16 }]}
            onPress={() => setMessage("Yearly rent summary flow mapped. Connect this to an HRA summary export endpoint when available.")}
          >
            <View style={[styles.badge, { width: 44, height: 44, borderRadius: 14, backgroundColor: t.primaryMuted, justifyContent: "center" }]}>
              <Text style={[styles.badgeText, { color: t.accent, fontSize: 16 }]}>🧾</Text>
            </View>
            <View style={styles.tableMain}>
              <Text style={styles.rowTitle}>Download Yearly Rent Summary (HRA)</Text>
              <Text style={styles.rowMeta}>Selected account: {data.bank_accounts[0]?.bank_name || "No account configured"}</Text>
            </View>
          </Pressable>
        </View>

        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: onBack },
            { key: "payments", icon: "₹", label: "Payments", active: true, onPress: () => {} },
            { key: "maintenance", icon: "🛠", label: "Maintenance", active: false, onPress: onOpenMaintenance },
            { key: "management", icon: "📄", label: "Management", active: false, onPress: onOpenManagement },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function TenantSettlementScreen({
  detail,
  onBack,
  visible = true,
}: {
  detail: OffboardingInfo;
  onBack: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [message, setMessage] = useState("");
  const depositAmount = Number(detail.deposit?.amount || 0);
  const deductions = Number(detail.deposit?.deductions || 0);
  const refund = Number(detail.deposit?.refund_amount || Math.max(depositAmount - deductions, 0));

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Settlement Details" subtitle="Review the deduction summary and final refund amount for your move-out." onBack={onBack} />

        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Original Security Deposit</Text>
            <Text style={styles.gradientHeroTitle}>{money(depositAmount)}</Text>
            <Text style={styles.gradientHeroText}>Held in escrow for {detail.building_name} / {detail.unit_label}.</Text>
          </View>
        </LinearGradient>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Breakdown of deductions</Text>
          <View style={styles.tableLike}>
            <View style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.rowTitle}>Cleaning charges</Text>
                <Text style={styles.rowMeta}>{detail.deposit?.deduction_reasons || "Move-out deductions applied by landlord"}</Text>
              </View>
              <Text style={[styles.rowValue, { color: t.dangerText }]}>- {money(deductions)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Settlement ledger</Text>
          <View style={styles.tableLike}>
            <View style={styles.tableRow}>
              <Text style={styles.rowMeta}>Total deposit held</Text>
              <Text style={styles.rowValue}>{money(depositAmount)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.rowMeta}>Aggregate deductions</Text>
              <Text style={[styles.rowValue, { color: t.dangerText }]}>- {money(deductions)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.rowMeta}>Final refund amount</Text>
              <Text style={[styles.rowValue, { color: t.successText }]}>{money(refund)}</Text>
            </View>
          </View>
          {message ? <Text style={[styles.helper, { color: t.accent }]}>{message}</Text> : null}
          <PrimaryButton label="Accept Settlement" onPress={() => setMessage("Settlement accepted in the UI flow. Connect this to a tenant settlement-accept endpoint when available.")} fullWidth />
          <PrimaryButton label="Raise a Dispute" onPress={() => setMessage("Dispute path placeholder added to mirror the reference flow.")} variant="secondary" fullWidth />
        </View>

        <BottomTabBar
          items={[
            { key: "properties", icon: "🏢", label: "Properties", active: false, onPress: onBack },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: onBack },
            { key: "leases", icon: "📄", label: "Leases", active: true, onPress: () => {} },
            { key: "more", icon: "⋯", label: "More", active: false, onPress: onBack },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function TenantMoveOutConfirmationScreen({
  detail,
  onBack,
  visible = true,
}: {
  detail: OffboardingInfo;
  onBack: () => void;
  visible?: boolean;
}) {
  const { s: styles } = useT();

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Move-out Confirmation" subtitle="Review the final handoff checklist and refund status." onBack={onBack} />

        <View style={[styles.panel, { alignItems: "center" }]}>
          <Text style={styles.summaryLabel}>Final Step</Text>
          <Text style={styles.panelTitle}>100% Complete</Text>
          <Text style={styles.helper}>Your journey at {detail.building_name}, {detail.unit_label} is nearly complete.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Confirmation checklist</Text>
          <View style={styles.tableLike}>
            <View style={styles.tableRow}>
              <Text style={styles.rowTitle}>All keys returned</Text>
              <Text style={styles.rowMeta}>Completed</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.rowTitle}>All utilities cleared</Text>
              <Text style={styles.rowMeta}>Completed</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.rowTitle}>Personal belongings removed</Text>
              <Text style={styles.rowMeta}>Completed</Text>
            </View>
          </View>
        </View>

        <LinearGradient
          colors={["#1a237e", "#000666"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Estimated Refund</Text>
            <Text style={styles.gradientHeroTitle}>{money(detail.deposit?.refund_amount || 0)}</Text>
            <Text style={styles.gradientHeroText}>Status: {detail.status.replaceAll("_", " ")}</Text>
          </View>
        </LinearGradient>

        <BottomTabBar
          items={[
            { key: "properties", icon: "🏢", label: "Properties", active: false, onPress: onBack },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: onBack },
            { key: "leases", icon: "📄", label: "Leases", active: true, onPress: () => {} },
            { key: "more", icon: "⋯", label: "More", active: false, onPress: onBack },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function TenantLeaseOverviewScreen({
  onBack,
  visible = true,
}: {
  onBack: () => void;
  visible?: boolean;
}) {
  const { s: styles } = useT();
  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock title="Lease Management" subtitle="No active onboarding or move-out step is pending right now." onBack={onBack} />
        <View style={styles.panel}>
          <Text style={styles.sectionKicker}>All Clear</Text>
          <Text style={styles.helper}>Use this area for agreement download, lease extensions, and future move-out actions as those endpoints are added.</Text>
        </View>
        <BottomTabBar
          items={[
            { key: "dashboard", icon: "⌂", label: "Dashboard", active: false, onPress: onBack },
            { key: "payments", icon: "₹", label: "Payments", active: false, onPress: onBack },
            { key: "maintenance", icon: "🛠", label: "Maintenance", active: false, onPress: onBack },
            { key: "management", icon: "📄", label: "Management", active: true, onPress: () => {} },
          ]}
        />
      </View>
    </AppearOnMount>
  );
}

function TenantLeaseManagementScreen({
  token,
  tenancyId,
  onBack,
  visible = true,
}: {
  token: string;
  tenancyId: number;
  onBack: () => void;
  visible?: boolean;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [offboarding, setOffboarding] = useState<OffboardingInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const onboardingResult = await fetchOnboardingStatus(token, tenancyId);
        if (!cancelled) {
          setOnboarding(onboardingResult);
        }
        try {
          const offboardingResult = await fetchOffboardingDetail(token, tenancyId);
          if (!cancelled) {
            setOffboarding(offboardingResult);
          }
        } catch {
          if (!cancelled) {
            setOffboarding(null);
          }
        }
      } catch {
        if (!cancelled) {
          setOnboarding(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenancyId, token]);

  if (loading) {
    return (
      <View style={[styles.panel, { alignItems: "center", paddingVertical: 40 }]}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  if (onboarding && onboarding.onboarding_status !== "completed") {
    return <OnboardingScreen token={token} tenancyId={tenancyId} isLandlord={false} onBack={onBack} onRefresh={() => {}} visible={visible} />;
  }

  if (offboarding && ["initiated", "deposit_settled", "final_rent_paid"].includes(offboarding.status)) {
    return <TenantSettlementScreen detail={offboarding} onBack={onBack} visible={visible} />;
  }

  if (offboarding && ["handoff_complete", "under_maintenance", "completed"].includes(offboarding.status)) {
    return <TenantMoveOutConfirmationScreen detail={offboarding} onBack={onBack} visible={visible} />;
  }

  return <TenantLeaseOverviewScreen onBack={onBack} visible={visible} />;
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
        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Step {Math.max(currentStepIndex + 1, 1)} of {statusSteps.length}</Text>
            <Text style={styles.gradientHeroTitle}>{isLandlord ? "Tenant onboarding" : "Verify your tenancy"}</Text>
            <Text style={styles.gradientHeroText}>
              {data
                ? `${data.tenant_name} • ${data.building_name} / ${data.unit_label}`
                : "Guide documents, deposit, agreement, and first rent through a single task-focused flow."}
            </Text>
          </View>
        </LinearGradient>

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
  bottomTabs,
}: {
  token: string;
  isLandlord: boolean;
  onBack: () => void;
  visible?: boolean;
  bottomTabs?: Array<{ key: string; icon: string; label: string; active: boolean; onPress: () => void }>;
}) {
  const { t, s: styles } = useT();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [issueType, setIssueType] = useState("Plumbing");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [description, setDescription] = useState("");
  const [landlordFilter, setLandlordFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");
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
    if (!description.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await createTicket(token, { subject: `${issueType} • ${priority}`, description });
      setMsg("Ticket created.");
      setDescription("");
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
  const activeCount = tickets.filter((ticket) => ticket.status !== "resolved" && ticket.status !== "closed").length;
  const visibleTickets = landlordFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === landlordFilter);

  return (
    <AppearOnMount visible={visible}>
      <View style={styles.stack}>
        <ScreenTitleBlock
          title={isLandlord ? "Tickets" : "Report a Problem"}
          subtitle={
            isLandlord
              ? `Manage ${activeCount} active maintenance requests`
              : "Submit a maintenance request and we'll handle the rest."
          }
          onBack={onBack}
        />

        {msg ? <Text style={[styles.helper, { color: msg.startsWith("Ticket created") || msg.startsWith("Ticket updated") ? t.successText : t.textSecondary }]}>{msg}</Text> : null}

        {isLandlord ? (
          <>
            <View style={styles.panel}>
              <Text style={styles.sectionKicker}>Quick Filters</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([
                  { key: "all", label: "All Tickets" },
                  { key: "open", label: "Open" },
                  { key: "in_progress", label: "In Progress" },
                  { key: "resolved", label: "Resolved" },
                ] as const).map((filter) => (
                  <Pressable
                    key={filter.key}
                    style={[styles.selectChip, landlordFilter === filter.key && styles.selectChipActive]}
                    onPress={() => setLandlordFilter(filter.key)}
                  >
                    <Text style={[styles.selectChipText, landlordFilter === filter.key && styles.selectChipTextActive]}>{filter.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Text style={styles.panelTitle}>Active Requests</Text>
                <Text style={styles.rowMeta}>Refine</Text>
              </View>
              {loading ? <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} /> : null}
              <View style={[styles.tableLike, { marginTop: 12 }]}>
                {visibleTickets.map((ticket) => (
                  <View key={ticket.id} style={[styles.panel, { borderRadius: 24, borderWidth: 1, borderColor: t.borderStrong, padding: 18 }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <View style={{ flex: 1, gap: 8 }}>
                        <View style={[styles.badge, ticket.status === "open" ? styles.warnBadge : ticket.status === "resolved" ? styles.goodBadge : styles.neutralBadge, { alignSelf: "flex-start" }]}>
                          <Text style={styles.badgeText}>{ticket.status.replaceAll("_", " ").toUpperCase()}</Text>
                        </View>
                        <Text style={styles.rowTitle}>{ticket.subject}</Text>
                        <Text style={styles.rowMeta}>{ticket.building_name} • {ticket.unit_label}</Text>
                        <Text style={styles.rowMeta}>{ticket.tenant_name}</Text>
                      </View>
                      <Text style={[styles.rowMeta, { fontSize: 18 }]}>›</Text>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <Text style={[styles.rowMeta, { color: statusColors[ticket.status] || t.textSecondary }]}>● {ticket.status.replaceAll("_", " ")}</Text>
                      <Text style={styles.rowMeta}>
                        {ticket.resolution_provider
                          ? `Assigned: ${ticket.resolution_provider === "urban_clap" ? "Urban Clap" : ticket.resolution_provider}`
                          : "Assign Vendor"}
                      </Text>
                    </View>

                    <AppearOnMount visible={editingId === ticket.id} unmountOnExit>
                      {editingId === ticket.id ? (
                        <View style={[styles.formGrid, { marginTop: 16 }]}>
                          <View>
                            <Text style={styles.fieldLabel}>Status</Text>
                            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                              {(["in_progress", "resolved", "closed"] as const).map((status) => (
                                <Pressable
                                  key={status}
                                  onPress={() => setEditStatus(status)}
                                  style={[styles.selectChip, editStatus === status && styles.selectChipActive]}
                                >
                                  <Text style={[styles.selectChipText, editStatus === status && styles.selectChipTextActive]}>
                                    {status.replaceAll("_", " ")}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                          <View>
                            <Text style={styles.fieldLabel}>Resolution by</Text>
                            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                              {(["urban_clap", "owner", "tenant"] as const).map((provider) => (
                                <Pressable
                                  key={provider}
                                  onPress={() => setEditProvider(provider)}
                                  style={[styles.selectChip, editProvider === provider && styles.selectChipActive]}
                                >
                                  <Text style={[styles.selectChipText, editProvider === provider && styles.selectChipTextActive]}>
                                    {provider === "urban_clap" ? "Urban Clap" : provider[0].toUpperCase() + provider.slice(1)}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                          <Field label="Resolution notes" value={editNotes} onChangeText={setEditNotes} placeholder="What was done..." />
                          <Field label="Receipt URL (optional)" value={editReceipt} onChangeText={setEditReceipt} placeholder="https://..." />
                          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                            <PrimaryButton label={busy ? "Saving..." : "Save"} onPress={() => handleUpdate(ticket.id)} disabled={busy} />
                            <PrimaryButton label="Cancel" onPress={() => setEditingId(null)} variant="secondary" />
                          </View>
                        </View>
                      ) : null}
                    </AppearOnMount>

                    {editingId !== ticket.id && ticket.status !== "closed" ? (
                      <PrimaryButton
                        label={ticket.resolution_provider ? "Update Ticket" : "Assign Vendor"}
                        onPress={() => {
                          setEditingId(ticket.id);
                          setEditStatus(ticket.status);
                          setEditProvider(ticket.resolution_provider);
                          setEditNotes(ticket.resolution_notes);
                          setEditReceipt(ticket.receipt_url);
                        }}
                        variant="secondary"
                        fullWidth
                      />
                    ) : null}
                  </View>
                ))}
                {!loading && visibleTickets.length === 0 ? <Text style={styles.helper}>No tickets match the current filter.</Text> : null}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.fieldLabel}>Issue Type</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {["Plumbing", "Electrical", "General"].map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.selectChip, issueType === type && styles.selectChipActive]}
                    onPress={() => setIssueType(type)}
                  >
                    <Text style={[styles.selectChipText, issueType === type && styles.selectChipTextActive]}>{type}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Priority Level</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {(["Low", "Medium", "High"] as const).map((level) => (
                  <Pressable
                    key={level}
                    style={[styles.selectChip, priority === level && styles.selectChipActive]}
                    onPress={() => setPriority(level)}
                  >
                    <Text style={[styles.selectChipText, priority === level && styles.selectChipTextActive]}>{level}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ marginTop: 18 }}>
                <Field label="Description" value={description} onChangeText={setDescription} placeholder="Tell us what's happening..." />
              </View>

              <View style={[styles.summaryCard, { marginTop: 18, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: t.borderStrong, backgroundColor: t.surfaceLowest }]}>
                <Text style={[styles.badgeText, { fontSize: 22, color: t.accent }]}>📷</Text>
                <Text style={[styles.rowTitle, { marginTop: 10 }]}>Add photo of the issue</Text>
                <Text style={styles.rowMeta}>PNG, JPG up to 10MB</Text>
              </View>

              <View style={{ marginTop: 18 }}>
                <PrimaryButton label={busy ? "Submitting..." : "Submit Request >"} onPress={handleCreate} disabled={busy || !description.trim()} fullWidth />
              </View>
            </View>

            <View style={styles.panel}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.panelTitle}>Active Tickets</Text>
                <View style={[styles.badge, styles.neutralBadge]}>
                  <Text style={styles.badgeText}>{tickets.length} Total</Text>
                </View>
              </View>
              {loading ? <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} /> : null}
              <View style={[styles.tableLike, { marginTop: 12 }]}>
                {tickets.map((ticket) => (
                  <View key={ticket.id} style={[styles.panel, { borderRadius: 22, padding: 18 }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{ticket.subject}</Text>
                        <Text style={styles.rowMeta}>Ticket #{ticket.id} • Reported {formatDisplayDate(ticket.created_at)}</Text>
                      </View>
                      <View style={[styles.badge, ticket.status === "resolved" ? styles.goodBadge : ticket.status === "in_progress" ? styles.neutralBadge : styles.warnBadge]}>
                        <Text style={styles.badgeText}>{ticket.status.replaceAll("_", " ")}</Text>
                      </View>
                    </View>
                    {ticket.resolution_provider ? <Text style={[styles.rowMeta, { marginTop: 10 }]}>Assigned to {ticket.resolution_provider === "urban_clap" ? "Urban Clap" : ticket.resolution_provider}</Text> : null}

                    <AppearOnMount visible={editingId === ticket.id} unmountOnExit>
                      {editingId === ticket.id ? (
                        <View style={[styles.formGrid, { marginTop: 14 }]}>
                          <Field label="Receipt URL" value={editReceipt} onChangeText={setEditReceipt} placeholder="https://receipt..." />
                          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                            <PrimaryButton label={busy ? "Saving..." : "Upload Receipt"} onPress={() => handleUpdate(ticket.id)} disabled={busy} />
                            <PrimaryButton label="Cancel" onPress={() => setEditingId(null)} variant="secondary" />
                          </View>
                        </View>
                      ) : null}
                    </AppearOnMount>

                    {editingId !== ticket.id && ticket.status !== "closed" ? (
                      <Pressable
                        style={[styles.removeButton, { marginTop: 12, backgroundColor: t.primaryMuted }]}
                        onPress={() => {
                          setEditingId(ticket.id);
                          setEditReceipt(ticket.receipt_url);
                        }}
                      >
                        <Text style={[styles.removeButtonText, { color: t.primary }]}>Add Receipt</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {!loading && tickets.length === 0 ? <Text style={styles.helper}>No active tickets yet.</Text> : null}
              </View>
            </View>
          </>
        )}

        {bottomTabs ? <BottomTabBar items={bottomTabs} /> : null}
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
        <LinearGradient
          colors={[t.heroStart, t.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHero}
        >
          <View style={styles.gradientHeroInner}>
            <Text style={styles.gradientHeroEyebrow}>Final Account Settlement</Text>
            <Text style={styles.gradientHeroTitle}>Settlement summary</Text>
            <Text style={styles.gradientHeroText}>
              Move the tenancy from deductions and deposit settlement through handoff and maintenance without losing context.
            </Text>
          </View>
        </LinearGradient>
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

function formatDisplayDate(value?: string | null) {
  if (!value) {
    return "Recently";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: parsed.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function money(value: string | number) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
