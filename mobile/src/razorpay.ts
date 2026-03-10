import { Platform } from "react-native";

import type { InitiatedPayment } from "./api";

export type PaymentLaunchResult = {
  status: "succeeded" | "failed" | "cancelled";
  mode: "mock" | "live";
  providerPaymentId?: string;
  razorpaySignature?: string;
  providerPayload?: Record<string, unknown>;
};

/**
 * Launch a Razorpay Checkout session.
 *
 * - Mock mode:   returns instant success (backend has no credentials configured).
 * - Web:         loads Razorpay Checkout.js into a <script> tag.
 * - Native:      uses `react-native-razorpay` if installed; falls back to web overlay.
 */
export async function launchRazorpayPayment(initiated: InitiatedPayment): Promise<PaymentLaunchResult> {
  // ---- Mock mode ----
  if (initiated.mode === "mock") {
    return {
      status: "succeeded",
      mode: "mock",
      providerPaymentId: `mock_pay_${Date.now()}`,
      razorpaySignature: "mock_sig",
      providerPayload: initiated.sdk_payload,
    };
  }

  const sdkPayload = initiated.sdk_payload as Record<string, any>;

  // ---- Native ----
  if (Platform.OS !== "web") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RazorpayCheckout = require("react-native-razorpay").default;
      const data = await RazorpayCheckout.open(sdkPayload);
      return {
        status: "succeeded",
        mode: "live",
        providerPaymentId: data.razorpay_payment_id,
        razorpaySignature: data.razorpay_signature,
        providerPayload: data,
      };
    } catch (err: any) {
      if (err?.code === 2 || err?.description?.includes("cancelled")) {
        return { status: "cancelled", mode: "live" };
      }
      return { status: "failed", mode: "live", providerPayload: err };
    }
  }

  // ---- Web: Razorpay Checkout.js ----
  return new Promise<PaymentLaunchResult>((resolve) => {
    if (typeof window === "undefined") {
      resolve({ status: "failed", mode: "live", providerPayload: { error: "No window object" } });
      return;
    }

    function loadScript(): Promise<void> {
      if ((window as any).Razorpay) return Promise.resolve();
      return new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => res();
        s.onerror = () => rej(new Error("Failed to load Razorpay Checkout.js"));
        document.head.appendChild(s);
      });
    }

    loadScript()
      .then(() => {
        const options = {
          ...sdkPayload,
          handler(response: any) {
            resolve({
              status: "succeeded",
              mode: "live",
              providerPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              providerPayload: response,
            });
          },
          modal: {
            ondismiss() {
              resolve({ status: "cancelled", mode: "live" });
            },
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (resp: any) => {
          resolve({
            status: "failed",
            mode: "live",
            providerPaymentId: resp?.error?.metadata?.payment_id,
            providerPayload: resp?.error || resp,
          });
        });
        rzp.open();
      })
      .catch((err) => {
        resolve({ status: "failed", mode: "live", providerPayload: { error: String(err) } });
      });
  });
}
