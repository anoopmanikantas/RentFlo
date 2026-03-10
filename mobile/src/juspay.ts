import { Linking, Platform } from "react-native";

import type { InitiatedPayment } from "./api";

type PaymentLaunchResult = {
  status: "succeeded" | "failed" | "cancelled";
  mode: "mock" | "live";
  providerPaymentId?: string;
  providerPayload?: Record<string, unknown>;
};

function dynamicRequire(name: string): any {
  try {
    // eslint-disable-next-line no-eval
    const req = eval("require");
    return req(name);
  } catch {
    return null;
  }
}

function extractRedirectUrl(payload: Record<string, unknown>) {
  const direct = payload.redirect_url || payload.payment_link || payload.payment_url;
  if (typeof direct === "string") {
    return direct;
  }

  const nested = payload.links as Record<string, unknown> | undefined;
  if (nested && typeof nested.web === "string") {
    return nested.web;
  }

  return "";
}

export async function launchJuspayPayment(initiated: InitiatedPayment): Promise<PaymentLaunchResult> {
  if (initiated.mode === "mock") {
    return {
      status: "succeeded",
      mode: "mock",
      providerPaymentId: `mock_pay_${Date.now()}`,
      providerPayload: initiated.sdk_payload,
    };
  }

  const redirectUrl = extractRedirectUrl(initiated.sdk_payload);

  if (Platform.OS === "web") {
    const webSdk = dynamicRequire("@juspay-tech/react-hyper-js");
    if (webSdk && typeof window !== "undefined" && redirectUrl) {
      window.open(redirectUrl, "_blank", "noopener,noreferrer");
      return {
        status: "succeeded",
        mode: "live",
        providerPaymentId: String((initiated.sdk_payload as any).payment_id || initiated.order_id),
        providerPayload: initiated.sdk_payload,
      };
    }
  } else {
    const nativeSdk = dynamicRequire("hyper-sdk-react");
    if (nativeSdk && redirectUrl) {
      await Linking.openURL(redirectUrl);
      return {
        status: "succeeded",
        mode: "live",
        providerPaymentId: String((initiated.sdk_payload as any).payment_id || initiated.order_id),
        providerPayload: initiated.sdk_payload,
      };
    }
  }

  if (redirectUrl) {
    await Linking.openURL(redirectUrl);
    return {
      status: "succeeded",
      mode: "live",
      providerPaymentId: initiated.order_id,
      providerPayload: initiated.sdk_payload,
    };
  }

  return {
    status: "failed",
    mode: "live",
    providerPayload: {
      error:
        "Juspay live payload did not contain a redirect URL. Configure the backend to return the hosted checkout or native SDK payload.",
    },
  };
}
