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

## Mobile / Web App

```bash
cd /Users/anoopsubramani/Documents/Playground/mobile
export EXPO_PUBLIC_API_URL="http://127.0.0.1:8000/api"
npm start
```

Run targets:

```bash
npm run ios
npm run android
npm run web
```

## Demo Accounts

- Landlord: `owner` / `owner123`
- Tenant: `riya` / `tenant123`

## Notes

- The Expo app uses one React Native codebase for iOS, Android, and web.
- Razorpay integration is production-ready. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable live payments.
- Tier-based pricing: Free (5 units, 5 tenants), Pro (25 units, 25 tenants, ₹499/mo), Business (unlimited, ₹1499/mo).
- Add-ons: Analytics Dashboard (₹199/mo), Payment Reports Export (₹99/mo).
