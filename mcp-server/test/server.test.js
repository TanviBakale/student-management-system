import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMcpServer } from '../src/server.js';
import { ApiClient } from '../src/apiClient.js';
import { MockBackendApi } from './mockApi.js';

describe('MCP Server End-to-End Tests (Official SDK & Mocked API)', () => {
  let mockApi;
  let originalFetch;
  let client;
  let server;

  beforeEach(async () => {
    mockApi = new MockBackendApi();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => mockApi.handleFetch(input, init);

    const apiClient = new ApiClient('http://localhost:5000');
    server = createMcpServer({ apiClient, name: 'test-student-mcp', version: '1.0.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    try {
      await client?.close();
      await server?.close();
    } catch {
      // Ignore cleanup close errors
    }
  });

  it('registers all 6 required MCP tools with descriptions and schemas', async () => {
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name).sort();

    const expectedTools = [
      'add_student',
      'delete_student',
      'get_student',
      'list_students',
      'search_students',
      'update_student'
    ].sort();

    assert.deepEqual(toolNames, expectedTools, 'All 6 required MCP tools must be registered');

    // Verify all tools have descriptions and input schemas
    for (const tool of tools) {
      assert.ok(tool.description && tool.description.length > 0, `Tool ${tool.name} must have a description`);
      assert.ok(tool.inputSchema, `Tool ${tool.name} must have an inputSchema`);
      assert.equal(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema must be type: object`);
    }

    // Verify delete_student has confirm boolean parameter
    const deleteTool = tools.find((t) => t.name === 'delete_student');
    assert.ok(deleteTool.inputSchema.properties.confirm, 'delete_student must declare confirm parameter');
    assert.ok(deleteTool.inputSchema.properties.id, 'delete_student must declare id parameter');
  });

  it('tool: list_students returns all students', async () => {
    const result = await client.callTool({
      name: 'list_students',
      arguments: {}
    });

    assert.equal(result.isError, undefined);
    assert.equal(Array.isArray(result.content), true);
    const text = result.content[0].text;
    assert.match(text, /Alice Johnson/);
    assert.match(text, /Bob Smith/);
    assert.match(text, /Charlie Brown/);
  });

  it('tool: list_students with section filter returns matching students', async () => {
    const result = await client.callTool({
      name: 'list_students',
      arguments: { section: 'B' }
    });

    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.match(text, /Bob Smith/);
    assert.doesNotMatch(text, /Alice Johnson/);
  });

  it('tool: search_students finds students matching keyword', async () => {
    const result = await client.callTool({
      name: 'search_students',
      arguments: { query: 'STU101' }
    });

    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.match(text, /Alice Johnson/);
    assert.match(text, /STU101/);
  });

  it('tool: search_students returns clear message when no matches found', async () => {
    const result = await client.callTool({
      name: 'search_students',
      arguments: { query: 'NonExistentSearchTermXYZ' }
    });

    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.match(text, /No students found/i);
  });

  it('tool: get_student retrieves student details by roll number', async () => {
    const result = await client.callTool({
      name: 'get_student',
      arguments: { id: 'STU101' }
    });

    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.match(text, /Alice Johnson/);
    assert.match(text, /alice@example.com/);
    assert.match(text, /Computer Science and Engineering/);
  });

  it('tool: get_student returns error for unknown student ID', async () => {
    const result = await client.callTool({
      name: 'get_student',
      arguments: { id: 'UNKNOWN_ID_999' }
    });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.match(text, /Student not found/i);
  });

  it('tool: add_student successfully creates a student with department name resolution', async () => {
    const result = await client.callTool({
      name: 'add_student',
      arguments: {
        studentId: 'CS2026',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        department: 'Computer Science and Engineering',
        section: 'A',
        semester: 1,
        contact: '555-0199'
      }
    });

    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.match(text, /Grace Hopper/);
    assert.match(text, /CS2026/);
    assert.match(text, /Success/i);

    // Verify retrieval of newly added student
    const getRes = await client.callTool({
      name: 'get_student',
      arguments: { id: 'CS2026' }
    });
    assert.match(getRes.content[0].text, /Grace Hopper/);
  });

  it('tool: add_student returns error on duplicate student ID', async () => {
    const result = await client.callTool({
      name: 'add_student',
      arguments: {
        studentId: 'STU101',
        name: 'Duplicate Student',
        email: 'newemail@example.com',
        department: 'Computer Science and Engineering',
        section: 'A',
        semester: 1
      }
    });

    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.match(text, /already exists/i);
  });

  it('tool: update_student updates fields successfully', async () => {
    const result = await client.callTool({
      name: 'update_student',
      arguments: {
        id: 'STU102',
        name: 'Robert C. Smith',
        section: 'A',
        semester: 6
      }
    });

    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.match(text, /Robert C\. Smith/);
    assert.match(text, /Success/i);

    // Verify updated details
    const getRes = await client.callTool({
      name: 'get_student',
      arguments: { id: 'STU102' }
    });
    assert.match(getRes.content[0].text, /Robert C\. Smith/);
  });

  it('tool: update_student requires at least one field to update', async () => {
    const result = await client.callTool({
      name: 'update_student',
      arguments: { id: 'STU102' }
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /No fields were provided to update/i);
  });

  it('tool: delete_student ABORTS when confirm is false (explicit confirmation safety check)', async () => {
    const result = await client.callTool({
      name: 'delete_student',
      arguments: {
        id: 'STU101',
        confirm: false
      }
    });

    // Must return an error/warning and NOT delete the student
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /DELETION ABORTED/);
    assert.match(result.content[0].text, /confirm: true/);

    // Verify student STU101 still exists and was not deleted!
    const verifyExists = await client.callTool({
      name: 'get_student',
      arguments: { id: 'STU101' }
    });
    assert.equal(verifyExists.isError, undefined);
    assert.match(verifyExists.content[0].text, /Alice Johnson/);
  });

  it('tool: delete_student PERFORMS deletion when confirm is true', async () => {
    const result = await client.callTool({
      name: 'delete_student',
      arguments: {
        id: 'STU103',
        confirm: true
      }
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /permanently deleted/i);

    // Verify student STU103 is now deleted
    const verifyDeleted = await client.callTool({
      name: 'get_student',
      arguments: { id: 'STU103' }
    });
    assert.equal(verifyDeleted.isError, true);
    assert.match(verifyDeleted.content[0].text, /Student not found/i);
  });

  it('handles backend network failures gracefully across tools without crashing', async () => {
    mockApi.setNetworkFailure(true);

    const result = await client.callTool({
      name: 'list_students',
      arguments: {}
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Unable to reach the Student Management API/);
  });

  it('verifies MongoDB credentials are never exposed in environment or configuration', () => {
    assert.equal(process.env.MONGODB_URI, undefined, 'MONGODB_URI must never be set or exposed in MCP server');
  });
});
