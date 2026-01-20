# Inventory Management App

A modern inventory management application built with Next.js, Shadcn UI, Prisma, and SQLite.

## Features

- **Inventory Tracking**: View, search, and filter inventory items.
- **Excel Import/Export**: 
  - Import inventory data from Excel files (`.xlsx`, `.xls`).
  - Export current view to Excel with one click.
- **Status Management**: 
  - Visual color coding for statuses:
    - 🔴 **Not yet**: Pending items
    - 🟡 **Checked**: Verified items
    - 🟢 **Updated**: Confirmed and updated items
- **Data Editing**: Update item details including price, quantity, and expiry dates via a modal.
- **Sorting**: Sort table data by any column.

## Tech Stack

- **Framework**: Next.js 16
- **UI Library**: Shadcn UI (Radix Primitives + Tailwind CSS)
- **Database**: SQLite with Prisma ORM
- **Icons**: Lucide React
- **Utils**: 
  - `xlsx` for Excel processing
  - `date-fns` for date formatting
  - `sonner` for notifications

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database**:
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

- **Importing Data**: Click "Import from Excel" and select a valid inventory spreadsheet.
- **Editing Items**: Click the pencil icon on any row to open the edit modal.
- **Sorting**: Click on column headers to sort ascending or descending.
- **Exporting**: Click "Export Excel" to download the current list.

## Testing

Run unit tests with:
```bash
npm test
```
