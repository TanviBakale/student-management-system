# Student Management System - MCP Server

An official Model Context Protocol (MCP) server for the Student Management System. This server enables LLM agents (Claude Desktop, Cursor, Antigravity, etc.) to safely interact with student records through standardized MCP tools.

## Architecture & Security Principles

```text
┌─────────────────┐       stdio        ┌────────────────────────┐       HTTP REST       ┌──────────────────┐
│   MCP Client    │  ◄───────────────► │  Student Management    │  ◄──────────────────► │  Express Backend │
│ (Claude/Cursor) │  (JSON-RPC over    │       MCP Server       │      (/api/students)  │      API         │
└─────────────────┘       stdio)       └────────────────────────┘                       └────────┬─────────┘
                                                                                                 │ Mongoose
                                                                                                 ▼
                                                                                        ┌──────────────────┐
                                                                                        │  MongoDB Atlas   │
                                                                                        └──────────────────┘
```

- **REST API Only:** The MCP server connects strictly to the existing Express REST API over HTTP (`API_BASE_URL`). It does not connect directly to MongoDB.
- **Credential Protection:** MongoDB credentials and Atlas URIs are never loaded, required, or exposed by the MCP server.
- **Safe Stdio Transport:** Standard input/output is reserved strictly for JSON-RPC message framing. All server logs and diagnostic information are piped safely to `stderr`.
- **Destructive Operation Safeguards:** Deleting a student via `delete_student` requires explicit confirmation (`confirm: true`).
- **Validation:** All inputs are strictly validated using Zod schemas before hitting the backend.

---

## Prerequisites

- **Node.js** 18.11 or later (ES Modules support)
- Running Express backend API (defaults to `http://localhost:5000`)

---

## Installation & Setup

1. Navigate to the `mcp-server` directory:
   ```bash
   cd mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Default contents of `.env`:
   ```env
   # Target Express API Base URL
   API_BASE_URL=http://localhost:5000
   ```

---

## Starting the MCP Server

Start the MCP server using standard I/O (stdio) transport:

```bash
# Using npm
npm start

# Or directly with node
node src/index.js
```

---

## Running Automated Tests

Run the full automated test suite using Node.js built-in test runner:

```bash
npm test
```

The test suite runs against a complete in-process mocked Express backend API that mirrors the real backend routes, schemas, and error responses. Tests run completely offline and isolated, requiring no active database connection or external network access.

---

## Available MCP Tools

The server implements six tools:

### 1. `list_students`
Lists students with optional department or section filtering.

- **Parameters:**
  - `department` *(string, optional)*: Department ID (MongoDB ObjectId) or department name to filter by.
  - `section` *(string, optional)*: Section identifier (e.g., `"A"`, `"B"`) to filter by.
- **Example Usage:**
  ```json
  {
    "section": "A"
  }
  ```

### 2. `search_students`
Searches students across student ID (roll number), name, email, section, or department name.

- **Parameters:**
  - `query` *(string, required)*: Search keyword.
  - `department` *(string, optional)*: Department ID or name filter.
  - `section` *(string, optional)*: Section filter.
- **Example Usage:**
  ```json
  {
    "query": "Alice"
  }
  ```

### 3. `get_student`
Retrieves detailed information for a single student by student ID (roll number) or MongoDB ObjectId.

- **Parameters:**
  - `id` *(string, required)*: Student ID (e.g., `"CS101"`) or MongoDB ObjectId.
- **Example Usage:**
  ```json
  {
    "id": "CS101"
  }
  ```

### 4. `add_student`
Adds a new student to the system. Automatically resolves department names to their database ObjectId.

- **Parameters:**
  - `studentId` *(string, required)*: Unique student roll number (2-30 characters, e.g. `"CS202601"`).
  - `name` *(string, required)*: Student's full name (2-100 characters).
  - `email` *(string, required)*: Valid email address.
  - `department` *(string, required)*: Department ObjectId or Department Name (e.g., `"Computer Science and Engineering"`).
  - `section` *(string, optional)*: Section (e.g., `"A"`).
  - `semester` *(number, required)*: Current semester integer (1-12).
  - `contact` *(string, optional)*: Phone number / contact string (up to 20 characters).
- **Example Usage:**
  ```json
  {
    "studentId": "CS202601",
    "name": "Alan Turing",
    "email": "alan.turing@example.edu",
    "department": "Computer Science and Engineering",
    "section": "A",
    "semester": 1,
    "contact": "+1-555-0101"
  }
  ```

### 5. `update_student`
Updates existing student details.

- **Parameters:**
  - `id` *(string, required)*: Student ID (roll number) or MongoDB ObjectId of the record to update.
  - `studentId` *(string, optional)*: Updated student ID.
  - `name` *(string, optional)*: Updated name.
  - `email` *(string, optional)*: Updated email address.
  - `department` *(string, optional)*: Updated department ObjectId or department name.
  - `section` *(string, optional)*: Updated section.
  - `semester` *(number, optional)*: Updated semester integer (1-12).
  - `contact` *(string, optional)*: Updated contact number.
- **Example Usage:**
  ```json
  {
    "id": "CS202601",
    "semester": 2,
    "section": "B"
  }
  ```

### 6. `delete_student`
Permanently deletes a student record. Requires explicit confirmation.

- **Parameters:**
  - `id` *(string, required)*: Student ID (roll number) or MongoDB ObjectId to delete.
  - `confirm` *(boolean, required)*: Must be set to `true` to confirm deletion.
- **Safety Mechanism:**
  If invoked with `confirm: false`, the deletion is aborted, the database remains untouched, and the tool returns a warning prompting the user for explicit confirmation.
- **Example Usage:**
  ```json
  {
    "id": "CS202601",
    "confirm": true
  }
  ```

---

## MCP Client Configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "student-management": {
      "command": "node",
      "args": [
        "C:\\Users\\TanviBakale\\Documents\\P11\\mcp-server\\src\\index.js"
      ],
      "env": {
        "API_BASE_URL": "http://localhost:5000"
      }
    }
  }
}
```

### Cursor / Antigravity MCP Settings

```json
{
  "mcpServers": {
    "student-management": {
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "C:\\Users\\TanviBakale\\Documents\\P11\\mcp-server",
      "env": {
        "API_BASE_URL": "http://localhost:5000"
      }
    }
  }
}
```
