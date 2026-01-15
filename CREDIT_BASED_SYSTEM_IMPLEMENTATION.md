# Credit-Based Subscription System Implementation Guide

## Overview

This document describes the implementation of the hybrid credit-based subscription model for Focus Guard. The system replaces the previous simple tier-based model with a flexible credit economy that better aligns with variable LLM costs.

## Business Model Summary

### Core Currency: Analysis Credits

- **1 Credit = 1 Standard Report** (up to 100 comments)
- **Viewing cached reports**: 0 Credits (access based on tier privileges)
- **Force refresh**: 1 Credit (standard depth)

### Subscription Tiers

| Feature | Free (The Observer) | Starter (The Researcher) | Pro (The Power User) |
|---------|-------------------|------------------------|-------------------|
| Monthly Fee | $0 | $3.99 | $9.99 |
| Sign-up Bonus | 5 Credits (one-time) | N/A | N/A |
| Monthly Quota | 0 Credits | 50 Credits | 300 Credits |
| View Cached Reports | Summary only | Summary + Sentiment | Full Access |
| Max Comment Depth | 100 | 100 | 1,000 |
| Data Export | ❌ | ❌ | ✅ (PDF & CSV) |
| Custom Context | ❌ | ❌ | ✅ |

### Credit Consumption Rates

#### Analysis Depth
- **Standard (100 comments)**: 1 Credit
- **Deep (up to 500 comments)**: 3 Credits
- **Extreme (up to 1,000 comments)**: 5 Credits

#### Advanced Features
- **Custom Context Query** (Pro only): +0.5 to 1.0 Credits per run

### Top-Up Packs (One-Time Purchase)

- **Small Pack**: 20 Credits / $2.99
- **Medium Pack**: 50 Credits / $5.99
- **Large Pack**: 150 Credits / $12.99

## Database Schema Changes

### Migrations Created

1. **20260112_0001_add_credit_system_to_users.py**
   - Adds `credits_balance` to users table
   - Adds `is_one_off_bonus_claimed` to prevent abuse

2. **20260112_0002_create_credit_transaction_log.py**
   - Creates `credit_transaction_log` table for audit trail
   - Tracks all credit operations (deductions, refunds, purchases, grants)

3. **20260112_0003_add_monthly_credits_to_subscription.py**
   - Adds `monthly_credits_quota` to subscriptions
   - Adds `billing_cycle_day` for quota reset tracking
   - Adds `last_credit_reset_date` for monthly grant tracking

### New Database Tables

#### credit_transaction_log
```sql
- id (PK)
- user_id (FK to users)
- amount (positive = added, negative = deducted)
- transaction_type (deduction, refund, purchase, monthly_grant, signup_bonus)
- balance_before
- balance_after
- video_id (optional, for analysis operations)
- async_job_id (optional FK to async_jobs)
- comment_depth (optional, number of comments analyzed)
- stripe_payment_intent_id (optional, for purchases)
- description (human-readable)
- created_at, updated_at
```

## Configuration Updates

### tier_config.json Changes

Updated with new pricing structure:
- Added `credits` object with `signup_bonus` and `monthly_quota`
- Added `credit_pricing` section for depth-based costs
- Added `topup_packs` array with pack configurations
- Enhanced `features` with new attributes:
  - `cached_report_access`: "summary_only" | "summary_and_sentiment" | "full_access"
  - `data_export`: boolean
  - `custom_context_queries`: boolean
- Added `max_comment_depth` to limits
- Added `cache_validity_hours` to system_settings

## Service Layer

### CreditService (`app/services/credit_service.py`)

New service providing credit operations:

#### Core Methods

1. **check_sufficient_credits(user, required_credits)**
   - Validates user has enough credits
   - Returns (bool, error_message)

2. **deduct_credits(user, amount, db, ...)**
   - Atomically deducts credits
   - Creates transaction log
   - Raises ValueError if insufficient

3. **refund_credits(user, amount, db, ...)**
   - Returns credits on job failure
   - Creates refund transaction log

4. **grant_signup_bonus(user, subscription, db)**
   - One-time 5 credit bonus for free tier
   - Prevents duplicate claims via `is_one_off_bonus_claimed`

5. **grant_monthly_credits(user, subscription, db)**
   - Grants monthly quota on billing cycle
   - Tracks last reset date
   - Called automatically on:
     - User authentication
     - Invoice payment (webhook)

6. **purchase_topup_pack(user, pack_id, db, stripe_payment_intent_id)**
   - Adds credits from top-up purchase
   - Links to Stripe payment for audit

7. **check_and_grant_periodic_credits(user, subscription, db)**
   - Convenience method called on auth
   - Grants signup bonus if eligible
   - Grants monthly credits if due

8. **is_cached_report_valid(last_analysis_date)**
   - Checks if cached report is within validity window (24h)

### ConfigService Updates

Extended with credit-specific methods:

1. **get_credit_pricing()** - Returns credit cost configuration
2. **get_topup_packs()** - Returns available top-up packs
3. **get_topup_pack_by_id(pack_id)** - Get specific pack
4. **calculate_credit_cost(comment_depth, is_custom_context)** - Calculate operation cost

## API Endpoints

### Credit Management Endpoints (`/api/v1/credits`)

#### GET /credits/balance
Returns user's current credit balance and subscription info.

**Response:**
```json
{
  "credits_balance": 25,
  "monthly_quota": 50,
  "tier": "starter",
  "next_reset_date": "2026-02-12"
}
```

#### GET /credits/topup-packs
Returns available credit top-up packs.

**Response:**
```json
{
  "packs": [
    {
      "id": "small_pack",
      "name": "Small Pack",
      "credits": 20,
      "price": 2.99
    },
    ...
  ]
}
```

#### GET /credits/history?limit=50&offset=0
Returns user's credit transaction history.

**Response:**
```json
{
  "transactions": [
    {
      "id": 123,
      "amount": -1,
      "transaction_type": "deduction",
      "balance_after": 24,
      "video_id": "dQw4w9WgXcQ",
      "description": "Analysis deduction: 1 credits",
      "created_at": "2026-01-12T10:30:00Z"
    }
  ],
  "total_count": 47
}
```

#### POST /credits/estimate-cost
Estimate credit cost for an analysis operation.

**Request:**
```json
{
  "comment_depth": 100,
  "is_custom_context": false
}
```

**Response:**
```json
{
  "estimated_credits": 1,
  "comment_depth": 100,
  "has_sufficient_credits": true,
  "current_balance": 25
}
```

### Stripe Integration Updates

#### POST /stripe/create-topup-checkout
Creates Stripe Checkout for credit top-up purchase.

**Request:**
```json
{
  "pack_id": "medium_pack",
  "success_url": "https://myapp.com/success",
  "cancel_url": "https://myapp.com/cancel"
}
```

**Response:**
```json
{
  "session_id": "cs_test_...",
  "checkout_url": "https://checkout.stripe.com/...",
  "customer_id": "cus_..."
}
```

### Webhook Enhancements

#### checkout.session.completed
- Now differentiates between subscription and top-up purchases
- Checks `metadata.purchase_type` field
- Routes to appropriate handler

#### invoice.payment_succeeded
- Automatically grants monthly credits on recurring payment
- Sets billing cycle day if not set
- Calls `credit_service.grant_monthly_credits()`

## Authentication Flow Integration

### Updated get_current_user() Dependency

The authentication dependency now automatically:
1. Performs daily subscription reset (existing)
2. **Checks and grants periodic credits** (new):
   - Signup bonus if not claimed
   - Monthly credits if billing cycle has passed

This ensures users receive their credits automatically without manual intervention.

## Implementation Checklist

### Completed ✅

- [x] Database migrations for credit system
- [x] CreditTransaction model and relationships
- [x] User model updates (credits_balance, bonus flag)
- [x] Subscription model updates (monthly_credits_quota, billing_cycle_day)
- [x] Credit service with all operations
- [x] Config service extensions
- [x] Tier configuration updates
- [x] Credit API endpoints
- [x] Stripe service extensions for top-ups
- [x] Webhook handlers for top-ups and monthly grants
- [x] Authentication integration for auto-grants
- [x] Pydantic schemas for credit responses

### Next Steps (Integration Required) 🔨

#### 1. Analysis Endpoint Integration

You need to update analysis generation endpoints to:

**Before generating analysis:**
```python
from app.services.credit_service import credit_service
from app.services.config_service import config_service

# Calculate required credits
required_credits = config_service.calculate_credit_cost(
    comment_depth=comment_count,
    is_custom_context=has_custom_query
)

# Check sufficiency
has_credits, error = credit_service.check_sufficient_credits(
    user=current_user,
    required_credits=required_credits
)

if not has_credits:
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=error
    )

# Deduct credits before starting job
transaction = credit_service.deduct_credits(
    user=current_user,
    amount=required_credits,
    db=db,
    video_id=video_id,
    async_job_id=job.id if hasattr(job, 'id') else None,
    comment_depth=comment_count,
    description=f"Analysis: {video_id} ({comment_count} comments)"
)
```

**On job failure:**
```python
# In error handler or job failure callback
credit_service.refund_credits(
    user=user,
    amount=deducted_amount,
    db=db,
    video_id=video_id,
    async_job_id=job.id,
    description=f"Refund: Job {job.id} failed"
)
```

#### 2. Cached Report Access Control

Update report retrieval to check tier privileges:

```python
tier_config = config_service.get_tier_config(subscription.tier.value)
cached_access = tier_config.features.cached_report_access

# Check if user can access this cached report
if cached_access == "summary_only":
    # Only return summary data
    ...
elif cached_access == "summary_and_sentiment":
    # Return summary + sentiment
    ...
else:  # "full_access"
    # Return all data
    ...
```

#### 3. Environment Variables

Add Stripe Price IDs for top-up packs to `.env`:
```bash
# Top-up pack price IDs
STRIPE_TOPUP_SMALL_PRICE_ID=price_xxxxx
STRIPE_TOPUP_MEDIUM_PRICE_ID=price_xxxxx
STRIPE_TOPUP_LARGE_PRICE_ID=price_xxxxx
```

Update `tier_config.json` with these IDs.

#### 4. Run Migrations

```bash
# Apply database migrations
alembic upgrade head

# Verify tables created
psql -d your_database -c "\\dt credit_transaction_log"
```

#### 5. Testing Checklist

- [ ] User signup → receives 5 credit bonus (Free tier only)
- [ ] Credit deduction on analysis generation
- [ ] Credit refund on job failure
- [ ] Monthly credit grant on billing cycle
- [ ] Top-up pack purchase flow
- [ ] Webhook processing for top-ups
- [ ] Cached report access respects tier privileges
- [ ] Credit history tracking
- [ ] Balance API returns correct data
- [ ] Insufficient credits returns 402 error

## Key Files Modified/Created

### New Files
- `alembic/versions/20260112_0001_add_credit_system_to_users.py`
- `alembic/versions/20260112_0002_create_credit_transaction_log.py`
- `alembic/versions/20260112_0003_add_monthly_credits_to_subscription.py`
- `app/models/credit_transaction.py`
- `app/services/credit_service.py`
- `app/schemas/credits.py`
- `app/api/endpoints/credits.py`

### Modified Files
- `app/models/user.py` - Added credit fields and relationships
- `app/models/subscription.py` - Added monthly credit tracking
- `app/services/config_service.py` - Added credit methods
- `app/services/subscription_utils.py` - Integrated credit grants
- `app/services/stripe_service.py` - Added top-up methods
- `app/api/endpoints/stripe.py` - Added top-up endpoint, updated webhooks
- `app/auth/dependencies.py` - Auto-grant periodic credits
- `app/core/tier_config.json` - Complete restructure
- `app/api/routes.py` - Added credits router
- `app/api/endpoints/__init__.py` - Exported credits module
- `app/models/__init__.py` - Exported CreditTransaction model
- `app/schemas/stripe.py` - Added TopupCheckoutRequest

## Business Logic Flow

### User Journey: Starter Subscription

1. **User signs up** (Free tier)
   - Gets 5 credit signup bonus automatically
   - Can analyze 5 videos (100 comments each)

2. **User upgrades to Starter ($3.99/month)**
   - Gets 50 credits immediately on payment
   - Billing cycle day recorded (e.g., day 12)

3. **User analyzes videos**
   - 100 comments = 1 credit deducted
   - Transaction logged
   - Balance decreases

4. **Next month (day 12)**
   - User authenticates or webhook fires
   - System grants another 50 credits
   - `last_credit_reset_date` updated

5. **User runs out of credits**
   - Can purchase top-up pack
   - Small pack: 20 credits / $2.99
   - Credits added immediately

### Credit Refund Flow

1. **Job submitted** - Credits deducted upfront
2. **Job fails critically** - Automatic refund triggered
3. **Transaction logged** - Audit trail maintained
4. **Balance restored** - User not charged for failure

## Security Considerations

1. **Atomic Transactions** - All credit operations use database transactions
2. **Bonus Abuse Prevention** - `is_one_off_bonus_claimed` flag
3. **Webhook Idempotency** - Duplicate event detection via StripeEventLog
4. **Row Locking** - `with_for_update()` on credit-critical operations
5. **Audit Trail** - Every credit change logged with context

## Monitoring & Observability

### Key Metrics to Track

1. **Credit Velocity** - Average credits used per user per day
2. **Top-up Conversion** - % of users who purchase top-ups
3. **Refund Rate** - % of credits refunded due to failures
4. **Monthly Grant Timing** - Accuracy of billing cycle grants
5. **Bonus Claim Rate** - % of free users claiming signup bonus

### Log Queries

```python
# Users running out of credits
SELECT user_id, credits_balance, tier
FROM users u
JOIN subscriptions s ON u.id = s.user_id
WHERE u.credits_balance < 5 AND s.tier != 'free'

# Failed jobs needing refunds
SELECT job_id, user_id, credits_deducted
FROM async_jobs
WHERE status = 'failed' AND credits_refunded = false

# Monthly grant success rate
SELECT COUNT(*) as granted_today
FROM credit_transaction_log
WHERE transaction_type = 'monthly_grant'
AND DATE(created_at) = CURRENT_DATE
```

## FAQ

**Q: What happens to unused credits?**
A: Credits roll over indefinitely. They never expire.

**Q: Can users downgrade tiers?**
A: Yes. They keep their current credit balance but stop receiving monthly grants.

**Q: What if a user upgrades mid-cycle?**
A: They immediately receive the new tier's monthly quota on first payment.

**Q: How do refunds work if user cancels?**
A: Credits are non-refundable. User keeps balance until subscription ends.

**Q: Can free users purchase top-ups?**
A: Yes! This allows free users to use the service without monthly commitment.

---

**Implementation Date:** 2026-01-12
**System Version:** 2.0 - Credit Economy
**Status:** Core implementation complete, analysis integration required
