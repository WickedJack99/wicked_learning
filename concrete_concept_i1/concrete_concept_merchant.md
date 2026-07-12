# Purpose

Define merchant activities as configurable exchange or unlock interactions inside nodes.

The source file is currently empty, so this proposal keeps the merchant semantic broad: any world can represent it as a vendor, archive, shrine, station, workshop desk or abstract exchange point.

# Core Concepts

- Merchant activity: Interaction where learners obtain, unlock or exchange items, tools, hints or optional content.
- Offer: Available item or service.
- Cost: Requirement such as artifact, completion, competency or item.
- Purchase effect: Result of accepting an offer.
- Stock rule: Availability condition for offers.

# User Experience

## Learner Experience

Learners open the merchant interaction and see available offers. Offers may unlock tools, optional lessons, hints, cosmetics or artifacts.

The interaction should support autonomy and exploration, not pressure spending or scarcity tricks.

## Admin Experience

Admins configure offers, costs, stock rules, visuals, unlock effects and whether offers are repeatable.

# Data Model Draft

`merchant_activities`
- purpose: Store merchant-specific settings.
- important_fields: `id`, `activity_id`, `merchant_name`, `presentation_mode`, `visual_config_json`.
- relationships: Extends activity.

`merchant_offers`
- purpose: Store exchange options.
- important_fields: `id`, `merchant_activity_id`, `title`, `description`, `cost_json`, `effect_json`, `repeatable`, `sort_order`.
- relationships: Belongs to merchant activity.

`learner_merchant_transactions`
- purpose: Track accepted offers.
- important_fields: `id`, `user_id`, `merchant_offer_id`, `status`, `created_at`, `result_json`.
- relationships: Belongs to user and offer.

# Relationships

A merchant activity has many offers. Offers can require inventory items, tools, competencies or completed activities. Offers can grant items, tools, activities or map access.

# State and Lifecycle

Offer states: `hidden`, `locked`, `available`, `accepted`, `sold_out`, `disabled`.

Transaction states: `pending`, `completed`, `failed`, `refunded`.

# Configuration Options

Admins can configure offer visibility, requirements, costs, effects, repeatability, stock, display order and learner-facing explanation of missing requirements.

# Visual Configuration

Merchant visuals are fully configurable. The same activity may be a shopkeeper, console, vending machine, spell circle, orbital depot or plain list.

Configurable assets include merchant icon, panel style, offer icon, acceptance animation, unavailable state and sound tokens.

# API / Backend Responsibilities

The backend should resolve available offers, validate requirements, execute transactions atomically and apply effects such as granting items or unlocking content.

# Frontend Responsibilities

The frontend renders offers, requirements, accepted state and confirmation flows. It should make missing requirements understandable without hardcoding genre language like gold or shops.

# Admin Interface

Required screens include offer editor, requirement builder, effect builder, transaction log and preview as learner.

# Permissions and Privacy

Learners can see offers available to them. Admins can configure merchants. Transaction history is learner data and should be protected.

# Edge Cases

- Transaction consumes item but effect fails.
- Offer references deleted item.
- Learner accepts same non-repeatable offer twice from parallel tabs.
- Merchant node becomes hidden after transaction.

# Open Questions

- Should there be currencies, or only meaningful artifacts and requirements?
- Should offers be shared globally or node-specific?
- Should failed transactions be automatically rolled back?

# MVP Scope

- Merchant activity with offers.
- Requirements based on owned item/tool or completed activity.
- Effects that grant item/tool or unlock activity.
- Transaction tracking.

# Later Extensions

- Limited-time offers.
- Personalized recommendations.
- Multi-step exchanges.
- Community-created merchant presets.
