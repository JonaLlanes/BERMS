# Biomedical Equipment Records Management System

A web-based biomedical equipment records management system for tracking medical devices, preventive maintenance (PM) schedules, operational status, and service history. The project focuses on inventory management and maintenance tracking concepts rather than clinical workflows or patient-related information.

## Project background

This project was inspired by my experience working as a Biomedical Clerk at The Medical City. While supporting biomedical equipment record management activities, I observed how medical devices were tracked through inventories, preventive maintenance schedules, operational status updates, and service documentation.

To strengthen my backend development skills, I developed this Biomedical Equipment Records Management System using Node.js, Express, and MySQL. The application simulates core record-management processes commonly used to organize equipment information, monitor preventive maintenance schedules, maintain service histories, and support equipment lifecycle tracking.

The primary goal of this project was to apply software engineering concepts such as relational database design, RESTful API development, business logic implementation, data validation, and testing within a healthcare-related scenario that reflects processes I have encountered in a professional environment.

Although simplified for learning purposes, the project structure and terminology were influenced by equipment record management practices I observed while working in a healthcare environment.

## What you can do

- Add and edit a device
- Search by device name, asset tag, serial number, model, manufacturer, or department
- Filter by PM status, operational status, device category, PM schedule, and department
- See inventory totals that stay on the full list while the table is filtered
- Open a device to see its record and service history
- Record a service visit, including the operational status after the check and the findings

## How records work

PM status is calculated from `next_maintenance_date` when a record is read. It is not stored on the device.

| Status | Rule |
| --- | --- |
| Not Scheduled | No next PM date |
| Overdue | Next PM date is before today |
| Due | Next PM date is today or within 30 days |
| Current | Next PM date is more than 30 days away |

The last PM date is updated only by preventive maintenance, an incoming inspection, an electrical safety test, or calibration. A corrective visit does not change it. The last PM date cannot be in the future. If both PM dates are filled in, the last date has to be on or before the next date. A device can still be in service while its PM is overdue. Operational status and PM status are separate. Decommissioned devices are left out of the PM counts.

Service history is stored per device in `maintenance_history`. Those rows are not removed. Creating a device writes an asset registration, so a device created here is not deleted. Mark it Decommissioned if it is no longer in use.

The PM schedule is monthly, quarterly, semi-annual, or annual. The latest preventive maintenance, incoming inspection, electrical safety test, or calibration sets the next due date from that schedule and also sets the last PM date. Corrective maintenance does not change either PM date.

A service record updates the device in one transaction. The engineer picks the operational status after the check. Findings are required when that status is not In Service.

Service history is listed on the device record, newest first. The counts at the top are split into devices in use and preventive maintenance. Filters are applied in SQL. The counts are for every device, including while the list is filtered. Invalid input returns `400`. A duplicate asset tag or serial number returns `409`. A missing device returns `404`.

## Tech stack

- Node.js and Express
- MySQL, accessed with `mysql2`
- HTML, CSS, and JavaScript for the page that calls the API

## Run it

Node.js and a local MySQL server are required.

From the project folder:

```powershell
npm install
copy .env.example .env
npm run setup
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Edit `.env` if MySQL is not `root` on `localhost:3306` with an empty password. If setup says the connection was refused, start MySQL and check `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD`.

`npm run setup` creates the `biomedical_equipment` database, both tables, and the sample devices. It is safe to run again: existing asset tags are left in place, and a sample history row is inserted only when that finding is not already stored. You can also run [server/schema.sql](server/schema.sql) in a MySQL client.

`npm test` checks the PM status rules, service-record validation, and the filter SQL. It does not need MySQL.

## Sample records

Dates follow the day setup was last run. Recording a later PM changes the next date, so these descriptions match a fresh setup, not later edits.

| Asset tag | Record |
| --- | --- |
| PM-001 | Semi-annual. PM due. Incoming inspection and PM by M. Santos |
| IP-014 | Quarterly. PM overdue. Emergency Department. Supplier follow-up by P. Garcia |
| VN-208 | Semi-annual. PM current |
| DF-033 | Annual. In repair. PM not scheduled |
| IMG-017 | Annual. Out of service. PM overdue |

## Data model

Database: `biomedical_equipment`

### `equipment`

| Column | Type | Notes |
| --- | --- | --- |
| id | INT | Primary key |
| asset_tag | VARCHAR(50) | Required, unique |
| equipment_name | VARCHAR(100) | Required device name |
| category | ENUM | Patient Monitor, Infusion Pump, Ventilator, Defibrillator, Diagnostic Imaging, Laboratory Analyzer, Other |
| manufacturer | VARCHAR(100) | Required |
| model_number | VARCHAR(100) | Required |
| serial_number | VARCHAR(100) | Required, unique |
| department | VARCHAR(100) | Required clinical department, such as ICU or Radiology |
| operational_status | ENUM | In Service, In Repair, Out of Service, Decommissioned |
| pm_interval | ENUM | Optional. Monthly, Quarterly, Semi-Annual, or Annual |
| purchase_date | DATE | Optional |
| last_maintenance_date | DATE | Last PM date. Optional. Moved only by preventive maintenance, incoming inspection, electrical safety test, or calibration |
| next_maintenance_date | DATE | Next PM due date. Optional. Used to calculate PM status |
| notes | TEXT | Optional |
| created_at | TIMESTAMP | Set on insert |
| updated_at | TIMESTAMP | Set on update |

`asset_tag` and `serial_number` each have a unique index. `next_maintenance_date` is indexed for the PM filter.

### `maintenance_history`

| Column | Type | Notes |
| --- | --- | --- |
| id | INT | Primary key |
| equipment_id | INT | Required foreign key to `equipment.id`. History cannot be deleted, and a device with history cannot be deleted (`ON DELETE RESTRICT`) |
| maintenance_type | ENUM | Preventive Maintenance, Corrective Maintenance, Incoming Inspection, Electrical Safety Test, Calibration, Asset Registration, Operational Status Change, PM Schedule Change |
| maintenance_date | DATE | Service date. Required. Cannot be in the future |
| performed_by | VARCHAR(100) | Required for a service visit. Empty for registration and record changes |
| performed_by_type | ENUM | In-House Engineer or Supplier Engineer. Required for a service visit |
| operational_status | ENUM | Status chosen after a service check. Empty for registration and record changes |
| remarks | VARCHAR(1000) | Findings, or a short note for a record change |
| created_at | TIMESTAMP | Set on insert |

`(equipment_id, maintenance_date)` is indexed for the history list.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/summary` | Counts for the whole inventory |
| GET | `/api/equipment` | List devices |
| GET | `/api/equipment/:id` | One device |
| POST | `/api/equipment` | Create a device |
| PUT | `/api/equipment/:id` | Update a device |
| DELETE | `/api/equipment/:id` | Deletes a device only when it has no history. Devices created in the app have a registration row, so this returns `409` |
| GET | `/api/equipment/:id/maintenance` | Service history for that device only, newest first |
| POST | `/api/equipment/:id/maintenance` | Add a service record for that device and update its PM dates |

List filters are optional query parameters:

| Parameter | Behavior |
| --- | --- |
| `q` | Matches asset tag, device name, category, manufacturer, model, serial number, or clinical department |
| `maintenance_status` | `Not Scheduled`, `Current`, `Due`, or `Overdue` |
| `category` | One of the device categories |
| `operational_status` | One of the operational statuses |
| `department` | Exact clinical department name |
| `pm_interval` | `Monthly`, `Quarterly`, `Semi-Annual`, or `Annual` |

An unknown category, operational status, PM status, or PM schedule returns `400`. Every device JSON object includes `maintenance_status`.

`GET /api/summary` returns:

```json
{
  "total": 5,
  "in_service": 3,
  "in_repair": 1,
  "out_of_service": 1,
  "decommissioned": 0,
  "due_soon": 1,
  "overdue": 2,
  "current": 1,
  "not_scheduled": 1,
  "departments": ["Emergency Department", "ICU", "Radiology"]
}
```

`due_soon` is the number of devices whose PM status is Due. Decommissioned devices are not included in `due_soon`, `overdue`, `current`, or `not_scheduled`.

`GET /api/summary` includes `decommissioned`. The device counts add up to `total`.

`POST /api/equipment/:id/maintenance` accepts `maintenance_type`, `maintenance_date`, `performed_by`, `performed_by_type`, `operational_status`, optional `remarks`, and optional `next_maintenance_date`. `performed_by_type` is `In-House Engineer` or `Supplier Engineer`. Omit `next_maintenance_date` to leave the current next PM date. Send an empty string to clear it. For a preventive maintenance, incoming inspection, electrical safety test, or calibration that is the latest visit, the next PM date follows the device schedule. Those same work types are the only ones that move the last PM date. Corrective maintenance does not.

Error responses look like `{ "errors": { "field": "message" } }`. A general problem uses `form`.

## Project layout

```text
server/index.js            Express app and route mounting
server/db.js               MySQL pool
server/routes/equipment.js Device CRUD and filtered list
server/routes/history.js   Service history
server/routes/summary.js   Dashboard counts
server/validate.js         Request checks
server/maintenance.js      PM status rules and filter dates
server/equipmentQuery.js   List SQL
server/present.js          JSON shape
server/http.js             Shared errors and id parsing
server/schema.sql          Tables and sample data
server/setup.js            Applies schema.sql
public/                    Page, styles, and browser script
tests/                     PM rules, validation, and filter SQL
```

## Limitations

This system keeps a local inventory of devices and the service history for each device. It does not cover patients, work orders, parts stock, purchasing, or supplier contracts.

There is no login. Anyone who can open the site can add, edit, and record service.

Creating a device writes an asset registration. The page does not offer delete, because that history stays with the device. To take a device out of use, set operational status to Decommissioned. Decommissioned devices remain in the list and in the device totals. They are left out of the PM counts and out of a PM status filter.

The last PM date changes only after preventive maintenance, an incoming inspection, an electrical safety test, or calibration. Corrective maintenance records the visit and can change the operational status, but it does not move the last PM date. The next PM date is recalculated from the schedule only for those same four work types, and only when the visit is the latest one.

Changing operational status from the edit form requires notes when the device is not left In Service. Those notes are copied onto the status-change row. A service visit requires findings instead of notes.

A department name is plain text. Two spellings of the same place are stored as two departments.

Dates use the date on the computer running the server. `npm test` checks the date rules, service validation, and filter SQL. It does not call the HTTP routes against MySQL.
