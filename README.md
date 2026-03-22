# RentFlo 

Cross-platform rent tracking app:

- Frontend: React Native with Expo for iOS, Android, and web in [mobile](/Users/anoopsubramani/Documents/Playground/mobile)
- Backend: Django REST API in [backend](/Users/anoopsubramani/Documents/Playground/backend)
- Payments: Razorpay integration for tenant rent payments with full support for subscriptions and add-ons

## Backend

```bash
cd /Users/anoopsubramani/Documents/Playground/backend
. ../.venv/bin/activate
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Backend base URL: `http://127.0.0.1:8000/api`

Razorpay env vars (optional for live payments):

```bash
export RAZORPAY_KEY_ID="..."
export RAZORPAY_KEY_SECRET="..."
```

Without these vars, the backend uses mock payment sessions so the payment flows remain testable.

Firebase auth env vars:

```bash
export FIREBASE_API_KEY="..."
export FIREBASE_LANDLORD_AUTH_ENABLED="true"
```

`FIREBASE_API_KEY` can reuse the same Firebase web API key as the Expo app. The backend uses it to verify Firebase landlord sessions before issuing the app token.

## Mobile / Web App

```bash
cd /Users/anoopsubramani/Documents/Playground/mobile
export EXPO_PUBLIC_API_URL="http://127.0.0.1:8000/api"
export EXPO_PUBLIC_ENABLE_FIREBASE_LANDLORD_AUTH="true"
export EXPO_PUBLIC_FIREBASE_API_KEY="..."
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
export EXPO_PUBLIC_FIREBASE_PROJECT_ID="..."
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
export EXPO_PUBLIC_FIREBASE_APP_ID="..."
npm start
```

Run targets:

```bash
npm run ios
npm run android
npm run web
```

## Demo Accounts

- Landlord: `owner` / `owner123` while Firebase landlord auth is disabled
- Tenant: `riya` / `tenant123`

## Notes

- The Expo app uses one React Native codebase for iOS, Android, and web.
- Firebase landlord auth is feature-flagged. Leave `EXPO_PUBLIC_ENABLE_FIREBASE_LANDLORD_AUTH` and `FIREBASE_LANDLORD_AUTH_ENABLED` unset to keep landlords on RentFlo credentials, or set both to `true` after adding Firebase keys.
- Razorpay integration is production-ready. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable live payments.
- Tier-based pricing: Free (5 units, 5 tenants), Pro (25 units, 25 tenants, ₹499/mo), Business (unlimited, ₹1499/mo).
- Add-ons: Analytics Dashboard (₹199/mo), Payment Reports Export (₹99/mo).
