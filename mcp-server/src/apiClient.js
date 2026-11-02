/**
 * HTTP Client for connecting to the Student Management System Express API.
 * This client communicates strictly over HTTP and never connects directly to MongoDB.
 */

export class ApiClient {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Internal HTTP request helper with error handling.
   */
  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    };

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(options.timeoutMs || 10000)
      });
    } catch (networkError) {
      if (networkError.name === 'TimeoutError') {
        throw new Error(`Request timed out while connecting to API at ${this.baseUrl}.`);
      }
      throw new Error(`Unable to reach the Student Management API at ${this.baseUrl}. Check that the Express backend is running.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorMessage = payload?.message || `API request failed with HTTP ${response.status} (${response.statusText}).`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  /**
   * Check health of the backend Express API.
   */
  async checkHealth() {
    return this.request('/health');
  }

  /**
   * Retrieve list of all departments.
   */
  async listDepartments() {
    const res = await this.request('/api/departments');
    return res.data || [];
  }

  /**
   * Resolves a department name or ObjectId to a valid department ObjectId.
   */
  async resolveDepartmentId(departmentInput) {
    if (!departmentInput || typeof departmentInput !== 'string') {
      return departmentInput;
    }

    const trimmed = departmentInput.trim();
    // If it's already a 24-character hexadecimal ObjectId, return as-is
    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
      return trimmed;
    }

    // Try resolving department name by fetching departments
    try {
      const departments = await this.listDepartments();
      const lower = trimmed.toLowerCase();
      const match = departments.find(
        (d) => d.name && d.name.toLowerCase() === lower
      ) || departments.find(
        (d) => d.name && d.name.toLowerCase().includes(lower)
      );

      if (match) {
        return String(match._id);
      }
    } catch {
      // If fetching departments fails, pass the original input for backend validation
    }

    return trimmed;
  }

  /**
   * List students with optional department or section filters.
   * @param {Object} [filter]
   * @param {string} [filter.department] - Department ID or name
   * @param {string} [filter.section] - Section
   */
  async listStudents({ department, section } = {}) {
    const params = new URLSearchParams();
    if (department) {
      const resolvedDept = await this.resolveDepartmentId(department);
      params.append('department', resolvedDept);
    }
    if (section) {
      params.append('section', section.trim());
    }

    const queryStr = params.toString();
    const endpoint = `/api/students${queryStr ? `?${queryStr}` : ''}`;
    const res = await this.request(endpoint);
    return res.data || [];
  }

  /**
   * Search students by keyword (ID, name, email, section, department).
   * @param {string} query - Search keyword
   * @param {Object} [filter]
   * @param {string} [filter.department] - Department ID or name
   * @param {string} [filter.section] - Section
   */
  async searchStudents(query, { department, section } = {}) {
    const params = new URLSearchParams();
    if (query) {
      params.append('q', query.trim());
    }
    if (department) {
      const resolvedDept = await this.resolveDepartmentId(department);
      params.append('department', resolvedDept);
    }
    if (section) {
      params.append('section', section.trim());
    }

    const endpoint = `/api/students?${params.toString()}`;
    const res = await this.request(endpoint);
    return res.data || [];
  }

  /**
   * Get student details by MongoDB ID or studentId roll number.
   * @param {string} id - MongoDB ObjectId or studentId (e.g., 'STU101')
   */
  async getStudent(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('A valid student ID or roll number is required.');
    }
    const res = await this.request(`/api/students/${encodeURIComponent(id.trim())}`);
    return res.data;
  }

  /**
   * Create a new student record.
   * @param {Object} studentData
   */
  async addStudent(studentData) {
    const payload = { ...studentData };
    if (payload.department) {
      payload.department = await this.resolveDepartmentId(payload.department);
    }

    const res = await this.request('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res;
  }

  /**
   * Update student details by MongoDB ID or studentId.
   * @param {string} id - MongoDB ObjectId or studentId
   * @param {Object} updateData - Fields to update
   */
  async updateStudent(id, updateData) {
    if (!id || typeof id !== 'string') {
      throw new Error('A valid student ID or roll number is required.');
    }
    const payload = { ...updateData };
    if (payload.department) {
      payload.department = await this.resolveDepartmentId(payload.department);
    }

    const res = await this.request(`/api/students/${encodeURIComponent(id.trim())}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return res;
  }

  /**
   * Delete student by MongoDB ID or studentId.
   * @param {string} id - MongoDB ObjectId or studentId
   */
  async deleteStudent(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('A valid student ID or roll number is required.');
    }
    const res = await this.request(`/api/students/${encodeURIComponent(id.trim())}`, {
      method: 'DELETE'
    });
    return res;
  }
}

export default ApiClient;
