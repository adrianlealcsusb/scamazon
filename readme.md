# Scamazon WMS (Warehouse Management System)

A multi-tenant Warehouse Management System and Direct-to-Customer Storefront powered by Supabase Auth, PostgreSQL, and modern Tailwind CSS with full light/dark theme support.

---

## 🚀 Feature Checklist & Implementation Status

* **Authentication & User Management**
  * Built-in Customer Sign In & Sign Up Modal 🟢
  * Role-based Portal Redirection (Owner, Storefront, Worker, Customer) 🟢
  * Password Reset / Forgot Password Email Delivery via Custom SMTP (Resend) 🟢
  * Supabase Recovery Listener & Password Update Flow 🟢
  * Session Persistence & Guest Browsing Mode 🟢

* **Website Portals**
  * **Owner Dashboard (`owner.html`)**
    * Overview & Real-time Metrics 🟢
    * AI Overview 🔴
    * Listings
      * Add 🟢
      * Remove 🟢
      * Edit 🟢
      * Manage coupons/discounts 🟡
    * Manage Storefronts
      * Add 🟢
      * Edit 🟢
      * Remove 🟢
      * Set status 🟢
    * Workers
      * Add 🟢
      * Revoke 🟢
      * Set status 🟢
    * Orders 
      * View 🟢
      * Set status 🟢
      * Receipts / Invoices 🟢
      * Live Tracking 🟢
  * **Storefront Manager Portal (`storefront.html`)**
    * Branch Overview & Inventory Management 🟢
    * AI Overview 🔴
    * Listings
      * Add 🟢
      * Remove 🟢
      * Edit 🟢
      * Manage coupons/discounts 🟡
    * Workers
      * Add 🟢
      * Revoke 🟢
      * Set status 🟢
    * Orders 
      * View 🟢
      * Set status 🟢
      * Receipts / Invoices 🟢
      * Live Tracking 🟢
  * **Worker Portal (`worker.html`)**
    * Listings
      * Add 🟢
      * Remove 🟢
      * Edit 🟢
    * Orders 
      * View 🟢
      * Set status 🟢
      * Receipts / Invoices 🟢
      * Live Tracking 🟢
    * Scanner (Live camera QR/barcode scan) 🟢
  * **Customer Storefront (`index.html`)**
    * AI Assistant / Support Chat 🔴
    * Listings & Catalog
      * Search with Keyboard Shortcut (`/`) 🟢
      * Storefront Branch Filter 🟢
      * Sort (Price Low/High, Name, Stock) 🟢
      * In-stock only filter 🟢
      * Lazy loading images 🟢
      * Add to cart (Interactive slide-over drawer) 🟢
      * Coupons / discounts 🟡
    * Orders & Fulfillment
      * Direct Courier Dispatch Checkout 🟢
      * Real-time Multi-step Delivery Tracking 🟢
      * Verified Line-item Printable Invoices & Receipts 🟢
      * View order history 🟢
      * Refund / cancel 🔴
  * **Global Platform UI & Experience**
    * Responsive Mobile Navigation Drawers (Owner, Storefront, Worker) 🟢
    * Full Light / Dark Mode Toggle across all pages 🟢
    * Modern Manrope Typography & Slate/Amber Design System 🟢
    * Informational Marketing Pages (`plans.html`, `aboutus.html`) 🟢

---

### Legend
- 🟢: Implemented & Verified
- 🟡: In Progress / Partially Implemented
- 🔴: Backlog / Not Yet Implemented
