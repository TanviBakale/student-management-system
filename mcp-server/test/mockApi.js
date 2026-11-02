/**
 * Mock Backend API for Student Management System.
 * Simulates Express backend routes, status codes, and response structures
 * without requiring MongoDB Atlas or opening network ports.
 */

export class MockBackendApi {
  constructor() {
    this.reset();
  }

  reset() {
    this.departments = [
      {
        _id: '65b000000000000000000001',
        name: 'Computer Science and Engineering',
        sections: ['A', 'B'],
        studentCount: 2
      },
      {
        _id: '65b000000000000000000002',
        name: 'Information Technology',
        sections: ['A', 'B', 'C'],
        studentCount: 1
      },
      {
        _id: '65b000000000000000000003',
        name: 'Mechanical Engineering',
        sections: ['A'],
        studentCount: 0
      }
    ];

    this.students = [
      {
        _id: '65b000000000000000000011',
        studentId: 'STU101',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        department: {
          _id: '65b000000000000000000001',
          name: 'Computer Science and Engineering',
          sections: ['A', 'B']
        },
        section: 'A',
        semester: 3,
        contact: '9876543210',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z'
      },
      {
        _id: '65b000000000000000000012',
        studentId: 'STU102',
        name: 'Bob Smith',
        email: 'bob@example.com',
        department: {
          _id: '65b000000000000000000001',
          name: 'Computer Science and Engineering',
          sections: ['A', 'B']
        },
        section: 'B',
        semester: 4,
        contact: '9876543211',
        createdAt: '2026-01-16T10:00:00.000Z',
        updatedAt: '2026-01-16T10:00:00.000Z'
      },
      {
        _id: '65b000000000000000000013',
        studentId: 'STU103',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        department: {
          _id: '65b000000000000000000002',
          name: 'Information Technology',
          sections: ['A', 'B', 'C']
        },
        section: 'A',
        semester: 2,
        contact: '9876543212',
        createdAt: '2026-01-17T10:00:00.000Z',
        updatedAt: '2026-01-17T10:00:00.000Z'
      }
    ];

    this.networkFailure = false;
    this.customHandler = null;
  }

  setNetworkFailure(enabled = true) {
    this.networkFailure = enabled;
  }

  /**
   * Mock implementation of fetch to intercept calls directed to API_BASE_URL.
   */
  async handleFetch(input, init = {}) {
    if (this.networkFailure) {
      throw new TypeError('fetch failed');
    }

    const urlString = typeof input === 'string' ? input : input.url;
    const url = new URL(urlString, 'http://localhost:5000');
    const method = (init.method || 'GET').toUpperCase();
    const pathname = url.pathname;

    let body = null;
    if (init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    // Health check
    if (pathname === '/health' && method === 'GET') {
      return new Response(JSON.stringify({ success: true, status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Departments list
    if (pathname === '/api/departments' && method === 'GET') {
      return new Response(JSON.stringify({ success: true, data: this.departments }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Department by ID
    const deptMatch = pathname.match(/^\/api\/departments\/([a-fA-F0-9]{24})$/);
    if (deptMatch && method === 'GET') {
      const deptId = deptMatch[1];
      const dept = this.departments.find((d) => d._id === deptId);
      if (!dept) {
        return new Response(JSON.stringify({ success: false, message: 'Department not found.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, data: dept }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // List students / Search students
    if (pathname === '/api/students' && method === 'GET') {
      const q = url.searchParams.get('q');
      const department = url.searchParams.get('department');
      const section = url.searchParams.get('section');

      let results = [...this.students];

      if (department) {
        results = results.filter((s) =>
          (typeof s.department === 'object' ? s.department?._id : s.department) === department
        );
      }

      if (section) {
        results = results.filter((s) =>
          s.section && s.section.toLowerCase() === section.toLowerCase()
        );
      }

      if (q) {
        const queryLower = q.toLowerCase();
        results = results.filter((s) => {
          const deptName = typeof s.department === 'object' ? s.department?.name : '';
          return (
            (s.studentId && s.studentId.toLowerCase().includes(queryLower)) ||
            (s.name && s.name.toLowerCase().includes(queryLower)) ||
            (s.email && s.email.toLowerCase().includes(queryLower)) ||
            (s.section && s.section.toLowerCase().includes(queryLower)) ||
            (deptName && deptName.toLowerCase().includes(queryLower))
          );
        });
      }

      return new Response(JSON.stringify({ success: true, data: results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Single student routes (/api/students/:id)
    const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
    if (studentMatch) {
      const id = decodeURIComponent(studentMatch[1]).trim();

      const studentIndex = this.students.findIndex(
        (s) => s._id === id || s.studentId.toUpperCase() === id.toUpperCase()
      );
      const student = studentIndex !== -1 ? this.students[studentIndex] : null;

      // GET student by ID
      if (method === 'GET') {
        if (!student) {
          return new Response(JSON.stringify({ success: false, message: 'Student not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: true, data: student }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // PUT update student
      if (method === 'PUT') {
        if (!student) {
          return new Response(JSON.stringify({ success: false, message: 'Student not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Duplicate checks
        if (body.studentId && body.studentId.toUpperCase() !== student.studentId.toUpperCase()) {
          const duplicateId = this.students.find(
            (s) => s.studentId.toUpperCase() === body.studentId.toUpperCase()
          );
          if (duplicateId) {
            return new Response(JSON.stringify({ success: false, message: 'A record with this studentId already exists.' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        if (body.email && body.email.toLowerCase() !== student.email.toLowerCase()) {
          const duplicateEmail = this.students.find(
            (s) => s.email.toLowerCase() === body.email.toLowerCase()
          );
          if (duplicateEmail) {
            return new Response(JSON.stringify({ success: false, message: 'A student with this email already exists.' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        let deptObj = student.department;
        if (body.department) {
          const dept = this.departments.find((d) => d._id === body.department);
          if (!dept) {
            return new Response(JSON.stringify({ success: false, message: 'Select a valid department.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          deptObj = { _id: dept._id, name: dept.name, sections: dept.sections };
        }

        const updatedStudent = {
          ...student,
          ...body,
          studentId: body.studentId ? body.studentId.toUpperCase() : student.studentId,
          email: body.email ? body.email.toLowerCase() : student.email,
          department: deptObj,
          updatedAt: new Date().toISOString()
        };

        this.students[studentIndex] = updatedStudent;
        return new Response(JSON.stringify({ success: true, message: 'Student updated successfully.', data: updatedStudent }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // DELETE student
      if (method === 'DELETE') {
        if (!student) {
          return new Response(JSON.stringify({ success: false, message: 'Student not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        this.students.splice(studentIndex, 1);
        return new Response(JSON.stringify({ success: true, message: 'Student deleted successfully.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST create student
    if (pathname === '/api/students' && method === 'POST') {
      if (!body || !body.studentId || !body.name || !body.email || !body.department || body.semester === undefined) {
        return new Response(JSON.stringify({ success: false, message: 'Missing required student fields.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Duplicate studentId
      const existsId = this.students.find(
        (s) => s.studentId.toUpperCase() === String(body.studentId).trim().toUpperCase()
      );
      if (existsId) {
        return new Response(JSON.stringify({ success: false, message: 'A record with this studentId already exists.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Duplicate email
      const existsEmail = this.students.find(
        (s) => s.email.toLowerCase() === String(body.email).trim().toLowerCase()
      );
      if (existsEmail) {
        return new Response(JSON.stringify({ success: false, message: 'A student with this email already exists.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check department
      const dept = this.departments.find((d) => d._id === body.department);
      if (!dept) {
        return new Response(JSON.stringify({ success: false, message: 'Select a valid department.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check section
      if (body.section && dept.sections.length && !dept.sections.includes(body.section)) {
        return new Response(JSON.stringify({ success: false, message: 'Choose a section that belongs to the selected department.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const newStudent = {
        _id: `65b0000000000000000000${this.students.length + 20}`,
        studentId: String(body.studentId).trim().toUpperCase(),
        name: String(body.name).trim(),
        email: String(body.email).trim().toLowerCase(),
        department: {
          _id: dept._id,
          name: dept.name,
          sections: dept.sections
        },
        section: body.section || '',
        semester: Number(body.semester),
        contact: body.contact || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.students.unshift(newStudent);
      return new Response(JSON.stringify({ success: true, message: 'Student added successfully.', data: newStudent }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'The requested resource was not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default MockBackendApi;
