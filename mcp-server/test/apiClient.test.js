import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { ApiClient } from '../src/apiClient.js';
import { MockBackendApi } from './mockApi.js';

describe('ApiClient Unit Tests (Mocked Backend API)', () => {
  let mockApi;
  let client;
  let originalFetch;

  beforeEach(() => {
    mockApi = new MockBackendApi();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => mockApi.handleFetch(input, init);
    client = new ApiClient('http://localhost:5000');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('verifies API health check', async () => {
    const health = await client.checkHealth();
    assert.equal(health.success, true);
    assert.equal(health.status, 'ok');
  });

  it('lists all departments', async () => {
    const departments = await client.listDepartments();
    assert.equal(Array.isArray(departments), true);
    assert.equal(departments.length, 3);
    assert.equal(departments[0].name, 'Computer Science and Engineering');
  });

  it('resolves department name to ObjectId', async () => {
    const resolved = await client.resolveDepartmentId('Computer Science and Engineering');
    assert.equal(resolved, '65b000000000000000000001');

    // Partial case-insensitive resolution
    const partial = await client.resolveDepartmentId('information technology');
    assert.equal(partial, '65b000000000000000000002');

    // Direct ObjectId is returned unchanged
    const directId = '65b000000000000000000003';
    const unchanged = await client.resolveDepartmentId(directId);
    assert.equal(unchanged, directId);
  });

  it('lists all students without filters', async () => {
    const students = await client.listStudents();
    assert.equal(students.length, 3);
    assert.equal(students[0].studentId, 'STU101');
  });

  it('filters students by section', async () => {
    const sectionAStudents = await client.listStudents({ section: 'A' });
    assert.equal(sectionAStudents.length, 2);
    assert.ok(sectionAStudents.every((s) => s.section === 'A'));
  });

  it('filters students by department name or ID', async () => {
    const cseStudents = await client.listStudents({ department: 'Computer Science and Engineering' });
    assert.equal(cseStudents.length, 2);
  });

  it('searches students by keyword (name, roll number, or email)', async () => {
    const results = await client.searchStudents('Alice');
    assert.equal(results.length, 1);
    assert.equal(results[0].studentId, 'STU101');

    const rollResults = await client.searchStudents('STU102');
    assert.equal(rollResults.length, 1);
    assert.equal(rollResults[0].name, 'Bob Smith');

    const emailResults = await client.searchStudents('charlie@example.com');
    assert.equal(emailResults.length, 1);
  });

  it('retrieves student by studentId or ObjectId', async () => {
    const byRoll = await client.getStudent('STU101');
    assert.equal(byRoll.name, 'Alice Johnson');

    const byMongoId = await client.getStudent('65b000000000000000000011');
    assert.equal(byMongoId.studentId, 'STU101');
  });

  it('throws a 404 error when retrieving non-existent student', async () => {
    await assert.rejects(
      async () => client.getStudent('NONEXISTENT'),
      (err) => {
        assert.equal(err.status, 404);
        assert.match(err.message, /Student not found/i);
        return true;
      }
    );
  });

  it('adds a new student successfully', async () => {
    const newStudent = {
      studentId: 'STU104',
      name: 'Diana Prince',
      email: 'diana@example.com',
      department: 'Computer Science and Engineering',
      section: 'A',
      semester: 1,
      contact: '9876543213'
    };

    const res = await client.addStudent(newStudent);
    assert.equal(res.success, true);
    assert.equal(res.data.studentId, 'STU104');
    assert.equal(res.data.name, 'Diana Prince');

    // Verify it can now be retrieved
    const fetched = await client.getStudent('STU104');
    assert.equal(fetched.name, 'Diana Prince');
  });

  it('rejects adding a student with duplicate studentId', async () => {
    const duplicate = {
      studentId: 'STU101',
      name: 'Clone Alice',
      email: 'clone@example.com',
      department: '65b000000000000000000001',
      semester: 1
    };

    await assert.rejects(
      async () => client.addStudent(duplicate),
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /studentId already exists/i);
        return true;
      }
    );
  });

  it('rejects adding a student with duplicate email', async () => {
    const duplicate = {
      studentId: 'STU999',
      name: 'Duplicate Email User',
      email: 'alice@example.com',
      department: '65b000000000000000000001',
      semester: 1
    };

    await assert.rejects(
      async () => client.addStudent(duplicate),
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /email already exists/i);
        return true;
      }
    );
  });

  it('updates an existing student details', async () => {
    const res = await client.updateStudent('STU102', {
      name: 'Robert Smith',
      section: 'A',
      semester: 5
    });

    assert.equal(res.success, true);
    assert.equal(res.data.name, 'Robert Smith');
    assert.equal(res.data.section, 'A');
    assert.equal(res.data.semester, 5);

    const fetched = await client.getStudent('STU102');
    assert.equal(fetched.name, 'Robert Smith');
  });

  it('deletes an existing student', async () => {
    const res = await client.deleteStudent('STU103');
    assert.equal(res.success, true);

    await assert.rejects(
      async () => client.getStudent('STU103'),
      (err) => {
        assert.equal(err.status, 404);
        return true;
      }
    );
  });

  it('handles backend network connection failures with clear error message', async () => {
    mockApi.setNetworkFailure(true);

    await assert.rejects(
      async () => client.listStudents(),
      (err) => {
        assert.match(err.message, /Unable to reach the Student Management API/);
        return true;
      }
    );
  });
});
