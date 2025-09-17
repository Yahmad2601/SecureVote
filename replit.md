# Overview

SecureVote is a biometric voting IoT web application designed to manage and monitor an ESP32-powered biometric voting system with fingerprint sensors. The application provides a comprehensive dashboard for election officials to manage voter registration, monitor real-time voting activity, oversee device status, and generate security reports. The system emphasizes security, real-time monitoring, and user-friendly interfaces for different administrative roles.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side is built with **React** and **TypeScript**, utilizing modern web technologies for a responsive and accessible interface:

- **Framework**: React with TypeScript for type safety and component-based architecture
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library built on Radix UI primitives for consistent, accessible design
- **Styling**: TailwindCSS with custom CSS variables for theming and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Authentication**: Context-based authentication system with role-based access control
- **Real-time Updates**: Polling-based approach with configurable intervals for live data updates

## Backend Architecture
The server-side follows a **RESTful API** pattern using Express.js:

- **Framework**: Express.js with TypeScript for robust server-side logic
- **Database ORM**: Drizzle ORM for type-safe database operations with PostgreSQL
- **API Design**: RESTful endpoints organized by functional domains (auth, voters, devices, votes, logs)
- **Session Management**: Express sessions with PostgreSQL session storage
- **Security**: Input validation using Zod schemas, role-based authorization middleware
- **Development**: Vite integration for hot module replacement in development

## Data Storage Solutions
The application uses **PostgreSQL** as the primary database with a well-structured schema:

- **Database**: PostgreSQL hosted on Neon (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations and schema versioning
- **Core Entities**: Users, Voters, Candidates, Devices, Votes, Security Logs, Activity Logs
- **Data Integrity**: Foreign key relationships, unique constraints, and default values
- **Audit Trail**: Comprehensive logging system for security events and user activities

## Authentication and Authorization
Multi-layered security approach with role-based access control:

- **Authentication**: Username/password authentication with session management
- **Authorization**: Three-tier role system (Super Admin, Election Officer, Observer)
- **Permission Model**: Granular permissions mapped to specific application features
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Security Logging**: All authentication attempts and security events are logged

## Real-time Monitoring System
Live data synchronization for election monitoring:

- **Polling Strategy**: Configurable polling intervals (5-30 seconds) for different data types
- **Dashboard Updates**: Real-time statistics, vote counts, and device status monitoring
- **Alert System**: Security alerts with severity levels and resolution tracking
- **Activity Feeds**: Live streams of voting activities and system events

# External Dependencies

## Database and Hosting
- **Neon Database**: Serverless PostgreSQL hosting with automatic scaling
- **Drizzle ORM**: Type-safe database operations and migrations
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## UI and Styling
- **shadcn/ui**: Pre-built accessible UI components based on Radix UI
- **Radix UI**: Headless component primitives for accessibility and customization
- **TailwindCSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent iconography

## Development and Build Tools
- **Vite**: Fast build tool with hot module replacement for development
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer for browser compatibility

## Data Management and Validation
- **TanStack Query**: Server state management with caching and synchronization
- **Zod**: Runtime type validation for API inputs and schema validation
- **React Hook Form**: Form state management with validation integration
- **date-fns**: Date manipulation and formatting utilities

## IoT Device Integration
The application is designed to integrate with ESP32-based voting devices through:
- **REST API**: HTTP endpoints for device communication and data synchronization
- **Device Management**: Remote device status monitoring and control capabilities
- **Fingerprint Data**: Secure handling of biometric hash data for voter verification

## Deployment Checklist

To prepare the application for Vercel (or any Node.js) deployment, complete the following steps:

1. **Configure environment variables**
   - `DATABASE_URL` (required): PostgreSQL connection string with SSL support enabled.
   - `SESSION_SECRET` (required in production): At least 32 random characters. Generate a unique, high-entropy value (for example with `openssl rand -hex 32`) and store it as a protected environment secret.
   - `DEFAULT_ADMIN_PASSWORD` (required for seeding): Plain-text password used when running `npm run db:seed`. This value is never stored in the repository.
   - `DEFAULT_ADMIN_USERNAME` (optional, default `admin`): Username for the initial super admin account created by the seed script.
   - `DEFAULT_ADMIN_FULL_NAME` (optional, default `System Administrator`): Display name for the initial admin.
   - `SEED_SAMPLE_DATA` (optional): Set to `true` to populate demo candidates and devices during seeding.

2. **Provision the database schema**
   ```bash
   npm run db:push
   ```

3. **Seed critical data**
   ```bash
   npm run db:seed
   ```
   This command creates the initial super admin user and, if enabled, demo data. It is safe to run multiple times; existing records will be left untouched.

4. **Build the project** (Vercel runs this automatically during deployment)
   ```bash
   npm run build
   ```
   - **Build command**: `npm run build`
   - **Output directory**: `dist`

5. **Verify production readiness**
   - Confirm that runtime environment variables are defined in Vercel.
   - Create a Vercel secret named `securevote-session-secret` containing your generated `SESSION_SECRET`, then link it to the project (the deployment configuration references this secret automatically).
   - Rotate the seeded admin password after the first login and provide credentials to authorized personnel only.
