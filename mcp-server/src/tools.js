import { z } from 'zod';

/**
 * Format a single student record into human-readable text.
 */
function formatStudent(student) {
  const deptName = typeof student.department === 'object' && student.department?.name
    ? student.department.name
    : (student.department || 'N/A');

  return [
    `• Student ID: ${student.studentId || 'N/A'}`,
    `  Name: ${student.name}`,
    `  Email: ${student.email}`,
    `  Department: ${deptName}`,
    `  Section: ${student.section || 'None'}`,
    `  Semester: ${student.semester}`,
    `  Contact: ${student.contact || 'None'}`,
    `  Database ID: ${student._id}`
  ].join('\n');
}

/**
 * Format an array of students into human-readable and structured text.
 */
function formatStudentsList(students, title = 'Students') {
  if (!students || students.length === 0) {
    return 'No students found.';
  }
  const formattedItems = students.map(formatStudent).join('\n\n');
  return `${title} (${students.length}):\n\n${formattedItems}\n\nJSON data:\n${JSON.stringify(students, null, 2)}`;
}

/**
 * Register all 6 MCP tools to an McpServer instance.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./apiClient.js').ApiClient} apiClient
 */
export function registerTools(server, apiClient) {
  // 1. list_students – list students
  server.tool(
    'list_students',
    'List students from the Student Management System with optional department or section filters',
    {
      department: z.string().optional().describe('Optional department ID or name to filter by'),
      section: z.string().optional().describe('Optional section (e.g., "A", "B") to filter by')
    },
    async ({ department, section }) => {
      try {
        const students = await apiClient.listStudents({ department, section });
        let title = 'All Students';
        if (department && section) title = `Students in ${department} Section ${section}`;
        else if (department) title = `Students in Department ${department}`;
        else if (section) title = `Students in Section ${section}`;

        return {
          content: [{ type: 'text', text: formatStudentsList(students, title) }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list students: ${error.message}` }]
        };
      }
    }
  );

  // 2. search_students – search by student ID, name or email
  server.tool(
    'search_students',
    'Search students by student ID (roll number), name, email, section, or department name',
    {
      query: z.string().min(1, 'Search query cannot be empty').describe('Search keyword to match against student ID, name, email, section, or department'),
      department: z.string().optional().describe('Optional department ID or name filter'),
      section: z.string().optional().describe('Optional section filter')
    },
    async ({ query, department, section }) => {
      try {
        const students = await apiClient.searchStudents(query, { department, section });
        return {
          content: [{ type: 'text', text: formatStudentsList(students, `Search Results for "${query}"`) }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to search students: ${error.message}` }]
        };
      }
    }
  );

  // 3. get_student – get student details by ID
  server.tool(
    'get_student',
    'Get full student details by student ID (roll number, e.g. "CS101") or MongoDB ObjectId',
    {
      id: z.string().min(1, 'Student ID is required').describe('Student ID (e.g. "CS101") or MongoDB ObjectId')
    },
    async ({ id }) => {
      try {
        const student = await apiClient.getStudent(id);
        if (!student) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Student with identifier "${id}" not found.` }]
          };
        }
        const text = `Student Details for "${id}":\n\n${formatStudent(student)}\n\nJSON data:\n${JSON.stringify(student, null, 2)}`;
        return {
          content: [{ type: 'text', text }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get student: ${error.message}` }]
        };
      }
    }
  );

  // 4. add_student – add a student
  server.tool(
    'add_student',
    'Add a new student to the Student Management System',
    {
      studentId: z.string().min(2, 'Student ID must have at least 2 characters').max(30, 'Student ID must have at most 30 characters').describe('Unique student roll number / ID (e.g., "CS101")'),
      name: z.string().min(2, 'Name must have at least 2 characters').max(100, 'Name must have at most 100 characters').describe('Student full name'),
      email: z.string().transform((v) => v.replace(/\s+/g, '')).pipe(z.string().email('Enter a valid email address')).describe('Student email address'),
      department: z.string().min(1, 'Department is required').describe('Department MongoDB ObjectId or department name'),
      section: z.string().max(40, 'Section must be 40 characters or fewer').optional().describe('Section (e.g., "A", "B")'),
      semester: z.number().int('Semester must be an integer').min(1, 'Semester must be at least 1').max(12, 'Semester must be at most 12').describe('Semester number (1-12)'),
      contact: z.string().max(20, 'Contact must be 20 characters or fewer').optional().describe('Contact phone number (optional)')
    },
    async (params) => {
      try {
        const result = await apiClient.addStudent(params);
        const student = result.data || params;
        const text = `Success: Student "${params.name}" (${params.studentId}) was created successfully.\n\n${formatStudent(student)}\n\nJSON data:\n${JSON.stringify(student, null, 2)}`;
        return {
          content: [{ type: 'text', text }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to add student: ${error.message}` }]
        };
      }
    }
  );

  // 5. update_student – update student details
  server.tool(
    'update_student',
    'Update an existing student record by student ID or MongoDB ObjectId',
    {
      id: z.string().min(1, 'Student identifier is required').describe('Current student ID (roll number) or MongoDB ObjectId to identify the record'),
      studentId: z.string().min(2).max(30).optional().describe('New student ID / roll number'),
      name: z.string().min(2).max(100).optional().describe('Updated full name'),
      email: z.string().transform((v) => v.replace(/\s+/g, '')).pipe(z.string().email()).optional().describe('Updated email address'),
      department: z.string().optional().describe('Updated department ObjectId or department name'),
      section: z.string().max(40).optional().describe('Updated section'),
      semester: z.number().int().min(1).max(12).optional().describe('Updated semester (1-12)'),
      contact: z.string().max(20).optional().describe('Updated contact phone number')
    },
    async ({ id, ...updateFields }) => {
      try {
        // Filter out undefined fields
        const payload = Object.fromEntries(
          Object.entries(updateFields).filter(([_, value]) => value !== undefined)
        );

        if (Object.keys(payload).length === 0) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'No fields were provided to update. Please specify at least one field to change.' }]
          };
        }

        const result = await apiClient.updateStudent(id, payload);
        const updatedStudent = result.data || {};
        const text = `Success: Student "${id}" was updated successfully.\n\n${formatStudent(updatedStudent)}\n\nJSON data:\n${JSON.stringify(updatedStudent, null, 2)}`;
        return {
          content: [{ type: 'text', text }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to update student: ${error.message}` }]
        };
      }
    }
  );

  // 6. delete_student – delete a student
  // Requirement: "Require explicit confirmation for destructive delete operations."
  server.tool(
    'delete_student',
    'Delete a student record permanently by student ID or MongoDB ObjectId. Requires explicit confirmation (confirm: true).',
    {
      id: z.string().min(1, 'Student identifier is required').describe('Student ID (roll number) or MongoDB ObjectId of the student to delete'),
      confirm: z.boolean().describe('Explicit confirmation flag. Must be set to true to execute this destructive deletion')
    },
    async ({ id, confirm }) => {
      // Enforce explicit confirmation check
      if (confirm !== true) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `DELETION ABORTED: Deleting a student is a permanent, destructive operation. To confirm deletion of student "${id}", please re-invoke this tool with confirm: true.`
          }]
        };
      }

      try {
        const result = await apiClient.deleteStudent(id);
        return {
          content: [{
            type: 'text',
            text: `Success: Student "${id}" has been permanently deleted from the system.`
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to delete student: ${error.message}` }]
        };
      }
    }
  );
}
