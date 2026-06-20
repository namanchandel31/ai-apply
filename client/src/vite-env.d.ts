/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Production backend origin, e.g. https://api.example.com (no trailing slash) */
  readonly VITE_API_URL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  /** Chrome extension ID from chrome://extensions (dev unpacked) */
  readonly VITE_ONETAP_EXTENSION_ID?: string;
  /** Set to "1" to log auth header presence (never logs tokens) */
  readonly VITE_DEBUG_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type RazorpayCheckoutHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: RazorpayCheckoutHandlerResponse) => void;
};

interface RazorpayCheckoutInstance {
  open(): void;
}

interface Window {
  Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
}
