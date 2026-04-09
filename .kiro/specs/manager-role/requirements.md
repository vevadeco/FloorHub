# Requirements Document

## Introduction

FloorHub currently supports two user roles: "owner" (full access) and "employee" (limited access to invoices, commissions, leads, and messages). This feature introduces a "manager" role as a middle tier between owner and employee. Managers gain access to operational tabs such as delivery orders, commissions, returns, installation jobs, and other day-to-day management views, while sales employees remain restricted to their current limited set of tabs. The role is enforced across the type system, JWT authentication, sidebar navigation, middleware route guards, and API authorization.

## Glossary

- **FloorHub**: The flooring business management dashboard application
- **Role**: A user classification that determines access permissions; one of "owner", "manager", or "employee"
- **Owner**: The highest-privilege role with full access to all features and settings
- **Manager**: A mid-tier role with access to operational features but not administrative settings or employee management
- **Employee**: The lowest-privilege role with access limited to invoices, personal commissions, leads, and messages
- **Sidebar**: The navigation panel that displays available tabs based on the authenticated user's role
- **Middleware**: The Next.js middleware layer that enforces route-level access control before page rendering
- **JWT_Payload**: The JSON Web Token payload containing user identity and role information
- **Auth_Module**: The authentication library (`lib/auth.ts`) responsible for token signing, verification, and role checks

## Requirements

### Requirement 1: Extend the Role Type

**User Story:** As a developer, I want the Role type to include "manager", so that the type system enforces the new role across the entire codebase.

#### Acceptance Criteria

1. THE Role type SHALL include "owner", "manager", and "employee" as its only valid values
2. THE JWTPayload interface SHALL accept "manager" as a valid role value
3. THE User interface SHALL accept "manager" as a valid role value

### Requirement 2: Manager Sidebar Navigation

**User Story:** As a manager, I want to see operational tabs in the sidebar, so that I can access delivery orders, commissions, returns, and other management-relevant pages.

#### Acceptance Criteria

1. WHILE a user is authenticated with the "manager" role, THE Sidebar SHALL display the following navigation tabs: Dashboard, Invoices, Customers, Inventory, Leads, Commissions, Installation Jobs, Delivery Orders, Calendar, Returns, and Messages
2. WHILE a user is authenticated with the "employee" role, THE Sidebar SHALL continue to display only: Invoices, Calendar, My Commissions, Leads, and Messages
3. WHILE a user is authenticated with the "manager" role, THE Sidebar SHALL NOT display: Employees, Expenses, Contractors, Reports, Analytics, or Settings tabs
4. THE Sidebar SHALL display "manager" as the role label for users with the manager role

### Requirement 3: Middleware Route Access Control for Managers

**User Story:** As a manager, I want to access manager-level routes without being redirected, so that I can perform my operational duties.

#### Acceptance Criteria

1. WHILE a user has the "manager" role, THE Middleware SHALL allow access to the following routes: /, /invoices, /customers, /inventory, /leads, /commissions, /installation-jobs, /delivery-orders, /calendar, /returns, /messages
2. WHILE a user has the "manager" role, THE Middleware SHALL redirect to the dashboard (/) when the user attempts to access: /employees, /expenses, /contractors, /reports, /analytics, /settings
3. WHILE a user has the "employee" role, THE Middleware SHALL continue to restrict access to the current allowed routes only (invoices, commissions, leads, messages, calendar)
4. IF a user with the "manager" role attempts to access a restricted route, THEN THE Middleware SHALL redirect the user to the dashboard page

### Requirement 4: API Route Authorization for Managers

**User Story:** As a manager, I want API endpoints to respect my role, so that I can read and write operational data without owner-level privileges.

#### Acceptance Criteria

1. WHEN a manager calls an API endpoint that uses requireOwner, THE Auth_Module SHALL reject the request with a 403 Forbidden response
2. THE Auth_Module SHALL provide a requireManagerOrOwner helper function that allows access for both "manager" and "owner" roles
3. WHEN a manager calls the delivery-orders, commissions, installation-jobs, returns, customers, inventory, leads, or calendar API endpoints, THE API SHALL allow read access
4. WHEN a manager calls the delivery-orders, installation-jobs, or returns API endpoints with write operations, THE API SHALL allow the operation
5. THE Auth_Module SHALL provide a requireAtLeast helper function that accepts a minimum role level and rejects users below that level

### Requirement 5: Employee Creation with Manager Role

**User Story:** As an owner, I want to assign the "manager" role when creating a new user, so that I can delegate operational responsibilities.

#### Acceptance Criteria

1. WHEN an owner creates a new user, THE create-employee API SHALL accept "manager" as a valid role value
2. WHEN an owner creates a new user without specifying a role, THE create-employee API SHALL default to the "employee" role
3. THE create-employee API SHALL store the role value in the database users table
4. WHEN a non-owner user calls the create-employee API, THE API SHALL reject the request with a 403 Forbidden response

### Requirement 6: Database Schema Compatibility

**User Story:** As a developer, I want the database schema to support the "manager" role value, so that existing data remains valid and new managers can be stored.

#### Acceptance Criteria

1. THE database users table role column SHALL accept "owner", "manager", and "employee" as valid values
2. THE database users table role column SHALL continue to default to "employee" for new records
3. WHEN the application starts, THE schema SHALL remain compatible with existing user records that have "owner" or "employee" roles

### Requirement 7: Role Hierarchy Enforcement

**User Story:** As a system administrator, I want a clear role hierarchy (owner > manager > employee), so that authorization checks are consistent and predictable.

#### Acceptance Criteria

1. THE Auth_Module SHALL define a role hierarchy where owner has the highest privilege, manager has mid-level privilege, and employee has the lowest privilege
2. WHEN a role-level check is performed, THE Auth_Module SHALL grant access to users at or above the required role level
3. THE requireOwner function SHALL continue to allow only users with the "owner" role
