# RentFlow

Cross-platform rent tracking app:

- Frontend: React Native with Expo for iOS, Android, and web in [mobile](/Users/anoopsubramani/Documents/Playground/mobile)
- Backend: Django REST API in [backend](/Users/anoopsubramani/Documents/Playground/backend)
- Payments: Juspay order/session initiation scaffold with tenant payment confirmation flow

## Backend

```bash
cd /Users/anoopsubramani/Documents/Playground/backend
. ../.venv/bin/activate
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Backend base URL: `http://127.0.0.1:8000/api`

Optional Juspay env vars:

```bash
export JUSPAY_BASE_URL="https://..."
export JUSPAY_API_KEY="..."
export JUSPAY_MERCHANT_ID="..."
export JUSPAY_RETURN_URL="http://localhost:8081/payment-result"
```

Without those vars, the backend uses mock payment sessions so the tenant flow remains testable.

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
- The Juspay flow is production-ready on the backend shape, but live checkout still needs real Juspay merchant credentials and final provider payload mapping for your merchant account.
- `hyper-sdk-react` is installed for native and `@juspay-tech/react-hyper-js` is installed for web, but Expo native production usage will require prebuild/custom native integration if you want to invoke the native Juspay SDK instead of redirect-based checkout.
