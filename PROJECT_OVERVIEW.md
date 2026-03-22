# RentFlo Project Overview

This document explains what currently exists in the project, how the app is structured, and what has been implemented in each major flow.

## 1. Current Stack

### Frontend
- React Native with Expo
- Single codebase for:
  - iOS
  - Android
  - Web
- Main entry point:
  - [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx)
- API client:
  - [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)
- Payment launcher:
  - [mobile/src/razorpay.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/razorpay.ts)

### Backend
- Django REST API
- Token-based authentication
- SQLite database
- Main app:
  - [backend/core/models.py](/Users/anoopsubramani/Documents/Playground/backend/core/models.py)
  - [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
  - [backend/core/urls.py](/Users/anoopsubramani/Documents/Playground/backend/core/urls.py)
  - [backend/core/services.py](/Users/anoopsubramani/Documents/Playground/backend/core/services.py)

### Payments
- Razorpay integration
- Supports:
  - Mock mode when keys are not configured
  - Live order creation and signature verification when keys are configured

## 2. Core Product Purpose

The app is a rent and property operations platform for landlords and tenants.

It currently supports:
- multi-building landlord management
- multi-unit building management
- tenant assignment
- tenant rent payment flow
- landlord collections dashboard
- subscription tiers and paid feature gating
- analytics and reporting
- tenant onboarding
- support tickets
- tenant offboarding and unit turnover

## 3. Main Data Model

The core database entities currently implemented are:

### User
- custom auth model
- roles:
  - `landlord`
  - `tenant`
- includes:
  - username
  - email
  - phone
  - tenant code (`RF-XXXX`)

### Subscription
- one subscription per landlord
- tiers:
  - `free`
  - `pro`
  - `business`
- stores:
  - max unit limit
  - max tenant limit
  - active flag
  - optional Razorpay subscription id

### AddOn
- premium features layered on top of subscription
- currently supported:
  - `analytics`
  - `reports_export`

### Building
- belongs to a landlord
- has:
  - name
  - address

### Unit
- belongs to a building
- has:
  - label
  - monthly rent
  - status
- statuses:
  - `available`
  - `occupied`
  - `under_maintenance`

### Tenancy
- links landlord, tenant user, and unit
- supports:
  - active/inactive tenancy
  - start and end date
  - onboarding status

### BankAccount
- landlord receiving accounts
- tenants can choose one of these when paying rent

### RazorpayOrder
- temporary order object created before payment is confirmed
- tracks:
  - internal order id
  - Razorpay order id
  - status
  - amount
  - metadata

### Payment
- final recorded payment row
- created only after payment confirmation
- tracks:
  - rent month
  - amount
  - due date
  - paid date
  - provider ids
  - provider payload
  - payment category

### MaintenanceRecord
- maintenance history and cost records for units

### Onboarding / Offboarding Models
- `TenantDocument`
- `Deposit`
- `Agreement`
- `Ticket`
- `Offboarding`

These support the full lifecycle around move-in and move-out.

## 4. Authentication Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)
- [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx)

### What exists
- username/password login
- signup flow
- Google login endpoint
- token auth for API calls
- role switching endpoint for the logged-in user
- persistent login in the mobile app using AsyncStorage

### Backend endpoints
- `POST /api/auth/login/`
- `POST /api/auth/signup/`
- `POST /api/auth/google/`
- `GET /api/auth/me/`
- `PATCH /api/auth/me/`

### Frontend behavior
- app stores token and user in local storage
- on app launch it restores auth state
- dashboard loaded depends on role

## 5. Landlord Dashboard Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx)

### Endpoint
- `GET /api/landlord/dashboard/`

### What landlord sees
- building count
- unit count
- tenant count
- monthly due
- monthly collected
- monthly outstanding
- subscription status
- all bank accounts
- all buildings
- all units
- active tenant list
- payment ledger

### Tenant status logic
Each tenant gets a current status based on current month collections:
- paid
- part paid
- not paid

## 6. Tenant Dashboard Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx)

### Endpoint
- `GET /api/tenant/dashboard/`

### What tenant sees
- tenancy summary
- assigned unit
- building
- landlord bank accounts
- current month paid amount
- current month balance
- payment history

If the tenant is not assigned to an active tenancy, the API returns an empty tenant dashboard shape rather than crashing.

## 7. Tenant Assignment Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)

### Endpoint
- `POST /api/landlord/tenancies/`

### What it does
- landlord assigns an existing tenant account to a unit
- tenant can be resolved by:
  - tenant code like `RF-AB12`
  - email
- validates:
  - tenant exists
  - tenant is not already assigned
  - unit exists under that landlord
  - unit is not already occupied
  - subscription tenant limit is not exceeded

### Result
- creates a `Tenancy`
- marks unit as `occupied`
- sets onboarding status to `pending_documents`

## 8. Building / Unit / Bank Account Setup Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)

### Endpoints
- `POST /api/landlord/buildings/`
- `POST /api/landlord/units/`
- `POST /api/landlord/bank-accounts/`

### Behavior
- landlord can add buildings
- landlord can add units inside owned buildings
- landlord can add receiving bank accounts
- unit creation is subscription-limited by tier

## 9. Rent Payment Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [backend/core/services.py](/Users/anoopsubramani/Documents/Playground/backend/core/services.py)
- [mobile/src/razorpay.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/razorpay.ts)
- [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx)

### Step 1: Tenant initiates payment
- Endpoint:
  - `POST /api/tenant/payments/initiate/`
- Backend:
  - verifies tenant has active tenancy
  - verifies selected bank account belongs to landlord
  - creates internal `RazorpayOrder`
  - calls Razorpay order creation

### Step 2: Razorpay mode selection

#### Mock mode
If these env vars are missing:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Then backend returns:
- `mode = "mock"`
- fake Razorpay payload

Frontend then:
- simulates successful payment
- returns fake payment id/signature

#### Live mode
If Razorpay keys are configured:
- backend creates real Razorpay order
- frontend launches Razorpay checkout
- on success it returns payment id and signature

### Step 3: Payment confirmation
- Endpoint:
  - `POST /api/tenant/payments/confirm/`

### Confirmation behavior
- looks up the internal order
- verifies Razorpay signature if available
- can also fetch payment status from Razorpay
- updates order status
- creates final `Payment` record only after confirmation

### Important implementation detail
The app intentionally does not create the final payment row during initiation.
This avoids false or orphaned `initiated` payments when checkout fails or is cancelled.

## 10. Subscription and Pricing Flow

Implemented in:
- [backend/core/models.py](/Users/anoopsubramani/Documents/Playground/backend/core/models.py)
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)

### Current tiers

#### Free
- 5 units
- 5 tenants
- no premium features

#### Pro
- 25 units
- 25 tenants
- analytics included
- ₹499/month

#### Business
- effectively unlimited
- analytics included
- report export included
- ₹1499/month

### Add-ons
- Analytics Dashboard
  - ₹199/month
- Payment Reports Export
  - ₹99/month

### Endpoints
- `GET /api/landlord/subscription/`
- `POST /api/landlord/subscription/upgrade/`
- `POST /api/landlord/subscription/confirm/`
- `POST /api/landlord/addons/activate/`
- `POST /api/landlord/addons/confirm/`

### How it works
- backend checks tier before allowing new units or tenants
- upgrades use Razorpay order creation
- confirmation endpoint updates actual tier/add-on state

## 11. Analytics Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)
- [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx)

### Basic analytics dashboard
- `GET /api/landlord/analytics/`

Returns:
- revenue trend
- occupancy rate
- collection rate
- monthly due
- monthly collected
- top tenants by total payment

### Premium analytics drilldowns
- `GET /api/landlord/analytics/delinquency/`
- `GET /api/landlord/analytics/cash-flow/`
- `GET /api/landlord/analytics/roi/`
- `GET /api/landlord/analytics/tenant-risk/`
- `GET /api/landlord/analytics/maintenance/`
- `GET /api/landlord/analytics/tax-report/`

### Each premium report does

#### Delinquency
- estimates overdue tenants by 30/60/90+ day buckets
- computes total delinquent amount
- computes collection effectiveness

#### Cash Flow Forecast
- uses recent collections to forecast the next 6 months

#### Property ROI
- compares rent collected vs maintenance cost by property

#### Tenant Risk
- scores tenants by on-time vs late payments
- requires `due_on` payment data to be useful

#### Maintenance Intelligence
- compares preventative vs reactive maintenance spending
- surfaces top maintenance cost drivers

#### Tax Report
- groups income and expenses
- returns gross income, total expenses, net profit, margin
- supports CSV export

### Feature gating
Analytics endpoints require:
- Pro tier
- or Analytics add-on

## 12. Report Export Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)

### Endpoint
- `GET /api/landlord/reports/export/`

### Supports
- JSON output
- CSV download
- optional `from` and `to` rent month filtering

### Feature gating
Requires:
- Business tier
- or Reports Export add-on

## 13. Onboarding Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [backend/core/models.py](/Users/anoopsubramani/Documents/Playground/backend/core/models.py)
- [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)

### Onboarding stages
- `pending_documents`
- `pending_deposit`
- `pending_agreement`
- `pending_first_rent`
- `completed`

### Endpoints
- `GET /api/onboarding/<tenancy_id>/`
- `POST /api/onboarding/<tenancy_id>/documents/`
- `POST /api/onboarding/<tenancy_id>/documents/<doc_id>/verify/`
- `POST /api/onboarding/deposit/`
- `POST /api/onboarding/deposit/pay/`
- `POST /api/onboarding/agreement/`
- `POST /api/onboarding/agreement/sign/`

### Flow sequence

#### Documents
- tenant uploads Aadhar / PAN / work proof / student proof
- landlord can verify documents
- once at least one ID proof is uploaded, tenancy moves to `pending_deposit`

#### Deposit
- landlord sets deposit amount
- tenant or landlord can mark deposit paid
- moves tenancy to `pending_agreement`

#### Agreement
- landlord creates agreement with fee and optional document URL
- tenant or landlord can sign/mark fee paid
- moves tenancy to `pending_first_rent`

## 14. Ticketing Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [backend/core/models.py](/Users/anoopsubramani/Documents/Playground/backend/core/models.py)
- [mobile/src/api.ts](/Users/anoopsubramani/Documents/Playground/mobile/src/api.ts)

### What exists
- tenants can raise tickets
- landlord can list all tickets
- tenant can list only own tickets
- both sides can open ticket detail
- ticket can be updated with:
  - status
  - resolution provider
  - notes
  - receipt URL

### Endpoints
- `POST /api/tickets/`
- `GET /api/tickets/`
- `GET /api/tickets/<ticket_id>/`
- `PATCH /api/tickets/<ticket_id>/`

## 15. Offboarding Flow

Implemented in:
- [backend/core/views.py](/Users/anoopsubramani/Documents/Playground/backend/core/views.py)
- [backend/core/models.py](/Users/anoopsubramani/Documents/Playground/backend/core/models.py)

### Endpoints
- `POST /api/offboarding/initiate/`
- `GET /api/offboarding/<tenancy_id>/`
- `POST /api/offboarding/deposit/settle/`
- `POST /api/offboarding/handoff/complete/`
- `POST /api/offboarding/maintenance/confirm/`

### Flow sequence

#### 1. Initiate offboarding
- landlord starts offboarding for an active tenancy
- optional deposit deductions can be applied

#### 2. Settle deposit
- landlord computes refund amount after deductions
- tracks extra owed if deductions exceed deposit
- moves offboarding to `deposit_settled`

#### 3. Complete handoff
- landlord uploads handoff document URL
- tenancy becomes inactive
- end date is set
- unit becomes `under_maintenance`

#### 4. Confirm maintenance done
- landlord marks turnover maintenance complete
- unit becomes `available`
- offboarding becomes `completed`

## 16. Mobile App UX State

The main app in [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx) is currently a large single-screen controller that handles:
- authentication
- landlord dashboard
- tenant dashboard
- subscription screens
- analytics screens
- payment flow
- onboarding screens
- support / ticketing views

This means:
- many flows are present in one place
- the app is functional but not yet modularized into separate screen files

## 17. What Has Been Done So Far by Flow

### Account and role flow
- implemented
- login/signup/google login available
- token persistence added

### Landlord property setup
- implemented
- buildings, units, bank accounts supported

### Tenant assignment
- implemented
- tenant code and email assignment supported

### Rent collection
- implemented
- Razorpay mock and live paths supported
- backend confirmation is in place

### Tenant visibility for landlord
- implemented
- landlord dashboard shows tenant status and payment state

### Subscription billing
- implemented
- plan gating exists
- upgrade/add-on confirmation exists

### Analytics
- implemented
- basic and premium analytics endpoints exist
- frontend hooks/types/screens also exist

### Onboarding
- implemented
- documents, deposit, agreement stages supported

### Ticketing
- implemented
- tenant issue submission and landlord review supported

### Offboarding
- implemented
- deposit settlement, handoff, maintenance completion supported

## 18. Current Gaps / Practical Caveats

These are the main things to keep in mind about the current state:

### Mobile code organization
- [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx) is very large
- flows are implemented, but maintainability will improve a lot if it is broken into separate screens/components

### Dummy vs live payment
- payment flow works in mock mode without Razorpay keys
- live mode depends on correct Razorpay key setup

### Some advanced analytics are heuristic
- delinquency and forecasting logic is estimate-based
- not all calculations are accounting-grade yet

### File uploads are URL-based right now
- onboarding documents and handoff documents currently use URLs
- there is no true file upload storage layer yet

### SQLite is fine for local/demo use
- for production, PostgreSQL would be a better backend choice

## 19. Recommended Next Refactor

If we want to improve the codebase without changing product scope, the best next steps would be:

1. Split [mobile/App.tsx](/Users/anoopsubramani/Documents/Playground/mobile/App.tsx) into dedicated screens and hooks
2. Add proper backend tests for each API flow
3. Replace document URL entry with real file upload storage
4. Add explicit landlord-side maintenance record create/update endpoints
5. Harden analytics calculations around due dates and accounting categories

