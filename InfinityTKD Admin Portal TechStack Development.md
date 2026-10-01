# INFINITY TKD ADMIN PORTAL: COMPREHENSIVE TECHNICAL & DESIGN SPECIFICATION

This document outlines the complete architectural, design, and functional blueprint for the Infinity Taekwondo Admin Portal. Engineered as a **Progressive Web Application (PWA)**, this system is designed to provide a native, app-like experience across all devices. It integrates strict Role-Based Access Control (RBAC) to manage your specialized curriculum (Recognized/Freestyle Poomsae, Demonstration, and Tricking) and operations seamlessly.

---

## 1. ADVANCED TECHNOLOGY STACK

To achieve a modern, lightning-fast, and secure application, the portal utilizes the following enterprise-grade stack:

* **Core Framework:** **Next.js 14+ (App Router)**
* Enables Server-Side Rendering (SSR) for secure data fetching and React Server Components for optimal performance.


* **Language:** **TypeScript**
* Ensures strict type safety, preventing critical errors in financial and student data management.


* **PWA Engine:** **`next-pwa`**
* Transforms the web app into an installable application on iOS, Android, and Desktop. Includes Service Workers for offline caching (critical for coaches taking attendance if the dojang Wi-Fi drops).


* **Styling & UI Library:** **Tailwind CSS + Shadcn UI**
* Provides headless, accessible components that are 100% customizable to your exact brand geometry.


* **State & Form Management:** **React Hook Form + Zod + TanStack Query**
* Handles complex data entry with instant validation and caches Supabase data for zero-latency page transitions.


* **Animations:** **Framer Motion**
* Delivers smooth, 60fps page transitions, expanding cards, and modal pop-ups without heavy performance costs.


* **Internationalization (i18n):** **`next-intl`**
* Native integration for seamless, dynamic switching between **English (en)**, **Chinese (zh)**, and **Khmer (km)**.



---

## 2. UX/UI & LAYOUT DESIGN SYSTEM

The design language of Infinity TKD is modern, minimalist, and highly functional. It prioritizes clarity, speed, and exact brand alignment.

### A. Brand Color Palette & Theming

The application supports seamless toggling between Light and Dark modes.

* **Light Mode:**
* **Background:** `#FFFFFF` (Pure White)
* **Primary Action (Buttons/Highlights):** `#DC2626` (Infinity Red)
* **Support/Text:** `#000000` (Pure Black)
* **Surface/Cards:** `#F9FAFB` (Subtle off-white to lift cards off the background)


* **Dark Mode:**
* **Background:** `#000000` (Pure Black)
* **Primary Action (Buttons/Highlights):** `#EF4444` (Vibrant Red for dark contrast)
* **Support/Text:** `#FFFFFF` (Pure White)
* **Surface/Cards:** `#111827` (Deep dark blue/gray for elevated elements)



### B. The 8px Geometry Rule

Every structural element in the UI adheres to a strict 8px border radius to maintain a uniform, modern aesthetic.

* `rounded-[8px]`: Applied to all Modals, Data Cards, Profile Pictures, Inputs, and Action Buttons.

### C. Responsive Layout Architecture (PWA Native Feel)

* **Desktop View (> 1024px) - "Admin Command Center":**
* Persistent Left Sidebar (250px) containing navigation, Language Selector, and Theme Toggle.
* Main content area utilizes wide data tables and multi-column dashboard widgets.


* **Tablet View (768px - 1024px) - "Coach’s Clipboard":**
* Sidebar collapses into a thin icon strip.
* UI components scale up slightly for better touch targets (crucial for coaches tapping attendance on the mat).


* **Mobile View (< 768px) - "On-the-Go App":**
* Sidebar disappears entirely.
* Navigation moves to a native-style **Bottom Navigation Bar** (Home, Students, Attendance, Profile).
* Data tables convert into stacked vertical cards for easy scrolling.



---

## 3. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX

Security and workflow efficiency are managed through a strict hierarchy. Features and data visibility adapt instantly based on the logged-in user's role.

| Feature / Module | Admin (Root) | Head Coach | Coach | Assistant Coach |
| --- | --- | --- | --- | --- |
| **System Settings** | Full Access (Create Users) | No Access | No Access | No Access |
| **Financial Ledger** | View / Edit / Add | View Only (High-level) | No Access | No Access |
| **Student Directory** | Full Access (CRUD) | View / Edit Notes | View Only | View Only |
| **Test Eligibility** | Approve Promotions | Recommend / View | View Only | View Only |
| **Attendance Tracking** | Full Access | Full Access | Full Access | Full Access |
| **LMS Curriculum** | Upload / Edit / Delete | Upload / Edit | View Only | View Only |
| **Class Scheduling** | Create / Edit / Delete | Create / Edit | View Only | View Only |

---

## 4. COMPREHENSIVE FEATURE SPECIFICATION

### Module 1: The Executive Dashboard (Analytics)

* **KPI Widgets:** Total active students, monthly revenue tracker, attendance health (percentage of students attending regularly).
* **Action Center:** Alerts for pending web registrations requiring approval, and a list of students who have hit the time-in-grade requirement for their next belt test.

### Module 2: Advanced Student Directory & Profiles

* **Data Table:** Sortable, filterable list of all students. Includes quick-filters for Branch, Belt Level, and Age Group.
* **Dynamic Profile Sheet:** Clicking a student slides out a comprehensive profile panel containing:
* Demographics & Guardian Info.
* **Belt Timeline:** A visual step-tracker showing their journey from White Belt upward.
* **Achievement Log:** Medals won in Demonstration, Tricking, or Poomsae competitions.
* **Payment Status:** A quick-glance green/red indicator for the current month's tuition.



### Module 3: Native-Feel Attendance Engine

* **Class Selection:** Coaches select their assigned Branch and Class Session (e.g., "Monday 5:00 PM - Acrobatic Fundamentals").
* **Touch-Optimized Roster:** Displays large student cards. A single tap cycles the student's status: `Present` (Green) -> `Absent` (Red) -> `Late` (Yellow).
* **Offline Mode (PWA):** If the internet drops, attendance is stored locally in the browser's IndexedDB and silently syncs to Supabase the moment the connection is restored.

### Module 4: Financial Ledger & Invoicing

* **Matrix View:** A dense, spreadsheet-like view for the Admin to see the entire year’s payment statuses at a glance.
* **One-Click Receipt:** Selecting a student's unpaid month opens a sleek modal to log the payment amount, apply any active scholarship discounts, and generate a downloadable PDF receipt.

### Module 5: LMS Curriculum Manager

* **Content Library:** Specifically tailored to house content for Recognized Poomsae, Freestyle, Demonstration, and Tricking.
* **Upload Interface:** Form to assign video links, set the target belt requirement, and attach descriptions or focus points.
* **Student Progress Viewer:** Coaches can view an analytics panel showing which students have watched the required digital curriculum prior to testing.

### Module 6: Branch & Schedule Orchestration

* **Branch Management:** Add new dojang locations, assign Head Coaches to specific branches, and manage maximum student capacities.
* **Visual Calendar:** A weekly calendar interface to drag-and-drop class sessions, adjust timings, and enroll specific student cohorts into time slots.

---

## 5. SMART WORKFLOW & INTERNATIONALIZATION

### i18n Implementation

Using `next-intl`, the application wrapper detects the user's preferred language.

* **UI Translation:** All static text (menus, buttons, table headers) instantly translates between English, Chinese, and Khmer.
* **Khmer Typography:** The application utilizes a web-optimized Khmer font (e.g., *Suwannaphum* or *Kantumruy Pro* via Google Fonts) for flawless rendering of names and localized UI elements, while keeping *Inter* for English numerals and characters.

### Progressive Web App (PWA) Installation

When a Coach or Admin navigates to the portal on their iPhone, iPad, or Android device, the browser will prompt: **"Add Infinity TKD Admin to Home Screen."**

* Once added, it launches without a browser URL bar, functions in full-screen mode, utilizes custom splash screens featuring your logo, and delivers a true native software experience.