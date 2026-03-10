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

  // Juspay hosted checkout link
  const hostedUrl = payload.url as string | undefined;
  if (hostedUrl && typeof hostedUrl === "string") {
    return hostedUrl;
  }

  return "";
}

/**
 * Open a payment URL and wait for the user to return.
 * On web we use a popup; on native we open external browser.
 * In both cases the backend /confirm endpoint should be called afterwards
 * to do server-side status verification with Juspay.
 */
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
    // Try using the Juspay web SDK if available
    const webSdk = dynamicRequire("@juspay-tech/react-hyper-js");
    if (webSdk && typeof window !== "undefined" && redirectUrl) {
      const popup = window.open(redirectUrl, "_blank", "noopener,noreferrer,width=500,height=700");
      // Poll the popup to detect when the user returns
      if (popup) {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (popup.closed) {
              clearInterval(interval);
              resolve();
            }
          }, 500);
          // Safety timeout after 5 minutes
          setTimeout(() => {
            clearInterval(interval);
            resolve();
          }, 300_000);
        });
      }
      return {
        status: "succeeded",
        mode: "live",
        providerPaymentId: String((initiated.sdk_payload as any).payment_id || initiated.order_id),
        providerPayload: initiated.sdk_payload,
      };
    }
  } else {
    // Native: try the Juspay native SDK
    const nativeSdk = dynamicRequire("hyper-sdk-react");
    if (nativeSdk && nativeSdk.HyperSdkReact) {
      try {
        const processPayload = JSON.stringify({
          requestId: initiated.order_id,
          service: "in.juspay.hyperpay",
          payload: {
            action: "paymentPage",
            merchantId: (initiated.sdk_payload as any).merchant_id || "",
            clientId: (initiated.sdk_payload as any).client_id || "",
            orderId: initiated.order_id,
            ...initiated.sdk_payload,
          },
        });
        const result = await nativeSdk.HyperSdkReact.process(processPayload);
        const parsed = typeof result === "string" ? JSON.parse(result) : result;
        const txnStatus = parsed?.status || parsed?.payload?.status || "";
        return {
          status: txnStatus === "charged" || txnStatus === "CHARGED" ? "succeeded" : "failed",
          mode: "live",
          providerPaymentId: parsed?.payload?.txn_id || parsed?.txn_id || initiated.order_id,
          providerPayload: parsed,
        };
      } catch {
        // Fall through to redirect URL
      }
    }

    if (redirectUrl) {
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
